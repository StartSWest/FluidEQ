import {
  advanceTerraceJumper,
  createTerraceJumper,
  paintTerraceJumper,
} from 'renderer/graph/terraceJumper';
import createGraphTerrace from 'common/graphTerrace';
import { Projected } from 'common/graphStyles';

const points: Projected[] = [
  [20, 120],
  [60, 80],
  [100, 160],
];

describe('terraced shelves and their explorer', () => {
  it('builds four bounded shelves with open outlines and non-overlapping fill bands', () => {
    const terrace = createGraphTerrace(points, 200);
    expect(terrace.tiers).toHaveLength(4);
    expect(terrace.outline).not.toContain('Z');
    expect(terrace.shape).toContain('M 0.0,120.0');
    expect(terrace.shape).toContain('H 120.0');
    terrace.tiers.slice(0, -1).forEach((tier, index) => {
      expect(tier.body.match(/Z/g)).toHaveLength(2);
      expect(tier.body).toContain(terrace.tiers[index + 1].edge);
      expect(tier.opacity).toBeLessThanOrEqual(1);
    });
    expect(terrace.tiers[3].body.match(/Z/g)).toHaveLength(1);
  });

  it('jumps above the destination shelf and lands on its moving top', () => {
    const state = createTerraceJumper();
    const airborne = advanceTerraceJumper(state, points, 310, true);
    expect(airborne?.x).toBe(40);
    expect(airborne?.y).toBeLessThan(80);
    const moved: Projected[] = [
      [20, 120],
      [60, 50],
      [100, 160],
    ];
    expect(advanceTerraceJumper(state, moved, 310, true)).toMatchObject({
      x: 60,
      y: 50,
    });
  });

  it.each([30, 60, 144])(
    'keeps the same hop progress at %s Hz and freezes on pause',
    (hz) => {
      const state = createTerraceJumper();
      for (let frame = 0; frame < hz; frame += 1) {
        advanceTerraceJumper(state, points, 1000 / hz, true);
      }
      expect(state.column).toBe(1);
      expect(state.phase).toBeCloseTo(1000 / 620 - 1, 8);
      const before = { ...state };
      advanceTerraceJumper(state, points, 5000, false);
      expect(state).toEqual(before);
    },
  );

  it('turns at either edge and survives a reduction in Pieces during a jump', () => {
    const state = createTerraceJumper();
    advanceTerraceJumper(state, points, 1240, true);
    expect(state.column).toBe(2);
    expect(state.direction).toBe(-1);
    const result = advanceTerraceJumper(state, points.slice(0, 2), 620, true);
    expect(result?.x).toBe(60);
    expect(result?.y).toBe(80);
    expect(state.direction).toBe(-1);
  });

  it('grows with the wave and keeps square pixels under a mirrored transform', () => {
    const scale = jest.fn();
    const fillRect = jest.fn();
    const context = {
      getTransform: () => ({ a: 2, d: -1 }),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale,
      fillRect,
    } as unknown as CanvasRenderingContext2D;
    const position = { x: 50, y: 100, direction: 1 };
    paintTerraceJumper(context, position, 1200, 360);
    const small = scale.mock.calls[0];
    paintTerraceJumper(context, position, 1200, 1440);
    const large = scale.mock.calls[1];
    expect(large[0]).toBeGreaterThan(small[0]);
    expect(Math.abs(2 * large[0])).toBe(Math.abs(-1 * large[1]));
    expect(fillRect).toHaveBeenCalled();
    expect(context.save).toHaveBeenCalledTimes(2);
    expect(context.restore).toHaveBeenCalledTimes(2);
  });
});
