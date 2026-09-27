/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  PerspectiveCamera,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import type { ISceneFrame, ISceneProgram } from '../sceneGl';
import { walkBands } from '../sceneStillBands';
import { FULL_VIEW, isFullView, panelSize } from '../sceneView';
import type { IWorldComposite } from './worldComposite';
import type { IWorldInputs } from './worldInputs';
import type { IWorldPass } from './worldPasses';
import type { IExternalTargets } from './worldRenderer';

/**
 * A built world's `draw`: what it does with a frame, once everything it is
 * made of exists (`worldProgram.ts`).
 *
 * A frame is the world rendered into its own targets — reflection, the world,
 * its glow — and then laid into whatever the worker left bound, inside the
 * scissor it left set, with the pack's shader as its sky. A still is the same
 * frame drawn a band at a time (`sceneStillKeep.ts`), and there two things
 * differ, both about what one job may ask of the GPU:
 *
 *  - the world is rendered ONCE for the whole walk, before its first band,
 *    because a band only lays down the finished picture; rendering the world
 *    for every band cost the world times the number of bands.
 *  - that one render is itself a walk of strips, each finished before the next
 *    is sent, sized by the same rules as the bands (`sceneStillBands.ts`).
 *    Rendered whole, the first band held the GPU for the entire world at full
 *    size in one job — the job the bands exist so that no scene can send,
 *    since Windows resets the display for every program when one runs about
 *    two seconds.
 */

export interface IWorldDrawParts {
  gl: WebGL2RenderingContext;
  renderer: WebGLRenderer;
  inputs: IWorldInputs;
  camera: PerspectiveCamera;
  /** Points the camera for a panel of this aspect. */
  aim(aspect: number): void;
  /** Moves every formula, copy and clip on by this many seconds. */
  advance(seconds: number): void;
  /** Sizes the world's targets and draws what the main pass reads: the reflection. */
  prepare(width: number, height: number): void;
  /** The world itself into its target, all of it or the rows given. */
  renderMain(strip?: { from: number; rows: number }): void;
  /** Its glow, and the mix's inputs for this frame. */
  finish(width: number, height: number): void;
  composite: IWorldComposite;
  pass: IWorldPass;
  /** The target that wraps the worker's framebuffer: never disposed. */
  shown: WebGLRenderTarget;
  external: IExternalTargets;
  /** Frees the pictures the next frame makes again (`rest`). */
  free(): void;
  release(): void;
}

const readback = new Uint8Array(4);

export const createWorldSceneProgram = (
  parts: IWorldDrawParts,
): ISceneProgram => {
  const { gl, renderer, inputs, camera, composite, pass, shown, external } =
    parts;
  let lastAccent = 0;
  /** The frame a still's walk rendered the world for, and at what size. */
  let still: { frame: ISceneFrame; width: number; height: number } | undefined;

  /** The world's inputs, camera and clocks moved to `frame`. */
  const stage = (frame: ISceneFrame, width: number, height: number) => {
    inputs.update(frame, width, height);
    // Framed on the panel, then widened to the canvas round it: under the
    // Backdrop the canvas is the window, the graph is still what the camera
    // frames, and the rest of the window is what it would see past the
    // graph's edges (`sceneView.ts`). Three's own sub-view, taken the other
    // way: the "full" frame is the panel and the canvas is larger than it.
    const view = frame.view ?? FULL_VIEW;
    const panel = panelSize(width, height, view);
    parts.aim(panel.width / panel.height);
    if (isFullView(view)) {
      if (camera.view?.enabled) {
        camera.clearViewOffset();
      }
    } else {
      camera.setViewOffset(
        panel.width,
        panel.height,
        -view[0] * width,
        -(1 - view[1] - view[3]) * height,
        width,
        height,
      );
    }
    parts.advance((frame.deltaMs ?? 0) / 1000);
  };

  return {
    draw: (frame, width, height) => {
      // A context gone mid-frame answers the reads below with null; the
      // shader's draw does nothing then, and neither does this.
      if (gl.isContextLost()) {
        return;
      }
      // What the worker left bound is where the picture belongs.
      const target = gl.getParameter(
        gl.FRAMEBUFFER_BINDING,
      ) as WebGLFramebuffer | null;
      const clipped = gl.isEnabled(gl.SCISSOR_TEST);
      const box = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
      renderer.resetState();

      [lastAccent] = frame.musicAccent;
      // Only a band of the still the world was rendered for reuses it. Any
      // other draw renders the world again — including the same frame drawn
      // again to be timed: reused, a walk after the first timed the sky
      // alone, and a heavy world read to the member's AI as cheap.
      const walking =
        still !== undefined &&
        still.frame === frame &&
        still.width === width &&
        still.height === height;
      if (!walking) {
        still = undefined;
        stage(frame, width, height);
        parts.prepare(width, height);
        parts.renderMain();
        parts.finish(width, height);
      }

      shown.viewport.set(0, 0, width, height);
      shown.scissor.set(box[0], box[1], box[2], box[3]);
      shown.scissorTest = clipped;
      external.point(shown, target);
      renderer.setRenderTarget(shown);
      pass.use(composite.material);
      renderer.render(pass.scene, pass.camera);

      // The context as the worker expects it: three's state gone, the
      // picture's target bound, its clip on.
      renderer.resetState();
      gl.bindFramebuffer(gl.FRAMEBUFFER, target);
      gl.viewport(0, 0, width, height);
      if (clipped) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(box[0], box[1], box[2], box[3]);
      }
    },
    prepareStill: (frame: ISceneFrame, width: number, height: number) => {
      let spentMs = 0;
      let longestMs = 0;
      if (gl.isContextLost()) {
        return { spentMs, longestMs };
      }
      const target = gl.getParameter(
        gl.FRAMEBUFFER_BINDING,
      ) as WebGLFramebuffer | null;
      const clipped = gl.isEnabled(gl.SCISSOR_TEST);
      const box = gl.getParameter(gl.SCISSOR_BOX) as Int32Array;
      renderer.resetState();
      const started = performance.now();
      stage(frame, width, height);
      parts.prepare(width, height);
      // The reflection and the shadows' first pass are one job each, before
      // the strips; the shadow maps are then kept for the rest of the walk.
      const shadows = renderer.shadowMap.autoUpdate;
      let first = true;
      const sync = () => {
        renderer.resetState();
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, readback);
      };
      sync();
      const setUp = performance.now() - started;
      spentMs += setUp;
      longestMs = Math.max(longestMs, setUp);
      try {
        walkBands(height, (from, rows) => {
          if (gl.isContextLost()) {
            return undefined;
          }
          const strip = performance.now();
          parts.renderMain({ from, rows });
          if (first) {
            renderer.shadowMap.autoUpdate = false;
            first = false;
          }
          sync();
          const took = performance.now() - strip;
          spentMs += took;
          longestMs = Math.max(longestMs, took);
          return took;
        });
      } finally {
        renderer.shadowMap.autoUpdate = shadows;
      }
      const finishing = performance.now();
      parts.finish(width, height);
      sync();
      const glow = performance.now() - finishing;
      spentMs += glow;
      longestMs = Math.max(longestMs, glow);
      still = { frame, width, height };

      gl.viewport(0, 0, width, height);
      if (clipped) {
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(box[0], box[1], box[2], box[3]);
      } else {
        gl.disable(gl.SCISSOR_TEST);
      }
      return { spentMs, longestMs };
    },
    isSettled: () => inputs.settled(),
    musicAccent: () => lastAccent,
    rest: () => {
      // Every picture drawn again each frame — the world's, its glow, its
      // reflection, three's own for glass — is made again by the next frame
      // at the size it kept, so the frame after a rest is the frame it would
      // have been.
      parts.free();
      still = undefined;
    },
    dispose: parts.release,
  };
};
