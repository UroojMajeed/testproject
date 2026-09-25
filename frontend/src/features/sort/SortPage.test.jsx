import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
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
    }),
    ...over,
  });
  const utils = await renderWithProviders(ui, { route: '/app/sort' });
  // Either the deck or the failure notice — the error branch has no heading, by the
  // same convention the dashboard uses.
  await screen.findByText(/what matters\?|everything is sorted|please try again|could not load/i);
  return { ...utils, ...mock };
};

const answer = (label) => screen.getByRole('button', { name: new RegExp(label, 'i') });

describe('sorting what matters', () => {
  it('asks about one activity at a time, not all of them at once', async () => {
    await renderSort();

    expect(screen.getByText('Invoicing')).toBeInTheDocument();
    // A grid of twelve dropdowns turns a judgement into data entry. Only the card
    // in hand is on screen, which is the whole reason this screen exists at all.
    expect(screen.queryByText('Sales calls')).not.toBeInTheDocument();
    expect(screen.queryByText('Bookkeeping')).not.toBeInTheDocument();
  });

  it('asks what happens rather than what it is worth', async () => {
    await renderSort();

    // Almost nobody can price answering email, and a figure they guessed is noise
    // the entire matrix would then be built on.
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/if you stopped doing this for a month/i);
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('offers three answers, each with what it means', async () => {
    await renderSort();

    expect(answer('Revenue stops')).toBeInTheDocument();
    expect(answer('Something slips')).toBeInTheDocument();
    expect(answer('Not much, honestly')).toBeInTheDocument();
    expect(screen.getByText(/nobody outside would notice/i)).toBeInTheDocument();
  });

  it('says where in the deck the reader is', async () => {
    const user = userEvent.setup();
    await renderSort();

    expect(screen.getByText('1 of 3')).toBeInTheDocument();

    await user.click(answer('Not much, honestly'));

    expect(await screen.findByText('2 of 3')).toBeInTheDocument();
  });

  it('saves each answer as it is given, so giving up halfway keeps the answers', async () => {
    const user = userEvent.setup();
    const { calls } = await renderSort();

    await user.click(answer('Not much, honestly'));
    await screen.findByText('Sales calls');
    await user.click(answer('Revenue stops'));
    await screen.findByText('Bookkeeping');

    const saves = calls.filter((call) => call.key.startsWith('PUT /api/v1/workspace/activities/'));
    expect(saves).toHaveLength(2);
    expect(saves[0].key).toContain('/a1/value');
    expect(saves[0].body).toEqual({ value: 'low' });
    expect(saves[1].key).toContain('/a2/value');
    expect(saves[1].body).toEqual({ value: 'critical' });
  });

  it('does not refetch the deck between cards, which would reorder it mid-sort', async () => {
    const user = userEvent.setup();
    const { calls } = await renderSort();

    await user.click(answer('Not much, honestly'));
    await screen.findByText('Sales calls');

    const fetches = calls.filter((call) => call.key === 'GET /api/v1/workspace/activities/unsorted');
    expect(fetches).toHaveLength(1);
  });

  it('leaves for the dashboard once the last card is answered', async () => {
    const user = userEvent.setup();
    // Routed rather than rendered bare, because the thing under test is where it
    // goes: a sort that ends on its own screen is a dead end.
    await renderSort({}, (
      <Routes>
        <Route path="/app/sort" element={<SortPage />} />
        <Route path="/app" element={<h1>Your week</h1>} />
      </Routes>
    ));

    await user.click(answer('Not much, honestly'));
    await screen.findByText('Sales calls');
    await user.click(answer('Revenue stops'));
    await screen.findByText('Bookkeeping');
    await user.click(answer('Not much, honestly'));

    expect(await screen.findByRole('heading', { name: 'Your week' })).toBeInTheDocument();
  });

  it('offers a way out that says the answers are already safe', async () => {
    await renderSort();

    expect(screen.getByRole('button', { name: /finish later — answers so far are saved/i })).toBeInTheDocument();
  });

  it('says so when a save fails, and stays on the same card', async () => {
    const user = userEvent.setup();
    await renderSort({
      'PUT /api/v1/workspace/activities/a1/value': failure(500, 'INTERNAL', 'Something went wrong'),
    });

    await user.click(answer('Not much, honestly'));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    // Not advanced: the answer was not recorded, so re-asking is the honest thing.
    expect(screen.getByText('Invoicing')).toBeInTheDocument();
    expect(screen.getByText('1 of 3')).toBeInTheDocument();
  });

  it('has something to say to somebody who arrives with nothing left to sort', async () => {
    await renderSort({ 'GET /api/v1/workspace/activities/unsorted': success({ activities: [] }) });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/everything is sorted/i);
    expect(screen.getByRole('button', { name: /back to your week/i })).toBeInTheDocument();
  });

  it('says so when the deck cannot be loaded at all', async () => {
    await renderSort({
      'GET /api/v1/workspace/activities/unsorted': failure(500, 'INTERNAL', 'Something went wrong'),
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
