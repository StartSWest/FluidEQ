/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../utils/bandReveal';

/**
 * A live slide's drawing moved by the clock it is painted on: `onFrame` gets
 * the seconds since the drawing mounted, once per painted frame, at most
 * `fps` times a second. Painted frames are the only signal: a hidden window
 * gets none, the tour mounts only the slide on stage and its figure only
 * while it is in sight (`TourLiveFigure`), so nothing here runs where it
 * cannot be seen.
 *
 * At most 30 a second by default: the drawings are the app's own controls,
 * whose readouts are rendered by React, and 60 renders a second of a panel
 * nobody is touching is work a slow machine feels (the 2.6 brief: "it must
 * stay light").
 *
 * With the app's Animations switched off, one frame at `still` seconds and
 * nothing after: a pose chosen to show the feature at work, never the empty
 * first frame.
 */
export default function useTourFrames(
  onFrame: (seconds: number) => void,
  { fps = 30, still = 6 }: { fps?: number; still?: number } = {},
): void {
  const latest = useRef(onFrame);
  latest.current = onFrame;

  useEffect(() => {
    if (prefersReducedMotion()) {
      latest.current(still);
      return undefined;
    }
    const spacing = 1000 / fps;
    let frame = 0;
    let start: number | undefined;
    let shownAt = Number.NEGATIVE_INFINITY;
    const step = (now: number) => {
      start ??= now;
      // Half a frame's leeway, so 30 a second on a 60 Hz screen is every
      // other frame rather than every third when the clock jitters.
      if (now - shownAt >= spacing - 4) {
        shownAt = now;
        latest.current((now - start) / 1000);
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [fps, still]);
}
