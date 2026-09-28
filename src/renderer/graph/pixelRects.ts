import type { PixelRect } from 'common/graphInvaders';

/**
 * Pixel rectangles as one path, so a sprite's runs fill as one shape — what
 * the arcade's scene, its cabinet and its wreck all hand the page's canvas,
 * from the same rectangles the engine's invaders read
 * (`engineLooks/designed/invadersLook.ts`).
 */
const rectsPath = (list: readonly PixelRect[]): Path2D => {
  const path = new Path2D();
  list.forEach(([x, y, w, h]) => path.rect(x, y, w, h));
  return path;
};

export default rectsPath;
