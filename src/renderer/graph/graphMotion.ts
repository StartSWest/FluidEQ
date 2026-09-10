import type { GraphStyle, Projected } from 'common/graphStyles';
import { createGraphShape, toColumns } from 'common/graphShapes';
import { isGraphScene } from 'common/graphScenes';

export interface IGraphMotionState {
  key: string;
  time: number;
  travel: number[];
}

export const createGraphMotionState = (): IGraphMotionState => ({
  key: '',
  time: 0,
  travel: [],
});

export const hasGraphMotion = (style: GraphStyle): boolean =>
  style === 'rain' || isGraphScene(style);

/** Scenery has ambient travel even when every measured band is silent. */
export const hasGraphAmbientMotion = (style: GraphStyle): boolean =>
  hasGraphMotion(style) ||
  ['truss', 'stalactites', 'arches', 'starfield', 'slope'].includes(style);

interface IMotionArgs {
  state: IGraphMotionState;
  points: readonly Projected[];
  style: GraphStyle;
  columns: number;
  top: number;
  bottom: number;
  deltaMs: number;
  playing: boolean;
  filled: boolean;
  gap?: number;
}

export const createMovingGraphShape = ({
  state,
  points,
  style,
  columns,
  top,
  bottom,
  deltaMs,
  playing,
  filled,
  gap = 0,
}: IMotionArgs): { path: string; moving: boolean } => {
  if (points.length < 2 || !hasGraphMotion(style)) {
    return { path: '', moving: false };
  }
  const left = points[0][0];
  const right = points[points.length - 1][0];
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const key = `${style}:${columns}:${left}:${right}:${top}:${bottom}:${points.length}`;
  if (state.key !== key) {
    Object.assign(state, createGraphMotionState(), { key });
  }
  // Integrate elapsed time, not frame count or absolute time times loudness:
  // the latter teleports a particle whenever the music changes its speed.
  const elapsed = playing ? Math.max(0, Math.min(100, deltaMs)) : 0;
  state.time += elapsed;
  if (isGraphScene(style)) {
    const energy =
      points.reduce(
        (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / height)),
        0,
      ) / points.length;
    // Integrate the music's pace. Multiplying absolute time by the current
    // level would jump every orbit, flame and car whenever the level changes.
    state.travel[0] =
      (state.travel[0] ?? 0) + (elapsed / 1000) * (0.5 + energy * 1.25);
    return {
      path: createGraphShape(
        points,
        style,
        bottom,
        columns,
        undefined,
        gap,
        top,
        filled,
        state.travel[0],
      ),
      moving: playing && points.some(([, y]) => bottom - y > height * 0.002),
    };
  }
  const bands = toColumns(points, columns);
  let path = '';
  let loudest = 0;
  bands.forEach(([x, y], index) => {
    const energy = Math.max(0, Math.min(1, (bottom - y) / height));
    loudest = Math.max(loudest, energy);
    const seed = ((index * 2654435761) % 65536) / 65536;
    const previous = state.travel[index] ?? seed;
    const speed = 0.22 + energy * 0.34;
    const position = (previous + (elapsed / 1000) * speed) % 1;
    state.travel[index] = position;
    for (let layer = 0; layer < 3; layer += 1) {
      const phase = (position + layer / 3 + seed * layer * 0.17) % 1;
      const landing = bottom - height * energy * 0.16;
      const lane = width / bands.length;
      const dropX = x + (layer - 1) * lane * 0.23;
      const length = (3 + energy * 18) * (0.55 + layer * 0.23);
      if (phase < 0.82) {
        const fall = phase / 0.82;
        const row = top + fall * (landing - top);
        const wind = (1 - fall) * lane * 0.22;
        path += `M ${(dropX + wind).toFixed(2)},${row.toFixed(2)} L ${(dropX + wind - length * 0.12).toFixed(2)},${Math.min(landing, row + length).toFixed(2)} `;
      } else {
        const splash = (phase - 0.82) / 0.18;
        const spread = lane * 0.3 * splash;
        const lift = Math.sin(splash * Math.PI) * (3 + energy * 9);
        // Only the landing part of each drop's life splashes, so the floor
        // has little expanding impacts instead of a permanent dotted line.
        path += `M ${(dropX - spread).toFixed(2)},${(landing - lift).toFixed(2)} l ${(2 * (1 - splash)).toFixed(2)},${(2 * (1 - splash)).toFixed(2)} M ${(dropX + spread).toFixed(2)},${(landing - lift).toFixed(2)} l ${(-2 * (1 - splash)).toFixed(2)},${(2 * (1 - splash)).toFixed(2)} `;
      }
    }
  });
  return { path, moving: playing && loudest > 0.002 };
};
