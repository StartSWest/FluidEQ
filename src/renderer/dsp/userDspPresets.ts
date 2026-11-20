/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import type { IDspSettings, IEqSettings } from '../../common/dsp/chain';
import {
  portableDspChainSettings,
  portableDspCurve,
} from '../../common/dsp/dspChainPresetFile';
import {
  USER_DSP_PRESET_PREFIX,
  cleanUserPresetName,
  readUserPresetList,
  uniqueUserPresetName,
  type IUserDspPreset,
} from '../../common/userPresetsFile';
import { readUserPresets, writeUserPresets } from '../utils/equalizerApi';
import { DSP_PRESETS_CHANGED } from './favouriteDspPresets';

export type { IUserDspPreset } from '../../common/userPresetsFile';
export {
  USER_DSP_PRESET_NAME_MAX,
  USER_DSP_PRESET_PREFIX,
} from '../../common/userPresetsFile';

/**
 * The listener's own presets, as main keeps them in `user-presets.json`
 * (`main/ipc/userPresets.ts`): read once, then held here, and every change
 * sent back whole. A change shows at once and is taken back if main cannot
 * keep it — the promise then rejects with main's reason — so the list on
 * screen is never one that will not be there next time. Changes run one
 * after another, each from the list the one before left, so two quick
 * presses never write over each other. The pattern My curves set
 * (`myCurvesStore.ts`).
 */

export interface IUserDspPresetsState {
  presets: readonly IUserDspPreset[];
  /** Main has answered with the list. */
  isLoaded: boolean;
  /** Main could not read the list; nothing may change it until it can. */
  isFailed: boolean;
}

const UNREAD: IUserDspPresetsState = {
  presets: [],
  isLoaded: false,
  isFailed: false,
};

/**
 * Where every version before kept the list, in the window's own storage.
 * Read once, handed to main, and then forgotten.
 */
const LEFT_IN_WINDOW_KEY = 'fluideq.dsp.userChainPresets.v1';

type TListener = () => void;
const listeners = new Set<TListener>();
let state: IUserDspPresetsState = UNREAD;
let loading: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();

const publish = (next: IUserDspPresetsState) => {
  const isNewList = next.presets !== state.presets;
  state = next;
  listeners.forEach((listener) => listener());
  // The pickers that read the list through the catalogue listen for this,
  // and only a list that changed is news to them.
  if (isNewList) {
    window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
  }
};

const leftInWindow = (): IUserDspPreset[] => {
  try {
    const raw = window.localStorage.getItem(LEFT_IN_WINDOW_KEY);
    return raw ? readUserPresetList(JSON.parse(raw)) : [];
  } catch {
    // Nothing readable was left there; main's list stands alone.
    return [];
  }
};

const forgetLeftInWindow = () => {
  try {
    window.localStorage.removeItem(LEFT_IN_WINDOW_KEY);
  } catch {
    // A store that cannot be reached holds nothing to hand over again.
  }
};

/**
 * Main's list, and anything still in the window's old storage that main does
 * not have yet after it: merged by id rather than dropped, because a build
 * from before the move may have saved more there after the first hand-over.
 * The old storage is forgotten only once main has kept what it held.
 */
const load = async () => {
  const kept = readUserPresetList(await readUserPresets());
  const known = new Set(kept.map((preset) => preset.id));
  const left = leftInWindow().filter((preset) => !known.has(preset.id));
  const presets =
    left.length > 0 ? readUserPresetList([...kept, ...left]) : kept;
  if (left.length > 0) {
    await writeUserPresets(presets);
  }
  forgetLeftInWindow();
  // Nothing kept anywhere is the list the window already holds.
  publish({
    presets: presets.length === 0 ? state.presets : presets,
    isLoaded: true,
    isFailed: false,
  });
};

/** Read the list from main, once; later calls wait on the same read. */
export const ensureUserDspPresetsLoaded = (): Promise<void> => {
  loading =
    loading ??
    load().catch((error: unknown) => {
      loading = undefined;
      publish({ ...UNREAD, isFailed: true });
      throw error;
    });
  return loading;
};

const subscribe = (listener: TListener) => {
  listeners.add(listener);
  if (!state.isLoaded && !state.isFailed) {
    // The failure is the state the subscriber is about to read.
    ensureUserDspPresetsLoaded().catch(() => undefined);
  }
  return () => {
    listeners.delete(listener);
  };
};

const readState = () => state;

export const useUserDspPresetsState = (): IUserDspPresetsState =>
  useSyncExternalStore(subscribe, readState, readState);

/** The list as it stands; empty until main has answered. */
export const readUserDspPresets = (): readonly IUserDspPreset[] =>
  state.presets;

export const findUserDspPreset = (id: string): IUserDspPreset | undefined =>
  state.presets.find((preset) => preset.id === id);

/**
 * One change to the list: `make` gets the list as it stands and returns the
 * next one, or the same one for no change. Shown at once, kept by main, and
 * taken back if main refuses.
 */
const change = <T>(
  make: (presets: readonly IUserDspPreset[]) => {
    next: readonly IUserDspPreset[];
    value: T;
  },
): Promise<T> => {
  const run = queue.then(async () => {
    await ensureUserDspPresetsLoaded();
    const before = state.presets;
    const { next, value } = make(before);
    if (next === before) {
      return value;
    }
    publish({ presets: next, isLoaded: true, isFailed: false });
    try {
      await writeUserPresets(next);
    } catch (error) {
      publish({ presets: before, isLoaded: true, isFailed: false });
      throw error;
    }
    return value;
  });
  queue = run.catch(() => undefined);
  return run;
};

/** An id no preset has: the time, and a little chance against the same ms. */
export const newUserPresetId = (): string =>
  `${USER_DSP_PRESET_PREFIX}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

const presetOf = (
  id: string,
  name: string,
  settings: IDspSettings,
  curve: IEqSettings | undefined,
): IUserDspPreset => {
  const tone = portableDspCurve(curve);
  return {
    id,
    name,
    settings: portableDspChainSettings(settings),
    ...(tone ? { curve: tone } : {}),
  };
};

/**
 * The DSP page's Save: kept under the name typed, over the preset of the same
 * name if there is one — its dialog says so before it happens
 * (`DspPresetSaveDialog`) — and at the top of the list otherwise.
 */
export const saveUserDspPreset = (
  name: string,
  settings: IDspSettings,
  curve?: IEqSettings,
): Promise<IUserDspPreset> =>
  change((current) => {
    const clean = cleanUserPresetName(name);
    const already = current.find(
      (preset) => preset.name.toLowerCase() === clean.toLowerCase(),
    );
    const saved = presetOf(
      already?.id ?? newUserPresetId(),
      clean,
      settings,
      curve,
    );
    return {
      next: already
        ? current.map((preset) => (preset.id === already.id ? saved : preset))
        : [saved, ...current],
      value: saved,
    };
  });

/**
 * A new preset of the listener's own, at the top of the list. A name another
 * preset holds is numbered rather than written over: "My Pop" made twice is
 * two presets. `id` is the one it was edited under before it was kept
 * (`presetEditSession.ts`), so the layer that played it keeps its name.
 */
export const addUserDspPreset = (
  name: string,
  settings: IDspSettings,
  curve: IEqSettings | undefined,
  id: string = newUserPresetId(),
): Promise<IUserDspPreset> =>
  change((current) => {
    const saved = presetOf(
      id,
      uniqueUserPresetName(
        name,
        current.map((preset) => preset.name),
      ),
      settings,
      curve,
    );
    return { next: [saved, ...current], value: saved };
  });

/** A preset's rack and curve replaced; its name and place kept. */
export const updateUserDspPreset = (
  id: string,
  settings: IDspSettings,
  curve: IEqSettings | undefined,
): Promise<IUserDspPreset | undefined> =>
  change((current) => {
    const already = current.find((preset) => preset.id === id);
    if (!already) {
      return { next: current, value: undefined };
    }
    const saved = presetOf(id, already.name, settings, curve);
    return {
      next: current.map((preset) => (preset.id === id ? saved : preset)),
      value: saved,
    };
  });

/**
 * A preset named again, in place. A name another preset holds is numbered;
 * an empty one changes nothing.
 */
export const renameUserDspPreset = (
  id: string,
  name: string,
): Promise<IUserDspPreset | undefined> =>
  change((current) => {
    const already = current.find((preset) => preset.id === id);
    const others = current
      .filter((preset) => preset.id !== id)
      .map((preset) => preset.name);
    const next = uniqueUserPresetName(name, others);
    if (!already || next === '' || next === already.name) {
      return { next: current, value: already };
    }
    const renamed = { ...already, name: next };
    return {
      next: current.map((preset) => (preset.id === id ? renamed : preset)),
      value: renamed,
    };
  });

/** A copy of a preset straight after it, under its name numbered. */
export const duplicateUserDspPreset = (
  id: string,
): Promise<IUserDspPreset | undefined> =>
  change((current) => {
    const at = current.findIndex((preset) => preset.id === id);
    if (at < 0) {
      return { next: current, value: undefined };
    }
    const source = current[at];
    const copy: IUserDspPreset = {
      ...source,
      id: newUserPresetId(),
      name: uniqueUserPresetName(
        source.name,
        current.map((preset) => preset.name),
      ),
    };
    return {
      next: [...current.slice(0, at + 1), copy, ...current.slice(at + 1)],
      value: copy,
    };
  });

export const removeUserDspPreset = (id: string): Promise<void> =>
  change((current) => {
    const next = current.filter((preset) => preset.id !== id);
    return {
      next: next.length === current.length ? current : next,
      value: undefined,
    };
  });
