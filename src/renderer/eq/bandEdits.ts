/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IFilter,
  IFilterEdit,
  IFiltersMap,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_QUALITY,
  NO_GAIN_FILTER_TYPES,
} from 'common/constants';
import { clamp } from '../utils/utils';

export type TBandField = 'frequency' | 'gain' | 'quality';

const BOUNDS: Record<TBandField, readonly [number, number]> = {
  frequency: [MIN_FREQUENCY, MAX_FREQUENCY],
  gain: [MIN_GAIN, MAX_GAIN],
  quality: [MIN_QUALITY, MAX_QUALITY],
};

/**
 * What moving one parameter to `newValue` writes to the engine: where it puts
 * every band selected, the bands already there included.
 *
 * The value handed in is the one the control shows, which belongs to the
 * primary band; every other band in the selection moves by the same amount
 * rather than to the same value, so a selection keeps its shape. Bands that
 * would run past an end of the range stop there — which does mean a group
 * pushed to the top and then pulled back spreads out, and that is the only
 * behaviour that does not silently discard the rest of the selection.
 *
 * A band already at its target stays in the write. Writes go one at a time
 * and a newer one replaces the one waiting, so a write naming only what its
 * own step changed dropped what the step before it had moved: a group
 * pushed until one band stopped at the end of the range left that band's
 * last step out of the engine.
 */
export const groupWrite = (
  filters: IFiltersMap,
  primary: IFilter | undefined,
  selectedIds: readonly string[],
  field: TBandField,
  newValue: number,
): IFilterEdit[] => {
  if (!primary) {
    return [];
  }
  const ids = selectedIds.includes(primary.id) ? selectedIds : [primary.id];
  const delta = newValue - primary[field];
  const [low, high] = BOUNDS[field];
  const targets: IFilterEdit[] = [];
  ids.forEach((id) => {
    const filter = filters[id];
    if (
      !filter ||
      (field === 'gain' && NO_GAIN_FILTER_TYPES.includes(filter.type))
    ) {
      return;
    }
    targets.push({ id, [field]: clamp(filter[field] + delta, low, high) });
  });
  return targets;
};

/** Only the targets a band is not already at. */
const changesOnly = (
  filters: IFiltersMap,
  field: TBandField,
  targets: IFilterEdit[],
): IFilterEdit[] =>
  targets.filter((target) => target[field] !== filters[target.id][field]);

/** The edits moving one parameter to `newValue` makes across the selection. */
export const groupEdits = (
  filters: IFiltersMap,
  primary: IFilter | undefined,
  selectedIds: readonly string[],
  field: TBandField,
  newValue: number,
): IFilterEdit[] =>
  changesOnly(
    filters,
    field,
    groupWrite(filters, primary, selectedIds, field, newValue),
  );

/**
 * What one band's own gain fader moving to `newValue` writes to the engine:
 * every band it moves, where it lands, even where the store already shows it
 * there.
 *
 * It moves the selection as a group only when its band is part of it, and
 * that band alone otherwise. It used to hand every fader's value to the group
 * edit unconditionally, which measures the step from the selected band and
 * applies it there: a fader that moved without its band being selected
 * first — the mouse wheel over it, the arrow keys after Tab, a screen reader
 * setting the value — moved a different band, or no band at all with nothing
 * selected. A press on a band selects it before its fader moves, which is why
 * dragging never showed it (found 2026-09-30: two bands a script set back to
 * 0 dB stayed at +12.4 and +7.6).
 *
 * And it keeps a band the store already shows at its target. The store is
 * previewed first and the write follows through a queue, so by the time a
 * queued write is worked out the preview has usually drawn the very value it
 * carries. Measured against the store, the write then looked like no change
 * and was dropped: two quick steps left the engine and the saved profile on
 * the first (a script's 0.3 then 0 left 1.5 kHz at +0.3 dB while its fader
 * read 0.0), and the end of a drag or of a few wheel ticks could stay a step
 * behind what the fader showed.
 */
export const bandGainWrite = (
  filters: IFiltersMap,
  primary: IFilter | undefined,
  selectedIds: readonly string[],
  filterId: string,
  newValue: number,
): IFilterEdit[] => {
  const source = filters[filterId];
  if (!source) {
    return [];
  }
  if (!selectedIds.includes(filterId)) {
    return groupWrite(filters, source, [filterId], 'gain', newValue);
  }
  const lead = primary ?? source;
  return groupWrite(
    filters,
    lead,
    selectedIds,
    'gain',
    lead.gain + (newValue - source.gain),
  );
};

/** What a fader's step changes in the store: its preview. */
export const bandGainEdits = (
  filters: IFiltersMap,
  primary: IFilter | undefined,
  selectedIds: readonly string[],
  filterId: string,
  newValue: number,
): IFilterEdit[] =>
  changesOnly(
    filters,
    'gain',
    bandGainWrite(filters, primary, selectedIds, filterId, newValue),
  );
