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

export interface IMasterPreset {
  id: string;
  labelKey: string;
  settings: IMasterPresetSettings;
}

export const MASTER_PRESET_BY_ID = {
  streaming: {
    id: 'streaming',
    labelKey: 'dsp.masterPreset.streaming',
    // -14 LUFS is the figure Spotify, YouTube, Tidal and Amazon all normalize
    // to; -1 dBTP is the ceiling every one of them asks for, because their
    // lossy encoders overshoot the sample peak they were given.
    settings: profile(-14, -1, 6),
  },
  streamingQuiet: {
    id: 'streamingQuiet',
    labelKey: 'dsp.masterPreset.streamingQuiet',
    // Apple Music's Sound Check reference. Two decibels below the rest, so a
    // master made for it is turned up rather than down everywhere else.
    settings: profile(-16, -1, 5),
  },
  broadcast: {
    id: 'broadcast',
    labelKey: 'dsp.masterPreset.broadcast',
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
  club: {
    id: 'club',
    labelKey: 'dsp.masterPreset.club',
    // A system with its own limiter downstream and a room that swallows
    // transients. Loud, and honest about what that costs: nine decibels of
    // allowance is the limiter being asked to do most of the work.
    settings: profile(-9, -0.3, 9),
  },
  reference: {
    id: 'reference',
    labelKey: 'dsp.masterPreset.reference',
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

export const MASTER_PRESETS: readonly IMasterPreset[] =
  Object.values(MASTER_PRESET_BY_ID);

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
