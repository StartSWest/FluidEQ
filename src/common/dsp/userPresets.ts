/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IDspSettings, IEqSettings, clampDspSettings } from './chain';
import {
  portableDspChainSettings,
  portableDspCurve,
} from './dspChainPresetFile';

/** A chain the listener saved, under a name of their own. */
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The saved chains, read from anywhere they are kept — the window's storage,
 * or the copy the core keeps so a game or a song can put one on without the
 * window. Anything that is not a chain is dropped, never the list; each is
 * clamped as a file from another build is.
 */
export const parseUserDspPresets = (raw: unknown): IUserDspPreset[] =>
  Array.isArray(raw)
    ? raw.flatMap((entry): IUserDspPreset[] => {
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
            settings: portableDspChainSettings(
              clampDspSettings(entry.settings),
            ),
            ...(curve ? { curve } : {}),
          },
        ];
      })
    : [];
