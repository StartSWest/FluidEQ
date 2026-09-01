/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IDenoiseSettings } from './chain';

export const DENOISE_PRESET_GROUPS = ['basic', 'repair', 'voice'] as const;

export type TDenoisePresetGroup = (typeof DENOISE_PRESET_GROUPS)[number];

export type IDenoisePresetSettings = Pick<
  IDenoiseSettings,
  'profileSource' | 'hiss' | 'hum' | 'click' | 'voice'
>;

export interface IDenoisePreset {
  id: string;
  labelKey: string;
  group: TDenoisePresetGroup;
  settings: IDenoisePresetSettings;
}

/**
 * A complete cleanup profile from small module patches.
 *
 * Every module is assigned on every pick. Leaving an omitted module wherever
 * the previous profile put it made a hiss preset keep repairing clicks, which
 * is a different restoration chain wearing the same name.
 */
const settings = (
  profileSource: IDenoiseSettings['profileSource'],
  hiss: Partial<IDenoiseSettings['hiss']>,
  hum: Partial<IDenoiseSettings['hum']>,
  click: Partial<IDenoiseSettings['click']>,
): IDenoisePresetSettings => ({
  profileSource,
  // Off unless the profile names the problem. Running a click repairer and a
  // hum comb because somebody asked to lower hiss is three restoration jobs,
  // and the accumulated damage is what made the first catalogue sound bad.
  hiss: { ...DSP_DEFAULTS.denoise.hiss, enabled: false, ...hiss },
  hum: { ...DSP_DEFAULTS.denoise.hum, enabled: false, ...hum },
  click: { ...DSP_DEFAULTS.denoise.click, enabled: false, ...click },
  // A factory profile cannot assume the optional model exists. Voice remains
  // ready at its neutral amount, but only the explicit switch may start it.
  voice: { ...DSP_DEFAULTS.denoise.voice, enabled: false },
});

export const DENOISE_PRESET_BY_ID = {
  default: {
    id: 'default',
    labelKey: 'dsp.eqPreset.default',
    group: 'basic',
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.15,
        floorDb: -6,
        sensitivityDb: -1,
        smoothing: 0.95,
      },
      {},
      {},
    ),
  },
  gentle: {
    id: 'gentle',
    labelKey: 'dsp.denoisePreset.gentle',
    group: 'basic',
    // Barely touches a stable floor and leaves every event repairer off.
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.12,
        floorDb: -6,
        sensitivityDb: -1,
        smoothing: 0.95,
      },
      {},
      {},
    ),
  },
  strong: {
    id: 'strong',
    labelKey: 'dsp.denoisePreset.strong',
    group: 'basic',
    // Still one job only. Combining spectral subtraction, a hum comb and
    // transient interpolation made "Strong" three unrelated repairs and was
    // the most destructive profile in the first catalogue.
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.35,
        floorDb: -12,
        sensitivityDb: 1,
        smoothing: 0.92,
      },
      {},
      {},
    ),
  },

  hiss: {
    id: 'hiss',
    labelKey: 'dsp.denoise.hiss',
    group: 'repair',
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.25,
        floorDb: -9,
        sensitivityDb: 0,
        smoothing: 0.94,
      },
      {},
      {},
    ),
  },
  hum: {
    id: 'hum',
    labelKey: 'dsp.denoise.hum',
    group: 'repair',
    settings: settings(
      'scanned',
      {},
      { enabled: true, harmonics: 4, depthDb: 18, quality: 40 },
      {},
    ),
  },
  clicks: {
    id: 'clicks',
    labelKey: 'dsp.denoise.click',
    group: 'repair',
    settings: settings(
      'scanned',
      {},
      {},
      { enabled: true, sensitivity: 0.5, maxRepairSamples: 16 },
    ),
  },
  vinyl: {
    id: 'vinyl',
    labelKey: 'dsp.eqPreset.vinyl',
    group: 'repair',
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.1,
        floorDb: -5,
        sensitivityDb: -1,
        smoothing: 0.96,
      },
      {},
      { enabled: true, sensitivity: 0.35, maxRepairSamples: 12 },
    ),
  },
  tape: {
    id: 'tape',
    labelKey: 'dsp.eqPreset.tape',
    group: 'repair',
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.2,
        floorDb: -8,
        sensitivityDb: 0,
        smoothing: 0.95,
      },
      {},
      {},
    ),
  },

  podcast: {
    id: 'podcast',
    labelKey: 'dsp.eqPreset.podcast',
    group: 'voice',
    settings: settings(
      'adaptive',
      {
        enabled: true,
        amount: 0.12,
        floorDb: -6,
        sensitivityDb: -1,
        smoothing: 0.96,
      },
      {},
      {},
    ),
  },
  liveVocal: {
    id: 'liveVocal',
    labelKey: 'dsp.eqPreset.liveVocal',
    group: 'voice',
    settings: settings(
      'adaptive',
      {
        enabled: true,
        amount: 0.15,
        floorDb: -8,
        sensitivityDb: 0,
        smoothing: 0.94,
      },
      {},
      {},
    ),
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'voice',
    settings: settings(
      'scanned',
      {
        enabled: true,
        amount: 0.1,
        floorDb: -5,
        sensitivityDb: -1,
        smoothing: 0.97,
      },
      {},
      {},
    ),
  },
} satisfies Record<string, IDenoisePreset>;

export type TDenoisePresetId = keyof typeof DENOISE_PRESET_BY_ID;

export const DENOISE_PRESETS: readonly IDenoisePreset[] =
  DENOISE_PRESET_GROUPS.flatMap((group) =>
    Object.values(DENOISE_PRESET_BY_ID).filter(
      (preset) => preset.group === group,
    ),
  );

export const isDenoisePresetId = (id: string): id is TDenoisePresetId =>
  Object.prototype.hasOwnProperty.call(DENOISE_PRESET_BY_ID, id);

/** Build a fresh processor state while leaving bypass to the caller. */
export const denoisePresetSettings = (
  id: TDenoisePresetId,
  enabled: boolean,
): IDenoiseSettings => {
  const preset = DENOISE_PRESET_BY_ID[id];
  return {
    enabled,
    presetId: id,
    isolate: false,
    profileSource: preset.settings.profileSource,
    hiss: { ...preset.settings.hiss },
    hum: { ...preset.settings.hum },
    click: { ...preset.settings.click },
    voice: { ...preset.settings.voice },
  };
};
