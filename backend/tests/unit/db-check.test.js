import { describe, it, expect } from 'vitest';
import { diagnose, maskUri, hostsFrom, nestedServerErrors } from '../../src/db/check.js';

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
