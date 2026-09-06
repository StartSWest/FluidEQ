import type { GraphStyle, Projected } from 'common/graphStyles';
import { toColumns } from 'common/graphShapes';

interface IHistoryFrame {
  time: number;
  points: Projected[];
}

export interface IGraphMotionState {
  key: string;
  time: number;
  travel: number[];
  history: IHistoryFrame[];
  changedAt: number;
}

export const createGraphMotionState = (): IGraphMotionState => ({
  key: '',
  time: 0,
  travel: [],
  history: [],
  changedAt: 0,
});

export const hasGraphMotion = (style: GraphStyle): boolean =>
  style === 'rain' || style === 'starfield' || style === 'echo';

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
}

const line = (points: readonly Projected[]) =>
  `M ${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' L ')}`;

const historyAt = (
  history: readonly IHistoryFrame[],
  time: number,
): readonly Projected[] => {
  const afterIndex = history.findIndex((frame) => frame.time >= time);
  if (afterIndex <= 0) {
    return history[afterIndex === 0 ? 0 : history.length - 1].points;
  }
  const before = history[afterIndex - 1];
  const after = history[afterIndex];
  const mix = (time - before.time) / Math.max(1, after.time - before.time);
  return before.points.map(([x, y], index) => [
    x,
    y + (after.points[index][1] - y) * mix,
  ]);
};

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
  if (style === 'echo') {
    const previous = state.history[state.history.length - 1];
    if (
      !previous ||
      points.some(
        ([, y], index) => Math.abs(y - previous.points[index][1]) > 0.1,
      )
    ) {
      state.changedAt = state.time;
    }
    if (!previous || state.time !== previous.time) {
      state.history.push({
        time: state.time,
        points: points.map(([x, y]) => [x, y]),
      });
    }
    // Keep the frame before the oldest echo for interpolation. History is
    // bounded in both time and count, including high-refresh monitors.
    while (
      state.history.length > 2 &&
      state.history[1].time < state.time - 720
    ) {
      state.history.shift();
    }
    while (state.history.length > 256) {
      state.history.shift();
    }
    const paths: string[] = [];
    for (let copy = 0; copy <= 3; copy += 1) {
      const old = historyAt(state.history, state.time - copy * 220);
      const decay = 1 - copy * 0.24;
      const trace = line(
        old.map(([x, y]) => [x, bottom - (bottom - y) * decay]),
      );
      paths.push(
        filled ? `${trace} L ${right},${bottom} L ${left},${bottom} Z` : trace,
      );
    }
    return {
      path: paths.join(' '),
      moving: playing && state.time - state.changedAt < 720,
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
    const speed =
      style === 'rain' ? 0.22 + energy * 0.34 : 0.12 + energy * 0.28;
    const position = (previous + (elapsed / 1000) * speed) % 1;
    state.travel[index] = position;
    if (style === 'rain') {
      // A drop crosses the plot in seconds; the spectrum controls its length
      // and speed without making it jump to another row on every FFT frame.
      for (let layer = 0; layer < 3; layer += 1) {
        const phase = (position + layer / 3) % 1;
        const row = top + phase * height;
        const length = 2 + energy * 12;
        path += `M ${x.toFixed(2)},${row.toFixed(2)} V ${Math.min(bottom, row + length).toFixed(2)} `;
      }
    } else {
      const angle = index * 2.399963229728653;
      const radius = position * position;
      const tail = Math.max(0, radius - (0.015 + energy * 0.065));
      const cx = left + width / 2;
      const cy = top + height / 2;
      const dx = Math.cos(angle) * width * 0.5;
      const dy = Math.sin(angle) * height * 0.5;
      path += `M ${(cx + dx * tail).toFixed(2)},${(cy + dy * tail).toFixed(2)} L ${(cx + dx * radius).toFixed(2)},${(cy + dy * radius).toFixed(2)} `;
    }
  });
  return { path, moving: playing && loudest > 0.002 };
};
