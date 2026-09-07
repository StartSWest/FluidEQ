import type { Projected } from 'common/graphStyles';
import { createGraphShape } from 'common/graphShapes';

interface IFrame {
  time: number;
  points: Projected[];
}
export interface IDashTrails {
  key: string;
  time: number;
  changedAt: number;
  history: IFrame[];
}

export const createDashTrails = (): IDashTrails => ({
  key: '',
  time: 0,
  changedAt: 0,
  history: [],
});

const sampleAt = (frames: IFrame[], time: number): Projected[] => {
  const index = frames.findIndex((frame) => frame.time >= time);
  if (index <= 0) {
    return frames[index === 0 ? 0 : frames.length - 1].points;
  }
  const before = frames[index - 1];
  const after = frames[index];
  const mix = (time - before.time) / Math.max(1, after.time - before.time);
  return before.points.map(([x, y], column) => [
    x,
    y + (after.points[column][1] - y) * mix,
  ]);
};

/** Three short afterimages use elapsed time and a bounded history, not frame count. */
export const advanceDashTrails = (
  state: IDashTrails,
  points: readonly Projected[],
  baseline: number,
  gap: number,
  deltaMs: number,
  playing: boolean,
) => {
  if (points.length < 2) {
    return { trails: [], moving: false };
  }
  const key = `${points.length}:${points[0][0]}:${points[points.length - 1][0]}:${baseline}`;
  if (key !== state.key) {
    Object.assign(state, createDashTrails(), { key });
  }
  if (playing) {
    state.time += Math.max(0, Math.min(100, deltaMs));
  }
  const previous = state.history[state.history.length - 1];
  if (
    !previous ||
    points.some(([, y], index) => Math.abs(y - previous.points[index][1]) > 0.1)
  ) {
    state.changedAt = state.time;
  }
  if (!previous || previous.time !== state.time) {
    state.history.push({
      time: state.time,
      points: points.map(([x, y]) => [x, y]),
    });
  }
  while (state.history.length > 2 && state.history[1].time < state.time - 240) {
    state.history.shift();
  }
  while (state.history.length > 64) {
    state.history.shift();
  }
  return {
    trails: [3, 2, 1].map((age) => ({
      path: createGraphShape(
        sampleAt(state.history, state.time - age * 65),
        'dashes',
        baseline,
        points.length,
        undefined,
        gap,
      ),
      opacity: [0, 0.23, 0.12, 0.055][age],
      width: 1 - age * 0.16,
    })),
    moving: playing && state.time - state.changedAt < 240,
  };
};
