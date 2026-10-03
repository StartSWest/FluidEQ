import {
  layoutBandLabels,
  labelBoxesOverlap,
} from 'renderer/graph/bandLabelLayout';

const bounds = { left: 0, top: 0, right: 1000, bottom: 320 };
const point = (id: string, x: number, y = 160, priority = 0) => ({
  id,
  x,
  y,
  width: 88,
  height: 34,
  priority,
});

it('keeps both ends of the spectrum represented when a narrow plot cannot fit all bands', () => {
  const points = Array.from({ length: 31 }, (_, index) =>
    point(`${index}`, 10 + (index * 280) / 30, 110),
  );
  const labels = layoutBandLabels(points, {
    left: 0,
    top: 0,
    right: 300,
    bottom: 220,
  });
  expect(labels.length).toBeLessThan(31);
  expect(labels.map((label) => label.id)).toEqual(
    expect.arrayContaining(['0', '30']),
  );
});

it.each([6, 10, 15, 20, 31])(
  'fits every label in a flat %i-band layout without collisions',
  (count) => {
    const points = Array.from({ length: count }, (_, index) =>
      point(`${index}`, 20 + (index * 960) / (count - 1)),
    );
    const labels = layoutBandLabels(points, bounds);
    expect(labels).toHaveLength(count);
    labels.forEach((label, index) => {
      expect(label.x).toBeGreaterThanOrEqual(bounds.left);
      expect(label.y).toBeGreaterThanOrEqual(bounds.top);
      expect(label.x + label.width).toBeLessThanOrEqual(bounds.right);
      expect(label.y + label.height).toBeLessThanOrEqual(bounds.bottom);
      labels
        .slice(index + 1)
        .forEach((other) =>
          expect(labelBoxesOverlap(label, other)).toBe(false),
        );
      points.forEach((dot) =>
        expect(
          labelBoxesOverlap(label, {
            x: dot.x - 8,
            y: dot.y - 8,
            width: 16,
            height: 16,
          }),
        ).toBe(false),
      );
    });
    expect(labels.some((label) => label.y < 160)).toBe(true);
    expect(count < 15 || labels.some((label) => label.y > 160)).toBe(true);
  },
);

it('keeps labels inside all four edges and handles coincident frequencies', () => {
  const labels = layoutBandLabels(
    [
      point('top', 5, 2),
      point('bottom', 990, 318),
      point('one', 400),
      point('two', 400),
      point('three', 400),
    ],
    bounds,
  );
  expect(labels).toHaveLength(5);
  labels.forEach((label, index) => {
    expect(label.x).toBeGreaterThanOrEqual(0);
    expect(label.y).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width).toBeLessThanOrEqual(1000);
    expect(label.y + label.height).toBeLessThanOrEqual(320);
    labels
      .slice(index + 1)
      .forEach((other) => expect(labelBoxesOverlap(label, other)).toBe(false));
  });
});

it('gives the active band room first when a small plot cannot hold every label', () => {
  const points = Array.from({ length: 31 }, (_, index) =>
    point(`${index}`, 100, 70, index === 30 ? 2 : 0),
  );
  const labels = layoutBandLabels(points, {
    left: 0,
    top: 0,
    right: 200,
    bottom: 140,
  });
  expect(labels.map((label) => label.id)).toContain('30');
  labels.forEach((label, index) =>
    labels
      .slice(index + 1)
      .forEach((other) => expect(labelBoxesOverlap(label, other)).toBe(false)),
  );
});
