import { advanceDashTrails, createDashTrails } from 'renderer/graph/dashTrails';

describe('soft dash trails', () => {
  it.each([30, 60, 144])('samples the same recent positions at %s Hz', (hz) => {
    const state = createDashTrails();
    advanceDashTrails(
      state,
      [
        [20, 200],
        [40, 200],
      ],
      300,
      0.36,
      0,
      true,
    );
    for (let frame = 1; frame <= hz; frame += 1) {
      const y = 200 - (frame / hz) * 100;
      advanceDashTrails(
        state,
        [
          [20, y],
          [40, y],
        ],
        300,
        0.36,
        1000 / hz,
        true,
      );
    }
    const result = advanceDashTrails(
      state,
      [
        [20, 100],
        [40, 100],
      ],
      300,
      0.36,
      0,
      true,
    );
    expect(result.trails).toHaveLength(3);
    expect(result.trails[0].path).toContain(',119.5');
    expect(result.trails[2].path).toContain(',106.5');
    expect(result.trails[0].opacity).toBeLessThan(result.trails[2].opacity);
    expect(result.moving).toBe(true);
    expect(state.history.length).toBeLessThanOrEqual(64);
  });

  it('freezes on pause, then settles without keeping the animation loop alive', () => {
    const state = createDashTrails();
    advanceDashTrails(
      state,
      [
        [20, 200],
        [40, 200],
      ],
      300,
      0.36,
      0,
      true,
    );
    const changed = advanceDashTrails(
      state,
      [
        [20, 100],
        [40, 100],
      ],
      300,
      0.36,
      100,
      true,
    );
    const paused = advanceDashTrails(
      state,
      [
        [20, 100],
        [40, 100],
      ],
      300,
      0.36,
      100,
      false,
    );
    expect(paused.trails).toEqual(changed.trails);
    expect(paused.moving).toBe(false);
    for (let frame = 0; frame < 4; frame += 1) {
      advanceDashTrails(
        state,
        [
          [20, 100],
          [40, 100],
        ],
        300,
        0.36,
        100,
        true,
      );
    }
    expect(
      advanceDashTrails(
        state,
        [
          [20, 100],
          [40, 100],
        ],
        300,
        0.36,
        0,
        true,
      ).moving,
    ).toBe(false);
  });

  it('discards old coordinates when the plot or Pieces changes', () => {
    const state = createDashTrails();
    advanceDashTrails(
      state,
      [
        [20, 200],
        [40, 200],
      ],
      300,
      0.36,
      0,
      true,
    );
    const resized = advanceDashTrails(
      state,
      [
        [100, 50],
        [200, 50],
        [300, 50],
      ],
      400,
      0.36,
      16,
      true,
    );
    expect(state.history).toHaveLength(1);
    resized.trails.forEach((trail) => {
      expect(trail.path).toContain(',50.0');
      expect(trail.path).not.toContain(',200.0');
    });
  });
});
