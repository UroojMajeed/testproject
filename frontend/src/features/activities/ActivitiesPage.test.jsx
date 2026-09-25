import { describe, it, expect } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ActivitiesPage from './ActivitiesPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, failure, signedInWorkspace } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';
import { formatDate } from '../../lib/formatters.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const ROWS = [
  { id: 'a1', name: 'Bookkeeping', value: null, valueSetAt: null, archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'a2', name: 'Invoicing', value: 'low', valueSetAt: '2026-09-24T00:00:00.000Z', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
  { id: 'a3', name: 'Sales calls', value: 'critical', valueSetAt: '2026-09-24T00:00:00.000Z', archived: false, createdAt: '2026-09-01T00:00:00.000Z' },
];

const LIST = 'GET /api/v1/workspace/activities';
const LIST_ALL = 'GET /api/v1/workspace/activities?includeArchived=true';

const renderPage = async (over = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace({
      [LIST]: success({ activities: ROWS }),
      [LIST_ALL]: success({
        activities: [...ROWS, {
          id: 'a4', name: 'Tidying the CRM', value: 'low', valueSetAt: '2026-09-24T00:00:00.000Z',
          archived: true, createdAt: '2026-09-01T00:00:00.000Z',
        }],
      }),
      'PATCH /api/v1/workspace/activities/a2': success({ activity: { ...ROWS[1], name: 'Invoicing and chasing' } }),
      'PUT /api/v1/workspace/activities/a1/value': success({ activity: { ...ROWS[0], value: 'important' } }),
      'DELETE /api/v1/workspace/activities/a2': { status: 204 },
      ...over,
    }),
  });
  const utils = await renderWithProviders(<ActivitiesPage />, { route: '/app/activities' });
  // Either the list or the failure notice — the error branch has no heading, by the
  // same convention the dashboard and the sort screen use.
  await screen.findByText(/your activities|please try again|could not load/i);
  return { ...utils, ...mock };
};

const row = (name) => screen.getByDisplayValue(name).closest('li');

describe('the activities list', () => {
  it('lists what keeps coming back', async () => {
    await renderPage();

    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByDisplayValue('Bookkeeping')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales calls')).toBeInTheDocument();
  });

  it('shows the answer each one already has', async () => {
    await renderPage();

    expect(within(row('Invoicing')).getByRole('combobox')).toHaveValue('low');
    expect(within(row('Sales calls')).getByRole('combobox')).toHaveValue('critical');
  });

  it('says when the answer was given, which the select cannot', async () => {
    await renderPage();

    // Value is meant to hold still, so an answer from eight months ago is worth a
    // second look. Compared against the formatter rather than a literal: the exact
    // wording is the reader's locale talking.
    const when = formatDate('2026-09-24T00:00:00.000Z');
    expect(within(row('Invoicing')).getByText(`Answered ${when}`)).toBeInTheDocument();
    expect(within(row('Bookkeeping')).getByText(/not answered yet/i)).toBeInTheDocument();
  });

  /**
   * The hole this page exists to fill. Before it, value could be set exactly once,
   * on a funnel screen only reachable while something was unanswered — so changing
   * your mind about an activity was impossible.
   */
  it('lets an answer be changed, which is the whole point of the page', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    await user.selectOptions(within(row('Bookkeeping')).getByRole('combobox'), 'important');

    await waitFor(() => {
      const [sent] = calls.filter((c) => c.key === 'PUT /api/v1/workspace/activities/a1/value');
      expect(sent?.body).toEqual({ value: 'important' });
    });
  });

  /**
   * The bug this test exists for. The sort screen's mutation invalidates nothing
   * on purpose — refetching between cards would reorder the deck under the
   * reader's hand — and reusing it here left the dashboard showing a matrix the
   * answer no longer matched.
   */
  it('invalidates the workspace, so nothing is left showing the old answer', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    const before = calls.filter((c) => c.key === LIST).length;

    await user.selectOptions(within(row('Bookkeeping')).getByRole('combobox'), 'important');

    // The list refetching is what is observable here: only mounted queries refetch,
    // and this page does not mount the dashboard. That the dashboard itself goes
    // and asks again is checked in the browser, where both screens exist.
    await waitFor(() => expect(calls.filter((c) => c.key === LIST).length).toBeGreaterThan(before));
  });

  /**
   * The bug this exists for cost every answer on the page.
   *
   * The audit screen and this one share a query key, so arriving from the audit
   * renders these rows from cache that predates the sort — every value null. The
   * real values land a moment later, and a local copy seeded once never picked
   * them up: every activity read as unanswered, on the one screen whose job is
   * showing the answers.
   */
  it('picks up answers that arrive on a later fetch, not just the first', async () => {
    const user = userEvent.setup();
    let served = 0;
    // Stale first — every value null, as the audit screen would have cached it —
    // then the truth.
    const stale = ROWS.map((r) => ({ ...r, value: null, valueSetAt: null }));
    await renderPage({
      [LIST]: () => {
        served += 1;
        return success({ activities: served === 1 ? stale : ROWS });
      },
    });

    expect(within(row('Sales calls')).getByRole('combobox')).toHaveValue('');

    // Any write invalidates the workspace, which is what makes the list refetch.
    await user.click(within(row('Invoicing')).getByRole('button', { name: /archive invoicing/i }));
    await user.click(within(row('Invoicing')).getByRole('button', { name: /yes, archive/i }));

    await waitFor(() => expect(within(row('Sales calls')).getByRole('combobox')).toHaveValue('critical'));
  });

  it('keeps the chosen answer on screen while the refetch is in flight', async () => {
    const user = userEvent.setup();
    await renderPage();

    const select = within(row('Bookkeeping')).getByRole('combobox');
    await user.selectOptions(select, 'important');

    // Controlled by the server's copy alone, the option would visibly snap back to
    // the old answer and then forward again, which reads as a failure.
    expect(select).toHaveValue('important');
  });

  it('offers no way to un-answer, because the API takes no such answer', async () => {
    await renderPage();

    // An option that always fails is worse than no option.
    const answered = within(row('Invoicing')).getByRole('combobox');
    expect(within(answered).queryByRole('option', { name: /not answered/i })).not.toBeInTheDocument();

    // The unanswered row still needs somewhere to start from.
    const blank = within(row('Bookkeeping')).getByRole('combobox');
    expect(within(blank).getByRole('option', { name: /not answered/i })).toBeDisabled();
  });

  it('renames on leaving the field, with no Edit button to find first', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    const field = within(row('Invoicing')).getByRole('textbox');
    await user.clear(field);
    await user.type(field, 'Invoicing and chasing');
    await user.tab();

    await waitFor(() => {
      const [sent] = calls.filter((c) => c.key === 'PATCH /api/v1/workspace/activities/a2');
      expect(sent?.body).toEqual({ name: 'Invoicing and chasing' });
    });
  });

  it('does not send a rename that changes nothing', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    // Every visit to the field and away again would otherwise be a PATCH, and the
    // server answers 409 for a name already taken — by this same row.
    await user.click(within(row('Invoicing')).getByRole('textbox'));
    await user.tab();

    expect(calls.filter((c) => c.key.startsWith('PATCH'))).toHaveLength(0);
  });

  it('puts the old name back when a rename is refused', async () => {
    const user = userEvent.setup();
    await renderPage({
      'PATCH /api/v1/workspace/activities/a2': failure(409, 'CONFLICT', 'You already have an activity with that name'),
    });

    const field = within(row('Invoicing')).getByRole('textbox');
    await user.clear(field);
    await user.type(field, 'Sales calls');
    await user.tab();

    expect(await screen.findByRole('alert')).toHaveTextContent(/already have an activity/i);
    // Leaving the rejected text in the box would suggest it had been saved.
    await waitFor(() => expect(field).toHaveValue('Invoicing'));
  });

  it('asks before archiving, in place rather than in a dialog', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    await user.click(within(row('Invoicing')).getByRole('button', { name: /archive invoicing/i }));

    expect(within(row('Invoicing')).getByText(/archive it\?/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.key.startsWith('DELETE'))).toHaveLength(0);

    await user.click(within(row('Invoicing')).getByRole('button', { name: /yes, archive/i }));

    await waitFor(() => expect(calls.filter((c) => c.key === 'DELETE /api/v1/workspace/activities/a2')).toHaveLength(1));
  });

  it('lets the question be taken back', async () => {
    const user = userEvent.setup();
    const { calls } = await renderPage();

    await user.click(within(row('Invoicing')).getByRole('button', { name: /archive invoicing/i }));
    await user.click(within(row('Invoicing')).getByRole('button', { name: /keep it/i }));

    expect(within(row('Invoicing')).getByRole('button', { name: /archive invoicing/i })).toBeInTheDocument();
    expect(calls.filter((c) => c.key.startsWith('DELETE'))).toHaveLength(0);
  });

  it('hides archived activities until they are asked for', async () => {
    const user = userEvent.setup();
    await renderPage();

    expect(screen.queryByDisplayValue('Tidying the CRM')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: /show the ones i have archived/i }));

    expect(await screen.findByDisplayValue('Tidying the CRM')).toBeInTheDocument();
  });

  it('says how an archived activity comes back, rather than looking deleted', async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole('checkbox', { name: /show the ones i have archived/i }));

    const archived = await screen.findByDisplayValue('Tidying the CRM');
    // Archived, never deleted: past weeks reference the row. Naming it in an audit
    // brings it back, and saying so is what stops Archive reading as Delete.
    expect(within(archived.closest('li')).getByText(/name it in an audit and it comes back/i)).toBeInTheDocument();
    expect(archived).toBeDisabled();
  });

  it('points anything unanswered at the screen that asks one at a time', async () => {
    await renderPage();

    expect(screen.getByText(/one activity has no answer yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /answer them one at a time/i })).toHaveAttribute('href', '/app/sort');
  });

  it('has something to say before a week has ever been recorded', async () => {
    await renderPage({ [LIST]: success({ activities: [] }) });

    expect(screen.getByRole('heading', { name: /nothing here yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /record a week/i })).toHaveAttribute('href', '/app/audit');
  });

  it('says so when the list cannot be loaded', async () => {
    await renderPage({ [LIST]: failure(500, 'INTERNAL', 'Something went wrong') });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
