/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

/**
 * Which heading a profile sits under in the picker.
 *
 * `purpose` is what you are doing — music, a film, a call. `genre` is what the
 * record is. They are the same kind of object and behave identically; the split
 * exists because a flat list of fifteen is a list nobody reads, and because
 * somebody usually knows which of the two questions they are answering.
 */
export type TVoicingGroup = 'purpose' | 'genre';

export interface IVoicingProfile {
  id: string;
  name: string;
  tagline: string;
  group: TVoicingGroup;
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
    group: 'purpose',
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
    group: 'purpose',
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
    group: 'purpose',
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
    group: 'purpose',
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
    group: 'purpose',
    name: 'Late night',
    tagline: 'Restores the bass and treble your ears lose when quiet',
    filters: [
      lowShelf(120, 6, 0.7, 'Equal-loudness: bass falls away fastest quietly'),
      pk(1000, -1, 0.8, 'Keeps the midrange from dominating at low level'),
      highShelf(8000, 4, 0.7, 'Equal-loudness: treble sensitivity drops too'),
    ],
  },

  /*
   * GENRES, AND AN HONEST NOTE ABOUT WHERE THEY COME FROM.
   *
   * Every "genre EQ" in existence descends from one 10-band preset table that
   * shipped with Winamp and was copied into every player since. There is no
   * research behind it — no listening panels, no measurements, nothing of the
   * kind that stands behind a headphone target. It is a convention, and a
   * strong one: people have a firm idea of what "Rock" should do to a stereo
   * because they have seen that table for thirty years.
   *
   * So these follow the convention's *shapes* and none of its numbers. Copying
   * the table would have been quicker and is not something this project can
   * licence — the best archive of it says outright that its own author does not
   * know what licence the files carry.
   *
   * They are also written in this app's domain rather than a stereo's. Those
   * presets assume they are the only thing touching the sound; here they sit on
   * top of a correction that has already put the record on a known curve, so a
   * genre only has to say how it departs from that. Hence gains of two or three
   * decibels where a Winamp preset would say ten, and hence a low-mid cut in
   * most of them: once the record is where it should be, the useful move is
   * almost always taking congestion out rather than piling more on.
   */
  {
    id: 'rock',
    group: 'genre',
    name: 'Rock',
    tagline: 'Drums with weight, guitars that stop crowding each other',
    filters: [
      lowShelf(90, 3, 0.7, 'Kick and bass guitar get their body back'),
      pk(420, -2.5, 1.0, 'The band of layered guitars, where a mix congests'),
      pk(3200, 2.5, 1.0, 'Snare crack and the edge of a guitar'),
      highShelf(9000, 1.5, 0.7, 'Cymbals and room'),
    ],
  },
  {
    id: 'metal',
    group: 'genre',
    name: 'Metal',
    tagline: 'Tight underneath, articulate through the wall of guitar',
    filters: [
      highPass(32, 0.7, 'Sub rumble under the kick, which only eats headroom'),
      lowShelf(85, 2.5, 0.7, 'Kick weight without softening it'),
      pk(450, -3, 1.1, 'Untangles down-tuned guitars from the bass'),
      pk(3400, 3, 1.1, 'Beater attack and pick definition'),
      highShelf(9000, 1.5, 0.7, 'Cymbal detail in a dense mix'),
    ],
  },
  {
    id: 'pop',
    group: 'genre',
    name: 'Pop',
    tagline: 'Vocal forward, bass deep, top end polished',
    filters: [
      lowShelf(75, 3, 0.7, 'The low end modern pop is mastered to have'),
      pk(320, -2, 1.1, 'Keeps a dense arrangement from thickening'),
      pk(2600, 2.5, 1.0, 'Lead vocal presence'),
      highShelf(10000, 2.5, 0.7, 'The sheen the genre is mixed for'),
    ],
  },
  {
    id: 'hiphop',
    group: 'genre',
    name: 'Hip-hop & R&B',
    tagline: 'Sub weight underneath, vocal clear on top of it',
    filters: [
      lowShelf(60, 4.5, 0.7, 'Where 808s live, low enough to feel not muddy'),
      pk(260, -2.5, 1.1, 'Stops the sub smearing into the low mids'),
      pk(2800, 2, 1.0, 'Keeps the vocal above a heavy beat'),
      highShelf(11000, 1.5, 0.7, 'Hats and air'),
    ],
  },
  {
    id: 'electronic',
    group: 'genre',
    name: 'Electronic & Dance',
    tagline: 'Club low end, synths with edges',
    filters: [
      lowShelf(70, 4, 0.7, 'The weight a club system would give it'),
      pk(360, -3, 1.2, 'Clears the mud synth layers build up here'),
      pk(4200, 2, 1.2, 'Hats, plucks and the attack of a lead'),
      highShelf(12000, 2.5, 0.7, 'Air and the top of a riser'),
    ],
  },
  {
    id: 'jazz',
    group: 'genre',
    name: 'Jazz',
    tagline: 'Natural, warm, with the room left in',
    filters: [
      lowShelf(100, 2, 0.7, 'Double bass body without losing its pitch'),
      pk(400, -1.5, 1.0, 'A light touch: the recordings are rarely congested'),
      pk(3500, 1.5, 1.2, 'Brushes, brass and the breath of a horn'),
      highShelf(11000, 1.5, 0.7, 'Cymbal shimmer and the room around it'),
    ],
  },
  {
    id: 'classical',
    group: 'genre',
    name: 'Classical',
    tagline: 'The hall, not the desk — the lightest of these by far',
    filters: [
      lowShelf(120, 1.5, 0.7, 'Weight under the orchestra, gently'),
      pk(350, -1.5, 1.0, 'Boxiness from close-miked strings'),
      highShelf(10000, 2, 0.7, 'The air of the hall, which is the recording'),
    ],
  },
  {
    id: 'acoustic',
    group: 'genre',
    name: 'Acoustic & Folk',
    tagline: 'Strings and voice, close and uncluttered',
    filters: [
      pk(200, -2, 1.0, 'The boom of a guitar body, which a mic exaggerates'),
      pk(2400, 2, 1.0, 'Pick, string and fret detail'),
      highShelf(10000, 2, 0.7, 'Air around a close-recorded voice'),
    ],
  },
];

export const getVoicingProfile = (
  profileId: string,
): IVoicingProfile | undefined =>
  VOICING_PROFILES.find((profile) => profile.id === profileId);

/**
 * Whether a voicing is actually shaping the sound.
 *
 * A profile chosen at zero strength is not, and reading the id alone missed
 * that. Smart EQ asks this question to decide whether a curve has been named —
 * and answering yes at 0% gave the worst of both: the voicing contributed
 * nothing, and Target dropped its own built-in shape as though something had
 * replaced it, so the record was driven to a bare tilt with neither curve on it.
 *
 * Here rather than at the call sites because two of them asked, and a rule about
 * what counts as an active voicing belongs with the voicing.
 */
export const isVoicingActive = (
  settings: IVoicingSettings | undefined,
): boolean =>
  Boolean(settings?.profileId) &&
  (settings?.intensity ?? 0) > 0 &&
  Boolean(getVoicingProfile(settings?.profileId ?? ''));

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
