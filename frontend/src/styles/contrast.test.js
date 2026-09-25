// @vitest-environment node
// No DOM needed, and a node environment gives import.meta.url as a real file URL.
import { describe, it, expect } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

/**
 * The palette, measured rather than admired — in both themes.
 *
 * This compiles the real token file and reads the values that ship, so it cannot
 * drift from the stylesheet. Nudge a token one step lighter because it looks nicer
 * and this fails, which is the entire reason it exists: every "accessible" palette
 * starts accessible.
 *
 * Thresholds are WCAG 2.1 AA — 4.5:1 for body text, 3:1 for a non-text element such
 * as an input border or a focus ring (1.4.11).
 *
 * What this cannot see is which CSS rule finally wins on a real element; that took
 * a browser to catch once already, and lives in e2e/accessibility.spec.js.
 */

const here = dirname(fileURLToPath(import.meta.url));

const compiled = sass.compile(join(here, '_tokens.scss'), {
  loadPaths: [join(here, '..', '..', 'node_modules')],
}).css;

/**
 * Pulls the custom properties out of one rule, by the selector that declares it.
 *
 * Quotes are stripped before comparing: Sass emits `[data-theme=dark]` for the
 * `[data-theme='dark']` in the source, and pinning the test to one of those spellings
 * would make a compiler detail look like a palette failure.
 */
const normalise = (selector) => selector.replace(/["']/g, '').replace(/\s+/g, ' ').trim();

function tokensFor(selector) {
  const rule = [...compiled.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .find(([, sel]) => sel.split(',').some((s) => normalise(s) === normalise(selector)));

  if (!rule) throw new Error(`no rule found for "${selector}" — did the token file move?`);

  return Object.fromEntries(
    [...rule[2].matchAll(/(--[a-z-]+):\s*(#[0-9a-f]{3,8})/gi)].map(([, name, hex]) => [name, hex]),
  );
}

const THEMES = {
  light: tokensFor(':root'),
  dark: tokensFor(":root[data-theme='dark']"),
};

const channels = (hex) => hex.slice(1).match(/../g).map((pair) => parseInt(pair, 16) / 255);
const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text that must be legible, and on which surfaces. Every background the app can
 * put a given foreground on is listed, because "it passes on white" is not an
 * answer when the element sits on the canvas.
 */
const TEXT_PAIRS = [
  ['--fg-default', '--bg-canvas'], ['--fg-default', '--bg-surface'],
  ['--fg-default', '--bg-raised'], ['--fg-default', '--bg-sunken'],
  ['--fg-muted', '--bg-canvas'], ['--fg-muted', '--bg-surface'], ['--fg-muted', '--bg-sunken'],
  ['--fg-subtle', '--bg-canvas'], ['--fg-subtle', '--bg-surface'], ['--fg-subtle', '--bg-sunken'],

  ['--accent-fg', '--bg-canvas'], ['--accent-fg', '--bg-surface'], ['--accent-fg', '--bg-sunken'],
  ['--accent-fg-hover', '--bg-canvas'], ['--accent-fg-hover', '--bg-surface'],

  ['--fg-success', '--bg-canvas'], ['--fg-success', '--bg-surface'],
  ['--fg-warning', '--bg-canvas'], ['--fg-warning', '--bg-surface'],
  ['--fg-danger', '--bg-canvas'], ['--fg-danger', '--bg-surface'],

  // The paired tokens. Asking for one of these backgrounds hands you its
  // foreground, so this is the promise that pairing makes.
  ['--fg-accent-subtle', '--bg-accent-subtle'],
  ['--fg-success-subtle', '--bg-success-subtle'],
  ['--fg-warning-subtle', '--bg-warning-subtle'],
  ['--fg-danger-subtle', '--bg-danger-subtle'],

  // Text on a filled control.
  ['--action-fg', '--action-bg'], ['--action-fg', '--action-bg-hover'], ['--action-fg', '--action-bg-active'],
  ['--fg-on-accent', '--accent-solid'],
  ['--fg-on-success', '--bg-success-solid'],
  ['--fg-on-warning', '--bg-warning-solid'],
  ['--fg-on-danger', '--bg-danger-solid'],
];

/** Non-text: control edges, focus bands, status marks. WCAG 1.4.11, so 3:1. */
const NON_TEXT_PAIRS = [
  ['--border-default', '--bg-canvas'], ['--border-default', '--bg-surface'], ['--border-default', '--bg-sunken'],
  ['--border-strong', '--bg-canvas'], ['--border-strong', '--bg-surface'],
  ['--border-accent', '--bg-surface'],
  // The matrix stripes. Decoration rather than the only signal, but a mark that
  // cannot be seen is worse than no mark: it looks like a rendering fault.
  ['--accent-solid', '--bg-surface'],
  ['--border-success', '--bg-surface'], ['--border-warning', '--bg-surface'], ['--border-danger', '--bg-surface'],

  // The focus ring is two bands. The halo has to read against the control it sits
  // on, and the ring against whatever is behind the control.
  ['--focus-halo', '--action-bg'], ['--focus-halo', '--accent-solid'], ['--focus-halo', '--bg-danger-solid'],
  ['--focus-ring', '--bg-canvas'], ['--focus-ring', '--bg-surface'], ['--focus-ring', '--focus-halo'],
];

describe.each(Object.keys(THEMES))('the %s theme', (theme) => {
  const tokens = THEMES[theme];

  it('defines every token the app asks for', () => {
    // Guards against the parser silently matching nothing, which would make every
    // assertion below pass against an empty object.
    const named = new Set([...TEXT_PAIRS, ...NON_TEXT_PAIRS].flat());
    const missing = [...named].filter((token) => !tokens[token]);

    expect(missing).toEqual([]);
    expect(Object.keys(tokens).length).toBeGreaterThan(30);
  });

  it.each(TEXT_PAIRS)('%s reads on %s', (fg, bg) => {
    const ratio = contrast(tokens[fg], tokens[bg]);
    expect(ratio, `${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)('%s is visible against %s', (fg, bg) => {
    const ratio = contrast(tokens[fg], tokens[bg]);
    expect(ratio, `${tokens[fg]} on ${tokens[bg]} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
  });

  it('separates the three text weights enough to be worth having', () => {
    // If muted and subtle land on the same value the hierarchy is decorative.
    const [d, m, s] = ['--fg-default', '--fg-muted', '--fg-subtle'].map((t) => luminance(tokens[t]));
    expect(new Set([d, m, s]).size).toBe(3);
  });

  it('keeps the primary action the highest-contrast thing on the page', () => {
    // The rule the action tokens exist to express: the main action is defined by
    // weight against the canvas, not by a colour it happens to be.
    const action = contrast(tokens['--action-bg'], tokens['--bg-canvas']);
    const accent = contrast(tokens['--accent-solid'], tokens['--bg-canvas']);
    expect(action).toBeGreaterThan(accent);
  });
});

describe('the two themes stay in step', () => {
  it('define exactly the same token names', () => {
    // A token that exists in one theme and not the other is a component that will
    // render with an empty value on half the machines that load it.
    expect(Object.keys(THEMES.light).sort()).toEqual(Object.keys(THEMES.dark).sort());
  });

  it('are actually different, rather than dark being a copy', () => {
    expect(THEMES.light['--bg-canvas']).not.toBe(THEMES.dark['--bg-canvas']);
    expect(luminance(THEMES.light['--bg-canvas'])).toBeGreaterThan(luminance(THEMES.dark['--bg-canvas']));
    expect(luminance(THEMES.light['--fg-default'])).toBeLessThan(luminance(THEMES.dark['--fg-default']));
  });

  it('never uses pure black as a dark surface', () => {
    // #000 against a lit room is a glare edge, and it leaves shadows nowhere to go.
    for (const token of ['--bg-canvas', '--bg-surface', '--bg-raised']) {
      expect(THEMES.dark[token]).not.toBe('#000000');
      expect(luminance(THEMES.dark[token])).toBeGreaterThan(0);
    }
  });
});
