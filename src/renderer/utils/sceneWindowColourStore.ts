/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  readSceneWindowColours,
  type ISceneWindowColours,
} from 'common/sceneWindowColours';
import { readStored, removeStored, writeStored } from './graphStorage';
import { dayKeyOf, timeKeyOf, type TWindowTime } from './sceneDayColours';

/**
 * The window colours a listener chose for a scene, by look id (Ivan,
 * 2026-11-14: "implement that", the tuning mockup): kept on this computer for
 * that scene only, like its sliders (`sceneParamStore.ts`), and worn in place
 * of the scene's own until "Use the scene's colours" forgets them. Always all
 * three: changing one keeps the scene's other two beside it, so a scene that
 * later names different colours still shows exactly what was chosen. The
 * night's and the day's are kept apart (`sceneDayColours.ts`): choosing one
 * leaves the other as the scene has it.
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
    Object.entries(parsed).forEach(([lookId, raw]) => {
      const colours = readSceneWindowColours(raw);
      if (colours) {
        all.set(lookId, colours);
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

/** The colours the listener chose for `lookId`, or undefined for its own. */
export const getChosenWindowColours = (lookId: string) => all().get(lookId);

/**
 * Chooses `colours` for `lookId` at `time` - the night's under the look's id,
 * the day's under its day key (`sceneDayColours.ts`) - and the scene's own
 * again when they match it.
 */
export const setChosenWindowColours = (
  lookId: string,
  colours: ISceneWindowColours,
  own: ISceneWindowColours | undefined,
  time: TWindowTime = 'night',
) => {
  const key = timeKeyOf(lookId, time);
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

/** Back to the scene's own colours, night and day. */
export const clearChosenWindowColours = (lookId: string) => {
  const night = all().delete(lookId);
  const day = all().delete(dayKeyOf(lookId));
  if (night || day) {
    save();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** What the listener chose for `lookId`, one stable object per change. */
export const useChosenWindowColours = (lookId: string) =>
  useSyncExternalStore(
    subscribe,
    () => (lookId ? all().get(lookId) : undefined),
    () => undefined,
  );

/** For tests: forget what was read, so the next read is from storage. */
export const resetChosenWindowColoursForTesting = () => {
  chosen = undefined;
};
