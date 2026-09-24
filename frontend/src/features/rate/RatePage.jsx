import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Field } from '../../components/ui/Field.jsx';
import { SubmitButton } from '../../components/ui/SubmitButton.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Logo } from '../../components/ui/Logo.jsx';
import { FullPageSpinner } from '../../components/ui/FullPageSpinner.jsx';
import { useRate, useSetRate } from '../../lib/api/hooks.js';
import { useSubmit } from '../auth/useSubmit.js';
import { formatMoney, toMinor, toMajor } from '../../lib/money.js';
import { paths } from '../../routes/paths.js';

/**
 * Mirrors backend/src/modules/rates/rate.validation.js. Income is typed in major
 * units here — nobody enters their salary in pence — and converted at the edge.
 */
const schema = z.object({
  annualIncome: z.coerce.number({ invalid_type_error: 'Enter a number' })
    .min(1, 'Enter what you earn in a year')
    .max(100_000_000, 'That figure looks like a mistake'),
  hoursPerWeek: z.coerce.number({ invalid_type_error: 'Enter a number' })
    .int('Whole hours')
    .min(1, 'At least one hour a week')
    .max(168, 'There are only 168 hours in a week'),
  weeksPerYear: z.coerce.number({ invalid_type_error: 'Enter a number' })
    .int('Whole weeks')
    .min(1, 'At least one week a year')
    .max(52, 'There are only 52 weeks in a year'),
});

export default function RatePage() {
  const navigate = useNavigate();
  const { data: existing, isPending: rateLoading } = useRate();
  const setRate = useSetRate();
  const [saved, setSaved] = useState(null);

  const current = existing?.rate;
  const currency = current?.currency ?? 'USD';

  const {
    register, handleSubmit, watch, setError, reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: {
      annualIncome: current ? toMajor(current.annualIncomeMinor) : '',
      hoursPerWeek: current?.hoursPerWeek ?? 40,
      weeksPerYear: current?.weeksPerYear ?? 48,
    },
  });

  /**
   * defaultValues are read once, on first render, and the existing rate arrives
   * after it. Without this, following "Change it" from the dashboard opened an
   * empty form — so somebody adjusting their hours would have to retype their
   * income from memory, and a blank field reads as "we lost it".
   *
   * Guarded on isDirty so a slow response cannot overwrite what they have already
   * started typing.
   */
  useEffect(() => {
    if (!current || isDirty) return;
    reset({
      annualIncome: toMajor(current.annualIncomeMinor),
      hoursPerWeek: current.hoursPerWeek,
      weeksPerYear: current.weeksPerYear,
    });
  }, [current, isDirty, reset]);

  const values = watch();

  /**
   * The same arithmetic as the server, shown live as they type.
   *
   * Duplicated deliberately: this is a number people argue with, and watching it
   * move as they adjust the inputs is what makes it theirs rather than ours. The
   * server's figure is still the one that gets stored.
   */
  const preview = useMemo(() => {
    const hours = Number(values.hoursPerWeek) * Number(values.weeksPerYear);
    const income = toMinor(values.annualIncome);
    if (!hours || !Number.isFinite(income) || income <= 0) return null;
    return { effective: Math.round(income / hours), buyback: Math.round(income / hours / 4) };
  }, [values.annualIncome, values.hoursPerWeek, values.weeksPerYear]);

  const { pending, formError, run } = useSubmit({
    setError,
    onSuccess: (result) => setSaved(result.rate),
  });

  const onSubmit = (form) =>
    run(() => setRate.mutateAsync({
      annualIncomeMinor: toMinor(form.annualIncome),
      hoursPerWeek: form.hoursPerWeek,
      weeksPerYear: form.weeksPerYear,
    }));

  /**
   * Waits for the existing rate before drawing the form.
   *
   * react-hook-form reads defaultValues once, so the fields are empty until the
   * query lands and the effect above fills them. Rendering through that showed
   * somebody arriving from "Change it" a blank income box for a moment, which
   * reads as "we have lost your details" — and it is a fast query on a screen
   * nobody visits twice a day.
   */
  if (rateLoading) return <FullPageSpinner label="Loading your rate" />;

  if (saved) {
    return (
      <main id="main" tabIndex={-1} className="page-width app-page">
        <p className="mb-5"><Logo /></p>
        <h1 className="app-header__title">Your buyback rate</h1>

        <p className="rate-figure numeric">{formatMoney(saved.rateMinorPerHour, saved.currency)}<span className="rate-figure__unit"> an hour</span></p>

        <Alert tone="info">
          A planning estimate, not a wage and not a valuation. It is the line above
          which buying an hour back stops making sense: if someone else will do a
          task for less than this, the trade is worth making.
        </Alert>

        <button type="button" className="btn btn-primary mt-4" onClick={() => navigate(paths.audit)}>
          Next: what last week looked like
        </button>
      </main>
    );
  }

  return (
    <main id="main" tabIndex={-1} className="page-width app-page measure">
      <p className="mb-5"><Logo /></p>

      <h1 className="app-header__title">What is an hour of your time worth?</h1>
      <p className="app-header__subtitle mb-5">
        Three numbers, roughly. Everything the product tells you afterwards is priced against this,
        so an honest guess beats a flattering one.
      </p>

      <Alert tone="error">{formError}</Alert>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field
          label="What you earn in a year, before tax"
          type="number"
          inputMode="decimal"
          step="any"
          prefix={formatMoney(0, currency).replace(/[\d.,\s]/g, '')}
          error={errors.annualIncome?.message}
          {...register('annualIncome')}
        />

        <Field
          label="Hours you work in a week"
          type="number"
          inputMode="numeric"
          suffix="hours"
          hint="What you actually work, not what is in your contract."
          error={errors.hoursPerWeek?.message}
          {...register('hoursPerWeek')}
        />

        <Field
          label="Weeks you work in a year"
          type="number"
          inputMode="numeric"
          suffix="weeks"
          hint="52 minus holidays. Counting weeks you do not work would flatter the figure."
          error={errors.weeksPerYear?.message}
          {...register('weeksPerYear')}
        />

        {preview ? (
          <div className="rate-preview" aria-live="polite">
            <p className="rate-preview__line">
              An hour of your time earns <strong className="numeric">{formatMoney(preview.effective, currency)}</strong>
            </p>
            <p className="rate-preview__line rate-preview__line--strong">
              Your buyback rate is <strong className="numeric">{formatMoney(preview.buyback, currency)}</strong> an hour
            </p>
            <p className="rate-preview__note">A quarter of what you earn, which is the conservative end on purpose.</p>
          </div>
        ) : null}

        <SubmitButton pending={pending} pendingLabel="Saving…" className="mt-4">
          {current ? 'Update my rate' : 'Set my rate'}
        </SubmitButton>
      </form>
    </main>
  );
}
