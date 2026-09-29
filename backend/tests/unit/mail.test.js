import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setTransport } from '../../src/modules/mail/mail.transport.js';
import * as mail from '../../src/modules/mail/mail.service.js';
import { passwordReset, verifyEmail, clientUrl } from '../../src/modules/mail/mail.templates.js';

/**
 * The module exists because password reset issued a token, logged it, and sent
 * nothing — for weeks, with every test green. So these assert the two things that
 * silence hid: that a message is actually handed to a transport, and that what is
 * in it would work when it arrived.
 */

let sent;
let restore;

beforeEach(() => {
  sent = [];
  restore = setTransport({
    name: 'spy',
    async send(message) { sent.push(message); return { transport: 'spy', id: 'spy-1' }; },
  });
});

afterEach(() => restore());

describe('sending a password reset', () => {
  it('hands a message to the transport, which is the whole point', async () => {
    const receipt = await mail.sendPasswordReset({
      to: 'founder@example.com', name: 'Urooj Majeed', token: 'abc123', ttlMinutes: 30,
    });

    expect(sent).toHaveLength(1);
    expect(receipt).not.toBeNull();
    expect(sent[0].to).toBe('founder@example.com');
    expect(sent[0].subject).toMatch(/reset your reclaimos password/i);
  });

  it('puts the token in a link to the client, not to the API', async () => {
    await mail.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 'tok-123', ttlMinutes: 30 });

    // A person opens this in a browser. Pointed at the API it would render JSON.
    const url = new URL(sent[0].text.match(/https?:\/\/\S+/)[0]);
    expect(url.pathname).toBe('/reset-password');
    expect(url.searchParams.get('token')).toBe('tok-123');
  });

  it('escapes a token that would otherwise break the URL', async () => {
    await mail.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 'a b&c=d', ttlMinutes: 30 });

    const url = new URL(sent[0].text.match(/https?:\/\/\S+/)[0]);
    expect(url.searchParams.get('token')).toBe('a b&c=d');
  });

  it('says the same thing in text as in HTML', async () => {
    await mail.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 'tok', ttlMinutes: 30 });

    // A security email reaching somebody whose client blocks HTML still has to
    // work — that person is the most likely to be reading it.
    expect(sent[0].text).toContain('/reset-password?token=tok');
    expect(sent[0].html).toContain('/reset-password?token=tok');
  });

  it('quotes the real expiry rather than a number typed into a template', () => {
    const message = passwordReset({ name: 'A', url: 'https://x/y', ttlMinutes: 30 });

    expect(message.text).toContain('30 minutes');
    expect(message.html).toContain('30 minutes');
  });

  it('carries a from address without every caller remembering one', async () => {
    await mail.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 't', ttlMinutes: 30 });

    expect(sent[0].from).toBeTruthy();
  });
});

describe('sending a verification email', () => {
  it('links to the client with the token', async () => {
    await mail.sendVerifyEmail({ to: 'a@b.com', name: 'Urooj Majeed', token: 'v-9' });

    const url = new URL(sent[0].text.match(/https?:\/\/\S+/)[0]);
    expect(url.pathname).toBe('/verify-email');
    expect(url.searchParams.get('token')).toBe('v-9');
  });

  it('greets by first name only, because a full name in a greeting reads as a form letter', () => {
    const message = verifyEmail({ name: 'Urooj Majeed', url: 'https://x/y' });

    expect(message.text).toContain('Hello Urooj,');
    expect(message.text).not.toContain('Urooj Majeed');
  });

  it('has something to say to somebody with no name on the account', () => {
    const message = verifyEmail({ name: '', url: 'https://x/y' });

    expect(message.text).toContain('Hello there,');
  });
});

describe('when the mail server is down', () => {
  it('does not fail the request that triggered it', async () => {
    restore();
    restore = setTransport({
      name: 'broken',
      async send() { throw new Error('ECONNREFUSED'); },
    });

    // Sign-up must not 500 because a mail server is unreachable, and a reset
    // response must stay identical whether or not delivery worked — otherwise the
    // endpoint starts telling people which addresses are registered.
    await expect(mail.sendPasswordReset({ to: 'a@b.com', name: 'A', token: 't', ttlMinutes: 30 }))
      .resolves.toBeNull();
  });
});

describe('the link the product builds', () => {
  it('is absolute, so it is clickable out of an inbox', () => {
    expect(clientUrl('/reset-password?token=x')).toMatch(/^https?:\/\//);
  });
});

describe('HTML escaping', () => {
  it('does not let a name break out of the markup', () => {
    const message = verifyEmail({ name: '<script>alert(1)</script> Bob', url: 'https://x/y' });

    expect(message.html).not.toContain('<script>');
    expect(message.html).toContain('&lt;script&gt;');
  });
});

vi.mock('../../src/config/logger.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: { ...actual.logger, info: () => {}, error: () => {}, debug: () => {} } };
});
