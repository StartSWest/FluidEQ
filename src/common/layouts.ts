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

import { qualitiesForRack } from './bandQuality';
import {
  DEFAULT_QUALITY,
  FilterTypeEnum,
  FixedBandSizeEnum,
  FIXED_BAND_FREQUENCIES,
  IFilter,
  IFiltersMap,
} from './constants';

/** The editable part of a band that should survive a layout change. */
export interface ILayoutBand {
  frequency: number;
  gain: number;
  quality: number;
  type: FilterTypeEnum;
}

export type ILayoutSnapshot = ILayoutBand[];

const cloneBand = (band: ILayoutBand): ILayoutBand => ({ ...band });

const sortBands = (bands: ILayoutSnapshot): ILayoutSnapshot =>
  bands.map(cloneBand).sort((left, right) => left.frequency - right.frequency);

export const getFixedBandSizeForCount = (
  count: number,
): FixedBandSizeEnum | undefined => {
  const sizes = Object.values(FixedBandSizeEnum).filter(
    (value): value is number => typeof value === 'number',
  );
  return sizes.find(
    (size) =>
      FIXED_BAND_FREQUENCIES[size as FixedBandSizeEnum].length === count,
  ) as FixedBandSizeEnum | undefined;
};

export const snapshotFilters = (filters: IFiltersMap): ILayoutSnapshot =>
  sortBands(
    Object.values(filters).map((filter: IFilter) => ({
      frequency: filter.frequency,
      gain: filter.gain,
      quality: filter.quality,
      type: filter.type,
    })),
  );

const isSameFrequency = (left: number, right: number) =>
  Math.abs(Math.log10(Math.max(left, 1)) - Math.log10(Math.max(right, 1))) <
  0.0005;

/**
 * A band the target layout is filling a gap with, at the target's own width.
 *
 * `quality` is the layout's, not the app's: a band arriving at Q 2 in a
 * thirty-one-band rack is three times wider than the bands either side of it,
 * and the one thing a layout change must not do is leave a rack whose bands
 * are not the same shape.
 */
const neutralBand = (
  frequency: number,
  quality = DEFAULT_QUALITY,
): ILayoutBand => ({
  frequency,
  gain: 0,
  quality,
  type: FilterTypeEnum.PK,
});

/**
 * Convert the current layout to another fixed size without throwing away the
 * source snapshot. A smaller layout keeps representative source bands; a
 * larger layout keeps every source band and fills the gaps with neutral bands.
 */
export const adaptLayoutSnapshot = (
  sourceSnapshot: ILayoutSnapshot,
  targetSize: FixedBandSizeEnum,
): ILayoutSnapshot => {
  const source = sortBands(sourceSnapshot);
  const targetCount = FIXED_BAND_FREQUENCIES[targetSize].length;
  // Every band this function invents belongs to the TARGET rack, so it takes
  // that rack's width at its own frequency — which is not one number on a
  // layout whose spacing changes along it.
  const widths = qualitiesForRack(FIXED_BAND_FREQUENCIES[targetSize]);
  const filler = (frequency: number) =>
    neutralBand(
      frequency,
      widths[FIXED_BAND_FREQUENCIES[targetSize].indexOf(frequency)] ??
        DEFAULT_QUALITY,
    );

  if (source.length === 0) {
    return FIXED_BAND_FREQUENCIES[targetSize].map(filler);
  }

  if (source.length >= targetCount) {
    if (source.length === targetCount) {
      return source;
    }

    const selected = Array.from({ length: targetCount }, (_value, index) => {
      const sourceIndex = Math.round(
        (index * (source.length - 1)) / (targetCount - 1),
      );
      return source[sourceIndex];
    });
    return sortBands(selected);
  }

  const expanded = source.map(cloneBand);
  FIXED_BAND_FREQUENCIES[targetSize].forEach((frequency) => {
    if (
      expanded.length < targetCount &&
      !expanded.some((band) => isSameFrequency(band.frequency, frequency))
    ) {
      expanded.push(filler(frequency));
    }
  });

  // The fixed frequencies normally fill the target. This fallback keeps the
  // function safe if a future layout definition contains duplicate points.
  let extraIndex = 0;
  while (expanded.length < targetCount) {
    const min = expanded[0].frequency;
    const max = expanded[expanded.length - 1].frequency;
    const ratio = (extraIndex + 1) / (targetCount - expanded.length + 1);
    const frequency = Math.round(
      10 ** (Math.log10(min) + ratio * (Math.log10(max) - Math.log10(min))),
    );
    if (!expanded.some((band) => isSameFrequency(band.frequency, frequency))) {
      expanded.push(filler(frequency));
    }
    extraIndex += 1;
  }

  return sortBands(expanded).slice(0, targetCount);
};

/**
 * Adapt a layout's tuning values onto the canonical frequency positions for
 * the target quick layout. This keeps the user's gains/Q/type when moving
 * between band counts while ensuring each layout starts with its predefined
 * frequencies. Once the target layout is edited, its exact snapshot is saved
 * and restored on the next visit.
 */
export const adaptLayoutToFixedFrequencies = (
  sourceSnapshot: ILayoutSnapshot,
  targetSize: FixedBandSizeEnum,
): ILayoutSnapshot => {
  const adapted = adaptLayoutSnapshot(sourceSnapshot, targetSize);
  const widths = qualitiesForRack(FIXED_BAND_FREQUENCIES[targetSize]);
  return FIXED_BAND_FREQUENCIES[targetSize].map((frequency, index) => ({
    ...(adapted[index] || neutralBand(frequency, widths[index])),
    frequency,
    // The TARGET rack's width, on every band and not only on the ones this
    // conversion invented. A band keeping the width it had in the rack it came
    // from is a band of the wrong shape: fifteen bands brought into a
    // thirty-one-band rack arrived three times wider than the sixteen filling
    // the gaps between them, so half the rack rang and half of it did not, and
    // flattening the gains left the widths mismatched underneath. A band's
    // frequency is being replaced here anyway — this is a change of rack, not
    // an edit of one.
    quality: widths[index],
  }));
};
