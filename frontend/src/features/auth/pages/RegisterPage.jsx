import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from './AuthShell.jsx';
import { TextField } from '../../../components/form/TextField.jsx';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { SubmitButton } from '../../../components/ui/SubmitButton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { registerSchema, PASSWORD_HINT } from '../schemas.js';
import { useSubmit } from '../useSubmit.js';
import { useAuth } from '../../../context/useAuth.js';
import { paths } from '../../../routes/paths.js';
import { currentTimezone } from '../../../lib/formatters.js';

export default function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    // Validate when a field is left, not on every keystroke. Telling someone their
    // email is invalid while they are still typing the @ is just nagging.
    mode: 'onBlur',
    defaultValues: { name: '', email: '', password: '' },
  });

  const { pending, formError, run } = useSubmit({
    setError,
    onSuccess: () => navigate(paths.app, { replace: true }),
  });

  const onSubmit = (values) =>
    run(() => signUp({ ...values, timezone: currentTimezone() }));

  return (
    <AuthShell
      title="Create your account"
      lede="Ten minutes of setup to find out where your week actually goes."
      footer={<>Already have an account? <Link to={paths.login}>Sign in</Link></>}
    >
      <Alert tone="error">{formError}</Alert>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          label="Your name"
          required
          autoComplete="name"
          error={errors.name?.message}
          {...register('name')}
        />

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
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={errors.password?.message}
          {...register('password')}
        />

        <SubmitButton pending={pending} pendingLabel="Creating your account…">
          Create account
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
