/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDeEsserSettings } from './deEsser';

export const DE_ESSER_PRESET_GROUPS = ['music', 'speech'] as const;

export type TDeEsserPresetGroup = (typeof DE_ESSER_PRESET_GROUPS)[number];

/**
 * A profile owns how the stage finds and cuts an S, never whether it runs:
 * a chain decides that, as it does for every other stage. Isolate is a way
 * of listening, not a sound, so no profile carries it either.
 */
export type IDeEsserPresetSettings = Omit<
  IDeEsserSettings,
  'enabled' | 'isolate' | 'presetId'
>;

export interface IDeEsserPreset {
  id: string;
  labelKey: string;
  group: TDeEsserPresetGroup;
  settings: IDeEsserPresetSettings;
}

/**
 * The everyday profile, which is also the stage's defaults underneath its
 * switch (`DE_ESSER_DEFAULTS`). Written out rather than taken from them so a
 * change to either is a change somebody made on purpose:
 * `deEsserPresets.test.ts` holds the two equal.
 */
const vocalMusic: IDeEsserPresetSettings = {
  sensitivity: 0.55,
  lowHz: 4500,
  highHz: 11000,
  rangeDb: 6,
  widthOct: 0.67,
  mode: 'spectral',
  attackMs: 1,
  releaseMs: 60,
  centreOnly: true,
  keepCymbals: 0.7,
};

/**
 * The profiles the page lists, in its order.
 *
 * Music profiles listen in the centre and spectrally, because a sung S sits
 * in the middle of the mix and anything panned beside it is more likely a
 * hi-hat; the speech ones listen everywhere, because a podcast's second
 * voice is often panned and there are no cymbals to spare. `rangeDb` is the
 * figure each one is known by ("up to −6 dB"), so it is the one the hint
 * prints.
 */
export const DE_ESSER_PRESET_BY_ID = {
  gentle: {
    id: 'gentle',
    labelKey: 'dsp.deEsserPreset.gentle',
    group: 'music',
    // Half the everyday cut and a later knee: takes the edge off an S and
    // never thins the voice around it.
    settings: {
      ...vocalMusic,
      sensitivity: 0.45,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 3,
      attackMs: 1.5,
      releaseMs: 80,
      keepCymbals: 0.8,
    },
  },
  vocalMusic: {
    id: 'vocalMusic',
    labelKey: 'dsp.deEsserPreset.vocalMusic',
    group: 'music',
    // The stage's own defaults, so switching the stage on does this.
    settings: vocalMusic,
  },
  brightHeadphones: {
    id: 'brightHeadphones',
    labelKey: 'dsp.deEsserPreset.brightHeadphones',
    group: 'music',
    // Many headphones peak between 6 and 9 kHz, which is where an S lives;
    // a narrower cut placed there takes the peak's share without the air.
    settings: {
      ...vocalMusic,
      sensitivity: 0.6,
      lowHz: 5500,
      highHz: 10000,
      rangeDb: 8,
      widthOct: 0.5,
      releaseMs: 50,
    },
  },
  harshStreams: {
    id: 'harshStreams',
    labelKey: 'dsp.deEsserPreset.harshStreams',
    group: 'music',
    // A lossy encoder smears an S into a wider hiss up to its cut-off, so
    // this listens higher and cuts wider.
    settings: {
      ...vocalMusic,
      sensitivity: 0.6,
      lowHz: 5000,
      highHz: 12000,
      widthOct: 1,
      releaseMs: 70,
      keepCymbals: 0.6,
    },
  },
  live: {
    id: 'live',
    labelKey: 'dsp.deEsserPreset.live',
    group: 'music',
    // On a stage the vocal mic hears the cymbals and the room hears the
    // voice, so the centre tells less: it listens everywhere and leans on
    // the other tells to spare the kit.
    settings: {
      ...vocalMusic,
      sensitivity: 0.5,
      lowHz: 4000,
      highHz: 10000,
      rangeDb: 5,
      releaseMs: 70,
      centreOnly: false,
      keepCymbals: 0.85,
    },
  },
  podcast: {
    id: 'podcast',
    labelKey: 'dsp.deEsserPreset.podcast',
    group: 'speech',
    // Spectral, as every profile is. It was Whole voice, broadcast's way,
    // and on a finished show that took everything under each S down with it
    // — the bed, the other voice, the vowel's start: 3.9 dB under 1 kHz at
    // these settings, given back over 50 ms, heard as a limiter pumping
    // (Ivan, 2026-10-14). Spectral takes the S down as far and leaves the
    // rest at its level (`speech_keeps_its_level_through_an_s`).
    settings: {
      ...vocalMusic,
      sensitivity: 0.6,
      lowHz: 4000,
      highHz: 10000,
      rangeDb: 8,
      releaseMs: 50,
      centreOnly: false,
      keepCymbals: 0.3,
    },
  },
  audiobook: {
    id: 'audiobook',
    labelKey: 'dsp.eqPreset.audiobook',
    group: 'speech',
    // Hours of one voice: a softer catch and a slow let-go, so no cut is
    // ever heard as one.
    settings: {
      ...vocalMusic,
      sensitivity: 0.5,
      lowHz: 4500,
      highHz: 10000,
      attackMs: 2,
      releaseMs: 120,
      centreOnly: false,
      keepCymbals: 0.3,
    },
  },
} satisfies Record<string, IDeEsserPreset>;

export type TDeEsserPresetId = keyof typeof DE_ESSER_PRESET_BY_ID;

export const DE_ESSER_PRESETS: readonly IDeEsserPreset[] = Object.values(
  DE_ESSER_PRESET_BY_ID,
);

/** A fresh stage from a profile; whether it runs is the caller's. */
export const deEsserSettingsOf = (
  preset: IDeEsserPreset,
  on: boolean,
): IDeEsserSettings => ({
  enabled: on,
  isolate: false,
  presetId: preset.id,
  ...preset.settings,
});

export const deEsserPresetSettings = (
  id: TDeEsserPresetId,
  on: boolean,
): IDeEsserSettings => deEsserSettingsOf(DE_ESSER_PRESET_BY_ID[id], on);
