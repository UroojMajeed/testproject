import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import RatePage from './RatePage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, signedInWorkspace } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const SAVED_RATE = {
  id: 'r1', rateMinorPerHour: 1500, currency: 'USD',
  annualIncomeMinor: 12_000_000, hoursPerWeek: 40, weeksPerYear: 50,
  formulaVersion: 1, effectiveFrom: '2026-09-24T00:00:00.000Z',
};

/** A rate already set, for the case where the form is an edit rather than a setup. */
const EXISTING = { ...SAVED_RATE, hoursPerWeek: 40 };

const renderRate = async (over = {}, ui = <RatePage />) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace({ 'GET /api/v1/workspace/rate': success({ rate: null }) }),
    'PUT /api/v1/workspace/rate': success({ rate: SAVED_RATE }, 201),
    ...over,
  });
  const utils = await renderWithProviders(ui, { route: '/app/rate' });
  await screen.findByRole('heading', { level: 1 });
  return { ...utils, ...mock };
};

const fill = async (user, { income = '120000', hours = '40', weeks = '50' } = {}) => {
  const incomeField = screen.getByLabelText(/what you earn in a year/i);
  const hoursField = screen.getByLabelText(/hours you work in a week/i);
  const weeksField = screen.getByLabelText(/weeks you work in a year/i);

  await user.clear(incomeField); await user.type(incomeField, income);
  await user.clear(hoursField); await user.type(hoursField, hours);
  await user.clear(weeksField); await user.type(weeksField, weeks);
};

describe('setting the buyback rate', () => {
  it('asks for three numbers and says why they matter', async () => {
    await renderRate();

    expect(screen.getByLabelText(/what you earn in a year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/hours you work in a week/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weeks you work in a year/i)).toBeInTheDocument();
    expect(screen.getByText(/an honest guess beats a flattering one/i)).toBeInTheDocument();
  });

  it('warns against counting hours you do not work', async () => {
    await renderRate();

    // The two ways people inflate the figure without noticing.
    expect(screen.getByText(/not what is in your contract/i)).toBeInTheDocument();
    expect(screen.getByText(/counting weeks you do not work would flatter/i)).toBeInTheDocument();
  });

  it('shows the arithmetic as it is typed', async () => {
    const user = userEvent.setup();
    await renderRate();

    await fill(user);

    // $120,000 over 2,000 hours is $60 an hour; a quarter of that is $15. Watching
    // it move is what makes the number theirs rather than ours.
    expect(await screen.findByText('$60')).toBeInTheDocument();
    expect(screen.getByText('$15')).toBeInTheDocument();
  });

  it('sends the income as integer minor units', async () => {
    const user = userEvent.setup();
    const { calls } = await renderRate();

    await fill(user, { income: '120000' });
    await user.click(screen.getByRole('button', { name: /set my rate/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    const sent = calls.find((c) => c.key.startsWith('PUT')).body;

    // Money never crosses the wire as a float.
    expect(sent.annualIncomeMinor).toBe(12_000_000);
    expect(Number.isInteger(sent.annualIncomeMinor)).toBe(true);
  });

  it('calls the figure a planning estimate beside the figure itself', async () => {
    const user = userEvent.setup();
    await renderRate();

    await fill(user);

    // It used to say this on a confirmation screen of its own, after the number
    // was already set. It belongs where the number is being decided — and never a
    // wage, never a valuation, because someone who reads it as either will make
    // bad decisions with it.
    expect(await screen.findByText(/a planning estimate, not a wage/i)).toBeInTheDocument();
    expect(screen.getByText(/buying an hour back stops making sense/i)).toBeInTheDocument();
  });

  /**
   * Saving used to hand over a whole screen repeating the figure the form had been
   * showing live as it was typed, then asked for one more click to carry on. In
   * the middle of a three-step setup that is a ceremony for a number nobody had
   * stopped looking at.
   */
  it('goes straight on to the audit the first time, with no screen in between', async () => {
    const user = userEvent.setup();
    await renderRate({}, (
      <Routes>
        <Route path="/app/rate" element={<RatePage />} />
        <Route path="/app/audit" element={<h1>Where did last week go?</h1>} />
      </Routes>
    ));

    await fill(user);
    await user.click(screen.getByRole('button', { name: /set my rate/i }));

    expect(await screen.findByRole('heading', { name: /where did last week go/i })).toBeInTheDocument();
  });

  it('confirms in place when an existing rate is changed, rather than moving on', async () => {
    const user = userEvent.setup();
    // Somebody adjusting their hours later is not in a setup flow and did not ask
    // to go anywhere; they want to know it took.
    await renderRate({ 'GET /api/v1/workspace/rate': success({ rate: EXISTING }) });

    await user.clear(screen.getByLabelText(/hours you work in a week/i));
    await user.type(screen.getByLabelText(/hours you work in a week/i), '30');
    await user.click(screen.getByRole('button', { name: /update my rate/i }));

    // role="status", not "alert": saving successfully is not urgent, and an
    // assertive announcement would interrupt whatever is being read.
    expect(await screen.findByRole('status')).toHaveTextContent(/saved\. your buyback rate is/i);
    expect(screen.getByRole('button', { name: /update my rate/i })).toBeInTheDocument();
  });

  it.each([
    ['no income', { income: '0' }],
    ['no hours', { hours: '0' }],
    ['more weeks than a year holds', { weeks: '60' }],
  ])('catches %s before calling the API', async (_label, over) => {
    const user = userEvent.setup();
    const { calls } = await renderRate();

    await fill(user, over);
    await user.click(screen.getByRole('button', { name: /set my rate/i }));

    await waitFor(() => expect(screen.getByRole('main')).toBeInTheDocument());
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false);
  });

  it('pre-fills from the rate already set, so changing it is an edit', async () => {
    await renderRate({
      'GET /api/v1/workspace/rate': success({ rate: SAVED_RATE }),
    });

    await waitFor(() => expect(screen.getByLabelText(/what you earn in a year/i)).toHaveValue(120000));
    expect(screen.getByRole('button', { name: /update my rate/i })).toBeInTheDocument();
  });

  it('never shows an empty form while the existing rate is still loading', async () => {
    // A blank income box on the way to a filled one reads as "we have lost your
    // details", and the fields are only populated once the query lands.
    mockApi({
      [`POST ${endpoints.auth.refresh()}`]: SESSION,
      ...signedInWorkspace({ 'GET /api/v1/workspace/rate': () => new Promise(() => {}) }),
    });
    await renderWithProviders(<RatePage />, { route: '/app/rate' });

    expect(screen.getByRole('status')).toHaveTextContent(/loading your rate/i);
    expect(screen.queryByLabelText(/what you earn in a year/i)).not.toBeInTheDocument();
  });
});

describe('the number inputs', () => {
  /**
   * Reported from the real app: the hours spinner walked past zero into negative
   * numbers. The schema rejected it on submit, but a control that offers a value
   * the form will refuse is the screen arguing with itself.
   */
  it('will not let a spinner walk below the minimum', async () => {
    await renderRate();

    expect(screen.getByLabelText(/hours you work in a week/i)).toHaveAttribute('min', '1');
    expect(screen.getByLabelText(/weeks you work in a year/i)).toHaveAttribute('min', '1');
    expect(screen.getByLabelText(/what you earn in a year/i)).toHaveAttribute('min', '0');
  });

  it('stops the spinner at the ceiling the schema enforces', async () => {
    await renderRate();

    // 168 hours in a week and 52 weeks in a year, same numbers the server checks.
    expect(screen.getByLabelText(/hours you work in a week/i)).toHaveAttribute('max', '168');
    expect(screen.getByLabelText(/weeks you work in a year/i)).toHaveAttribute('max', '52');
  });

  it('steps hours and weeks in whole numbers, since fractions are rejected', async () => {
    await renderRate();

    expect(screen.getByLabelText(/hours you work in a week/i)).toHaveAttribute('step', '1');
    expect(screen.getByLabelText(/weeks you work in a year/i)).toHaveAttribute('step', '1');
  });
});
