/**
 * What handing something over actually takes.
 *
 * Pure data, and a fixed list rather than something the owner composes. Asked to
 * invent the steps, most people write "train them" and stop — the whole reason a
 * handover fails is the parts nobody thinks to write down: what finished looks
 * like, which logins it needs, and who checks that it worked.
 *
 * The order is the order they happen in. Recording comes first because it is the
 * cheapest way to capture a process you have never written down: do the thing
 * once with the screen recorder on, and the person taking it over writes the
 * document from the recording. That is their job, not yours — writing it
 * yourself is how a two-hour handover becomes a two-day one.
 */
export const HANDOVER_STEPS = Object.freeze([
  {
    key: 'record',
    title: 'Record yourself doing it once',
    detail: 'Screen recorder on, start to finish, narrating as you go. Mistakes and all — the fumbles are the parts worth seeing.',
  },
  {
    key: 'done_looks_like',
    title: 'Write down what "done" looks like',
    detail: 'One or two lines. Not how it is done — what has to be true afterwards for it to have been done right.',
  },
  {
    key: 'access',
    title: 'List the access it needs',
    detail: 'Every login, inbox, folder and tool. This is the step that quietly stalls a handover for a fortnight.',
  },
  {
    key: 'who',
    title: 'Decide who takes it on',
    detail: 'A named person, not a role you have yet to hire. If nobody exists yet, that is the answer and this stays open.',
  },
  {
    key: 'they_write_it',
    title: 'They write the document from your recording',
    detail: 'Whoever takes it over writes it up. Someone who can follow it and write it down has proved they can do it.',
  },
  {
    key: 'watch_once',
    title: 'Watch them do it once',
    detail: 'Once, without stepping in. Everything you want to correct goes in their document, not into doing it yourself again.',
  },
  {
    key: 'check_in',
    title: 'Set the date you check the result',
    detail: 'A date, and what you will look at. Handing something over without this is not delegating, it is hoping.',
  },
]);

export const STEP_KEYS = Object.freeze(HANDOVER_STEPS.map((step) => step.key));

/**
 * The steps a new handover starts with.
 *
 * Copied onto the document rather than read from this file at render time, so
 * editing the template later cannot rewrite what somebody was already working
 * through — the same reason a rate stamps its inputs onto anything derived
 * from it.
 */
export const seedSteps = () => HANDOVER_STEPS.map((step) => ({ key: step.key, done: false, doneAt: null }));
