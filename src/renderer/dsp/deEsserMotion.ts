/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IHostAnalysisDeEsser } from '../../common/dsp/analysisWire';
import type { ITrebleNow } from './deEsserPlot';

/**
 * How the De-esser's display moves between readings, by elapsed time and
 * never per frame, so a 144 Hz screen draws the same motion a 60 Hz one does.
 *
 * Readings arrive about every 43 ms and each one is a fresh window, so drawn
 * as they come every mark jumped: a band's bar fell 8 dB a frame between
 * readings and rose again, its threshold mark stepped with every window, and
 * the S line went on and off with each one. Now each quantity is quick to
 * arrive and slow to leave, as a meter's needle is.
 */
export const MOTION = {
  /** A band rising: nearly at once. */
  levelRiseMs: 15,
  /** A band falling, dB per second. */
  levelFallDbPerS: 24,
  /** Where the stage starts on a band, which moves with the song. */
  thresholdMs: 180,
  /** A cut deepening, and letting go. */
  cutAttackMs: 20,
  cutReleaseMs: 220,
  /** The S line sliding to where the S is, appearing and fading. */
  sMoveMs: 70,
  sAppearMs: 40,
  sFadeMs: 450,
  /** The cut readout letting go. */
  readoutReleaseMs: 300,
  /**
   * The lens coming in over the history as a control is taken in hand, and
   * going back once it is let go: quick to answer the hand, slow enough
   * leaving that moving between two dials does not flash the history. Whole
   * crossings, not time constants: a one-pole still left 3% of the history
   * showing 300 ms in, and its labels read through the lens.
   */
  lensInMs: 160,
  lensOutMs: 380,
} as const;

/** The share of the way a one-pole covers in `dt` with time constant `tau`. */
export const toward = (dt: number, tau: number): number =>
  1 - Math.exp(-dt / Math.max(1, tau));

/** The longest step taken at once: a tab brought back is not a jump. */
export const MAX_STEP_MS = 100;

/**
 * The longest step an animation of the hand's takes: a frame or two. The
 * loop sleeps while nothing plays, so the first frame after a hover can
 * come a long time after the last one, and a full step then is a jump.
 */
export const MAX_FADE_STEP_MS = 34;

/**
 * A crossing's progress one frame on: in a straight line toward `target`,
 * all the way in `inMs` going up and `outMs` coming down, so it ends.
 * Drawn through `eased`.
 */
export const stepToward = (
  progress: number,
  target: number,
  dt: number,
  inMs: number,
  outMs: number,
): number =>
  target > progress
    ? Math.min(target, progress + dt / inMs)
    : Math.max(target, progress - dt / outMs);

/** A crossing's progress as it is seen: gentle at both ends (smoothstep). */
export const eased = (progress: number): number =>
  progress * progress * (3 - 2 * progress);

/**
 * The treble picture one frame on: each band's level, threshold and cut
 * moved toward the reading by the time that passed, and the S line slid and
 * faded rather than switched. A reading on other bands — the range was
 * moved — is taken as it comes, since there is nothing to move from.
 */
export const moveTreble = (
  drawn: ITrebleNow,
  report: Readonly<IHostAnalysisDeEsser>,
  dt: number,
): ITrebleNow => {
  const sameBands =
    drawn.hz.length === report.bandHz.length &&
    drawn.hz.every((hz, band) => Math.abs(hz - (report.bandHz[band] ?? 0)) < 1);
  if (!sameBands) {
    return {
      hz: [...report.bandHz],
      levelDb: [...report.bandLevelDb],
      thresholdDb: [...report.bandThresholdDb],
      cutDb: [...report.bandCutDb],
      sHz: report.frequencyHz,
      sAlpha: 0,
    };
  }
  const rise = toward(dt, MOTION.levelRiseMs);
  const fall = (MOTION.levelFallDbPerS * dt) / 1000;
  const levelDb = report.bandLevelDb.map((target, band) => {
    const at = drawn.levelDb[band] ?? target;
    return target > at
      ? at + (target - at) * rise
      : Math.max(target, at - fall);
  });
  const settle = toward(dt, MOTION.thresholdMs);
  const thresholdDb = report.bandThresholdDb.map((target, band) => {
    const at = drawn.thresholdDb[band] ?? target;
    return at + (target - at) * settle;
  });
  const cutDb = report.bandCutDb.map((target, band) => {
    const at = drawn.cutDb[band] ?? target;
    const tau = target < at ? MOTION.cutAttackMs : MOTION.cutReleaseMs;
    return at + (target - at) * toward(dt, tau);
  });
  const cutting = report.reductionDb < -0.05 && report.frequencyHz > 0;
  let { sHz } = drawn;
  if (cutting) {
    // Slid in octaves from where it was showing; placed where it is when
    // nothing was showing.
    sHz =
      drawn.sHz > 0 && drawn.sAlpha > 0.01
        ? 2 **
          (Math.log2(drawn.sHz) +
            (Math.log2(report.frequencyHz) - Math.log2(drawn.sHz)) *
              toward(dt, MOTION.sMoveMs))
        : report.frequencyHz;
  }
  const sAlpha =
    drawn.sAlpha +
    ((cutting ? 1 : 0) - drawn.sAlpha) *
      toward(dt, cutting ? MOTION.sAppearMs : MOTION.sFadeMs);
  return { hz: drawn.hz, levelDb, thresholdDb, cutDb, sHz, sAlpha };
};

/**
 * The treble's level against the voice, as the Sensitivity lens's needle
 * shows it: up with the reading, down at a meter's pace, gone with no reading.
 */
export const moveSibilance = (
  drawn: number,
  reading: number | undefined,
  dt: number,
): number => {
  if (reading === undefined || reading <= -100) {
    return Number.NaN;
  }
  if (!Number.isFinite(drawn) || reading > drawn) {
    return Number.isFinite(drawn)
      ? drawn + (reading - drawn) * toward(dt, MOTION.levelRiseMs)
      : reading;
  }
  return Math.max(reading, drawn - (MOTION.levelFallDbPerS * dt) / 1000);
};
