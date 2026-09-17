/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISceneCostReading } from './sceneHealth';

/**
 * What a scene's frames cost the GPU, without ever waiting for the GPU.
 *
 * The worker used to read one pixel back after every frame, which made the
 * thread wait for the GPU to finish it: an exact cost, at the price of the
 * next frame never being submitted until the last was drawn. At a display's
 * own rate that is the whole budget — a frame the GPU draws in 8 ms took a
 * 10 ms interval and the wait, and the next display frame had already gone
 * by. Nothing here waits. Every frame is followed by a fence, and where the
 * driver offers timer queries (`EXT_disjoint_timer_query_webgl2`: Direct3D on
 * Windows, Mesa on Linux) the frame's GL work is wrapped in them; both are
 * asked, on a later frame, whether they have finished.
 *
 * A frame is timed in two parts — the scene, and the finishing passes after
 * `mark` (`scenePost.ts`) — because the controller decides them differently:
 * the scene's cost falls with its size, the finishing's does not, and on a
 * weak GPU the finishing alone can be what does not fit.
 *
 * Three readings come out of it, for the resolution controller:
 *
 * - `costMs`: the GPU time of the newest finished frame, both parts, exact to
 *   the driver's clock. Absent when the driver has no timer queries, and on a
 *   frame whose queries were disturbed (the GPU was reset or shared).
 * - `postMs`: the finishing part of the same frame, when it was marked.
 * - `behind`: how many frames were still on the GPU when this one was about
 *   to be submitted. One means the GPU had not finished the previous frame by
 *   the next display frame — it is slower than the display, exact clock or
 *   not. Two is the pipeline's depth, and the worker skips the frame rather
 *   than queue a third: a queue is latency, and the controls would lag the
 *   music.
 */

/** Frames that may be on the GPU at once. */
export const SCENE_FRAMES_IN_FLIGHT = 2;

export interface ISceneGpuClock {
  /** Around one frame's GL work. `end` submits the fence. */
  begin(): void;
  /** The scene is drawn; what follows is finishing. */
  mark(): void;
  end(): void;
  /**
   * Retires every frame the GPU has finished and answers the reading for the
   * frame about to be drawn: the newest finished cost, and how many frames
   * are still in flight.
   */
  poll(now: number): ISceneCostReading;
  /** How long the oldest frame still in flight has been on the GPU. */
  oldestInFlightMs(now: number): number;
  dispose(): void;
}

interface IInFlight {
  sync: WebGLSync;
  scene: WebGLQuery | null;
  post: WebGLQuery | null;
  submittedAt: number;
}

interface ITimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

export const createSceneGpuClock = (
  gl: WebGL2RenderingContext,
): ISceneGpuClock => {
  const timer = gl.getExtension(
    'EXT_disjoint_timer_query_webgl2',
  ) as ITimerExtension | null;
  const inFlight: IInFlight[] = [];
  const spareQueries: WebGLQuery[] = [];
  let scene: WebGLQuery | null = null;
  let post: WebGLQuery | null = null;
  let open = false;

  const takeQuery = (): WebGLQuery | null => {
    if (!timer) {
      return null;
    }
    return spareQueries.pop() ?? gl.createQuery();
  };

  const startQuery = (): WebGLQuery | null => {
    const query = takeQuery();
    if (query && timer) {
      gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
      open = true;
    }
    return query;
  };

  const stopQuery = () => {
    if (open && timer) {
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      open = false;
    }
  };

  const retire = ({ sync, scene: sceneQuery, post: postQuery }: IInFlight) => {
    gl.deleteSync(sync);
    if (sceneQuery) {
      spareQueries.push(sceneQuery);
    }
    if (postQuery) {
      spareQueries.push(postQuery);
    }
  };

  const available = (query: WebGLQuery | null) =>
    query === null ||
    Boolean(gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE));

  const readMs = (query: WebGLQuery | null): number =>
    query === null
      ? 0
      : Number(gl.getQueryParameter(query, gl.QUERY_RESULT)) / 1e6;

  return {
    begin: () => {
      scene = startQuery();
      post = null;
    },
    mark: () => {
      stopQuery();
      post = startQuery();
    },
    end: () => {
      stopQuery();
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      // A fence is queued behind the frame; flushed, or the driver may hold
      // the whole frame back until the buffer fills.
      gl.flush();
      if (sync) {
        inFlight.push({ sync, scene, post, submittedAt: performance.now() });
      }
      scene = null;
      post = null;
    },
    poll: () => {
      let costMs: number | undefined;
      let postMs: number | undefined;
      // A disturbed clock makes every pending query's answer meaningless, and
      // reading the flag clears it — so it is read once per poll, first.
      const disjoint = timer
        ? Boolean(gl.getParameter(timer.GPU_DISJOINT_EXT))
        : false;
      while (inFlight.length > 0) {
        const oldest = inFlight[0];
        if (gl.getSyncParameter(oldest.sync, gl.SYNC_STATUS) !== gl.SIGNALED) {
          break;
        }
        // Finished on the GPU, but the answers become readable only once a
        // task boundary has passed since the queries ended; until then the
        // frame is kept, and asked again on the next poll.
        if (!available(oldest.scene) || !available(oldest.post)) {
          break;
        }
        if (!disjoint && oldest.scene) {
          const finishing = oldest.post ? readMs(oldest.post) : undefined;
          costMs = readMs(oldest.scene) + (finishing ?? 0);
          postMs = finishing;
        }
        inFlight.shift();
        retire(oldest);
      }
      return { costMs, postMs, behind: inFlight.length };
    },
    oldestInFlightMs: (now) =>
      inFlight.length > 0 ? now - inFlight[0].submittedAt : 0,
    dispose: () => {
      inFlight.forEach(retire);
      inFlight.length = 0;
      spareQueries.forEach((query) => gl.deleteQuery(query));
      spareQueries.length = 0;
      [scene, post].forEach((query) => {
        if (query) {
          gl.deleteQuery(query);
        }
      });
      scene = null;
      post = null;
    },
  };
};
