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

describe('what to do about it', () => {
  it('groups the activities into the quadrants that have anything in them', async () => {
    await renderDashboard();

    expect(screen.getByRole('heading', { name: /what to do about it/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delegate' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Produce' })).toBeInTheDocument();

    // An empty Replace block is a heading promising something and delivering an
    // empty list. Better to say nothing about a quadrant nothing landed in.
    expect(screen.queryByRole('heading', { name: 'Replace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Invest' })).not.toBeInTheDocument();
  });

  it('says what each quadrant means and what to do, not just its name', async () => {
    await renderDashboard();

    // "Delegate" is a word from a book. "Drains you, and the business would barely
    // notice" is the sentence somebody can act on without having read it.
    expect(screen.getByText(/drains you, and the business would barely notice/i)).toBeInTheDocument();
    expect(screen.getByText(/does not need to be somebody senior/i)).toBeInTheDocument();
  });

  it('prices each quadrant, which is what turns an observation into a decision', async () => {
    await renderDashboard();

    const delegate = screen.getByRole('heading', { name: 'Delegate' }).closest('article');

    // Invoicing: 4h a week at $15 → $60 a week, $3,000 over 50 weeks.
    expect(delegate).toHaveTextContent('4h');
    expect(delegate).toHaveTextContent('$3,000');
    expect(delegate).toHaveTextContent('Invoicing');
  });

  it('orders a quadrant by value first, then by cost', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        matrix: {
          ...DASHBOARD.matrix,
          delegate: {
            // As the server sends it: critical before low, though low costs more.
            activities: [
              { activityId: 'a3', name: 'Client onboarding', estimatedMinutes: 60, energy: -1, averageEnergy: -1, value: 'critical', quadrant: 'delegate', estimatedWeeklyCostMinor: 1500, estimatedAnnualCostMinor: 75000 },
              { activityId: 'a1', name: 'Invoicing', estimatedMinutes: 240, energy: -2, averageEnergy: -2, value: 'low', quadrant: 'delegate', estimatedWeeklyCostMinor: 6000, estimatedAnnualCostMinor: 300000 },
            ],
            count: 2, estimatedMinutes: 300, estimatedWeeklyCostMinor: 7500, estimatedAnnualCostMinor: 375000,
          },
        },
      }),
    });

    const names = [...screen.getByRole('heading', { name: 'Delegate' }).closest('article')
      .querySelectorAll('.quadrant__name')].map((el) => el.textContent);

    expect(names).toEqual(['Client onboarding', 'Invoicing']);
  });

  it('leads with Replace and Delegate, the two with something to do about them', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        matrix: {
          ...DASHBOARD.matrix,
          replace: { ...DASHBOARD.matrix.delegate },
        },
      }),
    });

    const titles = [...document.querySelectorAll('.quadrant__title')].map((el) => el.textContent);

    expect(titles).toEqual(['Replace', 'Delegate', 'Produce']);
  });

  it('asks for a sort rather than showing an empty diagram', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        activities: DASHBOARD.activities.map((row) => ({ ...row, value: null, quadrant: null })),
        matrix: Object.fromEntries(Object.keys(DASHBOARD.matrix).map((name) => [name, {
          activities: [], count: 0, estimatedMinutes: 0,
          estimatedWeeklyCostMinor: 0, estimatedAnnualCostMinor: 0,
        }])),
        unsortedCount: 2,
      }),
    });

    expect(screen.getByRole('heading', { name: /nothing sorted yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sort your activities/i })).toHaveAttribute('href', '/app/sort');
    // The figures are still there. The matrix is the extra, not the price of entry.
    expect(screen.getByText('$6,750')).toBeInTheDocument();
  });

  it('admits when the picture is partial rather than quietly dropping activities', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({ ...DASHBOARD, unsortedCount: 2 }),
    });

    expect(screen.getByText(/2 activities have no answer yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sort them/i })).toHaveAttribute('href', '/app/sort');
  });

  it('counts one properly, because "1 activities" is how software sounds', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({ ...DASHBOARD, unsortedCount: 1 }),
    });

    expect(screen.getByText(/one activity has no answer yet/i)).toBeInTheDocument();
  });

  it('the verdict agrees with the matrix rather than promising it', async () => {
    await renderDashboard();

    // The worst activity is already sorted, so the matrix has named the move. The
    // line under the verdict has to point past it, not back at it.
    expect(screen.getByText(/delegate is the move/i)).toBeInTheDocument();
    expect(screen.getByText(/who takes it on, and what that costs/i)).toBeInTheDocument();
  });

  it('asks for an answer when the worst thing is the one nobody has sorted', async () => {
    await renderDashboard({
      'GET /api/v1/workspace/dashboard': success({
        ...DASHBOARD,
        worst: { ...DASHBOARD.worst, value: null, quadrant: null },
      }),
    });

    expect(screen.getByText(/answer one question about it/i)).toBeInTheDocument();
  });

  it('stays quiet about gaps when there are none', async () => {
    await renderDashboard();

    expect(screen.queryByText(/no answer yet/i)).not.toBeInTheDocument();
  });
});
