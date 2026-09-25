import { useId } from 'react';
import { ENERGY_SCALE } from './energy.js';

/**
 * A radio group, not a slider or a set of emoji.
 *
 * Radios are what this is: five named, mutually exclusive choices. A slider would
 * imply a precision nobody has about how last Tuesday felt, and emoji leave the
 * meaning to the reader — two people would not be answering the same question.
 *
 * `fieldset`/`legend` is what makes a screen reader announce "Invoicing, how it
 * felt" before reading the options, rather than five unexplained radios.
 */
export function EnergyPicker({ value, onChange, activityLabel, name }) {
  const groupId = useId();

  return (
    <fieldset className="energy" aria-describedby={`${groupId}-legend`}>
      <legend id={`${groupId}-legend`} className="energy__legend">
        <span className="visually-hidden">{activityLabel}: </span>How it felt
      </legend>

      <div className="energy__options" role="radiogroup">
        {ENERGY_SCALE.map((step) => {
          const id = `${groupId}-${step.value}`;
          const selected = value === step.value;

          return (
            <label
              key={step.value}
              htmlFor={id}
              className={`energy__option ${selected ? 'is-selected' : ''}`.trim()}
              data-energy={step.value}
              title={step.description}
            >
              <input
                type="radio"
                id={id}
                name={name}
                className="visually-hidden"
                checked={selected}
                onChange={() => onChange(step.value)}
              />
              <span className="energy__mark" aria-hidden="true" />
              <span className="energy__label">{step.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
