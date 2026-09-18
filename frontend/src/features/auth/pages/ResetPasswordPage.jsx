import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { resetPasswordSchema } from '../schemas.js';
import { api } from '../../../lib/apiClient.js';
import { paths } from '../../../routes/paths.js';
import { PasswordField } from '../../../components/form/PasswordField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirm: '' } });

  async function onSubmit(values) {
    setFormError(null);
    try {
      await api.post('/auth/reset-password', { token, password: values.password });
      navigate(paths.login, {
        replace: true,
        state: { notice: 'Password updated. Sign in with your new password.' },
      });
    } catch (err) {
      setFormError(err.message ?? 'That link is invalid or has expired.');
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="text-center mb-4"><Logo size="1.6rem" /></div>

        <div className="surface p-4">
          <h1 className="display-serif mb-1" style={{ fontSize: '1.75rem' }}>Choose a new password</h1>
          <p className="fs-ui text-muted-2 mb-4">
            Setting a new password signs you out everywhere else.
          </p>

          {formError && <Alert tone="error" className="mb-3">{formError}</Alert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-3">
            <PasswordField
              label="New password"
              autoComplete="new-password"
              required
              showStrength
              value={watch('password')}
              hint="At least 12 characters."
              error={errors.password?.message}
              {...register('password')}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              required
              error={errors.confirm?.message}
              {...register('confirm')}
            />
            <Button type="submit" loading={isSubmitting} loadingLabel="Updating">
              Update password
            </Button>
          </form>
        </div>

        <p className="text-center fs-ui text-muted-2 mt-3 mb-0">
          <Link to={paths.login}>Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}
