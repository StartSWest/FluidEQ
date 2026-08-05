/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useCallback, useEffect, useRef } from 'react';
import {
  EUPHORIA_FRAME_MS,
  SMOOTH_FRAME_MS,
  shouldDrawFrame,
} from 'common/smoothing';

/**
 * How often to draw, decided per frame from the mode the shell is in.
 *
 * Read from the document class rather than passed in, because that class is
 * where euphoria already lives and reading it costs nothing — a prop would
 * have to be threaded through every component in between and would only be as
 * current as the last re-render, which for a component that has stopped
 * re-rendering is not current at all.
 */
const getFrameBudget = () =>
  document.documentElement.classList.contains('is-euphoric')
    ? EUPHORIA_FRAME_MS
    : SMOOTH_FRAME_MS;

/**
 * Draw between measurements, at the display's rate rather than the analyser's.
 *
 * NOTHING HERE GOES THROUGH REACT. The callback is expected to write to the
 * DOM directly, and that is the whole reason this exists: the alternative is
 * setting state sixty times a second, which re-renders the subscriber and, for
 * the response graph, everything d3 hangs off it. Rendering a heavy component
 * at display rate to make a line look smoother is a trade in the wrong
 * direction.
 *
 * The loop stops on its own. `onFrame` reports whether anything is still
 * moving, and once a shape has arrived at the last measurement there is no
 * reason to keep waking up — a silent room should cost nothing. `kick` starts
 * it again when the next measurement lands.
 */
export const useSmoothFrames = (
  onFrame: (deltaMs: number) => boolean,
  { isEnabled }: { isEnabled: boolean },
) => {
  const frameRef = useRef<number | undefined>(undefined);
  const lastDrawRef = useRef(0);
  // Held in refs so changing either does not tear down and restart the loop
  // mid-motion, which would show as a hitch exactly when the mode changes.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const stop = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  const kick = useCallback(() => {
    if (frameRef.current !== undefined) {
      return;
    }
    lastDrawRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastDrawRef.current;
      if (!shouldDrawFrame(elapsed, getFrameBudget())) {
        // Too soon for this mode. Still queued, so the next frame is
        // considered — skipping is how the rate is capped without a timer.
        frameRef.current = requestAnimationFrame(tick);
        return;
      }
      lastDrawRef.current = now;
      const moving = onFrameRef.current(elapsed);
      frameRef.current = moving ? requestAnimationFrame(tick) : undefined;
    };

    frameRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!isEnabled) {
      stop();
    }
  }, [isEnabled, stop]);

  useEffect(() => stop, [stop]);

  return isEnabled ? kick : stop;
};
