/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { meanRelativeLuminance, type TSceneProbeRect } from './sceneInk';

/**
 * How bright the picture is behind the words that stand on it — the EQ head,
 * each of the graph's figures — read on the scene worker's own frames
 * without ever making the worker wait for the GPU.
 *
 * Each place is shrunk on the GPU to a block of `BLOCK_WIDTH × BLOCK_HEIGHT`
 * by a linear blit from the canvas's own picture, the blocks stacked in one
 * small target, read into a pixel buffer behind a fence and collected on a
 * later frame once the fence has signalled — a few kilobytes, never the
 * frame. Reading a pixel straight back, which this worker once did after
 * every frame, made the GPU and the worker take turns
 * (`sceneRenderer.worker.ts`); a pixel buffer behind a fence costs neither of
 * them a wait, and one read in flight at a time is all there ever is.
 *
 * NOT UNIT-TESTED for the reason `sceneGl.ts` gives: jsdom has no WebGL. The
 * arithmetic it hands on is `sceneInk.ts`'s, which is.
 */

/**
 * Each place shrunk to this many pixels, every one a bilinear tap of four
 * pixels of the picture: 512 points over the head's whole strip, and nearly
 * every pixel behind a figure 40 by 16.
 */
const BLOCK_WIDTH = 32;
const BLOCK_HEIGHT = 4;
const BLOCK_BYTES = BLOCK_WIDTH * BLOCK_HEIGHT * 4;

/**
 * The most places read at once: the head and the figures of three axes,
 * with room to spare. More are left unread rather than grow the target.
 */
export const PROBE_MAX_PLACES = 48;

/**
 * Drawn frames between reads. By frames, not by time: a read is a fraction
 * of a frame's own work wherever it lands, and what follows it smooths over
 * whatever rate the display runs at (`SCENE_INK_SMOOTHING`) — about seven
 * reads a second at 60 Hz.
 */
export const PROBE_EVERY_FRAMES = 8;

interface ISceneProbe {
  /**
   * Starts a read of `rects` from the picture just drawn on the canvas's own
   * framebuffer, `width × height` pixels, unless one is still in flight.
   * Answers whether it started.
   */
  read(
    rects: readonly TSceneProbeRect[],
    width: number,
    height: number,
  ): boolean;
  /**
   * The finished read's mean luminance for each place, in the order asked —
   * NaN for a place off the canvas — once its fence has signalled.
   */
  collect(): number[] | undefined;
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
  gl.renderbufferStorage(
    gl.RENDERBUFFER,
    gl.RGBA8,
    BLOCK_WIDTH,
    BLOCK_HEIGHT * PROBE_MAX_PLACES,
  );
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
  gl.bufferData(
    gl.PIXEL_PACK_BUFFER,
    BLOCK_BYTES * PROBE_MAX_PLACES,
    gl.STREAM_READ,
  );
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);

  const pixels = new Uint8Array(BLOCK_BYTES * PROBE_MAX_PLACES);
  let fence: WebGLSync | null = null;
  /** Which places the read in flight holds, by their place in the ask. */
  let read: boolean[] = [];

  return {
    read: (rects, width, height) => {
      if (fence) {
        return false;
      }
      const boxes = rects
        .slice(0, PROBE_MAX_PLACES)
        .map((rect) => pixelBox(rect, width, height));
      read = boxes.map((box) => box !== undefined);
      // The blit is cut by the scissor like any draw; the frame's own
      // scissor goes back as it was found.
      const scissored = gl.isEnabled(gl.SCISSOR_TEST);
      gl.disable(gl.SCISSOR_TEST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, framebuffer);
      boxes.forEach((box, place) => {
        if (box) {
          const top = place * BLOCK_HEIGHT;
          gl.blitFramebuffer(
            ...box,
            0,
            top,
            BLOCK_WIDTH,
            top + BLOCK_HEIGHT,
            gl.COLOR_BUFFER_BIT,
            gl.LINEAR,
          );
        }
      });
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, framebuffer);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.readPixels(
        0,
        0,
        BLOCK_WIDTH,
        BLOCK_HEIGHT * Math.max(1, boxes.length),
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
      return true;
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
      const bytes = BLOCK_BYTES * Math.max(1, read.length);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buffer);
      gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, pixels, 0, bytes);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      return read.map((held, place) =>
        held
          ? meanRelativeLuminance(
              pixels.subarray(place * BLOCK_BYTES, (place + 1) * BLOCK_BYTES),
            )
          : Number.NaN,
      );
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
 * `PROBE_EVERY_FRAMES` while there are places to read, and hands each
 * finished reading to `heard` with the id of the ask it was read for, so the
 * page never pins a reading on places that have moved since.
 */
export const createSceneProbing = (
  heard: (id: number, luminances: number[]) => void,
) => {
  let asked: { id: number; rects: readonly TSceneProbeRect[] } | undefined;
  /** The ask the read in flight was made for. */
  let inFlight = 0;
  let probe: ISceneProbe | null | undefined;
  let frames = 0;
  return {
    /** The places to read from now on; none stops reading. */
    ask: (id: number, rects: readonly TSceneProbeRect[]) => {
      asked = rects.length > 0 ? { id, rects } : undefined;
      frames = 0;
    },
    /** A frame of `width × height` has just been drawn on the canvas. */
    drew: (gl: WebGL2RenderingContext, width: number, height: number) => {
      if (!asked) {
        return;
      }
      // Made once per context; null once the context has refused it.
      probe ??= createSceneProbe(gl) ?? null;
      if (!probe) {
        return;
      }
      const luminances = probe.collect();
      if (luminances) {
        heard(inFlight, luminances);
      }
      frames += 1;
      if (
        frames >= PROBE_EVERY_FRAMES &&
        probe.read(asked.rects, width, height)
      ) {
        frames = 0;
        inFlight = asked.id;
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
