import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Where a message actually goes.
 *
 * Three transports, one interface. The point of the seam is that everything above
 * it — templates, the auth flow, the tests — is identical whichever is in use, so
 * "does the reset email get built correctly" can be answered without an account at
 * an email provider.
 *
 * Every transport returns a receipt. Nothing here is allowed to succeed silently:
 * that is the failure this module was written to end.
 */

/** A real server. The only transport production is allowed to use. */
function smtpTransport() {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });

  return {
    name: 'smtp',
    async send(message) {
      const info = await transporter.sendMail(message);
      return { transport: 'smtp', id: info.messageId, accepted: info.accepted };
    },
  };
}

/**
 * An .eml on disk, for development.
 *
 * A real message, built by the same code that would post it, which can be opened
 * in any mail client. Rather better than a logged link: it catches a broken
 * template, a missing subject or a mangled URL, which a log line does not.
 */
function fileTransport() {
  const dir = resolve(env.MAIL_OUTBOX);
  const transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });

  return {
    name: 'file',
    async send(message) {
      const info = await transporter.sendMail(message);
      await mkdir(dir, { recursive: true });

      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safe = String(message.to).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      const path = join(dir, `${stamp}-${safe}.eml`);
      await writeFile(path, info.message);

      logger.info({ to: message.to, subject: message.subject, path }, 'mail written to the outbox');
      return { transport: 'file', id: info.messageId, path };
    },
  };
}

/** A log line. For the test suite, where nothing should touch the disk. */
function logTransport() {
  return {
    name: 'log',
    async send(message) {
      logger.debug({ to: message.to, subject: message.subject }, 'mail (log transport)');
      return { transport: 'log', id: `log-${Date.now()}` };
    },
  };
}

const BUILDERS = { smtp: smtpTransport, file: fileTransport, log: logTransport };

let current = null;

/** Built once, lazily, so importing this module never opens a connection. */
export function transport() {
  if (!current) current = BUILDERS[env.MAIL_TRANSPORT]();
  return current;
}

/** Tests swap in their own and put the real one back afterwards. */
export function setTransport(replacement) {
  const previous = current;
  current = replacement;
  return () => { current = previous; };
}
