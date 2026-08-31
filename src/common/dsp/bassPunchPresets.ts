/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IBassPunchSettings } from './chain';

export const BASS_PUNCH_PRESET_GROUPS = [
  'basic',
  'genre',
  'character',
  'scene',
] as const;

export type TBassPunchPresetGroup = (typeof BASS_PUNCH_PRESET_GROUPS)[number];

/**
 * A profile owns how Punch shapes the hit, not whether the stage runs.
 *
 * Bypass is absent for the same reason it is absent from every other
 * processor catalogue: a chain preset decides whether this stage
 * participates, and how it shapes time is a separate decision from whether
 * it shapes anything at all.
 */
export type IBassPunchPresetSettings = Pick<
  IBassPunchSettings,
  'splitHz' | 'attack' | 'sustain' | 'bloomAmount' | 'bloomDecayMs' | 'duck'
>;

export interface IBassPunchPreset {
  id: string;
  labelKey: string;
  group: TBassPunchPresetGroup;
  settings: IBassPunchPresetSettings;
}

/**
 * The six numbers, in the order `IBassPunchSettings` declares them.
 *
 * `attack` against `sustain` looks like one dial and is two, because the two
 * envelope followers behind them never overlap: `attack` scales how far the
 * fast follower stands above the slow one, which is only ever nonzero during
 * a rise, and `sustain` shapes the tail after they have converged. Negative
 * attack softens the leading edge; positive hardens it. Negative sustain is
 * dry and tight; positive is wet and long. A profile can hit hard and decay
 * short, or land soft and ring on — the two never fight over the same
 * milliseconds.
 *
 * `bloomAmount`/`bloomDecayMs` against `duck` is the second trade-off, and
 * both are read as "more weight" while doing opposite things to get there.
 * Bloom ADDS a short mono decay extension under the note — real tail energy,
 * which is also the one thing a neighbour through a wall can hear. Duck adds
 * nothing: it pulls the mid and high band down under the low band's own
 * envelope, buying apparent weight from headroom rather than spending any.
 *
 * `splitHz` is where bass ends for every one of those controls.
 */
const profile = (
  splitHz: number,
  attack: number,
  sustain: number,
  bloomAmount: number,
  bloomDecayMs: number,
  duck: number,
): IBassPunchPresetSettings => ({
  splitHz,
  attack,
  sustain,
  bloomAmount,
  bloomDecayMs,
  duck,
});

export const BASS_PUNCH_PRESET_BY_ID = {
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: profile(110, 0.2, 0.1, 0.25, 120, 0.15),
  },
  tight: {
    id: 'tight',
    labelKey: 'dsp.bassPunchPreset.tight',
    group: 'basic',
    // Bloom at 0: nothing here to decay. decayMs still holds a valid figure
    // because the field is inert rather than meaningless while amount is 0.
    settings: profile(110, -0.5, -0.6, 0, 60, 0.1),
  },
  open: {
    id: 'open',
    labelKey: 'dsp.bassPunchPreset.open',
    group: 'basic',
    settings: profile(110, 0.3, 0.6, 0.5, 180, 0.2),
  },

  punch: {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'character',
    // Hard leading edge, short tail: the hit arrives and gets out of its own
    // way rather than ringing on into the next one.
    settings: profile(100, 0.8, -0.2, 0.1, 80, 0.35),
  },
  slam: {
    id: 'slam',
    labelKey: 'dsp.bassPunchPreset.slam',
    group: 'character',
    // Attack at 1 and the heaviest duck in the catalogue: every bit of
    // apparent weight comes from the transient and from what gets out of its
    // way, none of it from added tail.
    settings: profile(100, 1, -0.4, 0, 60, 0.6),
  },
  dry: {
    id: 'dry',
    labelKey: 'dsp.bassPunchPreset.dry',
    group: 'character',
    settings: profile(110, -0.2, -0.7, 0, 60, 0.1),
  },
  wet: {
    id: 'wet',
    labelKey: 'dsp.bassPunchPreset.wet',
    group: 'character',
    settings: profile(110, 0.1, 0.7, 0.6, 200, 0.1),
  },
  soft: {
    id: 'soft',
    labelKey: 'dsp.bassPunchPreset.soft',
    group: 'character',
    settings: profile(110, -0.6, 0.2, 0.3, 140, 0.1),
  },

  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: profile(100, 0.6, 0.5, 0.45, 160, 0.45),
  },
  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    settings: profile(100, 0.6, -0.15, 0.15, 90, 0.3),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    // Synthesised material has no acoustic transient to protect, the same
    // reasoning the Exciter and Maximizer catalogues use for this genre.
    settings: profile(100, 0.7, 0.4, 0.35, 150, 0.5),
  },
  dnb: {
    id: 'dnb',
    labelKey: 'dsp.bassPunchPreset.dnb',
    group: 'genre',
    // Breaks move fast; a long bloom would smear one hit into the next, so
    // it is nearly off while attack and duck do the work of cutting through.
    settings: profile(90, 0.9, -0.5, 0.05, 50, 0.55),
  },

  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    // bloomAmount 0: a long decay is what wakes the room next door, so this
    // profile shapes the hit itself and adds no tail at all.
    settings: profile(100, -0.3, -0.3, 0, 80, 0.15),
  },
  club: {
    id: 'club',
    // The Master rack's word for the same room, as `bassForgePresets.ts` does:
    // a second key translated ten times would only be the same word, and a
    // duplicate is a key migration once it has shipped.
    labelKey: 'dsp.masterPreset.club',
    group: 'scene',
    settings: profile(100, 0.5, 0.5, 0.5, 200, 0.4),
  },
} satisfies Record<string, IBassPunchPreset>;

export type TBassPunchPresetId = keyof typeof BASS_PUNCH_PRESET_BY_ID;

export const BASS_PUNCH_PRESETS: readonly IBassPunchPreset[] = Object.values(
  BASS_PUNCH_PRESET_BY_ID,
);

export const isBassPunchPresetId = (id: string): id is TBassPunchPresetId =>
  Object.prototype.hasOwnProperty.call(BASS_PUNCH_PRESET_BY_ID, id);

/** Build a fresh live processor state; bypass is the caller's to decide. */
export const bassPunchPresetSettings = (
  id: TBassPunchPresetId,
  enabled: boolean,
): IBassPunchSettings => ({
  enabled,
  // A profile is a sound. Isolate is a way of listening to one, so loading a
  // profile never turns the monitor on -- it would be a preset that plays
  // something other than what it is named after.
  isolate: false,
  presetId: id,
  ...BASS_PUNCH_PRESET_BY_ID[id].settings,
});
