import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell } from './AuthShell.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { api } from '../../../lib/apiClient.js';
import { endpoints } from '../../../lib/api/endpoints.js';
import { paths } from '../../../routes/paths.js';

/**
 * Where the link in the welcome email lands.
 *
 * It had nowhere to land until now: the email pointed at /verify-email and the
 * client had no such route, so the catch-all sent people to the front page and
 * the token went unused. A link in an inbox that quietly does nothing is worse
 * than no link at all.
 *
 * There is no form here — the token is the whole submission — so it verifies on
 * arrival and reports what happened. The three outcomes are all worth different
 * words: no token, a token the server rejected, and done.
 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [state, setState] = useState(token ? 'checking' : 'no-token');
  const [error, setError] = useState(null);

  /*
   * Verification spends the token, so it must happen once. React runs effects
   * twice in development's strict mode, and without this the second call meets a
   * token the first one has already used — reporting a failure for something that
   * worked.
   */
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;

    api.post(endpoints.auth.verifyEmail(), { token })
      .then(() => setState('done'))
      .catch((err) => {
        setError(err?.userMessage ?? 'That link is invalid or has expired.');
        setState('failed');
      });
  }, [token]);

  if (state === 'no-token') {
    return (
      <AuthShell title="That link is incomplete" lede="It is missing the part that identifies you.">
        <Alert tone="error">
          Copy the whole link from the email — some mail clients break long ones across lines.
        </Alert>
        <p className="mt-4"><Link to={paths.app}>Go to your account</Link></p>
      </AuthShell>
    );
  }

  if (state === 'checking') {
    return (
      <AuthShell title="Confirming your email" lede="One moment.">
        <p className="text-muted-token" aria-live="polite">Checking that link…</p>
      </AuthShell>
    );
  }

  if (state === 'failed') {
    return (
      <AuthShell
        title="That link did not work"
        lede="Verification links expire, and each one can only be used once."
        footer={<>Already confirmed? <Link to={paths.login}>Sign in</Link></>}
      >
        <Alert tone="error">{error}</Alert>
        {/* Confirming is not a gate on using the product, so nobody is stuck. */}
        <p className="mt-4">
          You can carry on without confirming — it only matters for recovering a
          lost password. <Link to={paths.app}>Go to your account</Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Email confirmed" lede="That is the only thing that needed doing.">
      <Alert tone="success">
        Your address is confirmed, so you can recover this account if you ever lose the password.
      </Alert>
      <p className="mt-4"><Link to={paths.app} className="btn btn-primary">Go to your account</Link></p>
    </AuthShell>
  );
}
