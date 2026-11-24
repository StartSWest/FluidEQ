/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each microphone's own sound: a whole rack with its Voice stage, always in
 * low lag, kept apart from the outputs' profiles (`mic-sound.json`). Ivan,
 * 2026-11-20: a mic gets the rack only, never the music EQ's layers, and is
 * always low lag like game mode.
 *
 * Kept apart on purpose: everything that walks the outputs' assignments
 * (`flushOutputDsp`, the profile store) must never meet a microphone and
 * write its music rack over the mic's file.
 */

import { clampDspSettings, IDspSettings } from './dsp/chain';
import { clampReverbSettings } from './dsp/reverbStage';
import { clampVoiceSettings } from './dsp/voiceStage';

export const MIC_SOUND_VERSION = 1;

export interface IMicSoundEntry {
  /** What Windows calls the mic, as last seen. */
  name: string;
  /** The mic profile it started from (`micProfiles.ts`), or '' for none. */
  profileId: string;
  /** Whether anything was changed since the profile was picked. */
  tuned: boolean;
  /** The mic's rack, Voice stage included, always in low lag. */
  settings: IDspSettings;
  /**
   * The Low cut card's three parts as they were when its switch turned them
   * off, so the switch turning it back on brings back the same voice. Not
   * on the wire: the rack only ever carries the values in play.
   */
  lowCutKept?: IMicLowCutParts;
}

/** The corner a low cut comes back at when nothing better is known. */
export const LOW_CUT_WHEN_ON = 80;

/** What the Low cut card's switch takes off and puts back together. */
export interface IMicLowCutParts {
  lowCutHz: number;
  proximityDb: number;
  deplosive: number;
}

export interface IMicSoundFile {
  version: number;
  /** The mic the Mic tab shows, by endpoint id. */
  selected: string;
  mics: Record<string, IMicSoundEntry>;
}

export const EMPTY_MIC_SOUND: IMicSoundFile = {
  version: MIC_SOUND_VERSION,
  selected: '',
  mics: {},
};

/** An endpoint id exactly as the helper and the engine name one. */
export const MIC_GUID =
  /^\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Any rack read back or sent over the bridge, made a mic's rack: the music
 * rack's own clamp, the Voice stage's, and low lag always on — a mic that
 * waited for a look-ahead would put that delay on every word.
 */
export const clampMicSettings = (value: unknown): IDspSettings => {
  const rack = clampDspSettings(value);
  return {
    ...rack,
    gameMode: true,
    voice: clampVoiceSettings(isRecord(value) ? value.voice : undefined),
    reverb: clampReverbSettings(isRecord(value) ? value.reverb : undefined),
  };
};

/**
 * Kept parts read back, each in the Voice stage's own range; a corner of 0,
 * or none at all, is nothing kept — there would be no low cut to bring back.
 */
const clampLowCutKept = (value: unknown): IMicLowCutParts | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const voice = clampVoiceSettings({ enabled: true, ...value });
  return voice.lowCutHz > 0
    ? {
        lowCutHz: voice.lowCutHz,
        proximityDb: voice.proximityDb,
        deplosive: voice.deplosive,
      }
    : undefined;
};

export const clampMicSoundEntry = (value: unknown): IMicSoundEntry => {
  const entry = isRecord(value) ? value : {};
  const lowCutKept = clampLowCutKept(entry.lowCutKept);
  return {
    name: typeof entry.name === 'string' ? entry.name.slice(0, 200) : '',
    profileId:
      typeof entry.profileId === 'string' ? entry.profileId.slice(0, 80) : '',
    tuned: entry.tuned === true,
    settings: clampMicSettings(entry.settings),
    ...(lowCutKept ? { lowCutKept } : {}),
  };
};

/** The file read back from disk, every entry made valid, bad ids dropped. */
export const clampMicSoundFile = (value: unknown): IMicSoundFile => {
  if (!isRecord(value)) {
    return EMPTY_MIC_SOUND;
  }
  const mics: Record<string, IMicSoundEntry> = Object.fromEntries(
    Object.entries(isRecord(value.mics) ? value.mics : {})
      .filter(([guid]) => MIC_GUID.test(guid))
      .map(([guid, entry]) => [guid.toUpperCase(), clampMicSoundEntry(entry)]),
  );
  const selected =
    typeof value.selected === 'string' && MIC_GUID.test(value.selected)
      ? value.selected.toUpperCase()
      : '';
  return { version: MIC_SOUND_VERSION, selected, mics };
};

/** Windows' "Audio enhancements" switch for one mic, as main could read it. */
export type TMicEffects = 'on' | 'off' | 'unknown';

/** What a mic's rack write came to; `saved` alone means no engine wrote it. */
export type TMicSoundResult =
  'written' | 'saved' | 'not-fluid' | 'not-installed' | 'rejected';
