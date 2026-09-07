import createGraphEcho, {
  ECHO_HORIZON,
  projectEchoWave,
} from 'common/graphEcho';
import { isGraphScene } from 'common/graphScenes';
import type { Projected } from 'common/graphStyles';
import {
  advanceEchoWaves,
  createEchoWaves,
  createEchoWavePaths,
  EMIT_EVERY,
  WAVE_LIFE,
} from 'renderer/graph/echoWaves';

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

describe('the echo perspective', () => {
  it('leaves the live wave alone and sends a deep one to the horizon', () => {
    const live = projectEchoWave(loud, 0, 20, 100, 160, 140);
    expect(live.wave).toEqual(loud);
    expect(live.floor).toBe(160);
    const far = projectEchoWave(loud, 1, 20, 100, 160, 140);
    expect(far.floor).toBeCloseTo(160 - 140 * ECHO_HORIZON);
    // Narrowed toward the centre, and much flatter.
    expect(far.wave[0][0]).toBeGreaterThan(20);
    expect(far.wave[2][0]).toBeLessThan(100);
    expect(far.floor - far.wave[1][1]).toBeCloseTo(100 * 0.3);
  });

  it('is a running scene with a still stack of four for the preview', () => {
    expect(isGraphScene('echo')).toBe(true);
    const filled = createGraphEcho(loud, 20, 160, true);
    expect(filled.match(/Z/g)).toHaveLength(4);
    expect(createGraphEcho(loud, 20, 160, false)).not.toMatch(/Z/);
    expect(createGraphEcho([loud[0]], 20, 160, true)).toBe('');
  });
});

describe('the waves rolling away', () => {
  const fakePath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
  });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  it('lets a wave go every emit interval and retires it at the horizon', () => {
    const state = createEchoWaves();
    advanceEchoWaves(state, quiet, 20, 160, 1, true);
    expect(state.waves).toHaveLength(1);
    advanceEchoWaves(state, quiet, 20, 160, 1 + EMIT_EVERY / 2, true);
    expect(state.waves).toHaveLength(1);
    advanceEchoWaves(state, quiet, 20, 160, 1 + EMIT_EVERY, true);
    expect(state.waves).toHaveLength(2);
    advanceEchoWaves(state, quiet, 20, 160, 1 + WAVE_LIFE + 0.01, true);
    expect(state.waves.every((wave) => wave.at > 1)).toBe(true);
  });

  it('marks the next wave with a beat and carries it only once', () => {
    const state = createEchoWaves();
    advanceEchoWaves(state, quiet, 20, 160, 1, true);
    advanceEchoWaves(state, loud, 20, 160, 1.05, true);
    // The beat landed between emits: it waits for the next wave.
    expect(state.pending).toBe(1);
    advanceEchoWaves(state, loud, 20, 160, 1.1, true);
    expect(state.waves[0].strength).toBe(1);
    expect(state.pending).toBe(0);
    advanceEchoWaves(state, loud, 20, 160, 1.25, true);
    expect(state.waves[0].strength).toBe(0);
  });

  it('paints back to front, builds bodies only when filled, and idles paused', () => {
    const state = createEchoWaves();
    advanceEchoWaves(state, loud, 20, 160, 1, true);
    advanceEchoWaves(state, loud, 20, 160, 1.2, true);
    const stroked = createEchoWavePaths(state, loud, 20, 160, 1.3, false);
    expect(stroked.waves).toHaveLength(2);
    expect(stroked.waves[0].depth).toBeCloseTo(0.3 / WAVE_LIFE);
    expect(stroked.waves[1].depth).toBeCloseTo(0.1 / WAVE_LIFE);
    expect(stroked.waves.every((wave) => wave.body === undefined)).toBe(true);
    const filled = createEchoWavePaths(state, loud, 20, 160, 1.3, true);
    expect(filled.waves.every((wave) => wave.body !== undefined)).toBe(true);
    expect(filled.horizon).toBeCloseTo(160 - 140 * 0.6);

    const paused = createEchoWaves();
    advanceEchoWaves(paused, loud, 20, 160, 1, false);
    expect(paused.waves).toEqual([]);
  });
});
