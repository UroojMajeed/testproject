import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema } from '../schemas.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { paths } from '../../../routes/paths.js';
import { TextField } from '../../../components/form/TextField.jsx';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await login(values);
      navigate(location.state?.from?.pathname ?? paths.app, { replace: true });
    } catch (err) {
      // The server gives one message for a wrong password and an unknown
      // account alike. Repeating it verbatim keeps that property.
      if (err.status === 423) setFormError(err.message);
      else if (err.fieldErrors && Object.keys(err.fieldErrors).length) {
        Object.entries(err.fieldErrors).forEach(([field, message]) => setError(field, { message }));
      } else setFormError(err.message ?? 'We could not sign you in. Please try again.');
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="text-center mb-4">
          <Logo size="1.6rem" />
        </div>

        <div className="surface p-4 p-sm-4">
          <h1 className="display-serif mb-1" style={{ fontSize: '1.75rem' }}>Welcome back</h1>
          <p className="fs-ui text-muted-2 mb-4">Sign in to pick up your buyback loop.</p>

          {formError && <Alert tone="error" className="mb-3">{formError}</Alert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-3">
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordField
              label="Password"
              autoComplete="current-password"
              required
              error={errors.password?.message}
              {...register('password')}
            />

            <div className="d-flex justify-content-end">
              <Link to={paths.forgotPassword} className="fs-ui-sm">Forgot your password?</Link>
            </div>

            <Button type="submit" loading={isSubmitting} loadingLabel="Signing in">
              Sign in
            </Button>
          </form>
        </div>

        <p className="text-center fs-ui text-muted-2 mt-3 mb-0">
          New here? <Link to={paths.register}>Create an account</Link>
        </p>
      </div>
    </main>
  );
}
