/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IBalanceReport } from './autoBalanceCapture';
import { shouldFinishBalanceCapture } from './autoBalanceCapture';
import { REGION_COVERED_CONFIDENCE } from './autoBalanceTuning';
import type { ISmartEqPreviewRegion, TSmartEqPhase } from './smartEqPreview';

/**
 * When a running mode writes, and what the graph is told meanwhile.
 *
 * It used to write whenever three checkpoints agreed and the answer had moved
 * a decibel, all song long: the first correction five to twenty-five seconds
 * in and a dozen rewrites after it, each a reload on the engine's side, with
 * nothing on screen until each one landed. Now it holds: the curve forms on
 * the graph from every checkpoint, and is written once, when the measurement
 * would have finished as a one-shot — every range heard and still, or the
 * stall rule saying the rest of the record will never come. The rules that
 * decide it are the one-shot's, unchanged (`evaluateBalanceCapture`).
 */

/** The measurement is done with this song, by the one-shot's own rule. */
export const isReadyToHold = (report: IBalanceReport): boolean =>
  shouldFinishBalanceCapture(report) && !report.isBandLimited;

/**
 * Listening or settling: settling once nothing more is coming — every range
 * heard, or the record stalled on the ones it lacks — and only the estimate
 * standing still is awaited.
 */
export const phaseOf = (report: IBalanceReport | undefined): TSmartEqPhase =>
  report &&
  !report.isBandLimited &&
  (report.coverage >= REGION_COVERED_CONFIDENCE || report.isStalled)
    ? 'settling'
    : 'listening';

export const previewRegionsOf = (
  report: Pick<IBalanceReport, 'regions'>,
): ISmartEqPreviewRegion[] =>
  report.regions.map((region) => ({
    label: region.label,
    lowFrequency: region.lowFrequency,
    highFrequency: region.highFrequency,
    centreFrequency: region.centreFrequency,
    confidence: region.confidence,
    isCovered: region.isCovered,
    liveDb: region.liveDb,
    typicalDb: region.typicalDb,
  }));

/** The ranges a hold left alone because this record never reached them. */
export const missingRangesOf = (
  report: Pick<IBalanceReport, 'regions'>,
): string[] =>
  report.regions
    .filter((region) => !region.isCovered)
    .map((region) => region.label);

/** Gains at the layer's strength, which is what the graph draws. */
export const atStrength = (
  gains: Record<string, number>,
  intensity: number | undefined,
): Record<string, number> => {
  const strength = Number.isFinite(intensity)
    ? Math.max(0, Math.min(1, intensity as number))
    : 1;
  return Object.fromEntries(
    Object.entries(gains).map(([id, gain]) => [id, gain * strength]),
  );
};
