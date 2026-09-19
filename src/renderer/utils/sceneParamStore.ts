/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import type { IScenePackParam } from 'common/scenePacks';
import { readStored, removeStored, writeStored } from './graphStorage';

/**
 * A Plus visualizer's own controls, as the listener set them: how many
 * elements it scatters, how much fire it throws, how far it travels - what
 * each one is belongs to the visualizer, which declares them itself, so this
 * store knows only a number per control per visualizer.
 *
 * The Studio is where an author decides what a scene comes with. This is the
 * same controls on the other side of the glass, for whoever is watching, and
 * it works the way the attack and release beside it do: a control the
 * listener has not moved is not stored, so a new version of a visualizer
 * brings its author's new value with it and only what was actually changed
 * stays put. Kept on this computer, by look id, for every version.
 */

export type TListenerParams = Readonly<Record<string, number>>;

const STORAGE_KEY = 'fluideq.sceneParams';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A stored entry, or undefined when nothing of it is usable. */
const readEntry = (raw: unknown): TListenerParams | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const entry: Record<string, number> = {};
  Object.entries(raw).forEach(([id, value]) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      entry[id] = value;
    }
  });
  return Object.keys(entry).length > 0 ? entry : undefined;
};

const readChoices = (): Map<string, TListenerParams> => {
  const choices = new Map<string, TListenerParams>();
  const stored = readStored(STORAGE_KEY);
  if (stored === null) {
    return choices;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged entry puts every visualizer back on its own controls, which
    // is what it would draw with anyway.
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

let choices: Map<string, TListenerParams> | undefined;
const listeners = new Set<() => void>();
/** Counts changes, for a reader that wants the whole record. */
let revision = 0;

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
  revision += 1;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Every visualizer's controls at once, for whoever has to send the lot
 * somewhere — the desktop's monitors, which have no store of their own. The
 * map is the store's own and is written in place, so the count of changes is
 * what a reader subscribes to.
 */
export const useAllListenerParams = (): ReadonlyMap<
  string,
  TListenerParams
> => {
  useSyncExternalStore(
    subscribe,
    () => revision,
    () => 0,
  );
  return allChoices();
};

/** What the listener set for `lookId`, one stable object per change. */
export const useListenerParams = (lookId: string) =>
  useSyncExternalStore(
    subscribe,
    () => allChoices().get(lookId),
    () => undefined,
  );

/**
 * Sets one control for `lookId`. The visualizer's own value is passed so a
 * slider brought back onto it forgets the choice rather than pinning a copy
 * of today's default. The scene's own tuner clamps what it is given, so a
 * control whose range an author narrows in a new version cannot carry a
 * value out of it.
 */
export const setListenerParam = (
  lookId: string,
  id: string,
  value: number,
  own: number,
) => {
  const all = allChoices();
  const next: Record<string, number> = { ...all.get(lookId) };
  if (value === own) {
    delete next[id];
  } else {
    next[id] = value;
  }
  if (next[id] === all.get(lookId)?.[id]) {
    return;
  }
  if (Object.keys(next).length === 0) {
    all.delete(lookId);
  } else {
    all.set(lookId, next);
  }
  save();
};

/** Back to the controls `lookId` came with. */
export const clearListenerParams = (lookId: string) => {
  if (allChoices().delete(lookId)) {
    save();
  }
};

// *** What each visualizer came with ******************************************

/**
 * The controls in the pack the graph is drawing, by look id, reported by the
 * scene once it has loaded: their ids, their names in the listener's own
 * language, their range and the value their author gave them. The picker's
 * listings do not carry them, and there is nothing to draw a row from until
 * the pack that is actually on screen has arrived. For this session only.
 */
const own = new Map<string, readonly IScenePackParam[]>();
const ownListeners = new Set<() => void>();

const sameParams = (
  left: readonly IScenePackParam[],
  right: readonly IScenePackParam[],
) =>
  left.length === right.length &&
  left.every((param, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      param.id === other.id &&
      param.min === other.min &&
      param.max === other.max &&
      param.value === other.value
    );
  });

export const reportOwnParams = (
  lookId: string,
  params: readonly IScenePackParam[],
) => {
  const known = own.get(lookId);
  if (known && sameParams(known, params)) {
    return;
  }
  own.set(lookId, params);
  ownListeners.forEach((listener) => listener());
};

const subscribeOwn = (listener: () => void) => {
  ownListeners.add(listener);
  return () => {
    ownListeners.delete(listener);
  };
};

/** The controls `lookId` came with, once its scene has loaded. */
export const useOwnParams = (lookId: string) =>
  useSyncExternalStore(
    subscribeOwn,
    () => own.get(lookId),
    () => undefined,
  );
