import createGraphPulse, {
  pulseHeadFraction,
  pulseVertices,
  sliceByX,
  SWEEP_PERIOD,
} from 'common/graphPulse';
import { isGraphScene } from 'common/graphScenes';
import type { Projected } from 'common/graphStyles';
import {
  advancePulseMonitor,
  createPulseMonitor,
  createPulsePaths,
  ECHO_LIFE,
  echoDrift,
  pulseShake,
  pulseThump,
  SHAKE_LIFE,
  THUMP_FALL,
  THUMP_RISE,
} from 'renderer/graph/pulseMonitor';

const quiet: Projected[] = [
  [20, 160],
  [60, 160],
  [100, 160],
];
const loud: Projected[] = [
  [20, 80],
  [60, 60],
  [100, 90],
];

describe('the pulse trace', () => {
  it('rests on its own line, beats once per band and pumps as told', () => {
    const still = pulseVertices(loud, 160);
    expect(still[0]).toEqual([20, 130]);
    // Five vertices per band after the start.
    expect(still).toHaveLength(1 + loud.length * 5);
    const pumped = pulseVertices(loud, 160, 1.35);
    // The spike of the loudest band stands 35% taller when pumped.
    expect(130 - pumped[8][1]).toBeCloseTo((130 - still[8][1]) * 1.35);
    expect(pulseVertices([loud[0]], 160)).toEqual([]);
  });

  it('cuts a polyline between two x positions without leaving mid-air ends', () => {
    const line: Projected[] = [
      [0, 0],
      [10, 10],
      [20, 0],
    ];
    expect(sliceByX(line, 5, 15)).toEqual([
      [5, 5],
      [10, 10],
      [15, 5],
    ]);
    expect(sliceByX(line, 30, 40)).toEqual([]);
  });

  it('is a running scene whose head crosses the plot once a period', () => {
    expect(isGraphScene('ecg')).toBe(true);
    expect(pulseHeadFraction(0)).toBe(0);
    expect(pulseHeadFraction(SWEEP_PERIOD / 2)).toBeCloseTo(0.5);
    expect(pulseHeadFraction(SWEEP_PERIOD)).toBe(0);
    expect(createGraphPulse(loud, 160, true)).toMatch(/Z$/);
    expect(createGraphPulse(loud, 160, false)).not.toMatch(/Z/);
  });
});

describe('the monitor', () => {
  const fakePath = () => ({ lineTo: jest.fn(), closePath: jest.fn() });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  it('thumps, shakes and lets an echo go on a beat, in proportion to it', () => {
    const monitor = createPulseMonitor();
    advancePulseMonitor(monitor, quiet, 20, 160, 1, true);
    expect(pulseThump(monitor, 1)).toBe(0);
    expect(pulseShake(monitor, 1)).toEqual({ x: 0, y: 0 });

    advancePulseMonitor(monitor, loud, 20, 160, 1.1, true);
    expect(monitor.thumpStrength).toBe(1);
    expect(pulseThump(monitor, 1.1 + THUMP_RISE)).toBeCloseTo(1);
    expect(pulseThump(monitor, 1.1 + THUMP_RISE + THUMP_FALL / 2)).toBeCloseTo(
      0.5,
    );
    expect(pulseThump(monitor, 1.1 + THUMP_RISE + THUMP_FALL + 0.01)).toBe(0);
    const shaken = pulseShake(monitor, 1.12);
    expect(Math.hypot(shaken.x, shaken.y)).toBeGreaterThan(0);
    expect(pulseShake(monitor, 1.1 + SHAKE_LIFE)).toEqual({ x: 0, y: 0 });

    createPulsePaths(monitor, loud, 160, 1.1);
    expect(monitor.echoes).toHaveLength(1);
    // The same frame painted again, as a mirrored wave does, adds nothing.
    createPulsePaths(monitor, loud, 160, 1.1);
    expect(monitor.echoes).toHaveLength(1);
    expect(echoDrift(monitor.echoes[0], 1.1, 140).glow).toBe(1);
    expect(
      echoDrift(monitor.echoes[0], 1.1 + ECHO_LIFE / 2, 140).y,
    ).toBeLessThan(0);
    advancePulseMonitor(monitor, loud, 20, 160, 1.1 + ECHO_LIFE + 0.01, true);
    expect(monitor.echoes).toEqual([]);
  });

  it('holds the level without beating again and does nothing while paused', () => {
    const monitor = createPulseMonitor();
    advancePulseMonitor(monitor, quiet, 20, 160, 1, true);
    advancePulseMonitor(monitor, loud, 20, 160, 1.1, true);
    advancePulseMonitor(monitor, loud, 20, 160, 1.15, true);
    expect(monitor.thumpAt).toBe(1.1);
    const paused = createPulseMonitor();
    advancePulseMonitor(paused, loud, 20, 160, 1, false);
    expect(paused.thumpAt).toBe(-1);
  });
});
