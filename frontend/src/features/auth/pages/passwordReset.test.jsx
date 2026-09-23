import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ForgotPasswordPage from './ForgotPasswordPage.jsx';
import ResetPasswordPage from './ResetPasswordPage.jsx';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { mockApi, success, failure, bootSignedOut } from '../../../test/fetchMock.js';
import { endpoints } from '../../../lib/api/endpoints.js';

const FORGOT = `POST ${endpoints.auth.forgotPassword()}`;
const RESET = `POST ${endpoints.auth.resetPassword()}`;

const NEW_PASSWORD = 'a-completely-different-secret';

describe('asking for a reset link', () => {
  const renderForgot = async (handlers = {}) => {
    const mock = mockApi({ ...bootSignedOut, ...handlers });
    const utils = await renderWithProviders(<ForgotPasswordPage />, { route: '/forgot-password' });
    return { ...utils, ...mock };
  };

  const submit = async (user, email = 'founder@example.com') => {
    await user.type(screen.getByLabelText(/email address/i), email);
    await user.click(screen.getByRole('button', { name: /send the reset link/i }));
  };

  it('sends the address and confirms without promising anything', async () => {
    const user = userEvent.setup();
    const { calls } = await renderForgot({
      [FORGOT]: success({ message: 'If an account exists for that address, a reset link is on its way.' }),
    });

    await submit(user);

    await waitFor(() => expect(calls.some((c) => c.key === FORGOT)).toBe(true));

    /**
     * Worded as a conditional on purpose. The server answers identically whether or
     * not the account exists; a screen that said "we have emailed you" would undo
     * that protection in one sentence and turn this into an address checker.
     */
    const confirmation = await screen.findByRole('status');
    expect(confirmation).toHaveTextContent(/if an account exists/i);
    expect(confirmation.textContent).not.toMatch(/\bwe (have )?sent\b/i);
  });

  it('gives the same confirmation for an address with no account', async () => {
    const user = userEvent.setup();
    await renderForgot({ [FORGOT]: success({ message: 'If an account exists for that address, a reset link is on its way.' }) });

    await submit(user, 'nobody@example.com');

    expect(await screen.findByRole('status')).toHaveTextContent(/if an account exists/i);
  });

  it('says how long the link lasts, so nobody wonders why it stopped working', async () => {
    const user = userEvent.setup();
    await renderForgot({ [FORGOT]: success({ message: 'ok' }) });

    await submit(user);

    expect(await screen.findByRole('status')).toHaveTextContent(/30 minutes/i);
  });

  it('will not submit an address that is not one', async () => {
    const user = userEvent.setup();
    const { calls } = await renderForgot();

    await submit(user, 'not-an-address');

    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(calls.some((c) => c.key === FORGOT)).toBe(false);
  });

  it('surfaces the rate limit rather than looking broken', async () => {
    const user = userEvent.setup();
    await renderForgot({ [FORGOT]: failure(429, 'RATE_LIMITED', 'Too many requests. Try again shortly.') });

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/wait a minute/i);
  });
});

describe('choosing a new password', () => {
  const renderReset = async (handlers = {}, route = '/reset-password?token=aaaaaaaaaaaaaaaaaaaaaaaaaaaa') => {
    const mock = mockApi({ ...bootSignedOut, ...handlers });
    const utils = await renderWithProviders(<ResetPasswordPage />, { route });
    return { ...utils, ...mock };
  };

  const submit = async (user, { password = NEW_PASSWORD, confirm = NEW_PASSWORD } = {}) => {
    await user.type(screen.getByLabelText(/^new password/i), password);
    await user.type(screen.getByLabelText(/confirm new password/i), confirm);
    await user.click(screen.getByRole('button', { name: /save the new password/i }));
  };

  it('sends the token from the link together with the new password', async () => {
    const user = userEvent.setup();
    const { calls } = await renderReset({ [RESET]: success({ message: 'Password updated.' }) });

    await submit(user);

    await waitFor(() => expect(calls.some((c) => c.key === RESET)).toBe(true));
    expect(calls.find((c) => c.key === RESET).body).toEqual({
      token: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      password: NEW_PASSWORD,
    });
  });

  it('warns that this signs the user out everywhere, because it does', async () => {
    await renderReset();
    // The server revokes every refresh token on a reset. Saying so up front stops
    // the other device's sudden sign-out looking like a fault.
    expect(screen.getByText(/signs you out everywhere else/i)).toBeInTheDocument();
  });

  it('will not submit two passwords that differ', async () => {
    const user = userEvent.setup();
    const { calls } = await renderReset();

    await submit(user, { confirm: `${NEW_PASSWORD}-typo` });

    expect(await screen.findByText(/must match/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === RESET)).toBe(false);
  });

  it('holds the new password to the same rule as sign up', async () => {
    const user = userEvent.setup();
    await renderReset();

    await submit(user, { password: 'short', confirm: 'short' });

    // "Use at least 12 characters" is the error; the hint above it reads "At least
    // 12 characters…", so match the verb to be sure it is the error being asserted.
    expect(await screen.findByText(/use at least 12 characters/i)).toBeInTheDocument();
  });

  it('explains an expired link instead of failing silently', async () => {
    const user = userEvent.setup();
    await renderReset({ [RESET]: failure(400, 'VALIDATION_ERROR', 'That reset link is invalid or has expired') });

    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  });

  it('says what is wrong when the link arrives with no token at all', async () => {
    // Email clients break long links across lines more often than anyone expects.
    await renderReset({}, '/reset-password');

    expect(screen.getByRole('heading', { level: 1, name: /link is incomplete/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save the new password/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });
});
