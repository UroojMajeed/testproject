import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import DashboardPage from './DashboardPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, signedInWorkspace, DASHBOARD } from '../../test/fetchMock.js';
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
