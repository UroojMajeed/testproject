import { describe, it, expect } from 'vitest';
import {
  envSchema, databaseNameWarning, databaseNameFrom, DEFAULT_DB_NAME,
} from '../../src/config/env.js';

const valid = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/reclaimos',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
};
const parse = (over = {}) => envSchema.safeParse({ ...valid, ...over });
const messageFor = (result, field) =>
  result.error.issues.find((i) => i.path[0] === field)?.message ?? '';

describe('MONGODB_URI', () => {
  it.each([
    'mongodb://127.0.0.1:27017/reclaimos',
    'mongodb+srv://user:pass@cluster0.abc.mongodb.net/reclaimos?retryWrites=true',
  ])('accepts %s', (uri) => {
    expect(parse({ MONGODB_URI: uri }).success).toBe(true);
  });

  it('rejects a placeholder that was never replaced', () => {
    const r = parse({ MONGODB_URI: '<your connection string>' });
    expect(messageFor(r, 'MONGODB_URI')).toMatch(/must start with mongodb/);
  });

  it("rejects Atlas's <password> left as-is", () => {
    const r = parse({ MONGODB_URI: 'mongodb+srv://me:<password>@c.abc.mongodb.net/reclaimos' });
    expect(messageFor(r, 'MONGODB_URI')).toMatch(/angle brackets/);
  });

  it('rejects a dashboard URL pasted instead of the driver string', () => {
    const r = parse({ MONGODB_URI: 'https://cloud.mongodb.com/v2/abc#/clusters' });
    expect(messageFor(r, 'MONGODB_URI')).toMatch(/driver connection string/);
  });

  it('rejects an empty value', () => {
    expect(parse({ MONGODB_URI: '' }).success).toBe(false);
  });
});

describe('secrets', () => {
  it('rejects a short access secret', () => {
    expect(messageFor(parse({ JWT_ACCESS_SECRET: 'too-short' }), 'JWT_ACCESS_SECRET')).toMatch(/at least 32/);
  });

  it('requires both secrets', () => {
    expect(parse({ JWT_REFRESH_SECRET: undefined }).success).toBe(false);
  });
});

describe('defaults', () => {
  it('fills in everything that is not required', () => {
    const { data } = parse();
    expect(data.PORT).toBe(5000);
    expect(data.CLIENT_URL).toBe('http://localhost:3000');
    expect(data.BCRYPT_ROUNDS).toBe(12);
    expect(data.NODE_ENV).toBe('development');
  });

  it('refuses a bcrypt cost low enough to be pointless', () => {
    expect(parse({ BCRYPT_ROUNDS: '4' }).success).toBe(false);
  });

  it('refuses a CLIENT_URL with no scheme', () => {
    // "localhost:3000" is a valid URL to the parser — scheme "localhost:" — so
    // the scheme has to be checked separately.
    expect(messageFor(parse({ CLIENT_URL: 'localhost:3000' }), 'CLIENT_URL')).toMatch(/must include the scheme/);
  });

  it('accepts a real origin', () => {
    expect(parse({ CLIENT_URL: 'https://app.example.com' }).success).toBe(true);
  });
});

describe('databaseNameFrom', () => {
  it.each([
    ['mongodb://127.0.0.1:27017/reclaimos', 'reclaimos'],
    ['mongodb+srv://u:p@c.abc.mongodb.net/reclaimos?retryWrites=true', 'reclaimos'],
    ['mongodb://a:27017,b:27017/mydb?replicaSet=rs0', 'mydb'],
  ])('reads the database out of %s', (uri, expected) => {
    expect(databaseNameFrom(uri)).toBe(expected);
  });

  it.each([
    'mongodb+srv://u:p@c.abc.mongodb.net/?appName=ReclaimOS',
    'mongodb://127.0.0.1:27017',
  ])('returns null when %s names none', (uri) => {
    expect(databaseNameFrom(uri)).toBeNull();
  });
});

describe('databaseNameWarning', () => {
  it('warns for the exact shape Atlas hands you', () => {
    expect(databaseNameWarning('mongodb+srv://u:p@c.abc.mongodb.net/?appName=ReclaimOS'))
      .toMatch(/names no database/);
  });

  it('names the fallback that will actually be used', () => {
    expect(databaseNameWarning('mongodb://127.0.0.1:27017')).toContain(DEFAULT_DB_NAME);
  });

  it('stays quiet when a database is named', () => {
    expect(databaseNameWarning('mongodb://127.0.0.1:27017/reclaimos')).toBeNull();
  });
});
