/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

The FXAA pass in this file is ported from NVIDIA FXAA 3.11 by Timothy Lottes
(Fxaa3_11.h, quality preset 12), Copyright (c) 2014, NVIDIA CORPORATION, used
under its three-clause BSD licence, reproduced in assets/licenses/
THIRD-PARTY-NOTICES.txt. NVIDIA's own repository for it has since gone; the
copy ported carries NVIDIA's header intact and is the one Intel ships inside
its CMAA2 sample.
*/

import { createFsrPasses, type IFsrPasses } from './sceneUpscale';
import { linkPostProgram, type IPostPass } from './scenePostPass';

/**
 * How a scene's picture is finished between the size it was drawn at and the
 * canvas: brought up to size, averaged down, and smoothed.
 *
 * The scene draws into `input`, a target of its own size. `present` then runs
 * whichever passes the sizes and the listener's choices ask for:
 *
 * - Drawn smaller than the panel and the sharp scaler chosen: AMD's FSR
 *   (`sceneUpscale.ts`), EASU then RCAS, up to the panel's pixels.
 * - Drawn smaller with the plain scaler: nothing here at all; the canvas
 *   stays small and the compositor stretches it, which costs the GPU nothing
 *   — on the integrated chip of a laptop the FSR passes alone were 13 ms at
 *   4K, more than a light scene at half size.
 * - Drawn larger than the panel (`best` smoothing): four bilinear taps over
 *   the footprint of each pixel, averaged — supersampling, the anti-aliasing
 *   that also calms a shader's own shimmer, which no edge filter can.
 * - Smoothing on: FXAA over what the passes above produced, at the size the
 *   canvas shows. Fast, and what `fast` means.
 *
 * Every pass into an intermediate runs unclipped: FXAA reads a dozen pixels
 * along an edge, and a neighbour just outside the clip must be this frame's.
 * Only the last pass, onto the canvas, honours the clip.
 *
 * NOT UNIT-TESTED beyond `presentPlan`, for the same reason as `sceneGl.ts`:
 * jsdom has no WebGL. Measured in headless Chrome on every FluidEQ scene.
 */

export interface IPresentOptions {
  /** The pixels the scene was drawn at. */
  drawnWidth: number;
  drawnHeight: number;
  /** The canvas's pixels: what the listener sees before the compositor. */
  canvasWidth: number;
  canvasHeight: number;
  /** Bring a smaller picture up with FSR; otherwise the canvas is left small. */
  fsr: boolean;
  fxaa: boolean;
  /** [x, y, w, h] on the canvas: the part of the panel on screen. */
  scissor: readonly [number, number, number, number];
}

export type TPresentStep = 'fsr' | 'downsample' | 'fxaa' | 'copy';

/**
 * The passes `present` runs for these sizes and choices, in order. Pure, so a
 * test can hold the chain's shape without a GPU.
 */
export const presentPlan = ({
  drawnWidth,
  drawnHeight,
  canvasWidth,
  canvasHeight,
  fsr,
  fxaa,
}: Omit<IPresentOptions, 'scissor'>): TPresentStep[] => {
  const steps: TPresentStep[] = [];
  const larger = drawnWidth > canvasWidth || drawnHeight > canvasHeight;
  const smaller = drawnWidth < canvasWidth || drawnHeight < canvasHeight;
  if (larger) {
    steps.push('downsample');
  } else if (smaller && fsr) {
    steps.push('fsr');
  }
  if (fxaa) {
    steps.push('fxaa');
  } else if (steps.length === 0) {
    steps.push('copy');
  }
  return steps;
};

/**
 * Whether `present` has anything to do at all: with nothing to scale and no
 * smoothing, the scene draws straight onto the canvas and this is not used.
 */
export const needsPresent = (
  options: Omit<IPresentOptions, 'scissor'>,
): boolean => presentPlan(options).some((step) => step !== 'copy');

const DOWNSAMPLE_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uInput;
// Input texels per output pixel, each way.
uniform vec2 uStep;
out vec4 fragColor;
void main() {
  vec2 size = vec2(textureSize(uInput, 0));
  vec2 centre = gl_FragCoord.xy * uStep;
  vec2 reach = uStep * 0.25;
  // Four bilinear taps a quarter of the footprint from its centre: each one
  // averages a 2x2 of texels, so together they weigh the whole footprint
  // with a gentle tent, which is what an averaged-down picture should be.
  vec4 sum = textureLod(uInput, (centre + vec2(-reach.x, -reach.y)) / size, 0.0)
           + textureLod(uInput, (centre + vec2( reach.x, -reach.y)) / size, 0.0)
           + textureLod(uInput, (centre + vec2(-reach.x,  reach.y)) / size, 0.0)
           + textureLod(uInput, (centre + vec2( reach.x,  reach.y)) / size, 0.0);
  fragColor = sum * 0.25;
}
`;

const COPY_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uInput;
out vec4 fragColor;
void main() {
  fragColor = texelFetch(uInput, ivec2(gl_FragCoord.xy), 0);
}
`;

/**
 * FXAA 3.11, quality preset 12: five search steps of 1, 1.5, 2, 4 and 12
 * pixels along each side of an edge. The reference's defaults: sub-pixel
 * removal 0.75, edge threshold 0.166, dark threshold 0.0833. Luma is computed
 * from the colour, since the picture carries a real alpha rather than a
 * luma channel; the reference's texture reads are the sampler's own bilinear
 * ones, which the search relies on.
 */
const FXAA_SOURCE = `#version 300 es
precision highp float;
uniform sampler2D uInput;
uniform vec2 uRcpFrame;
out vec4 fragColor;

const float SUBPIX = 0.75;
const float EDGE_THRESHOLD = 0.166;
const float EDGE_THRESHOLD_MIN = 0.0833;

float lumaOf(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}
vec4 top(vec2 p) {
  return textureLod(uInput, p, 0.0);
}
float lumaTop(vec2 p) {
  return lumaOf(top(p).rgb);
}

void main() {
  vec2 posM = gl_FragCoord.xy * uRcpFrame;
  vec4 rgbaM = top(posM);
  float lumaM = lumaOf(rgbaM.rgb);
  float lumaS = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(0, 1)).rgb);
  float lumaE = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(1, 0)).rgb);
  float lumaN = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(0, -1)).rgb);
  float lumaW = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(-1, 0)).rgb);

  float maxSM = max(lumaS, lumaM);
  float minSM = min(lumaS, lumaM);
  float maxESM = max(lumaE, maxSM);
  float minESM = min(lumaE, minSM);
  float maxWN = max(lumaN, lumaW);
  float minWN = min(lumaN, lumaW);
  float rangeMax = max(maxWN, maxESM);
  float rangeMin = min(minWN, minESM);
  float rangeMaxScaled = rangeMax * EDGE_THRESHOLD;
  float range = rangeMax - rangeMin;
  float rangeMaxClamped = max(EDGE_THRESHOLD_MIN, rangeMaxScaled);
  if (range < rangeMaxClamped) {
    fragColor = rgbaM;
    return;
  }

  float lumaNW = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(-1, -1)).rgb);
  float lumaSE = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(1, 1)).rgb);
  float lumaNE = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(1, -1)).rgb);
  float lumaSW = lumaOf(textureLodOffset(uInput, posM, 0.0, ivec2(-1, 1)).rgb);

  float lumaNS = lumaN + lumaS;
  float lumaWE = lumaW + lumaE;
  float subpixRcpRange = 1.0 / range;
  float subpixNSWE = lumaNS + lumaWE;
  float edgeHorz1 = (-2.0 * lumaM) + lumaNS;
  float edgeVert1 = (-2.0 * lumaM) + lumaWE;

  float lumaNESE = lumaNE + lumaSE;
  float lumaNWNE = lumaNW + lumaNE;
  float edgeHorz2 = (-2.0 * lumaE) + lumaNESE;
  float edgeVert2 = (-2.0 * lumaN) + lumaNWNE;

  float lumaNWSW = lumaNW + lumaSW;
  float lumaSWSE = lumaSW + lumaSE;
  float edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);
  float edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);
  float edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;
  float edgeVert3 = (-2.0 * lumaS) + lumaSWSE;
  float edgeHorz = abs(edgeHorz3) + edgeHorz4;
  float edgeVert = abs(edgeVert3) + edgeVert4;

  float subpixNWSWNESE = lumaNWSW + lumaNESE;
  float lengthSign = uRcpFrame.x;
  bool horzSpan = edgeHorz >= edgeVert;
  float subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;

  if (!horzSpan) lumaN = lumaW;
  if (!horzSpan) lumaS = lumaE;
  if (horzSpan) lengthSign = uRcpFrame.y;
  float subpixB = (subpixA * (1.0 / 12.0)) - lumaM;

  float gradientN = lumaN - lumaM;
  float gradientS = lumaS - lumaM;
  float lumaNN = lumaN + lumaM;
  float lumaSS = lumaS + lumaM;
  bool pairN = abs(gradientN) >= abs(gradientS);
  float gradient = max(abs(gradientN), abs(gradientS));
  if (pairN) lengthSign = -lengthSign;
  float subpixC = clamp(abs(subpixB) * subpixRcpRange, 0.0, 1.0);

  vec2 posB = posM;
  vec2 offNP;
  offNP.x = (!horzSpan) ? 0.0 : uRcpFrame.x;
  offNP.y = (horzSpan) ? 0.0 : uRcpFrame.y;
  if (!horzSpan) posB.x += lengthSign * 0.5;
  if (horzSpan) posB.y += lengthSign * 0.5;

  vec2 posN = posB - offNP * 1.0;
  vec2 posP = posB + offNP * 1.0;
  float subpixD = ((-2.0) * subpixC) + 3.0;
  float lumaEndN = lumaTop(posN);
  float subpixE = subpixC * subpixC;
  float lumaEndP = lumaTop(posP);

  if (!pairN) lumaNN = lumaSS;
  float gradientScaled = gradient * 1.0 / 4.0;
  float lumaMM = lumaM - lumaNN * 0.5;
  float subpixF = subpixD * subpixE;
  bool lumaMLTZero = lumaMM < 0.0;

  lumaEndN -= lumaNN * 0.5;
  lumaEndP -= lumaNN * 0.5;
  bool doneN = abs(lumaEndN) >= gradientScaled;
  bool doneP = abs(lumaEndP) >= gradientScaled;
  // The remaining steps of the preset: each side walks on until it finds the
  // end of its edge, the strides growing as the reference's do.
  const float STEPS[4] = float[4](1.5, 2.0, 4.0, 12.0);
  for (int step = 0; step < 4; step++) {
    if (!doneN) posN -= offNP * STEPS[step];
    if (!doneP) posP += offNP * STEPS[step];
    if (doneN && doneP) break;
    if (!doneN) lumaEndN = lumaTop(posN) - lumaNN * 0.5;
    if (!doneP) lumaEndP = lumaTop(posP) - lumaNN * 0.5;
    doneN = abs(lumaEndN) >= gradientScaled;
    doneP = abs(lumaEndP) >= gradientScaled;
  }

  float dstN = posM.x - posN.x;
  float dstP = posP.x - posM.x;
  if (!horzSpan) dstN = posM.y - posN.y;
  if (!horzSpan) dstP = posP.y - posM.y;

  bool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;
  float spanLength = (dstP + dstN);
  bool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
  float spanLengthRcp = 1.0 / spanLength;

  bool directionN = dstN < dstP;
  float dstMin = min(dstN, dstP);
  bool goodSpan = directionN ? goodSpanN : goodSpanP;
  float subpixG = subpixF * subpixF;
  float pixelOffset = (dstMin * (-spanLengthRcp)) + 0.5;
  float subpixH = subpixG * SUBPIX;

  float pixelOffsetGood = goodSpan ? pixelOffset : 0.0;
  float pixelOffsetSubpix = max(pixelOffsetGood, subpixH);
  if (!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;
  if (horzSpan) posM.y += pixelOffsetSubpix * lengthSign;
  fragColor = top(posM);
}
`;

export interface IScenePost {
  /** The target the scene draws into, `width × height` texels. */
  input(width: number, height: number): WebGLFramebuffer;
  /** Finish what was drawn onto the canvas. */
  present(options: IPresentOptions): void;
  /**
   * Frees the pictures between the passes, which `input` and `present` make
   * again at the size they are asked for; the passes themselves stay linked.
   * For a window nobody can see: three pictures of the output's size are up
   * to 100 MB at 4K.
   */
  shed(): void;
  dispose(): void;
}

interface ITarget {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
}

/** `null` when the GPU cannot give it what it needs; the scene then draws at size. */
export const createScenePost = (
  gl: WebGL2RenderingContext,
): IScenePost | null => {
  const fsr: IFsrPasses | null = createFsrPasses(gl);
  const downsample: IPostPass | null = linkPostProgram(gl, DOWNSAMPLE_SOURCE, [
    'uInput',
    'uStep',
  ]);
  const fxaa: IPostPass | null = linkPostProgram(gl, FXAA_SOURCE, [
    'uInput',
    'uRcpFrame',
  ]);
  const copy: IPostPass | null = linkPostProgram(gl, COPY_SOURCE, ['uInput']);
  if (!fsr || !downsample || !fxaa || !copy) {
    fsr?.dispose();
    downsample?.dispose();
    fxaa?.dispose();
    copy?.dispose();
    return null;
  }

  let source: ITarget | undefined;
  let a: ITarget | undefined;
  let b: ITarget | undefined;

  const release = (target: ITarget | undefined) => {
    if (target) {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    }
  };

  // Linear-filtered: FXAA's edge search and the supersample average both
  // read between texels on purpose, and the filters that want whole texels
  // (EASU, RCAS, the copy) fetch them by index.
  const makeTarget = (width: number, height: number): ITarget | undefined => {
    const texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) {
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      return undefined;
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, framebuffer, width, height };
  };

  const fit = (
    target: ITarget | undefined,
    width: number,
    height: number,
  ): ITarget => {
    if (target && target.width === width && target.height === height) {
      return target;
    }
    release(target);
    const made = makeTarget(width, height);
    if (!made) {
      throw new Error('Scene finishing target could not be allocated.');
    }
    return made;
  };

  const shed = () => {
    release(source);
    release(a);
    release(b);
    source = undefined;
    a = undefined;
    b = undefined;
  };

  return {
    input: (width, height) => {
      source = fit(source, width, height);
      return source.framebuffer;
    },
    present: (options) => {
      if (!source) {
        return;
      }
      const { canvasWidth, canvasHeight, scissor } = options;
      const steps = presentPlan(options);
      const [x, y, w, h] = scissor;
      let current = source;
      // Intermediates are written whole; only the last pass is clipped.
      gl.disable(gl.SCISSOR_TEST);
      steps.forEach((step, index) => {
        const last = index === steps.length - 1;
        let target: ITarget | undefined;
        if (!last) {
          a = fit(a, canvasWidth, canvasHeight);
          target = a;
        }
        if (last) {
          gl.enable(gl.SCISSOR_TEST);
          gl.scissor(x, y, w, h);
        }
        gl.viewport(0, 0, canvasWidth, canvasHeight);
        if (step === 'fsr') {
          // EASU needs a target of its own even on the last step: RCAS reads it.
          b = fit(b, canvasWidth, canvasHeight);
          gl.disable(gl.SCISSOR_TEST);
          gl.bindFramebuffer(gl.FRAMEBUFFER, b.framebuffer);
          fsr.easu(
            current.texture,
            current.width,
            current.height,
            canvasWidth,
            canvasHeight,
          );
          if (last) {
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(x, y, w, h);
          }
          gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
          fsr.rcas(b.texture);
        } else if (step === 'downsample') {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
          downsample.use(current.texture);
          gl.uniform2f(
            downsample.where.uStep,
            current.width / canvasWidth,
            current.height / canvasHeight,
          );
          downsample.draw();
        } else if (step === 'fxaa') {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
          fxaa.use(current.texture);
          gl.uniform2f(
            fxaa.where.uRcpFrame,
            1 / current.width,
            1 / current.height,
          );
          fxaa.draw();
        } else {
          gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
          copy.use(current.texture);
          copy.draw();
        }
        if (target) {
          current = target;
          // The next pass writes the other intermediate.
          [a, b] = [b, a];
        }
      });
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x, y, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    },
    shed,
    dispose: () => {
      shed();
      fsr.dispose();
      downsample.dispose();
      fxaa.dispose();
      copy.dispose();
    },
  };
};
