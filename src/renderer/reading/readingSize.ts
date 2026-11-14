import { useSyncExternalStore } from 'react';

/**
 * How large the reading text is drawn on the pages meant for reading: the
 * Forum and Help (Ivan, 2026-11-13: "a zoom feature on forums, so forums can
 * show bigger text for readers with low sight issues", then "sure, in Help
 * too").
 *
 * One size for both. A reader who needs larger text needs it on every page
 * they read, and setting it twice, in two places, is the kind of chore that
 * person is least able to do.
 *
 * A step on a short ladder rather than a free number: each press lands on a
 * size that was looked at in the window, and A− from the largest always
 * comes back the way it went. Each page's root carries the step as
 * `--reading-scale`, which the stylesheets' `reading()` multiplies every
 * reading size by, so the text reflows at its real size.
 *
 * Kept on this machine, and kept through Reset all settings like the
 * language: somebody who needs larger text should not have to find the
 * control again after a reset.
 */

export const READING_SIZE_STEPS: readonly number[] = [
  1, 1.15, 1.3, 1.5, 1.75, 2,
];

const STORAGE_KEY = 'fluideq.readingSize.v1';
/** Where the Forum kept it before Help shared it (never in a release). */
const FORUM_KEY = 'fluideq.forum.textSize.v1';

/**
 * The step nearest to `value`. Anything stored that is not a size this
 * ladder knows (an edited file, an older ladder) lands on the closest one,
 * and anything unreadable on 100%.
 */
export const nearestStep = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return READING_SIZE_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );
};

const readSize = (): number => {
  try {
    const stored =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(FORUM_KEY);
    return stored === null ? 1 : nearestStep(Number(stored));
  } catch {
    // Unreadable storage: the default size.
    return 1;
  }
};

let size = readSize();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The reading text's size, as a multiplier: 1 is 100%. */
export const useReadingSize = (): number =>
  useSyncExternalStore(
    subscribe,
    () => size,
    () => size,
  );

export const getReadingSize = (): number => size;

const setSize = (next: number) => {
  const step = nearestStep(next);
  if (step === size) {
    return;
  }
  size = step;
  try {
    window.localStorage.removeItem(FORUM_KEY);
    if (step === 1) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, String(step));
    }
  } catch {
    // Quota or a locked profile: the size holds for this session, which is
    // the part on screen.
  }
  listeners.forEach((listener) => listener());
};

/** One step larger, staying at the largest. */
export const largerReadingText = () => {
  const at = READING_SIZE_STEPS.indexOf(size);
  setSize(
    READING_SIZE_STEPS[Math.min(READING_SIZE_STEPS.length - 1, at + 1)] ?? 1,
  );
};

/** One step smaller, staying at 100%. */
export const smallerReadingText = () => {
  const at = READING_SIZE_STEPS.indexOf(size);
  setSize(READING_SIZE_STEPS[Math.max(0, at - 1)] ?? 1);
};

export const resetReadingText = () => setSize(1);

/** Test seam: the size as storage holds it now. */
export const reloadReadingSize = () => {
  size = readSize();
  listeners.forEach((listener) => listener());
};
