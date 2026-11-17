/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { meanRelativeLuminance, type TSceneProbeRect } from './sceneHeadInk';

/**
 * How bright the picture is behind the EQ head, read on the scene worker's
 * own frames without ever making the worker wait for the GPU.
 *
 * The strip is shrunk on the GPU to `PROBE_WIDTH × PROBE_HEIGHT` by a linear
 * blit from the canvas's own picture, read into a pixel buffer behind a
 * fence, and collected on a later frame once the fence has signalled — a
 * kilobyte, never the frame. Reading a pixel straight back, which this
 * worker once did after every frame, made the GPU and the worker take turns
 * (`sceneRenderer.worker.ts`); a pixel buffer behind a fence costs neither of
 * them a wait, and one read in flight at a time is all there ever is.
 *
 * NOT UNIT-TESTED for the reason `sceneGl.ts` gives: jsdom has no WebGL. The
 * arithmetic it hands on is `sceneHeadInk.ts`'s, which is.
 */

/**
 * The strip shrunk to this many pixels. Each is a bilinear tap of four
 * pixels of the picture, so 256 of them read 1024 points spread over the
 * whole strip — a mean that a sky, a skyline or a sun in a corner moves, for
 * a kilobyte read back.
 */
const PROBE_WIDTH = 64;
const PROBE_HEIGHT = 4;
const PROBE_BYTES = PROBE_WIDTH * PROBE_HEIGHT * 4;

/**
 * Drawn frames between reads. By frames, not by time: a read is a fraction
 * of a frame's own work wherever it lands, and what follows it smooths over
 * whatever rate the display runs at (`HEAD_INK_SMOOTHING`) — about seven
 * reads a second at 60 Hz.
 */
export const PROBE_EVERY_FRAMES = 8;

export interface ISceneProbe {
  /**
   * Starts a read of `rect` from the picture just drawn on the canvas's own
   * framebuffer, `width × height` pixels, unless one is still in flight.
   */
  read(rect: TSceneProbeRect, width: number, height: number): void;
  /** The finished read's mean luminance, once its fence has signalled. */
  collect(): number | undefined;
  dispose(): void;
}

const pixelBox = (
  rect: TSceneProbeRect,
  width: number,
  height: number,
): [number, number, number, number] | undefined => {
  const [left, top, right, bottom] = rect;
  const x0 = Math.max(0, Math.floor(left * width));
  const x1 = Math.min(width, Math.ceil(right * width));
  // GL counts rows from the bottom.
  const y0 = Math.max(0, height - Math.ceil(bottom * height));
  const y1 = Math.min(height, height - Math.floor(top * height));
  return x1 > x0 && y1 > y0 ? [x0, y0, x1, y1] : undefined;
};

/** A probe on `gl`, or undefined where the context will not make one. */
const createSceneProbe = (
  gl: WebGL2RenderingContext,
): ISceneProbe | undefined => {
  const target = gl.createRenderbuffer();
  const framebuffer = gl.createFramebuffer();
  const buffer = gl.createBuffer();
  const free = () => {
    gl.deleteRenderbuffer(target);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteBuffer(buffer);
  };
  if (!target || !framebuffer || !buffer) {
    free();
    return undefined;
  }
  gl.bindRenderbuffer(gl.RENDERBUFFER, target);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, PROBE_WIDTH, PROBE_HEIGHT);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
  gl.framebufferRenderbuffer(
    gl.DRAW_FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.RENDERBUFFER,
    target,
  );
  const complete =
    gl.checkFramebufferStatus(gl.DRAW_FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  if (!complete) {
    free();
    return undefined;
  }
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
  gl.bufferData(gl.PIXEL_PACK_BUFFER, PROBE_BYTES, gl.STREAM_READ);
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

  const pixels = new Uint8Array(PROBE_BYTES);
  let fence: WebGLSync | null = null;

  return {
    read: (rect, width, height) => {
      const box = pixelBox(rect, width, height);
      if (fence || !box) {
        return;
      }
      // The blit is cut by the scissor like any draw; the frame's own
      // scissor goes back as it was found.
      const scissored = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
      gl.blitFramebuffer(
        ...box,
        0,
        0,
        PROBE_WIDTH,
        PROBE_HEIGHT,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      );
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.readPixels(
        0,
        0,
        PROBE_WIDTH,
        PROBE_HEIGHT,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        0,
      );
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (scissored) {
        gl.enable(gl.SCISSOR_TEST);
      }
      fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    },
    collect: () => {
      // WebGL updates a fence's status only between tasks, so it is asked
      // on a later frame, never waited on in this one.
      if (
        !fence ||
        gl.getSyncParameter(fence, gl.SYNC_STATUS) !== gl.SIGNALED
      ) {
        return undefined;
      }
      gl.deleteSync(fence);
      fence = null;
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return meanRelativeLuminance(pixels);
    },
    dispose: () => {
      if (fence) {
        gl.deleteSync(fence);
        fence = null;
      }
      free();
    },
  };
};

/**
 * The scene worker's side of it: what to read, when, and the probe on the
 * worker's current context. Asked after every drawn frame; reads every
 * `PROBE_EVERY_FRAMES` while a strip is asked for, and hands each finished
 * reading to `heard`.
 */
export const createSceneProbing = (heard: (luminance: number) => void) => {
  let rect: TSceneProbeRect | null = null;
  let probe: ISceneProbe | null | undefined;
  let frames = 0;
  return {
    /** The strip to read from now on; null stops reading. */
    ask: (next: TSceneProbeRect | null) => {
      rect = next;
      frames = 0;
    },
    /** A frame of `width × height` has just been drawn on the canvas. */
    drew: (gl: WebGL2RenderingContext, width: number, height: number) => {
      if (!rect) {
        return;
      }
      // Made once per context; null once the context has refused it.
      probe ??= createSceneProbe(gl) ?? null;
      if (!probe) {
        return;
      }
      const luminance = probe.collect();
      if (luminance !== undefined) {
        heard(luminance);
      }
      frames += 1;
      if (frames >= PROBE_EVERY_FRAMES) {
        frames = 0;
        probe.read(rect, width, height);
      }
    },
    /** The context went, and its objects with it. */
    lost: () => {
      probe = undefined;
    },
    dispose: () => {
      probe?.dispose();
      probe = undefined;
    },
  };
};
