/**
 * One energy axis, signed, matching backend/src/models/AuditWeek.js.
 *
 * Two questions ("how did it feel" and "how much did it take") would correlate so
 * tightly that the second only adds noise and fatigue — and twelve activities is
 * already twelve decisions. The wording avoids "energy" as a noun because people
 * read that as caffeine rather than as how the work leaves them.
 */
export const ENERGY_SCALE = Object.freeze([
  { value: -2, label: 'Drains me', description: 'I put it off and feel worse after' },
  { value: -1, label: 'A bit draining', description: 'Fine, but I would rather not' },
  { value: 0, label: 'Neutral', description: 'I neither mind nor enjoy it' },
  { value: 1, label: 'A bit energising', description: 'I quite like doing it' },
  { value: 2, label: 'Energises me', description: 'This is why I do the job' },
]);

export const energyLabel = (value) =>
  ENERGY_SCALE.find((step) => step.value === value)?.label ?? 'Not said';
