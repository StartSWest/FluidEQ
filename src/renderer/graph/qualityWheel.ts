/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IFiltersMap, MAX_QUALITY, MIN_QUALITY } from 'common/constants';

/**
 * WHAT ONE NOTCH OF CTRL+SCROLL DOES TO Q, on a graph handle and on a band's
 * slider alike (Ivan, 2026-11-17: "we can tune Q pressing Control and scroll
 * directly, same as in the graph"): one place, so the two cannot drift.
 *
 * The step is the wheeled band's own: 0.05 under Q 1, 0.1 under 10, 1 above,
 * so a wide band is tuned as finely as a narrow one by ear. It moves every
 * selected band by that step when the wheeled one is among them, as a drag
 * moves the selection, and the wheeled band alone otherwise. Each lands
 * inside the EQ's Q range, to two decimal places.
 */
const qualityWheelEdits = (
  filters: IFiltersMap,
  selectedIds: readonly string[],
  filterId: string,
  /** 1 a notch up (sharper), -1 a notch down (wider). */
  direction: number,
): Array<{ id: string; quality: number }> => {
  const filter = filters[filterId];
  if (!filter) {
    return [];
  }
  let step = 1;
  if (filter.quality < 1) {
    step = 0.05;
  } else if (filter.quality < 10) {
    step = 0.1;
  }
  const ids = selectedIds.includes(filterId) ? selectedIds : [filterId];
  return ids.flatMap((id) => {
    const band = filters[id];
    if (!band) {
      return [];
    }
    const quality =
      Math.round(
        Math.max(
          MIN_QUALITY,
          Math.min(MAX_QUALITY, band.quality + direction * step),
        ) * 100,
      ) / 100;
    return [{ id, quality }];
  });
};

export default qualityWheelEdits;
