import type { Projected } from 'common/graphStyles';
import { getEaseFactor } from 'common/smoothing';
import {
  polylinePath,
  pulseHeadFraction,
  pulseVertices,
  sliceByX,
} from 'common/graphPulse';

/**
 * What makes the pulse a monitor and not a drawing of one.
 *
 * The write-head sweeps left to right on the music-pace clock. The trace is
 * brightest just behind the head and fades along the tail; just ahead of
 * it is the wiped gap a monitor leaves before the old trace resumes, dim.
 * A beat — the mean level jumping against a clock-released tracker — is a
 * thump: the whole trace pumps taller for a moment, the head flares, and
 * the room shakes in proportion to how hard the beat hit.
 *
 * Decided once per frame, before the curves, so a mirrored wave shows the
 * same thump without deciding it twice.
 */

/** The tail is 45% of the plot; the wiped gap ahead of the head, 4%. */
const TAIL_FRACTION = 0.45;
const GAP_FRACTION = 0.04;
/** A thump rises in 60ms and lets go over 260ms; the shake lasts 300ms. */
export const THUMP_RISE = 0.06;
export const THUMP_FALL = 0.26;
export const SHAKE_LIFE = 0.3;
/** An echo drifts for 1.4s; at most six ride the background at once. */
export const ECHO_LIFE = 1.4;
const ECHO_LIMIT = 6;

interface IEcho {
  path: Path2D;
  at: number;
  strength: number;
}

export const createPulseMonitor = () => ({
  beatLevel: 0,
  trackedAt: -1,
  thumpAt: -1,
  /** 0..1: how hard the last beat hit, from its jump against the tracker. */
  thumpStrength: 0,
  /** Copies of the trace let go on each beat, passing in the background. */
  echoes: [] as IEcho[],
});
export type PulseMonitor = ReturnType<typeof createPulseMonitor>;

export const advancePulseMonitor = (
  state: PulseMonitor,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (!playing) {
    return;
  }
  const depth = Math.max(1, bottom - top);
  const mean =
    points.reduce(
      (sum, [, y]) => sum + Math.max(0, Math.min(1, (bottom - y) / depth)),
      0,
    ) / Math.max(1, points.length);
  state.echoes = state.echoes.filter(
    (echo) => seconds - echo.at <= ECHO_LIFE && seconds >= echo.at,
  );
  const jump = mean - state.beatLevel;
  if (jump >= 0.05) {
    state.thumpAt = seconds;
    state.thumpStrength = Math.min(1, jump / 0.2);
  }
  // Released on the clock, not per frame — see the bubble storm's tracker.
  const elapsedMs =
    state.trackedAt < 0 ? 0 : Math.max(0, seconds - state.trackedAt) * 1000;
  state.trackedAt = seconds;
  state.beatLevel = Math.max(
    mean,
    state.beatLevel * (1 - getEaseFactor(elapsedMs, 110)),
  );
};

/** 0 at rest, 1 at the top of a thump, weighted by how hard it hit. */
export const pulseThump = (state: PulseMonitor, seconds: number) => {
  const age = seconds - state.thumpAt;
  if (state.thumpAt < 0 || age < 0 || age > THUMP_RISE + THUMP_FALL) {
    return 0;
  }
  const envelope =
    age < THUMP_RISE ? age / THUMP_RISE : 1 - (age - THUMP_RISE) / THUMP_FALL;
  return envelope * state.thumpStrength;
};

/** The pixel offset the scene is drawn at while a thump rings. */
export const pulseShake = (state: PulseMonitor, seconds: number) => {
  const remaining = 1 - (seconds - state.thumpAt) / SHAKE_LIFE;
  if (state.thumpAt < 0 || remaining <= 0 || seconds < state.thumpAt) {
    return { x: 0, y: 0 };
  }
  const amplitude = state.thumpStrength * remaining * 8;
  return {
    x: Math.sin(seconds * 97) * amplitude,
    y: Math.cos(seconds * 83) * amplitude,
  };
};

/**
 * The frame's trace, cut at the head.
 *
 * `old` is everything outside the tail and the gap, dim. `fresh` is the
 * tail in four slices, the one nearest the head brightest. `shape` is the
 * pumped trace shut against the floor, for the fill and outline.
 */
export const createPulsePaths = (
  state: PulseMonitor,
  points: readonly Projected[],
  baseline: number,
  seconds: number,
) => {
  const pump = 1 + 0.35 * pulseThump(state, seconds);
  const vertices = pulseVertices(points, baseline, pump);
  const left = points[0]?.[0] ?? 0;
  const right = points[points.length - 1]?.[0] ?? 1;
  const width = Math.max(1, right - left);
  const headX = left + pulseHeadFraction(seconds) * width;
  const tailStart = headX - width * TAIL_FRACTION;
  const gapEnd = headX + width * GAP_FRACTION;

  const open = polylinePath(vertices);
  // A beat lets an echo of the trace go: this frame's, before the pump
  // has lifted it, so the echo leaves from where the trace was.
  if (
    state.thumpAt === seconds &&
    !state.echoes.some((echo) => echo.at === seconds)
  ) {
    state.echoes.unshift({
      path: new Path2D(open),
      at: seconds,
      strength: state.thumpStrength,
    });
    if (state.echoes.length > ECHO_LIMIT) {
      state.echoes.length = ECHO_LIMIT;
    }
  }
  const shape = new Path2D(open);
  if (vertices.length >= 2) {
    shape.lineTo(vertices[vertices.length - 1][0], baseline);
    shape.lineTo(vertices[0][0], baseline);
    shape.closePath();
  }
  const old = new Path2D(
    `${polylinePath(sliceByX(vertices, left, tailStart))} ${polylinePath(
      sliceByX(vertices, gapEnd, right),
    )}`,
  );
  // Early in a sweep the tail is simply short: the trace ahead of the head
  // is the previous sweep's, and it stays dim until the head reaches it.
  const fresh = Array.from({ length: 4 }, (_, slice) => {
    const a = tailStart + (width * TAIL_FRACTION * slice) / 4;
    const b = tailStart + (width * TAIL_FRACTION * (slice + 1)) / 4;
    return new Path2D(polylinePath(sliceByX(vertices, Math.max(left, a), b)));
  });
  const headPoint = sliceByX(vertices, headX, headX)[0] ?? [headX, baseline];
  return { shape, old, fresh, head: headPoint };
};

/** Where an echo has drifted to and how much of it is left, 1 fresh to 0. */
export const echoDrift = (echo: IEcho, seconds: number, depth: number) => {
  const age = (seconds - echo.at) / ECHO_LIFE;
  if (age < 0 || age > 1) {
    return { x: 0, y: 0, glow: 0 };
  }
  // Up and a little to the right, slowing as it fades — a ripple leaving.
  const eased = 1 - (1 - age) * (1 - age);
  return {
    x: eased * depth * 0.12,
    y: -eased * depth * 0.55 * (0.5 + echo.strength * 0.5),
    glow: (1 - age) * (0.4 + echo.strength * 0.6),
  };
};
