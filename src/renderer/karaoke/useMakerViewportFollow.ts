/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type Dispatch, type SetStateAction, useEffect } from 'react';

interface IMakerViewportFollowInput {
  viewDurationMs: number;
  visibleViewDurationMs: number;
  setViewDurationMs: Dispatch<SetStateAction<number>>;
  setViewStartMs: Dispatch<SetStateAction<number>>;
  maximumViewStartMs: number;
  isPlaying: boolean;
  followViewport: boolean;
  viewStartMs: number;
  playheadMs: number;
  effectiveDurationMs: number;
}

/**
 * Where the playhead stands in a followed view: a third of the way in, so
 * what is coming is twice as much as what has gone.
 */
const FOLLOW_AT = 1 / 3;

/**
 * Keeps the editor's view inside the song and, while following, ahead of
 * the playhead: the view is clamped whenever the song or the zoom changes,
 * and scrolls with the playhead once it reaches a third of the way across.
 *
 * It used to turn the page: the playhead ran to 92% of the view and the
 * whole view jumped to put it at 20%, every few seconds (Ivan, 2026-11-15:
 * "and the smooth scrolling in the karaoke follow lyrics?"). Now the view
 * moves with the playhead, frame by frame, as the playhead itself does - it
 * follows the same reading, so it is exactly as smooth as the playhead. A
 * seek behind the view, or far past it, lands the playhead at the same
 * third at once.
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
  playheadMs,
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

  useEffect(() => {
    if (!isPlaying || !followViewport) {
      return;
    }
    if (
      playheadMs > viewStartMs + visibleViewDurationMs * FOLLOW_AT ||
      playheadMs < viewStartMs
    ) {
      const next = Math.min(
        Math.max(0, effectiveDurationMs - visibleViewDurationMs),
        Math.max(0, playheadMs - visibleViewDurationMs * FOLLOW_AT),
      );
      if (next !== viewStartMs) {
        setViewStartMs(next);
      }
    }
  }, [
    setViewStartMs,
    effectiveDurationMs,
    followViewport,
    isPlaying,
    playheadMs,
    visibleViewDurationMs,
    viewStartMs,
  ]);
};

export default useMakerViewportFollow;
