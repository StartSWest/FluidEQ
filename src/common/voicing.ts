/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import {
  FilterTypeEnum,
  IVoicingSettings,
  NO_GAIN_FILTER_TYPES,
  clampGain,
} from './constants';

export type { IVoicingSettings };

/**
 * Voicing: curated target curves for what you are actually doing.
 *
 * A voicing is a small, fixed set of parametric filters written as their own
 * layer in the Equalizer APO config, *after* the user's own bands. It never
 * touches the band set, so switching voicing off restores the manual tuning
 * exactly. Everything here uses only the filter forms APO's ParametricEQ
 * accepts — PK and the shelves take a gain, HPQ does not.
 */

export interface IVoicingFilter {
  type: FilterTypeEnum;
  frequency: number;
  /** Ignored for the gainless filter types. */
  gain: number;
  quality: number;
  /** Why this filter exists, shown in the UI so the curve is not a mystery. */
  reason: string;
}

export interface IVoicingProfile {
  id: string;
  name: string;
  tagline: string;
  filters: IVoicingFilter[];
}

export const DEFAULT_VOICING: IVoicingSettings = {
  profileId: '',
  intensity: 1,
};

const pk = (
  frequency: number,
  gain: number,
  quality: number,
  reason: string,
): IVoicingFilter => ({
  type: FilterTypeEnum.PK,
  frequency,
  gain,
  quality,
  reason,
});

const lowShelf = (
  frequency: number,
  gain: number,
  quality: number,
  reason: string,
): IVoicingFilter => ({
  type: FilterTypeEnum.LSC,
  frequency,
  gain,
  quality,
  reason,
});

const highShelf = (
  frequency: number,
  gain: number,
  quality: number,
  reason: string,
): IVoicingFilter => ({
  type: FilterTypeEnum.HSC,
  frequency,
  gain,
  quality,
  reason,
});

const highPass = (
  frequency: number,
  quality: number,
  reason: string,
): IVoicingFilter => ({
  type: FilterTypeEnum.HPQ,
  frequency,
  gain: 0,
  quality,
  reason,
});

export const VOICING_PROFILES: IVoicingProfile[] = [
  {
    id: 'music',
    name: 'Music',
    tagline: 'Warm low end, relaxed mids, open top',
    filters: [
      lowShelf(105, 3.5, 0.7, 'Weight and body without muddying the bass line'),
      pk(300, -1.5, 1.0, 'Clears the boxiness most small speakers add here'),
      highShelf(10000, 2, 0.7, 'Air and cymbal detail'),
    ],
  },
  {
    id: 'movies',
    name: 'Movies',
    tagline: 'Impact underneath, dialogue that cuts through',
    filters: [
      lowShelf(80, 4, 0.7, 'Explosions and score get their weight back'),
      pk(350, -2.5, 1.2, 'Removes the congestion that buries dialogue'),
      pk(2800, 3, 1.0, 'Consonants land, so you stop reaching for subtitles'),
      highShelf(12000, 1.5, 0.7, 'Ambience and room tone'),
    ],
  },
  {
    id: 'games',
    name: 'Games',
    tagline: 'Footsteps and positional cues stop being masked',
    filters: [
      highPass(30, 0.7, 'Drops sub rumble that eats headroom and masks cues'),
      pk(200, -2, 1.0, 'Stops explosions covering everything else'),
      pk(4500, 4, 1.4, 'Footsteps, reloads and cloth movement'),
      pk(8000, 2, 1.5, 'Directional detail for positional audio'),
    ],
  },
  {
    id: 'speech',
    name: 'Speech',
    tagline: 'Podcasts, calls and audiobooks, made intelligible',
    filters: [
      highPass(85, 0.7, 'Removes rumble and handling noise below the voice'),
      pk(300, -3, 1.2, 'Cuts the muddiness that makes voices tiring'),
      pk(2200, 4, 1.0, 'The intelligibility band: consonants and clarity'),
      pk(7000, -2, 2.0, 'Tames sibilance so the lift above does not hurt'),
    ],
  },
  {
    id: 'loudness',
    name: 'Late night',
    tagline: 'Restores the bass and treble your ears lose when quiet',
    filters: [
      lowShelf(120, 6, 0.7, 'Equal-loudness: bass falls away fastest quietly'),
      pk(1000, -1, 0.8, 'Keeps the midrange from dominating at low level'),
      highShelf(8000, 4, 0.7, 'Equal-loudness: treble sensitivity drops too'),
    ],
  },
];

export const getVoicingProfile = (
  profileId: string,
): IVoicingProfile | undefined =>
  VOICING_PROFILES.find((profile) => profile.id === profileId);

/**
 * The filters a voicing contributes at a given intensity.
 *
 * Intensity scales gains only. A gainless filter such as the speech
 * high-pass has nothing to scale — it is a structural part of the voicing, so
 * it is present whenever the voicing is, and absent when it is not. Filters
 * whose scaled gain rounds to zero are dropped rather than written as inert
 * commands.
 */
export const getVoicingFilters = (
  settings: IVoicingSettings | undefined,
): IVoicingFilter[] => {
  if (!settings?.profileId) {
    return [];
  }
  const profile = getVoicingProfile(settings.profileId);
  if (!profile) {
    return [];
  }

  const intensity = Math.min(1, Math.max(0, settings.intensity));
  if (intensity <= 0) {
    return [];
  }

  return profile.filters
    .map((filter) => {
      if (NO_GAIN_FILTER_TYPES.includes(filter.type)) {
        return filter;
      }
      return {
        ...filter,
        gain: clampGain(Math.round(filter.gain * intensity * 10) / 10),
      };
    })
    .filter(
      (filter) =>
        NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
    );
};

/**
 * Worst-case boost the voicing adds, so the caller can reserve headroom.
 * Only positive gains matter: cuts cannot clip.
 */
export const getVoicingPeakBoost = (
  settings: IVoicingSettings | undefined,
): number =>
  getVoicingFilters(settings).reduce(
    (highest, filter) => Math.max(highest, filter.gain),
    0,
  );
