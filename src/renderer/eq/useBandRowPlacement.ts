/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useState } from 'react';
import { IBandPlacement, isSamePlacement } from './bandPlacement';
import { applyBandPlacement, measureBandPlacement } from './bandsRail';

/**
 * The bands in fixed places across the rail, low to high, at most
 * `MAX_BAND_PITCH` apart and centred where that leaves room
 * (`bandPlacement.ts`, Ivan 2026-11-16); too many to fit at the narrowest a
 * band reads at, the row scrolls instead. Measured against the rail, which
 * is the page's width whether or not the graph is above it. Your EQ's rail
 * and a preset's rail being edited (`PresetCurveRail`) both stand this way.
 *
 * Keyed on how many bands there are and nothing about them: a frequency
 * dragged on the graph moves no slider (Ivan, 2026-09-26), and neither a
 * gain drag nor a frequency drag re-reads a box on every step. Two bands
 * that pass each other trade places because the row is drawn in frequency
 * order.
 *
 * Whether the bands are placed is the one thing about it the page renders
 * from. Where they stand is written onto the row itself
 * (`applyBandPlacement`): it changes on every frame of a window being
 * resized, and as state each change rendered the page again — the
 * thirty-one bands, the Tone's dials and the graph's points — on every
 * frame (Ivan, 2026-09-27: "improve app resizing so it doesnt over
 * calculate").
 */
const useBandRowPlacement = (
  bandsElement: HTMLDivElement | null,
  bandCount: number,
): boolean => {
  const [isPlaced, setIsPlaced] = useState(false);
  useLayoutEffect(() => {
    const bands = bandsElement;
    if (!bands || bandCount === 0) {
      setIsPlaced(false);
      return undefined;
    }
    let applied: IBandPlacement | undefined;
    const settle = (next: IBandPlacement | undefined) => {
      if (!isSamePlacement(applied, next)) {
        applied = next;
        applyBandPlacement(bands, next);
      }
      setIsPlaced(next !== undefined);
    };
    // The rail's width is independent of overflowing bands and scroll arrows.
    // Watching the row instead fed our own layout change back into the fit
    // decision and could alternate placed/scrolling forever at a fixed width.
    const rail = bands.closest('.bands-rail');
    const scroller = bands.closest('.workspace-tab-panel__scroll');
    const place = () => settle(measureBandPlacement(bands, bandCount));
    place();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(place);
    if (rail) {
      observer.observe(rail);
    }
    if (scroller) {
      observer.observe(scroller);
    }
    return () => observer.disconnect();
  }, [bandsElement, bandCount]);
  return isPlaced;
};

export default useBandRowPlacement;
