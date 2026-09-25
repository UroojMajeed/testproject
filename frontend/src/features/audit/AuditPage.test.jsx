import { describe, it, expect } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuditPage from './AuditPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, signedInWorkspace } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';
import { formatWeekRange } from '../../lib/money.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const WEEK = {
  id: 'w1', weekStarting: '2026-09-21', weekEnding: '2026-09-27',
  timezone: 'Asia/Karachi', status: 'draft', isTypical: true, completedAt: null,
  entries: [], totalEstimatedMinutes: 0,
};

const renderAudit = async (over = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace(),
    'GET /api/v1/workspace/audits/current': success({ week: WEEK, suggestions: [], isNew: true }),
    'PUT /api/v1/workspace/audits/2026-09-21': success({ week: { ...WEEK, status: 'complete' } }),
    ...over,
  });
  const utils = await renderWithProviders(<AuditPage />, { route: '/app/audit' });
  await screen.findByRole('heading', { level: 1 });
  return { ...utils, ...mock };
};

const firstRow = () => screen.getAllByRole('listitem')[0];

describe('recalling last week', () => {
  it('names the week it is asking about', async () => {
    await renderAudit();

    // "Last week" is far more answerable than "a typical week" — but only if the
    // screen says which week it means. Compared against the formatter rather than
    // a literal: the exact wording is the reader's locale talking.
    const range = formatWeekRange('2026-09-21', '2026-09-27');
    expect(range).toMatch(/21/);
    expect(range).toMatch(/27/);
    // Intl separates a range with thin spaces around the dash, which is the right
    // typography and not what testing-library's normalised text will contain — so
    // compare whitespace-insensitively rather than weakening the assertion.
    const pattern = range
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\s+/g, '\\s+');
    expect(screen.getByText(new RegExp(pattern))).toBeInTheDocument();
  });

  it('says rough hours are fine', async () => {
    await renderAudit();

    expect(screen.getByText(/recall, not a timesheet/i)).toBeInTheDocument();
  });

  it('starts with one box, not a stack of identical empty ones', async () => {
    await renderAudit();

    // Three empty cards is a form to be filled in; one is a question to answer.
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });

  it('opens the next box as soon as one is named, with no button to reach for', async () => {
    const user = userEvent.setup();
    await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(within(screen.getAllByRole('listitem')[1]).getByRole('textbox')).toHaveValue('');
  });

  it('keeps exactly one empty box at the end, not one per keystroke', async () => {
    const user = userEvent.setup();
    await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.type(within(screen.getAllByRole('listitem')[1]).getByRole('textbox'), 'Email');

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
  });

  it('offers no Remove on a box with nothing in it', async () => {
    const user = userEvent.setup();
    await renderAudit();

    // Remove on an empty box offers to delete nothing, and the trailing box is
    // always empty — so every list used to end with a dead action.
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');

    expect(await screen.findByRole('button', { name: /remove invoicing/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /remove/i })).toHaveLength(1);
  });

  it('never leaves the list with nothing to type into', async () => {
    const user = userEvent.setup();
    await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.click(await screen.findByRole('button', { name: /remove invoicing/i }));

    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(1);
    expect(within(firstRow()).getByRole('textbox')).toHaveValue('');
  });

  it('asks how it felt only once there is an activity to ask about', async () => {
    const user = userEvent.setup();
    await renderAudit();

    // Five radios beside an empty box is noise; they appear when they mean something.
    expect(screen.queryByText('Drains me')).not.toBeInTheDocument();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');

    expect(await screen.findByText('Drains me')).toBeInTheDocument();
  });

  it('adds up the hours as they are typed', async () => {
    const user = userEvent.setup();
    await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.type(within(firstRow()).getByRole('spinbutton'), '4');
    // The second box appears because the first was named, not because a button
    // was pressed.
    const second = screen.getAllByRole('listitem')[1];
    await user.type(within(second).getByRole('textbox'), 'Email');
    await user.type(within(second).getByRole('spinbutton'), '2.5');

    expect(await screen.findByText('6h 30m')).toBeInTheDocument();
  });

  it('says a filed week is filed, rather than asking to finish it again', async () => {
    await renderAudit({
      'GET /api/v1/workspace/audits/current': success({
        week: {
          ...WEEK,
          status: 'complete',
          completedAt: '2026-09-25T10:00:00.000Z',
          entries: [{ activityId: 'a1', estimatedMinutes: 240, energy: -2 }],
          totalEstimatedMinutes: 240,
        },
        suggestions: [],
        isNew: false,
      }),
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/this week is filed/i);
    expect(screen.getByRole('button', { name: /save the changes/i })).toBeInTheDocument();
    // There is nothing to come back to: it is already saved.
    expect(screen.queryByRole('button', { name: /come back to it/i })).not.toBeInTheDocument();
  });

  it('sends hours as whole minutes, because that is what the API stores', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.type(within(firstRow()).getByRole('spinbutton'), '2.5');
    await user.click(await screen.findByRole('radio', { name: /drains me/i }));
    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    const sent = calls.find((c) => c.key.startsWith('PUT')).body;

    expect(sent.entries[0]).toMatchObject({ activityName: 'Invoicing', estimatedMinutes: 150, energy: -2 });
    expect(Number.isInteger(sent.entries[0].estimatedMinutes)).toBe(true);
  });

  it('will not finish a week with nothing in it', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit();

    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    expect(await screen.findByText(/add at least one activity/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false);
  });

  it('will not finish while an activity has no answer about how it felt', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.type(within(firstRow()).getByRole('spinbutton'), '4');
    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    // Hours without the feeling gives a cost with no way to rank it, which is half
    // the point of asking.
    expect(await screen.findByText(/say how one activity felt/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(false);
  });

  it('saves a draft without demanding every answer', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit({
      'PUT /api/v1/workspace/audits/2026-09-21': success({ week: WEEK }),
    });

    await user.type(within(firstRow()).getByRole('textbox'), 'Invoicing');
    await user.type(within(firstRow()).getByRole('spinbutton'), '4');
    await user.click(screen.getByRole('button', { name: /save and come back/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    expect(calls.find((c) => c.key.startsWith('PUT')).body.status).toBe('draft');
  });

  it('lets the week be marked unusual', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit();

    await user.type(within(firstRow()).getByRole('textbox'), 'Firefighting');
    await user.type(within(firstRow()).getByRole('spinbutton'), '40');
    await user.click(await screen.findByRole('radio', { name: /drains me/i }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    expect(calls.find((c) => c.key.startsWith('PUT')).body.isTypical).toBe(false);
  });
});

describe('the second week', () => {
  const withSuggestions = {
    'GET /api/v1/workspace/audits/current': success({
      week: WEEK,
      suggestions: [
        { activityId: 'a1', estimatedMinutes: 240 },
        { activityId: 'a2', estimatedMinutes: 300 },
      ],
      isNew: true,
    }),
  };

  it('arrives pre-filled with last week’s activities and hours', async () => {
    await renderAudit(withSuggestions);

    // This is the difference between a weekly habit and something people abandon:
    // week one takes ten minutes, week two should take two.
    expect(screen.getByDisplayValue('Invoicing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Sales calls')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4')).toBeInTheDocument();
  });

  it('does not pre-fill how it felt', async () => {
    await renderAudit(withSuggestions);

    // The thing most likely to have changed, and a pre-filled answer is one nobody
    // re-reads.
    for (const radio of screen.getAllByRole('radio')) expect(radio).not.toBeChecked();
  });

  it('sends the activity id for a suggested row rather than its name', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit(withSuggestions);

    await user.click(screen.getAllByRole('radio', { name: /drains me/i })[0]);
    await user.click(screen.getAllByRole('radio', { name: /energises me/i })[1]);
    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    const sent = calls.find((c) => c.key.startsWith('PUT')).body;

    // Sending the name instead would create a second activity with the same label
    // and split the trend the product exists to show.
    expect(sent.entries[0]).toHaveProperty('activityId', 'a1');
    expect(sent.entries[0]).not.toHaveProperty('activityName');
  });

  it('treats a renamed suggestion as a new activity', async () => {
    const user = userEvent.setup();
    const { calls } = await renderAudit(withSuggestions);

    const invoicing = screen.getByDisplayValue('Invoicing');
    await user.clear(invoicing);
    await user.type(invoicing, 'Bookkeeping');
    await user.click(screen.getAllByRole('radio', { name: /drains me/i })[0]);
    await user.click(screen.getAllByRole('radio', { name: /energises me/i })[1]);
    await user.click(screen.getByRole('button', { name: /finish the week/i }));

    await waitFor(() => expect(calls.some((c) => c.key.startsWith('PUT'))).toBe(true));
    const sent = calls.find((c) => c.key.startsWith('PUT')).body;

    // Keeping the id would silently retitle last week's history as well.
    expect(sent.entries[0]).toHaveProperty('activityName', 'Bookkeeping');
    expect(sent.entries[0]).not.toHaveProperty('activityId');
  });
});
