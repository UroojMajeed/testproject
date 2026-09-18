import { describe, it, expect } from 'vitest';
import { api, BASE, registerUser, validUser, refreshCookieFrom } from '../helpers.js';
import { User, RefreshToken } from '../../src/models/index.js';

describe('POST /auth/register', () => {
  it('creates a user and sets an httpOnly refresh cookie', async () => {
    const { res, cookie } = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.user.email).toBe('founder@example.com');
    expect(cookie).toBeTruthy();

    const setCookie = res.headers['set-cookie'].join(';');
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    expect(setCookie).toMatch(/Path=\/api\/v1\/auth/i);
  });

  it('never returns the password hash', async () => {
    const { res } = await registerUser();
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/passwordHash/);
    expect(body).not.toMatch(/\$2[aby]\$/);
  });

  it('stores the password hashed, not in plain text', async () => {
    await registerUser();
    const user = await User.findOne({ email: 'founder@example.com' }).select('+passwordHash');
    expect(user.passwordHash).not.toBe(validUser().password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it.each([
    ['too short', 'short1'],
    ['a common password', 'password123'],
    ['derived from the email', 'founder-founder-1'],
  ])('rejects a password that is %s', async (_label, password) => {
    const res = await api().post(`${BASE}/auth/register`).send(validUser({ password }));
    expect(res.status).toBe(422);
    expect(res.body.error.details.some((d) => d.field === 'body.password')).toBe(true);
  });

  it('rejects unknown fields rather than silently ignoring them', async () => {
    const res = await api()
      .post(`${BASE}/auth/register`)
      .send({ ...validUser(), role: 'owner', tokenVersion: 99 });
    expect(res.status).toBe(422);
  });

  it('refuses a duplicate email', async () => {
    await registerUser();
    const res = await api().post(`${BASE}/auth/register`).send(validUser());
    expect(res.status).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('signs in with correct credentials', async () => {
    await registerUser();
    const res = await api().post(`${BASE}/auth/login`).send({
      email: 'founder@example.com',
      password: validUser().password,
    });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(res.body.data.workspaces).toEqual([]);
  });

  it('gives the same answer for a wrong password and an unknown account', async () => {
    await registerUser();

    const wrongPassword = await api().post(`${BASE}/auth/login`)
      .send({ email: 'founder@example.com', password: 'definitely-not-the-one' });
    const noSuchUser = await api().post(`${BASE}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'definitely-not-the-one' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(noSuchUser.body.error.message);
    expect(wrongPassword.body.error.code).toBe(noSuchUser.body.error.code);
  });

  it('locks the account after repeated failures', async () => {
    await registerUser();
    for (let i = 0; i < 5; i += 1) {
      await api().post(`${BASE}/auth/login`)
        .send({ email: 'founder@example.com', password: `wrong-attempt-${i}` });
    }

    const res = await api().post(`${BASE}/auth/login`)
      .send({ email: 'founder@example.com', password: validUser().password });

    expect(res.status).toBe(423);
    expect(res.body.error.code).toBe('ACCOUNT_LOCKED');
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the token and issues a new cookie', async () => {
    const { cookie } = await registerUser();

    const res = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    const next = refreshCookieFrom(res);

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTypeOf('string');
    expect(next).toBeTruthy();
    expect(next).not.toBe(cookie);
  });

  it('detects reuse of a spent token and revokes the whole family', async () => {
    const { cookie } = await registerUser();

    const first = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    const rotated = refreshCookieFrom(first);

    // Replaying the original — this is what a stolen token looks like.
    const replay = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe('TOKEN_REUSED');

    // The legitimate successor is dead too: the family was burned.
    const after = await api().post(`${BASE}/auth/refresh`).set('Cookie', rotated);
    expect(after.status).toBe(401);

    const live = await RefreshToken.countDocuments({ revokedAt: null });
    expect(live).toBe(0);
  });

  it('rejects a token that was never issued', async () => {
    const res = await api().post(`${BASE}/auth/refresh`)
      .set('Cookie', 'reclaim_rt=not-a-real-token-value-at-all');
    expect(res.status).toBe(401);
  });

  it('stores refresh tokens hashed, never raw', async () => {
    const { cookie } = await registerUser();
    const raw = cookie.split('=')[1];
    const found = await RefreshToken.findOne({ tokenHash: raw });
    expect(found).toBeNull();
    expect(await RefreshToken.countDocuments({})).toBe(1);
  });
});

describe('GET /auth/me', () => {
  it('requires a bearer token', async () => {
    const res = await api().get(`${BASE}/auth/me`);
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await api().get(`${BASE}/auth/me`).set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
  });

  it('returns the caller', async () => {
    const { accessToken } = await registerUser();
    const res = await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('founder@example.com');
  });
});

describe('password reset', () => {
  it('answers identically for a known and an unknown address', async () => {
    await registerUser();
    const known = await api().post(`${BASE}/auth/forgot-password`).send({ email: 'founder@example.com' });
    const unknown = await api().post(`${BASE}/auth/forgot-password`).send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('rejects an invalid reset token', async () => {
    const res = await api().post(`${BASE}/auth/reset-password`)
      .send({ token: 'x'.repeat(40), password: 'a-brand-new-passphrase' });
    expect(res.status).toBe(400);
  });
});

describe('injection hardening', () => {
  it('strips mongo operators from the body', async () => {
    await registerUser();
    const res = await api().post(`${BASE}/auth/login`)
      .send({ email: { $ne: null }, password: { $ne: null } });
    // The operator object is stripped, so validation rejects it as a non-string.
    expect(res.status).toBe(422);
  });
});
