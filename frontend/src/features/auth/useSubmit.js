import { useState } from 'react';
import { ApiError } from '../../lib/apiClient.js';

/**
 * Submitting a form, and dealing with what the server says back.
 *
 * The part worth having in one place is the 422: the server answers with
 * `details: [{ field: "body.password", message }]`, and those belong under the
 * fields they name, not in a banner at the top. Anything without a field, or any
 * other status, becomes the banner.
 *
 * `setError` comes from react-hook-form, so a server-side rule lands in exactly
 * the same place a client-side rule would, and the user cannot tell which fired.
 */
export function useSubmit({ setError, onSuccess } = {}) {
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState(null);

  async function run(action) {
    setPending(true);
    setFormError(null);
    try {
      const result = await action();
      onSuccess?.(result);
      return result;
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = err.fieldErrors;
        const named = Object.keys(fields);

        if (setError && named.length) {
          named.forEach((field) => setError(field, { type: 'server', message: fields[field] }));
          // Only show the banner as well if something had no field to sit under.
          if (err.details.length > named.length) setFormError(err.userMessage);
        } else {
          setFormError(err.userMessage);
        }
      } else if (err?.name !== 'AbortError') {
        setFormError('Something went wrong. Please try again.');
      }
      return null;
    } finally {
      setPending(false);
    }
  }

  return { pending, formError, setFormError, run };
}
