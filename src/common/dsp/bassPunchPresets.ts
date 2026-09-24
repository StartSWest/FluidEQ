/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBassPunchSettings } from './chain';

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
  | 'splitHz'
  | 'attack'
  | 'sustain'
  | 'bloomAmount'
  | 'bloomDecayMs'
  | 'duck'
  | 'mix'
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
 * Attack scales a bounded onset envelope with a short release across the
 * first bass cycles. Sustain fades into the tail as that envelope recedes.
 * Negative attack softens the hit; negative sustain shortens its decay.
 * Default, Tight and Punch emphasize the hit without adding a bloom tail.
 *
 * Bloom adds a short mono decay extension. Tail duck pulls only that added
 * tail down under a new hit, preserving the original mids and highs. With
 * bloom at zero, its stored duck setting is inert.
 *
 * `splitHz` focuses the detector and shaper within the bass band; the final
 * contribution filter prevents their changes from extending into the mids.
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
  mix: 1,
});

export const BASS_PUNCH_PRESET_BY_ID = {
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    // Start with impact and separation. A generated decay masks the next hit.
    settings: profile(120, 0.65, -0.3, 0, 80, 0),
  },
  tight: {
    id: 'tight',
    labelKey: 'dsp.bassPunchPreset.tight',
    group: 'basic',
    // Bloom at 0: nothing here to decay. decayMs still holds a valid figure
    // because the field is inert rather than meaningless while amount is 0.
    settings: profile(120, 0.5, -0.6, 0, 60, 0),
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
    /**
     * Hard leading edge, short tail: the hit arrives and gets out of its own
     * way rather than ringing on into the next one.
     *
     * Retuned 2026-09-19, when the Punch chain measured as no punch at all:
     * the attack is at the top of its range, the tail shorter, and the split
     * moved from 120 Hz down to 95 so the shaper works on the kick rather
     * than on the bass line above it. Measured on a real programme, the low
     * band's crest — how far a hit stands above the bass it sits in — went
     * from 3.2 dB over DSP Off to 4.8.
     */
    settings: profile(95, 1, -0.6, 0, 80, 0),
  },
  slam: {
    id: 'slam',
    labelKey: 'dsp.bassPunchPreset.slam',
    group: 'character',
    // Maximum attack and a shortened decay; zero bloom leaves tail duck inert.
    settings: profile(130, 1, -0.5, 0, 60, 0),
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
    // Dance-floor impact comes from the hit and the space after it.
    settings: profile(120, 0.7, -0.15, 0.15, 100, 0.5),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    settings: profile(100, 0.25, 0.65, 0.6, 220, 0.25),
  },
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    // Fast impact and no tail: repeated effects remain separate rather than
    // turning a busy scene into one continuous low-frequency bed.
    settings: profile(100, 0.75, -0.35, 0.05, 60, 0.45),
  },
} satisfies Record<string, IBassPunchPreset>;

export type TBassPunchPresetId = keyof typeof BASS_PUNCH_PRESET_BY_ID;

export const BASS_PUNCH_PRESETS: readonly IBassPunchPreset[] = Object.values(
  BASS_PUNCH_PRESET_BY_ID,
);

export const isBassPunchPresetId = (id: string): id is TBassPunchPresetId =>
  Object.prototype.hasOwnProperty.call(BASS_PUNCH_PRESET_BY_ID, id);

/**
 * A fresh live processor state from any profile, this table's or a genre's;
 * bypass is the caller's to decide.
 */
export const bassPunchSettingsOf = (
  preset: IBassPunchPreset,
  enabled: boolean,
): IBassPunchSettings => ({
  enabled,
  // A profile is a sound. Isolate is a way of listening to one, so loading a
  // profile never turns the monitor on -- it would be a preset that plays
  // something other than what it is named after.
  isolate: false,
  presetId: preset.id,
  ...preset.settings,
});

/** Build a fresh live processor state; bypass is the caller's to decide. */
export const bassPunchPresetSettings = (
  id: TBassPunchPresetId,
  enabled: boolean,
): IBassPunchSettings =>
  bassPunchSettingsOf(BASS_PUNCH_PRESET_BY_ID[id], enabled);
