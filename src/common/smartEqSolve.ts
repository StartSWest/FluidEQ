/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISmartEqSettings } from './constants';
import {
  describeSmartEqLayer,
  getSmartEqBands,
  getSmartEqLayout,
} from './smartEq';
import {
  buildSmartEqSettings,
  confineSmartEqResponse,
  isSmartEqRewriteDue,
} from './smartEqContinuous';
import { getReferenceShape } from './referenceCurve';
import { buildBalancedGains } from './autoBalance';
import type {
  IBalanceRegionReport,
  IBalanceReport,
} from './autoBalanceCapture';
import { type TPresenceOffsets, rangeAllowance } from './presenceLines';
import type { TSmartEqMode } from './smartEqMode';

/**
 * From a measured spectrum to the layer Smart EQ writes, and nothing else —
 * no layer, no history. The core solves (`main/smartEq/smartEqRunner.ts`);
 * what it measures is the record, so a solve is a pure function of the
 * record and these settings, and it REPLACES the layer rather than adding to
 * it.
 */

/** What the listener chose that a solve depends on. */
export interface ISmartEqSolveSettings {
  mode: TSmartEqMode;
  /** How far any band may move, either way — see `correctionLimit.ts`. */
  limitDb: number;
  presenceOffsets: TPresenceOffsets;
}

/**
 * How far a band has to move for its range to be named and lit as "moved"
 * when a running mode writes, in dB. Below it the write is a refinement of a
 * range that was already right, and lighting it would say something changed
 * there that nobody can hear.
 */
export const MOVED_DB = 0.5;

/** The bands a solve is asked for: the fixed layout, every gain at zero. */
const LAYOUT = getSmartEqLayout();

/** The layer's gains by band id, zero where it holds nothing. */
export const gainsOfSmartEq = (
  layer: ISmartEqSettings | undefined,
): Record<string, number> =>
  Object.fromEntries(
    getSmartEqBands(layer).map((band) => [band.id, band.gain]),
  );

/**
 * How much boost each frequency has earned, read off the lines on the plot.
 *
 * It joins two things the solver has no business knowing about: what each
 * range is doing at this moment, which comes off the capture, and where
 * somebody has dragged that range's two lines, which is a preference. The
 * solver is handed one number per frequency and stays a function of its own
 * measurement.
 *
 * Ranges are contiguous and a band falls in exactly one, so this is a scan
 * rather than an interpolation. Blending across an edge would let a silent
 * range borrow permission from a loud neighbour, which is the whole failure
 * being fixed, one step removed.
 */
const allowanceFrom =
  (regions: IBalanceRegionReport[], settings: ISmartEqSolveSettings) =>
  (frequency: number) => {
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
    return rangeAllowance(settings.presenceOffsets, settings.mode, region);
  };

/**
 * The whole answer for a measured spectrum: the mode's destination, the
 * presence lines' allowance, the limit line, and nothing else. Undefined when
 * the measurement cannot support an answer at all (too narrow a trusted span
 * for the tilt fit).
 */
export const solveSmartEq = (
  report: Pick<IBalanceReport, 'samples' | 'regions'>,
  settings: ISmartEqSolveSettings,
): Record<string, number> | undefined => {
  const gains = buildBalancedGains(report.samples, LAYOUT, {
    // The mode's curve, whatever else is switched on. Which mode is chosen
    // decides the destination and nothing else does — see
    // `getReferenceShape`.
    reference: getReferenceShape(settings.mode),
    // A range nothing is playing in cannot be lifted, however loudly it
    // reports a deficit. See the presence lines on the plot.
    boostAllowance: allowanceFrom(report.regions, settings),
    // Symmetric limits, whatever the listener chose. An asymmetric pair
    // biases a centred correction; see `correctionLimit`.
    maxBoost: settings.limitDb,
    maxCut: settings.limitDb,
  });
  if (Object.keys(gains).length === 0) {
    return undefined;
  }
  // The limit line bounds the CURVE, and bells sum: two lawful bands can
  // stack past it. Out of bounds is scaled home — see confineSmartEqResponse.
  return confineSmartEqResponse(gains, LAYOUT, settings.limitDb);
};

/** The solved gains as the layer to write, keeping the listener's strength. */
export const smartEqLayerOf = (
  gains: Record<string, number>,
  measurement: Pick<
    ISmartEqSettings,
    'status' | 'lowFrequency' | 'highFrequency'
  >,
  written: ISmartEqSettings | undefined,
  limitDb: number,
): ISmartEqSettings | undefined =>
  buildSmartEqSettings(
    LAYOUT,
    gains,
    {
      ...measurement,
      // The strength the listener set survives the write: a measurement is
      // a new shape for the layer, not a decision about how much of it to
      // apply.
      intensity: written?.intensity,
    },
    limitDb,
  );

/** Whether two layers would write the same thing, to the rounding step. */
export const isSameSmartEqLayer = (
  a: ISmartEqSettings | undefined,
  b: ISmartEqSettings | undefined,
): boolean => describeSmartEqLayer(a) === describeSmartEqLayer(b);

/** A running mode's write, and what it moved. */
export interface ISmartEqRewrite {
  layer: ISmartEqSettings | undefined;
  gains: Record<string, number>;
  /** The ranges that actually moved, for the graph to light and the bubble to name. */
  moved: IBalanceRegionReport[];
}

/**
 * A running mode: what to write from what has been heard of this song so
 * far, or nothing.
 *
 * Every checkpoint brings the whole report. Nothing is remembered between
 * two of them — no destination, no step, no drift — because the estimate
 * behind the report IS the memory, and it is of the record. Two things hold
 * a write back, and both are conditions rather than clocks: the estimate has
 * to have settled (three checkpoints within a fraction of a decibel,
 * `isConverged`), so the layer is not rewritten while an intro is still
 * becoming a chorus; and the fresh answer has to differ from the written
 * layer by an audible amount (`isSmartEqRewriteDue`), so a refinement nobody
 * could hear is not a reload on the engine's side.
 */
export const planSmartEqRewrite = (
  report: IBalanceReport,
  written: ISmartEqSettings | undefined,
  settings: ISmartEqSolveSettings,
): ISmartEqRewrite | undefined => {
  // Not from an estimate that is still moving, and not from one that has
  // deliberately stopped — see `fullBandGate`: the record has dropped an end
  // of its spectrum and nothing is being heard.
  if (!report.isConverged || report.isBandLimited) {
    return undefined;
  }
  const ready = report.regions.filter((region) => region.isCovered);
  if (ready.length === 0) {
    return undefined;
  }
  const gains = solveSmartEq(report, settings);
  if (!gains) {
    // No answer this time. The tilt fit needs a wide trusted span, and a
    // song whose midrange has not been heard yet cannot support one. A cycle
    // skipped, not a wrong correction.
    return undefined;
  }
  const writtenGains = gainsOfSmartEq(written);
  if (!isSmartEqRewriteDue(LAYOUT, writtenGains, gains)) {
    return undefined;
  }
  const layer = smartEqLayerOf(
    gains,
    {
      status: report.status === 'ready' ? 'ready' : 'partial',
      lowFrequency: ready[0].lowFrequency,
      highFrequency: ready[ready.length - 1].highFrequency,
    },
    written,
    settings.limitDb,
  );
  if (isSameSmartEqLayer(layer, written)) {
    return undefined;
  }
  const moved = report.regions.filter((region) =>
    LAYOUT.some(
      (band) =>
        band.frequency >= region.lowFrequency &&
        band.frequency <= region.highFrequency &&
        Math.abs((gains[band.id] ?? 0) - (writtenGains[band.id] ?? 0)) >=
          MOVED_DB,
    ),
  );
  return { layer, gains, moved };
};
