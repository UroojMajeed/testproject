import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HandoverPage from './HandoverPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, failure, signedInWorkspace, DASHBOARD } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const PLAN = 'GET /api/v1/workspace/handovers/plan';
const LIST = 'GET /api/v1/workspace/handovers';

const candidate = (over = {}) => ({
  activityId: 'a1', name: 'Invoicing', quadrant: 'delegate', estimatedMinutes: 240,
  estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000, handoverId: null, ...over,
});

const steps = (doneKeys = []) => [
  { key: 'record', title: 'Record yourself doing it once', detail: 'Screen recorder on.', done: doneKeys.includes('record'), doneAt: null },
  { key: 'access', title: 'List the access it needs', detail: 'Every login.', done: doneKeys.includes('access'), doneAt: null },
];

const handover = (over = {}) => ({
  id: 'h1', activityId: 'a1', status: 'planned', assignee: '', notes: '',
  steps: steps(), doneCount: 0, stepCount: 2,
  estimatedMinutesPerWeek: 240, estimatedAnnualCostMinor: 300000,
  rateMinorPerHour: 1500, currency: 'USD', quadrant: 'delegate',
  startedAt: null, completedAt: null, createdAt: '2026-09-25T00:00:00.000Z', ...over,
});

const renderPage = async (over = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace({
      [PLAN]: success({
        candidates: [candidate()],
        rate: DASHBOARD.rate,
        totals: { count: 1, estimatedMinutes: 240, estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
        breakEvenMinorPerHour: 1500,
      }),
      [LIST]: success({ handovers: [] }),
      'POST /api/v1/workspace/handovers': success({ handover: handover() }, 201),
      'PUT /api/v1/workspace/handovers/h1/steps/record': success({
        handover: handover({ steps: steps(['record']), doneCount: 1, status: 'in_progress' }),
      }),
      'PATCH /api/v1/workspace/handovers/h1': success({ handover: handover({ assignee: 'Aisha' }) }),
      'DELETE /api/v1/workspace/handovers/h1': { status: 204 },
      ...over,
    }),
  });
  const utils = await renderWithProviders(<HandoverPage />, { route: '/app/handover' });
  // The h1 or the failure notice — the error branch has no heading, by the same
  // convention the dashboard and the activities list use. Not Promise.race: that
  // settles on the first rejection too, so the heading's timeout would win.
  await waitFor(() => {
    expect(document.querySelector('h1, [role="alert"]')).toBeTruthy();
  });
  return { ...utils, ...mock };
};

describe('what to hand over', () => {
  it('makes the case in one sentence, against the rate that decides it', async () => {
    await renderPage();

    // Not "hire a VA for $X" — we do not know what anybody charges, and an
    // invented figure is one somebody would hire on.
    expect(screen.getByText(/4h a week is costing you \$3,000 a year/i)).toBeInTheDocument();
    expect(screen.getByText(/less than/i)).toHaveTextContent('$15');
    expect(screen.getByText(/that is your buyback rate/i)).toBeInTheDocument();
  });

  it('lists the draining activities with what each costs', async () => {
    await renderPage();

    const row = screen.getByText('Invoicing').closest('li');
    expect(within(row).getByText(/4h/)).toBeInTheDocument();
    expect(within(row).getByText(/\$3,000/)).toBeInTheDocument();
    // The quadrant's own words, so a row here is the same thing as a matrix cell.
    expect(within(row).getByText(/drains you, and the business would barely notice/i)).toBeInTheDocument();
  });

  it('starts a handover from the row', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    await user.click(screen.getByRole('button', { name: /hand this over/i }));

    await waitFor(() => {
      const [sent] = calls.filter((c) => c.key === 'POST /api/v1/workspace/handovers');
      expect(sent?.body).toEqual({ activityId: 'a1' });
    });
  });

  it('says so when a handover cannot be started', async () => {
    const user = userEvent.setup();
    await renderPage({
      'POST /api/v1/workspace/handovers': failure(422, 'VALIDATION_ERROR', 'That activity is not in your latest week'),
    });

    await user.click(screen.getByRole('button', { name: /hand this over/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/not in your latest week/i);
  });

  it('stops offering an activity that is already on its way out', async () => {
    await renderPage({
      [PLAN]: success({
        candidates: [candidate({ handoverId: 'h1' })],
        rate: DASHBOARD.rate,
        totals: { count: 0, estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
        breakEvenMinorPerHour: 1500,
      }),
      [LIST]: success({ handovers: [handover()] }),
    });

    // In progress, not still waiting on a decision.
    expect(screen.queryByRole('button', { name: /hand this over/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /on their way out/i })).toBeInTheDocument();
  });

  it('has something to say before anything has been sorted', async () => {
    await renderPage({
      [PLAN]: success({
        candidates: [],
        rate: DASHBOARD.rate,
        totals: { count: 0, estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
        breakEvenMinorPerHour: 1500,
      }),
    });

    expect(screen.getByRole('heading', { name: /nothing to hand over yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to your week/i })).toHaveAttribute('href', '/app');
  });

  it('says so when the plan cannot be loaded', async () => {
    await renderPage({ [PLAN]: failure(500, 'INTERNAL', 'Something went wrong') });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});

describe('working through a handover', () => {
  const withOne = (over = {}) => ({
    [PLAN]: success({
      candidates: [candidate({ handoverId: 'h1' })],
      rate: DASHBOARD.rate,
      totals: { count: 0, estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
      breakEvenMinorPerHour: 1500,
    }),
    [LIST]: success({ handovers: [handover()] }),
    ...over,
  });

  it('shows every step with the words that came with it', async () => {
    await renderPage(withOne());

    // The wording travels with the data; a second copy here would drift from it.
    expect(screen.getByText('Record yourself doing it once')).toBeInTheDocument();
    expect(screen.getByText('Every login.')).toBeInTheDocument();
    expect(screen.getByText('0 of 2')).toBeInTheDocument();
  });

  it('ticks a box and saves it', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage(withOne());

    await user.click(screen.getByRole('checkbox', { name: /record yourself doing it once/i }));

    await waitFor(() => {
      const [sent] = calls.filter((c) => c.key === 'PUT /api/v1/workspace/handovers/h1/steps/record');
      expect(sent?.body).toEqual({ done: true });
    });
    expect(await screen.findByText('1 of 2')).toBeInTheDocument();
  });

  it('moves the box before the round trip, because waiting feels broken', async () => {
    const user = userEvent.setup();
    await renderPage(withOne());

    const box = screen.getByRole('checkbox', { name: /record yourself/i });
    await user.click(box);

    expect(box).toBeChecked();
  });

  it('puts the box back when the save fails', async () => {
    const user = userEvent.setup();
    await renderPage(withOne({
      'PUT /api/v1/workspace/handovers/h1/steps/record': failure(500, 'INTERNAL', 'Something went wrong'),
    }));

    const box = screen.getByRole('checkbox', { name: /record yourself/i });
    await user.click(box);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Leaving it ticked would claim something was saved that was not.
    await waitFor(() => expect(box).not.toBeChecked());
    expect(screen.getByText('0 of 2')).toBeInTheDocument();
  });

  it('records who is taking it on, on leaving the field', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage(withOne());

    await user.type(screen.getByLabelText(/who is taking it on/i), 'Aisha');
    await user.tab();

    await waitFor(() => {
      const [sent] = calls.filter((c) => c.key === 'PATCH /api/v1/workspace/handovers/h1');
      expect(sent?.body).toEqual({ assignee: 'Aisha' });
    });
  });

  it('does not send a name that has not changed', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage(withOne());

    await user.click(screen.getByLabelText(/who is taking it on/i));
    await user.tab();

    expect(calls.filter((c) => c.key.startsWith('PATCH'))).toHaveLength(0);
  });

  it('asks before calling a handover off', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage(withOne());

    await user.click(screen.getByRole('button', { name: /stop handing over invoicing/i }));
    expect(screen.getByText(/call it off\?/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.key.startsWith('DELETE'))).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: /yes, stop/i }));
    await waitFor(() => expect(calls.filter((c) => c.key === 'DELETE /api/v1/workspace/handovers/h1')).toHaveLength(1));
  });

  it('says what a finished handover bought back', async () => {
    await renderPage(withOne({
      [LIST]: success({
        handovers: [handover({
          status: 'done', steps: steps(['record', 'access']), doneCount: 2,
          completedAt: '2026-09-26T00:00:00.000Z',
        })],
      }),
    }));

    // Kept rather than hidden: the record of how it was handed over is the point.
    expect(screen.getByText(/handed over\. that is 4h a week back/i)).toBeInTheDocument();
  });

  it('keeps the figure that justified the decision, not today’s', async () => {
    await renderPage(withOne());

    expect(screen.getByText(/at the rate when you decided/i)).toBeInTheDocument();
  });
});
