import { describe, it, expect } from 'vitest';
import { api, BASE, validUser, registerUser, refreshCookieFrom } from '../helpers.js';
import { User, RefreshToken } from '../../src/models/index.js';
import * as service from '../../src/modules/auth/auth.service.js';
import { REFRESH_COOKIE } from '../../src/utils/token.js';
import { ERROR_CODES, USER_STATUS } from '../../src/config/constants.js';
import { env } from '../../src/config/env.js';

/**
 * Step 1 is sign up and sign in, so this file is the contract those two screens
 * are built against. It exercises the HTTP surface, not the service functions —
 * the cookie, the status code and the body shape are the parts the frontend sees.
 */

const cookieHeaderFor = (res) => {
  const raw = res.headers['set-cookie'] ?? [];
  return raw.find((c) => c.startsWith(`${REFRESH_COOKIE}=`)) ?? '';
};

describe('POST /auth/register', () => {
  it('creates the account, returns an access token and sets the refresh cookie', async () => {
    const { res, cookie } = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(cookie).toMatch(new RegExp(`^${REFRESH_COOKIE}=.+`));

    const stored = await RefreshToken.countDocuments({});
    expect(stored).toBe(1);
  });

  it('sends the refresh cookie httpOnly, SameSite=Lax and scoped to the auth path', async () => {
    const { res } = await registerUser();
    const header = cookieHeaderFor(res);

    expect(header).toMatch(/HttpOnly/i);
    expect(header).toMatch(/SameSite=Lax/i);
    expect(header).toMatch(/Path=\/api\/v1\/auth/i);
    // NODE_ENV is 'test' here, so Secure is correctly absent over plain http.
    expect(header).not.toMatch(/Secure/i);
  });

  it('returns exactly the serialized user and nothing else about them', async () => {
    const { res } = await registerUser();

    expect(Object.keys(res.body.data.user).sort()).toEqual([
      'avatarUrl', 'createdAt', 'email', 'emailVerified', 'id', 'lastLoginAt', 'name', 'timezone',
    ]);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it('stores the password as a bcrypt hash, never the password itself', async () => {
    const { body } = await registerUser();
    const user = await User.findOne({ email: body.email }).select('+passwordHash');

    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(user.passwordHash).not.toContain(body.password);
  });

  it('lower-cases and trims the email before storing it', async () => {
    const { res } = await registerUser({ email: '  Founder@Example.COM ' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('founder@example.com');
    expect(await User.countDocuments({ email: 'founder@example.com' })).toBe(1);
  });

  it('rejects a second account on the same address with 409', async () => {
    await registerUser();
    const { res } = await registerUser({ name: 'Someone Else' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(ERROR_CODES.CONFLICT);
    expect(await User.countDocuments({})).toBe(1);
  });

  it('treats a differently-cased duplicate as the same address', async () => {
    await registerUser();
    const { res } = await registerUser({ email: 'FOUNDER@example.com' });

    expect(res.status).toBe(409);
  });

  it.each([
    ['too short', { password: 'short1234' }],
    ['a known-common password', { password: 'passw0rd1234' }],
    ['one repeated character', { password: 'aaaaaaaaaaaaaa' }],
    ['derived from the email', { password: 'founder-founder-1' }],
    ['not an email address', { email: 'not-an-address' }],
    ['a blank name', { name: '   ' }],
  ])('rejects %s with 422 and a field-level detail', async (_label, over) => {
    const { res } = await registerUser(over);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    expect(res.body.error.details[0]).toHaveProperty('field');
    expect(await User.countDocuments({})).toBe(0);
  });

  it('refuses unknown fields rather than quietly ignoring them', async () => {
    const res = await api()
      .post(`${BASE}/auth/register`)
      .send({ ...validUser(), status: USER_STATUS.SUSPENDED, tokenVersion: 99 });

    expect(res.status).toBe(422);
  });
});

describe('POST /auth/login', () => {
  it('returns an access token and a fresh refresh cookie', async () => {
    const { body } = await registerUser();

    const res = await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(refreshCookieFrom(res)).toBeTruthy();
    expect(await RefreshToken.countDocuments({})).toBe(2); // register + login
  });

  it('records lastLoginAt', async () => {
    const { body } = await registerUser();
    await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });

    const user = await User.findOne({ email: body.email });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('answers a wrong password and an unknown address identically', async () => {
    const { body } = await registerUser();

    const wrongPassword = await api()
      .post(`${BASE}/auth/login`)
      .send({ email: body.email, password: 'definitely-not-the-one' });
    const noSuchUser = await api()
      .post(`${BASE}/auth/login`)
      .send({ email: 'nobody@example.com', password: 'definitely-not-the-one' });

    expect(wrongPassword.status).toBe(401);
    expect(noSuchUser.status).toBe(wrongPassword.status);
    expect(noSuchUser.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
    expect(refreshCookieFrom(wrongPassword)).toBeNull();
  });

  it('locks the account after the configured number of failures', async () => {
    const { body } = await registerUser();
    const attempt = (password) => api().post(`${BASE}/auth/login`).send({ email: body.email, password });

    for (let i = 0; i < env.MAX_LOGIN_ATTEMPTS; i += 1) {
      expect((await attempt('wrong-password-here')).status).toBe(401);
    }

    const locked = await attempt('wrong-password-here');
    expect(locked.status).toBe(423);
    expect(locked.body.error.code).toBe(ERROR_CODES.ACCOUNT_LOCKED);

    // The correct password does not open a locked account either.
    const correct = await attempt(body.password);
    expect(correct.status).toBe(423);
  });

  it('clears the failure count on a successful sign in', async () => {
    const { body } = await registerUser();
    await api().post(`${BASE}/auth/login`).send({ email: body.email, password: 'wrong-password-here' });
    await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });

    const user = await User.findOne({ email: body.email }).select('+failedLoginAttempts +lockedUntil');
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
  });

  it('does not distinguish a suspended account from a wrong password', async () => {
    const { body } = await registerUser();
    await User.updateOne({ email: body.email }, { status: USER_STATUS.SUSPENDED });

    const suspended = await api()
      .post(`${BASE}/auth/login`)
      .send({ email: body.email, password: body.password });

    expect(suspended.status).toBe(401);
    expect(suspended.body.error.code).toBe(ERROR_CODES.INVALID_CREDENTIALS);
  });
});

describe('GET /auth/me', () => {
  it('returns the caller for a valid bearer token', async () => {
    const { accessToken, body } = await registerUser();

    const res = await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(body.email);
  });

  it.each([
    ['no header', undefined],
    ['the wrong scheme', 'Token abc'],
    ['a malformed token', 'Bearer not.a.jwt'],
  ])('rejects %s with 401', async (_label, header) => {
    const req = api().get(`${BASE}/auth/me`);
    if (header) req.set('Authorization', header);

    expect((await req).status).toBe(401);
  });

  it('stops accepting a token once the account is suspended', async () => {
    const { accessToken, body } = await registerUser();
    await User.updateOne({ email: body.email }, { status: USER_STATUS.SUSPENDED });

    const res = await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('rotates the cookie and issues a new access token', async () => {
    const { cookie } = await registerUser();

    const res = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    const rotated = refreshCookieFrom(res);

    expect(res.status).toBe(200);
    expect(typeof res.body.data.accessToken).toBe('string');
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe(cookie);
  });

  it('marks the consumed row rotated and links it to its replacement', async () => {
    const { cookie } = await registerUser();
    await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);

    const rows = await RefreshToken.find({}).sort({ createdAt: 1 });
    expect(rows).toHaveLength(2);
    expect(rows[0].revokedReason).toBe('rotated');
    expect(rows[0].replacedByHash).toBe(rows[1].tokenHash);
    expect(rows[1].revokedAt).toBeNull();
  });

  it('keeps the rotated token in the same family', async () => {
    const { cookie } = await registerUser();
    await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);

    const families = new Set((await RefreshToken.find({})).map((r) => r.family));
    expect(families.size).toBe(1);
  });

  it('ends the whole family when a consumed token is presented again', async () => {
    const { cookie, accessToken } = await registerUser();
    const rotated = refreshCookieFrom(await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie));

    const reused = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe(ERROR_CODES.TOKEN_REUSED);

    // The legitimate holder loses the session too — that is the point.
    expect((await api().post(`${BASE}/auth/refresh`).set('Cookie', rotated)).status).toBe(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);

    // And the access token minted before the reuse stops working.
    const me = await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });

  it('rejects a request with no cookie at all', async () => {
    const res = await api().post(`${BASE}/auth/refresh`);
    expect(res.status).toBe(401);
  });

  it('rejects a token that is not in the database', async () => {
    const res = await api().post(`${BASE}/auth/refresh`).set('Cookie', `${REFRESH_COOKIE}=made-up-value`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const { cookie } = await registerUser();
    await RefreshToken.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });

    const res = await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(ERROR_CODES.TOKEN_EXPIRED);
  });
});

describe('POST /auth/logout', () => {
  it('revokes the session, clears the cookie and answers 204', async () => {
    const { cookie } = await registerUser();

    const res = await api().post(`${BASE}/auth/logout`).set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(cookieHeaderFor(res)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
    expect((await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie)).status).toBe(401);
  });

  it('is harmless without a cookie', async () => {
    expect((await api().post(`${BASE}/auth/logout`)).status).toBe(204);
  });
});

describe('POST /auth/logout-all', () => {
  it('ends every session and invalidates outstanding access tokens', async () => {
    const { body, accessToken } = await registerUser();
    await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });
    await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });

    const res = await api().post(`${BASE}/auth/logout-all`).set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
    expect((await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`)).status).toBe(401);
  });
});

describe('POST /auth/forgot-password', () => {
  it('answers identically whether or not the address exists', async () => {
    const { body } = await registerUser();

    const known = await api().post(`${BASE}/auth/forgot-password`).send({ email: body.email });
    const unknown = await api().post(`${BASE}/auth/forgot-password`).send({ email: 'nobody@example.com' });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
  });

  it('stores the reset token hashed, with an expiry', async () => {
    const { body } = await registerUser();
    await api().post(`${BASE}/auth/forgot-password`).send({ email: body.email });

    const user = await User.findOne({ email: body.email })
      .select('+passwordResetTokenHash +passwordResetExpiresAt');

    expect(user.passwordResetTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(user.passwordResetExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('never returns the token in the response body', async () => {
    const { body } = await registerUser();
    const res = await api().post(`${BASE}/auth/forgot-password`).send({ email: body.email });

    const user = await User.findOne({ email: body.email }).select('+passwordResetTokenHash');
    expect(JSON.stringify(res.body)).not.toContain(user.passwordResetTokenHash);
    expect(res.body.data).not.toHaveProperty('token');
  });
});

describe('POST /auth/reset-password', () => {
  const NEW_PASSWORD = 'a-completely-different-secret';

  /** The mailer does not exist yet, so take the token the service just issued. */
  const issueResetToken = async (email) => (await service.requestPasswordReset(email)).token;

  it('sets the new password and lets the user sign in with it', async () => {
    const { body } = await registerUser();
    const token = await issueResetToken(body.email);

    const res = await api().post(`${BASE}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(200);

    const after = await api()
      .post(`${BASE}/auth/login`)
      .send({ email: body.email, password: NEW_PASSWORD });
    expect(after.status).toBe(200);
  });

  it('stops the old password working', async () => {
    const { body } = await registerUser();
    await api()
      .post(`${BASE}/auth/reset-password`)
      .send({ token: await issueResetToken(body.email), password: NEW_PASSWORD });

    const old = await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });
    expect(old.status).toBe(401);
  });

  it('ends every existing session', async () => {
    const { body, accessToken, cookie } = await registerUser();
    await api()
      .post(`${BASE}/auth/reset-password`)
      .send({ token: await issueResetToken(body.email), password: NEW_PASSWORD });

    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
    expect((await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie)).status).toBe(401);
    expect((await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`)).status).toBe(401);
  });

  it('unlocks an account that had been locked out', async () => {
    const { body } = await registerUser();
    await User.updateOne(
      { email: body.email },
      { failedLoginAttempts: env.MAX_LOGIN_ATTEMPTS, lockedUntil: new Date(Date.now() + 900_000) },
    );

    await api()
      .post(`${BASE}/auth/reset-password`)
      .send({ token: await issueResetToken(body.email), password: NEW_PASSWORD });

    const res = await api().post(`${BASE}/auth/login`).send({ email: body.email, password: NEW_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('accepts the token once only', async () => {
    const { body } = await registerUser();
    const token = await issueResetToken(body.email);
    await api().post(`${BASE}/auth/reset-password`).send({ token, password: NEW_PASSWORD });

    const again = await api()
      .post(`${BASE}/auth/reset-password`)
      .send({ token, password: 'yet-another-long-secret' });
    expect(again.status).toBe(400);
  });

  it('rejects an expired token', async () => {
    const { body } = await registerUser();
    const token = await issueResetToken(body.email);
    await User.updateOne({ email: body.email }, { passwordResetExpiresAt: new Date(Date.now() - 1000) });

    const res = await api().post(`${BASE}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('holds the new password to the same policy as sign up', async () => {
    const { body } = await registerUser();
    const token = await issueResetToken(body.email);

    const res = await api().post(`${BASE}/auth/reset-password`).send({ token, password: 'short' });
    expect(res.status).toBe(422);
  });
});

describe('POST /auth/change-password', () => {
  const NEW_PASSWORD = 'another-long-and-unrelated-secret';

  it('changes the password and signs out other devices', async () => {
    const { body, accessToken, cookie } = await registerUser();

    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: body.password, newPassword: NEW_PASSWORD });

    expect(res.status).toBe(200);
    expect((await api().post(`${BASE}/auth/refresh`).set('Cookie', cookie)).status).toBe(401);
    expect((await api().get(`${BASE}/auth/me`).set('Authorization', `Bearer ${accessToken}`)).status).toBe(401);

    const after = await api().post(`${BASE}/auth/login`).send({ email: body.email, password: NEW_PASSWORD });
    expect(after.status).toBe(200);
  });

  it('rejects a wrong current password and leaves the password alone', async () => {
    const { body, accessToken } = await registerUser();

    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: 'not-the-current-one', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
    const still = await api().post(`${BASE}/auth/login`).send({ email: body.email, password: body.password });
    expect(still.status).toBe(200);
  });

  it('refuses to set the same password again', async () => {
    const { body, accessToken } = await registerUser();

    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ currentPassword: body.password, newPassword: body.password });

    expect(res.status).toBe(422);
  });

  it('needs authentication', async () => {
    const res = await api()
      .post(`${BASE}/auth/change-password`)
      .send({ currentPassword: 'whatever-it-was', newPassword: NEW_PASSWORD });

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/verify-email', () => {
  it('marks the address verified', async () => {
    const body = validUser();
    const { verifyToken } = await service.register(body, {});

    const res = await api().post(`${BASE}/auth/verify-email`).send({ token: verifyToken });

    expect(res.status).toBe(200);
    expect(res.body.data.user.emailVerified).toBe(true);
  });

  it('reports an unverified address as unverified at sign up', async () => {
    const { res } = await registerUser();
    expect(res.body.data.user.emailVerified).toBe(false);
  });

  it('rejects an unknown token', async () => {
    const res = await api().post(`${BASE}/auth/verify-email`).send({ token: 'x'.repeat(40) });
    expect(res.status).toBe(400);
  });
});

describe('cross-origin protection on the cookie routes', () => {
  it('rejects a POST carrying a foreign Origin', async () => {
    const res = await api()
      .post(`${BASE}/auth/login`)
      .set('Origin', 'https://attacker.example')
      .send(validUser());

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe(ERROR_CODES.FORBIDDEN);
  });

  it('allows the configured client origin', async () => {
    const { body } = await registerUser();

    const res = await api()
      .post(`${BASE}/auth/login`)
      .set('Origin', env.CLIENT_URL)
      .send({ email: body.email, password: body.password });

    expect(res.status).toBe(200);
  });
});

describe('readiness', () => {
  it('reports the database as connected', async () => {
    const res = await api().get(`${BASE}/health/ready`);

    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe('connected');
  });
});
