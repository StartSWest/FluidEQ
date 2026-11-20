/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from 'common/constants';
import { getSmartEqBands, getSmartEqLayout } from 'common/smartEq';
import {
  buildSmartEqSettings,
  confineSmartEqResponse,
} from 'common/smartEqContinuous';
import { getReferenceShape } from 'common/referenceCurve';
import { getPresenceLine, presenceAllowance } from './presenceThreshold';
import { getCorrectionLimit } from './correctionLimit';
import { buildBalancedGains } from './autoBalance';
import type {
  IBalanceRegionReport,
  IBalanceReport,
} from './autoBalanceCapture';
import type { TSmartEqMode } from './smartEqMode';

/**
 * A measured record turned into Smart EQ's gains, and the gains into the
 * layer: the whole answer, with no layer and no history in it, so the graph's
 * forming curve and the write are the same function of the same report.
 */

/** The bands a solve is asked for: the fixed layout, every gain at zero. */
export const SMART_EQ_LAYOUT = getSmartEqLayout();

/**
 * How much boost each frequency has earned, read off the lines on the plot.
 *
 * Built here rather than inside the solver, because it joins two things the
 * solver has no business knowing about: how much of the record each range
 * plays in, which comes off the capture, and where somebody has dragged that
 * range's two lines, which is a preference. The solver is handed one number
 * per frequency and stays a function of its own measurement.
 *
 * Ranges are contiguous and a band falls in exactly one, so this is a scan
 * rather than an interpolation. Blending across an edge would let a silent
 * range borrow permission from a loud neighbour, which is the whole failure
 * being fixed, one step removed.
 */
const allowanceFrom =
  (regions: IBalanceRegionReport[]) => (frequency: number) => {
    const region = regions.find(
      (entry) =>
        frequency >= entry.lowFrequency && frequency <= entry.highFrequency,
    );
    if (!region) {
      /*
       * No range covering this frequency means no presence information about
       * it, which is not the same claim as "nothing is playing here" — and
       * answering zero makes the second claim. A capture that reported no
       * ranges at all would then refuse every correction, silently, and look
       * exactly like a measurement that had decided the record was perfect.
       *
       * So absence of evidence permits rather than forbids. Everything
       * downstream still bounds it, and a frequency genuinely outside the
       * correctable span is declined long before this is consulted.
       */
      return 1;
    }
    /*
     * THE RECORD'S PRESENCE, NOT THIS SECOND'S. This read the allowance off
     * `liveDb` — the range in the last second — so the curve a hold wrote
     * depended on which bar it landed in: a bass that rested for a beat at
     * the hold took the whole bass lift off that song, and two plays of one
     * song held two curves. `presence` is the allowance averaged over every
     * frame learned, weighted by loudness: a range that played half the song
     * may be lifted half as far, whenever the hold lands.
     */
    if (Number.isFinite(region.presence)) {
      return region.presence;
    }
    // Nothing learned yet (the forming curve's first checkpoints): the bar
    // is all there is to go on.
    return presenceAllowance(
      region.liveDb,
      getPresenceLine(
        'floor',
        region.label,
        region.centreFrequency,
        region.typicalDb,
      ),
      getPresenceLine(
        'full',
        region.label,
        region.centreFrequency,
        region.typicalDb,
      ),
    );
  };

/**
 * The whole answer for a measured spectrum: the mode's destination, the
 * presence lines' allowance, the limit line, and nothing else. Undefined when
 * the measurement cannot support an answer at all (too narrow a trusted span
 * for the tilt fit).
 */
export const solveSmartEq = (
  report: Pick<IBalanceReport, 'samples' | 'regions'>,
  mode: TSmartEqMode,
): Record<string, number> | undefined => {
  const gains = buildBalancedGains(report.samples, SMART_EQ_LAYOUT, {
    // The mode's curve, whatever else is switched on. Which mode is chosen
    // decides the destination and nothing else does — see
    // `getReferenceShape`.
    reference: getReferenceShape(mode),
    // A range nothing is playing in cannot be lifted, however loudly it
    // reports a deficit. See the presence lines on the plot.
    boostAllowance: allowanceFrom(report.regions),
    // Symmetric limits, whatever the listener chose. An asymmetric pair
    // biases a centred correction; see `correctionLimit`.
    maxBoost: getCorrectionLimit(),
    maxCut: getCorrectionLimit(),
  });
  if (Object.keys(gains).length === 0) {
    return undefined;
  }
  // The limit line bounds the CURVE, and bells sum: two lawful bands can
  // stack past it. Out of bounds is scaled home — see confineSmartEqResponse.
  return confineSmartEqResponse(gains, SMART_EQ_LAYOUT, getCorrectionLimit());
};

/**
 * The solved gains as the layer to write. The strength the listener set
 * survives the write: a measurement is a new shape for the layer, not a
 * decision about how much of it to apply.
 */
export const smartEqLayerOf = (
  gains: Record<string, number>,
  measurement: Pick<
    ISmartEqSettings,
    'status' | 'lowFrequency' | 'highFrequency'
  >,
  intensity: number | undefined,
): ISmartEqSettings | undefined =>
  buildSmartEqSettings(
    SMART_EQ_LAYOUT,
    gains,
    { ...measurement, intensity },
    getCorrectionLimit(),
  );

/** The layer's gains by band id, zero where it holds nothing. */
export const gainsOf = (
  layer: ISmartEqSettings | undefined,
): Record<string, number> =>
  Object.fromEntries(
    getSmartEqBands(layer).map((band) => [band.id, band.gain]),
  );

/**
 * How far a band has to move for its range to be named and lit as moved
 * when a running mode writes, in dB. Below it the write is a refinement of a
 * range that was already right, and lighting it would say something changed
 * there that nobody can hear.
 */
const MOVED_DB = 0.5;

/** The ranges a write moved, for the graph to light and the bubble to name. */
export const movedRanges = (
  regions: IBalanceRegionReport[],
  gains: Record<string, number>,
  written: Record<string, number>,
): IBalanceRegionReport[] =>
  regions.filter((region) =>
    SMART_EQ_LAYOUT.some(
      (band) =>
        band.frequency >= region.lowFrequency &&
        band.frequency <= region.highFrequency &&
        Math.abs((gains[band.id] ?? 0) - (written[band.id] ?? 0)) >= MOVED_DB,
    ),
  );
