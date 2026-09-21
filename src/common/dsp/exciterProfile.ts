/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IExciterBandSettings,
  IExciterSettings,
  IOrganicSettings,
  IPhaseAlignSettings,
  constrainExciterBandPosition,
} from './chain';

export const EXCITER_PRESET_GROUPS = [
  'basic',
  'genre',
  'voice',
  'scene',
  'character',
  'repair',
] as const;

export type TExciterPresetGroup = (typeof EXCITER_PRESET_GROUPS)[number];

/**
 * A processor profile owns the Exciter's sound, not its place in the chain.
 *
 * Bypass and Isolate are deliberately absent. A future chain preset decides
 * whether this processor participates at all, while Isolate remains a
 * temporary monitoring action. Keeping those fields out is what lets Rock
 * reference EQ Rock and Exciter Rock independently or omit either one.
 */
export type IExciterPresetSettings = Pick<
  IExciterSettings,
  'stereo' | 'bands' | 'organic' | 'align'
>;

export interface IExciterPreset {
  id: string;
  labelKey: string;
  group: TExciterPresetGroup;
  settings: IExciterPresetSettings;
}

type TBandPatches = readonly [
  Partial<IExciterBandSettings>,
  Partial<IExciterBandSettings>,
  Partial<IExciterBandSettings>,
];

const NO_BAND_PATCHES: TBandPatches = [{}, {}, {}];

export const exciterProfile = (
  bands: TBandPatches = NO_BAND_PATCHES,
  organic: Partial<IOrganicSettings> = {},
  align: Partial<IPhaseAlignSettings> = {},
  stereo: IExciterSettings['stereo'] = DSP_DEFAULTS.exciter.stereo,
): IExciterPresetSettings => ({
  stereo,
  bands: DSP_DEFAULTS.exciter.bands.map((band, index) => {
    const next = { ...band, ...bands[index] };
    return {
      ...next,
      ...constrainExciterBandPosition(index, next.freqHz, next.range),
    };
  }),
  organic: { ...DSP_DEFAULTS.exciter.organic, ...organic },
  align: { ...DSP_DEFAULTS.exciter.align, ...align },
});
