import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { registerSchema } from '../schemas.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { paths } from '../../../routes/paths.js';
import { TextField } from '../../../components/form/TextField.jsx';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { name: '', email: '', password: '' },
  });

  const passwordValue = watch('password');

  async function onSubmit(values) {
    setFormError(null);
    try {
      await signUp({ ...values, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      navigate(paths.onboarding, { replace: true });
    } catch (err) {
      const fields = err.fieldErrors ?? {};
      if (Object.keys(fields).length) {
        Object.entries(fields).forEach(([field, message]) => setError(field, { message }));
      } else if (err.status === 409) {
        setError('email', { message: 'That email is already registered' });
      } else {
        setFormError(err.message ?? 'We could not create your account. Please try again.');
      }
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="text-center mb-4">
          <Logo size="1.6rem" />
        </div>

        <div className="surface p-4">
          <h1 className="display-serif mb-1" style={{ fontSize: '1.75rem' }}>Start reclaiming time</h1>
          <p className="fs-ui text-muted-2 mb-4">
            Connect a calendar and see where last week went — about ten minutes.
          </p>

          {formError && <Alert tone="error" className="mb-3">{formError}</Alert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-3">
            <TextField
              label="Your name"
              autoComplete="name"
              required
              error={errors.name?.message}
              {...register('name')}
            />

            <TextField
              label="Work email"
              type="email"
              autoComplete="email"
              required
              error={errors.email?.message}
              {...register('email')}
            />

            <PasswordField
              label="Password"
              autoComplete="new-password"
              required
              showStrength
              value={passwordValue}
              hint="At least 12 characters. A short phrase beats a clever word."
              error={errors.password?.message}
              {...register('password')}
            />

            <Button type="submit" loading={isSubmitting} loadingLabel="Creating your account">
              Create account
            </Button>
          </form>
        </div>

        <p className="text-center fs-ui text-muted-2 mt-3 mb-0">
          Already have an account? <Link to={paths.login}>Sign in</Link>
        </p>
      </div>
    </main>
  );
}
