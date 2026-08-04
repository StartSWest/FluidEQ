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
  IDriverSettings,
  NO_GAIN_FILTER_TYPES,
  clampGain,
} from './constants';

export type { IDriverSettings };

/**
 * Driver compensation: corrections for how a *kind* of transducer behaves.
 *
 * This is a third layer, independent of the user's bands and of the voicing.
 * Where voicing asks "what are you listening to", this asks "what are you
 * listening on", and corrects the tendencies that come from how the driver
 * physically works.
 *
 * The categories are ordered by how much they actually predict, and the gains
 * follow the same order:
 *
 * - TOPOLOGY (how the driver works) constrains real physics — how the
 *   diaphragm is driven, whether it can move air, where it stops moving as one
 *   piece. Strongest, so it carries the largest corrections.
 * - SIZE is nearly as good and even simpler: diaphragm area sets bass
 *   authority, diameter sets where breakup lands.
 * - MATERIAL is the weakest. It genuinely sets stiffness-to-mass and
 *   self-damping, which shift the breakup region, but everything else a
 *   material gets credited with is downstream of the enclosure and the maker's
 *   tuning. These entries are therefore the gentlest of the three.
 *
 * In every case this is a family tendency, not a measurement of the user's
 * unit. Where a measured profile exists for their exact model in the AutoEQ or
 * Squiglink databases, that is strictly better and the UI says so.
 *
 * Gains are deliberately small throughout. If the guess is wrong for a
 * particular unit the result should be a mild colouration the user can dial
 * back, never a ruined listen — which is also why the default intensity sits
 * below 100%.
 */

export interface IDriverFilter {
  type: FilterTypeEnum;
  frequency: number;
  /** Ignored for the gainless filter types. */
  gain: number;
  quality: number;
  /** Why this filter exists, shown in the UI so the curve is not a mystery. */
  reason: string;
}

export type DriverCategory =
  'headphone' | 'iem' | 'speaker' | 'material' | 'size';

export interface IDriverProfile {
  id: string;
  name: string;
  tagline: string;
  category: DriverCategory;
  filters: IDriverFilter[];
  /** The limits of this correction, shown under the picker once selected. */
  note: string;
}

/**
 * Below 100% on purpose.
 *
 * The best strength for a family correction is its correlation with the
 * deviation your particular unit actually has. Nobody can know that from a
 * dropdown, so the default sits where being wrong stays comfortably
 * recoverable and being right still does most of the work.
 */
export const DEFAULT_DRIVER_INTENSITY = 0.6;

export const DEFAULT_DRIVER: IDriverSettings = {
  profileId: '',
  intensity: DEFAULT_DRIVER_INTENSITY,
};

const pk = (
  frequency: number,
  gain: number,
  quality: number,
  reason: string,
): IDriverFilter => ({
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
): IDriverFilter => ({
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

/**
 * Ordered by how many people own each, most common first, so the picker reads
 * naturally rather than alphabetically.
 *
 * Every filter here traces to a stated physical mechanism; none is a round
 * number chosen because it sounded plausible. The `reason` line is honest
 * about which are measured population effects and which are mechanism-led.
 */
export const DRIVER_PROFILES: IDriverProfile[] = [
  {
    id: 'dynamic-headphone',
    name: 'Dynamic',
    tagline: 'Moving coil, the type most headphones use',
    category: 'headphone',
    filters: [
      lowShelf(
        90,
        1,
        0.6,
        'A small lift for the low end a sealed dynamic gives up when the earpad seal is less than perfect — seal loss only ever removes bass, so the direction of this one is safe',
      ),
      highShelf(
        7000,
        -1,
        0.5,
        'A broad, gentle trim across the region where a dynamic diaphragm stops moving as one piece, wide enough not to depend on exactly where that happens',
      ),
    ],
    note: 'The bass lift is the confident half: seal loss only ever takes bass away, never adds it. The treble shelf is deliberately broad and small, because diaphragm breakup is set by dome geometry and tension rather than driver size — two 40 mm drivers can break up an octave apart. A wide shelf covers that spread instead of betting on one frequency.',
  },
  {
    id: 'planar-headphone',
    name: 'Planar magnetic',
    tagline: 'Flat diaphragm driven across its whole surface',
    category: 'headphone',
    filters: [
      highShelf(
        8000,
        -1,
        0.5,
        'A gentle top-octave trim for the extra treble energy a large planar diaphragm carries further out than a dynamic does',
      ),
    ],
    note: 'Broad and small on purpose. Where a planar diaphragm interferes with itself scales with its size — nearer 9-11 kHz on a large one, 6-7 kHz on a smaller one — so no single frequency is right for every planar. This shelf sits between the two and stays gentle enough to be a taste adjustment rather than a correction. Lower the strength if your set already sounds right up top.',
  },
  {
    id: 'dynamic-iem',
    name: 'Single dynamic',
    tagline: 'One moving-coil driver, the most common in-ear design',
    category: 'iem',
    filters: [
      pk(
        7000,
        -1,
        1,
        'A wide, shallow dip through the region a sealed in-ear fit makes peaky, kept broad because exactly where it lands depends on your ears and your tips',
      ),
    ],
    note: 'Broad and shallow because the peak here is your ear canal, not the driver, and it moves by most of an octave between people, tips and insertion depth. Change tips first if it sounds wrong. If your model is in the AutoEQ or Squiglink databases, use that — for this type especially, a measurement beats a family guess by a wide margin.',
  },
  {
    id: 'balanced-armature-iem',
    name: 'Balanced armature',
    tagline: 'Sealed armature drivers, common in stage and budget IEMs',
    category: 'iem',
    filters: [
      lowShelf(
        100,
        1.5,
        0.6,
        'Balanced armatures roll off low bass without a dynamic woofer to carry it; this puts a little back',
      ),
      pk(
        3000,
        -1.5,
        2,
        'Damps the armature passband resonance that gives multi-BA sets their characteristic hardness',
      ),
    ],
    note: 'Adding sub-bass electrically has limits — a driver that cannot move that much air will distort before it gets loud. Keep the strength moderate.',
  },
  {
    id: 'hybrid-iem',
    name: 'Hybrid',
    tagline: 'Dynamic woofer with balanced armature mids and treble',
    category: 'iem',
    filters: [
      highShelf(
        7100,
        -1.5,
        0.7,
        'Every hybrid puts an armature on treble duty, and an armature is a lightly damped resonant system run near its resonance, so the top two octaves sit higher and sharper than a dynamic would put them',
      ),
    ],
    note: 'A broad shelf rather than a targeted notch, because the mechanism only tells us the armature resonance is somewhere in the top two octaves — not exactly where on your set. This is the one topology in this list with a correction that points the same way across the whole class.',
  },

  // Diaphragm materials.
  //
  // These are weaker predictors than topology and the gains reflect that. What
  // a material genuinely sets is its stiffness-to-mass ratio and how well it
  // damps itself, which together decide where the diaphragm's first breakup
  // mode lands and how sharp it is when it arrives. That is a real mechanism
  // and it is the only thing these three filters act on — everything else a
  // material is credited with is downstream of the enclosure and the tuning,
  // not the material.
  {
    id: 'titanium-diaphragm',
    name: 'Titanium coated',
    tagline: 'Stiff metal-coated diaphragm',
    category: 'material',
    filters: [
      pk(
        9500,
        -1.5,
        3,
        'A titanium coating stiffens the diaphragm, which moves its first breakup mode up and narrows it; this damps where it typically lands',
      ),
    ],
    note: 'Coating thickness and diaphragm geometry move this region by kilohertz between models, so treat it as a starting point. A measured profile for your model is far more reliable.',
  },
  {
    id: 'graphene-diaphragm',
    name: 'Graphene',
    tagline: 'Very high stiffness for its weight',
    category: 'material',
    filters: [
      highShelf(
        8000,
        -1,
        0.7,
        'Graphene diaphragms push breakup above the audible band, and are commonly voiced with extra treble to show it off; this trims that back',
      ),
    ],
    note: 'This trims a tuning tendency rather than a physical artefact, so it is the most taste-dependent entry here. Turn it down or off if your set already sounds balanced.',
  },
  {
    id: 'bio-cellulose-diaphragm',
    name: 'Bio-cellulose',
    tagline: 'Naturally well-damped diaphragm',
    category: 'material',
    filters: [
      highShelf(
        7000,
        1,
        0.7,
        'Bio-cellulose damps itself well, which smears breakup into a broad softness instead of a peak; this restores a little top-end bite',
      ),
    ],
    note: 'Damping is the one property this material genuinely has more of, so this lifts rather than cuts. Small by design — it is a family tendency, not a measurement of your unit.',
  },

  // Driver size.
  //
  // The strongest mechanism in this whole list, and the simplest: diaphragm
  // area sets how much air the driver moves, and diaphragm diameter sets where
  // it stops moving as one piece. A bigger diaphragm shifts bass authority up
  // and breakup down; a smaller one does the reverse. Both follow from the
  // geometry directly, which is why these entries can be a little more
  // confident than the material ones.
  {
    id: 'size-large-50mm',
    name: '50 mm and larger',
    tagline: 'Big over-ear diaphragm',
    category: 'size',
    filters: [
      pk(
        4200,
        -1.5,
        2.5,
        'A large diaphragm stops moving as one piece lower down, so its breakup lands inside the presence region rather than above it',
      ),
    ],
    note: 'Large drivers usually need less bass help and more control higher up, which is what this does. Pair it with your topology choice rather than instead of it.',
  },
  {
    id: 'size-standard-40mm',
    name: '40 mm',
    tagline: 'The most common over-ear size',
    category: 'size',
    filters: [
      pk(
        5500,
        -1,
        2.5,
        'Gently damps the breakup region a 40 mm diaphragm typically settles into',
      ),
    ],
    note: 'This is the size most headphones use, so it is also the size manufacturers have tuned around the most. Keep the strength low.',
  },
  {
    id: 'size-small-30mm',
    name: '30 mm and smaller',
    tagline: 'Compact on-ear and portable drivers',
    category: 'size',
    filters: [
      lowShelf(
        110,
        1.5,
        0.6,
        'A small diaphragm moves less air, so the low end is the first thing it gives up; this puts some back',
      ),
    ],
    note: 'There is a hard limit to how much bass a small driver can produce before it distorts. If it starts sounding loose, lower the strength rather than raising it.',
  },
  {
    id: 'size-iem-10mm',
    name: '10 mm in-ear',
    tagline: 'Typical single dynamic in-ear diaphragm',
    category: 'size',
    filters: [
      pk(
        8000,
        -1,
        3,
        'A 10 mm in-ear diaphragm breaks up high in the treble, where it adds a thin edge rather than body',
      ),
    ],
    note: 'A sealed in-ear already gets plenty of bass from the canal, so this only addresses the top end.',
  },
];

export const getDriverProfile = (
  profileId: string,
): IDriverProfile | undefined =>
  DRIVER_PROFILES.find((profile) => profile.id === profileId);

/**
 * The filters this driver compensation contributes at a given intensity.
 *
 * Mirrors the voicing rules exactly: intensity scales gains, gainless filter
 * types are structural and pass through untouched, and anything whose scaled
 * gain rounds to zero is dropped rather than written as an inert command.
 */
export const getDriverFilters = (
  settings: IDriverSettings | undefined,
): IDriverFilter[] => {
  if (!settings?.profileId) {
    return [];
  }
  const profile = getDriverProfile(settings.profileId);
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
 * Worst-case boost this layer adds, so the caller can reserve headroom.
 * Only positive gains matter: cuts cannot clip.
 */
export const getDriverPeakBoost = (
  settings: IDriverSettings | undefined,
): number =>
  getDriverFilters(settings).reduce(
    (highest, filter) => Math.max(highest, filter.gain),
    0,
  );
