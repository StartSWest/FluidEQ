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
  IDriverSettings,
  IGraphicEqPoint,
  NO_GAIN_FILTER_TYPES,
  clampGain,
} from './constants';
import type { TranslationKey } from './i18n/en';
import { getCombinedResponsePeakGain } from './response';

export type { IDriverSettings };

/**
 * Optional, broad listening adjustments, not measured transducer corrections.
 *
 * Construction alone does not locate a headphone's response errors. The former
 * catalogue treated size and material as measurements, adding bass to small
 * drivers and cutting narrow, guessed treble resonances. That could add boom
 * or remove detail even on an already-balanced headphone.
 *
 * Keep these audition curves shallow and broad, without speculative sub-bass
 * boosts. Exact-model measurements and the listener's fit take precedence:
 * https://news.harman.com/blog/samsung-x-akg-q-a-with-harmans-dr-sean-olive
 * These particular gains are conservative design choices, not research targets.
 *
 * Shallow is not the same as identical. Trimmed to a single ~0.4 dB shelf each,
 * eleven of the twelve entries drew the same faint droop: 48 of the 66 possible
 * pairs sat under 0.5 dB apart at their most different point, and the closest
 * two were 0.04 dB apart — a picker whose every choice does the same thing.
 * Each profile therefore has to differ from every other one by a margin an ear
 * can hear, which it earns from *where* and in *which direction* it acts rather
 * than from depth: a rise, a fall placed low, a fall placed high and a bass tidy
 * are four different curves at gains none of which can ruin a listen.
 */
export interface IDriverFilter {
  type: FilterTypeEnum;
  frequency: number;
  gain: number;
  quality: number;
  reason: TranslationKey;
}

export type DriverCategory =
  'headphone' | 'iem' | 'speaker' | 'material' | 'size';

export interface IDriverProfile {
  id: string;
  name: string;
  tagline: string;
  category: DriverCategory;
  filters: IDriverFilter[];
  note: TranslationKey;
}

/** A new selection starts gently; saved strengths remain the user's choice. */
export const DEFAULT_DRIVER_INTENSITY = 0.5;

export const DEFAULT_DRIVER: IDriverSettings = {
  profileId: '',
  intensity: DEFAULT_DRIVER_INTENSITY,
};

const pk = (
  frequency: number,
  gain: number,
  quality: number,
  reason: TranslationKey,
): IDriverFilter => ({
  type: FilterTypeEnum.PK,
  frequency,
  gain,
  quality,
  reason,
});

/**
 * Q is stated per shelf rather than fixed, because it is what places the knee.
 *
 * A shelf at 0.5 is so gradual that it has already started falling two octaves
 * below its own frequency, which is why two shelves aimed six kilohertz apart
 * still measured 0.45 dB from each other. Nothing here goes above 0.7, the
 * point at which a shelf starts to grow a shoulder instead of a slope.
 */
const highShelf = (
  frequency: number,
  gain: number,
  quality: number,
  reason: TranslationKey,
): IDriverFilter => ({
  type: FilterTypeEnum.HSC,
  frequency,
  gain,
  quality,
  reason,
});

export const DRIVER_CATEGORY_LABELS: Record<DriverCategory, string> = {
  headphone: 'Headphones',
  iem: 'In-ear monitors',
  speaker: 'Speakers',
  material: 'Diaphragm material',
  size: 'Driver size',
};

export const DRIVER_PROFILES: IDriverProfile[] = [
  {
    id: 'dynamic-headphone',
    name: 'Dynamic',
    tagline: 'Moving coil, the type most headphones use',
    category: 'headphone',
    // The earcup cavity pushes the upper mids forward, and the diaphragm stops
    // moving as one piece somewhere above it — a shelf, because exactly where
    // depends on dome geometry rather than on the driver being dynamic.
    filters: [
      pk(3400, -0.9, 0.9, 'driver.filter.presenceSoftening'),
      highShelf(6500, -0.9, 0.5, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.headphone',
  },
  {
    id: 'planar-headphone',
    name: 'Planar magnetic',
    tagline: 'Flat diaphragm driven across its whole surface',
    category: 'headphone',
    // The one profile that lifts the mids: a large planar's reputation for
    // sounding polite through voices sits below the presence region, not in it.
    filters: [
      pk(1600, 0.9, 0.8, 'driver.filter.vocalLift'),
      highShelf(9000, -0.8, 0.6, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.headphone',
  },
  {
    id: 'dynamic-iem',
    name: 'Single dynamic',
    tagline: 'One moving-coil driver, the most common in-ear design',
    category: 'iem',
    // A sealed dynamic builds up mid-bass, and the canal peak above it is the
    // listener's ear rather than the driver — hence a wide dip that comes back
    // up in the top octave instead of a shelf that stays down.
    filters: [
      pk(200, -1, 0.8, 'driver.filter.bassTidying'),
      pk(6500, -0.9, 0.8, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'balanced-armature-iem',
    name: 'Balanced armature',
    tagline: 'Sealed armature drivers, common in stage and budget IEMs',
    category: 'iem',
    // Two broad dips rather than one dip and a shelf: an armature's hardness
    // and its splashiness are separate regions with clean treble between them.
    filters: [
      pk(2800, -1.2, 1.1, 'driver.filter.presenceSoftening'),
      pk(9000, -0.9, 1, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'hybrid-iem',
    name: 'Hybrid',
    tagline: 'Dynamic woofer with balanced armature mids and treble',
    category: 'iem',
    // The only three-part curve, because a hybrid is the only type with a
    // handover: woofer bleed below it, the crossover itself, and an armature
    // doing treble duty above it.
    filters: [
      pk(250, -0.8, 0.8, 'driver.filter.bassTidying'),
      pk(2000, -0.7, 1, 'driver.filter.presenceSoftening'),
      highShelf(7100, -1, 0.5, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'titanium-diaphragm',
    name: 'Titanium coated',
    tagline: 'Stiff metal-coated diaphragm',
    category: 'material',
    // Where the diaphragm stops behaving as a piston, and how hard it hits on
    // the way there, is the whole of what stiffness and self-damping predict.
    // A metal coating is heavy enough to break up well inside the band, which
    // is why this acts a full octave and a half below Graphene. The dip is also
    // what keeps the two from being one curve drawn twice: two shelves this
    // gradual, aimed six kilohertz apart, still measured 0.45 dB from each
    // other, and a shape you cannot tell apart is a choice that does nothing.
    filters: [
      pk(7000, -1.1, 0.9, 'driver.filter.edgeSoftening'),
      highShelf(12000, -0.5, 0.6, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.material',
  },
  {
    id: 'graphene-diaphragm',
    name: 'Graphene',
    tagline: 'Very high stiffness for its weight',
    category: 'material',
    // Stiff enough for its mass to push breakup into the top octave, so this
    // leaves everything below 8 kHz alone where titanium does not.
    filters: [highShelf(11000, -0.9, 0.7, 'driver.filter.trebleSoftening')],
    note: 'driver.profile.note.material',
  },
  {
    id: 'bio-cellulose-diaphragm',
    name: 'Bio-cellulose',
    tagline: 'Naturally well-damped diaphragm',
    category: 'material',
    // Well damped costs air, so this is the one material curve that rises.
    filters: [highShelf(8000, 0.9, 0.6, 'driver.filter.airLift')],
    note: 'driver.profile.note.material',
  },
  {
    id: 'size-large-50mm',
    name: '50 mm and larger',
    tagline: 'Big over-ear diaphragm',
    category: 'size',
    // More radiating area carries more upper-bass warmth, and a bigger
    // diaphragm breaks up lower than a smaller one — the two together are what
    // separates this from the 40 mm entry.
    filters: [
      pk(150, -0.7, 0.7, 'driver.filter.bassTidying'),
      pk(3500, -0.9, 0.8, 'driver.filter.presenceSoftening'),
    ],
    note: 'driver.profile.note.size',
  },
  {
    id: 'size-standard-40mm',
    name: '40 mm',
    tagline: 'The most common over-ear size',
    category: 'size',
    filters: [pk(5000, -1, 0.9, 'driver.filter.presenceSoftening')],
    note: 'driver.profile.note.size',
  },
  {
    id: 'size-small-30mm',
    name: '30 mm and smaller',
    tagline: 'Compact on-ear and portable drivers',
    category: 'size',
    // Upper bass only. A small driver is usually tuned to fake weight it
    // cannot produce; asking it for more deep bass is the wrong direction.
    filters: [pk(250, -1, 0.8, 'driver.filter.bassTidying')],
    note: 'driver.profile.note.small',
  },
  {
    id: 'size-iem-10mm',
    name: '10 mm in-ear',
    tagline: 'Typical single dynamic in-ear diaphragm',
    category: 'size',
    // Same two regions as the single-dynamic topology entry and deliberately
    // gentler in both: diameter is the weaker predictor of the two.
    filters: [
      pk(200, -0.6, 0.8, 'driver.filter.bassTidying'),
      highShelf(7000, -0.7, 0.5, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
];

export const getDriverProfile = (
  profileId: string,
): IDriverProfile | undefined =>
  DRIVER_PROFILES.find((profile) => profile.id === profileId);

const driverIntensity = (intensity: number): number =>
  Number.isFinite(intensity) ? Math.min(1, Math.max(0, intensity)) : 0;

/**
 * Share the hundredth-dB precision with the preview. Rounding to tenths made
 * several successive strength positions produce exactly the same APO filter.
 * Keep zero-gain entries here so the preview survives a move to zero strength.
 */
export const scaleDriverFilters = (
  filters: readonly IDriverFilter[],
  intensity: number,
): IDriverFilter[] => {
  const strength = driverIntensity(intensity);
  return filters.map((filter) => ({
    ...filter,
    gain: NO_GAIN_FILTER_TYPES.includes(filter.type)
      ? filter.gain
      : clampGain(Math.round(filter.gain * strength * 100) / 100),
  }));
};

export const getDriverFilters = (
  settings: IDriverSettings | undefined,
): IDriverFilter[] => {
  if (
    !settings?.profileId ||
    driverIntensity(settings.intensity) <= 0 ||
    settings.apoOverride?.graphicEq?.length
  ) {
    return [];
  }
  const filters: IDriverFilter[] = settings.apoOverride
    ? Object.values(settings.apoOverride.filters).map((filter) => ({
        type: filter.type,
        frequency: filter.frequency,
        gain: filter.gain,
        quality: filter.quality,
        reason: 'driver.filter.edited',
      }))
    : (getDriverProfile(settings.profileId)?.filters ?? []);

  return scaleDriverFilters(filters, settings.intensity).filter(
    (filter) => NO_GAIN_FILTER_TYPES.includes(filter.type) || filter.gain !== 0,
  );
};

export const getDriverGraphicEq = (
  settings: IDriverSettings | undefined,
): IGraphicEqPoint[] => {
  const points = settings?.apoOverride?.graphicEq;
  const intensity = driverIntensity(settings?.intensity ?? 0);
  return points?.length && intensity > 0
    ? points.map(({ frequency, gain }) => ({
        frequency,
        gain: clampGain(Math.round(gain * intensity * 100) / 100),
      }))
    : [];
};

/** Overlapping filters add; the largest individual gain is not the layer peak. */
export const getDriverPeakBoost = (
  settings: IDriverSettings | undefined,
): number =>
  Math.max(
    0,
    getCombinedResponsePeakGain({
      filters: getDriverFilters(settings),
      curves: [getDriverGraphicEq(settings)],
    }),
  );
