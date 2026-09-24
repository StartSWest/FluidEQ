/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IGenreRack, TGenreStage } from '../genreRack';
import COUNTRY_RACKS from './country';
import ELECTRONIC_RACKS from './electronic';
import JAZZ_CLASSICAL_RACKS from './jazzClassical';
import LATIN_RACKS from './latin';
import POP_RACKS from './pop';
import REGGAE_RACKS from './reggae';
import ROCK_RACKS from './rock';
import URBAN_RACKS from './urban';
import WORLD_RACKS from './world';

/** Every genre's rack, a family at a time. */
export const GENRE_RACKS: readonly IGenreRack[] = [
  ...POP_RACKS,
  ...ROCK_RACKS,
  ...COUNTRY_RACKS,
  ...URBAN_RACKS,
  ...JAZZ_CLASSICAL_RACKS,
  ...ELECTRONIC_RACKS,
  ...REGGAE_RACKS,
  ...LATIN_RACKS,
  ...WORLD_RACKS,
];

/** The label every stage's profile of a genre wears: the genre's own. */
export const genreLabelKey = (rack: IGenreRack): string =>
  `dsp.eqPreset.${rack.id}`;

/** The id a genre's chain is stored under. */
export const genreChainId = (rack: IGenreRack): string =>
  rack.chainId ?? rack.id;

export interface IGenreStageProfile<T> {
  id: string;
  labelKey: string;
  group: 'genre';
  settings: T;
}

/**
 * One stage's genre profiles: every genre that sets that stage, under the
 * genre's name, in the order the genres are listed.
 */
export const genreStageProfiles = <S extends TGenreStage>(
  stage: S,
): IGenreStageProfile<NonNullable<IGenreRack[S]>>[] =>
  GENRE_RACKS.flatMap((rack) => {
    const settings = rack[stage];
    return settings === undefined
      ? []
      : [
          {
            id: rack.id,
            labelKey: genreLabelKey(rack),
            group: 'genre' as const,
            settings: settings as NonNullable<IGenreRack[S]>,
          },
        ];
  });
