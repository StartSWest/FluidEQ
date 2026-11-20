/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IBalanceListenBounds,
  IBalanceReport,
} from './autoBalanceCapture';
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

/**
 * How a running mode listens to a song: until every covered range has moved
 * less than `SETTLE_TOLERANCE_DB` over the last ten seconds of listening
 * (`settleWindowMs`), so what is held is the song's long-term balance and not
 * its first verse, with a sixty-second backstop in place of the one-shot's
 * twenty-five.
 *
 * Measured on six records through the real spectrum path, three plays each,
 * against the curve their first two minutes give (2026-11-20). Held on the
 * one-shot's rule alone they came out 1.3-5.4 dB from it (3.1 on average) at
 * 21-27 s; on this rule 1.1-2.2 dB for seven of eight, 6.5 for one whose
 * second minute differs from its first (2.2 on average), held at 31-44 s for
 * most and at about a minute for records that keep changing. A 0.5 dB
 * tolerance came closer still (1.4 on average) but held anywhere from 31 to
 * 90 s, the same song forty seconds apart from one play to the next.
 */
export const SONG_LISTEN_BOUNDS: IBalanceListenBounds = {
  settleWindowMs: 10000,
  maxListenMs: 60000,
};

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
