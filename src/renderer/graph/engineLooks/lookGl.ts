/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_VERTEX_SOURCE } from 'common/sceneUniformContract';
import type { IEngineLookHistory, IEngineLookInput } from './engineLookInput';
import { createLookLines, type ILookLines } from './lookLines';
import { createLookStrokes, type ILookStrokes } from './lookStrokes';
import { createLookSprites, type ILookSprites } from './lookSprites';

/**
 * The GL side of FluidEQ's own looks, beside the scene program they are
 * (`sceneGl.ts`): their layout uploaded, and their bloom drawn.
 *
 * THE BLOOM IS THE 2D LOOKS' OWN (`sceneBloom.ts`), done where it is cheap.
 * There the lit shapes were drawn again on a canvas an eighth of the window's
 * size, blurred by two pixels and added back over the picture, and the blur
 * was a CSS filter run on the page's canvas every frame. Here the look's own
 * shader draws the same shapes (`uLookPass` 1) on a target an eighth of the
 * look's size, which is blurred there by the same two pixels in two passes of
 * nine taps and added back by the picture itself (`uLookBloom`): a sixty-
 * fourth of the pixels, three small draws.
 *
 * Everything the worker had bound — its framebuffer, viewport, scissor and
 * blending — is put back before the picture is drawn, so the finishing chain
 * after it (`scenePost.ts`) finds the context as a plain scene leaves it.
 *
 * NOT UNIT-TESTED, like `sceneGl.ts`, and for its reason: verified in the
 * window.
 */

/** The bloom target against the look, and the blur there. */
const BLOOM_SCALE = 1 / 8;

// A Gaussian of about two texels in nine taps, four of them bilinear pairs:
// the blur(2px) the 2D bloom canvas is given.
const BLUR_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uSource;
uniform vec2 uStep;
in vec2 vUv;
out vec4 fragColor;
void main() {
  vec4 sum = texture(uSource, vUv) * 0.2270270270;
  sum += texture(uSource, vUv + uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv - uStep * 1.3846153846) * 0.3162162162;
  sum += texture(uSource, vUv + uStep * 3.2307692308) * 0.0702702703;
  sum += texture(uSource, vUv - uStep * 3.2307692308) * 0.0702702703;
  fragColor = sum;
}
`;

/**
 * Texture units, clear of the scene's own (0 to 3), of the sprites' (7) and
 * of each other.
 */
const DATA_UNIT = 4;
const BLOOM_UNIT = 5;
const BLUR_UNIT = 6;
const HISTORY_UNIT = 8;
const LINES_UNIT = 9;
const STROKES_UNIT = 12;

export interface ILookGl {
  /**
   * Uploads this frame's look and draws the picture: the bloom first when the
   * look has one, then the picture over the target the worker bound.
   */
  draw(
    input: IEngineLookInput,
    panel: { width: number; height: number },
    resolution: WebGLUniformLocation | null,
  ): void;
  dispose(): void;
}

const compile = (
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
};

/** The blur, compiled and linked where it is made: two dozen lines of GLSL. */
const createBlurProgram = (gl: WebGL2RenderingContext): WebGLProgram | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, SCENE_VERTEX_SOURCE);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, BLUR_SOURCE);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) {
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    gl.deleteProgram(program);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

interface ITarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
}

const createTarget = (gl: WebGL2RenderingContext): ITarget | null => {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    return null;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, framebuffer };
};

/** `target` resized to `width` by `height`, bound as the framebuffer drawn to. */
const sizeTarget = (
  gl: WebGL2RenderingContext,
  target: ITarget,
  width: number,
  height: number,
): void => {
  gl.bindTexture(gl.TEXTURE_2D, target.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA8,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    target.texture,
    0,
  );
};

/**
 * The look side of `program`, or nothing for a program that is not one of
 * FluidEQ's own looks — a Plus scene, a member's — which never declares
 * `uLookData`.
 */
export const createLookGl = (
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
): ILookGl | undefined => {
  const dataAt = gl.getUniformLocation(program, 'uLookData');
  if (!dataAt) {
    return undefined;
  }
  const vectorsAt = gl.getUniformLocation(program, 'uLook');
  const inksAt = gl.getUniformLocation(program, 'uInk');
  const inkCountAt = gl.getUniformLocation(program, 'uInkCount');
  // Only the measuring views declare the second ramp (`analysisGlsl.ts`).
  const mateInksAt = gl.getUniformLocation(program, 'uInkMate');
  const mateInkCountAt = gl.getUniformLocation(program, 'uInkMateCount');
  const passAt = gl.getUniformLocation(program, 'uLookPass');
  const bloomAt = gl.getUniformLocation(program, 'uLookBloom');
  const strengthAt = gl.getUniformLocation(program, 'uLookBloomStrength');

  const data = gl.createTexture();
  if (!data) {
    return undefined;
  }
  gl.bindTexture(gl.TEXTURE_2D, data);
  // Float texels are read with texelFetch, never filtered: RGBA32F is not
  // filterable without an extension, and a layout is not something to blend.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let dataSize = '';

  // The bloom's parts, made on the first frame that blooms: a look drawn
  // without glow never builds them.
  let blur: WebGLProgram | null | undefined;
  let blurSourceAt: WebGLUniformLocation | null = null;
  let blurStepAt: WebGLUniformLocation | null = null;
  let front: ITarget | null = null;
  let back: ITarget | null = null;
  let bloomSize = '';
  // The sprites' program, made on the first frame that draws any.
  let sprites: ILookSprites | null | undefined;

  // The free-drawn lines, for the look that declares them, made on the first
  // frame that has any (`IEngineLookLines`).
  const linesAt = gl.getUniformLocation(program, 'uLookLines');
  let lines: ILookLines | null | undefined;
  // The strokes in their own colours, likewise (`IEngineLookStrokes`).
  const strokesAt = gl.getUniformLocation(program, 'uLookStrokes');
  let strokes: ILookStrokes | null | undefined;

  // The kept picture, for the look that declares one (`IEngineLookHistory`):
  // which picture it holds, and how many rows of each strip it has printed.
  const historyAt = gl.getUniformLocation(program, 'uLookHistory');
  let history: WebGLTexture | null = null;
  let historyKey = '';
  let historyPrinted: number[] = [];

  const uploadHistory = (kept: IEngineLookHistory) => {
    if (!historyAt) {
      return;
    }
    gl.activeTexture(gl.TEXTURE0 + HISTORY_UNIT);
    if (!history) {
      history = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, history);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, history);
    const { width, rows, strips, printed, latest } = kept;
    const key = `${kept.key}|${width}x${rows}x${strips}`;
    if (key !== historyKey) {
      // A new picture starts empty, as the page's own starts transparent:
      // a texture given no data is all zeros.
      historyKey = key;
      historyPrinted = printed.map(() => 0);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        width,
        rows * strips,
        0,
        gl.RGBA,
        gl.FLOAT,
        null,
      );
    }
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    printed.forEach((count, strip) => {
      const seen = Math.min(historyPrinted[strip] ?? 0, count);
      const row = latest.subarray(strip * width * 4, (strip + 1) * width * 4);
      // Only the last ring's worth of rows can still be on the picture.
      for (
        let next = Math.max(seen + 1, count - rows + 1);
        next <= count;
        next += 1
      ) {
        gl.texSubImage2D(
          gl.TEXTURE_2D,
          0,
          0,
          strip * rows + (next % rows),
          width,
          1,
          gl.RGBA,
          gl.FLOAT,
          row,
        );
      }
      historyPrinted[strip] = count;
    });
    gl.uniform1i(historyAt, HISTORY_UNIT);
  };

  const buildBloom = (): boolean => {
    if (blur === undefined) {
      blur = createBlurProgram(gl);
      front = createTarget(gl);
      back = createTarget(gl);
      if (blur) {
        blurSourceAt = gl.getUniformLocation(blur, 'uSource');
        blurStepAt = gl.getUniformLocation(blur, 'uStep');
      }
    }
    return blur !== null && front !== null && back !== null;
  };

  const upload = (input: IEngineLookInput) => {
    gl.activeTexture(gl.TEXTURE0 + DATA_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    const size = `${input.width}x${input.rows}`;
    if (size !== dataSize) {
      dataSize = size;
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA32F,
        input.width,
        input.rows,
        0,
        gl.RGBA,
        gl.FLOAT,
        input.data,
      );
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        input.width,
        input.rows,
        gl.RGBA,
        gl.FLOAT,
        input.data,
      );
    }
    gl.uniform1i(dataAt, DATA_UNIT);
    gl.uniform4fv(vectorsAt, input.vectors);
    gl.uniform3fv(inksAt, input.inks);
    gl.uniform1i(inkCountAt, input.inkCount);
    if (mateInksAt) {
      gl.uniform3fv(mateInksAt, input.mateInks);
      gl.uniform1i(mateInkCountAt, input.mateInkCount);
    }
    if (input.history) {
      uploadHistory(input.history);
    }
  };

  /** The lit shapes, small, blurred: left in `front`'s texture. */
  const drawBloom = (
    input: IEngineLookInput,
    resolution: WebGLUniformLocation | null,
  ) => {
    if (!blur || !front || !back) {
      return;
    }
    const width = Math.max(1, Math.round(input.vectors[0] * BLOOM_SCALE));
    const height = Math.max(1, Math.round(input.vectors[1] * BLOOM_SCALE));
    const size = `${width}x${height}`;
    if (size !== bloomSize) {
      bloomSize = size;
      sizeTarget(gl, front, width, height);
      sizeTarget(gl, back, width, height);
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    // Last frame's bloom is still bound where the picture reads it, and the
    // look's own program is about to draw into it: WebGL refuses a draw whose
    // program has a sampler on the texture being drawn to — sampled or not —
    // and the bloom came out empty. Unbound first.
    gl.activeTexture(gl.TEXTURE0 + BLOOM_UNIT);
    gl.bindTexture(gl.TEXTURE_2D, null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, front.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(passAt, 1);
    gl.uniform2f(resolution, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(blur);
    gl.activeTexture(gl.TEXTURE0 + BLUR_UNIT);
    gl.uniform1i(blurSourceAt, BLUR_UNIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, back.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, front.texture);
    gl.uniform2f(blurStepAt, 1 / width, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, front.framebuffer);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindTexture(gl.TEXTURE_2D, back.texture);
    gl.uniform2f(blurStepAt, 0, 1 / height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    draw: (input, panel, resolution) => {
      upload(input);
      if (linesAt && input.lines) {
        lines ??= createLookLines(gl);
        lines?.draw(
          input.lines,
          { width: input.vectors[0], height: input.vectors[1] },
          Math.max(1, Math.round(panel.width)),
          Math.max(1, Math.round(panel.height)),
          LINES_UNIT,
        );
        gl.uniform1i(linesAt, LINES_UNIT);
      }
      if (strokesAt && input.strokes) {
        strokes ??= createLookStrokes(gl);
        strokes?.draw(
          input.strokes,
          { width: input.vectors[0], height: input.vectors[1] },
          Math.max(1, Math.round(panel.width)),
          Math.max(1, Math.round(panel.height)),
          STROKES_UNIT,
        );
        gl.uniform1i(strokesAt, STROKES_UNIT);
      }
      const blooms =
        input.bloom > 0 && passAt !== null && bloomAt !== null && buildBloom();
      if (blooms && front) {
        const target = gl.getParameter(
          gl.FRAMEBUFFER_BINDING,
        ) as WebGLFramebuffer | null;
        const viewport = gl.getParameter(gl.VIEWPORT) as Int32Array;
        const scissored = gl.isEnabled(gl.SCISSOR_TEST);
        const blended = gl.isEnabled(gl.BLEND);
        gl.disable(gl.SCISSOR_TEST);
        gl.disable(gl.BLEND);
        drawBloom(input, resolution);
        gl.useProgram(program);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target);
        gl.viewport(viewport[0], viewport[1], viewport[2], viewport[3]);
        if (scissored) {
          gl.enable(gl.SCISSOR_TEST);
        }
        if (blended) {
          gl.enable(gl.BLEND);
        }
        gl.uniform2f(resolution, panel.width, panel.height);
        gl.activeTexture(gl.TEXTURE0 + BLOOM_UNIT);
        gl.bindTexture(gl.TEXTURE_2D, front.texture);
      }
      gl.uniform1i(bloomAt, BLOOM_UNIT);
      gl.uniform1f(passAt, 0);
      gl.uniform1f(strengthAt, blooms ? input.bloom : 0);
      if (input.spriteCount > 0) {
        sprites ??= createLookSprites(gl);
      }
      const under = sprites
        ? Math.min(input.spritesUnder, input.spriteCount)
        : 0;
      if (under > 0 && sprites) {
        // Scenery first, on a cleared target, and the picture laid over it:
        // the picture alone replaces every pixel, which would take the
        // scenery with it.
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        sprites.draw(input, panel, 0, under);
        gl.useProgram(program);
        const blended = gl.isEnabled(gl.BLEND);
        const factors = [
          gl.BLEND_SRC_RGB,
          gl.BLEND_DST_RGB,
          gl.BLEND_SRC_ALPHA,
          gl.BLEND_DST_ALPHA,
        ].map((name) => gl.getParameter(name) as number);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.blendFuncSeparate(factors[0], factors[1], factors[2], factors[3]);
        if (!blended) {
          gl.disable(gl.BLEND);
        }
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      if (sprites && input.spriteCount > under) {
        sprites.draw(input, panel, under, input.spriteCount - under);
      }
    },
    dispose: () => {
      sprites?.dispose();
      lines?.dispose();
      strokes?.dispose();
      gl.deleteTexture(data);
      gl.deleteTexture(history);
      if (blur) {
        gl.deleteProgram(blur);
      }
      [front, back].forEach((target) => {
        if (target) {
          gl.deleteTexture(target.texture);
          gl.deleteFramebuffer(target.framebuffer);
        }
      });
    },
  };
};
