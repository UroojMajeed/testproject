import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { workspaceSchema, goalSchema } from '../../auth/schemas.js';
import { api } from '../../../lib/apiClient.js';
import { useAuth } from '../../../context/AuthContext.jsx';
import { paths } from '../../../routes/paths.js';
import { INDUSTRIES } from '../../../lib/constants.js';
import { formatMoney } from '../../../lib/formatters.js';
import { TextField } from '../../../components/form/TextField.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { Alert } from '../../../components/ui/Alert.jsx';
import { Logo } from '../../../components/ui/Logo.jsx';

const STEPS = ['Workspace', 'Your goal', 'Your week'];

function ProgressRail({ step }) {
  return (
    <div className="d-flex align-items-center gap-3">
      <span className="fs-ui-sm text-muted-3">Step {step} of {STEPS.length}</span>
      <div
        className="rounded-pill overflow-hidden flex-grow-1"
        style={{ height: 5, background: 'var(--sunken)', maxWidth: 180 }}
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={STEPS.length}
        aria-label={`Onboarding progress: ${STEPS[step - 1]}`}
      >
        <div style={{ width: `${(step / STEPS.length) * 100}%`, height: '100%', background: 'var(--ink)' }} />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { workspaces, addWorkspace } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(workspaces.length ? 2 : 1);
  const [workspace, setWorkspace] = useState(workspaces[0] ?? null);
  const [formError, setFormError] = useState(null);

  return (
    <div className="min-vh-100 d-flex flex-column" style={{ background: 'var(--ground)' }}>
      <header className="d-flex align-items-center gap-3 px-4 py-3">
        <Logo />
        <div className="ms-auto"><ProgressRail step={step} /></div>
      </header>

      <main id="main" className="flex-grow-1 d-flex align-items-center justify-content-center px-4 pb-5">
        <div style={{ width: '100%', maxWidth: 640 }}>
          {formError && <Alert tone="error" className="mb-3">{formError}</Alert>}

          {step === 1 && (
            <WorkspaceStep
              onError={setFormError}
              onDone={(ws) => { setWorkspace(ws); addWorkspace(ws); setStep(2); }}
            />
          )}

          {step === 2 && workspace && (
            <GoalStep
              workspace={workspace}
              onError={setFormError}
              onDone={(ws) => { setWorkspace(ws); addWorkspace(ws); setStep(3); }}
            />
          )}

          {step === 3 && workspace && (
            <CalendarStep
              workspace={workspace}
              onError={setFormError}
              onDone={(ws) => { addWorkspace(ws); navigate(paths.sortStart, { replace: true }); }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function WorkspaceStep({ onDone, onError }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: '',
      industry: 'other',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
      currency: 'USD',
    },
  });

  async function onSubmit(values) {
    onError(null);
    try {
      const { workspace } = await api.post('/workspaces', values);
      onDone(workspace);
    } catch (err) {
      onError(err.message ?? 'We could not create your workspace.');
    }
  }

  return (
    <section className="surface p-4">
      <h1 className="display-serif mb-1" style={{ fontSize: '2rem' }}>Set up your workspace</h1>
      <p className="fs-ui text-muted-2 mb-4">You can invite your team once you are in.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-3">
        <TextField
          label="Company or workspace name"
          required
          autoComplete="organization"
          error={errors.name?.message}
          {...register('name')}
        />

        <div className="stack">
          <label className="form-label" htmlFor="industry">What kind of business is it?</label>
          <select id="industry" className="form-select" {...register('industry')}>
            {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
          </select>
        </div>

        <div className="row g-3">
          <div className="col-sm-7">
            <TextField label="Timezone" readOnly error={errors.timezone?.message} {...register('timezone')} />
          </div>
          <div className="col-sm-5">
            <TextField label="Currency" maxLength={3} error={errors.currency?.message} {...register('currency')} />
          </div>
        </div>

        <Button type="submit" loading={isSubmitting} loadingLabel="Creating">Continue</Button>
      </form>
    </section>
  );
}

function GoalStep({ workspace, onDone, onError }) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(goalSchema),
    defaultValues: { currentWeeklyHours: 50, targetWeeklyHours: 35, annualCompensation: 0, annualHours: 2000 },
  });

  const [comp, hours, current, target] = [
    Number(watch('annualCompensation')) || 0,
    Number(watch('annualHours')) || 1,
    Number(watch('currentWeeklyHours')) || 0,
    Number(watch('targetWeeklyHours')) || 0,
  ];
  const rateMinor = Math.round((comp * 100) / hours);
  const goal = Math.max(0, current - target);

  async function onSubmit(values) {
    onError(null);
    try {
      await api.patch(`/workspaces/${workspace.id}`, {
        currentWeeklyHours: values.currentWeeklyHours,
        targetWeeklyHours: values.targetWeeklyHours,
        weeklyBuybackGoalHours: Math.max(0, values.currentWeeklyHours - values.targetWeeklyHours),
      });
      const { workspace: updated } = await api.patch(`/workspaces/${workspace.id}/buyback-rate`, {
        annualCompensationMinor: Math.round(values.annualCompensation * 100),
        annualHours: values.annualHours,
        method: 'calculated',
      });
      onDone(updated);
    } catch (err) {
      onError(err.message ?? 'We could not save that.');
    }
  }

  return (
    <section className="surface p-4">
      <h1 className="display-serif mb-1" style={{ fontSize: '2rem' }}>What are you buying back?</h1>
      <p className="fs-ui text-muted-2 mb-4">
        Two numbers now, so every recommendation later can be priced.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="stack gap-4">
        <fieldset className="border-0 p-0 m-0">
          <legend className="eyebrow mb-2">Your week</legend>
          <div className="row g-3">
            <div className="col-sm-6">
              <TextField
                label="Hours you work now" type="number" min={1} max={168} required
                error={errors.currentWeeklyHours?.message} {...register('currentWeeklyHours')}
              />
            </div>
            <div className="col-sm-6">
              <TextField
                label="Hours you want to work" type="number" min={1} max={168} required
                error={errors.targetWeeklyHours?.message} {...register('targetWeeklyHours')}
              />
            </div>
          </div>
          <p className="field-hint mb-0" aria-live="polite">
            Goal: <strong className="numeral">{goal}</strong> hours a week to reclaim.
          </p>
        </fieldset>

        <fieldset className="border-0 p-0 m-0">
          <legend className="eyebrow mb-2">Your buyback rate</legend>
          <div className="row g-3">
            <div className="col-sm-7">
              <TextField
                label="Annual compensation" type="number" min={0} step={1000} required
                error={errors.annualCompensation?.message} {...register('annualCompensation')}
              />
            </div>
            <div className="col-sm-5">
              <TextField
                label="Working hours a year" type="number" min={1} max={8760} required
                error={errors.annualHours?.message} {...register('annualHours')}
              />
            </div>
          </div>

          <div className="mt-3 p-3 rounded" style={{ background: 'var(--sunken)' }}>
            <p className="mb-1 d-flex align-items-baseline gap-2" aria-live="polite">
              <span className="numeral" style={{ fontSize: '1.6rem' }}>{formatMoney(rateMinor, workspace.currency)}</span>
              <span className="fs-ui text-muted-2">per hour</span>
            </p>
            <p className="fs-caption text-muted-3 mb-0">
              Your estimated internal time value — a planning figure for deciding what to hand off,
              not a wage or a valuation. You can override it in settings.
            </p>
          </div>
        </fieldset>

        <Button type="submit" loading={isSubmitting} loadingLabel="Saving">Continue</Button>
      </form>
    </section>
  );
}

function CalendarStep({ workspace, onDone, onError }) {
  const [busy, setBusy] = useState(false);

  async function finish(skipped) {
    onError(null);
    setBusy(true);
    try {
      const { workspace: updated } = await api.patch(`/workspaces/${workspace.id}/onboarding`, {
        step: 3,
        completed: true,
        skipped: skipped ? ['calendar'] : [],
      });
      onDone(updated);
    } catch (err) {
      onError(err.message ?? 'We could not finish setting up.');
      setBusy(false);
    }
  }

  return (
    <section className="surface p-4">
      <h1 className="display-serif mb-1" style={{ fontSize: '2rem' }}>Let&rsquo;s look at last week</h1>
      <p className="fs-ui text-muted-2 mb-4 max-ch">
        Connect your calendar and we will pull the last seven days, group repeated meetings together,
        and walk you through them. Ten minutes, one pass.
      </p>

      <div className="stack gap-2 mb-3">
        <Button variant="outline" disabled title="Calendar sync arrives in phase 2">
          Continue with Google Calendar
        </Button>
        <Button variant="outline" disabled title="Calendar sync arrives in phase 2">
          Continue with Microsoft Outlook
        </Button>
        <p className="field-hint mb-0">
          Calendar sync is not wired up yet. Finish setup and you go straight into a ten-minute walk through last week.
        </p>
      </div>

      <div className="d-flex align-items-start gap-2 p-3 rounded mb-4" style={{ background: 'var(--sunken)' }}>
        <span aria-hidden="true">🔒</span>
        <p className="fs-caption text-muted-2 mb-0">
          Read-only. We never create, move or delete an event without asking, and we read titles and
          times only — never event contents.
        </p>
      </div>

      <div className="stack gap-2">
        <Button onClick={() => finish(false)} loading={busy} loadingLabel="Finishing">
          Finish setup and sort last week
        </Button>
        <Button variant="quiet" onClick={() => finish(true)} disabled={busy}>
          Skip for now
        </Button>
      </div>
    </section>
  );
}
