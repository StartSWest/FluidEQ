import { useEffect, useLayoutEffect } from 'react';
import { cycleGraphLookUnattended } from './graphStyle';

export const GRAPH_AUTO_CYCLE_INTERVALS = [0, 10, 20, 30, 60, 120] as const;
const STORAGE_KEY = 'fluideq-graph-auto-cycle-seconds';
/**
 * A fresh install cycles every two minutes until told otherwise: the forms
 * are the product's showpiece, and a new user who never opens the picker
 * should still see more than one of them. Off stays one click away.
 */
export const DEFAULT_GRAPH_AUTO_CYCLE = 120;

export const readGraphAutoCycle = (): number => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_GRAPH_AUTO_CYCLE;
    }
    const seconds = Number(stored);
    return GRAPH_AUTO_CYCLE_INTERVALS.some((value) => value === seconds)
      ? seconds
      : 0;
  } catch {
    return DEFAULT_GRAPH_AUTO_CYCLE;
  }
};

export const saveGraphAutoCycle = (seconds: number) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // The current session can still cycle when storage is unavailable.
  }
};

/**
 * How many of the graph's pickers are open — the look explorer and the
 * interval list, wherever either is mounted. Each takes a hold while it is
 * open, and the cycle reads the count.
 *
 * The cycle used to find them by asking the document for
 * `.graph-look-menu, .graph-auto-cycle-menu` on every frame: 8.6-11 ms of
 * main-thread time per second in full screen at 1920x1080 and ~100 fps, more
 * than a whole drawn scene costs.
 */
let openPickers = 0;

/** While `isOpen`, every running cycle waits at the start of its interval. */
export const useHoldGraphAutoCycle = (isOpen: boolean) => {
  // Layout, not passive: the cycle runs on animation frames, and a passive
  // effect can land after one — a frame in which the list is on screen and
  // the look can still change underneath it.
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    openPickers += 1;
    return () => {
      openPickers -= 1;
    };
  }, [isOpen]);
};

/** One visible interval per look, including after a manual selection or edit. */
export const useGraphAutoCycle = (
  seconds: number,
  suspended: boolean,
  selectedLookId: string,
) => {
  useEffect(() => {
    if (seconds <= 0 || suspended) {
      return undefined;
    }
    let elapsed = 0;
    let previous = performance.now();
    let frame: number;
    const reset = () => {
      elapsed = 0;
      previous = performance.now();
    };
    const tick = (now: number) => {
      const delta = Math.max(0, now - previous);
      previous = now;
      // A hidden window accrues no time, and an open picker must never have
      // its selection changed underneath the person choosing from it.
      if (document.hidden || openPickers > 0) {
        elapsed = 0;
      } else {
        elapsed += delta;
        if (elapsed >= seconds * 1000) {
          elapsed = 0;
          // Nobody has pressed anything, so a scene somebody else made is
          // passed over: the app never starts a stranger's program while its
          // owner is not looking at the screen.
          cycleGraphLookUnattended(1);
        }
      }
      frame = window.requestAnimationFrame(tick);
    };
    document.addEventListener('visibilitychange', reset);
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', reset);
    };
  }, [seconds, suspended, selectedLookId]);
};
