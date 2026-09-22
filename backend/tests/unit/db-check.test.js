import { describe, it, expect } from 'vitest';
import {
  diagnose, maskUri, hostsFrom, nestedServerErrors, describeCredentials, splitUri,
} from '../../src/db/check.js';

const ctx = { srv: true, hosts: ['reclaimos.e0hbjlt.mongodb.net'] };

describe('maskUri', () => {
  it('hides the password', () => {
    const masked = maskUri('mongodb+srv://myuser:s3cr3tPassw0rd@c.abc.mongodb.net/db');
    expect(masked).not.toContain('s3cr3tPassw0rd');
    expect(masked).toContain('myuser');
    expect(masked).toContain('••••••');
  });

  it('leaves a uri with no credentials alone', () => {
    const uri = 'mongodb://127.0.0.1:27017/reclaimos';
    expect(maskUri(uri)).toBe(uri);
  });

  it('masks the whole password even when it contains an unencoded @', () => {
    // Splitting on the first @ would print "••••••@ssw0rd" and leak most of it.
    const masked = maskUri('mongodb+srv://myuser:pa@ssw0rd@c.abc.mongodb.net/db');
    expect(masked).not.toContain('ssw0rd');
    expect(masked).toBe('mongodb+srv://myuser:••••••@c.abc.mongodb.net/db');
  });

  it('masks the whole password even when it contains an unencoded slash', () => {
    const masked = maskUri('mongodb+srv://myuser:pa/ss@c.abc.mongodb.net/db');
    expect(masked).not.toContain('pa/ss');
    expect(masked).not.toContain('ss@');
  });
});

describe('hostsFrom', () => {
  it('detects srv style', () => {
    expect(hostsFrom('mongodb+srv://u:p@c.abc.mongodb.net/db')).toEqual({
      srv: true, hosts: ['c.abc.mongodb.net'],
    });
  });

  it('lists every host in a standard string', () => {
    const { srv, hosts } = hostsFrom('mongodb://u:p@a.net:27017,b.net:27017,c.net:27017/db?ssl=true');
    expect(srv).toBe(false);
    expect(hosts).toHaveLength(3);
  });
});

describe('diagnose', () => {
  it('reports a rejected password as credentials, not as a network problem', () => {
    // This is the exact shape Atlas + the driver produce for a wrong password.
    const err = Object.assign(new Error('bad auth : authentication failed'), {
      name: 'MongoServerError', code: 8000, codeName: 'AtlasError',
    });
    const { cause, fix } = diagnose(err, ctx);

    expect(cause).toMatch(/rejected the username or password/);
    expect(fix.join(' ')).toMatch(/rotated password/);
    expect(cause).not.toMatch(/allowlist|timeout/i);
  });

  it('reports a failed SRV lookup as DNS', () => {
    const err = Object.assign(new Error('querySrv ESERVFAIL _mongodb._tcp.x.mongodb.net'), {
      code: 'ESERVFAIL', syscall: 'querySrv',
    });
    const { cause, fix } = diagnose(err, ctx);

    expect(cause).toMatch(/SRV lookup/);
    expect(fix.join(' ')).toMatch(/1\.1\.1\.1/);
  });

  it('reports an unreachable replica set as the IP allowlist', () => {
    const err = Object.assign(new Error('Could not connect to any servers'), {
      name: 'MongooseServerSelectionError',
      reason: { type: 'ReplicaSetNoPrimary', servers: new Map() },
    });
    const { cause, fix } = diagnose(err, ctx);

    expect(cause).toMatch(/no server answered/);
    expect(cause).toContain('ReplicaSetNoPrimary');
    expect(fix.join(' ')).toMatch(/Network Access/);
  });

  it('digs an auth failure out of a selection error rather than blaming the IP', () => {
    // Mongoose sometimes wraps the auth failure per-server. Reporting "check
    // your IP" here would send someone down completely the wrong path.
    const err = Object.assign(new Error('Could not connect to any servers'), {
      name: 'MongooseServerSelectionError',
      reason: {
        type: 'ReplicaSetNoPrimary',
        servers: new Map([['a.net:27017', { error: new Error('bad auth : authentication failed') }]]),
      },
    });
    const { cause } = diagnose(err, ctx);
    expect(cause).toMatch(/rejected the username or password/);
  });

  it('matches the driver name as well as the mongoose one', () => {
    const err = Object.assign(new Error('timed out'), { name: 'MongoServerSelectionError' });
    expect(diagnose(err, ctx).cause).toMatch(/no server answered/);
  });

  it('reports an unresolvable host distinctly', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND wrong.host'), { code: 'ENOTFOUND' });
    const { cause } = diagnose(err, { srv: false, hosts: ['wrong.host'] });
    expect(cause).toMatch(/did not resolve/);
    expect(cause).toContain('wrong.host');
  });

  it('falls back to the driver message rather than inventing a cause', () => {
    const { cause } = diagnose(new Error('something entirely new'), ctx);
    expect(cause).toBe('something entirely new');
  });
});

describe('nestedServerErrors', () => {
  it('returns nothing when there is no reason attached', () => {
    expect(nestedServerErrors(new Error('plain'))).toEqual([]);
  });

  it('skips servers that reported no error', () => {
    const err = Object.assign(new Error('x'), {
      reason: { servers: new Map([['a', {}], ['b', { error: new Error('real') }]]) },
    });
    expect(nestedServerErrors(err)).toEqual(['real']);
  });
});

describe('describeCredentials', () => {
  const of = (pwd) => describeCredentials(`mongodb+srv://myuser:${pwd}@c.abc.mongodb.net/db`);

  it('reports the length without revealing the password', () => {
    const d = of('cCsxoFeHZPRMArC6');
    expect(d.length).toBe(16);
    expect(JSON.stringify(d)).not.toContain('cCsxoFeHZPRMArC6');
  });

  it('recognises an autogenerated alphanumeric password as safe', () => {
    const d = of('aB3dEf7hJk9mNp2q');
    expect(d.alphanumeric).toBe(true);
    expect(d.needsEncoding).toEqual([]);
  });

  it('names the exact characters that need encoding', () => {
    const d = of('pa@ss-wo.rd');
    expect(d.alphanumeric).toBe(false);
    expect(d.needsEncoding).toContain('@');
  });

  it('locates the password correctly even with an unencoded @ in it', () => {
    // Splitting on the first @ would silently truncate the password and report
    // a misleadingly short length.
    const d = describeCredentials('mongodb+srv://myuser:pa@ssw0rd@c.abc.mongodb.net/db');
    expect(d.user).toBe('myuser');
    expect(d.length).toBe('pa@ssw0rd'.length);
    expect(d.needsEncoding).toContain('@');
    expect(d.ambiguous).toBe(false);
  });

  it('admits when a / in the password makes the string unparseable', () => {
    // Nothing can read this reliably, Mongo included. Reporting a confident
    // length here would send someone hunting for the wrong problem.
    const d = describeCredentials('mongodb+srv://myuser:pa/ssw0rd@c.abc.mongodb.net/db');
    expect(d.ambiguous).toBe(true);
    expect(d.needsEncoding).toContain('/');
  });

  it('does not mistake the host for part of the password', () => {
    const d = describeCredentials('mongodb://u:p@a.net:27017,b.net:27017/db?ssl=true');
    expect(d.user).toBe('u');
    expect(d.length).toBe(1);
  });

  it('flags a value that already looks encoded, to catch double-encoding', () => {
    expect(of('pa%40ss').looksEncoded).toBe(true);
    expect(of('plainpassword').looksEncoded).toBe(false);
  });

  it('spots an empty password', () => {
    const d = of('');
    expect(d.empty).toBe(true);
    expect(d.length).toBe(0);
  });

  it('reports the username so it can be compared with Atlas', () => {
    expect(of('x').user).toBe('myuser');
  });

  it('says so when the uri carries no credentials at all', () => {
    expect(describeCredentials('mongodb://127.0.0.1:27017/reclaimos')).toEqual({ present: false });
  });
});

describe('splitUri', () => {
  it('splits at the last @, not the first', () => {
    const { userinfo, rest } = splitUri('mongodb+srv://u:p@ss@host.net/db');
    expect(userinfo).toBe('u:p@ss');
    expect(rest).toBe('host.net/db');
  });

  it('reports no credentials when there is no @', () => {
    expect(splitUri('mongodb://127.0.0.1:27017/db').present).toBe(false);
  });

  it('reports no credentials for a non-mongo scheme', () => {
    expect(splitUri('https://cloud.mongodb.com/v2/abc').present).toBe(false);
  });
});
