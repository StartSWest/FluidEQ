/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rack the Library player's own host runs, as the window hands it to the
 * core: the settings of the output the Library plays on, the preset curve its
 * Maximizer limits through, and the half of the rack's placement the window
 * knows — which engine, FluidEQ's switch, whether the engine is off, whether
 * this computer is sharing its sound. The other half, whether the Library is
 * heard and whether the engine took its song, is the player's, so the core
 * fills it in (`libraryRackGate`) and tells the window.
 *
 * The window stays the one sender of the engine's copy; the core is now the
 * one sender of the host's. Both follow `common/dsp/rackPlacement.ts`, so the
 * rack runs in exactly one place.
 */
import { CHAIN_MAX_TONE_BANDS, CHAIN_FILTER_TYPES } from '../dsp/chainWire';
import type { IPresetTone, IPresetToneBand } from '../dsp/chainWire';
import { clampDspSettings, type IDspSettings } from '../dsp/chain';
import { isAudioEngine } from '../audioEngine';
import type { IRackGate } from '../dsp/rackPlacement';

export const PLAYER_RACK_CHANNEL = 'library-player-rack';

/** The window's half of the gate. */
export type TWindowRackGate = Omit<
  IRackGate,
  'libraryAudible' | 'librarySourceReady'
>;

/** The player's half, which the core decides and the window adopts. */
export interface ILibraryRackGate {
  libraryAudible: boolean;
  librarySourceReady: boolean;
}

export interface IPlayerRackCopy {
  settings: IDspSettings;
  tone?: IPresetTone;
  gate: TWindowRackGate;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const parseToneBand = (raw: unknown): IPresetToneBand | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { type, frequency, gain, quality } = raw as Record<string, unknown>;
  const known = CHAIN_FILTER_TYPES.find((entry) => entry === type);
  return known !== undefined &&
    isFiniteNumber(frequency) &&
    isFiniteNumber(gain) &&
    isFiniteNumber(quality)
    ? { type: known, frequency, gain, quality }
    : undefined;
};

/**
 * The curve as the window sent it, or nothing. Refused whole rather than
 * repaired: a curve with one bad band is a curve nobody chose.
 */
export const parsePresetTone = (raw: unknown): IPresetTone | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { bands, matched } = raw as Record<string, unknown>;
  if (
    !Array.isArray(bands) ||
    bands.length > CHAIN_MAX_TONE_BANDS ||
    typeof matched !== 'boolean'
  ) {
    return undefined;
  }
  const parsed = bands.map(parseToneBand);
  return parsed.every((band): band is IPresetToneBand => band !== undefined)
    ? { bands: parsed, matched }
    : undefined;
};

const parseWindowGate = (raw: unknown): TWindowRackGate | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { engine, eqEnabled, eqLoaded, engineOff, sendingRawAudio } =
    raw as Record<string, unknown>;
  if (
    (engine !== null && !isAudioEngine(engine)) ||
    typeof eqEnabled !== 'boolean' ||
    typeof eqLoaded !== 'boolean' ||
    typeof engineOff !== 'boolean'
  ) {
    return undefined;
  }
  return {
    engine,
    eqEnabled,
    eqLoaded,
    engineOff,
    sendingRawAudio: sendingRawAudio === true,
  };
};

export const parsePlayerRackCopy = (
  raw: unknown,
): IPlayerRackCopy | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }
  const { settings, tone, gate } = raw as Record<string, unknown>;
  const windowGate = parseWindowGate(gate);
  if (windowGate === undefined || typeof settings !== 'object') {
    return undefined;
  }
  const parsedTone = tone === undefined ? undefined : parsePresetTone(tone);
  if (tone !== undefined && parsedTone === undefined) {
    return undefined;
  }
  return {
    settings: clampDspSettings(settings),
    ...(parsedTone === undefined ? {} : { tone: parsedTone }),
    gate: windowGate,
  };
};
