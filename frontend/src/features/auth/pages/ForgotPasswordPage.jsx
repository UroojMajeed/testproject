import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { AuthShell } from './AuthShell.jsx';
import { TextField } from '../../../components/form/TextField.jsx';
import { SubmitButton } from '../../../components/ui/SubmitButton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { forgotPasswordSchema } from '../schemas.js';
import { useSubmit } from '../useSubmit.js';
import { api } from '../../../lib/apiClient.js';
import { endpoints } from '../../../lib/api/endpoints.js';
import { paths } from '../../../routes/paths.js';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), mode: 'onBlur', defaultValues: { email: '' } });

  const { pending, formError, run } = useSubmit({ setError, onSuccess: () => setSent(true) });

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        footer={<Link to={paths.login}>Back to sign in</Link>}
      >
        {/*
          Worded so it is true whether or not the address exists. The server answers
          identically either way; a screen that said "we've emailed you" for a real
          address and something else for an unknown one would undo that in one line.
        */}
        <Alert tone="success">
          If an account exists for <strong>{getValues('email')}</strong>, a reset link is on its way. It is
          valid for 30 minutes.
        </Alert>
        <p style={{ color: 'var(--ink-muted)', fontSize: 'var(--text-sm)' }}>
          Nothing arrived? Check the spam folder, then try again — the address may be spelled differently to
          the one on the account.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      lede="Tell us the address on the account and we will send a link."
      footer={<Link to={paths.login}>Back to sign in</Link>}
    >
      <Alert tone="error">{formError}</Alert>

      <form
        onSubmit={handleSubmit((values) => run(() => api.post(endpoints.auth.forgotPassword(), values, { auth: false })))}
        noValidate
      >
        <TextField
          label="Email address"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <SubmitButton pending={pending} pendingLabel="Sending…">Send the reset link</SubmitButton>
      </form>
    </AuthShell>
  );
}
