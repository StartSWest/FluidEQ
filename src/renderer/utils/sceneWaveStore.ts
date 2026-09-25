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
import {
  GRAPH_VIEWS,
  useWatchedGraphWave,
  type TGraphView,
} from './graphViewSettings';

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
 * AND PER VIEW MODE. The same scene is a band across a card in the pane, a
 * picture over the workspace expanded, and the whole glass in full screen, so
 * one wave for the three of them is a wave that is right in one and wrong in
 * the other two (Ivan, 2026-09-23). The graph's own wave is kept the same way
 * — `createPerViewSetting` in `graphViewSettings.ts` — and the author's wave
 * is what any mode nobody has moved is drawn with.
 *
 * On this computer, by look id. The graph's own wave is untouched by any of
 * this: it is what everything that is not a Plus scene is drawn with.
 */

const STORAGE_KEY = 'fluideq.sceneWaves';

/** What a listener set for one visualizer: a wave per mode, where they set one. */
type TSceneWaves = Partial<Record<TGraphView, ISceneWave>>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One visualizer's entry, in either shape it can be in storage.
 *
 * A wave written before the modes had their own was set with no notion of
 * them, so it is equally true of all three — the same reasoning, and the same
 * answer, as the per-view settings' own migration. It is rewritten in the new
 * shape as soon as anything is saved.
 */
const readModes = (raw: unknown): TSceneWaves | undefined => {
  const flat = readSceneWave(raw);
  if (flat) {
    return { normal: flat, expanded: flat, fullscreen: flat };
  }
  if (!isRecord(raw)) {
    return undefined;
  }
  const modes: TSceneWaves = {};
  GRAPH_VIEWS.forEach((mode) => {
    const wave = readSceneWave(raw[mode]);
    if (wave) {
      modes[mode] = wave;
    }
  });
  return Object.keys(modes).length > 0 ? modes : undefined;
};

const readChoices = (): Map<string, TSceneWaves> => {
  const choices = new Map<string, TSceneWaves>();
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
      const modes = readModes(raw);
      if (modes) {
        choices.set(lookId, modes);
      }
    });
  }
  return choices;
};

let choices: Map<string, TSceneWaves> | undefined;
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

/** A stable empty map, because a server snapshot must not change identity. */
const NO_WAVES: ReadonlyMap<string, ISceneWave> = new Map();

let watched: ReadonlyMap<string, ISceneWave> = NO_WAVES;
/** Which change `watched` was built from; -1 so the first read builds it. */
let watchedAt = -1;

/**
 * Every visualizer's wave as it is watched, for whoever has to send the lot
 * somewhere — the desktop's monitors, which have no store of their own. Full
 * screen's, because a desktop background is watched the way full screen is
 * (`getWatchedGraphWave`); a scene nobody has moved there is left out, and the
 * sender falls back to its author's.
 *
 * Built once per change rather than per read: the sender hands this to a
 * `useMemo`, and a fresh map every render would rebuild the tuning and send it
 * again on every render.
 */
const readWatched = (): ReadonlyMap<string, ISceneWave> => {
  if (watchedAt !== revision) {
    const next = new Map<string, ISceneWave>();
    allChoices().forEach((modes, lookId) => {
      const wave = modes.fullscreen;
      if (wave) {
        next.set(lookId, wave);
      }
    });
    watched = next;
    watchedAt = revision;
  }
  return watched;
};

export const useWatchedListenerWaves = (): ReadonlyMap<string, ISceneWave> =>
  useSyncExternalStore(subscribe, readWatched, () => NO_WAVES);

/** What the listener set for `lookId` in `view`, or nothing while they have not. */
export const useListenerWave = (lookId: string | undefined, view: TGraphView) =>
  useSyncExternalStore(
    subscribe,
    () => (lookId === undefined ? undefined : allChoices().get(lookId)?.[view]),
    () => undefined,
  );

/**
 * The wave a visualizer is watched with, wherever it is watched rather than
 * read against a grid — the desktop, the Library's player and its EQ screen,
 * the backdrop behind a video: the listener's own for full screen, else its
 * author's, else the graph's own full-screen wave. The graph's rule for its
 * full-screen view (`FrequencyResponseChart.tsx`), in one place, because the
 * player once drew its author's wave while the desktop beside it drew the
 * listener's.
 */
export const watchedSceneWave = (
  chosen: ISceneWave | undefined,
  authored: ISceneWave | undefined,
  graph: ISceneWave,
): ISceneWave => (authored ? (chosen ?? authored) : graph);

/** `watchedSceneWave` for one visualizer, kept current. */
export const useWatchedSceneWave = (
  lookId: string | undefined,
  authored: ISceneWave | undefined,
): ISceneWave => {
  const chosen = useListenerWave(authored ? lookId : undefined, 'fullscreen');
  const graph = useWatchedGraphWave();
  return watchedSceneWave(chosen, authored, graph);
};

/** The entry with one mode taken out, or nothing left to keep. */
const without = (
  modes: TSceneWaves | undefined,
  view: TGraphView,
): TSceneWaves | undefined => {
  const rest = { ...modes };
  delete rest[view];
  return Object.keys(rest).length > 0 ? rest : undefined;
};

/**
 * Sets the wave for `lookId` in `view`. The author's own is passed so a slider
 * brought back onto it forgets the choice rather than pinning a copy of
 * today's value — the same reasoning as the scene's controls, and what makes
 * Restore and dragging back to the mark mean the same thing.
 */
export const setListenerWave = (
  lookId: string,
  view: TGraphView,
  wave: ISceneWave,
  authored: ISceneWave,
) => {
  const all = allChoices();
  const modes = all.get(lookId);
  const known = modes?.[view];
  if (sameSceneWave(wave, authored)) {
    if (known === undefined) {
      return;
    }
    const rest = without(modes, view);
    if (rest) {
      all.set(lookId, rest);
    } else {
      all.delete(lookId);
    }
    save();
    return;
  }
  if (known && sameSceneWave(known, wave)) {
    return;
  }
  all.set(lookId, { ...modes, [view]: wave });
  save();
};

/**
 * Back to the wave `lookId` came with, in the mode being looked at. The other
 * two modes keep what they were set to: Restore puts back the picture in front
 * of whoever pressed it, not three of them.
 */
export const clearListenerWave = (lookId: string, view: TGraphView) => {
  const all = allChoices();
  const modes = all.get(lookId);
  if (!modes?.[view]) {
    return;
  }
  const rest = without(modes, view);
  if (rest) {
    all.set(lookId, rest);
  } else {
    all.delete(lookId);
  }
  save();
};
