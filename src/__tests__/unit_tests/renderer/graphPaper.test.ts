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
  FREQUENCY_MAJOR_TICKS,
  GAIN_AXIS_TICKS,
  frequencyLabelTicksFor,
  getAxisPadding,
  liveLevelScaleFor,
  liveLevelTicksFor,
  sceneSpectrumRectFor,
} from '../../../renderer/graph/graphPaper';

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

  it('follows a scene that reserves its own band, not the wave', () => {
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

describe('the frequency labels', () => {
  it('names every decade when there is room', () => {
    expect(frequencyLabelTicksFor(frequencyScale(1400, 50, 48))).toBe(
      FREQUENCY_MAJOR_TICKS,
    );
  });

  it('drops names that would run into the one before on a narrow plot', () => {
    const narrow = frequencyScale(260, 50, 48);
    const kept = frequencyLabelTicksFor(narrow);
    expect(kept.length).toBeLessThan(FREQUENCY_MAJOR_TICKS.length);
    expect(kept[0]).toBe(FREQUENCY_MAJOR_TICKS[0]);
    kept.slice(1).forEach((tick, index) => {
      expect(
        Number(narrow(tick)) - Number(narrow(kept[index])),
      ).toBeGreaterThanOrEqual(52);
    });
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
    expect(left).toBeCloseTo((30 + 50) / 1200);
    expect(right).toBeCloseTo((30 + drawnWidth - 48) / 1200);
    expect(bottom).toBeCloseTo(1 - (54 + drawnHeight - 30) / 480);
    expect(top).toBeCloseTo(1 - (54 + 14) / 480);
  });
});
