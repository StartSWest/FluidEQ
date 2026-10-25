/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DE_ESSER_DEFAULTS } from '../../../common/dsp/deEsser';
import { cutAt, sampleCutCurve } from '../../../renderer/dsp/deEsserCurve';
import {
  deEsserBandsHz,
  drawShape,
} from '../../../renderer/dsp/deEsserLensFrequency';
import type { ILensLabels } from '../../../renderer/dsp/deEsserLensKit';
import {
  drawTreble,
  IDeEsserInks,
  ITrebleNow,
} from '../../../renderer/dsp/deEsserPlot';

const hz = deEsserBandsHz(4500, 11000);
const treble: ITrebleNow = {
  hz,
  levelDb: hz.map(() => -35),
  thresholdDb: hz.map(() => -30),
  cutDb: hz.map(() => -9),
  sHz: 0,
  sAlpha: 0,
};
const inks: IDeEsserInks = {
  voice: '191,132,110',
  notVoice: '150,160,172',
  cut: '255,176,89',
  text: '#aaa0b0',
};

interface IStroke {
  ink: string | CanvasGradient | CanvasPattern;
  points: number[][];
}

const drawing = () => {
  let points: number[][] = [];
  const strokes: IStroke[] = [];
  const context = {
    strokeStyle: '',
    beginPath: () => {
      points = [];
    },
    moveTo: (x: number, y: number) => points.push([x, y]),
    lineTo: (x: number, y: number) => points.push([x, y]),
    stroke: () =>
      strokes.push({ ink: context.strokeStyle, points: [...points] }),
    save: jest.fn(),
    restore: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    setLineDash: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    createLinearGradient: () => ({ addColorStop: jest.fn() }),
  } as unknown as CanvasRenderingContext2D;
  return { context, strokes };
};

const expectPointedTip = (points: number[][]) => {
  expect(points.length).toBeGreaterThan(24);
  const ys = points.map((point) => point[1] ?? 0);
  const tip = Math.max(...ys);
  const at = ys.indexOf(tip);
  expect(at).toBeGreaterThan(0);
  expect(at).toBeLessThan(ys.length - 1);
  // A clipped floor draws several adjacent samples at exactly the same Y.
  expect(tip).toBeGreaterThan(ys[at - 1] ?? tip);
  expect(tip).toBeGreaterThan(ys[at + 1] ?? tip);
};

describe('de-esser downward curve tips', () => {
  it('fits a combined spectral dip deeper than the per-band cut limit', () => {
    const curve = sampleCutCurve(treble, 'spectral', 4500, 2000, 20000, 400, 9);
    expect(Math.min(...curve.points)).toBeLessThan(-30);
    expect(curve.bottomDb).toBeLessThanOrEqual(Math.min(...curve.points));
    expect(curve.points[200]).toBeCloseTo(
      cutAt(Math.sqrt(2000 * 20000), treble, 'spectral', 4500),
      10,
    );
    expect(treble.cutDb).toEqual(hz.map(() => -9));
  });

  it('fits the treble notch below the maximum band reduction', () => {
    const maximum = { ...treble, cutDb: hz.map(() => -18) };
    const curve = sampleCutCurve(maximum, 'treble', 4500, 2000, 20000, 400, 18);
    expect(Math.min(...curve.points)).toBeLessThan(-24);
    expect(curve.bottomDb).toBeLessThanOrEqual(Math.min(...curve.points));
  });

  it('keeps the existing scale and flat response when no cut is needed', () => {
    const idle = { ...treble, cutDb: hz.map(() => 0) };
    const curve = sampleCutCurve(idle, 'spectral', 4500, 2000, 20000, 80, 6);
    expect(curve.bottomDb).toBe(-6);
    expect(curve.points).toEqual(Array.from({ length: 81 }, () => 0));
  });

  it('keeps whole-voice reduction flat at its reported value', () => {
    const curve = sampleCutCurve(treble, 'whole', 4500, 2000, 20000, 80, 9);
    expect(curve.points).toEqual(Array.from({ length: 81 }, () => -9));
    expect(curve.bottomDb).toBe(-9);
  });

  it.each([
    [320, 140],
    [360, 230],
    [1100, 230],
  ])('draws the full live tip in a %s by %s plot', (width, height) => {
    const { context, strokes } = drawing();
    const box = { x: 12, y: 64, width, height };
    drawTreble(context, box, treble, 4500, 11000, 'spectral', 9, inks, {
      range: 0,
      thresholds: 0,
    });
    const curve = strokes.find(
      (stroke) => stroke.ink === 'rgba(255,176,89,0.95)',
    );
    const points = curve?.points ?? [];
    expectPointedTip(points);
    points.forEach((point) => {
      expect(point[1]).toBeGreaterThanOrEqual(box.y + 2);
      expect(point[1]).toBeLessThan(box.y + (height - 16) * 0.3 - 2);
    });
  });

  it('draws the full tip in the depth and width preview', () => {
    const { context, strokes } = drawing();
    const labels: ILensLabels = {
      voice: 'Voice',
      cymbal: 'Cymbal',
      s: 'S',
      cut: 'Cut',
      threshold: 'Threshold',
      trebleNow: 'Treble now',
      left: 'Left',
      right: 'Right',
      attack: 'Attack',
      release: 'Release',
      underVoice: (db) => db,
      upTo: (db) => `Up to ${db}`,
      ahead: (ms) => ms,
      cymbalNeeds: (db) => db,
      modes: { spectral: 'Spectral', treble: 'Treble', whole: 'Whole voice' },
      centre: 'Centre',
      everything: 'Everything',
    };
    drawShape(
      {
        context,
        box: { x: 12, y: 64, width: 600, height: 230 },
        settings: { ...DE_ESSER_DEFAULTS, rangeDb: 9, widthOct: 2 },
        inks,
        labels,
      },
      'spectral',
      'depth',
      false,
    );
    const curve = strokes.find((stroke) => stroke.ink === 'rgba(255,176,89,1)');
    expect(curve).toBeDefined();
    expectPointedTip(curve?.points ?? []);
  });
});
