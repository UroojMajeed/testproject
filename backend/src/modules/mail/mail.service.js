import { transport } from './mail.transport.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import * as templates from './mail.templates.js';

/**
 * Sending, and what happens when it fails.
 *
 * A failed email must never fail the request that triggered it. Somebody whose
 * reset email bounces should still get "if an account exists, a link is on its
 * way" — the alternative leaks whether the address is registered, and a 500 on
 * sign-up because the mail server is down is a worse outcome than a missing
 * welcome message.
 *
 * So failures are logged loudly and swallowed. `deliver` returns the receipt on
 * success and null on failure, which is what lets a test assert the difference.
 */
async function deliver(message) {
  try {
    // `from` is applied here rather than by each caller, so it cannot be
    // forgotten in one of them and produce a message no server will accept.
    const receipt = await transport().send({ from: env.MAIL_FROM, ...message });
    logger.info({ to: message.to, subject: message.subject, transport: receipt.transport }, 'mail sent');
    return receipt;
  } catch (err) {
    // error, not warn: mail silently going nowhere is the bug this module exists
    // to end, and it should be impossible to miss in a log.
    logger.error({ err, to: message.to, subject: message.subject }, 'mail failed to send');
    return null;
  }
}

export async function sendPasswordReset({ to, name, token, ttlMinutes }) {
  const url = templates.clientUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  const { subject, text, html } = templates.passwordReset({ name, url, ttlMinutes });
  return deliver({ to, subject, text, html });
}

export async function sendVerifyEmail({ to, name, token }) {
  const url = templates.clientUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  const { subject, text, html } = templates.verifyEmail({ name, url });
  return deliver({ to, subject, text, html });
}
