/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  FilterTypeEnum,
  FIXED_BAND_FREQUENCIES,
  FIXED_BAND_SIZES,
  FixedBandSizeEnum,
  IFilter,
  IFilterEdit,
} from '../../common/constants';
import type { IBandDesign } from '../../common/bandDesigns';
import {
  qualityForAddedBand,
  qualityForMainRack,
} from '../../common/bandQuality';

/**
 * WHAT A BAND GOES BACK TO (Ivan, 2026-11-16: "reset bands' Q and
 * frequencies ... if I Ctrl+click on the frequency it restores it to the
 * band design's default"): the place the band layout gave it.
 *
 * The layout is the saved band design that is on, when one is
 * (`eqBandDesign`), each of its bands with its own Q; otherwise the built-in
 * layout of as many bands, every one at the layout's Q
 * (`qualityForMainRack`). Bands someone added or took away leave a count no
 * built-in layout has: then it is the built-in layout nearest below (or the
 * smallest), and the bands are matched to its slots in frequency order,
 * each to the nearest it can have without two bands crossing.
 *
 * A band left without a slot — one more than the layout has, which is what
 * Add band makes — keeps its frequency, and its Q goes to the one Add band
 * would give it among the reset bands (`qualityForAddedBand`), which on a
 * built-in layout is the layout's Q.
 */
export interface IBandDefault {
  /** Undefined for a band the layout has no slot for: it keeps its own. */
  frequency?: number;
  quality: number;
}

interface ISlot {
  frequency: number;
  quality: number;
}

/** The built-in layout a count of bands is read against. */
const builtInFor = (count: number): FixedBandSizeEnum => {
  const sizes = [...FIXED_BAND_SIZES].sort((a, b) => a - b);
  const below = sizes.filter((size) => size <= count);
  return below.length > 0 ? below[below.length - 1] : sizes[0];
};

const slotsFor = (count: number, design?: IBandDesign): ISlot[] => {
  if (design && design.bands.length > 0) {
    return [...design.bands]
      .sort((a, b) => a.frequency - b.frequency)
      .map(({ frequency, quality }) => ({ frequency, quality }));
  }
  const frequencies = FIXED_BAND_FREQUENCIES[builtInFor(count)];
  const quality = qualityForMainRack(frequencies);
  return frequencies.map((frequency) => ({ frequency, quality }));
};

const distance = (a: number, b: number) => Math.abs(Math.log2(a / b));

/**
 * Bands and slots, both low to high, paired without crossing so the pairs
 * are as close as they can be: every band paired where there are slots
 * enough, every slot where there are bands enough. A small dynamic program:
 * at most 31 by 31.
 */
const pairInOrder = (bands: number[], slots: number[]): Array<number | -1> => {
  const n = bands.length;
  const m = slots.length;
  const skipBands = n > m;
  const cost: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(Infinity),
  );
  cost[0][0] = 0;
  for (let i = 0; i <= n; i += 1) {
    for (let j = 0; j <= m; j += 1) {
      const here = cost[i][j];
      if (here !== Infinity) {
        if (i < n && j < m) {
          const paired = here + distance(bands[i], slots[j]);
          if (paired < cost[i + 1][j + 1]) {
            cost[i + 1][j + 1] = paired;
          }
        }
        if (skipBands && i < n && here < cost[i + 1][j]) {
          cost[i + 1][j] = here;
        }
        if (!skipBands && j < m && here < cost[i][j + 1]) {
          cost[i][j + 1] = here;
        }
      }
    }
  }
  const pairs: Array<number | -1> = new Array<number | -1>(n).fill(-1);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const paired = cost[i - 1][j - 1] + distance(bands[i - 1], slots[j - 1]);
    if (Math.abs(cost[i][j] - paired) < 1e-9) {
      pairs[i - 1] = j - 1;
      i -= 1;
      j -= 1;
    } else if (skipBands) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return pairs;
};

/** Each band's default, by id. `bands` in any order. */
export const bandLayoutDefaults = (
  bands: readonly IFilter[],
  design?: IBandDesign,
): Map<string, IBandDefault> => {
  const sorted = [...bands].sort((a, b) => a.frequency - b.frequency);
  const slots = slotsFor(sorted.length, design);
  const pairs = pairInOrder(
    sorted.map(({ frequency }) => frequency),
    slots.map(({ frequency }) => frequency),
  );
  const pairedQualities = pairs
    .filter((slot) => slot >= 0)
    .map((slot) => slots[slot].quality);
  const spareQuality = qualityForAddedBand(pairedQualities);
  return new Map(
    sorted.map((band, at) => {
      const slot = pairs[at];
      return [
        band.id,
        slot >= 0
          ? { frequency: slots[slot].frequency, quality: slots[slot].quality }
          : { quality: spareQuality },
      ];
    }),
  );
};

/**
 * The one edit that puts every band back where its layout put it, gains
 * kept. Q only for bells: a shelf's or a cut's Q is a slope, not a width the
 * layout gave it. Nothing for a band already there.
 */
export const bandLayoutResetEdits = (
  bands: readonly IFilter[],
  design?: IBandDesign,
): IFilterEdit[] => {
  const defaults = bandLayoutDefaults(bands, design);
  return bands.flatMap((band) => {
    const home = defaults.get(band.id);
    if (!home) {
      return [];
    }
    const edit: IFilterEdit = { id: band.id };
    if (home.frequency !== undefined && home.frequency !== band.frequency) {
      edit.frequency = home.frequency;
    }
    if (band.type === FilterTypeEnum.PK && home.quality !== band.quality) {
      edit.quality = home.quality;
    }
    return edit.frequency === undefined && edit.quality === undefined
      ? []
      : [edit];
  });
};
