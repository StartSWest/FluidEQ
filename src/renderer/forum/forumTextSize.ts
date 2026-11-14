import { useSyncExternalStore } from 'react';

/**
 * How large the Forum's reading text is drawn (Ivan, 2026-11-13: "a zoom
 * feature on forums, so forums can show bigger text for readers with low
 * sight issues").
 *
 * A step on a short ladder rather than a free number: each press lands on a
 * size that was looked at in the window, and A− from the largest always
 * comes back the way it went. The Forum's root carries the step as
 * `--reading-scale`, which the stylesheets' `reading()` multiplies every
 * reading size by, so the text reflows at its real size.
 *
 * Kept on this machine, and kept through Reset all settings like the
 * language: somebody who needs larger text should not have to find the
 * control again after a reset.
 */

export const FORUM_TEXT_STEPS: readonly number[] = [1, 1.15, 1.3, 1.5, 1.75, 2];

const STORAGE_KEY = 'fluideq.forum.textSize.v1';

/**
 * The step nearest to `value`. Anything stored that is not a size this
 * ladder knows (an edited file, an older ladder) lands on the closest one,
 * and anything unreadable on 100%.
 */
export const nearestStep = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1;
  }
  return FORUM_TEXT_STEPS.reduce((best, step) =>
    Math.abs(step - value) < Math.abs(best - value) ? step : best,
  );
};

const readSize = (): number => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
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

/** The Forum's text size, as a multiplier: 1 is 100%. */
export const useForumTextSize = (): number =>
  useSyncExternalStore(
    subscribe,
    () => size,
    () => size,
  );

export const getForumTextSize = (): number => size;

const setSize = (next: number) => {
  const step = nearestStep(next);
  if (step === size) {
    return;
  }
  size = step;
  try {
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
export const largerForumText = () => {
  const at = FORUM_TEXT_STEPS.indexOf(size);
  setSize(FORUM_TEXT_STEPS[Math.min(FORUM_TEXT_STEPS.length - 1, at + 1)] ?? 1);
};

/** One step smaller, staying at 100%. */
export const smallerForumText = () => {
  const at = FORUM_TEXT_STEPS.indexOf(size);
  setSize(FORUM_TEXT_STEPS[Math.max(0, at - 1)] ?? 1);
};

export const resetForumText = () => setSize(1);

/** Test seam: the size as storage holds it now. */
export const reloadForumTextSize = () => {
  size = readSize();
  listeners.forEach((listener) => listener());
};
