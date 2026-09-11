import createTrussRoad from 'common/graphTruss';
import {
  canGraphFill,
  isFilledGraphStyle,
  resolveGraphPalette,
} from 'common/graphStyles';
import type { Projected } from 'common/graphStyles';
import {
  advanceTrussBridge,
  createTrussBridge,
  createTrussBridgePaths,
  DECK_HALF_LIFE_MS,
  DECK_REACH,
  deckTarget,
  lampBlink,
  SEA_ROWS,
} from 'renderer/graph/trussBridge';

/** Twenty-four columns across a 240px plot, a spike every sixth. */
const columns: Projected[] = Array.from({ length: 24 }, (_, i) => [
  20 + i * 10,
  i % 6 === 0 ? 60 : 140,
]);
const quiet: Projected[] = columns.map(([x]) => [x, 160]);

describe('the bridge', () => {
  it('is stroked by default and cycles its own hue under auto', () => {
    // Ivan chose the open truss with wireframe cars; Filled stays on offer
    // and only makes the posts solid.
    expect(isFilledGraphStyle('truss')).toBe(false);
    expect(canGraphFill('truss')).toBe(true);
    expect(resolveGraphPalette('truss', 'auto')).toBe('signal');
  });

  it('rounds the spectrum into a road and keeps the deck inside the plot', () => {
    const road = createTrussRoad(columns);
    // Eight sub-steps a column, cosine-eased, so no step is a corner.
    expect(road.length).toBe((columns.length - 1) * 8 + 1);
    const ys = road.map(([, y]) => y);
    expect(Math.min(...ys)).toBeGreaterThan(60);
    const target = deckTarget(columns, 20, 160);
    const deckYs = target.map(([, y]) => y);
    expect(Math.min(...deckYs)).toBeGreaterThanOrEqual(20 + 140 * 0.3);
    expect(Math.max(...deckYs)).toBeLessThanOrEqual(160);
  });

  it('eases the deck on its own clock, not the trace, and idles while paused', () => {
    const state = createTrussBridge();
    advanceTrussBridge(state, quiet, quiet, 20, 160, 1, true);
    const floor = [...state.deck];
    advanceTrussBridge(
      state,
      columns,
      columns,
      20,
      160,
      1 + DECK_HALF_LIFE_MS / 1000,
      true,
    );
    const target = deckTarget(columns, 20, 160)[0][1];
    // Half-way there after one half-life, not all the way.
    expect(state.deck[0]).toBeLessThan(floor[0]);
    expect(state.deck[0]).toBeGreaterThan(target);
    const frozen = [...state.deck];
    advanceTrussBridge(state, quiet, quiet, 20, 160, 5, false);
    expect(state.deck).toEqual(frozen);
  });

  it('reads the beat, the bass and the treble from the live frame', () => {
    const state = createTrussBridge();
    advanceTrussBridge(state, quiet, quiet, 20, 160, 1, true);
    expect(state.bass).toBe(0);
    expect(state.rockets).toHaveLength(0);
    // The eased trace is still quiet; only the live frame has the hit. A
    // hit read through the trace arrived late and soft — "it lags".
    const treble: Projected[] = columns.map(([x], i) => [
      x,
      i >= 15 ? 40 : 160,
    ]);
    advanceTrussBridge(state, quiet, treble, 20, 160, 1.02, true);
    expect(state.rockets.length).toBeGreaterThan(0);
    expect(lampBlink(state, 1.02)).toBe(1);
    const bassy: Projected[] = columns.map(([x], i) => [x, i < 7 ? 30 : 160]);
    advanceTrussBridge(state, quiet, bassy, 20, 160, 1.5, true);
    expect(state.bass).toBeGreaterThan(0.5);
  });
});

describe('the scene', () => {
  const fakePath = () => ({
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    ellipse: jest.fn(),
    rect: jest.fn(),
    closePath: jest.fn(),
    addPath: jest.fn(),
  });
  beforeAll(() => {
    Object.assign(globalThis, { Path2D: jest.fn(fakePath) });
  });
  afterAll(() => {
    Object.assign(globalThis, { Path2D: undefined });
  });

  it('carries the deck, the truss and the sea past both ends of the plot', () => {
    const state = createTrussBridge();
    advanceTrussBridge(state, columns, columns, 20, 160, 1, true);
    const paths = createTrussBridgePaths(state, columns, 160, 20, 1, 140);
    // The panel round the plot has margins; a scene may overflow them, by
    // a third of the 230px plot rather than all of it — the rest was
    // stroking nobody could see.
    const footing = paths.footing as unknown as {
      moveTo: jest.Mock;
      lineTo: jest.Mock;
    };
    expect(footing.moveTo).toHaveBeenCalledWith(20 - 230 * DECK_REACH, 160);
    expect(footing.lineTo).toHaveBeenCalledWith(250 + 230 * DECK_REACH, 160);
    const deck = paths.shape as unknown as { moveTo: jest.Mock };
    expect(deck.moveTo.mock.calls[0][0]).toBeLessThan(20);
    // One strip of water per row of swell.
    expect(paths.sea).toHaveLength(SEA_ROWS);
    expect(paths.horizon).toBeCloseTo(20 + 140 * 0.6);
    expect(paths.cars).toHaveLength(4);
    paths.cars.forEach((car) => {
      expect(car.level).toBeGreaterThanOrEqual(0);
      expect(car.level).toBeLessThanOrEqual(1);
    });
  });

  it('sizes the cars from the true plot depth, not the scaled one', () => {
    const state = createTrussBridge();
    advanceTrussBridge(state, columns, columns, 20, 160, 1, true);
    // Half-height wave: the scene is built in a squashed space but sized
    // from the real 140px, so the road stays as thick as at full height.
    const squashed = columns.map(([x, y]): Projected => [x, y * 0.5]);
    const tall = createTrussBridgePaths(state, columns, 160, 20, 1, 140);
    const short = createTrussBridgePaths(state, squashed, 80, 10, 1, 140);
    expect(short.roadHalf).toBe(tall.roadHalf);
  });
});
