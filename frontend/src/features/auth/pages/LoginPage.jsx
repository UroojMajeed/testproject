import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell.jsx';
import { TextField } from '../../../components/form/TextField.jsx';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { SubmitButton } from '../../../components/ui/SubmitButton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { loginSchema } from '../schemas.js';
import { useSubmit } from '../useSubmit.js';
import { useAuth } from '../../../context/useAuth.js';
import { paths } from '../../../routes/paths.js';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Set by ProtectedRoute when it turned someone away. Send them back there.
  const returnTo = location.state?.from?.pathname ?? paths.app;
  // Set by ResetPasswordPage, which cannot sign the user in because the reset
  // revoked every session. Without this the redirect looks like a failure.
  const justResetPassword = Boolean(location.state?.passwordReset);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
    defaultValues: { email: '', password: '' },
  });

  const { pending, formError, run } = useSubmit({
    setError,
    onSuccess: () => navigate(returnTo, { replace: true }),
  });

  return (
    <AuthShell
      title="Sign in"
      lede="Welcome back."
      footer={<>New here? <Link to={paths.register}>Create an account</Link></>}
    >
      {/*
        The server answers a wrong password and an unknown address identically, and
        so does this screen. Saying "no account with that email" would let anyone
        test a list of addresses against us for free.
      */}
      {justResetPassword ? (
        <Alert tone="success">Your password was changed. Sign in with the new one.</Alert>
      ) : null}
      <Alert tone="error">{formError}</Alert>

      <form onSubmit={handleSubmit((values) => run(() => login(values)))} noValidate>
        <TextField
          label="Email address"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <PasswordField
          label="Password"
          required
          autoComplete="current-password"
          error={errors.password?.message}
          {...register('password')}
        />

        <SubmitButton pending={pending} pendingLabel="Signing you in…">Sign in</SubmitButton>

        <p className="text-center mt-4 mb-0" style={{ fontSize: 'var(--text-sm)' }}>
          <Link to={paths.forgotPassword}>Forgotten your password?</Link>
        </p>
      </form>
    </AuthShell>
  );
}
