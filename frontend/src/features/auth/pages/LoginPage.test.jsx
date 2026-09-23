import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage.jsx';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { mockApi, success, failure, bootSignedOut } from '../../../test/fetchMock.js';
import { endpoints } from '../../../lib/api/endpoints.js';
import { getAccessToken } from '../../../lib/tokenStore.js';

const LOGIN = `POST ${endpoints.auth.login()}`;

const renderLogin = async (handlers = {}) => {
  const mock = mockApi({ ...bootSignedOut, ...handlers });
  const utils = await renderWithProviders(<LoginPage />, { route: '/sign-in' });
  return { ...utils, ...mock };
};

const fillIn = async (user, { email = 'founder@example.com', password = 'correct-horse-battery-staple' } = {}) => {
  await user.type(screen.getByLabelText(/email address/i), email);
  await user.type(screen.getByLabelText(/^password/i), password);
  await user.click(screen.getByRole('button', { name: /^sign in$/i }));
};

describe('the sign in screen', () => {
  it('gives the page one h1 and labels every field', async () => {
    await renderLogin();

    expect(screen.getByRole('heading', { level: 1, name: /sign in/i })).toBeInTheDocument();
    // getByLabelText only finds an input whose label is actually associated with it,
    // so this failing means the htmlFor/id wiring broke.
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
  });

  it('asks the browser to offer the saved credentials', async () => {
    await renderLogin();

    // Without these a password manager cannot fill the form, and people fall back
    // to passwords they can type from memory.
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'current-password');
  });

  it('sends the credentials and keeps the new token in memory only', async () => {
    const user = userEvent.setup();
    const { calls } = await renderLogin({
      [LOGIN]: success({ accessToken: 'fresh-token', user: { id: 'u1', name: 'Urooj' } }),
    });

    await fillIn(user);

    await waitFor(() => expect(calls.some((c) => c.key === LOGIN)).toBe(true));
    expect(calls.find((c) => c.key === LOGIN).body).toEqual({
      email: 'founder@example.com',
      password: 'correct-horse-battery-staple',
    });
    expect(getAccessToken()).toBe('fresh-token');
    expect(window.localStorage.length).toBe(0);
  });

  it('announces a wrong password as an alert, so it is not silent for a screen reader', async () => {
    const user = userEvent.setup();
    await renderLogin({ [LOGIN]: failure(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect') });

    await fillIn(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/do not match an account/i);
  });

  it('says nothing about whether the email exists', async () => {
    const user = userEvent.setup();
    await renderLogin({ [LOGIN]: failure(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect') });

    await fillIn(user, { email: 'nobody@example.com' });

    const alert = await screen.findByRole('alert');
    // The server answers identically for a wrong password and an unknown address.
    // A helpful "no such account" here would hand out a free account-enumeration API.
    expect(alert.textContent).not.toMatch(/no account|not found|does not exist|unknown/i);
  });

  it('explains a lockout and points at the way out of it', async () => {
    const user = userEvent.setup();
    await renderLogin({ [LOGIN]: failure(423, 'ACCOUNT_LOCKED', 'Too many failed attempts. Try again in 15 minutes.') });

    await fillIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/locked for a few minutes/i);
    expect(screen.getByRole('link', { name: /forgotten your password/i })).toBeInTheDocument();
  });

  it('reports an unreachable API instead of appearing to do nothing', async () => {
    const user = userEvent.setup();
    await renderLogin({ [LOGIN]: () => { throw new TypeError('Failed to fetch'); } });

    await fillIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/cannot reach the server/i);
  });

  it('marks an invalid email with aria-invalid and a message tied to the field', async () => {
    const user = userEvent.setup();
    await renderLogin();

    const email = screen.getByLabelText(/email address/i);
    await user.type(email, 'not-an-address');
    await user.tab();

    await waitFor(() => expect(email).toHaveAttribute('aria-invalid', 'true'));

    // aria-describedby is what makes the reason audible, not just visible.
    const describedBy = email.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy.split(' ').at(-1))).toHaveTextContent(/valid email/i);
  });

  it('does not call the API when the form has not passed validation', async () => {
    const user = userEvent.setup();
    const { calls } = await renderLogin();

    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(screen.getByLabelText(/email address/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(calls.some((c) => c.key === LOGIN)).toBe(false);
  });

  it('disables the button while the request is in flight, so one click is one sign in', async () => {
    const user = userEvent.setup();
    let release;
    await renderLogin({
      [LOGIN]: () => new Promise((resolve) => {
        release = () => resolve(success({ accessToken: 't', user: { id: 'u1' } }));
      }),
    });

    await fillIn(user);

    const button = screen.getByRole('button', { name: /signing you in/i });
    await waitFor(() => expect(button).toBeDisabled());

    release();
    // Let the resolution land before the test ends, or React reports the state
    // update as happening outside act and the next test inherits the noise.
    await waitFor(() => expect(screen.getByRole('button', { name: /^sign in$/i })).toBeEnabled());
  });

  it('lets the password be revealed, and says which state the toggle is in', async () => {
    const user = userEvent.setup();
    await renderLogin();

    const password = screen.getByLabelText(/^password/i);
    const toggle = screen.getByRole('button', { name: /show password/i });

    expect(password).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await user.click(toggle);

    expect(password).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: /hide password/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
