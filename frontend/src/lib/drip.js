/**
 * The value question, in the words people can actually answer.
 *
 * Not "how much is this worth" — almost nobody can price answering email, and a
 * figure they guessed is noise the whole matrix would then be built on. Asking
 * what *happens* is a judgement any owner can make about any activity in a second.
 *
 * The keys match backend/src/models/Activity.js. Change one, change both.
 */
export const VALUE_ANSWERS = Object.freeze([
  { value: 'critical', label: 'Revenue stops', description: 'Money stops coming in, or clients leave' },
  { value: 'important', label: 'Something slips', description: 'We would feel it, but the business keeps running' },
  { value: 'low', label: 'Not much, honestly', description: 'Nobody outside would notice for a while' },
]);

export const valueLabel = (value) =>
  VALUE_ANSWERS.find((answer) => answer.value === value)?.label ?? 'Not answered';

/**
 * What each quadrant means, and what to do about it.
 *
 * The quadrant is decided by the server, deterministically, from declared answers.
 * This file holds only the words — the same split as the energy scale: the server
 * owns the number, the client owns the sentence.
 */
export const QUADRANT_COPY = Object.freeze({
  delegate: {
    title: 'Delegate',
    meaning: 'Drains you, and the business would barely notice.',
    action: 'The easy win. Somebody else can do this, and it does not need to be somebody senior.',
  },
  replace: {
    title: 'Replace',
    meaning: 'Drains you, and it matters. The hardest quadrant.',
    action: 'Not a quick handoff — this pays the bills, so it needs a real person and a proper handover.',
  },
  invest: {
    title: 'Invest',
    meaning: 'You like it, but it is not paying yet.',
    action: 'Worth a decision rather than drift: either make it pay, or be honest that it is a hobby.',
  },
  produce: {
    title: 'Produce',
    meaning: 'You like it, and it matters.',
    action: 'More of your week should look like this. Everything above exists to buy you more of it.',
  },
});

/** Replace and Delegate first: those are the two with something to do about them. */
export const QUADRANT_ORDER = ['replace', 'delegate', 'produce', 'invest'];
