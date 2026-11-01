/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings, IEqSettings } from '../../common/dsp/chain';
import {
  portableDspChainSettings,
  portableDspCurve,
} from '../../common/dsp/dspChainPresetFile';
import {
  USER_DSP_PRESET_NAME_MAX,
  USER_DSP_PRESET_PREFIX,
  parseUserDspPresets,
  type IUserDspPreset,
} from '../../common/dsp/userPresets';
import { DSP_PRESETS_CHANGED } from './favouriteDspPresets';

export {
  USER_DSP_PRESET_NAME_MAX,
  USER_DSP_PRESET_PREFIX,
  type IUserDspPreset,
};

/**
 * Where this window keeps the saved chains. The window is where they are
 * saved and removed; the core keeps a copy of each change (`CoreCopies`), so
 * a game can put one on with no window to ask.
 */
const STORAGE_KEY = 'fluideq.dsp.userChainPresets.v1';

/** Read only complete, clamped chains; one malformed save cannot poison all. */
export const readUserDspPresets = (): IUserDspPreset[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseUserDspPresets(raw ? JSON.parse(raw) : []);
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
