/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The small preview charts on the EQ Presets page (the applied headphone
 * correction, the Squiglink import) draw 20 Hz to 20 kHz, while the response
 * they are handed is sampled from 10 Hz. The octave under 20 Hz used to be
 * drawn left of the box and out over the panel beside it (2026-09-26).
 */

import { SAMPLE_FREQUENCIES } from '../../../../common/response';
import {
  PREVIEW_BOX,
  curveScales,
  makePath,
} from '../../../../renderer/graph/curvePreview';

/** Every x the path visits, in the order it visits them. */
const pathXs = (path: string) =>
  path.split(' ').map((command) => Number(command.slice(1).split(',')[0]));

const pathYs = (path: string) =>
  path.split(' ').map((command) => Number(command.slice(1).split(',')[1]));

const { left } = PREVIEW_BOX.padding;
const right = PREVIEW_BOX.width - PREVIEW_BOX.padding.right;

describe('makePath', () => {
  it('samples the response below the box, so the case is a real one', () => {
    // The positive control: without points under 20 Hz the tests below
    // would pass whatever makePath did with them.
    expect(SAMPLE_FREQUENCIES[0]).toBeLessThan(20);
    expect(SAMPLE_FREQUENCIES[SAMPLE_FREQUENCIES.length - 1]).toBeGreaterThan(
      20000,
    );
  });

  it('draws the whole response inside the box, edge to edge', () => {
    const points = SAMPLE_FREQUENCIES.map((x) => ({ x, y: 0 }));
    const xs = pathXs(makePath(points, PREVIEW_BOX).path);

    expect(Math.min(...xs)).toBeCloseTo(left, 2);
    expect(Math.max(...xs)).toBeCloseTo(right, 2);
    expect(xs[0]).toBeCloseTo(left, 2);
    expect(xs[xs.length - 1]).toBeCloseTo(right, 2);
  });

  it('starts the line at the height the curve has at 20 Hz', () => {
    // A slope in log frequency, 6 dB a decade: 20 Hz reads between the two
    // samples either side of it, never as the first one inside.
    const points = SAMPLE_FREQUENCIES.map((x) => ({
      x,
      y: 6 * Math.log10(x / 20),
    }));
    const bounds = { min: -12, max: 24 };
    const { y } = curveScales(PREVIEW_BOX, bounds);
    const ys = pathYs(makePath(points, PREVIEW_BOX, bounds).path);

    expect(ys[0]).toBeCloseTo(y(0), 1);
    expect(ys[ys.length - 1]).toBeCloseTo(y(6 * Math.log10(1000)), 1);
  });

  it('scales the gain axis on what it draws, not the octave it drops', () => {
    // 30 dB under 20 Hz and flat above: the axis stays at its ±12 floor.
    const points = SAMPLE_FREQUENCIES.map((x) => ({ x, y: x < 19 ? 30 : 0 }));
    const curve = makePath(points, PREVIEW_BOX);

    expect(curve.max).toBe(12);
    expect(curve.min).toBe(-12);
  });

  it('keeps every point it was given, for a caller that redraws them', () => {
    const points = SAMPLE_FREQUENCIES.map((x) => ({ x, y: 1 }));

    expect(makePath(points, PREVIEW_BOX).points).toBe(points);
  });

  it('invents no line for a curve that never reaches the box', () => {
    const points = [
      { x: 10, y: 3 },
      { x: 15, y: 4 },
    ];

    expect(makePath(points, PREVIEW_BOX).path).toBe('');
  });
});
