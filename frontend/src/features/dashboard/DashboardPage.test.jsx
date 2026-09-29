import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DashboardPage from './DashboardPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, signedInWorkspace, DASHBOARD, WORKSPACE_STATE } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const renderDashboard = async (over = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace(over),
  });
  const utils = await renderWithProviders(<DashboardPage />, { route: '/app' });
  await screen.findByRole('heading', { level: 1, name: /hello/i });
  return { ...utils, ...mock };
};

describe('what last week cost', () => {
  it('shows the week’s total, and what a year of it comes to', async () => {
    await renderDashboard();

    expect(screen.getByText('9h')).toBeInTheDocument();
    expect(screen.getByText('$135')).toBeInTheDocument();
    expect(screen.getByText('$6,750')).toBeInTheDocument();
  });

  it('says every figure is an estimate, on every card', async () => {
    await renderDashboard();

    /**
     * Deliberately repetitive. These are somebody's recollection of last week, and
     * measured figures are coming — the moment a reader stops noticing which is
     * which, the product is quietly lying to them.
     */
    expect(screen.getByText(/estimated, from your recall/i)).toBeInTheDocument();
    expect(screen.getByText(/if every week looked like this one/i)).toBeInTheDocument();
  });

  it('calls the rate a planning estimate where the figures are', async () => {
    await renderDashboard();

    // Not a wage and not a valuation; someone who reads it as either will make
    // bad decisions with it.
    expect(screen.getByText(/planning estimate, not a wage/i)).toBeInTheDocument();
    expect(screen.getByText(/\$15/)).toBeInTheDocument();
  });

  it('ranks the activities and marks the worst', async () => {
    await renderDashboard();

    const rows = screen.getAllByRole('row').slice(1); // drop the header
    expect(rows[0]).toHaveTextContent('Invoicing');
    expect(rows[0].className).toMatch(/is-worst/);
  });

  it('names how each activity felt in words, not only colour', async () => {
    await renderDashboard();

    // A red cell says nothing to a screen reader, and nothing to the 8% of men who
    // would not see it as red anyway.
    expect(screen.getByText('Drains me')).toBeInTheDocument();
    expect(screen.getByText('Energises me')).toBeInTheDocument();
  });

  it('ends by pointing at one thing to do something about', async () => {
    await renderDashboard();

    // A diagnosis with no treatment is how a tool like this loses people: they see
    // a large number, feel worse, and close the tab.
    expect(screen.getByRole('heading', { name: /start with invoicing/i })).toBeInTheDocument();
    expect(screen.getByText(/most worth handing over/i)).toBeInTheDocument();
  });

  it('says so plainly when nothing is draining them', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        worst: null,
        activities: [DASHBOARD.activities[1]],
      }),
    });

    expect(screen.getByRole('heading', { name: /nothing here is draining you/i })).toBeInTheDocument();
    expect(screen.getByText(/that is a good week, not a missing answer/i)).toBeInTheDocument();
  });

  it('shows an empty state rather than zeroes before any week is filed', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD, week: null, activities: [], worst: null, weeksRecorded: 0,
        totals: { estimatedMinutes: 0, estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0 },
      }),
    });

    expect(screen.getByRole('heading', { name: /nothing to add up yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /record last week/i })).toHaveAttribute('href', '/app/audit');
  });

  it('marks an unusual week as shown but not counted', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        week: { ...DASHBOARD.week, isTypical: false },
      }),
    });

    expect(screen.getByText(/not used as the yardstick/i)).toBeInTheDocument();
  });

  it('nudges when the current week is unfiled, without blocking the figures', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/state': success({
        weekStarting: '2026-09-28', needsRate: false, needsFirstAudit: false,
        currentWeekFiled: false, completedAudits: 3,
      }),
    });

    // A missed Friday must not lock somebody out of figures they already have.
    expect(await screen.findByRole('link', { name: /two minutes/i })).toHaveAttribute('href', '/app/audit');
    expect(screen.getByText('$6,750')).toBeInTheDocument();
  });
});


describe('the week on screen', () => {
  it('offers the audit as a button on the week, not a place in the sidebar', async () => {
    await renderDashboard();

    // Recording a week is something you do *to* a week.
    expect(screen.getByRole('link', { name: /this week’s audit|record this week/i }))
      .toHaveAttribute('href', '/app/audit');
  });

  it('calls it "record" while the week is unfiled, and "audit" once it is', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/state': success({ ...WORKSPACE_STATE, currentWeekFiled: false }),
    });

    expect(await screen.findByRole('link', { name: /record this week/i })).toBeInTheDocument();
  });

  it('offers no paging when there is only one week on record', async () => {
    await renderDashboard();

    // Two dead arrows say "there is more here" when there is not.
    expect(screen.queryByRole('navigation', { name: /move between weeks/i })).not.toBeInTheDocument();
  });

  it('offers the week before once there is one', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({ ...DASHBOARD, previousWeek: '2026-09-14' }),
    });

    const paging = screen.getByRole('navigation', { name: /move between weeks/i });
    expect(within(paging).getByRole('button', { name: /the week before/i })).toBeEnabled();
    // Nothing newer exists, so there is nowhere forward to go.
    expect(within(paging).getByRole('button', { name: /the week after/i })).toBeDisabled();
    expect(within(paging).getByText(/the latest one/i)).toBeInTheDocument();
  });

  it('asks the server for the week it was told to show', async () => {
    const user = userEvent.setup();
    const { calls } = await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({ ...DASHBOARD, previousWeek: '2026-09-14' }),
      'GET /api/v1/workspace/dashboard?week=2026-09-14': success({
        ...DASHBOARD,
        week: { ...DASHBOARD.week, weekStarting: '2026-09-14', weekEnding: '2026-09-20' },
        previousWeek: null,
        nextWeek: '2026-09-21',
      }),
    });

    await user.click(screen.getByRole('button', { name: /the week before/i }));

    // Not recomputed here: one week's figures under another week's date is
    // exactly what a client-side guess would produce.
    await waitFor(() => {
      expect(calls.some((c) => c.key === 'GET /api/v1/workspace/dashboard?week=2026-09-14')).toBe(true);
    });
    expect(await screen.findByRole('button', { name: /the week after/i })).toBeEnabled();
  });
});

describe('what the week points at', () => {
  it('points the worst activity at the roadmap rather than at a future step', async () => {
    await renderDashboard();

    // It used to end on "the next step of the build", which is an IOU printed at
    // the moment somebody is most likely to act.
    expect(screen.getByText(/delegate is the move/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /put it on the roadmap/i }))
      .toHaveAttribute('href', '/app/handover');
  });

  it('asks for an answer when the worst thing is the one nobody has sorted', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        worst: { ...DASHBOARD.worst, value: null, quadrant: null },
      }),
    });

    expect(screen.getByRole('link', { name: /the matrix/i })).toHaveAttribute('href', '/app/matrix');
  });

  it('no longer carries the grid itself, which has a section of its own', async () => {
    await renderDashboard();

    expect(document.querySelector('.drip')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Delegate' })).not.toBeInTheDocument();
  });
});
