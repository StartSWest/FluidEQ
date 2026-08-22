/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IEqBandSettings, buildEqRack } from '../../../common/dsp/chain';
import {
  curveResponseDb,
  rackMatchingCurveOf,
} from '../../../renderer/dsp/rack';

const RATE = 48_000;

/** The file the user pasted: ten filters, Q from 0.7 to 6, two shelves. */
const SQUIGLINK: IEqBandSettings[] = [
  { enabled: true, type: 'LSC', frequency: 105, gainDb: -2.8, quality: 0.7 },
  { enabled: true, type: 'PK', frequency: 7_164, gainDb: 4.7, quality: 1.27 },
  { enabled: true, type: 'PK', frequency: 1_555, gainDb: -2.9, quality: 1.63 },
  { enabled: true, type: 'PK', frequency: 155, gainDb: -1.5, quality: 1.49 },
  { enabled: true, type: 'PK', frequency: 3_115, gainDb: 2.3, quality: 2.7 },
  { enabled: true, type: 'HSC', frequency: 10_000, gainDb: -5.3, quality: 0.7 },
  { enabled: true, type: 'PK', frequency: 63, gainDb: 0.4, quality: 1.75 },
  { enabled: true, type: 'PK', frequency: 722, gainDb: 0.4, quality: 2.07 },
  { enabled: true, type: 'PK', frequency: 6_471, gainDb: 1.7, quality: 5.99 },
  { enabled: true, type: 'PK', frequency: 4_424, gainDb: -1, quality: 6 },
];

/** Judged where the music is. The top octave is left out of the verdict on
 * purpose: the cookbook forces every shape flat at Nyquist, so a shelf near
 * 20 kHz cannot be matched by anything and that is a property of the filters,
 * not of the fit. */
const probeFrequencies = (): number[] => {
  const low = Math.log2(30);
  const step = (Math.log2(16_000) - low) / 199;
  return Array.from({ length: 200 }, (_, i) => 2 ** (low + i * step));
};

const worstErrorDb = (
  a: readonly IEqBandSettings[],
  b: readonly IEqBandSettings[],
): number => {
  const points = probeFrequencies();
  const left = curveResponseDb(a, points, RATE);
  const right = curveResponseDb(b, points, RATE);
  return left.reduce(
    (worst, value, index) => Math.max(worst, Math.abs(value - right[index])),
    0,
  );
};

/**
 * The old way, kept here as the thing being improved on.
 *
 * Interpolating gain VALUES between bands, which ignores Q and the fact that
 * neighbouring filters overlap. It is the control: without it, "the new fit is
 * within a decibel" says nothing about whether it was ever a problem.
 */
const byGainInterpolation = (
  target: readonly IEqBandSettings[],
  source: readonly IEqBandSettings[],
): IEqBandSettings[] => {
  const points = source
    .map((band) => ({ hz: Math.log2(band.frequency), gainDb: band.gainDb }))
    .sort((a, b) => a.hz - b.hz);
  return target.map((band) => {
    const hz = Math.log2(band.frequency);
    if (hz <= points[0].hz) {
      return { ...band, gainDb: points[0].gainDb };
    }
    const last = points[points.length - 1];
    if (hz >= last.hz) {
      return { ...band, gainDb: last.gainDb };
    }
    const upper = points.findIndex((point) => point.hz >= hz);
    const a = points[upper - 1];
    const b = points[upper];
    const ratio = (hz - a.hz) / (b.hz - a.hz);
    return { ...band, gainDb: a.gainDb + (b.gainDb - a.gainDb) * ratio };
  });
};

describe('moving a curve onto a different rack', () => {
  /**
   * Measured, not hoped for: 2.85 dB worst case on this curve at 31 bands.
   *
   * That residual is the RACK's resolution and not the solver's error, which
   * is worth being exact about because the number looks disappointing on its
   * own. A graphic rack has fixed centres and a fixed Q of about 4.3; this
   * curve contains a Q=6 dip at 4,424 Hz sitting between two of those centres
   * and a high shelf at 10 kHz that no bell can continue past 20 kHz. Adding
   * solver passes does not move it — iterating the fit changed 2.68 to 2.85,
   * which is noise, not progress.
   */
  it('keeps the response a published curve actually has', () => {
    const fitted = rackMatchingCurveOf(buildEqRack(31), SQUIGLINK, RATE);
    expect(worstErrorDb(fitted, SQUIGLINK)).toBeLessThan(3);
  });

  /**
   * The control the assertion above needs.
   *
   * If gain interpolation were also within a decibel there would have been
   * nothing to fix, and the new solver would be complexity for its own sake.
   */
  it('CONTROL: interpolating gains instead is far worse on the same curve', () => {
    const interpolated = byGainInterpolation(buildEqRack(31), SQUIGLINK);
    const fitted = rackMatchingCurveOf(buildEqRack(31), SQUIGLINK, RATE);
    const interpolatedError = worstErrorDb(interpolated, SQUIGLINK);
    // Measured: 5.30 dB for interpolation against 2.85 dB for the fit. Both
    // numbers are recorded rather than one threshold, so a regression in
    // either direction shows up as a changed relationship and not as a test
    // that quietly still passes.
    expect(interpolatedError).toBeGreaterThan(5);
    expect(worstErrorDb(fitted, SQUIGLINK)).toBeLessThan(
      interpolatedError * 0.6,
    );
  });

  it('holds the curve through every rack size on offer', () => {
    [6, 10, 15, 31].forEach((size) => {
      const fitted = rackMatchingCurveOf(buildEqRack(size), SQUIGLINK, RATE);
      // Six bands cannot follow a curve with a Q of 6 in it; the claim is that
      // each rack does as well as its own resolution allows, not that all of
      // them are equal.
      expect(worstErrorDb(fitted, SQUIGLINK)).toBeLessThan(size <= 6 ? 6 : 3);
    });
  });

  /**
   * The complaint this whole thing exists for, stated as a round trip.
   *
   * Every size is fitted from the authored curve, so a detour through a
   * smaller rack costs nothing once the size comes back.
   */
  it('returns to the same response after a trip through a smaller rack', () => {
    const wide = rackMatchingCurveOf(buildEqRack(31), SQUIGLINK, RATE);
    const narrow = rackMatchingCurveOf(buildEqRack(6), SQUIGLINK, RATE);
    const backAgain = rackMatchingCurveOf(buildEqRack(31), SQUIGLINK, RATE);
    expect(backAgain.map((b) => b.gainDb)).toEqual(wide.map((b) => b.gainDb));
    // And the detour genuinely lost something, so the equality above is not
    // passing because every size happens to give the same answer.
    expect(worstErrorDb(narrow, wide)).toBeGreaterThan(1);
  });

  it('leaves a flat curve flat rather than solving noise into it', () => {
    const flat = buildEqRack(10);
    const fitted = rackMatchingCurveOf(buildEqRack(31), flat, RATE);
    fitted.forEach((band) => expect(Math.abs(band.gainDb)).toBeLessThan(0.05));
  });

  it('does not answer with gains that cancel each other out', () => {
    const fitted = rackMatchingCurveOf(buildEqRack(31), SQUIGLINK, RATE);
    // The failure the ridge term prevents: huge equal-and-opposite gains that
    // sum to the right curve on paper and clip the moment a band is touched.
    fitted.forEach((band) => expect(Math.abs(band.gainDb)).toBeLessThan(18));
  });

  it('NULL TEST: an empty source leaves the rack untouched', () => {
    const rack = buildEqRack(10);
    expect(rackMatchingCurveOf(rack, [], RATE)).toEqual(rack);
  });
});
