/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import { type ILookStop, lookRampFromStops } from 'common/lookGradient';
import { LOOK_INKS } from 'renderer/graph/engineLooks/engineLookInput';
import { writeInks } from 'renderer/graph/engineLooks/lookInput';
import { rampAt } from 'renderer/graph/lookColours';

/**
 * The shaders read a look's colours as `uInk`, evenly spaced, the way the 2D
 * drawing reads them. A gradient whose points stand off the coarse grid is
 * handed over as its ramp at every step of the fine one, and an array that
 * held only eight would resample that ramp: the GPU looks would paint a
 * different gradient from the editor's bar and the 2D looks.
 */
describe('the inks a GPU look is handed', () => {
  const stops: ILookStop[] = [
    { colour: '#000000', at: 0 },
    { colour: '#ff0000', at: 7 / 60 },
    { colour: '#ffffff', at: 1 },
  ];
  const ramp = lookRampFromStops(stops);
  const channelsOf = (hex: string) =>
    [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);

  it('are the whole ramp, stop for stop', () => {
    expect(ramp.length).toBeGreaterThan(8);
    const inks = new Float32Array(LOOK_INKS * 3);
    const count = writeInks(inks, ramp);
    expect(count).toBe(ramp.length);
    ramp.forEach((hex, stop) => {
      const [red, green, blue] = channelsOf(hex);
      expect(inks[stop * 3]).toBeCloseTo(red, 5);
      expect(inks[stop * 3 + 1]).toBeCloseTo(green, 5);
      expect(inks[stop * 3 + 2]).toBeCloseTo(blue, 5);
    });
  });

  const isPureRed = ([red, green, blue]: readonly number[]) =>
    red > 0.99 && green < 0.01 && blue < 0.01;

  it('keep the red point itself', () => {
    const inks = new Float32Array(LOOK_INKS * 3);
    const count = writeInks(inks, ramp);
    const written = Array.from({ length: count }, (_unused, stop) =>
      Array.from(inks.slice(stop * 3, stop * 3 + 3)),
    );
    expect(written.some(isPureRed)).toBe(true);
  });

  it('would lose it as eight even samples (the control)', () => {
    const eight = Array.from({ length: 8 }, (_unused, stop) =>
      rampAt(ramp, stop / 7).map((channel) => channel / 255),
    );
    expect(eight.some(isPureRed)).toBe(false);
  });
});
