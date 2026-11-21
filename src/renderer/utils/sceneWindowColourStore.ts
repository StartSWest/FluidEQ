/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  readSceneWindowColours,
  type ISceneWindowColours,
  type ISceneWindowColourStops,
} from 'common/sceneWindowColours';
import { readStored, removeStored, writeStored } from './graphStorage';
import {
  migrateStopKey,
  stopKeyOf,
  WINDOW_COLOUR_STOPS,
  type TWindowColourStop,
} from './sceneDayColours';

/**
 * The window colours a listener chose for a scene, by look id (Ivan,
 * 2026-11-14: "implement that", the tuning mockup): kept on this computer for
 * that scene only, like its sliders (`sceneParamStore.ts`), and worn in place
 * of the scene's own until "Use the scene's colours" forgets them. Always all
 * three: changing one keeps the scene's other two beside it, so a scene that
 * later names different colours still shows exactly what was chosen. Each of
 * the five points is kept apart (`sceneDayColours.ts`), the 0 point under the
 * look's id and the others under `<id>@<point>`: choosing one leaves the
 * others as the scene has them.
 */

const STORAGE_KEY = 'fluideq.sceneWindowColours';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readAll = (): Map<string, ISceneWindowColours> => {
  const all = new Map<string, ISceneWindowColours>();
  const stored = readStored(STORAGE_KEY);
  if (stored === null) {
    return all;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged record puts every scene back in its own colours, which is
    // what it would wear anyway.
    return all;
  }
  if (isRecord(parsed)) {
    Object.entries(parsed).forEach(([key, raw]) => {
      const colours = readSceneWindowColours(raw);
      if (colours) {
        // A day chosen under the two-point model is the 100 point's.
        all.set(migrateStopKey(key), colours);
      }
    });
  }
  return all;
};

let chosen: Map<string, ISceneWindowColours> | undefined;
const listeners = new Set<() => void>();

const all = () => {
  chosen ??= readAll();
  return chosen;
};

const save = () => {
  const current = all();
  if (current.size === 0) {
    removeStored(STORAGE_KEY);
  } else {
    writeStored(STORAGE_KEY, JSON.stringify(Object.fromEntries(current)));
  }
  listeners.forEach((listener) => listener());
};

/** The colours the listener chose for `lookId` at `stop`, or undefined. */
export const getChosenWindowColours = (
  lookId: string,
  stop: TWindowColourStop = '0',
) => all().get(stopKeyOf(lookId, stop));

/**
 * Chooses `colours` for `lookId` at `stop`, and the scene's own again when
 * they match it.
 */
export const setChosenWindowColours = (
  lookId: string,
  colours: ISceneWindowColours,
  own: ISceneWindowColours | undefined,
  stop: TWindowColourStop = '0',
) => {
  const key = stopKeyOf(lookId, stop);
  const same =
    own !== undefined &&
    own.surface === colours.surface &&
    own.accent === colours.accent &&
    own.glow === colours.glow;
  if (same) {
    if (all().delete(key)) {
      save();
    }
    return;
  }
  all().set(key, colours);
  save();
};

/** Back to the scene's own colours at `stop`. */
export const clearChosenStop = (lookId: string, stop: TWindowColourStop) => {
  if (all().delete(stopKeyOf(lookId, stop))) {
    save();
  }
};

/** Back to the scene's own colours at every point. */
export const clearChosenWindowColours = (lookId: string) => {
  const removed = WINDOW_COLOUR_STOPS.map((stop) =>
    all().delete(stopKeyOf(lookId, stop)),
  );
  if (removed.some(Boolean)) {
    save();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Every point the listener chose for `lookId`, as one text compared by
 * value: `useSyncExternalStore` wants the same answer for the same state,
 * and a map built per read would be a new one each time.
 */
const chosenKey = (lookId: string) =>
  WINDOW_COLOUR_STOPS.map((stop) => {
    const colours = all().get(stopKeyOf(lookId, stop));
    return colours
      ? `${stop}:${colours.surface}${colours.accent}${colours.glow}`
      : '';
  }).join(' ');

/** What the listener chose for `lookId`, point by point. */
export const useChosenWindowColourStops = (
  lookId: string,
): ISceneWindowColourStops => {
  const key = useSyncExternalStore(
    subscribe,
    () => (lookId ? chosenKey(lookId) : ''),
    () => '',
  );
  return stableStopsOf(lookId, key);
};

const NO_STOPS: ISceneWindowColourStops = {};

/** The last points built for each scene, with the text they were built at. */
let builtStops = new Map<
  string,
  { key: string; stops: ISceneWindowColourStops }
>();

/**
 * One object per scene and state, so the memos that read it run again only
 * when a choice changed: rebuilt from the store when its text for the scene
 * moves, which is the only time what it holds for that scene does.
 */
const stableStopsOf = (lookId: string, key: string) => {
  if (!lookId) {
    return NO_STOPS;
  }
  const built = builtStops.get(lookId);
  if (built?.key === key) {
    return built.stops;
  }
  const stops: Partial<Record<TWindowColourStop, ISceneWindowColours>> = {};
  WINDOW_COLOUR_STOPS.forEach((stop) => {
    const colours = all().get(stopKeyOf(lookId, stop));
    if (colours) {
      stops[stop] = colours;
    }
  });
  builtStops.set(lookId, { key, stops });
  return stops;
};

/** For tests: forget what was read, so the next read is from storage. */
export const resetChosenWindowColoursForTesting = () => {
  chosen = undefined;
  builtStops = new Map();
};
