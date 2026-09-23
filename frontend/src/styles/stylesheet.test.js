// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

/**
 * custom.scss imports Bootstrap in parts rather than whole, which cut the shipped
 * CSS roughly in half. The risk that buys is silent: drop a class from a component,
 * or add one from a module that is not imported, and nothing errors — the element
 * just renders unstyled, and only in the browser.
 *
 * So compile the real stylesheet and check that every class the components ask for
 * is in it. This is the test that lets the selective import stay.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..');

const compiled = sass.compile(join(here, 'custom.scss'), {
  loadPaths: [join(here, '..', '..', 'node_modules')],
  silenceDeprecations: ['import', 'global-builtin', 'color-functions', 'if-function'],
}).css;

function jsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return jsxFiles(full);
    return entry.isFile() && entry.name.endsWith('.jsx') && !entry.name.includes('.test.') ? [full] : [];
  });
}

/**
 * Every class name the components use.
 *
 * Only plain tokens are collected — an interpolated `${cls}` is a variable, and its
 * possible values are checked where they are defined instead.
 */
function classesUsed() {
  const found = new Map();

  for (const file of jsxFiles(srcDir)) {
    const source = readFileSync(file, 'utf8');
    // Either className="a b" or className={`a ${x} b`…}. The closing brace is not
    // required, because a template literal is often followed by .trim().
    for (const match of source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`)/g)) {
      const value = match[1] ?? match[2] ?? '';
      for (const token of value.split(/\s+/)) {
        if (/^[a-z][a-z0-9-]*$/.test(token) && !found.has(token)) found.set(token, file);
      }
    }
  }
  return found;
}

describe('the compiled stylesheet', () => {
  it('compiled at all, so the assertions below mean something', () => {
    expect(compiled.length).toBeGreaterThan(10_000);
  });

  it('defines every class the components ask for', () => {
    const missing = [...classesUsed()]
      // Escape nothing: Bootstrap class names contain no regex metacharacters, and a
      // plain substring search is enough to prove the selector was generated.
      .filter(([cls]) => !compiled.includes(`.${cls}`))
      .map(([cls, file]) => `${cls} (used in ${file.replace(srcDir, 'src')})`);

    // A failure here almost always means custom.scss needs one more Bootstrap
    // partial imported — the message names the class and where it came from.
    expect(missing).toEqual([]);
  });

  it('still carries the classes the forms depend on, whatever else changes', () => {
    // Named explicitly because these are the ones whose absence would be least
    // obvious in a screenshot: a focus ring, a hidden label, a disabled button.
    for (const cls of ['.form-control', '.form-label', '.input-group', '.btn', '.visually-hidden', '.alert']) {
      expect(compiled).toContain(cls);
    }
  });

  it('draws the focus ring as two bands rather than one', () => {
    // The single-band version is invisible against a filled control. If this
    // selector loses its second colour stop, keyboard focus stops being locatable
    // on the primary button, which no visual test would catch.
    expect(compiled).toMatch(/:focus-visible[^{]*\{[^}]*box-shadow:[^;]*var\(--surface\)[^;]*var\(--focus\)/);
  });

  /**
   * This one is here because of a bug that got all the way to the browser.
   *
   * Bootstrap ships `.btn:focus-visible` at specificity 0,2,0, so a bare
   * `:focus-visible` rule of ours never applied to a button — focus on the primary
   * call to action drew Bootstrap's ring at the zero width we had configured, and
   * was invisible. Every token was correct and every other test passed; it took
   * loading the page and reading the computed style to find it.
   *
   * So assert on the cascade, not just on the presence of a rule: of the rules that
   * can style a focused button, ours has to be the last one.
   */
  it('wins the cascade against Bootstrap on a focused button', () => {
    const ruleFor = (selector) => {
      const rules = [...compiled.matchAll(/([^{}]+)\{([^}]*)\}/g)]
        .filter(([, sel]) => sel.split(',').some((s) => s.trim() === selector));
      return rules.at(-1)?.[2] ?? '';
    };

    const winner = ruleFor('.btn:focus-visible');
    expect(winner).toContain('var(--focus)');
    // Bootstrap's own ring variable must not be the one that lands last.
    expect(winner).not.toContain('--bs-btn-focus-box-shadow');
  });
});
