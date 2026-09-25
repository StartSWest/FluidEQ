/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import type { IEqSettings } from '../../common/dsp/chain';
import type { TranslationKey } from '../../common/i18n/en';
import { GENRE_MEASURED, genreSources } from '../../common/dsp/genreEvidence';
import { GENRE_NOTES, IGenreNote } from '../../common/dsp/genreNotes';
import {
  GENRE_STAGES,
  TGenreStage,
  inGenreChain,
} from '../../common/dsp/genreRack';
import { GENRE_RACKS, genreChainId } from '../../common/dsp/genres';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';

/** Everything a genre's notes show, read off its preset rather than restated. */
export interface IGenreNotes {
  /** The genre's own id, which names its `genre.<id>.*` keys. */
  id: string;
  labelKey: string;
  note: IGenreNote;
  /** The curve its preset plays in the main EQ. */
  curve: IEqSettings | undefined;
  /** Its rack's stages, in rack order, as played or left off. */
  stagesOn: readonly TGenreStage[];
  stagesOff: readonly TGenreStage[];
  /** The stage that adds harmonics on purpose, where one plays. */
  harmonics: TGenreStage | undefined;
  /** [LU against DSP Off, highest true peak in dBTP] (`genreEvidence.ts`). */
  measured: readonly [number, number] | undefined;
  sources: string | undefined;
}

/**
 * A genre's notes by the id its chain is stored and picked under, or nothing
 * for a chain that is not a genre's.
 *
 * By the chain id because that is what every caller holds: the picker's row,
 * the rack's `presetId`, the Preset layer's `dsp:<id>`. Drum & bass is stored
 * as `drum-bass` and its notes are `drumBass`'s.
 */
export const genreNotesFor = (
  chainId: string | undefined,
): IGenreNotes | undefined => {
  if (!chainId) {
    return undefined;
  }
  const rack = GENRE_RACKS.find((one) => genreChainId(one) === chainId);
  const note = rack ? GENRE_NOTES[rack.id] : undefined;
  if (!rack || !note) {
    return undefined;
  }
  const preset = DSP_PRESETS.find((one) => one.id === chainId);
  const stagesOn = GENRE_STAGES.filter((stage) => inGenreChain(rack, stage));
  return {
    id: rack.id,
    labelKey: preset?.labelKey ?? `dsp.eqPreset.${rack.id}`,
    note,
    curve: preset?.curve,
    stagesOn,
    stagesOff: GENRE_STAGES.filter((stage) => !stagesOn.includes(stage)),
    harmonics: stagesOn.find(
      (stage) => stage === 'exciter' || stage === 'bassForge',
    ),
    measured: GENRE_MEASURED[rack.id],
    sources: genreSources(rack.id),
  };
};

/**
 * One of a genre's notes, by the genre's id and the part: `hook`, `story`,
 * `off`, `pin.80`, `pin.80.why`, `stage.maximizer`. Every genre has them all
 * in every language; `genreNotes.test.ts` holds each to its preset.
 */
export const genreNoteKey = (id: string, part: string): TranslationKey =>
  `genre.${id}.${part}` as TranslationKey;

/**
 * A genre's hook, the line its row carries in a preset list
 * (`dspPresetRowHint`). Nothing for a chain that is not a genre's.
 */
export const genreHookKey = (chainId: string): TranslationKey | undefined => {
  const notes = genreNotesFor(chainId);
  return notes ? genreNoteKey(notes.id, 'hook') : undefined;
};

/** What the DSP page calls each stage, so the notes use the same names. */
export const STAGE_TITLE: Readonly<Record<TGenreStage, TranslationKey>> = {
  exciter: 'dsp.exciter.title',
  bassForge: 'dsp.bassForge.title',
  bassPunch: 'dsp.bassPunch.title',
  dimension: 'dsp.dimension.title',
  maximizer: 'dsp.maximizer.title',
};

/** The rate the notes draw at: the one every factory curve was fitted at. */
const RATE = 48_000;

/**
 * What a curve does at one frequency, as its bands play it: the model's Q
 * first, summed in decibels, the way the Preset layer writes it.
 */
export const curveGainDb = (curve: IEqSettings, hz: number): number =>
  curve.bands.reduce(
    (total, band) =>
      band.enabled
        ? total +
          biquadMagnitudeDb(
            biquadCoefficients(
              {
                type: band.type as FilterTypeEnum,
                frequency: band.frequency,
                gainDb: band.gainDb,
                quality: band.quality,
              },
              RATE,
              curve.model,
              curve.modelAmount,
            ),
            hz,
            RATE,
          )
        : total,
    0,
  );

/** A pin's frequency as it is read: "80 Hz", "3.15 kHz", "12.5 kHz". */
export const pinFrequencyLabel = (hz: number): string =>
  hz >= 1_000 ? `${Number((hz / 1_000).toFixed(2))} kHz` : `${hz} Hz`;

/** Signed to a tenth, with a real minus sign: "+1.1", "−2.1", "0.0". */
export const signedTenth = (value: number): string => {
  const rounded = Math.round(value * 10) / 10;
  if (rounded > 0) {
    return `+${rounded.toFixed(1)}`;
  }
  return rounded < 0 ? `−${Math.abs(rounded).toFixed(1)}` : '0.0';
};
