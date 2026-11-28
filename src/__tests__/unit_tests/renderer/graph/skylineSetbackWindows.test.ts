/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Skyline's windows stay inside their own walls (Ivan, 2026-11-27: "fix
 * the Skyline windows past the setbacks too"). A setback tower's top storey
 * is narrower than the block it stands on, and its floors were laid on the
 * full-width grid, so the outer windows stood out in the air past its walls.
 * Every window here is held inside one block of its own tower, the old
 * full-width layout is shown to fail the same check, and the engine is shown
 * to be handed the same grids the page lays.
 */

import type { Projected } from '../../../../common/graphStyles';
import toColumns from '../../../../common/graphColumns';
import {
  createSkylineTowers,
  skylineSetback,
} from '../../../../common/graphShapes';
import type { PixelRect } from '../../../../common/graphShapePieces';
import {
  CITY_PANE_TALL,
  type CitySkylineLayout,
  type ICityTower,
  type ICityWindowGrid,
  cityFloorGrid,
  citySkylineLayout,
  createCitySkyline,
} from '../../../../renderer/graph/citySkyline';
import skylineLook from '../../../../renderer/graph/engineLooks/designed/skylineLook';
import type { IDesignedFrame } from '../../../../renderer/graph/engineLooks/designed/designedInput';
import { createLookInput } from '../../../../renderer/graph/engineLooks/lookInput';

const BASELINE = 400;
const COLUMNS = 40;
const GAP = 0.25;
const FRAME = { left: 0, right: 1200, top: 0, bottom: BASELINE };
const EPSILON = 1e-6;

/** A spectrum whose columns stand at every height from a stub to the top. */
const spectrum = (): Projected[] =>
  Array.from({ length: 200 }, (_, index) => {
    const x = 20 + (index / 199) * 1160;
    const wave = 0.5 + 0.45 * Math.sin(index * 0.37) * Math.cos(index * 0.11);
    return [x, BASELINE - wave * (BASELINE - 10)];
  });

const layOut = (columns = COLUMNS, gap = GAP) => {
  const points = spectrum();
  const { towers } = createSkylineTowers(points, BASELINE, columns, gap, 0);
  const city = citySkylineLayout(
    createCitySkyline(),
    toColumns(points, columns),
    0,
    BASELINE,
    12,
    BASELINE,
    gap,
    FRAME,
  );
  return { towers, city };
};

/** Every window of a tower as a rectangle, each floor on the grid given. */
const windowsOf = (
  city: CitySkylineLayout,
  tower: ICityTower,
  gridOf: (floor: number) => ICityWindowGrid | undefined,
): PixelRect[] => {
  const { pane, pitch } = city.windows;
  return tower.floors.flatMap((_, floor) => {
    const grid = gridOf(floor);
    if (!grid) {
      return [];
    }
    return Array.from({ length: grid.across }, (__, column): PixelRect => [
      tower.x - grid.width / 2 + grid.insetX + column * pane * 2,
      BASELINE - (floor + 1) * pitch,
      pane,
      pane * CITY_PANE_TALL,
    ]);
  });
};

/** Whether a tower's roof is a setback: its index alone decides. */
const isSetback = (index: number) => skylineSetback(1, 1, index) !== undefined;

const inside = ([x, y, w, h]: PixelRect, [bx, by, bw, bh]: PixelRect) =>
  x >= bx - EPSILON &&
  y >= by - EPSILON &&
  x + w <= bx + bw + EPSILON &&
  y + h <= by + bh + EPSILON;

/** The windows standing in no single block of their tower. */
const strays = (gridFor: 'own' | 'full', columns = COLUMNS, gap = GAP) => {
  const { towers, city } = layOut(columns, gap);
  return city.windows.towers.flatMap((tower, index) => {
    const { blocks } = towers[index];
    const panes = windowsOf(city, tower, (floor) =>
      gridFor === 'own'
        ? cityFloorGrid(city.windows, tower, floor)
        : city.windows,
    );
    return panes.filter((pane) => !blocks.some((block) => inside(pane, block)));
  });
};

describe("the Skyline's windows", () => {
  it('lay out setback towers tall enough to have a top storey of windows', () => {
    // Guards the checks below from passing on a city with no setbacks.
    const { city } = layOut();
    const withStorey = city.windows.towers.filter(
      (tower, index) => isSetback(index) && tower.upper < tower.floors.length,
    );
    expect(withStorey.length).toBeGreaterThanOrEqual(3);
  });

  it('each stand inside one block of their own tower', () => {
    expect(strays('own')).toEqual([]);
  });

  it.each([
    [16, 0],
    [24, 0.6],
    [64, 0.1],
    [120, 0.25],
    [160, 0.85],
  ])(
    'stay inside their walls at %i towers with a gap of %f, wide or narrow',
    (columns, gap) => {
      expect(strays('own', columns, gap)).toEqual([]);
    },
  );

  it('stood past the top storey when it took the full-width grid', () => {
    // The control: the old layout, every floor across the full width,
    // fails the same check on the setback towers.
    expect(strays('full').length).toBeGreaterThan(0);
  });

  it('lay a narrower top storey with fewer panes on the same floors', () => {
    const { windows } = layOut().city;
    expect(windows.upper.across).toBeLessThan(windows.across);
    expect(windows.upper.width).toBeLessThan(windows.width);
    // The ledge is wall: a floor between the two grids has no windows.
    windows.towers.forEach((tower) => {
      expect(tower.upper).toBeGreaterThanOrEqual(tower.lower);
      for (let floor = tower.lower; floor < tower.upper; floor += 1) {
        expect(cityFloorGrid(windows, tower, floor)).toBeUndefined();
      }
    });
  });

  it('keep the full-width grid on a tower without a setback', () => {
    const { windows } = layOut().city;
    const plain = windows.towers.filter(
      (tower, index) => !isSetback(index) && tower.floors.length > 0,
    );
    expect(plain.length).toBeGreaterThan(0);
    plain.forEach((tower) => {
      expect(tower.lower).toBe(tower.floors.length);
      expect(tower.upper).toBe(tower.floors.length);
    });
  });

  it("are handed to the engine on the page's own grids", () => {
    const { city } = layOut();
    const input = createLookInput('skyline');
    const frame = {
      sceneBase: BASELINE,
      plot: { left: 0, right: 1200, top: 0, bottom: BASELINE },
    } as unknown as IDesignedFrame;
    skylineLook.step(
      frame,
      {
        city,
        towers: createSkylineTowers(spectrum(), BASELINE, COLUMNS, GAP, 0),
      },
      input,
    );
    // The tower row (after the three block rows): middle, floors, the
    // floors on the full grid, the top storey's first floor.
    city.windows.towers.forEach((tower, index) => {
      const at = (3 * input.width + index) * 4;
      expect(Array.from(input.data.slice(at, at + 4))).toEqual([
        Math.fround(tower.x),
        tower.floors.length,
        tower.lower,
        tower.upper,
      ]);
    });
    const upper = Array.from(input.vectors.slice(15 * 4, 15 * 4 + 3));
    expect(upper).toEqual(
      [
        city.windows.upper.width,
        city.windows.upper.insetX,
        city.windows.upper.across,
      ].map(Math.fround),
    );
  });
});
