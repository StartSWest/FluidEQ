import type { Projected } from 'common/graphStyles';

/** Where a bubble is on its climb, 0 at the floor and 1 at the surface. */
export const bubblePhase = (index: number, layer: number, seconds: number) =>
  (seconds * (0.035 + layer * 0.014) + ((index * 37) % 101) / 101 + layer / 3) %
  1;

/** The bubble in band `band` nearest in height to `index`'s main one. */
export const bubbleTarget = (
  index: number,
  seconds: number,
  band = index + 1,
): number => {
  const phase = bubblePhase(index, 0, seconds);
  let layer = 0;
  for (let candidate = 1; candidate < 3; candidate += 1) {
    if (
      Math.abs(bubblePhase(band, candidate, seconds) - phase) <
      Math.abs(bubblePhase(band, layer, seconds) - phase)
    ) {
      layer = candidate;
    }
  }
  return band * 3 + layer;
};

export const POP_LIFE = 0.42;
export const REGROW_AFTER = 0.5;
/** How long the room keeps shaking after a thunderclap. */
export const SHAKE_LIFE = 0.3;
/** A strike is over in under a fifth of a second; longer reads as a wire. */
export const BOLT_LIFE = 0.18;

export interface IBolt {
  at: number;
  from: number;
  to: number;
}

export const createBubbleStorm = () => ({
  levels: [] as number[],
  beatLevel: 0,
  /** Bubble id → the clock reading when it burst. */
  pops: new Map<number, number>(),
  bolts: [] as IBolt[],
  /** The clock reading of the last heavy volley, and how heavy it was. */
  shakeAt: -1,
  shakeStrength: 0,
});
export type BubbleStorm = ReturnType<typeof createBubbleStorm>;

/**
 * A sharp rise in a band throws a bolt from its bubble to the nearest bubble
 * in the next band and bursts both, so a hit reads as something striking
 * rather than as a size change. Once per frame; a mirrored wave paints the
 * same storm twice and must not decide it twice.
 */
export const advanceBubbleStorm = (
  state: BubbleStorm,
  points: readonly Projected[],
  top: number,
  bottom: number,
  seconds: number,
  playing: boolean,
) => {
  if (state.levels.length !== points.length) {
    state.levels = points.map(() => 0);
    state.beatLevel = 0;
    state.pops.clear();
    state.bolts = [];
  }
  if (!playing) {
    return;
  }
  state.pops.forEach((at, id) => {
    if (seconds - at > POP_LIFE + REGROW_AFTER + 0.8 || seconds < at) {
      state.pops.delete(id);
    }
  });
  state.bolts = state.bolts.filter(
    (bolt) => seconds - bolt.at <= BOLT_LIFE && seconds >= bolt.at,
  );
  const depth = Math.max(1, bottom - top);
  const levels = points.map(([, y]) =>
    Math.max(0, Math.min(1, (bottom - y) / depth)),
  );
  let struck = 0;
  const strike = (index: number) => {
    const source = index * 3;
    if (state.pops.has(source)) {
      return;
    }
    state.pops.set(source, seconds);
    struck += 1;
    // Both neighbours, so one hit throws a fork each way and a run of hits
    // reads as a storm crossing the band rather than a chain of hops.
    [index - 1, index + 1].forEach((band) => {
      if (band < 0 || band >= points.length) {
        return;
      }
      const target = bubbleTarget(index, seconds, band);
      state.bolts.push({ at: seconds, from: source, to: target });
      if (!state.pops.has(target)) {
        state.pops.set(target, seconds);
      }
    });
  };
  levels.forEach((level, index) => {
    if (level - state.levels[index] >= 0.08) {
      strike(index);
    }
  });
  // A beat is the whole spectrum jumping, and it gets a volley: every third
  // band that is carrying real energy fires, whatever its own delta was.
  const mean = levels.reduce((sum, level) => sum + level, 0) / levels.length;
  if (mean - state.beatLevel >= 0.05) {
    levels.forEach((level, index) => {
      if (index % 3 === 0 && level > 0.3) {
        strike(index);
      }
    });
  }
  state.beatLevel = Math.max(mean, state.beatLevel * 0.9);
  // Three bands striking together is a thunderclap, and the room shakes.
  if (struck >= 3) {
    state.shakeAt = seconds;
    state.shakeStrength = Math.max(
      state.shakeStrength,
      Math.min(1, struck / 8),
    );
  } else if (seconds - state.shakeAt > SHAKE_LIFE) {
    state.shakeStrength = 0;
  }
  // Track the level with a fast release so the next hit measures against
  // where the band actually is, not against its last peak.
  levels.forEach((level, index) => {
    state.levels[index] = Math.max(level, state.levels[index] * 0.9);
  });
};

/**
 * The pixel offset the whole scene is drawn at while a thunderclap rings.
 *
 * The clock is the music-pace clock, so the jitter frequencies are set high
 * enough to move on every frame at its slowest rate and still settle in
 * SHAKE_LIFE at its fastest.
 */
export const bubbleShake = (state: BubbleStorm, seconds: number) => {
  const remaining = 1 - (seconds - state.shakeAt) / SHAKE_LIFE;
  if (state.shakeStrength <= 0 || remaining <= 0 || seconds < state.shakeAt) {
    return { x: 0, y: 0 };
  }
  const amplitude = state.shakeStrength * remaining * 7;
  return {
    x: Math.sin(seconds * 97) * amplitude,
    y: Math.cos(seconds * 83) * amplitude,
  };
};
