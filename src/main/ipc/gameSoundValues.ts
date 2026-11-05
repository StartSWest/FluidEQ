/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { clampDspSettings } from '../../common/dsp/chain';
import { isGameCurveVoicing } from '../../common/dsp/gameCurves';
import type { TGameSeed } from '../../common/gaming';

/** A game row's id: what the window made it with, and nothing longer. */
const MAX_GAME_ID = 128;

export const asGameId = (value: unknown): string | undefined =>
  typeof value === 'string' &&
  value.trim() !== '' &&
  value.length <= MAX_GAME_ID &&
  [...value].every((character) => character >= ' ')
    ? value
    : undefined;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The seed as sent, or nothing for one main cannot make a copy from. */
export const asSeed = (value: unknown): TGameSeed | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  if (value.kind === 'rack' && isObject(value.dsp)) {
    // A curve is an EQ's settings, clamped as the rack's EQ is; a game curve
    // only a name main knows, whose bands main builds itself.
    return {
      kind: 'rack',
      dsp: clampDspSettings(value.dsp),
      curve: isObject(value.curve)
        ? clampDspSettings({ eq: value.curve }).eq
        : undefined,
      gameCurve:
        typeof value.gameCurve === 'string' &&
        isGameCurveVoicing(value.gameCurve)
          ? value.gameCurve
          : undefined,
    };
  }
  if (value.kind === 'yours' && typeof value.id === 'string') {
    return { kind: 'yours', id: value.id };
  }
  return undefined;
};
