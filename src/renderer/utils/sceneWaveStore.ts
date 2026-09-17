/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  readSceneWave,
  sameSceneWave,
  type ISceneWave,
} from 'common/sceneWave';
import { readStored, removeStored, writeStored } from './graphStorage';

/**
 * The wave a listener set for one Plus visualizer, over the one its author
 * built it around.
 *
 * A scene is composed against a wave — the band its spectrum is drawn in,
 * the room its subject stands in — so it now travels with one
 * (`common/sceneWave.ts`), and the graph opens every scene on its author's.
 * Ivan: "when user shows it it will show that setting; however user can
 * override and it will be saved per scene and we have a restore button to
 * use instead."
 *
 * Per scene, and only when actually moved, the way the scene's own controls
 * beside it work (`sceneParamStore.ts`): a scene the listener has never
 * touched follows its author through every new version, and one they have
 * set keeps their setting until they put it back. A scene whose pack names
 * no wave is not stored here at all — there is nothing to override, and the
 * graph's own setting draws it, as it always did.
 *
 * On this computer, by look id. The graph's own wave is untouched by any of
 * this: it is what everything that is not a Plus scene is drawn with.
 */

const STORAGE_KEY = 'fluideq.sceneWaves';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readChoices = (): Map<string, ISceneWave> => {
  const choices = new Map<string, ISceneWave>();
  const stored = readStored(STORAGE_KEY);
  if (stored === null) {
    return choices;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    // A damaged entry puts every scene back on its author's wave, which is
    // what it would be drawn with anyway.
    return choices;
  }
  if (isRecord(parsed)) {
    Object.entries(parsed).forEach(([lookId, raw]) => {
      const wave = readSceneWave(raw);
      if (wave) {
        choices.set(lookId, wave);
      }
    });
  }
  return choices;
};

let choices: Map<string, ISceneWave> | undefined;
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

/** What the listener set for `lookId`, or nothing while they have not. */
export const useListenerWave = (lookId: string | undefined) =>
  useSyncExternalStore(
    subscribe,
    () => (lookId === undefined ? undefined : allChoices().get(lookId)),
    () => undefined,
  );

/**
 * Sets the wave for `lookId`. The author's own is passed so a slider brought
 * back onto it forgets the choice rather than pinning a copy of today's
 * value — the same reasoning as the scene's controls, and what makes Restore
 * and dragging back to the mark mean the same thing.
 */
export const setListenerWave = (
  lookId: string,
  wave: ISceneWave,
  authored: ISceneWave,
) => {
  const all = allChoices();
  const known = all.get(lookId);
  if (sameSceneWave(wave, authored)) {
    if (known === undefined) {
      return;
    }
    all.delete(lookId);
    save();
    return;
  }
  if (known && sameSceneWave(known, wave)) {
    return;
  }
  all.set(lookId, wave);
  save();
};

/** Back to the wave `lookId` came with. */
export const clearListenerWave = (lookId: string) => {
  if (allChoices().delete(lookId)) {
    save();
  }
};
