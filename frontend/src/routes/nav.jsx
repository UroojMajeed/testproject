import { paths } from './paths.js';

/**
 * The sections of the app, in the order they appear in the frame.
 *
 * Data rather than markup, because this list is the thing that grows: each step
 * we build adds a line here and nothing else. Only sections that exist are
 * listed — a nav item that goes nowhere is a promise the app cannot keep.
 *
 * Four, deliberately. Recording a week is something you do *to* a week, so it is
 * a button on the week rather than a destination beside it; and the activities
 * list is reached from there too. A sidebar is for the places you go, not for
 * every page that exists.
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
    hint: 'What the week cost, and what still needs an answer',
    icon: (
      <>
        <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
        <path d="M3 9.5h18M8 2.5v4M16 2.5v4" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: paths.matrix,
    label: 'The matrix',
    hint: 'Every activity placed by what it costs you and what it is worth',
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2.5" />
        <path d="M12 3v18M3 12h18" strokeLinecap="round" />
      </>
    ),
  },
  {
    to: paths.handover,
    label: 'Handover roadmap',
    hint: 'What to stop doing, in the order worth doing it',
    icon: (
      <>
        <path d="M5 20V8.5M5 8.5 8.5 5M5 8.5 1.5 5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 7h10M10 12h7M10 17h4" strokeLinecap="round" />
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
