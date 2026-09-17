/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

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

import { useCallback, useEffect, useRef, type RefObject } from 'react';
import {
  EUPHORIA_FRAME_MS,
  SMOOTH_FRAME_MS,
  shouldDrawFrame,
} from 'common/smoothing';
import observeShown from './observeShown';

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
 * reason for a meter to keep waking up. Environmental scenes may continue
 * their ambient motion in silence. Every consumer stops while hidden.
 *
 * `target` is what the loop draws on. Given one, the loop also stops while
 * nobody can see that element — the titlebar's wave faded out in full screen,
 * the meter in a drawer parked off the side — and starts again when they can.
 *
 * `minFrameMs` is a consumer's own pace, read every frame, in place of the
 * shell's: a Plus visualizer is drawn by the GPU and costs the page nothing
 * per frame, so it runs at the display's rate — or at the cap the listener
 * chose for it — rather than at the thirty the 2D graph is held to.
 */
const useSmoothFrames = (
  onFrame: (deltaMs: number) => boolean,
  {
    isEnabled,
    target,
    minFrameMs,
  }: {
    isEnabled: boolean;
    target?: RefObject<Element | null>;
    minFrameMs?: () => number;
  },
) => {
  const frameRef = useRef<number | undefined>(undefined);
  const lastDrawRef = useRef(0);
  const enabledRef = useRef(isEnabled);
  enabledRef.current = isEnabled;
  // Held in refs so changing either does not tear down and restart the loop
  // mid-motion, which would show as a hitch exactly when the mode changes.
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;
  const targetRef = useRef(target);
  targetRef.current = target;
  const paceRef = useRef(minFrameMs);
  paceRef.current = minFrameMs;
  const shownRef = useRef(true);
  const watchRef = useRef<{ element: Element; dispose: () => void }>(undefined);
  const kickRef = useRef<() => void>(() => undefined);

  const stop = useCallback(() => {
    if (frameRef.current !== undefined) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }
  }, []);

  /**
   * Whether the target can be seen, watching whichever element it is now.
   *
   * Resolved on every kick rather than once on mount, because a consumer can
   * swap the element out — the meter unmounts its canvas while hidden and
   * mounts a new one after.
   */
  const isTargetShown = useCallback(() => {
    const element = targetRef.current?.current ?? null;
    if (watchRef.current?.element !== element) {
      watchRef.current?.dispose();
      watchRef.current = undefined;
      shownRef.current = true;
      if (element) {
        // Recorded before observing: the first report arrives synchronously
        // and kicks, and that kick must find this element already watched
        // rather than start watching it a second time.
        const watch: { element: Element; dispose: () => void } = {
          element,
          dispose: () => undefined,
        };
        watchRef.current = watch;
        watch.dispose = observeShown(element, (shown) => {
          shownRef.current = shown;
          if (shown) {
            kickRef.current();
          } else {
            stop();
          }
        });
      }
    }
    return shownRef.current;
  }, [stop]);

  const kick = useCallback(() => {
    if (
      frameRef.current !== undefined ||
      !enabledRef.current ||
      document.hidden ||
      !isTargetShown() ||
      // Watching a new element reports it at once, and a shown report kicks.
      frameRef.current !== undefined
    ) {
      return;
    }
    lastDrawRef.current = performance.now();

    const tick = (now: number) => {
      if (document.hidden || !enabledRef.current || !shownRef.current) {
        frameRef.current = undefined;
        return;
      }
      const elapsed = now - lastDrawRef.current;
      const pace = paceRef.current;
      if (!shouldDrawFrame(elapsed, pace ? pace() : getFrameBudget())) {
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
  }, [isTargetShown]);
  kickRef.current = kick;

  useEffect(() => {
    if (!isEnabled) {
      stop();
    }
  }, [isEnabled, stop]);

  useEffect(
    () => () => {
      stop();
      watchRef.current?.dispose();
      watchRef.current = undefined;
    },
    [stop],
  );

  // Minimize/hide pauses every consumer, even when new audio keeps arriving.
  // Restoring starts with a fresh delta so scenery cannot jump ahead by the
  // entire hidden interval. Audio capture and playback are unaffected.
  useEffect(() => {
    const visibilityChanged = () => {
      if (document.hidden) {
        stop();
      } else {
        kick();
      }
    };
    document.addEventListener('visibilitychange', visibilityChanged);
    return () =>
      document.removeEventListener('visibilitychange', visibilityChanged);
  }, [kick, stop]);

  return isEnabled ? kick : stop;
};

export default useSmoothFrames;
