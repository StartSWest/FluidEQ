import type { Projected } from './graphStyles';

/**
 * Echo: the live wave in front, and every wave the music has made rolling
 * away behind it toward a horizon.
 *
 * A wave at `depth` 0 is the live trace; at 1 it has reached the horizon.
 * On the way it narrows toward the centre, its floor rises, its amplitude
 * decays and it fades — a perspective, so the past reads as distance. The
 * horizon sits 60% of the way up the plot, which leaves the live wave the
 * lower half to move in and the past the upper half to recede into.
 */
export const ECHO_HORIZON = 0.6;

const point = ([x, y]: Projected) => `${x.toFixed(1)},${y.toFixed(1)}`;

/** Where a wave stands at `depth`, and how tall it still is. */
export const projectEchoWave = (
  points: readonly Projected[],
  depth: number,
  left: number,
  right: number,
  bottom: number,
  height: number,
): { wave: Projected[]; floor: number } => {
  const centre = (left + right) / 2;
  const squeeze = 1 - depth * 0.62;
  const floor = bottom - depth * height * ECHO_HORIZON;
  const decay = 1 - depth * 0.7;
  return {
    wave: points.map(([x, y]) => [
      centre + (x - centre) * squeeze,
      floor - Math.max(0, bottom - y) * decay,
    ]),
    floor,
  };
};

export const echoPolyline = (wave: readonly Projected[]) =>
  wave.length < 2 ? '' : `M ${wave.map(point).join(' L ')}`;

/** A wave shut against its own floor, for a fill. */
export const echoClosed = (wave: readonly Projected[], floor: number) =>
  wave.length < 2
    ? ''
    : `${echoPolyline(wave)} L ${wave[wave.length - 1][0].toFixed(1)},${floor.toFixed(1)} L ${wave[0][0].toFixed(1)},${floor.toFixed(1)} Z`;

/**
 * The still picture: the live wave and three of itself receding, which is
 * what the picker's preview, the icon and a paused frame show.
 */
const createGraphEcho = (
  points: readonly Projected[],
  top: number,
  bottom: number,
  filled: boolean,
): string => {
  if (points.length < 2) {
    return '';
  }
  const left = points[0][0];
  const right = points[points.length - 1][0];
  const height = Math.max(1, bottom - top);
  return [0.75, 0.5, 0.25, 0]
    .map((depth) => {
      const { wave, floor } = projectEchoWave(
        points,
        depth,
        left,
        right,
        bottom,
        height,
      );
      return filled ? echoClosed(wave, floor) : echoPolyline(wave);
    })
    .join(' ');
};

export default createGraphEcho;
