/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * The graph's paper, shared by the EQ graph and the Studio's grid.
 *
 * What is held here is the geometry a member measures a scene against: where
 * the level scale puts the wave, which band a scene is handed, and which
 * frequency names fit. A grid that drew in the right place but handed the
 * scene a different band would look right and measure wrong, which no query
 * by role can see.
 */

import { MAX_GAIN, MIN_GAIN } from '../../../common/constants';
import {
  frequencyScale,
  gainScale,
} from '../../../renderer/graph/ChartController';
import {
  frequencyGridFor,
  GAIN_AXIS_TICKS,
  UNITY_TICKS,
  frequencyLabelTicksFor,
  gainAxisTicksFor,
  getAxisPadding,
  liveLevelScaleFor,
  liveLevelTicksFor,
  sceneSpectrumRectFor,
} from '../../../renderer/graph/graphPaper';
import {
  GRID_BOTTOM_MARGIN,
  GRID_SIDE_MARGIN,
  plotTopMargin,
} from '../../../renderer/graph/plotMargins';
import { studioPaper } from '../../../renderer/studio/studioPaper';
import { studioSpectrumRect } from '../../../renderer/studio/studioWave';

const FULL_WAVE = { heightScale: 1, verticalPosition: 0 };

describe('the live level scale', () => {
  const gain = gainScale(400, 14, 30);

  it('is the gain scale itself when there is no wave to follow', () => {
    expect(liveLevelScaleFor({ gain, height: 480, marginTop: 54 })).toBe(gain);
  });

  it('spans the whole plot for a full-height wave on the floor', () => {
    const level = liveLevelScaleFor({
      gain,
      liveCurve: FULL_WAVE,
      height: 480,
      marginTop: 54,
    });
    expect(level(MIN_GAIN)).toBeCloseTo(gain(MIN_GAIN));
    expect(level(MAX_GAIN)).toBeCloseTo(gain(MAX_GAIN));
  });

  it('moves with a half-height wave lifted to the middle', () => {
    const level = liveLevelScaleFor({
      gain,
      liveCurve: { heightScale: 0.5, verticalPosition: 1 },
      height: 480,
      marginTop: 54,
    });
    // The control: the same scale under a full wave would not move.
    expect(level(MIN_GAIN)).not.toBeCloseTo(gain(MIN_GAIN));
    expect(level(MIN_GAIN)).toBeLessThan(gain(MIN_GAIN));
    expect(level(MAX_GAIN)).toBeGreaterThan(gain(MAX_GAIN));
  });

  it('follows a scene that reserves its own band', () => {
    const level = liveLevelScaleFor({
      gain,
      spectrumRange: [0.55, 0.94],
      liveCurve: FULL_WAVE,
      height: 480,
      marginTop: 54,
    });
    const topY = Math.max((1 - 0.94) * 480 - 54, Math.min(14, 370));
    expect(level(MAX_GAIN)).toBeCloseTo(topY);
    expect(level(MIN_GAIN)).toBeCloseTo((1 - 0.55) * 480 - 54);
  });

  it('moves the wave inside a reserved band, as it moves in the plot', () => {
    const topY = Math.max((1 - 0.94) * 480 - 54, Math.min(14, 370));
    const bottomY = (1 - 0.55) * 480 - 54;
    const level = liveLevelScaleFor({
      gain,
      spectrumRange: [0.55, 0.94],
      liveCurve: { heightScale: 0.5, verticalPosition: 1 },
      height: 480,
      marginTop: 54,
    });
    // Lifted all the way it stands on the band's middle; half height takes
    // half of what is left above it.
    const middle = (topY + bottomY) / 2;
    expect(level(MIN_GAIN)).toBeCloseTo(middle);
    expect(level(MAX_GAIN)).toBeCloseTo(middle - (middle - topY) / 2);
  });
});

describe('the level labels', () => {
  it('keeps all five on a tall wave and thins them on a flat one', () => {
    expect(liveLevelTicksFor(gainScale(400, 0, 0))).toEqual(GAIN_AXIS_TICKS);
    expect(liveLevelTicksFor(gainScale(60, 0, 0))).toEqual([
      MIN_GAIN,
      0,
      MAX_GAIN,
    ]);
    expect(liveLevelTicksFor(gainScale(10, 0, 0))).toEqual([MAX_GAIN]);
  });
});

describe('the gain labels', () => {
  it('keeps all five on a tall plot and thins them on a short one', () => {
    // A graph at its floor is 55px of plot, where all five printed over one
    // another while the level scale beside them had already thinned itself.
    expect(gainAxisTicksFor(gainScale(400, 0, 0))).toEqual(GAIN_AXIS_TICKS);
    expect(gainAxisTicksFor(gainScale(60, 0, 0))).toEqual([
      MIN_GAIN,
      0,
      MAX_GAIN,
    ]);
    // Unity is the last one kept: it is the line every curve is read against.
    expect(gainAxisTicksFor(gainScale(30, 0, 0))).toEqual(UNITY_TICKS);
  });
});

/**
 * The frequency axis as a pro analyser draws it (2026-11-16): a line at every
 * step of every decade on screen, the 1-2-5 steps stronger, built from the
 * range shown rather than a fixed list; names on the 1-2-5 steps, 16 kHz for
 * the top octave where 20 kHz is the edge, then the 3s and 4s where there is
 * room, each kept clear of the others and of both ends.
 */
const ONE_TWO_FIVE = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

describe('the frequency grid', () => {
  it('draws a line at every step inside the range, the 1-2-5 steps stronger', () => {
    const { major, minor } = frequencyGridFor(10, 20000);
    expect(major).toEqual(ONE_TWO_FIVE);
    expect(minor).toContain(30);
    expect(minor).toContain(9000);
    expect(minor).not.toContain(20);
    // The plot's own edges are its border, and draw no line.
    expect([...major, ...minor]).not.toContain(10);
    expect([...major, ...minor]).not.toContain(20000);
    // 20 to 90, 100 to 900, 1k to 9k, and 10k under the 20k edge.
    expect(major.length + minor.length).toBe(8 + 9 + 9 + 1);
  });

  it('follows the range on screen', () => {
    const music = frequencyGridFor(20, 16000);
    expect(music.major[0]).toBe(50);
    expect(music.major[music.major.length - 1]).toBe(10000);
    expect([...music.major, ...music.minor]).not.toContain(20);
  });

  it('hands back the same grid for the same span, so the rules are not redrawn', () => {
    expect(frequencyGridFor(10, 20000)).toBe(frequencyGridFor(10, 20000));
    expect(frequencyGridFor(10, 20000)).not.toBe(frequencyGridFor(20, 20000));
  });
});

describe('the frequency labels', () => {
  it('names the 1-2-5 steps and 16 kHz when there is room, and nothing else of theirs is lost', () => {
    const wide = frequencyLabelTicksFor(frequencyScale(4000, 50, 48));
    [...ONE_TWO_FIVE, 16000].forEach((hz) => expect(wide).toContain(hz));
    // Only the steps the rule names: the 3s and 4s may join, nothing else.
    wide.forEach((hz) => {
      const step = hz / 10 ** Math.floor(Math.log10(hz));
      expect(hz === 16000 || [1, 2, 3, 4, 5].includes(step)).toBe(true);
    });
  });

  it('drops names that would run into another, or into an end, on a narrow plot', () => {
    const narrow = frequencyScale(400, 50, 48);
    const kept = frequencyLabelTicksFor(narrow);
    const all = frequencyLabelTicksFor(frequencyScale(4000, 50, 48));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(all.length);
    // Forty pixels a name and twelve of air between two (`ESTIMATED_ROOM`).
    kept.slice(1).forEach((tick, index) => {
      expect(
        Number(narrow(tick)) - Number(narrow(kept[index])),
      ).toBeGreaterThanOrEqual(52);
    });
    // And clear of the forty kept at each end, by the same air.
    expect(Number(narrow(kept[0]))).toBeGreaterThanOrEqual(50 + 40 + 12 + 20);
    expect(Number(narrow(kept[kept.length - 1]))).toBeLessThanOrEqual(
      400 - 48 - 40 - 12 - 20,
    );
  });
});

describe("a scene's band on the graph", () => {
  it('is the plot box inside the gutters, measured in the whole panel', () => {
    const margins = { left: 30, top: 54, right: 30, bottom: 10 };
    const width = 1200;
    const height = 480;
    const padding = getAxisPadding(false);
    const drawnWidth = width - margins.left - margins.right;
    const drawnHeight = height - margins.top - margins.bottom;
    const frequency = frequencyScale(drawnWidth, padding.left, padding.right);
    const level = gainScale(drawnHeight, padding.top, padding.bottom);
    const [left, right, bottom, top] = sceneSpectrumRectFor({
      frequency,
      level,
      margins,
      width,
      height,
    });
    // Only the 14 a handle at +20 dB needs on top: the gain, level and
    // frequency figures stand inside the plot's edges and foot since
    // 2026-11-16, so the scene reaches both sides and the foot.
    expect(left).toBeCloseTo(30 / 1200);
    expect(right).toBeCloseTo((30 + drawnWidth) / 1200);
    expect(bottom).toBeCloseTo(1 - (54 + drawnHeight) / 480);
    expect(top).toBeCloseTo(1 - (54 + 14) / 480);
  });
});

describe("the Studio's grid", () => {
  const wave = { height: 1, position: 0 };

  it('hands the scene the band the graph would at the same size', () => {
    const paper = studioPaper(1200, 480, {}, wave);
    const frequency = frequencyScale(
      paper.width,
      paper.padding.left,
      paper.padding.right,
    );
    const gain = gainScale(
      paper.height,
      paper.padding.top,
      paper.padding.bottom,
    );
    const graphRect = sceneSpectrumRectFor({
      frequency,
      level: liveLevelScaleFor({
        gain,
        liveCurve: FULL_WAVE,
        height: 480,
        marginTop: paper.margins.top,
      }),
      margins: paper.margins,
      width: 1200,
      height: 480,
    });
    expect(paper.spectrumRect).toEqual(graphRect);
  });

  it('moves the band into the gutters, unlike the stage without the grid', () => {
    const gridded = studioPaper(1200, 480, {}, wave).spectrumRect;
    const bare = studioSpectrumRect({}, wave);
    // The control: without the grid the band is the whole width.
    expect(bare[0]).toBe(0);
    expect(bare[1]).toBe(1);
    expect(gridded[0]).toBeGreaterThan(0);
    expect(gridded[1]).toBeLessThan(1);
    expect(gridded[3]).toBeLessThan(1);
  });

  it('keeps the margins the ruled graph keeps around its plot', () => {
    // The controls strip floats inside the graph now, so the graph's
    // headroom is a constant the stage can share rather than a strip's
    // measured height it had to stand in for.
    expect(studioPaper(1200, 480, {}, wave).margins).toEqual({
      top: plotTopMargin(false),
      right: GRID_SIDE_MARGIN,
      bottom: GRID_BOTTOM_MARGIN,
      left: GRID_SIDE_MARGIN,
    });
  });

  it('follows a scene that reserves its own band', () => {
    const reserved = studioPaper(
      1200,
      480,
      { spectrumRange: [0.55, 0.94] },
      wave,
    ).spectrumRect;
    expect(reserved[2]).toBeCloseTo(0.55);
  });
});
