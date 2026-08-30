/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMasterSettings } from './chain';

/**
 * Where the finished record is going, as the three numbers that decide it.
 *
 * A delivery target is not a taste: every service publishes one, they normalize
 * to it whether or not a master agrees, and mastering louder than the target
 * only buys attenuation at the other end with the dynamics already spent. So
 * these are named for destinations rather than for sounds, and none of them is
 * a "more" or a "less" of another.
 *
 * The three move together and that is why they are one profile. A target
 * without a matching ceiling is a request the true-peak limiter has to refuse,
 * and a target without a limiting allowance is a request it can only partly
 * grant — which is exactly the failure this stage shipped with.
 */
const profile = (
  loudnessTargetLufs: number,
  ceilingDb: number,
  peakLimitingDb: number,
): IMasterPresetSettings => ({
  loudnessTargetLufs,
  ceilingDb,
  peakLimitingDb,
});

export type IMasterPresetSettings = Pick<
  IMasterSettings,
  'loudnessTargetLufs' | 'ceilingDb' | 'peakLimitingDb'
>;

/**
 * What a destination is normalized BY, which is what actually separates them.
 *
 * Not a filing convenience. The three numbers of a streaming target mean
 * "whatever you deliver, this is what will be played" — the service turns you
 * down and the only thing mastering louder buys is having spent the dynamics
 * first. On a CD, a record or a club system nothing turns anybody down, so the
 * same numbers are a choice rather than a specification. Broadcast is a third
 * thing again: the figure is contractual and a delivery can be rejected for
 * missing it.
 *
 * Somebody picking from this list is answering "who decides my level" before
 * they are answering "how loud", and the headings say so.
 */
export const MASTER_PRESET_GROUPS = [
  'streaming',
  'broadcast',
  'unnormalized',
  'tool',
] as const;

export type TMasterPresetGroup = (typeof MASTER_PRESET_GROUPS)[number];

export interface IMasterPreset {
  id: string;
  labelKey: string;
  group: TMasterPresetGroup;
  settings: IMasterPresetSettings;
}

export const MASTER_PRESET_BY_ID = {
  /**
   * What the stage arrives at, and it is the streaming target.
   *
   * Not unity, and deliberately so: the Reset beside it exists to undo an
   * experiment, and landing on a chain that does nothing would make Reset
   * indistinguishable from switching the stage off. -14 LUFS is also the
   * honest default for a player, because it is where most of what anybody
   * plays through this has already been normalized to.
   */
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'streaming',
    settings: profile(-14, -1, 6),
  },
  streaming: {
    id: 'streaming',
    labelKey: 'dsp.masterPreset.streaming',
    group: 'streaming',
    // -14 LUFS is the figure Spotify, YouTube, Tidal and Amazon all normalize
    // to; -1 dBTP is the ceiling every one of them asks for, because their
    // lossy encoders overshoot the sample peak they were given.
    settings: profile(-14, -1, 6),
  },
  streamingQuiet: {
    id: 'streamingQuiet',
    labelKey: 'dsp.masterPreset.streamingQuiet',
    group: 'streaming',
    // Apple Music's Sound Check reference. Two decibels below the rest, so a
    // master made for it is turned up rather than down everywhere else.
    settings: profile(-16, -1, 5),
  },
  podcast: {
    id: 'podcast',
    labelKey: 'dsp.masterPreset.podcast',
    group: 'streaming',
    /**
     * The same -16 LUFS as Apple Music, and a very different allowance.
     *
     * Spoken word is the one programme where dynamic range is nearly all
     * liability: a listener in a car or on a train loses every syllable that
     * falls into the noise, and cannot ride the volume for each sentence.
     * Eight decibels is the limiter being asked to close that gap.
     */
    settings: profile(-16, -1, 8),
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.masterPreset.audiobook',
    group: 'streaming',
    // ACX, which is stricter than any music target on peaks: -3 dBTP is a
    // hard requirement of the submission, not a recommendation, and a title
    // is rejected for missing it.
    settings: profile(-20, -3, 4),
  },
  broadcast: {
    id: 'broadcast',
    labelKey: 'dsp.masterPreset.broadcast',
    group: 'broadcast',
    /**
     * EBU R128, and the one target here with legal weight behind it.
     *
     * Almost everything arrives louder than -23 LUFS, so this profile mostly
     * ATTENUATES — which is why its limiting allowance is small. Three decibels
     * is there for the rare quiet source, not because anything is expected to
     * need it.
     */
    settings: profile(-23, -1, 3),
  },
  broadcastUs: {
    id: 'broadcastUs',
    labelKey: 'dsp.masterPreset.broadcastUs',
    group: 'broadcast',
    // ATSC A/85, the American counterpart to R128. One decibel apart and a
    // different document: a delivery made to the wrong one is still wrong.
    settings: profile(-24, -2, 3),
  },
  cinema: {
    id: 'cinema',
    labelKey: 'dsp.masterPreset.cinema',
    group: 'broadcast',
    /**
     * Dialogue-normalized, and the quietest target this stage will accept.
     *
     * Two decibels of allowance is not timidity. A mix delivered here is
     * watched on a system with real headroom by somebody who has chosen to sit
     * still for two hours, and the range between a whisper and an explosion is
     * the point of it — limiting that range away is the one failure this
     * destination cannot forgive.
     */
    settings: profile(-27, -2, 2),
  },
  cd: {
    id: 'cd',
    labelKey: 'dsp.masterPreset.cd',
    group: 'unnormalized',
    // Nothing downstream turns a disc down, so the level is a decision rather
    // than a specification — and this is the one it usually gets.
    settings: profile(-10, -0.3, 8),
  },
  vinyl: {
    id: 'vinyl',
    labelKey: 'dsp.masterPreset.vinyl',
    group: 'unnormalized',
    /**
     * Cut by a lathe, which is a mechanical limit rather than a numeric one.
     *
     * A hot peak throws the cutting head and a heavily limited master arrives
     * with sibilance and low end that a stylus cannot track. -3 dBTP and
     * almost no limiting is the master a cutting engineer can work with;
     * everything louder is work they will have to undo.
     */
    settings: profile(-14, -3, 2),
  },
  club: {
    id: 'club',
    labelKey: 'dsp.masterPreset.club',
    group: 'unnormalized',
    // A system with its own limiter downstream and a room that swallows
    // transients. Loud, and honest about what that costs: nine decibels of
    // allowance is the limiter being asked to do most of the work.
    settings: profile(-9, -0.3, 9),
  },
  reference: {
    id: 'reference',
    labelKey: 'dsp.masterPreset.reference',
    group: 'tool',
    /**
     * Level matching with no limiting at all.
     *
     * The allowance is zero, so the makeup can only spend true-peak room that
     * already exists — a track is brought to a common level and nothing is held
     * down to get it there. This is the profile for comparing two records, and
     * it is exactly the behaviour the stage used to have in every profile,
     * where it was not a choice but an accident of the arithmetic.
     */
    settings: profile(-18, -1, 0),
  },
} satisfies Record<string, IMasterPreset>;

export type TMasterPresetId = keyof typeof MASTER_PRESET_BY_ID;

/**
 * Grouped order, and it is the order the arrows walk as well as the order the
 * menu shows.
 *
 * One list rather than two for the reason the EQ's picker gives: when the
 * sorted display and the stepped order disagreed, "next" landed on an entry
 * nowhere near the highlighted one and the arrows read as broken.
 */
export const MASTER_PRESETS: readonly IMasterPreset[] =
  MASTER_PRESET_GROUPS.flatMap((group) =>
    Object.values(MASTER_PRESET_BY_ID).filter(
      (preset) => preset.group === group,
    ),
  );

export const isMasterPresetId = (id: string): id is TMasterPresetId =>
  Object.prototype.hasOwnProperty.call(MASTER_PRESET_BY_ID, id);

/**
 * Apply a destination to a live Master, keeping everything it does not own.
 *
 * Output gain, the release and matched listen survive: they are how the stage
 * is being used, not where the result is going.
 */
export const masterPresetSettings = (
  id: TMasterPresetId,
  master: IMasterSettings,
): IMasterSettings => ({
  ...master,
  presetId: id,
  ...MASTER_PRESET_BY_ID[id].settings,
});
