import { createGraphStems, STEM_FADE_LEVELS } from 'common/graphStems';

const rectangles = (path: string) =>
  [...path.matchAll(/M ([\d.-]+),([\d.-]+) h ([\d.-]+) v ([\d.-]+)/g)].map(
    (match) => match.slice(1).map(Number),
  );

describe('square stems with fading lines', () => {
  it('centres square tips on each reading and keeps stems slimmer than their tips', () => {
    const result = createGraphStems(
      [
        [20, 30],
        [80, 70],
      ],
      200,
      0.58,
    );
    const tips = rectangles(result.tips);
    expect(tips).toHaveLength(2);
    tips.forEach(([x, y, width, height], index) => {
      expect(width).toBe(height);
      expect(x + width / 2).toBe([20, 80][index]);
      expect(y + height / 2).toBe([30, 70][index]);
      expect(rectangles(result.layers[0])[index][2]).toBeLessThan(width);
    });
  });

  it('covers each stem from below its tip to the floor with a bounded number of fade passes', () => {
    const result = createGraphStems(
      [
        [20, 30],
        [80, 70],
      ],
      200,
      0.58,
    );
    expect(result.layers).toHaveLength(STEM_FADE_LEVELS);
    const layers = result.layers.map(rectangles);
    [0, 1].forEach((column) => {
      const tip = rectangles(result.tips)[column];
      let end = tip[1] + tip[3];
      layers.forEach((layer) => {
        const [, top, width, height] = layer[column];
        expect(Math.abs(top - end)).toBeLessThanOrEqual(0.11);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
        end = top + height;
      });
      expect(end).toBeCloseTo(200, 0);
    });
  });

  it('draws a square at silence without inverted stems or invalid coordinates', () => {
    const result = createGraphStems([[20, 200]], 200, 1);
    expect(rectangles(result.tips)).toHaveLength(1);
    result.layers.forEach((layer) => {
      expect(rectangles(layer)[0][3]).toBe(0);
      expect(layer).not.toMatch(/NaN|Infinity/);
    });
  });
});
