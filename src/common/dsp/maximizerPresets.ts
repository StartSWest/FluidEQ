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
  'repair',
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
 * The genres' own profiles live in their racks (`genreRack.ts`) and barely
 * drive, and that is the point of them: a record of any genre arrives already
 * limited, so a second pass buys distortion rather than density — what a
 * genre wants from this stage is its timing and a ceiling. The drive lives in
 * the profiles named for a destination or a loudness instead (`loud`,
 * `broadcast`, `club`), where somebody asking for it has said so.
 *
 * Which is also why the ceilings sit at -1 dBTP and not lower. A ceiling
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
 * `broadcast` and `loud` carry the exact figures the chain presets of the
 * same name shipped with, and `default` is the Default chain's own. Every
 * chain references its profile by id from `presets.ts` rather than copying
 * it, so a chain and this picker cannot drift apart.
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
    // The Default chain's, which until 2026-09-23 had none and a streaming
    // Master instead: a -14 LUFS target that turned every loud record down
    // to it, 1.8 LU under DSP Off on the song corpus and 5 LU on the
    // loudest, so Default was the one preset quieter than no preset. A
    // decibel over this timing puts it 0.6 LU over DSP Off with the limiter
    // holding 0.7 dB on average; the three it carried before held 1.9.
    settings: profile(1, -1, 5, 100),
  },
  transparent: {
    id: 'transparent',
    labelKey: 'dsp.maximizerPreset.transparent',
    group: 'basic',
    // At -1 dBTP since 2026-09-22, for the reason the genre profiles are (the
    // note above this table). At -1.5 it was half a decibel of attenuation
    // that the chains playing it then (Warm, Car, Punch) won back with drive, which
    // is more limiting for the same level: at -1 the three measured 0.4 dB
    // louder at the same drive and pumped less, and Warm came back inside the
    // level gate's window once the Maximizer's platform (`limiter.h`) had
    // taken 0.2 dB from it.
    settings: profile(1.5, -1, 14, 400),
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
    // The Gaming chains' ceiling, in game mode: a millisecond of look-ahead
    // is all the delay it adds (look-ahead 1 and 2 ms measured the same), and
    // a release quick enough that a step after an explosion is heard at the
    // step's level. Without it the curve put a game's loud moments 7 dB over
    // full scale and Auto normalize turned the whole game down for tens of
    // seconds after each one; with it the chain sits 0.7 LU over DSP Off,
    // nothing over the ceiling, and it pumps no more than it did (2026-09-23).
    settings: profile(1, -1, 1, 60),
  },
  headphones: {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'scene',
    // The chains of this group have their own, so none of them opens its
    // picker on Custom. Each drive was measured with the Maximizer told the
    // chain's curve (`presetTone.ts`) over the song corpus, for the chain to
    // sit about half a decibel over DSP Off (2026-09-23).
    settings: profile(1.5, -1, 5, 100),
  },
  speakers: {
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'scene',
    settings: profile(0.8, -1, 5, 100),
  },
  laptop: {
    id: 'laptop',
    labelKey: 'dsp.eqPreset.laptop',
    group: 'scene',
    // At the group's 1.5 the chain sat +0.53 LU over DSP Off on the song
    // corpus and read +1.7 dB on the level gate's song, heard with its curve,
    // past the gate's +1.6. At 1.2: +0.40 and +1.4 (2026-09-25).
    settings: profile(1.2, -1, 5, 100),
  },
  car: {
    id: 'car',
    labelKey: 'dsp.eqPreset.car',
    group: 'scene',
    // The transparent timing, so the road's steady noise floor is not what
    // the limiter pumps against.
    settings: profile(2.3, -1, 14, 400),
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
    // has finished moving. That is the whole character, and it is the Punch
    // chain's too. Its drive was 4 dB, which on loud records held the limiter
    // 2.7 dB down on average; at 1.5 the Punch chain sits 0.7 LU over DSP Off
    // with half the reduction, where the transparent timing it used before
    // left it 0.6 under (2026-09-23).
    settings: profile(1.5, -1, 1.5, 70),
  },
  warm: {
    id: 'warm',
    labelKey: 'dsp.eqPreset.warm',
    group: 'character',
    // The Warm and Air chains' own, measured like the scene group's above:
    // Warm on the transparent timing, which keeps its broad low-mid lift
    // from being modulated, Air on the default's.
    settings: profile(1.7, -1, 14, 400),
  },
  clarity: {
    id: 'clarity',
    labelKey: 'dsp.eqPreset.air',
    group: 'character',
    settings: profile(1, -1, 5, 100),
  },

  vinyl: {
    id: 'vinyl',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'repair',
    // The Vinyl repair chain's. It borrowed the Master's Vinyl profile,
    // which is a cutting lathe's delivery target — -3 dBTP so a hot peak
    // cannot throw the cutting head — and nothing to do with playing a rip
    // back: it held the repaired record 2.6 LU under DSP Off. The default's
    // timing measured less pumping than the transparent one at the same
    // level, the restoration's gating included (2026-09-23).
    settings: profile(1.5, -1, 5, 100),
  },
  tape: {
    id: 'tape',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    // The Tape repair chain's. It had the Master's Reference, a tool that
    // brings two records to -18 LUFS for comparing them, and so played
    // every transfer louder than -18 quieter than it came: 7 LU under DSP
    // Off on the corpus. A decibel here puts it 0.5 LU over.
    settings: profile(1, -1, 5, 100),
  },
  lossy: {
    id: 'lossy',
    labelKey: 'dsp.preset.lossyRepair',
    group: 'repair',
    // The compressed-file repair's. It had the bare ceiling (`safety`),
    // which is all its rebuilt top needs to stay clean, and left the chain
    // level with DSP Off; half a decibel puts it 0.46 LU over with the
    // limiter holding 0.75 dB on average, beside the other repairs
    // (2026-09-23, with its own curve, `lossyRestore`).
    settings: profile(0.5, -1, 5, 100),
  },
} satisfies Record<string, IMaximizerPreset>;

export type TMaximizerPresetId = keyof typeof MAXIMIZER_PRESET_BY_ID;

export const MAXIMIZER_PRESETS: readonly IMaximizerPreset[] = Object.values(
  MAXIMIZER_PRESET_BY_ID,
);

export const isMaximizerPresetId = (id: string): id is TMaximizerPresetId =>
  Object.prototype.hasOwnProperty.call(MAXIMIZER_PRESET_BY_ID, id);

/**
 * A fresh live processor state from any profile, this table's or a genre's;
 * bypass is the caller's to decide.
 */
export const maximizerSettingsOf = (
  preset: IMaximizerPreset,
  enabled: boolean,
): IMaximizerSettings => ({
  enabled,
  presetId: preset.id,
  ...preset.settings,
});

/** Build a fresh live processor state; bypass is the caller's to decide. */
export const maximizerPresetSettings = (
  id: TMaximizerPresetId,
  enabled: boolean,
): IMaximizerSettings =>
  maximizerSettingsOf(MAXIMIZER_PRESET_BY_ID[id], enabled);
