import { useEffect, useLayoutEffect, useSyncExternalStore } from 'react';
import { cycleGraphLookUnattended } from './graphStyle';

export const GRAPH_AUTO_CYCLE_INTERVALS = [0, 10, 20, 30, 60, 120] as const;
const STORAGE_KEY = 'fluideq-graph-auto-cycle-seconds';
/**
 * A fresh install cycles every two minutes until told otherwise: the forms
 * are the product's showpiece, and a new user who never opens the picker
 * should still see more than one of them. Off stays one click away.
 */
export const DEFAULT_GRAPH_AUTO_CYCLE = 120;

const isInterval = (seconds: number) =>
  GRAPH_AUTO_CYCLE_INTERVALS.some((value) => value === seconds);

export const readGraphAutoCycle = (): number => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return DEFAULT_GRAPH_AUTO_CYCLE;
    }
    const seconds = Number(stored);
    return isInterval(seconds) ? seconds : 0;
  } catch {
    return DEFAULT_GRAPH_AUTO_CYCLE;
  }
};

/**
 * The interval every control shows, one value for the window.
 *
 * The graph's toolbar and the player's visualizer both offer it, and the
 * graph's stays mounted, out of sight, while the window is the player: kept
 * in each control's own state, a change made in the player came back to the
 * full app as the old interval, still running.
 */
let shownSeconds: number | undefined;
const intervalListeners = new Set<() => void>();

const currentSeconds = () => {
  if (shownSeconds === undefined) {
    shownSeconds = readGraphAutoCycle();
  }
  return shownSeconds;
};

export const saveGraphAutoCycle = (seconds: number) => {
  shownSeconds = isInterval(seconds) ? seconds : 0;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(seconds));
  } catch {
    // The current session can still cycle when storage is unavailable.
  }
  intervalListeners.forEach((listener) => listener());
};

export const useGraphAutoCycleSeconds = () =>
  useSyncExternalStore(
    (listener) => {
      intervalListeners.add(listener);
      return () => {
        intervalListeners.delete(listener);
      };
    },
    currentSeconds,
    () => DEFAULT_GRAPH_AUTO_CYCLE,
  );

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

/**
 * The cycles running, newest last; only the newest counts time.
 *
 * Two can be mounted at once — the graph's, kept out of sight while the
 * window is the player, and the player's own — and each counts to the same
 * interval from the same look change, so both reached it on the same frame
 * and the second step landed before either had seen the first: every other
 * look was skipped. The newest is the one on screen, because a surface that
 * is opened mounts its control after the one it covers.
 */
const runningCycles: symbol[] = [];

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
    const claim = Symbol('graph auto cycle');
    runningCycles.push(claim);
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
      // A hidden window accrues no time, only the newest cycle counts, and an
      // open picker must never have its selection changed underneath the
      // person choosing from it.
      if (
        document.hidden ||
        runningCycles[runningCycles.length - 1] !== claim ||
        openPickers > 0
      ) {
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
      runningCycles.splice(runningCycles.indexOf(claim), 1);
    };
  }, [seconds, suspended, selectedLookId]);
};
