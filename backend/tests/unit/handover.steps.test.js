import { describe, it, expect } from 'vitest';
import { HANDOVER_STEPS, STEP_KEYS, seedSteps } from '../../src/modules/handovers/handover.steps.js';

describe('the handover checklist', () => {
  it('covers the parts a handover actually fails on', async () => {
    // "Train them" is what people write when asked to invent the steps. What
    // sinks a handover is the rest: what finished looks like, which logins it
    // needs, and who checks that it worked.
    expect(STEP_KEYS).toContain('done_looks_like');
    expect(STEP_KEYS).toContain('access');
    expect(STEP_KEYS).toContain('check_in');
  });

  it('starts by recording rather than by writing', () => {
    // Writing the document yourself is how a two-hour handover becomes a two-day
    // one. The recording is the cheapest capture of a process never written down.
    expect(STEP_KEYS[0]).toBe('record');
    const writing = STEP_KEYS.indexOf('they_write_it');
    expect(writing).toBeGreaterThan(0);
  });

  it('gives every step words, not just a key', () => {
    for (const step of HANDOVER_STEPS) {
      expect(step.title, step.key).toBeTruthy();
      expect(step.detail, step.key).toBeTruthy();
    }
  });

  it('has no duplicate keys, which would make a tick ambiguous', () => {
    expect(new Set(STEP_KEYS).size).toBe(STEP_KEYS.length);
  });

  it('seeds a fresh copy every time, so one checklist cannot tick another', () => {
    const a = seedSteps();
    const b = seedSteps();
    a[0].done = true;

    expect(b[0].done).toBe(false);
    expect(a).toHaveLength(HANDOVER_STEPS.length);
    expect(a.every((step) => step.doneAt === null)).toBe(true);
  });

  it('seeds nothing already ticked', () => {
    expect(seedSteps().some((step) => step.done)).toBe(false);
  });
});
