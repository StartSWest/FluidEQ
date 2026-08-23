/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IEqSettings,
  clampDspSettings,
  DSP_DEFAULTS,
} from '../../common/dsp/chain';

/**
 * Presets the user made, kept whole.
 *
 * The factory list stores fifteen gains and a handful of settings, because a
 * curve written by hand against a fixed rack is what those are. A saved preset
 * is not that: it is whatever the user had at the moment they saved it —
 * thirty-one bands from an import, two of them reacting, a character, a
 * topology, a phase mode — and squeezing it into fifteen numbers would hand
 * back something subtly different from what was saved, which is the one thing a
 * save must never do.
 *
 * So this stores the whole `IEqSettings` and applying one is an assignment.
 * They are separate from the factory list for the same reason they are stored
 * differently: nothing in the app should be able to overwrite them, and they
 * are not translated because the user named them.
 */
export interface IUserPreset {
  /** Prefixed, so the picker can tell whose preset it is by the value alone. */
  id: string;
  name: string;
  eq: IEqSettings;
}

/** What marks an id as belonging to the user rather than to the factory list. */
export const USER_PRESET_PREFIX = 'user:';

const STORAGE_KEY = 'fluideq.dsp.userPresets.v1';

/** Long enough to name a curve, short enough to sit in the picker. */
export const USER_PRESET_NAME_MAX = 40;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Everything that came out of storage, with anything unreadable dropped.
 *
 * Clamped on the way in rather than trusted: this is JSON from disk, it may
 * have been written by an older build, and a malformed band reaching the
 * coefficient maths is a silent wrong filter rather than an error.
 */
export const readUserPresets = (): IUserPreset[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry): IUserPreset[] => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string'
      ) {
        return [];
      }
      return [
        {
          id: entry.id,
          name: entry.name,
          eq: clampDspSettings({ ...DSP_DEFAULTS, eq: entry.eq }).eq,
        },
      ];
    });
  } catch {
    // Unreadable storage is the same answer as none. A saved preset is a
    // convenience, and losing the list must not cost the session.
    return [];
  }
};

const write = (presets: readonly IUserPreset[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // A full or disabled store costs the save, not the sound.
  }
};

/**
 * Save the rack as it stands, under a name.
 *
 * Saving over a name that already exists replaces it, which is what "save" with
 * a familiar name means everywhere else. `enabled` and `presetId` are dropped:
 * one is a bypass switch and the other is which preset was showing, and neither
 * is part of a curve.
 */
export const saveUserPreset = (name: string, eq: IEqSettings): IUserPreset => {
  const trimmed = name.trim().slice(0, USER_PRESET_NAME_MAX);
  const existing = readUserPresets();
  const already = existing.find(
    (one) => one.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const saved: IUserPreset = {
    id: already?.id ?? `${USER_PRESET_PREFIX}${Date.now().toString(36)}`,
    name: trimmed,
    eq: { ...eq, enabled: DSP_DEFAULTS.eq.enabled, presetId: '' },
  };
  write(
    already
      ? existing.map((one) => (one.id === already.id ? saved : one))
      : [saved, ...existing],
  );
  return saved;
};

export const removeUserPreset = (id: string): void => {
  write(readUserPresets().filter((one) => one.id !== id));
};

export const findUserPreset = (id: string): IUserPreset | undefined =>
  readUserPresets().find((one) => one.id === id);
