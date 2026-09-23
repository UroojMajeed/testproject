// @vitest-environment node
// No DOM needed, and a node environment gives import.meta.url as a real file URL.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The palette, measured rather than admired.
 *
 * This parses _tokens.scss, so it tests the values the app actually ships. Nudge a
 * colour a shade lighter because it looks nicer and this fails, which is the whole
 * reason it exists — every "accessible" palette starts accessible.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for body text, 3:1 for a non-text element such
 * as an input border or a focus ring (1.4.11).
 */

const source = readFileSync(fileURLToPath(new URL('./_tokens.scss', import.meta.url)), 'utf8');

/** Sass variable declarations that hold a hex colour. */
const tokens = Object.fromEntries(
  [...source.matchAll(/^\$([a-z0-9-]+):\s*(#[0-9a-f]{6});/gim)].map(([, name, hex]) => [name, hex]),
);

const channels = (hex) => hex.slice(1).match(/../g).map((p) => parseInt(p, 16) / 255);
const linear = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

function luminance(hex) {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE = '#ffffff';

it('found the tokens it is meant to be measuring', () => {
  // Guards against the regex silently matching nothing after a refactor, which
  // would make every assertion below pass on an empty set.
  expect(Object.keys(tokens).length).toBeGreaterThan(15);
  expect(tokens.ink).toBeDefined();
  expect(tokens.brand).toBeDefined();
});

describe('text on a background — 4.5:1', () => {
  const pairs = [
    ['ink', 'surface'],
    ['ink', 'page'],
    ['ink', 'surface-sunken'],
    ['ink-muted', 'surface'],
    ['ink-muted', 'page'],
    ['ink-placeholder', 'surface'],
    ['brand-text', 'surface'],
    ['brand-text', 'page'],
    ['brand-text', 'brand-wash'],
    ['danger-text', 'surface'],
    ['danger-text', 'page'],
    ['danger-text', 'danger-wash'],
    ['success-text', 'surface'],
    ['success-text', 'success-wash'],
    ['warn-text', 'surface'],
    ['warn-text', 'warn-wash'],
  ];

  it.each(pairs)('$%s on $%s', (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5);
  });
});

describe('white text on a filled control — 4.5:1', () => {
  it.each([['brand'], ['brand-hover'], ['brand-active'], ['danger'], ['success']])(
    'white on $%s',
    (fill) => {
      expect(contrast(WHITE, tokens[fill])).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('non-text elements — 3:1', () => {
  it.each([['border', 'surface'], ['border', 'page'], ['border', 'surface-sunken']])(
    '$%s against $%s, because an input edge you cannot see is not an input edge',
    (fg, bg) => {
      expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3);
    },
  );

  /**
   * The focus ring is two bands: surface-coloured against the control, then ink
   * against whatever is behind it. A single ring disappears on one side or the
   * other the moment the control is filled, so both edges are measured.
   */
  it.each([['brand'], ['danger'], ['success']])('focus ring inner band reads against $%s', (fill) => {
    expect(contrast(tokens.surface, tokens[fill])).toBeGreaterThanOrEqual(3);
  });

  it.each([['surface'], ['page'], ['surface-sunken']])('focus ring outer band reads against $%s', (bg) => {
    expect(contrast(tokens.ink, tokens[bg])).toBeGreaterThanOrEqual(3);
  });
});

describe('the fill and text variants are genuinely different colours', () => {
  /**
   * The rule this protects: a colour that passes as a background almost never
   * passes as text. Collapsing the pair back into one token is the exact mistake
   * the split exists to prevent, and it looks harmless in a diff.
   */
  it.each([
    ['brand', 'brand-text'],
    ['danger', 'danger-text'],
    ['success', 'success-text'],
  ])('$%s and $%s have not been merged', (fill, text) => {
    expect(tokens[fill]).not.toBe(tokens[text]);
    expect(luminance(tokens[text])).toBeLessThan(luminance(tokens[fill]));
  });
});
