import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { OnboardingGate } from './OnboardingGate.jsx';
import { renderWithProviders } from '../test/renderWithProviders.jsx';
import { mockApi, success } from '../test/fetchMock.js';
import { endpoints } from '../lib/api/endpoints.js';
import { paths } from './paths.js';

const SESSION = success({ accessToken: 't', user: { id: 'u1', name: 'Urooj Majeed' } });

const Tree = () => (
  <Routes>
    <Route element={<OnboardingGate />}>
      <Route path={paths.app} element={<h1>Dashboard</h1>} />
      <Route path={paths.rate} element={<h1>Rate</h1>} />
      <Route path={paths.audit} element={<h1>Audit</h1>} />
    </Route>
  </Routes>
);

const renderAt = async (route, state) => {
  mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    'GET /api/v1/workspace/state': success({ weekStarting: '2026-09-21', completedAudits: 0, ...state }),
  });
  return renderWithProviders(<Tree />, { route });
};

const landsOn = async () => (await screen.findByRole('heading', { level: 1 })).textContent;

describe('where a signed-in person belongs', () => {
  it('sends a new account to the rate', async () => {
    await renderAt(paths.app, { needsRate: true, needsFirstAudit: true });
    expect(await landsOn()).toBe('Rate');
  });

  it('sends them to the audit once the rate is set', async () => {
    await renderAt(paths.app, { needsRate: false, needsFirstAudit: true });
    expect(await landsOn()).toBe('Audit');
  });

  it('opens the dashboard once a week is filed', async () => {
    await renderAt(paths.app, { needsRate: false, needsFirstAudit: false, completedAudits: 1 });
    expect(await landsOn()).toBe('Dashboard');
  });

  /**
   * The bug this exists for. Saving the rate invalidates /state, needsFirstAudit
   * flips true, and a gate that allowed only the single "wanted" page redirected
   * away mid-render — so the screen explaining that the rate is a planning
   * estimate, not a wage, was never seen by anybody.
   */
  it('lets someone stay on the rate screen after setting it', async () => {
    await renderAt(paths.rate, { needsRate: false, needsFirstAudit: true });
    expect(await landsOn()).toBe('Rate');
  });

  it('still keeps them off the dashboard until a week is filed', async () => {
    await renderAt(paths.app, { needsRate: false, needsFirstAudit: true });
    expect(await landsOn()).toBe('Audit');
  });

  it('will not let the audit be reached before the rate exists', async () => {
    // Pricing a week needs a rate; the audit would be data with nothing to value it.
    await renderAt(paths.audit, { needsRate: true, needsFirstAudit: true });
    expect(await landsOn()).toBe('Rate');
  });
});
