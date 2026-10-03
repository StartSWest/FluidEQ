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

import heightProperty from '../utils/heightProperty';
import { watchBandsPaneNeed } from '../utils/bandsPaneNeed';
import {
  IBandPlacement,
  IPlotGeometry,
  placeBandsEvenly,
} from '../graph/plotGeometry';

// The EQ page's band rail: its measured height, what the pane under the
// graph needs for a full track, and the bands' places written onto the row.

/** The rail's height on the rail, which the sliders' length is worked out
 * from (`MainContent.scss`). */
const measureRail = heightProperty('--bands-rail-height');

/** That, and what the pane round it needs for a full track, which is where
 * the pane under the graph opens until the divider is moved. */
export const attachRail = (rail: HTMLDivElement | null) => {
  const stopMeasuring = measureRail(rail);
  const stopWatching = watchBandsPaneNeed(rail);
  return () => {
    stopMeasuring?.();
    stopWatching?.();
  };
};

/** Measure the available rail, never the row whose placement we are changing.
 * An overflowing row is wider than its viewport: measuring it made the bands
 * appear to fit, then stop fitting once placed, repeating on every resize. */
export const measureBandPlacement = (
  bands: HTMLElement,
  plot: IPlotGeometry,
  count: number,
): IBandPlacement | undefined => {
  const rail = bands.closest('.bands-rail');
  if (!(rail instanceof HTMLElement)) {
    return undefined;
  }
  const box = rail.getBoundingClientRect();
  const offset = plot.element.getBoundingClientRect().left - box.left;
  let visible = { left: 0, right: box.width };
  const scroller = bands.closest('.workspace-tab-panel__scroll');
  if (scroller instanceof HTMLElement) {
    const left =
      scroller.getBoundingClientRect().left + scroller.clientLeft - box.left;
    visible = {
      left: Math.max(0, left),
      right: Math.min(box.width, left + scroller.clientWidth),
    };
  }
  return placeBandsEvenly(count, plot, offset, visible);
};

/**
 * The bands' places, written onto the row (`.bands.is-placed` in
 * MainContent.scss reads them): the slot every band is, the first band's
 * lead from the row's edge and the lead between each band and the one
 * before it, which `placeBandsEvenly` makes the same for every band after
 * the first. On the row rather than on each band, so bands that trade
 * places or arrive need nothing written again.
 */
export const applyBandPlacement = (
  bands: HTMLElement,
  placement: IBandPlacement | undefined,
) => {
  if (!placement) {
    bands.style.removeProperty('--band-slot');
    bands.style.removeProperty('--band-first-lead');
    bands.style.removeProperty('--band-lead');
    return;
  }
  const [first = 0, next = 0] = placement.leads;
  bands.style.setProperty('--band-slot', `${placement.slot}px`);
  bands.style.setProperty('--band-first-lead', `${first}px`);
  bands.style.setProperty('--band-lead', `${next}px`);
};
