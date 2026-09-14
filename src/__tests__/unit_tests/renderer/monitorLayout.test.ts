/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IWallpaperDisplay } from '../../../common/wallpaper';
import { layoutMonitors } from '../../../renderer/wallpaper/monitorLayout';

const monitor = (
  id: number,
  x: number,
  y: number,
  width: number,
  height: number,
): IWallpaperDisplay => ({
  id,
  label: '',
  x,
  y,
  width,
  height,
  primary: id === 2,
});

const overlaps = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
) =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height;

describe('the monitors drawn as they stand on the desk', () => {
  it('numbers them left to right, whatever order Windows lists them in', () => {
    const { placements } = layoutMonitors([
      monitor(3, 2560, 0, 2560, 1440),
      monitor(1, -2560, 0, 2560, 1600),
      monitor(2, 0, 0, 2560, 1440),
    ]);
    expect(
      placements.map((placement) => [placement.number, placement.display.id]),
    ).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
  });

  it('keeps a row of three apart, inside the stage, and the taller one taller', () => {
    const { ratio, placements } = layoutMonitors([
      monitor(1, -2560, 0, 2560, 1600),
      monitor(2, 0, 0, 2560, 1440),
      monitor(3, 2560, 0, 2560, 1440),
    ]);
    expect(ratio).toBe(3.2);
    placements.forEach((placement, index) => {
      expect(placement.left).toBeGreaterThanOrEqual(0);
      expect(placement.top).toBeGreaterThanOrEqual(0);
      expect(placement.left + placement.width).toBeLessThanOrEqual(100);
      expect(placement.top + placement.height).toBeLessThanOrEqual(100);
      placements
        .slice(index + 1)
        .forEach((other) => expect(overlaps(placement, other)).toBe(false));
    });
    expect(placements[0].height).toBeGreaterThan(placements[1].height);
    expect(placements[0].left).toBeLessThan(placements[1].left);
  });

  it('puts a monitor below another under it, on a taller stage', () => {
    const { ratio, placements } = layoutMonitors([
      monitor(2, 0, 0, 3840, 2160),
      monitor(4, 960, 2160, 1920, 1080),
    ]);
    expect(ratio).toBeLessThan(3.2);
    const [big, small] = placements;
    expect(small.top).toBeGreaterThan(big.top + big.height - 1);
    expect(overlaps(big, small)).toBe(false);
  });

  it('has nothing to draw with no monitors', () => {
    expect(layoutMonitors([]).placements).toEqual([]);
  });
});
