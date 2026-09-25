import { useEffect, useSyncExternalStore } from 'react';
import { IEnginePreamp } from '../../common/enginePreamp';
import { readKnownAudioDevices } from './equalizerApi';
import { reportError } from './logger';

/**
 * How far the engine's automatic preamp has to move before the window hears.
 *
 * Its protection trims the gain continuously, and between the ramps it takes
 * on loud passages the value dithers a step either side of where it sits —
 * -0.18, -0.20, -0.19 dB, several times a second, measured in the running
 * window. A twentieth of a decibel is 2.5 times that dither, under a pixel of
 * curve on the tallest graph, and inside the last digit the preamp field
 * shows, so nothing on screen is less true for skipping it. Switching on or
 * off, and starting or stopping, still arrive at once.
 */
const GAIN_STEP_DB = 0.05;

let snapshot: IEnginePreamp | undefined;
const listeners = new Set<() => void>();
const publish = (next?: IEnginePreamp) => {
  if (
    snapshot?.enabled === next?.enabled &&
    snapshot?.active === next?.active &&
    (snapshot === undefined ||
      next === undefined ||
      Math.abs(next.gainDb - snapshot.gainDb) < GAIN_STEP_DB)
  ) {
    return;
  }
  snapshot = next
    ? { ...next, gainDb: Math.round(next.gainDb * 100) / 100 }
    : undefined;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useEnginePreamp = () =>
  useSyncExternalStore(subscribe, () => snapshot);

/**
 * The automatic preamp as a live source, for drawing that follows it without
 * going through React.
 *
 * On loud passages the engine ramps the gain at display rate — -0.99 to -3.19
 * and back to -1.0 dB within 600 ms, a new value every 10 to 30 ms — and the
 * graph used to take it as state: each value rebuilt every curve and
 * re-rendered the chart, the axes and the look picker, 25 ms of main thread
 * apiece, 57 renders in five seconds of music. That was the graph stuttering.
 * Only the output curve depends on it, and only as a constant vertical offset,
 * so the chart moves that one curve itself (`Chart.tsx`).
 */
export const liveEnginePreamp = {
  /** Decibels applied to the output right now: zero while protection is off. */
  read: (): number => (snapshot?.enabled ? snapshot.gainDb : 0),
  subscribe,
};

/**
 * Whether the automatic preamp is doing anything, which is all the graph's
 * React tree needs: it decides whether the output curve is drawn at all, and
 * flips a few times a session rather than at display rate.
 */
export const useEnginePreampAudible = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => Math.abs(liveEnginePreamp.read()) > 0.01,
  );

type TReadEnginePreamp = (
  endpoint: string,
) => Promise<IEnginePreamp | undefined>;

/**
 * One engine read per frame while the window is on screen, following the
 * output being listened to. Returns how to stop it.
 */
const startReader = (read: TReadEnginePreamp): (() => void) => {
  let disposed = false;
  let generation = 0;
  let animation = 0;
  let endpoint: string | undefined;
  const paint = async () => {
    const current = generation;
    if (disposed || document.hidden || !endpoint) {
      return;
    }
    try {
      const next = await read(endpoint);
      if (disposed || current !== generation) {
        return;
      }
      publish(next);
    } catch (error) {
      if (disposed || current !== generation) {
        return;
      }
      reportError('reading final output preamp', error);
      publish();
      return;
    }
    animation = requestAnimationFrame(paint);
  };
  const start = async () => {
    generation += 1;
    const current = generation;
    cancelAnimationFrame(animation);
    publish();
    if (disposed || document.hidden) {
      return;
    }
    try {
      const devices = await readKnownAudioDevices();
      if (disposed || current !== generation) {
        return;
      }
      endpoint = devices.find((device) => device.isDefault)?.guid;
      if (endpoint) {
        animation = requestAnimationFrame(paint);
      }
    } catch (error) {
      reportError('finding final output preamp', error);
    }
  };
  start();
  window.addEventListener('fluideq-output-changed', start);
  document.addEventListener('visibilitychange', start);
  return () => {
    disposed = true;
    generation += 1;
    cancelAnimationFrame(animation);
    publish();
    window.removeEventListener('fluideq-output-changed', start);
    document.removeEventListener('visibilitychange', start);
  };
};

let holders = 0;
let stopReader: (() => void) | undefined;

/**
 * Keep the live preamp read while `enabled`, one reader for every caller.
 *
 * The side bar's dial and the amp's band screen each ran a loop of their
 * own, an engine read per frame apiece — and the side bar stays mounted,
 * only hidden, while the window is the amp, so the compact player asked the
 * engine twice a frame for one number. The first caller now starts the one
 * loop and the last to leave stops it; a caller that is not reading clears
 * the value only when nobody else is.
 */
export const useEnginePreampReader = (enabled: boolean) => {
  useEffect(() => {
    const read = window.electron?.ipcRenderer?.readEnginePreamp;
    if (!enabled || !read) {
      if (holders === 0) {
        publish();
      }
      return undefined;
    }
    holders += 1;
    if (holders === 1) {
      stopReader = startReader(read);
    }
    return () => {
      holders -= 1;
      if (holders === 0) {
        stopReader?.();
        stopReader = undefined;
      }
    };
  }, [enabled]);
};
