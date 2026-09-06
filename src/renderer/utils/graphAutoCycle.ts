import { useEffect } from 'react';
import { cycleGraphLook } from './graphStyle';

export const GRAPH_AUTO_CYCLE_INTERVALS = [0, 10, 20, 30, 60, 120] as const;
const STORAGE_KEY = 'fluideq-graph-auto-cycle-seconds';

export const readGraphAutoCycle = (): number => {
  try {
    const seconds = Number(window.localStorage.getItem(STORAGE_KEY));
    return GRAPH_AUTO_CYCLE_INTERVALS.some((value) => value === seconds)
      ? seconds
      : 0;
  } catch {
    return 0;
  }
};

export const saveGraphAutoCycle = (seconds: number) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // The current session can still cycle when storage is unavailable.
  }
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
      if (
        document.hidden ||
        document.querySelector('.graph-look-menu, .graph-auto-cycle-menu')
      ) {
        elapsed = 0;
      } else {
        elapsed += delta;
        if (elapsed >= seconds * 1000) {
          elapsed = 0;
          cycleGraphLook(1);
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
