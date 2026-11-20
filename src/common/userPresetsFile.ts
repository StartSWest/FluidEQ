/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { IDspSettings, IEqSettings, clampDspSettings } from './dsp/chain';
import {
  portableDspChainSettings,
  portableDspCurve,
} from './dsp/dspChainPresetFile';

/**
 * The listener's own presets: a curve for the main EQ and a rack for the DSP
 * page each, under a name of their own (EQ page, Preset tab, "Yours").
 *
 * Kept by main in `user-presets.json` in the app's data folder, written whole
 * and atomically on every change. They used to live in the window's own
 * storage, where a full or refused store failed the write without a word:
 * the preset showed as saved and was gone at the next start.
 */
export const USER_PRESETS_FILENAME = 'user-presets.json';
const USER_PRESETS_STORE_VERSION = 1;

/** Every preset of the listener's own carries this before its own part. */
export const USER_DSP_PRESET_PREFIX = 'user-chain:';
export const USER_DSP_PRESET_NAME_MAX = 40;
/**
 * A ceiling for a file that is read whole at every start: far past what
 * anyone keeps by hand, and short of a damaged or hostile file with a
 * hundred thousand entries.
 */
export const USER_PRESET_LIST_MAX = 500;

export interface IUserDspPreset {
  id: string;
  name: string;
  settings: IDspSettings;
  /**
   * The tone that plays in the main EQ, if any — without it a preset saved
   * from Pop would come back without Pop's tone. Presets saved before the
   * tone left the rack have none, and carry theirs in the rack's EQ.
   */
  curve?: IEqSettings;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** A name as it is kept: trimmed, one line, no longer than the field. */
export const cleanUserPresetName = (name: string): string =>
  name.replace(/\s+/g, ' ').trim().slice(0, USER_DSP_PRESET_NAME_MAX).trim();

const NUMBERED = / \((\d+)\)$/;

/**
 * A name none of `taken` has, compared without case as a reader scanning the
 * list would: the name itself, or the first free "Name (2)", "Name (3)"…
 * A name already numbered is numbered again from its stem, so a copy of
 * "Night (2)" is "Night (3)" and never "Night (2) (2)" — the rule the saved
 * rooms follow (`uniqueRoomName`).
 */
export const uniqueUserPresetName = (
  name: string,
  taken: readonly string[],
): string => {
  const clean = cleanUserPresetName(name);
  const used = new Set(taken.map((one) => one.trim().toLowerCase()));
  if (clean === '' || !used.has(clean.toLowerCase())) {
    return clean;
  }
  const stem = clean.replace(NUMBERED, '').trim();
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${stem
      .slice(0, USER_DSP_PRESET_NAME_MAX - suffix.length)
      .trim()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
};

/** One kept preset, checked and clamped as an import's would be, or nothing. */
export const readStoredUserPreset = (
  value: unknown,
): IUserDspPreset | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, name, settings } = value;
  if (
    typeof id !== 'string' ||
    !id.startsWith(USER_DSP_PRESET_PREFIX) ||
    id.length > 100 ||
    typeof name !== 'string' ||
    cleanUserPresetName(name) === '' ||
    !isRecord(settings)
  ) {
    return undefined;
  }
  const curve = portableDspCurve(value.curve);
  return {
    id,
    name: cleanUserPresetName(name),
    settings: portableDspChainSettings(clampDspSettings(settings)),
    ...(curve ? { curve } : {}),
  };
};

/**
 * A list read from anywhere — the file, the window's message, the window's
 * old storage — each entry checked, an entry that is no preset or repeats an
 * id left out, no more than the list holds.
 */
export const readUserPresetList = (value: unknown): IUserDspPreset[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const ids = new Set<string>();
  return value
    .map(readStoredUserPreset)
    .filter((preset): preset is IUserDspPreset => {
      if (!preset || ids.has(preset.id)) {
        return false;
      }
      ids.add(preset.id);
      return true;
    })
    .slice(0, USER_PRESET_LIST_MAX);
};

/**
 * Whether a list the window sent may be kept: every entry a preset under its
 * own id and its own name, no more of them than the list holds. Anything
 * else is refused whole rather than tidied, because a tidied list is one the
 * window is not showing.
 */
export const isUserPresetListPayload = (
  value: unknown,
): value is IUserDspPreset[] =>
  Array.isArray(value) &&
  value.length <= USER_PRESET_LIST_MAX &&
  readUserPresetList(value).length === value.length &&
  value.every(
    (entry: unknown) =>
      isRecord(entry) &&
      typeof entry.name === 'string' &&
      entry.name === cleanUserPresetName(entry.name),
  );

export const toUserPresetStore = (presets: readonly IUserDspPreset[]): string =>
  `${JSON.stringify(
    {
      version: USER_PRESETS_STORE_VERSION,
      presets: presets.map(({ id, name, settings, curve }) => ({
        id,
        name,
        settings,
        ...(curve ? { curve } : {}),
      })),
    },
    null,
    2,
  )}\n`;

/**
 * The kept list read back; or nothing at all for a file that is not this
 * store — damaged, or written by a newer FluidEQ — which main sets aside
 * rather than overwrite.
 */
export const fromUserPresetStore = (
  contents: string,
): IUserDspPreset[] | undefined => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch {
    return undefined;
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== USER_PRESETS_STORE_VERSION ||
    !Array.isArray(parsed.presets)
  ) {
    return undefined;
  }
  return readUserPresetList(parsed.presets);
};
