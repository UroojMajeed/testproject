import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import SortPage from './SortPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, failure, signedInWorkspace } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const unsorted = (...names) => names.map((name, i) => ({
  id: `a${i + 1}`, name, value: null, valueSetAt: null, archived: false,
  createdAt: '2026-09-01T00:00:00.000Z',
}));

const THREE = unsorted('Invoicing', 'Sales calls', 'Bookkeeping');

const renderSort = async (over = {}, ui = <SortPage />) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace({
      'GET /api/v1/workspace/activities/unsorted': success({ activities: THREE }),
      'PUT /api/v1/workspace/activities/a1/value': success({ activity: { ...THREE[0], value: 'low' } }),
      'PUT /api/v1/workspace/activities/a2/value': success({ activity: { ...THREE[1], value: 'critical' } }),
      'PUT /api/v1/workspace/activities/a3/value': success({ activity: { ...THREE[2], value: 'low' } }),
      ...over,
    }),
  });
  const utils = await renderWithProviders(ui, { route: '/app/sort' });
  await screen.findByText(/one more question each|everything is sorted|please try again|could not load/i);
  return { ...utils, ...mock };
};

const row = (name) => screen.getByText(name).closest('li');

describe('sorting what matters', () => {
  /**
   * This screen was a deck of cards, one at a time, and it arrives straight after
   * the audit — so somebody had just finished a form and was then made to click
   * through five more screens before being allowed to see the figures they came
   * for. Seeing the whole list turns a gauntlet back into a list.
   */
  it('shows every activity at once, not one screen each', async () => {
    await renderSort();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    for (const name of ['Invoicing', 'Sales calls', 'Bookkeeping']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('asks what happens rather than what it is worth', async () => {
    await renderSort();

    // Almost nobody can price answering email, and a figure they guessed is noise
    // the whole matrix would then be built on.
    expect(screen.getByText(/if you stopped doing it for a month, what happens/i)).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('offers the same three answers on every row', async () => {
    await renderSort();

    for (const label of ['Revenue stops', 'Something slips', 'Not much, honestly']) {
      expect(within(row('Invoicing')).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('says how much is left, so the end is in sight', async () => {
    const user = userEvent.setup();
    await renderSort();

    expect(screen.getByText('0 of 3 answered')).toBeInTheDocument();

    await user.click(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }));

    expect(await screen.findByText('1 of 3 answered')).toBeInTheDocument();
  });

  it('saves each answer as it is given, so leaving halfway keeps them', async () => {
    const user = userEvent.setup();
    const { calls } = await renderSort();

    await user.click(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }));
    await user.click(within(row('Sales calls')).getByRole('button', { name: 'Revenue stops' }));

    await waitFor(() => {
      const saves = calls.filter((c) => c.key.startsWith('PUT /api/v1/workspace/activities/'));
      expect(saves).toHaveLength(2);
      expect(saves[0].body).toEqual({ value: 'low' });
      expect(saves[1].body).toEqual({ value: 'critical' });
    });
  });

  it('marks the answer that was chosen, on the row it belongs to', async () => {
    const user = userEvent.setup();
    await renderSort();

    await user.click(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }));

    expect(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }))
      .toHaveAttribute('aria-pressed', 'true');
    // And nowhere else: one click must not answer three activities.
    expect(within(row('Sales calls')).getByRole('button', { name: 'Not much, honestly' }))
      .toHaveAttribute('aria-pressed', 'false');
  });

  it('does not refetch the list between answers, which would move rows mid-question', async () => {
    const user = userEvent.setup();
    const { calls } = await renderSort();

    await user.click(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }));

    const fetches = calls.filter((c) => c.key === 'GET /api/v1/workspace/activities/unsorted');
    expect(fetches).toHaveLength(1);
  });

  it('changes what the button offers once everything has an answer', async () => {
    const user = userEvent.setup();
    await renderSort();

    expect(screen.getByRole('button', { name: /done for now/i })).toBeInTheDocument();

    for (const name of ['Invoicing', 'Sales calls', 'Bookkeeping']) {
      await user.click(within(row(name)).getByRole('button', { name: 'Not much, honestly' }));
    }

    expect(await screen.findByRole('button', { name: /see what it costs/i })).toBeInTheDocument();
  });

  it('leaves for the dashboard whether or not everything was answered', async () => {
    const user = userEvent.setup();
    await renderSort({}, (
      <Routes>
        <Route path="/app/sort" element={<SortPage />} />
        <Route path="/app" element={<h1>Your week</h1>} />
      </Routes>
    ));

    await user.click(screen.getByRole('button', { name: /done for now/i }));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
  });

  it('says answers are safe, so leaving early does not feel like losing them', async () => {
    await renderSort();

    expect(screen.getByText(/saved as you give them/i)).toBeInTheDocument();
  });

  it('takes the answer back when a save fails, rather than showing one that is not stored', async () => {
    const user = userEvent.setup();
    await renderSort({
      'PUT /api/v1/workspace/activities/a1/value': failure(500, 'INTERNAL', 'Something went wrong'),
    });

    await user.click(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await waitFor(() => {
      expect(within(row('Invoicing')).getByRole('button', { name: 'Not much, honestly' }))
        .toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByText('0 of 3 answered')).toBeInTheDocument();
  });

  it('has something to say to somebody with nothing left to sort', async () => {
    await renderSort({ 'GET /api/v1/workspace/activities/unsorted': success({ activities: [] }) });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/everything is sorted/i);
    expect(screen.getByRole('button', { name: /back to your week/i })).toBeInTheDocument();
  });

  it('says so when the list cannot be loaded at all', async () => {
    await renderSort({
      'GET /api/v1/workspace/activities/unsorted': failure(500, 'INTERNAL', 'Something went wrong'),
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
