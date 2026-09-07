import type { Projected } from './graphStyles';

/**
 * A sawtooth oscillator on a scope.
 *
 * The waveform the oscillator makes is a slow ramp up to the level and a
 * vertical drop back, and an oscillator RUNS: the wave slides left across
 * the screen at a steady rate, which is what makes it read as a signal on a
 * scope rather than as bars with a slant. Each band is one period of it,
 * with the drop somewhere inside the column set by the phase, so a column
 * holds the tail of one tooth and the head of the next.
 *
 * Two layers: `shape` is the body under the wave, for the fill and outline;
 * `trace` is the wave itself as one open line, ramps and drops, for the
 * bright beam a scope draws. The gap is ignored on purpose — a trace with
 * gaps in it is a broken scope.
 */
/** How many periods the wave slides per second of music-pace clock. */
const SLIDE_RATE = 0.9;

const point = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`;

const createGraphSawtooth = (
  points: readonly Projected[],
  baseline: number,
  seconds: number,
) => {
  if (points.length < 2) {
    return { shape: '', trace: '' };
  }
  const step =
    (points[points.length - 1][0] - points[0][0]) / (points.length - 1);
  // Phase runs 1 → 0 so the drop travels leftwards, the way a scope's
  // sweep leaves the waveform moving against it.
  const phase = 1 - ((seconds * SLIDE_RATE) % 1);
  let shape = '';
  let trace = '';
  points.forEach(([x, y], index) => {
    const level = Math.max(0, baseline - y);
    const left = x - step * 0.5;
    const right = x + step * 0.5;
    const drop = left + step * phase;
    // The tail of the previous tooth: a ramp already part-way up at the
    // column's left edge, reaching full level at the drop.
    const tailStart = baseline - level * (1 - phase);
    shape += `M ${point(left, baseline)} L ${point(left, tailStart)} L ${point(drop, baseline - level)} L ${point(drop, baseline)} Z `;
    // The head of the next tooth: from the floor at the drop, climbing to
    // where the column ends.
    const headEnd = baseline - level * (1 - phase);
    shape += `M ${point(drop, baseline)} L ${point(right, headEnd)} L ${point(right, baseline)} Z `;
    trace +=
      `${index === 0 ? 'M' : 'L'} ${point(left, tailStart)} ` +
      `L ${point(drop, baseline - level)} L ${point(drop, baseline)} L ${point(right, headEnd)} `;
  });
  return { shape, trace };
};

export default createGraphSawtooth;
