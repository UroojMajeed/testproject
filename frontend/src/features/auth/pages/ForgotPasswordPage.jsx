import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema } from '../schemas.js';
import { api } from '../../../lib/apiClient.js';
import { paths } from '../../../routes/paths.js';
import { TextField } from '../../../components/form/TextField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } });

  async function onSubmit(values) {
    // The server answers identically whether or not the account exists, and so
    // does this screen — anything else would confirm which addresses are real.
    try {
      await api.post('/auth/forgot-password', values);
    } finally {
      setSent(true);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="text-center mb-4"><Logo size="1.6rem" /></div>

        <div className="surface p-4">
          <h1 className="display-serif mb-1" style={{ fontSize: '1.75rem' }}>Reset your password</h1>

          {sent ? (
            <Alert tone="success" className="mt-3">
              If an account exists for that address, a reset link is on its way. The link is good for
              30 minutes and can be used once.
            </Alert>
          ) : (
            <>
              <p className="fs-ui text-muted-2 mb-4">
                Enter your email and we will send you a link.
              </p>
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-3">
                <TextField
                  label="Email"
                  type="email"
                  autoComplete="email"
                  required
                  error={errors.email?.message}
                  {...register('email')}
                />
                <Button type="submit" loading={isSubmitting} loadingLabel="Sending">
                  Send reset link
                </Button>
              </form>
            </>
          )}
        </div>

        <p className="text-center fs-ui text-muted-2 mt-3 mb-0">
          <Link to={paths.login}>Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
