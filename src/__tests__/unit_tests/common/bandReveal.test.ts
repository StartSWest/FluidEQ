/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FilterTypeEnum, IFilter, IFiltersMap } from 'common/constants';
import {
  IBandRevealBand,
  getBandRevealStepMs,
  planBandReveal,
  revealBands,
} from 'renderer/utils/bandReveal';

const band = (
  frequency: number,
  gain: number,
  overrides: Partial<IFilter> = {},
): IFilter => ({
  id: `b${frequency}`,
  frequency,
  gain,
  quality: 1,
  type: FilterTypeEnum.PK,
  ...overrides,
});

const asMap = (filters: IFilter[]): IFiltersMap =>
  filters.reduce<IFiltersMap>((map, filter) => {
    map[filter.id] = filter;
    return map;
  }, {});

/** No reduced-motion preference, whatever the environment happens to say. */
const plan = (target: IFiltersMap, from?: IFiltersMap) =>
  planBandReveal(target, { from, isMotionReduced: false });

const flatten = (steps: IBandRevealBand[][]) => steps.flat();

describe('planBandReveal', () => {
  it('walks the bands from the bottom of the spectrum upwards', () => {
    const result = plan(asMap([band(4000, 3), band(100, -2), band(1000, 5)]));

    expect(flatten(result!.steps).map((entry) => entry.id)).toEqual([
      'b100',
      'b1000',
      'b4000',
    ]);
    expect(flatten(result!.steps).map((entry) => entry.gain)).toEqual([
      -2, 5, 3,
    ]);
  });

  it('starts a fresh reference from silence and keeps the layout intact', () => {
    const target = asMap([band(100, -2), band(1000, 5)]);
    const result = plan(target);

    // Only the gain waits. Frequencies, types and Qs are there from the first
    // frame, or the bands would look like they were appearing out of nowhere.
    expect(result!.initial.b100).toEqual({ ...target.b100, gain: 0 });
    expect(result!.initial.b1000).toEqual({ ...target.b1000, gain: 0 });
  });

  it('starts from the previous gains when given them', () => {
    const previous = asMap([band(100, -2), band(1000, 5)]);
    const target = asMap([band(100, -2), band(1000, 1)]);

    const result = plan(target, previous);

    // The band that did not move is already at its final value, and is not a
    // step: an unchanged band has nothing to show.
    expect(result!.initial.b100.gain).toBe(-2);
    expect(result!.initial.b1000.gain).toBe(5);
    expect(flatten(result!.steps)).toEqual([{ id: 'b1000', gain: 1 }]);
  });

  it('has nothing to reveal when every band is already where it lands', () => {
    const target = asMap([band(100, 0), band(1000, 0)]);

    expect(plan(target)).toBeUndefined();
    expect(plan(target, target)).toBeUndefined();
  });

  it('leaves out the filter types Equalizer APO gives no gain to', () => {
    const result = plan(
      asMap([
        band(100, 3),
        band(200, 6, { type: FilterTypeEnum.NO }),
        band(300, 6, { type: FilterTypeEnum.HPQ }),
      ]),
    );

    expect(flatten(result!.steps).map((entry) => entry.id)).toEqual(['b100']);
    // Untouched, rather than animated to a value nothing reads.
    expect(result!.initial.b200.gain).toBe(6);
    expect(result!.initial.b300.gain).toBe(6);
  });

  it('hands the answer over whole when reduced motion is asked for', () => {
    const target = asMap([band(100, -2), band(1000, 5)]);

    expect(planBandReveal(target, { isMotionReduced: true })).toBeUndefined();
  });

  it('groups a very large reference rather than drawing it for ever', () => {
    const bands = Array.from({ length: 128 }, (_value, index) =>
      band(20 + index * 10, 1),
    );
    const result = plan(asMap(bands));

    // A frame per band would be a hundred-odd React commits for an animation
    // nobody asked to be longer.
    expect(result!.steps.length).toBeLessThanOrEqual(40);
    expect(result!.steps.every((step) => step.length > 0)).toBe(true);
    // Every band still arrives, still in frequency order.
    const revealed = flatten(result!.steps);
    expect(revealed).toHaveLength(128);
    expect(revealed.map((entry) => entry.id)).toEqual(
      bands.map((entry) => entry.id),
    );
  });
});

describe('getBandRevealStepMs', () => {
  it('keeps the whole reveal to about the same moment either way', () => {
    // Few bands: paced out rather than over in two frames.
    expect(getBandRevealStepMs(4)).toBeGreaterThanOrEqual(50);
    // Many: dealt quickly rather than dragged out.
    expect(getBandRevealStepMs(40) * 40).toBeLessThanOrEqual(800);
  });
});

describe('revealBands', () => {
  it('hands every frame over in order and reports that it finished', async () => {
    const seen: string[] = [];
    const finished = await revealBands(
      [[{ id: 'a', gain: 1 }], [{ id: 'b', gain: 2 }]],
      (bands) => bands.forEach((entry) => seen.push(entry.id)),
      { isCurrent: () => true, stepMs: 0 },
    );

    expect(seen).toEqual(['a', 'b']);
    expect(finished).toBe(true);
  });

  it('stops where it is once what it was drawing has been replaced', async () => {
    const seen: string[] = [];
    let isLive = true;
    const finished = await revealBands(
      [[{ id: 'a', gain: 1 }], [{ id: 'b', gain: 2 }], [{ id: 'c', gain: 3 }]],
      (bands) => {
        bands.forEach((entry) => seen.push(entry.id));
        isLive = false;
      },
      { isCurrent: () => isLive, stepMs: 0 },
    );

    // The remaining bands are abandoned rather than written over whatever took
    // their place — a stale reveal finishing late is the failure this guards.
    expect(seen).toEqual(['a']);
    expect(finished).toBe(false);
  });

  it('reports a run superseded on its very last frame as unfinished', async () => {
    let isLive = true;
    const finished = await revealBands(
      [[{ id: 'a', gain: 1 }]],
      () => {
        isLive = false;
      },
      { isCurrent: () => isLive, stepMs: 0 },
    );

    // The caller uses the answer to decide whether to assert the final value,
    // so "drew everything, then was superseded" still has to read as false.
    expect(finished).toBe(false);
  });
});
