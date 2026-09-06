import getGraphMotionDelta from 'renderer/graph/graphMotionPacing';
import { getWaveTransform } from 'renderer/graph/liveTracePaint';
import { getEaseFactor } from 'common/smoothing';
import { getDefaultTuning } from 'common/customLooks';

describe('wave size motion compensation', () => {
  it('keeps compact motion responsive and progressively softens larger waves', () => {
    expect(getGraphMotionDelta(16, 180)).toBe(16);
    expect(getGraphMotionDelta(16, 360)).toBe(16);
    expect(getGraphMotionDelta(16, 720)).toBeLessThan(16);
    expect(getGraphMotionDelta(16, 1440)).toBeLessThan(
      getGraphMotionDelta(16, 720),
    );
    expect(getGraphMotionDelta(16, 10000)).toBeGreaterThanOrEqual(16 / 2.5);
  });

  it('uses the visible height equally for upright and mirrored waves', () => {
    const height = 1440;
    const visibleDepth = (isFlipped: boolean, isHalfHeight: boolean) =>
      height *
      Math.abs(
        getWaveTransform({ isFlipped, isHalfHeight, heightScale: 0.5 }, 1)
          .scaleY,
      );
    expect(visibleDepth(false, false)).toBe(720);
    expect(visibleDepth(true, false)).toBe(720);
    expect(visibleDepth(false, true)).toBe(360);
    expect(visibleDepth(true, true)).toBe(360);
    expect(getGraphMotionDelta(16, visibleDepth(true, true))).toBe(16);
  });

  it.each([30, 60, 144])(
    'preserves the attack and release result at %s Hz',
    (hz) => {
      const tuning = getDefaultTuning('bars');
      let rising = 0;
      let falling = 1;
      for (let frame = 0; frame < hz; frame += 1) {
        const delta = getGraphMotionDelta(1000 / hz, 1440);
        rising += (1 - rising) * getEaseFactor(delta, tuning.attackMs);
        falling -= falling * getEaseFactor(delta, tuning.releaseMs);
      }
      expect(rising).toBeCloseTo(1, 8);
      // One second at twice the reference pace is two 250ms half-lives.
      expect(falling).toBeCloseTo(0.25, 8);
    },
  );

  it.each([NaN, Infinity, -100, 0])(
    'handles a hidden or invalid depth %s',
    (depth) => {
      expect(getGraphMotionDelta(16, depth)).toBe(16);
    },
  );
});
