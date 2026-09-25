import { paths } from './paths.js';

/**
 * The sections of the app, in the order they appear in the frame.
 *
 * Data rather than markup, because this list is the thing that grows: each step we
 * build adds a line here and nothing else. Only sections that exist are listed —
 * a nav item that goes nowhere is a promise the app cannot keep, and the one
 * decision here we would regret.
 *
 * `end` marks a path that must match exactly. Without it "/app" would light up on
 * every page beneath it, since every one of them starts with those four
 * characters.
 */
export const NAV = Object.freeze([
  {
    to: paths.app,
    end: true,
    label: 'Your week',
    hint: 'What last week cost, and what to do about it',
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: paths.audit,
    label: 'This week',
    hint: 'Record the hours and how they felt',
    icon: (
      <>
        <path d="M5 3.5h14a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5Z" />
        <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: paths.activities,
    label: 'Activities',
    hint: 'The things that keep coming back, and what each is worth',
    icon: (
      <>
        <path d="M9.5 6.5h11M9.5 12h11M9.5 17.5h11" strokeLinecap="round" />
        <path d="M3.5 6.3 4.6 7.4 6.8 5.2M3.5 11.8 4.6 12.9 6.8 10.7M3.5 17.3 4.6 18.4 6.8 16.2" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
  },
  {
    to: paths.rate,
    label: 'Your rate',
    hint: 'The planning estimate everything is priced at',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v10M14.5 9.5c0-1.1-1.1-2-2.5-2s-2.5.9-2.5 2 1.1 2 2.5 2 2.5.9 2.5 2-1.1 2-2.5 2-2.5-.9-2.5-2" strokeLinecap="round" />
      </>
    ),
  },
]);
