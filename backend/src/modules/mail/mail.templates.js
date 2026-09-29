import { env } from '../../config/env.js';

/**
 * The messages the product sends, as plain data.
 *
 * Text first, HTML second, and both say the same thing. A reset link that only
 * works in an HTML client is a reset link that does not work for the person whose
 * mail client blocks HTML — which, for a security email, is exactly the person
 * most likely to be reading it.
 *
 * Nothing here interpolates anything a user typed into HTML except their name,
 * which `escape` handles. Tokens go in the URL and nowhere else.
 */

const escape = (value = '') => String(value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || 'there';

/** Same shell for every message, so they are recognisably from one product. */
function layout({ heading, body, action }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#faf7f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#211d19">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e8e0d5;border-radius:12px;padding:32px">
    <p style="margin:0 0 24px;font-weight:600;letter-spacing:-0.01em">ReclaimOS</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${heading}</h1>
    ${body}
    ${action ? `<p style="margin:24px 0"><a href="${action.href}" style="display:inline-block;background:#211d19;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px">${escape(action.label)}</a></p>
    <p style="margin:0;font-size:13px;color:#6b6259">If the button does not work, paste this into your browser:<br><span style="word-break:break-all">${action.href}</span></p>` : ''}
  </div>
</body></html>`;
}

export function passwordReset({ name, url, ttlMinutes }) {
  const who = firstName(name);
  return {
    subject: 'Reset your ReclaimOS password',
    text: [
      `Hello ${who},`,
      '',
      'Someone asked to reset the password on your ReclaimOS account.',
      `Open this link within ${ttlMinutes} minutes to choose a new one:`,
      '',
      url,
      '',
      'If that was not you, ignore this email — your password has not changed,',
      'and the link above does nothing until it is used.',
    ].join('\n'),
    html: layout({
      heading: `Hello ${escape(who)},`,
      body: `<p style="margin:0 0 12px;line-height:1.5">Someone asked to reset the password on your ReclaimOS account. The link below works for <strong>${ttlMinutes} minutes</strong>.</p>
      <p style="margin:0;line-height:1.5;color:#6b6259">If that was not you, ignore this email. Your password has not changed.</p>`,
      action: { href: url, label: 'Choose a new password' },
    }),
  };
}

export function verifyEmail({ name, url }) {
  const who = firstName(name);
  return {
    subject: 'Confirm your email address',
    text: [
      `Hello ${who},`,
      '',
      'Welcome to ReclaimOS. Confirm this address so we can reach you',
      'about your account:',
      '',
      url,
      '',
      'You can use the product without confirming — this is so a lost',
      'password can be recovered later.',
    ].join('\n'),
    html: layout({
      heading: `Welcome, ${escape(who)}.`,
      body: `<p style="margin:0 0 12px;line-height:1.5">Confirm this address so we can reach you about your account.</p>
      <p style="margin:0;line-height:1.5;color:#6b6259">You can use the product without confirming. This is what makes a lost password recoverable later.</p>`,
      action: { href: url, label: 'Confirm my email' },
    }),
  };
}

/** Links point at the client, never the API: a person opens them in a browser. */
export const clientUrl = (path) => new URL(path, env.CLIENT_URL).toString();
