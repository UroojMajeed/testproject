/**
 * Connection doctor. Answers one question — can this machine reach that database
 * with those credentials — and when it cannot, says which of the four things went
 * wrong rather than leaving a driver stack trace to interpret.
 *
 * Usage: npm run db:check
 */
import mongoose from 'mongoose';
import dns from 'node:dns/promises';
import { env, databaseNameFrom, DEFAULT_DB_NAME } from '../config/env.js';

/* eslint-disable no-console */

/**
 * Splits a connection string at the LAST @ in the whole value, not the first.
 *
 * A password containing an unencoded @ or / makes the string genuinely
 * ambiguous, and splitting on the first @ would both mis-locate the password
 * and — worse — leave part of it unmasked. Taking the last @ over-masks in the
 * rare case a query parameter contains one, which is the correct direction to
 * fail for a secret.
 */
export function splitUri(uri) {
  const schemeMatch = uri.match(/^mongodb(?:\+srv)?:\/\//);
  if (!schemeMatch) return { present: false, scheme: '', userinfo: '', rest: uri };

  const scheme = schemeMatch[0];
  const afterScheme = uri.slice(scheme.length);
  const at = afterScheme.lastIndexOf('@');
  if (at === -1) return { present: false, scheme, userinfo: '', rest: afterScheme };

  return { present: true, scheme, userinfo: afterScheme.slice(0, at), rest: afterScheme.slice(at + 1) };
}

/** Never print a password, even to the person who owns it. */
export function maskUri(uri) {
  const { present, scheme, userinfo, rest } = splitUri(uri);
  if (!present) return uri;

  const colon = userinfo.indexOf(':');
  const user = colon === -1 ? userinfo : userinfo.slice(0, colon);
  return colon === -1 ? uri : `${scheme}${user}:••••••@${rest}`;
}

/**
 * Describes the credentials without revealing them. Length is the fastest way to
 * tell a stale password from a current one.
 */
export function describeCredentials(uri) {
  const { present, userinfo } = splitUri(uri);
  if (!present) return { present: false };

  const colon = userinfo.indexOf(':');
  const user = colon === -1 ? userinfo : userinfo.slice(0, colon);
  const password = colon === -1 ? '' : userinfo.slice(colon + 1);

  // Reserved in a userinfo section; each must be percent-encoded to survive.
  const needsEncoding = [...new Set(password.match(/[@:/?#[\]]/g) ?? [])];

  return {
    present: true,
    user,
    length: password.length,
    empty: password.length === 0,
    needsEncoding,
    looksEncoded: /%[0-9a-fA-F]{2}/.test(password),
    alphanumeric: password.length > 0 && /^[A-Za-z0-9]+$/.test(password),
    // A / or ? inside the userinfo means nothing can parse the string reliably,
    // this tool included. Say so instead of guessing.
    ambiguous: /[/?]/.test(password),
  };
}

export function hostsFrom(uri) {
  const m = uri.match(/^mongodb(\+srv)?:\/\/(?:[^@]+@)?([^/?]+)/);
  return { srv: Boolean(m?.[1]), hosts: m?.[2]?.split(',') ?? [] };
}

/**
 * A replica-set auth failure can arrive wrapped in a selection error, with the
 * real reason buried per-server. Pull it out so "wrong password" is never
 * reported as "check your IP allowlist".
 */
export function nestedServerErrors(err) {
  const servers = err.reason?.servers;
  if (!servers) return [];
  return [...servers.values()].map((s) => String(s?.error?.message ?? '')).filter(Boolean);
}

/** Maps a failure to the thing to actually go and do about it. */
export function diagnose(err, { srv, hosts }) {
  const code = err.code ?? err.codeName;
  const nested = nestedServerErrors(err);
  // Mongoose wraps driver errors, so the message to match on may be nested.
  const msg = [String(err.message ?? ''), ...nested].join(' | ');

  if (code === 'ESERVFAIL' || (srv && code === 'ENOTFOUND')) {
    return {
      cause: 'Your DNS resolver would not answer the SRV lookup that mongodb+srv:// needs.',
      fix: [
        'Point Windows at a resolver that handles SRV:',
        '  Set-DnsClientServerAddress -InterfaceAlias "Wi-Fi" -ServerAddresses 1.1.1.1,8.8.8.8',
        '  Clear-DnsClientCache',
        'Or sidestep SRV entirely: Atlas > Connect > Drivers > Node.js "2.2.12 or later"',
        'gives a plain mongodb:// string with explicit hosts.',
      ],
    };
  }

  if (msg.includes('bad auth') || code === 8000 || code === 18) {
    return {
      cause: 'The server was reached, but it rejected the username or password.',
      fix: [
        'The commonest reason is a rotated password that .env still has the old value for.',
        'Atlas > Database Access > your user > Edit > Password > Autogenerate,',
        'copy it straight into MONGODB_URI, and save.',
        '',
        'Also worth checking:',
        '  - the username matches exactly (Atlas auto-generates names like *_db_user)',
        '  - no stray space, quote or semicolon around the value in .env',
        '  - special characters are percent-encoded: @ is %40, # is %23, / is %2F',
        '  - the user has a role, e.g. "Read and write to any database"',
        '  - the user still exists (Atlas > Database Access lists them all)',
        '',
        'Compare the password length printed above with the one Atlas gave you.',
        'A change can also take up to a minute to take effect.',
      ],
    };
  }

  if (/ServerSelectionError/.test(err.name ?? '') || code === 'ETIMEDOUT') {
    const reason = err.reason?.type ? ` (${err.reason.type})` : '';
    return {
      cause: `The host resolved, but no server answered before the timeout${reason}.`,
      fix: [
        'Almost always the IP allowlist: Atlas > Network Access > Add IP Address.',
        'Use "Add Current IP Address", or 0.0.0.0/0 while developing.',
        '',
        'If your IP is already allowed, check the cluster is not paused.',
      ],
    };
  }

  if (code === 'ENOTFOUND') {
    return {
      cause: `Hostname did not resolve: ${hosts.join(', ')}`,
      fix: ['Check the cluster hostname in MONGODB_URI against Atlas > Connect.'],
    };
  }

  return { cause: msg || 'Unrecognised failure.', fix: ['Full error below.'] };
}

async function main() {
  const uri = env.MONGODB_URI;
  const { srv, hosts } = hostsFrom(uri);
  const named = databaseNameFrom(uri);
  const creds = describeCredentials(uri);

  console.log('\nChecking the database connection\n');
  console.log(`  uri        ${maskUri(uri)}`);

  if (creds.present) {
    console.log(`  user       ${creds.user}`);
    if (creds.ambiguous) {
      console.log('  password   CANNOT BE READ — it contains a / or ? that is not percent-encoded,');
      console.log('             which makes the whole connection string ambiguous. Encode it');
      console.log('             (/ is %2F, ? is %3F) or let Atlas autogenerate an alphanumeric one.');
    } else {
      const notes = [];
      if (creds.empty) notes.push('EMPTY — nothing between : and @');
      if (creds.alphanumeric) notes.push('alphanumeric, no encoding needed');
      if (creds.needsEncoding.length) {
        notes.push(`contains ${creds.needsEncoding.join(' ')} — MUST be percent-encoded`);
      }
      if (creds.looksEncoded) notes.push('contains a %XX sequence — check it is not double-encoded');
      console.log(`  password   ${creds.length} characters${notes.length ? ` (${notes.join('; ')})` : ''}`);
      console.log('             compare that length with what Atlas shows — a mismatch means .env is stale');
    }
  } else {
    console.log('  user       none in the uri — Atlas needs username:password@');
  }

  console.log(`  style      ${srv ? 'mongodb+srv (needs a DNS SRV lookup)' : 'mongodb (explicit hosts)'}`);
  console.log(`  host(s)    ${hosts.join(', ')}`);
  console.log(`  database   ${named ?? `${DEFAULT_DB_NAME} (falling back — the uri names none)`}`);

  if (srv) {
    try {
      const records = await dns.resolveSrv(`_mongodb._tcp.${hosts[0]}`);
      console.log(`  srv        resolved to ${records.length} host(s)`);
    } catch (err) {
      console.log(`  srv        FAILED (${err.code})`);
    }
  }

  console.log('\n  connecting…\n');

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      ...(named ? {} : { dbName: DEFAULT_DB_NAME }),
    });

    const { version } = await mongoose.connection.db.admin().serverInfo();
    const collections = await mongoose.connection.db.listCollections().toArray();

    console.log('  CONNECTED');
    console.log(`  mongo      ${version}`);
    console.log(`  database   ${mongoose.connection.db.databaseName}`);
    console.log(`  collections ${collections.length}`
      + (collections.length ? `: ${collections.map((c) => c.name).sort().join(', ')}` : ' (empty)'));
    console.log('\n  All good.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    const { cause, fix } = diagnose(err, { srv, hosts });
    console.error(`  FAILED — ${cause}\n`);
    for (const line of fix) console.error(`  ${line}`);
    console.error(`\n  (driver said: ${err.message})\n`);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

// Only run when invoked directly, so tests can import the helpers.
if (process.argv[1] && process.argv[1].endsWith('check.js')) main();
