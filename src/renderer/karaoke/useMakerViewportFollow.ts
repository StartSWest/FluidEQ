/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type SetStateAction, useEffect, useRef } from 'react';
import type { IKaraokeLiveValue } from './karaokeLiveValue';

interface IMakerViewportFollowInput {
  viewDurationMs: number;
  visibleViewDurationMs: number;
  setViewDurationMs: Dispatch<SetStateAction<number>>;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  maximumViewStartMs: number;
  isPlaying: boolean;
  followViewport: boolean;
  viewStartMs: number;
  /** Watched rather than rendered: a page turns a few times a minute. */
  playhead: IKaraokeLiveValue<number>;
  effectiveDurationMs: number;
}

/** The page turns when the playhead reaches this far across the view... */
const PAGE_TURN_AT = 0.92;

/** ...and lands it this far across the next. */
const PAGE_LANDS_AT = 0.2;

/** How long a page turn glides for. */
const PAGE_GLIDE_MS = 520;

/** Slow out of the old page, slow into the new one. */
const easeInOutCubic = (progress: number): number =>
  progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;

interface IPageGlide {
  from: number;
  /** The first frame's own timestamp; unset until that frame is drawn. */
  startedAt: number | undefined;
}

/**
 * Keeps the editor's view inside the song and, while following, ahead of
 * the playhead: the view is clamped whenever the song or the zoom changes,
 * and turns the page when the playhead nears its right edge.
 *
 * The page turn GLIDES (Ivan, 2026-11-15: "pages, but when it is reaching
 * the end it moves smoothly forward a page"). It used to jump a whole page
 * in one frame; scrolling with the playhead all the time, tried next, was
 * not what he wanted either. A turn now eases from the page it leaves to
 * the one that puts the playhead at a fifth of the way across, over half a
 * second of animation frames - toward where that is NOW, since the playhead
 * keeps moving during the glide, so it lands exactly where a jump would
 * have. A seek behind the page or past it still lands at once: that is the
 * reader asking to be somewhere else, not the song moving on.
 *
 * The playhead is watched, never rendered: each of its ticks is checked
 * against the page here, and the editor renders only when the view moves.
 */
const useMakerViewportFollow = ({
  viewDurationMs,
  visibleViewDurationMs,
  setViewDurationMs,
  setViewStartMs,
  maximumViewStartMs,
  isPlaying,
  followViewport,
  viewStartMs,
  playhead,
  effectiveDurationMs,
}: IMakerViewportFollowInput) => {
  useEffect(() => {
    if (viewDurationMs !== visibleViewDurationMs) {
      setViewDurationMs(visibleViewDurationMs);
    }
    setViewStartMs((current) => Math.min(maximumViewStartMs, current));
  }, [
    maximumViewStartMs,
    setViewDurationMs,
    setViewStartMs,
    viewDurationMs,
    visibleViewDurationMs,
  ]);

  // What the glide's frames read: the render that scheduled a frame is
  // already stale by the time it runs.
  const liveRef = useRef({ visibleViewDurationMs, effectiveDurationMs });
  liveRef.current = { visibleViewDurationMs, effectiveDurationMs };
  const glideRef = useRef<IPageGlide | undefined>(undefined);
  const frameRef = useRef(0);

  const landingFor = (atMs: number) => {
    const live = liveRef.current;
    return Math.min(
      Math.max(0, live.effectiveDurationMs - live.visibleViewDurationMs),
      Math.max(0, atMs - live.visibleViewDurationMs * PAGE_LANDS_AT),
    );
  };

  const stopGlide = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    glideRef.current = undefined;
  };

  useEffect(() => stopGlide, []);

  useEffect(() => {
    if (!isPlaying || !followViewport) {
      stopGlide();
      return undefined;
    }
    const follow = () => {
      if (glideRef.current) {
        return;
      }
      const playheadMs = playhead.read();
      const viewportEnd = viewStartMs + visibleViewDurationMs;
      if (playheadMs < viewStartMs || playheadMs > viewportEnd) {
        setViewStartMs(landingFor(playheadMs));
        return;
      }
      if (playheadMs <= viewStartMs + visibleViewDurationMs * PAGE_TURN_AT) {
        return;
      }
      const glide: IPageGlide = { from: viewStartMs, startedAt: undefined };
      glideRef.current = glide;
      const step = (now: number) => {
        if (glideRef.current !== glide) {
          return;
        }
        glide.startedAt ??= now;
        const progress = Math.min(1, (now - glide.startedAt) / PAGE_GLIDE_MS);
        const to = landingFor(playhead.read());
        setViewStartMs(
          glide.from + (to - glide.from) * easeInOutCubic(progress),
        );
        if (progress < 1) {
          frameRef.current = requestAnimationFrame(step);
        } else {
          frameRef.current = 0;
          glideRef.current = undefined;
        }
      };
      frameRef.current = requestAnimationFrame(step);
    };
    follow();
    // Letting go of the playhead leaves a glide running: its steps are the
    // animation frames', and each one runs this again (`viewStartMs`).
    return playhead.subscribe(follow);
    // `landingFor` and `stopGlide` read refs only; listing them would restart
    // this on every render for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playhead,
    setViewStartMs,
    followViewport,
    isPlaying,
    visibleViewDurationMs,
    viewStartMs,
  ]);
};

export default useMakerViewportFollow;
