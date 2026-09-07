import { GraphStyle, Projected, hole, rect } from './graphStyles';
import createGraphSawtooth from './graphSawtooth';

export const isGraphScene = (style: GraphStyle): boolean =>
  ['flames', 'braid', 'bubbles', 'racer', 'invaders', 'sawtooth'].includes(
    style,
  );

const point = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;
const line = (points: readonly Projected[]) =>
  `M ${points.map(([x, y]) => point(x, y)).join(' L ')}`;
const circle = (x: number, y: number, radius: number) =>
  `M ${point(x - radius, y)} a ${radius},${radius} 0 1,0 ${radius * 2},0 a ${radius},${radius} 0 1,0 ${-radius * 2},0 Z `;

// Local averaging keeps roads and strands continuous across neighbouring
// FFT spikes. It changes spatial detail, never the user's attack/release rate.
const smooth = (points: readonly Projected[]): Projected[] =>
  points.map(([x], index) => {
    let sum = 0;
    let weight = 0;
    for (let offset = -4; offset <= 4; offset += 1) {
      const at = Math.max(0, Math.min(points.length - 1, index + offset));
      const mix = 5 - Math.abs(offset);
      sum += points[at][1] * mix;
      weight += mix;
    }
    return [x, sum / weight];
  });

interface ISceneArgs {
  points: readonly Projected[];
  style: GraphStyle;
  top: number;
  bottom: number;
  gap: number;
  filled: boolean;
  seconds: number;
}

/** The same geometry serves a still picker preview and the running scene. */
export const createGraphScene = ({
  points,
  style,
  top,
  bottom,
  gap,
  filled,
  seconds,
}: ISceneArgs): string => {
  if (points.length < 2) {
    return '';
  }
  if (style === 'sawtooth') {
    return createGraphSawtooth(points, bottom, seconds).shape;
  }
  const left = points[0][0];
  const width = Math.max(1, points[points.length - 1][0] - left);
  const height = Math.max(1, bottom - top);
  const step = width / (points.length - 1);
  const energyAt = (y: number) =>
    Math.max(0, Math.min(1, (bottom - y) / height));
  const pieceWidth = step * (1 - Math.max(0, Math.min(0.85, gap)));
  let path = '';

  if (style === 'braid') {
    const spine = smooth(points);
    const upper: Projected[] = [];
    const lower: Projected[] = [];
    spine.forEach(([x, y]) => {
      const energy = energyAt(y);
      // A fixed number of broad turns survives both a narrow pane and a
      // dense FFT. The old point-index pitch crushed it into a jagged cord.
      const twist = Math.sin(
        ((x - left) / width) * Math.PI * 16 - seconds * 1.7,
      );
      const radius = Math.min(height * 0.09, 5 + energy * 32);
      const centre = Math.max(top + radius, Math.min(bottom - radius, y));
      upper.push([x, centre + twist * radius]);
      lower.push([x, centre - twist * radius]);
    });
    return filled
      ? `${line(upper)} ${line([...lower].reverse()).replace(/^M/, 'L')} Z`
      : `${line(upper)} ${line(lower)}`;
  }

  if (style === 'racer') {
    const road = smooth(points).map(([x, y]): Projected => [
      x,
      top + height * 0.18 + (y - top) * 0.72,
    ]);
    const upper = road.map(([x, y]): Projected => [x, y - 3]);
    const lower = road.map(([x, y]): Projected => [x, y + 3]);
    path = `${line(upper)} ${line([...lower].reverse()).replace(/^M/, 'L')} Z `;
    for (let i = 4; i < road.length; i += 12) {
      path += hole(road[i][0] - 3, road[i][1] - 0.6, 6, 1.2);
    }
    // Round trips have a smooth turn at each end; an energy centroid merely
    // parked the car in the bass, then jumped it when the mix changed.
    const position = 0.5 - Math.cos(seconds * 0.45) * 0.42;
    const at = position * (road.length - 1);
    const index = Math.min(road.length - 2, Math.floor(at));
    const from = road[index];
    const to = road[index + 1];
    const mix = at - index;
    const x = from[0] + (to[0] - from[0]) * mix;
    const y = from[1] + (to[1] - from[1]) * mix - 3;
    const size = Math.min(1.4, Math.max(0.65, width / 700));
    const angle = Math.max(
      -0.5,
      Math.min(0.5, Math.atan2(to[1] - from[1], to[0] - from[0])),
    );
    const local = (dx: number, dy: number) =>
      point(
        x + size * (dx * Math.cos(angle) - dy * Math.sin(angle)),
        y + size * (dx * Math.sin(angle) + dy * Math.cos(angle)),
      );
    path += `M ${local(-13, -5)} L ${local(-11, -11)} L ${local(-6, -12)} L ${local(-2, -18)} L ${local(7, -18)} L ${local(12, -11)} L ${local(17, -9)} L ${local(17, -5)} Z `;
    path += `M ${local(-1, -16)} L ${local(-4, -12)} L ${local(9, -12)} L ${local(6, -16)} Z `;
    [-7, 10].forEach((wheel) => {
      const wx = x + size * (wheel * Math.cos(angle) + 3 * Math.sin(angle));
      const wy = y + size * (wheel * Math.sin(angle) - 3 * Math.cos(angle));
      path += circle(wx, wy, size * 3);
    });
    return path;
  }

  points.forEach(([x, y], index) => {
    const energy = energyAt(y);
    const seed = ((index * 2654435761) % 65536) / 65536;
    if (style === 'flames') {
      const half = Math.max(1, step * 0.43);
      const reach = height * energy;
      const tip = bottom - reach;
      const lean = Math.sin(seconds * 1.8 + seed * 9) * half * 0.75;
      path += `M ${point(x - half, bottom)} C ${point(x - half * 1.15, bottom - reach * 0.38)} ${point(x + lean - half * 0.4, tip + reach * 0.18)} ${point(x + lean, tip)} C ${point(x + lean - half * 0.55, tip + reach * 0.5)} ${point(x + half * 1.3, bottom - reach * 0.3)} ${point(x + half, bottom)} Z `;
      // A narrow hollow core gives fire an inside in Flat as well as Rainbow.
      path += `M ${point(x - half * 0.25, bottom)} L ${point(x + half * 0.3, bottom)} Q ${point(x + lean * 0.3, bottom - reach * 0.25)} ${point(x - lean * 0.25, bottom - reach * 0.57)} Q ${point(x - half * 0.6, bottom - reach * 0.2)} ${point(x - half * 0.25, bottom)} Z `;
      const phase = (seconds * 0.17 + seed) % 1;
      const emberY = Math.max(top + 2, tip - phase * height * 0.2);
      const emberX = x + Math.sin(phase * 5 + seed * 9) * half;
      const radius =
        Math.min(2.4, half * 0.18) * energy * Math.sin(phase * Math.PI);
      path += circle(emberX, emberY, radius);
    } else if (style === 'bubbles') {
      for (let layer = 0; layer < 2; layer += 1) {
        const phase =
          (seconds * (0.055 + layer * 0.018) + seed + layer * 0.5) % 1;
        // Grow and dissolve at the ends instead of teleporting a full orb.
        const life = Math.sin(phase * Math.PI);
        const radius = Math.max(
          0.2,
          Math.min(pieceWidth * 0.68, height * 0.1) *
            (0.35 + Math.sqrt(energy) * 0.65) *
            (layer === 0 ? 1 : 0.72) *
            life,
        );
        const cy = bottom - radius - phase * (height - radius * 2);
        const cx =
          x + Math.sin(seconds * 0.6 + seed * 12 + layer) * step * 0.12;
        path += circle(cx, cy, radius);
        // Reversed inner contour keeps the orbs translucent with Filled on.
        const inner = radius * 0.78;
        if (filled) {
          path += `M ${point(cx - inner, cy)} a ${inner},${inner} 0 1,1 ${inner * 2},0 a ${inner},${inner} 0 1,1 ${-inner * 2},0 Z `;
        }
      }
    } else if (style === 'invaders') {
      const unit = Math.max(0.7, Math.min(5, pieceWidth / 7));
      const cx = x + Math.sin(seconds * 1.5) * step * 0.13;
      const cy = Math.max(top + unit * 4, Math.min(bottom - unit * 4, y));
      const march = Math.sin(seconds * 4 + index * 0.3) > 0 ? 1 : -1;
      path += rect(cx - unit * 2.5, cy - unit, unit * 5, unit * 2.5);
      [-1, 1].forEach((side) => {
        path += rect(
          cx + side * unit * 3 - unit / 2,
          cy - unit / 2,
          unit,
          unit * 2,
        );
        path += rect(
          cx + side * unit * 1.5 - unit / 2,
          cy - unit * 2.5,
          unit,
          unit * 1.5,
        );
        path += rect(
          cx + side * unit * (2 + march * 0.5) - unit / 2,
          cy + unit * 1.5,
          unit,
          unit,
        );
        path += hole(cx + side * unit - unit / 2, cy - unit / 2, unit, unit);
      });
    }
  });
  return path;
};
