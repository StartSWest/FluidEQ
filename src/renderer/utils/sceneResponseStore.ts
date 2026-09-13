/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import {
  NEUTRAL_RESPONSE,
  RESPONSE_LIMITS,
  type ISceneResponse,
} from 'common/sceneResponse';
import { readStored, removeStored, writeStored } from './graphStorage';

/**
 * How a Plus visualizer on the graph answers the music, as the listener set
 * it: its attack and its release, per visualizer, over the ones it came with.
 *
 * Only those two. Sensitivity and threshold decide what a scene hears at all
 * and are its author's to tune in the Studio; how quickly it rises and how
 * long it glows afterwards is taste, and taste belongs to whoever watches.
 *
 * A value the listener has not moved is not stored, so a visualizer whose
 * author retunes it in a new version brings the new timing with it; only
 * what was actually changed stays put. Kept on this computer, by look id, for
 * every version of that visualizer.
 */

export type TListenerResponseKey = 'attack' | 'release';

export const LISTENER_RESPONSE_KEYS: readonly TListenerResponseKey[] = [
  'attack',
  'release',
];

export type TListenerResponse = Readonly<
  Partial<Pick<ISceneResponse, TListenerResponseKey>>
>;

const STORAGE_KEY = 'fluideq.sceneResponse';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clampTo = (key: TListenerResponseKey, value: number) => {
  const [min, max] = RESPONSE_LIMITS[key];
  return Math.round(Math.min(max, Math.max(min, value)));
};

/** A stored entry, or undefined when nothing of it is usable. */
const readEntry = (raw: unknown): TListenerResponse | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const entry: Partial<Pick<ISceneResponse, TListenerResponseKey>> = {};
  LISTENER_RESPONSE_KEYS.forEach((key) => {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      entry[key] = clampTo(key, value);
    }
  });
  return Object.keys(entry).length > 0 ? entry : undefined;
};

const readChoices = (): Map<string, TListenerResponse> => {
  const choices = new Map<string, TListenerResponse>();
  const stored = readStored(STORAGE_KEY);
  if (stored === null) {
    return choices;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged entry puts every visualizer back on its own timing, which is
    // what it would draw with anyway.
    return choices;
  }
  if (isRecord(parsed)) {
    Object.entries(parsed).forEach(([lookId, raw]) => {
      const entry = readEntry(raw);
      if (entry) {
        choices.set(lookId, entry);
      }
    });
  }
  return choices;
};

let choices: Map<string, TListenerResponse> | undefined;
const listeners = new Set<() => void>();

const allChoices = () => {
  choices ??= readChoices();
  return choices;
};

const save = () => {
  const all = allChoices();
  if (all.size === 0) {
    removeStored(STORAGE_KEY);
  } else {
    writeStored(STORAGE_KEY, JSON.stringify(Object.fromEntries(all)));
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** What the listener set for `lookId`, one stable object per change. */
export const useListenerResponse = (lookId: string) =>
  useSyncExternalStore(
    subscribe,
    () => allChoices().get(lookId),
    () => undefined,
  );

/**
 * Sets one of the two for `lookId`. The visualizer's own value is passed so a
 * slider brought back onto it forgets the choice rather than pinning a copy
 * of today's default.
 */
export const setListenerResponse = (
  lookId: string,
  key: TListenerResponseKey,
  value: number,
  own: number,
) => {
  const all = allChoices();
  const next: Partial<Pick<ISceneResponse, TListenerResponseKey>> = {
    ...all.get(lookId),
  };
  const clamped = clampTo(key, value);
  if (clamped === clampTo(key, own)) {
    delete next[key];
  } else {
    next[key] = clamped;
  }
  if (next[key] === all.get(lookId)?.[key]) {
    return;
  }
  if (Object.keys(next).length === 0) {
    all.delete(lookId);
  } else {
    all.set(lookId, next);
  }
  save();
};

/** Back to the timing `lookId` came with. */
export const clearListenerResponse = (lookId: string) => {
  if (allChoices().delete(lookId)) {
    save();
  }
};

// *** What each visualizer came with ******************************************

/**
 * The response in the pack the graph is drawing, by look id, reported by the
 * scene once it has loaded. The picker's listings do not carry it, and the
 * pack that is actually on screen is the one whose timing the sliders start
 * from. For this session only: loading the scene is what learns it again.
 */
const own = new Map<string, ISceneResponse>();
const ownListeners = new Set<() => void>();

const sameResponse = (left: ISceneResponse, right: ISceneResponse) =>
  left.sensitivity === right.sensitivity &&
  left.threshold === right.threshold &&
  left.attack === right.attack &&
  left.release === right.release;

export const reportOwnResponse = (
  lookId: string,
  response: ISceneResponse | undefined,
) => {
  const next = response ?? NEUTRAL_RESPONSE;
  const known = own.get(lookId);
  if (known && sameResponse(known, next)) {
    return;
  }
  own.set(lookId, next);
  ownListeners.forEach((listener) => listener());
};

const subscribeOwn = (listener: () => void) => {
  ownListeners.add(listener);
  return () => {
    ownListeners.delete(listener);
  };
};

/** The response `lookId` came with, once its scene has loaded. */
export const useOwnResponse = (lookId: string) =>
  useSyncExternalStore(
    subscribeOwn,
    () => own.get(lookId),
    () => undefined,
  );
