/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDimensionSettings } from './chain';

export const DIMENSION_PRESET_GROUPS = [
  'basic',
  'playback',
  'character',
] as const;

export type TDimensionPresetGroup = (typeof DIMENSION_PRESET_GROUPS)[number];

/**
 * A profile owns the shape of the image, not whether the stage runs.
 *
 * Bypass is absent for the same reason it is absent from the Exciter and
 * Maximizer catalogues: a chain preset decides whether this stage participates,
 * and how wide the picture should be is a separate decision from whether the
 * picture is being drawn at all.
 */
export type IDimensionPresetSettings = Pick<
  IDimensionSettings,
  'lowWidth' | 'midWidth' | 'highWidth' | 'lowHz' | 'highHz' | 'decorrelation'
>;

export interface IDimensionPreset {
  id: string;
  labelKey: string;
  group: TDimensionPresetGroup;
  settings: IDimensionPresetSettings;
}

/**
 * The six numbers, in the order the dials sit on the page.
 *
 * Low width never goes above 1 in any profile here, and that is not caution —
 * the processor clamps it anyway. Bass carries the energy and none of the
 * localisation, so width down there costs headroom and mono compatibility and
 * buys no picture. Every profile that wants a bigger sound gets it from the
 * top two bands.
 */
const profile = (
  lowWidth: number,
  midWidth: number,
  highWidth: number,
  lowHz: number,
  highHz: number,
  decorrelation: number,
): IDimensionPresetSettings => ({
  lowWidth,
  midWidth,
  highWidth,
  lowHz,
  highHz,
  decorrelation,
});

/**
 * Profiles, keyed by the stable id a chain preset references.
 *
 * These differ along two axes and nothing else, which is why the catalogue can
 * be a table. How much wider the top gets is one; how much of that width is
 * DECORRELATION rather than level is the other — and the second is what
 * separates a picture that got bigger from one that merely got louder at the
 * edges. Turning `highWidth` up alone raises what the mix already had out
 * there; turning `decorrelation` up makes the sides stop being a louder copy
 * of the middle.
 *
 * Every one of them leaves the mono sum untouched. That is a property of the
 * processor rather than of these numbers — the stage only ever scales the side
 * signal — so no profile here can be the one that breaks a phone speaker.
 */
export const DIMENSION_PRESET_BY_ID = {
  neutral: {
    id: 'neutral',
    labelKey: 'dsp.dimensionPreset.neutral',
    group: 'basic',
    // Unity everywhere: the stage running and changing nothing, which is the
    // reference to A/B every profile below against.
    settings: profile(1, 1, 1, 200, 3_000, 0),
  },
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: profile(0.9, 1.05, 1.25, 200, 3_000, 0.25),
  },
  /**
   * Narrower than unity everywhere above the bass, and the one to reach for
   * when a mix has to survive being summed.
   *
   * Narrowing is never guarded, because it can only improve mono — so this is
   * the one profile whose effect is identical on every system.
   */
  monoSafe: {
    id: 'monoSafe',
    labelKey: 'dsp.dimensionPreset.monoSafe',
    group: 'basic',
    settings: profile(0.6, 0.85, 0.9, 220, 3_500, 0),
  },
  headphones: {
    id: 'headphones',
    labelKey: 'dsp.dimensionPreset.headphones',
    group: 'playback',
    // Headphones already put the two channels in separate ears, so the image
    // starts wider than any speaker can make it. Widening further is what
    // makes a record feel like it is happening behind the listener's head;
    // this pulls the top back instead and spends the difference on spread.
    settings: profile(0.85, 0.95, 1.05, 200, 3_200, 0.4),
  },
  speakers: {
    id: 'speakers',
    labelKey: 'dsp.dimensionPreset.speakers',
    group: 'playback',
    // Two boxes a metre apart give a narrow picture and a strong centre, which
    // is the case width was invented for.
    settings: profile(0.9, 1.15, 1.45, 190, 2_800, 0.3),
  },
  laptop: {
    id: 'laptop',
    labelKey: 'dsp.dimensionPreset.laptop',
    group: 'playback',
    // Drivers centimetres apart and often facing away. Width up top is the
    // only part that survives, and the bottom is summed by the enclosure
    // whatever this does, so it goes to mono and saves the excursion.
    settings: profile(0.4, 1.2, 1.6, 260, 2_400, 0.5),
  },
  intimate: {
    id: 'intimate',
    labelKey: 'dsp.dimensionPreset.intimate',
    group: 'character',
    // A close, centred picture: the mids pulled in so the voice sits forward,
    // with only the air left wide.
    settings: profile(0.8, 0.75, 1.15, 200, 3_600, 0.2),
  },
  expansive: {
    id: 'expansive',
    labelKey: 'dsp.dimensionPreset.expansive',
    group: 'character',
    // Still the widest profile here, but not a phase effect. The former 1.8
    // high width plus 0.75 decorrelation made cymbals and reverb tails grainy
    // in listening even though the samples did not clip.
    settings: profile(0.85, 1.22, 1.55, 180, 2_600, 0.45),
  },
  vocal: {
    id: 'vocal',
    labelKey: 'dsp.eqPreset.vocal',
    group: 'character',
    settings: profile(0.75, 0.72, 1.08, 220, 4_000, 0.15),
  },
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.eqPreset.gaming',
    group: 'playback',
    settings: profile(0.75, 1.25, 1.55, 180, 2_400, 0.55),
  },
  movie: {
    id: 'movie',
    labelKey: 'dsp.eqPreset.movie',
    group: 'playback',
    settings: profile(0.8, 1.2, 1.65, 160, 2_200, 0.6),
  },
  club: {
    id: 'club',
    labelKey: 'dsp.masterPreset.club',
    group: 'playback',
    // Bass approaches mono for a PA, while the top stays only modestly wide;
    // the room supplies more spread than the record needs to manufacture.
    settings: profile(0.45, 1, 1.15, 180, 3_200, 0.15),
  },
} satisfies Record<string, IDimensionPreset>;

export type TDimensionPresetId = keyof typeof DIMENSION_PRESET_BY_ID;

export const DIMENSION_PRESETS: readonly IDimensionPreset[] = Object.values(
  DIMENSION_PRESET_BY_ID,
);

export const isDimensionPresetId = (id: string): id is TDimensionPresetId =>
  Object.prototype.hasOwnProperty.call(DIMENSION_PRESET_BY_ID, id);

/** A fresh live state, without sharing a profile's nested data. */
export const dimensionPresetSettings = (
  id: TDimensionPresetId,
  enabled: boolean,
): IDimensionSettings => ({
  ...DSP_DEFAULTS.dimension,
  ...DIMENSION_PRESET_BY_ID[id].settings,
  enabled,
  presetId: id,
});
