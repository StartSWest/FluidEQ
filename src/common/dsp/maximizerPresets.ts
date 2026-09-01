/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMaximizerSettings } from './chain';

export const MAXIMIZER_PRESET_GROUPS = [
  'basic',
  'genre',
  'voice',
  'scene',
  'character',
] as const;

export type TMaximizerPresetGroup = (typeof MAXIMIZER_PRESET_GROUPS)[number];

/**
 * A profile owns the Maximizer's sound, not its place in the chain.
 *
 * Bypass is deliberately absent, exactly as it is in the Exciter's catalogue: a
 * chain preset decides whether this stage participates, and choosing how hard
 * it pushes is a separate decision from choosing whether it runs at all.
 */
export type IMaximizerPresetSettings = Pick<
  IMaximizerSettings,
  'driveDb' | 'ceilingDb' | 'lookAheadMs' | 'releaseMs'
>;

export interface IMaximizerPreset {
  id: string;
  labelKey: string;
  group: TMaximizerPresetGroup;
  settings: IMaximizerPresetSettings;
}

/**
 * The four numbers, in the order the dials sit on the page.
 *
 * Every profile is a point on the same two trade-offs and nothing else, which
 * is why this catalogue can be a table rather than prose. Drive against ceiling
 * decides how much louder the track gets; look-ahead against release decides
 * whether that loudness is heard as level or as the limiter working.
 *
 * Long look-ahead with a slow release is the transparent end — the reduction
 * arrives before the transient and leaves too slowly to modulate anything
 * audible. Short look-ahead with a fast release is the dense end: the limiter
 * lets the very front of a transient through and recovers inside the note,
 * which is what "punch" and what pumping both are, depending on the material.
 *
 * `broadcast`, `loud` and `default` carry the exact figures the chain presets
 * of the same name shipped with. They are referenced by id from `presets.ts`
 * rather than copied, so a chain and this picker cannot drift apart.
 */
const profile = (
  driveDb: number,
  ceilingDb: number,
  lookAheadMs: number,
  releaseMs: number,
): IMaximizerPresetSettings => ({
  driveDb,
  ceilingDb,
  lookAheadMs,
  releaseMs,
});

export const MAXIMIZER_PRESET_BY_ID = {
  safety: {
    id: 'safety',
    labelKey: 'dsp.maximizerPreset.safety',
    group: 'basic',
    // No drive at all: the ceiling and nothing else, which is what this stage
    // was before it could maximize. Unity in, unity out until a peak arrives.
    settings: profile(0, -1, 5, 100),
  },
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: profile(3, -1, 5, 100),
  },
  transparent: {
    id: 'transparent',
    labelKey: 'dsp.maximizerPreset.transparent',
    group: 'basic',
    settings: profile(1.5, -1.5, 14, 400),
  },
  streaming: {
    id: 'streaming',
    labelKey: 'dsp.maximizerPreset.streaming',
    group: 'basic',
    // −1 dBTP is the delivery ceiling every streaming platform asks for; the
    // lossy encoder they run afterwards moves peaks by more than that headroom
    // costs.
    settings: profile(4, -1, 8, 180),
  },
  broadcast: {
    id: 'broadcast',
    labelKey: 'dsp.preset.broadcast',
    group: 'basic',
    settings: profile(5, -0.8, 6, 90),
  },
  loud: {
    id: 'loud',
    labelKey: 'dsp.preset.loud',
    group: 'basic',
    settings: profile(6, -0.5, 8, 60),
  },

  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    settings: profile(4.5, -1, 4, 90),
  },
  metal: {
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    // Five decibels keeps the dense profile distinct without making the full
    // Metal chain three decibels louder than DSP Off.
    settings: profile(4.5, -0.8, 2.5, 60),
  },
  pop: {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    settings: profile(4, -1, 5, 110),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    // Synthesised material has no acoustic transient to protect, so the short
    // look-ahead that would flatten a snare costs nothing here.
    // The release and look-ahead supply the electronic density. Seven
    // decibels of drive made the matching whole chain audibly louder before
    // those timing choices could be heard.
    settings: profile(3.5, -0.8, 2, 50),
  },
  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: profile(1.25, -1, 2.5, 55),
  },
  jazz: {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    settings: profile(2, -1.5, 12, 420),
  },
  classical: {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    // The quietest profile in the catalogue on purpose: an orchestral crescendo
    // IS the music, and a limiter that holds it down has removed the piece.
    settings: profile(2.5, -2, 16, 650),
  },
  acoustic: {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    settings: profile(2.5, -1.5, 10, 300),
  },
  reggae: {
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    settings: profile(1.5, -1, 6, 140),
  },
  ambient: {
    id: 'ambient',
    labelKey: 'dsp.eqPreset.ambient',
    group: 'genre',
    settings: profile(2, -1.5, 14, 450),
  },

  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'voice',
    settings: profile(4, -1.5, 8, 160),
  },
  podcast: {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'voice',
    settings: profile(2.75, -1.5, 6, 140),
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    // Spoken-word peaks need restraint, not a louder average. The -3 dB
    // ceiling remains the delivery protection; two decibels is enough drive
    // to make narration even without pinning breaths to the limiter.
    settings: profile(2, -3, 10, 180),
  },

  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'scene',
    settings: profile(3, -1, 4, 120),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'scene',
    settings: profile(3, -2, 12, 380),
  },
  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    // Deep drive into a low ceiling. Late listening is about the gap between
    // the loudest and quietest moment being small enough that nothing has to be
    // turned up to follow the dialogue and back down for the next explosion.
    settings: profile(3, -3, 8, 250),
  },
  club: {
    id: 'club',
    labelKey: 'dsp.masterPreset.club',
    group: 'scene',
    settings: profile(8, -0.5, 2, 50),
  },

  punch: {
    id: 'punch',
    labelKey: 'dsp.maximizerPreset.punch',
    group: 'character',
    // The one profile that is deliberately NOT transparent: 1.5 ms is shorter
    // than a kick's own attack, so its first cycle passes before the limiter
    // has finished moving. That is the whole character.
    settings: profile(4, -1, 1.5, 70),
  },
} satisfies Record<string, IMaximizerPreset>;

export type TMaximizerPresetId = keyof typeof MAXIMIZER_PRESET_BY_ID;

export const MAXIMIZER_PRESETS: readonly IMaximizerPreset[] = Object.values(
  MAXIMIZER_PRESET_BY_ID,
);

export const isMaximizerPresetId = (id: string): id is TMaximizerPresetId =>
  Object.prototype.hasOwnProperty.call(MAXIMIZER_PRESET_BY_ID, id);

/** Build a fresh live processor state; bypass is the caller's to decide. */
export const maximizerPresetSettings = (
  id: TMaximizerPresetId,
  enabled: boolean,
): IMaximizerSettings => ({
  enabled,
  presetId: id,
  ...MAXIMIZER_PRESET_BY_ID[id].settings,
});
