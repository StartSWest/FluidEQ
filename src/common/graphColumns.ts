import type { Projected } from './graphStyles';

/**
 * The spectrum resampled to a fixed number of columns. Its own module so
 * the scene geometry can use it without importing the shapes that import
 * the scenes.
 */
const toColumns = (
  points: readonly Projected[],
  count: number,
): Projected[] => {
  if (points.length <= count) {
    return points as Projected[];
  }
  const perColumn = points.length / count;
  /**
   * The column's x comes from an EVEN DIVISION of the span, not from a
   * sample's own position.
   *
   * It used to be the x of whichever sample sat in the middle of the bucket.
   * That is fixed, which is what mattered — a bar must not shuffle sideways
   * as the music moves — but it is not EVENLY SPACED: the bucket bounds are
   * floored, so consecutive middles land a sample nearer or further than the
   * pair before them. Against a constant bar width the gaps then came out
   * visibly uneven, and at some piece counts more than others, which read as
   * the drawing being wrong rather than as rounding.
   *
   * An even division is fixed for the same reason and even as well: it
   * depends only on the count and the plot.
   */
  const left = points[0][0];
  const stride = (points[points.length - 1][0] - left) / count;
  const columns: Projected[] = [];
  for (let index = 0; index < count; index += 1) {
    const from = Math.floor(index * perColumn);
    const to = Math.max(from + 1, Math.floor((index + 1) * perColumn));
    // Smallest y is the tallest bar: the axis grows downward in pixels.
    let [, peak] = points[from];
    for (let at = from + 1; at < to; at += 1) {
      if (points[at][1] < peak) {
        [, peak] = points[at];
      }
    }
    columns.push([left + (index + 0.5) * stride, peak]);
  }
  return columns;
};

export default toColumns;
