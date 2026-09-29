import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { api, BASE, validUser, registerUser } from '../helpers.js';
import { setTransport } from '../../src/modules/mail/mail.transport.js';

/**
 * Not "does the mail module work" — the unit tests cover that. This is "is it
 * plugged in", which is the question that actually went wrong: the module did not
 * exist, the endpoints answered 200, and nobody found out until a person could not
 * get back into their account.
 *
 * So these drive the real HTTP endpoints and assert that a message left the
 * building.
 */

let sent;
let restore;

beforeEach(() => {
  sent = [];
  restore = setTransport({
    name: 'spy',
    async send(message) { sent.push(message); return { transport: 'spy', id: 'spy' }; },
  });
});

afterEach(() => restore());

/** Mail is sent without being awaited, so give the microtask queue a turn. */
const settle = () => new Promise((resolve) => { setTimeout(resolve, 20); });

describe('POST /auth/forgot-password', () => {
  it('actually sends a reset link to an address that exists', async () => {
    const user = validUser();
    await registerUser(user);
    sent.length = 0;

    const res = await api().post(`${BASE}/auth/forgot-password`).send({ email: user.email });
    await settle();

    expect(res.status).toBe(200);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].text).toMatch(/\/reset-password\?token=/);
  });

  it('sends nothing for an address that does not exist, and says the same thing anyway', async () => {
    const res = await api().post(`${BASE}/auth/forgot-password`).send({ email: 'nobody@example.com' });
    await settle();

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/if an account exists/i);
    // The endpoint must not become a way to find out who has an account.
    expect(sent).toHaveLength(0);
  });

  it('sends a token that the reset endpoint accepts', async () => {
    const user = validUser();
    await registerUser(user);
    sent.length = 0;

    await api().post(`${BASE}/auth/forgot-password`).send({ email: user.email });
    await settle();

    // The round trip, which is the only proof the link in the inbox works: take
    // the token out of the email exactly as a person's browser would, and use it.
    const token = new URL(sent[0].text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
    const reset = await api().post(`${BASE}/auth/reset-password`)
      .send({ token, password: 'a-completely-different-secret' });

    expect(reset.status).toBe(200);

    const signIn = await api().post(`${BASE}/auth/login`)
      .send({ email: user.email, password: 'a-completely-different-secret' });
    expect(signIn.status).toBe(200);
  });

  it('still answers 200 when the mail server is unreachable', async () => {
    restore();
    restore = setTransport({ name: 'broken', async send() { throw new Error('ECONNREFUSED'); } });

    const user = validUser();
    await registerUser(user);

    const res = await api().post(`${BASE}/auth/forgot-password`).send({ email: user.email });
    await settle();

    // A reset that answers 500 because the mail server is down tells an attacker
    // the address is real, and tells the user nothing useful.
    expect(res.status).toBe(200);
  });
});

describe('POST /auth/register', () => {
  it('sends a verification email to the address that just signed up', async () => {
    const user = validUser();
    const { res } = await registerUser(user);
    await settle();

    expect(res.status).toBe(201);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(user.email);
    expect(sent[0].text).toMatch(/\/verify-email\?token=/);
  });

  it('creates the account even when the mail server is down', async () => {
    restore();
    restore = setTransport({ name: 'broken', async send() { throw new Error('ECONNREFUSED'); } });

    const { res } = await registerUser();
    await settle();

    // The account exists either way; a welcome email is not worth a failed sign-up.
    expect(res.status).toBe(201);
  });
});
