import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterPage from './RegisterPage.jsx';
import { renderWithProviders } from '../../../test/renderWithProviders.jsx';
import { mockApi, success, failure, bootSignedOut } from '../../../test/fetchMock.js';
import { endpoints } from '../../../lib/api/endpoints.js';

const REGISTER = `POST ${endpoints.auth.register()}`;

const renderRegister = async (handlers = {}) => {
  const mock = mockApi({ ...bootSignedOut, ...handlers });
  const utils = await renderWithProviders(<RegisterPage />, { route: '/sign-up' });
  return { ...utils, ...mock };
};

const fillIn = async (user, over = {}) => {
  const values = {
    name: 'Urooj Majeed',
    email: 'founder@example.com',
    password: 'correct-horse-battery-staple',
    ...over,
  };
  await user.type(screen.getByLabelText(/your name/i), values.name);
  await user.type(screen.getByLabelText(/email address/i), values.email);
  await user.type(screen.getByLabelText(/^password/i), values.password);
  await user.click(screen.getByRole('button', { name: /create account/i }));
  return values;
};

describe('the sign up screen', () => {
  it('marks the required fields for a screen reader as well as for the eye', async () => {
    await renderRegister();

    // The asterisk is aria-hidden and paired with visually-hidden "(required)",
    // because "Your name star" is not a useful thing to hear.
    for (const label of [/your name/i, /email address/i, /^password/i]) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-required', 'true');
    }
  });

  it('states the password rule before the user types, not after they fail it', async () => {
    await renderRegister();

    const password = screen.getByLabelText(/^password/i);
    const hintId = password.getAttribute('aria-describedby');

    expect(hintId).toBeTruthy();
    expect(document.getElementById(hintId)).toHaveTextContent(/at least 12 characters/i);
  });

  it('asks for a new-password autocomplete so a manager offers to generate one', async () => {
    await renderRegister();
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute('autocomplete', 'new-password');
  });

  it('sends the browser timezone along, so times read correctly later', async () => {
    const user = userEvent.setup();
    const { calls } = await renderRegister({
      [REGISTER]: success({ accessToken: 't', user: { id: 'u1', name: 'Urooj' } }),
    });

    await fillIn(user);

    await waitFor(() => expect(calls.some((c) => c.key === REGISTER)).toBe(true));
    const sent = calls.find((c) => c.key === REGISTER).body;
    expect(sent.timezone).toBeTruthy();
    expect(sent.email).toBe('founder@example.com');
  });

  it('catches a short password without asking the server', async () => {
    const user = userEvent.setup();
    const { calls } = await renderRegister();

    await fillIn(user, { password: 'short' });

    await waitFor(() => expect(screen.getByLabelText(/^password/i)).toHaveAttribute('aria-invalid', 'true'));
    expect(calls.some((c) => c.key === REGISTER)).toBe(false);
  });

  it('refuses a password built from the email address', async () => {
    const user = userEvent.setup();
    await renderRegister();

    await fillIn(user, { password: 'founder-founder-x' });

    expect(await screen.findByText(/name or email/i)).toBeInTheDocument();
  });

  it('puts a server-side 422 under the field it names', async () => {
    const user = userEvent.setup();
    await renderRegister({
      [REGISTER]: failure(422, 'VALIDATION_ERROR', 'Some fields need attention', [
        { field: 'body.password', message: 'That password is too common — pick another' },
      ]),
    });

    // A password the client happens not to blocklist but the server does: the
    // message still has to land under the password box, not in a banner.
    await fillIn(user, { password: 'a-password-the-server-dislikes' });

    const password = screen.getByLabelText(/^password/i);
    await waitFor(() => expect(password).toHaveAttribute('aria-invalid', 'true'));
    expect(await screen.findByText(/too common/i)).toBeInTheDocument();
  });

  it('explains a duplicate email and offers the way forward', async () => {
    const user = userEvent.setup();
    await renderRegister({
      [REGISTER]: failure(409, 'CONFLICT', 'That email is already registered'),
    });

    await fillIn(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/already an account with that email/i);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('does not leave the button spinning after a failure', async () => {
    const user = userEvent.setup();
    await renderRegister({ [REGISTER]: failure(409, 'CONFLICT', 'That email is already registered') });

    await fillIn(user);

    await waitFor(() => expect(screen.getByRole('button', { name: /create account/i })).toBeEnabled());
  });
});
