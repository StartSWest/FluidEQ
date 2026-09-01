/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings, clampDspSettings } from '../../common/dsp/chain';
import { portableDspChainSettings } from '../../common/dsp/dspChainPresetFile';

export interface IUserDspPreset {
  id: string;
  name: string;
  settings: IDspSettings;
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
      return [
        {
          id: entry.id,
          name: entry.name,
          settings: portableDspChainSettings(clampDspSettings(entry.settings)),
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
};

/** Save over a case-insensitive name, matching the EQ preset library. */
export const saveUserDspPreset = (
  name: string,
  settings: IDspSettings,
): IUserDspPreset => {
  const trimmed = name.trim().slice(0, USER_DSP_PRESET_NAME_MAX);
  const existing = readUserDspPresets();
  const already = existing.find(
    (preset) => preset.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const saved: IUserDspPreset = {
    id: already?.id ?? `${USER_DSP_PRESET_PREFIX}${Date.now().toString(36)}`,
    name: trimmed,
    settings: portableDspChainSettings(settings),
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
