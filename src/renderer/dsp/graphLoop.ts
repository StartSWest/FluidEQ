/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A canvas loop that turns while the engine is publishing, and stops when it
 * is not.
 *
 * Every graph in the rack had one of these written out by hand, and they had
 * drifted into two incompatible shapes. Most asked for the next frame at the
 * foot of `paint` unconditionally: correct, and a full canvas repaint sixty
 * times a second for as long as the tab is open, whether or not anything is
 * playing. The EQ curve and the phase meter stopped when there was nothing to
 * draw, which is the right instinct — and the EQ one then could not start
 * again, because the thing it was waiting for is a module value that renders
 * nothing when it changes.
 *
 * So both halves live here once. The loop runs while `readDspAnalysisLive`
 * says frames are arriving, stops when they are not, and is re-armed by the
 * registration event rather than by a render that may never come. The cost of
 * being idle is one listener in a set; the cost of being live is what it
 * always was.
 *
 * What this deliberately does NOT do is repaint on a settings change. A knob
 * has to reach the canvas while the engine is idle, and the loop is not
 * running then — so every caller pairs this with a `redraw` on each render.
 * That is one ref read per render against a permanent 60fps loop, and it is
 * the reason stopping is safe.
 */
import { readDspAnalysisLive, subscribeDspAnalysers } from './store';

/** Handed to `paint`, so it can ask for a frame the engine would not give. */
export interface IGraphLoopFrame {
  /**
   * Another frame regardless of the engine.
   *
   * For waiting on the document rather than on audio: a canvas that has not
   * been laid out yet measures zero and cannot be drawn into, and that
   * resolves on a later frame with or without a host. Without this the graphs
   * that mount inside a collapsing panel would stop before their first real
   * paint and stay blank.
   */
  schedule: () => void;
}

export interface IGraphLoop {
  /** Ask for one frame. A no-op while one is already pending. */
  schedule: () => void;
  /** Cancel any pending frame and let go of the registration listener. */
  stop: () => void;
}

export interface IGraphLoopOptions {
  /**
   * Run once each time the engine lets go, immediately before the last frame.
   *
   * For the cards that draw a time strip. Their rings are written one column
   * per sample interval, so a loop that stops and starts again later splices
   * two different moments together and presents the join as continuous — the
   * strip claims eight unbroken seconds of a past that has a hole in it.
   * Emptying the ring here means an engine that is not running draws as a
   * strip with nothing in it, which is what it is, and the display fills again
   * from the left when audio returns.
   */
  onEngineGone?: () => void;
}

export const startGraphLoop = (
  paint: (frame: IGraphLoopFrame) => void,
  options: IGraphLoopOptions = {},
): IGraphLoop => {
  let frame = 0;
  let stopped = false;
  let wasLive = readDspAnalysisLive();

  const schedule = () => {
    if (frame === 0 && !stopped) {
      frame = requestAnimationFrame(run);
    }
  };

  const handle: IGraphLoopFrame = { schedule };

  function run() {
    // Cleared before painting, not after, so a `schedule` from inside `paint`
    // is honoured instead of being swallowed as "one is already pending".
    frame = 0;
    paint(handle);
    if (readDspAnalysisLive()) {
      schedule();
    }
  }

  const unwatch = subscribeDspAnalysers(() => {
    const live = readDspAnalysisLive();
    if (wasLive && !live) {
      options.onEngineGone?.();
    }
    wasLive = live;
    // Both directions. Arriving restarts a stopped loop; leaving buys one last
    // frame, so the graph settles at rest rather than freezing on whatever the
    // host happened to send last.
    schedule();
  });

  schedule();

  return {
    schedule,
    stop: () => {
      stopped = true;
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      unwatch();
    },
  };
};
