import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import VerifyEmailPage from './VerifyEmailPage.jsx';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { mockApi, success, failure, bootSignedOut } from '../../../test/fetchMock.js';
import { endpoints } from '../../../lib/api/endpoints.js';

/**
 * The link in the welcome email had nowhere to land: the email pointed at
 * /verify-email, the client had no such route, and the catch-all sent people to
 * the front page with the token unused.
 */

const VERIFY = `POST ${endpoints.auth.verifyEmail()}`;
const TOKEN = 'a'.repeat(32);

const renderAt = async (query, over = {}) => {
  const mock = mockApi({
    ...bootSignedOut,
    [VERIFY]: success({ user: { id: 'u1', email: 'founder@example.com', emailVerified: true } }),
    ...over,
  });
  const utils = await renderWithProviders(<VerifyEmailPage />, { route: `/verify-email${query}` });
  return { ...utils, ...mock };
};

describe('confirming an email address', () => {
  it('verifies on arrival, with no form to submit', async () => {
    const { calls } = await renderAt(`?token=${TOKEN}`);

    // The token is the whole submission; asking someone to press a button to
    // send something they did not type is ceremony.
    await waitFor(() => expect(calls.filter((c) => c.key === VERIFY)).toHaveLength(1));
    expect(calls.find((c) => c.key === VERIFY).body).toEqual({ token: TOKEN });
  });

  it('says so when it worked', async () => {
    await renderAt(`?token=${TOKEN}`);

    expect(await screen.findByRole('heading', { name: /email confirmed/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your account/i })).toBeInTheDocument();
  });

  it('spends the token once, not twice', async () => {
    const { calls } = await renderAt(`?token=${TOKEN}`);
    await screen.findByRole('heading', { name: /email confirmed/i });

    // Verification spends the token. Strict mode runs effects twice, and a second
    // call meets a token the first already used — reporting a failure for
    // something that worked.
    expect(calls.filter((c) => c.key === VERIFY)).toHaveLength(1);
  });

  it('explains a link with no token rather than showing a dead screen', async () => {
    await renderAt('');

    expect(await screen.findByRole('heading', { name: /that link is incomplete/i })).toBeInTheDocument();
    // A truncated link is the mail client's doing, not the reader's mistake.
    expect(screen.getByText(/break long ones across lines/i)).toBeInTheDocument();
  });

  it('says what happened when the server refuses the token', async () => {
    await renderAt(`?token=${TOKEN}`, {
      [VERIFY]: failure(400, 'BAD_REQUEST', 'That link is invalid or has expired'),
    });

    expect(await screen.findByRole('heading', { name: /that link did not work/i })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  });

  it('leaves nobody stuck, because confirming is not a gate on using the product', async () => {
    await renderAt(`?token=${TOKEN}`, {
      [VERIFY]: failure(400, 'BAD_REQUEST', 'That link is invalid or has expired'),
    });
    await screen.findByRole('heading', { name: /that link did not work/i });

    expect(screen.getByText(/carry on without confirming/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your account/i })).toBeInTheDocument();
  });
});
