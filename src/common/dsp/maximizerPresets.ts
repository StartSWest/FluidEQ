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
 * The GENRE profiles barely drive at all, and that is the point of them: a
 * record of any of those genres arrives already limited, so a second pass
 * buys distortion rather than density — what a genre wants from this stage is
 * its timing and a ceiling. The drive lives in the profiles named for a
 * destination or a loudness instead (`loud`, `broadcast`, `club`, `punch`),
 * where somebody asking for it has said so.
 *
 * Which is also why their ceilings sit at -1 dBTP and not lower. A ceiling
 * below that is headroom for a MASTER being delivered; in a playback chain it
 * is attenuation, because a modern record already peaks near full scale, so
 * every decibel of ceiling under -1 comes straight off everything that plays
 * through it. Classical, Jazz and Acoustic were at -2 and -1.5 beside a drive
 * that no longer exists, and measured between one and two decibels QUIETER
 * than DSP Off on real music — the opposite of the transparency they are
 * named for.
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
    settings: profile(0.5, -1, 4, 90),
  },
  metal: {
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    // The densest timing in the genre group — 2.5 ms in front of a wall of
    // guitar, recovered inside the note — and the drive kept small, because
    // a metal master is the most limited record anybody owns already.
    settings: profile(0.4, -0.8, 2.5, 60),
  },
  pop: {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    settings: profile(0.3, -1, 5, 110),
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
    settings: profile(0.3, -0.8, 2, 50),
  },
  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: profile(0.5, -1, 2.5, 55),
  },
  jazz: {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    settings: profile(0, -1, 12, 420),
  },
  classical: {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    /**
     * A ceiling and nothing else, because an orchestral crescendo IS the
     * music and a limiter that holds it down has removed the piece.
     *
     * The drive was 0.9 dB, chosen as "the quietest in the catalogue". That
     * reading was wrong about where classical peaks sit: a fortissimo on a
     * modern transfer is already at the top of the scale even though the
     * piece averages fifteen decibels below a pop master, so nine tenths of
     * a decibel is not a small amount of loudness — it is nine tenths of a
     * decibel of gain reduction landing on the climaxes and nowhere else.
     * Zero leaves the long look-ahead and the slow release to catch the
     * isolated peak an EQ curve makes, which is all this stage is for here.
     */
    settings: profile(0, -1, 16, 650),
  },
  acoustic: {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    settings: profile(0, -1, 10, 300),
  },
  reggae: {
    id: 'reggae',
    labelKey: 'dsp.eqPreset.reggae',
    group: 'genre',
    settings: profile(0, -1, 6, 140),
  },
  ambient: {
    id: 'ambient',
    labelKey: 'dsp.eqPreset.ambient',
    group: 'genre',
    // Long look-ahead and a slow release, and now barely any drive: two
    // decibels made this the hardest-driven genre profile in the catalogue,
    // on the one genre whose records are deliberately quiet and slow to
    // arrive. What it is for is catching the peak of a swell, not raising
    // the bed underneath it.
    settings: profile(0.8, -1.5, 14, 450),
  },

  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'voice',
    settings: profile(2, -1.5, 8, 160),
  },
  podcast: {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'voice',
    settings: profile(1.7, -1.5, 6, 140),
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    // Spoken-word peaks need restraint, not a louder average. The -3 dB
    // ceiling remains the delivery protection; two decibels is enough drive
    // to make narration even without pinning breaths to the limiter.
    settings: profile(0.6, -3, 10, 180),
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
    // Two decibels of ceiling is right here and nowhere else in this group: a
    // film mix is the one programme whose loudest moment is meant to be much
    // louder than its quietest, so the headroom is the point. The drive came
    // down from a full decibel because with it the whole Movie chain measured
    // past the window the catalogue holds itself to over real programme.
    settings: profile(0.7, -2, 12, 380),
  },
  lateNight: {
    id: 'lateNight',
    labelKey: 'dsp.eqPreset.lateNight',
    group: 'scene',
    // Deep drive into a low ceiling. Late listening is about the gap between
    // the loudest and quietest moment being small enough that nothing has to be
    // turned up to follow the dialogue and back down for the next explosion.
    settings: profile(2, -3, 8, 250),
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
