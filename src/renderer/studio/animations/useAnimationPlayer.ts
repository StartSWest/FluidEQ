import { useCallback, useEffect, useRef, useState } from 'react';
import type { TAnimationGround } from 'common/studioAnimation';
import type { IViewedAnimation } from './useStudioAnimations';

export type TAnimationSlope = 'flat' | 'up' | 'down';

/** The speeds offered beside the animation's own (Ivan: smooth at ~12). */
export const ANIMATION_SPEEDS = [4, 6, 8, 12];

/** How long a one-shot holds its last frame before it plays again here. */
const HOLD_SECONDS = 0.5;

/**
 * The frame `played` frames into watching an animation, from `from`.
 * Watched, everything repeats (Ivan, 2026-11-09: "also play needs to
 * loop"): a looping animation round and round, a one-shot to its end, a
 * beat held on its last frame, then from its start again. In the scene a
 * one-shot still plays once; only watching it repeats.
 */
export const watchedFrame = (
  from: number,
  played: number,
  count: number,
  fps: number,
  loop: boolean,
) => {
  const cycle = loop
    ? count
    : count + Math.max(1, Math.round(fps * HOLD_SECONDS));
  return Math.min((from + played) % cycle, count - 1);
};

export interface IAnimationPlayer {
  frame: number;
  playing: boolean;
  fps: number;
  onion: boolean;
  ground: TAnimationGround;
  slope: TAnimationSlope;
  toggle(): void;
  /** Stops on frame `index` (wrapped round the cycle). */
  goTo(index: number): void;
  setFps(fps: number): void;
  setOnion(onion: boolean): void;
  setGround(ground: TAnimationGround): void;
  setSlope(slope: TAnimationSlope): void;
}

/**
 * An opened animation's playback, one for the place it is shown inline and
 * the larger view over the Studio: closing the larger one leaves it on the
 * same frame, playing or not, at the same speed and against the same
 * ground.
 *
 * Played on the painted frame's own clock (`requestAnimationFrame`'s time),
 * from the frame it started on: the frame shown is the one that many
 * frames-a-second after that start, never one counted by a timer. It plays
 * until paused, a one-shot included (`watchedFrame`).
 */
export default function useAnimationPlayer(
  viewed: IViewedAnimation,
): IAnimationPlayer {
  const { animation } = viewed;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [fps, setFps] = useState(animation.fps);
  const [onion, setOnion] = useState(false);
  const [ground, setGround] = useState<TAnimationGround>(animation.ground);
  const [slope, setSlope] = useState<TAnimationSlope>('flat');
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { count, loop } = animation;

  // A sheet rewritten with fewer frames: the frame stays inside it.
  if (frame >= count) {
    setFrame(count - 1);
  }

  useEffect(() => {
    if (!playing) {
      return undefined;
    }
    const from = frameRef.current;
    let started: number | undefined;
    let request = 0;
    const step = (at: number) => {
      if (started === undefined) {
        started = at;
      }
      const played = Math.floor(((at - started) * fps) / 1000);
      const next = watchedFrame(from, played, count, fps, loop);
      if (next !== frameRef.current) {
        setFrame(next);
      }
      request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step);
    return () => cancelAnimationFrame(request);
  }, [playing, fps, count, loop]);

  const goTo = useCallback(
    (index: number) => {
      setPlaying(false);
      setFrame(((index % count) + count) % count);
    },
    [count],
  );
  const toggle = useCallback(() => setPlaying((now) => !now), []);

  return {
    frame: Math.min(frame, count - 1),
    playing,
    fps,
    onion,
    ground,
    slope,
    toggle,
    goTo,
    setFps,
    setOnion,
    setGround,
    setSlope,
  };
}

/**
 * The frame a card shows: its loop playing on the painted frame's clock,
 * from when the card was first drawn.
 */
export const useLoopFrame = (viewed: IViewedAnimation): number => {
  const { count, fps, loop } = viewed.animation;
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    let started: number | undefined;
    let request = 0;
    let shown = 0;
    const step = (at: number) => {
      if (started === undefined) {
        started = at;
      }
      const played = Math.floor(((at - started) * fps) / 1000);
      // A one-shot on a card plays again, so the card is never a still.
      const frameNow = watchedFrame(0, played, count, fps, loop);
      if (frameNow !== shown) {
        shown = frameNow;
        setFrame(frameNow);
      }
      request = requestAnimationFrame(step);
    };
    request = requestAnimationFrame(step);
    return () => cancelAnimationFrame(request);
  }, [count, fps, loop]);
  return frame;
};
