import { Projected, rect } from './graphStyles';

export const STEM_FADE_LEVELS = 12;

/** Batched layers keep the fade independent of colour, without per-stem gradients. */
export const createGraphStems = (
  points: readonly Projected[],
  baseline: number,
  gap: number,
) => {
  const spacing =
    points.length > 1
      ? (points[points.length - 1][0] - points[0][0]) / (points.length - 1)
      : 12;
  const size = Math.max(2.4, Math.min(12, spacing * (1 - gap)));
  const width = Math.min(size * 0.55, 3.6);
  const layers = new Array<string>(STEM_FADE_LEVELS).fill('');
  let tips = '';
  let shape = '';
  points.forEach(([x, y]) => {
    const stemTop = Math.min(baseline, y + size / 2);
    const height = Math.max(0, baseline - stemTop);
    const tip = rect(x - size / 2, y - size / 2, size, size);
    tips += tip;
    shape += rect(x - width / 2, stemTop, width, height) + tip;
    for (let level = 0; level < STEM_FADE_LEVELS; level += 1) {
      const from = stemTop + (height * level) / STEM_FADE_LEVELS;
      const to = stemTop + (height * (level + 1)) / STEM_FADE_LEVELS;
      layers[level] += rect(x - width / 2, from, width, to - from);
    }
  });
  return { shape, tips, layers };
};
