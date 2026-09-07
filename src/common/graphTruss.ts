import type { Projected } from './graphStyles';

/** Cars and the visible deck share this gently rounded road profile. */
const createTrussRoad = (points: readonly Projected[]): Projected[] => {
  const softened: Projected[] = points.map(([x], index) => {
    let sum = 0;
    let total = 0;
    for (let offset = -2; offset <= 2; offset += 1) {
      const weight = 3 - Math.abs(offset);
      sum +=
        points[Math.max(0, Math.min(points.length - 1, index + offset))][1] *
        weight;
      total += weight;
    }
    return [x, sum / total];
  });
  const road: Projected[] = [];
  for (let i = 0; i < softened.length - 1; i += 1) {
    const [x, y] = softened[i];
    const [nextX, nextY] = softened[i + 1];
    for (let part = 0; part < 8; part += 1) {
      const t = part / 8;
      road.push([
        x + (nextX - x) * t,
        y + ((nextY - y) * (1 - Math.cos(t * Math.PI))) / 2,
      ]);
    }
  }
  if (softened.length) {
    road.push(softened[softened.length - 1]);
  }
  return road;
};

export default createTrussRoad;
