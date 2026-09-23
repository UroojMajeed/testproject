import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell.jsx';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { SubmitButton } from '../../../components/ui/SubmitButton.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { resetPasswordSchema, PASSWORD_HINT } from '../schemas.js';
import { useSubmit } from '../useSubmit.js';
import { api } from '../../../lib/apiClient.js';
import { endpoints } from '../../../lib/api/endpoints.js';
import { paths } from '../../../routes/paths.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onBlur',
    defaultValues: { password: '', confirmPassword: '' },
  });

  const { pending, formError, run } = useSubmit({
    setError,
    // Setting a new password revokes every session server-side, so there is no
    // signed-in state to inherit here. Send them to sign in and say why.
    onSuccess: () => navigate(paths.login, { replace: true, state: { passwordReset: true } }),
  });

  // A link without a token is a truncated email, not a user error. Say so plainly
  // instead of showing a form that cannot possibly succeed.
  if (!token) {
    return (
      <AuthShell title="This link is incomplete" footer={<Link to={paths.forgotPassword}>Request a new link</Link>}>
        <Alert tone="error">
          The reset link is missing its token. Email clients sometimes break long links across lines — copying
          the whole thing into the address bar usually fixes it.
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      lede="This also signs you out everywhere else."
      footer={<Link to={paths.login}>Back to sign in</Link>}
    >
      <Alert tone="error">{formError}</Alert>

      <form
        onSubmit={handleSubmit((values) =>
          run(() => api.post(endpoints.auth.resetPassword(), { token, password: values.password }, { auth: false })),
        )}
        noValidate
      >
        <PasswordField
          label="New password"
          required
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirm new password"
          required
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <SubmitButton pending={pending} pendingLabel="Saving…">Save the new password</SubmitButton>
      </form>
    </AuthShell>
  );
}
