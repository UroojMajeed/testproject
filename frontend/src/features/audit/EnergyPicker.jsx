import { useId } from 'react';
import { ENERGY_SCALE, energyLabel } from './energy.js';

/**
 * A radio group, not a slider or a set of emoji.
 *
 * Radios are what this is: five named, mutually exclusive choices. A slider would
 * imply a precision nobody has about how last Tuesday felt, and emoji leave the
 * meaning to the reader — two people would not be answering the same question.
 *
 * Drawn as one connected scale rather than five separate pills. Five wrapping
 * pills per activity meant a dozen activities put sixty word-shaped targets on a
 * page, every row identical, with nothing for the eye to hold on to — and the
 * words repeated twelve times stop being read by about the third row. A diverging
 * bar is read by position and shape in one glance, and the chosen wording is
 * still spelled out underneath, once, where it is actually wanted.
 *
 * The full label stays in the DOM on every option, so what a screen reader
 * announces is the sentence, never the picture.
 */

/**
 * The glyph. Height and direction both carry the meaning, so the scale survives
 * being read without colour — which is the rule everywhere else in this app.
 */
const BAR = {
  '-2': { x: 4, y: 9, w: 8, h: 7 },
  '-1': { x: 4, y: 9, w: 8, h: 3 },
  0: { x: 1, y: 7, w: 14, h: 2 },
  1: { x: 4, y: 4, w: 8, h: 3 },
  2: { x: 4, y: 0, w: 8, h: 7 },
};

export function EnergyPicker({ value, onChange, activityLabel, name }) {
  const groupId = useId();

  return (
    <fieldset className="energy" aria-describedby={`${groupId}-legend`}>
      {/*
        Hidden, not removed. On screen it was the same three words above every one
        of a dozen rows, and the chosen wording beside the scale says more; a
        screen reader still hears "Invoicing: how it felt" before the options.
      */}
      <legend id={`${groupId}-legend`} className="visually-hidden">
        {activityLabel}: How it felt
      </legend>

      <div className="energy__scale" role="radiogroup">
        {ENERGY_SCALE.map((step) => {
          const id = `${groupId}-${step.value}`;
          const selected = value === step.value;
          const bar = BAR[step.value];

          return (
            <label
              key={step.value}
              htmlFor={id}
              className={`energy__step ${selected ? 'is-selected' : ''}`.trim()}
              data-energy={step.value}
              title={`${step.label} — ${step.description}`}
            >
              <input
                type="radio"
                id={id}
                name={name}
                className="visually-hidden"
                checked={selected}
                onChange={() => onChange(step.value)}
              />
              <svg className="energy__bar" viewBox="0 0 16 16" aria-hidden="true">
                {/* The line the column sits above or below, so the direction is
                    legible rather than inferred from the neighbours. */}
                <rect className="energy__baseline" x="1" y="7.5" width="14" height="1" rx="0.5" />
                <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx="1" />
              </svg>
              {/* Hidden, never absent: this is what is announced and what is read. */}
              <span className="visually-hidden">{step.label}</span>
            </label>
          );
        })}
      </div>

      {/*
        The wording, once per row instead of five times. aria-live would be noise
        here — the radio already announces itself on selection — so this is for
        the eye only.
      */}
      <span className="energy__chosen" data-energy={value ?? ''} aria-hidden="true">
        {value === null ? 'How did it feel?' : energyLabel(value)}
      </span>
    </fieldset>
  );
}
