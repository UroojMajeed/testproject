import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import MatrixPage from './MatrixPage.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';
import { mockApi, success, failure, signedInWorkspace, DASHBOARD } from '../../test/fetchMock.js';
import { endpoints } from '../../lib/api/endpoints.js';

const SESSION = success({
  accessToken: 'fresh',
  user: { id: 'u1', name: 'Urooj Majeed', email: 'founder@example.com' },
});

const renderMatrix = async (over = {}) => {
  const mock = mockApi({
    [`POST ${endpoints.auth.refresh()}`]: SESSION,
    ...signedInWorkspace(over),
  });
  const utils = await renderWithProviders(<MatrixPage />, { route: '/app/matrix' });
  // The h1 or the failure notice — the error branch has no heading, by the same
  // convention every other screen uses.
  await waitFor(() => {
    expect(document.querySelector('h1, [role="alert"]')).toBeTruthy();
  });
  return { ...utils, ...mock };
};

describe('the matrix, on its own page', () => {
  it('draws all four quadrants, because a 2x2 missing a corner is not a 2x2', async () => {
    await renderMatrix();

    for (const name of ['Replace', 'Delegate', 'Produce', 'Invest']) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    // An empty quadrant is itself worth seeing — an empty Replace says something.
    expect(screen.getAllByText(/nothing here\./i).length).toBeGreaterThan(0);
  });

  it('labels the axes in the words the questions were asked in', async () => {
    await renderMatrix();

    expect(screen.getByText('Matters more')).toBeInTheDocument();
    expect(screen.getByText('Drains you')).toBeInTheDocument();
    expect(screen.getByText('Energises you')).toBeInTheDocument();
  });

  it('puts the two with something to do about them along the top', async () => {
    await renderMatrix();

    const titles = [...document.querySelectorAll('.drip__title')].map((el) => el.textContent);
    expect(titles).toEqual(['Replace', 'Produce', 'Delegate', 'Invest']);
  });

  it('prices each quadrant, which is what turns an observation into a decision', async () => {
    await renderMatrix();

    const delegate = screen.getByRole('heading', { name: 'Delegate' }).closest('article');
    // Invoicing: 4h a week at $15 → $3,000 over 50 weeks.
    expect(delegate).toHaveTextContent('4h');
    expect(delegate).toHaveTextContent('$3,000');
    expect(delegate).toHaveTextContent('Invoicing');
  });

  /**
   * The reason this page exists. On the week it was four blocks and a pair of
   * axes between a table and a verdict — something to scroll past. The idea it
   * carries is the one nobody arrives already knowing, and it never had room to
   * be explained.
   */
  it('explains how an activity gets placed, which the week had no room for', async () => {
    await renderMatrix();

    expect(screen.getByRole('heading', { name: /how an activity gets placed/i })).toBeInTheDocument();
    expect(screen.getByText(/answered every week, because it changes/i)).toBeInTheDocument();
    expect(screen.getByText(/answered once/i)).toBeInTheDocument();
  });

  it('names the distinction the whole thing exists for', async () => {
    await renderMatrix();

    // Delegate against Replace: both drain you and look identical on a timesheet.
    expect(screen.getByText(/delegate against replace/i)).toBeInTheDocument();
    expect(screen.getByText(/breaks the business if it goes to the wrong person/i)).toBeInTheDocument();
  });

  it('says what to do about each quadrant, not just what it is called', async () => {
    await renderMatrix();

    // Once each, in the glossary. Saying it in the cell too made every cell three
    // lines taller for words the reader had just read a moment earlier.
    expect(screen.getByText(/does not need to be somebody senior/i)).toBeInTheDocument();
    expect(screen.getByText(/needs a real person and a proper handover/i)).toBeInTheDocument();
  });

  it('points at the roadmap, which is built from the two that drain you', async () => {
    await renderMatrix();

    expect(screen.getByRole('link', { name: /handover roadmap/i })).toHaveAttribute('href', '/app/handover');
  });

  it('asks the question that fills it, above the grid', async () => {
    await renderMatrix({
      'GET /api/v1/workspace/activities/unsorted': success({
        activities: [{ id: 'a9', name: 'Bookkeeping', value: null, valueSetAt: null, archived: false, createdAt: '2026-09-01T00:00:00.000Z' }],
      }),
    });

    expect(await screen.findByText('Bookkeeping')).toBeInTheDocument();
    const needs = document.querySelector('.needs');
    const grid = document.querySelector('.drip, .notice');
    expect(needs.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('has something to say before a week has been recorded', async () => {
    await renderMatrix({
      'GET /api/v1/workspace/dashboard': success({ ...DASHBOARD, week: null, activities: [] }),
    });

    expect(screen.getByRole('heading', { name: /nothing to place yet/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /record a week/i })).toHaveAttribute('href', '/app/audit');
  });

  it('says so when it cannot be loaded', async () => {
    await renderMatrix({ 'GET /api/v1/workspace/dashboard': failure(500, 'INTERNAL', 'Something went wrong') });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });
});
