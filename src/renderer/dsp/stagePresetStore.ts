/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings } from '../../common/dsp/chain';
import {
  PRESET_STAGES,
  TPresetStage,
  stagePresetPrefix,
  stagePresetSettings,
} from '../../common/dsp/stagePresets';
import { DSP_PRESETS_CHANGED } from './favouriteDspPresets';

/**
 * The profiles a listener saved of each stage, in this window's storage, as
 * every other saved DSP thing is (`userPresets.ts`, `savedRooms.ts`): applied
 * into the output being edited, which keeps its own rack.
 *
 * One key for all the stages, a list under each stage's name. Read back
 * through the rack's clamp, because this is JSON from disk that an older
 * build may have written.
 */
const STORAGE_KEY = 'fluideq.dsp.stagePresets.v1';

/** Long enough to name a sound, short enough to sit in the picker. */
export const STAGE_PRESET_NAME_MAX = 40;

export interface IStagePreset<S extends TPresetStage> {
  id: string;
  name: string;
  settings: IDspSettings[S];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readAll = (): Record<string, unknown> => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return isRecord(parsed) ? parsed : {};
  } catch {
    // Unreadable storage is the same answer as none: a saved profile is a
    // convenience, and losing the list must not cost the session.
    return {};
  }
};

export const readStagePresets = <S extends TPresetStage>(
  stage: S,
): IStagePreset<S>[] => {
  const list = readAll()[stage];
  if (!Array.isArray(list)) {
    return [];
  }
  return list.flatMap((entry): IStagePreset<S>[] =>
    isRecord(entry) &&
    typeof entry.id === 'string' &&
    entry.id.startsWith(stagePresetPrefix(stage)) &&
    typeof entry.name === 'string' &&
    entry.name.trim() !== ''
      ? [
          {
            id: entry.id,
            name: entry.name,
            settings: stagePresetSettings(stage, entry.settings),
          },
        ]
      : [],
  );
};

/** Every stage's list, with `stage`'s replaced. False when storage refused. */
const write = <S extends TPresetStage>(
  stage: S,
  list: readonly IStagePreset<S>[],
): boolean => {
  const all = readAll();
  const next: Record<string, unknown> = {};
  PRESET_STAGES.forEach((one) => {
    if (one !== stage && Array.isArray(all[one])) {
      next[one] = all[one];
    }
  });
  next[stage] = list;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
  return true;
};

/** An id no saved profile of the stage already holds. */
const freshId = (
  stage: TPresetStage,
  taken: readonly IStagePreset<TPresetStage>[],
): string => {
  const used = new Set(taken.map((one) => one.id));
  let id: string;
  do {
    id = `${stagePresetPrefix(stage)}${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  } while (used.has(id));
  return id;
};

/**
 * The stage as it is set, saved under a name.
 *
 * A name already in the list is saved over, as the EQ's saves are: that is
 * what saving under a familiar name means everywhere else, and the dialog
 * says so before it happens. `saved` is undefined when storage refused.
 */
export const saveStagePreset = <S extends TPresetStage>(
  stage: S,
  name: string,
  settings: IDspSettings[S],
): IStagePreset<S> | undefined => {
  const trimmed = name.trim().slice(0, STAGE_PRESET_NAME_MAX);
  if (trimmed === '') {
    return undefined;
  }
  const existing = readStagePresets(stage);
  const already = existing.find(
    (one) => one.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const saved: IStagePreset<S> = {
    id: already?.id ?? freshId(stage, existing),
    name: trimmed,
    settings: stagePresetSettings(stage, settings),
  };
  const list = already
    ? existing.map((one) => (one.id === already.id ? saved : one))
    : [saved, ...existing];
  return write(stage, list) ? saved : undefined;
};

/** False when storage refused, and the profile is still there. */
export const removeStagePreset = (stage: TPresetStage, id: string): boolean =>
  write(
    stage,
    readStagePresets(stage).filter((one) => one.id !== id),
  );
