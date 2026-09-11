/**
 * When something was posted, the way a forum says it: "3 days ago", in the
 * reader's language, from the platform's own relative-time formatter — so
 * ten languages' grammar for "ago" is the browser's problem and not a table
 * of ours.
 *
 * Computed when the row is drawn and not kept current: the list is read again
 * whenever the tab is opened or the window comes back to the front, and a
 * label a few minutes stale in between is not worth a clock ticking in the
 * background of a forum.
 */

const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.345],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY],
];

export const relativeTime = (
  iso: string,
  locale: string,
  now: number = Date.now(),
): string => {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) {
    return '';
  }
  const format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const seconds = (then - now) / 1_000;
  // Under a minute is "now", not "12 seconds ago": a forum's clock is not
  // that precise, and the seconds would be wrong by the time they are read.
  if (Math.abs(seconds) < 60) {
    return format.format(0, 'second');
  }
  // Down the ladder until the amount fits under the next unit up.
  const fit = STEPS.reduce<{
    amount: number;
    unit?: Intl.RelativeTimeFormatUnit;
  }>(
    (step, [unit, size]) => {
      if (step.unit) {
        return step;
      }
      return Math.abs(step.amount) < size
        ? { amount: step.amount, unit }
        : { amount: step.amount / size };
    },
    { amount: seconds },
  );
  return format.format(Math.round(fit.amount), fit.unit ?? 'year');
};

/** The exact moment, for the tooltip on a relative time. */
export const absoluteTime = (iso: string, locale: string): string => {
  const then = Date.parse(iso);
  return Number.isFinite(then)
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(then)
    : '';
};
