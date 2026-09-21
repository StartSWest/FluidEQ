/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IDspSettings,
  IEqSettings,
  clampDspSettings,
} from '../../common/dsp/chain';
import {
  portableDspChainSettings,
  portableDspCurve,
} from '../../common/dsp/dspChainPresetFile';
import { DSP_PRESETS_CHANGED } from './favouriteDspPresets';

export interface IUserDspPreset {
  id: string;
  name: string;
  settings: IDspSettings;
  /**
   * The tone that played in the main EQ when the chain was saved, if any —
   * without it a chain saved from Pop would come back without Pop's tone.
   * Chains saved before the tone left the rack have none, and carry theirs
   * in the rack's EQ as they always did.
   */
  curve?: IEqSettings;
}

export const USER_DSP_PRESET_PREFIX = 'user-chain:';
export const USER_DSP_PRESET_NAME_MAX = 40;

const STORAGE_KEY = 'fluideq.dsp.userChainPresets.v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Read only complete, clamped chains; one malformed save cannot poison all. */
export const readUserDspPresets = (): IUserDspPreset[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry): IUserDspPreset[] => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string' ||
        !isRecord(entry.settings)
      ) {
        return [];
      }
      const curve = portableDspCurve(entry.curve);
      return [
        {
          id: entry.id,
          name: entry.name,
          settings: portableDspChainSettings(clampDspSettings(entry.settings)),
          ...(curve ? { curve } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
};

const write = (presets: readonly IUserDspPreset[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // A disabled or full store costs this convenience, never current audio.
  }
  window.dispatchEvent(new Event(DSP_PRESETS_CHANGED));
};

/** Save over a case-insensitive name, matching the EQ preset library. */
export const saveUserDspPreset = (
  name: string,
  settings: IDspSettings,
  curve?: IEqSettings,
): IUserDspPreset => {
  const trimmed = name.trim().slice(0, USER_DSP_PRESET_NAME_MAX);
  const existing = readUserDspPresets();
  const already = existing.find(
    (preset) => preset.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const tone = portableDspCurve(curve);
  const saved: IUserDspPreset = {
    id: already?.id ?? `${USER_DSP_PRESET_PREFIX}${Date.now().toString(36)}`,
    name: trimmed,
    settings: portableDspChainSettings(settings),
    ...(tone ? { curve: tone } : {}),
  };
  write(
    already
      ? existing.map((preset) => (preset.id === already.id ? saved : preset))
      : [saved, ...existing],
  );
  return saved;
};

export const findUserDspPreset = (id: string): IUserDspPreset | undefined =>
  readUserDspPresets().find((preset) => preset.id === id);

export const removeUserDspPreset = (id: string): void => {
  write(readUserDspPresets().filter((preset) => preset.id !== id));
};
