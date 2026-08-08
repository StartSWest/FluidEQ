/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
        'Puts back the low end a sealed dynamic gives up when the earpad seal is less than perfect — seal loss only ever removes bass, never adds it',
      ),
      pk(
        3000,
        -0.8,
        1.4,
        'Eases the forwardness that the earcup cavity adds through the upper mids, where it reads as shout on loud material',
      ),
      highShelf(
        7000,
        -1,
        0.5,
        'A broad trim across the region where a dynamic diaphragm stops moving as one piece, wide enough not to depend on exactly where that happens',
      ),
    ],
    note: 'The bass lift is the confident part: seal loss only takes bass away. The two above it are broad on purpose — diaphragm breakup is set by dome geometry and tension rather than driver size, so two 40 mm drivers can break up an octave apart, and a wide shelf covers that spread instead of betting on one frequency.',
  },
  {
    id: 'planar-headphone',
    name: 'Planar magnetic',
    tagline: 'Flat diaphragm driven across its whole surface',
    category: 'headphone',
    filters: [
      lowShelf(
        45,
        0.8,
        0.6,
        'Restores a little sub-bass, which an open back lets escape rather than the driver failing to produce it',
      ),
      pk(
        1500,
        0.8,
        1.2,
        'Fills the slight lower-treble dip that gives some planars their reputation for sounding polite through vocals',
      ),
      highShelf(
        8000,
        -1,
        0.5,
        'Takes the edge off the extra top-octave energy a large planar diaphragm carries further out than a dynamic does',
      ),
    ],
    note: 'Broad and small on purpose. Where a planar diaphragm interferes with itself scales with its size — nearer 9-11 kHz on a large one, 6-7 kHz on a smaller one — so no single frequency suits every planar. These sit between the two and stay gentle enough to be taste rather than correction.',
  },
  {
    id: 'dynamic-iem',
    name: 'Single dynamic',
    tagline: 'One moving-coil driver, the most common in-ear design',
    category: 'iem',
    filters: [
      lowShelf(
        40,
        0.8,
        0.6,
        'Recovers the deepest bass that the pressure-relief vent every dynamic in-ear needs lets slip away',
      ),
      pk(
        200,
        -0.8,
        1,
        'Trims the mid-bass bloom a sealed dynamic builds up, which is what muddies male voices',
      ),
      pk(
        7000,
        -1,
        1,
        'A wide, shallow dip through the region a sealed in-ear fit makes peaky, kept broad because where it lands depends on your ears and tips',
      ),
    ],
    note: 'The treble dip is broad because that peak is your ear canal, not the driver, and it moves by most of an octave between people, tips and insertion depth. Change tips first if it sounds wrong. If your model is in the AutoEQ or Squiglink databases, use that — for this type especially, a measurement beats a family guess by a wide margin.',
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
        'Armatures roll off low bass with no dynamic woofer to carry it, so this puts some of the weight back',
      ),
      pk(
        3000,
        -1.5,
        2,
        'Damps the armature passband resonance that gives multi-BA sets their characteristic hardness',
      ),
      pk(
        8000,
        -1,
        2,
        'Softens the second armature peak higher up, which is the part that reads as splashy on cymbals',
      ),
    ],
    note: 'Adding sub-bass electrically has limits — a driver that cannot move that much air will distort before it gets loud. If the low end starts sounding loose rather than fuller, lower the strength.',
  },
  {
    id: 'hybrid-iem',
    name: 'Hybrid',
    tagline: 'Dynamic woofer with balanced armature mids and treble',
    category: 'iem',
    filters: [
      pk(
        250,
        -0.8,
        1,
        'Cleans up the bass bleed where the dynamic woofer runs past its handover point into the lower mids',
      ),
      pk(
        2000,
        -0.8,
        1.2,
        'Smooths the crossover region, which is where hybrids most often sound like two separate drivers',
      ),
      highShelf(
        7100,
        -1.5,
        0.7,
        'Every hybrid puts an armature on treble duty, and an armature run near its resonance sits higher and sharper than a dynamic would',
      ),
    ],
    note: 'Crossover points differ between models, so the middle filter aims at the region hybrids most commonly use rather than at yours specifically. The treble shelf is the one part of this that points the same way across the whole class.',
  },

  // Diaphragm materials.
  //
  // These are weaker predictors than topology and the gains reflect that. What
  // a material genuinely sets is its stiffness-to-mass ratio and how well it
  // damps itself, which together decide where the diaphragm's first breakup
  // mode lands and how sharp it is when it arrives. That is a real mechanism
  // and it is the only thing these filters act on — everything else a material
  // gets credited with is downstream of the enclosure and the tuning.
  {
    id: 'titanium-diaphragm',
    name: 'Titanium coated',
    tagline: 'Stiff metal-coated diaphragm',
    category: 'material',
    filters: [
      pk(
        6000,
        -0.8,
        2,
        'Softens the leading edge that a stiff diaphragm gives to transients before its breakup proper',
      ),
      pk(
        9500,
        -1.5,
        3,
        'A titanium coating stiffens the diaphragm, moving its first breakup mode up and narrowing it; this damps where it typically lands',
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
      pk(
        5000,
        -0.8,
        1.6,
        'Pulls back the presence lift that graphene sets are commonly voiced with to show off their detail',
      ),
      highShelf(
        8000,
        -1,
        0.7,
        'Graphene pushes breakup above the audible band, so what is left up here is tuning rather than artefact; this trims it',
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
        'Bio-cellulose damps itself well, smearing breakup into a broad softness instead of a peak; this restores some top-end bite',
      ),
      pk(
        12000,
        0.8,
        1.4,
        'Adds a little air at the very top, which heavy self-damping is the first thing to take away',
      ),
    ],
    note: 'Damping is the one property this material genuinely has more of, so this lifts rather than cuts. Small by design — it is a family tendency, not a measurement of your unit.',
  },

  // Driver size.
  //
  // The strongest mechanism in this list and the simplest: diaphragm area sets
  // how much air the driver moves, and diameter sets where it stops moving as
  // one piece. Bigger shifts bass authority up and breakup down; smaller does
  // the reverse. Both follow from the geometry directly.
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
      pk(
        8000,
        -0.8,
        2,
        'Damps the second mode that follows the first one down the scale when the diaphragm is this big',
      ),
    ],
    note: 'Large drivers usually need less help in the bass and more control higher up, which is what this does. Pair it with your topology choice rather than using it instead.',
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
      highShelf(
        9000,
        -0.8,
        0.7,
        'Eases the top octave, which sits just above where a diaphragm this size starts misbehaving',
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
      pk(
        3000,
        -0.8,
        1.6,
        'Balances the upper mids, which dominate when there is little bass underneath them to hold them down',
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
      lowShelf(
        50,
        0.8,
        0.6,
        'Recovers a little of the deepest bass a diaphragm this small struggles to pressurise the canal with',
      ),
      pk(
        8000,
        -1,
        3,
        'A 10 mm in-ear diaphragm breaks up high in the treble, where it adds a thin edge rather than body',
      ),
    ],
    note: 'A sealed in-ear already gets plenty of mid-bass from the canal, so the lift here is deliberately confined to the very bottom.',
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
