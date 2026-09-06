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

const highShelf = (
  frequency: number,
  gain: number,
  reason: TranslationKey,
): IDriverFilter => ({
  type: FilterTypeEnum.HSC,
  frequency,
  gain,
  // Low Q avoids a resonant shoulder on a deliberately broad adjustment.
  quality: 0.5,
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
    filters: [
      pk(3000, -0.5, 0.7, 'driver.filter.presenceSoftening'),
      highShelf(7000, -0.35, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.headphone',
  },
  {
    id: 'planar-headphone',
    name: 'Planar magnetic',
    tagline: 'Flat diaphragm driven across its whole surface',
    category: 'headphone',
    filters: [
      pk(2000, 0.35, 0.65, 'driver.filter.vocalLift'),
      highShelf(9000, -0.25, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.headphone',
  },
  {
    id: 'dynamic-iem',
    name: 'Single dynamic',
    tagline: 'One moving-coil driver, the most common in-ear design',
    category: 'iem',
    filters: [
      pk(200, -0.4, 0.65, 'driver.filter.bassTidying'),
      highShelf(6500, -0.35, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'balanced-armature-iem',
    name: 'Balanced armature',
    tagline: 'Sealed armature drivers, common in stage and budget IEMs',
    category: 'iem',
    filters: [
      pk(3000, -0.6, 0.75, 'driver.filter.presenceSoftening'),
      highShelf(7500, -0.35, 'driver.filter.trebleSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'hybrid-iem',
    name: 'Hybrid',
    tagline: 'Dynamic woofer with balanced armature mids and treble',
    category: 'iem',
    filters: [
      pk(250, -0.35, 0.65, 'driver.filter.bassTidying'),
      pk(3000, -0.35, 0.7, 'driver.filter.presenceSoftening'),
    ],
    note: 'driver.profile.note.iem',
  },
  {
    id: 'titanium-diaphragm',
    name: 'Titanium coated',
    tagline: 'Stiff metal-coated diaphragm',
    category: 'material',
    filters: [highShelf(6000, -0.45, 'driver.filter.trebleSoftening')],
    note: 'driver.profile.note.material',
  },
  {
    id: 'graphene-diaphragm',
    name: 'Graphene',
    tagline: 'Very high stiffness for its weight',
    category: 'material',
    filters: [highShelf(7000, -0.25, 'driver.filter.trebleSoftening')],
    note: 'driver.profile.note.material',
  },
  {
    id: 'bio-cellulose-diaphragm',
    name: 'Bio-cellulose',
    tagline: 'Naturally well-damped diaphragm',
    category: 'material',
    filters: [highShelf(8000, 0.35, 'driver.filter.airLift')],
    note: 'driver.profile.note.material',
  },
  {
    id: 'size-large-50mm',
    name: '50 mm and larger',
    tagline: 'Big over-ear diaphragm',
    category: 'size',
    filters: [pk(4000, -0.45, 0.7, 'driver.filter.presenceSoftening')],
    note: 'driver.profile.note.size',
  },
  {
    id: 'size-standard-40mm',
    name: '40 mm',
    tagline: 'The most common over-ear size',
    category: 'size',
    filters: [pk(5000, -0.35, 0.7, 'driver.filter.presenceSoftening')],
    note: 'driver.profile.note.size',
  },
  {
    id: 'size-small-30mm',
    name: '30 mm and smaller',
    tagline: 'Compact on-ear and portable drivers',
    category: 'size',
    filters: [pk(250, -0.35, 0.7, 'driver.filter.bassTidying')],
    note: 'driver.profile.note.small',
  },
  {
    id: 'size-iem-10mm',
    name: '10 mm in-ear',
    tagline: 'Typical single dynamic in-ear diaphragm',
    category: 'size',
    filters: [highShelf(7000, -0.3, 'driver.filter.trebleSoftening')],
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
