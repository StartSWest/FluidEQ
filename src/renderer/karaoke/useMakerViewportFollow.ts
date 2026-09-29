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
 * Keeps the editor's view inside the song and, while following, ahead of
 * the playhead: the view is clamped whenever the song or the zoom changes,
 * and turns the page when the playhead nears its right edge.
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
    const viewportEnd = viewStartMs + visibleViewDurationMs;
    if (playheadMs > viewportEnd - visibleViewDurationMs * 0.08) {
      setViewStartMs(
        Math.min(
          Math.max(0, effectiveDurationMs - visibleViewDurationMs),
          Math.max(0, playheadMs - visibleViewDurationMs * 0.2),
        ),
      );
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
