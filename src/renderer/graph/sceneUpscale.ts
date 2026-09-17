/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

The two filters in this file are ported from AMD FidelityFX Super Resolution
1.0 (ffx_fsr1.h), Copyright (c) 2021 Advanced Micro Devices, Inc., used under
the MIT licence:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

import { linkPostProgram, type IPostPass } from './scenePostPass';

/**
 * A scene drawn smaller than its panel, brought up to size on the GPU.
 *
 * A fragment shader costs per pixel, so the resolution controller
 * (`sceneHealth.ts`) draws a scene that cannot keep the display's frame rate at
 * a fraction of the panel's size, and the presets pin it there. What used to
 * bring that picture up to size was the compositor stretching the canvas —
 * bilinear, which is a blur: at half size every edge in the scene was two
 * pixels of smear. These two passes are what games call spatial upscaling,
 * the same on every GPU vendor: AMD's FSR 1.
 *
 * - EASU (edge-adaptive spatial upsampling): for every output pixel, twelve
 *   taps of the small picture, weighted along the direction of the local
 *   gradient — a Lanczos-like lobe stretched along an edge, so an edge stays an
 *   edge — and clamped to the range of the four nearest texels, so nothing
 *   rings.
 * - RCAS (robust contrast-adaptive sharpening): a five-tap sharpen whose
 *   strength is solved per pixel so the result never clips past its
 *   neighbours, with the noise-detection term on, so grain and sparkle are not
 *   sharpened into halos.
 *
 * Ported to GLSL ES 3.00 by hand, because WebGL2 has no `textureGather`: the
 * twelve taps are fetched one texel each, which is what the four gathers in
 * the reference read. Alpha is filtered by EASU with the colour's own weights
 * (the picture is premultiplied, and a linear filter over all four channels
 * keeps it so) and passed through RCAS untouched, as the reference's alpha
 * pass-through does. The targets they read and write belong to the finishing
 * chain (`scenePost.ts`).
 *
 * NOT UNIT-TESTED beyond `easuConstants`, for the same reason as `sceneGl.ts`:
 * jsdom has no WebGL. Measured in headless Chrome against the native picture
 * of every FluidEQ scene at 4K.
 */

/**
 * RCAS strength, in stops below maximum: 0 is the hardest sharpening the
 * filter allows, each stop halves it. AMD's own samples ship 0.2; anything
 * harder puts a halo on the thin bright lines FluidEQ's scenes are full of.
 */
export const RCAS_SHARPNESS_STOPS = 0.2;

/**
 * EASU's constants for a picture of `inputWidth × inputHeight` texels brought
 * to `outputWidth × outputHeight`: the output-pixel-to-input-texel scale, and
 * the offset that puts an output pixel's centre in input texel space with
 * texel `f` (the top-left of the nearest four) at the floor.
 */
export const easuConstants = (
  inputWidth: number,
  inputHeight: number,
  outputWidth: number,
  outputHeight: number,
): readonly [number, number, number, number] => [
  inputWidth / outputWidth,
  inputHeight / outputHeight,
  (0.5 * inputWidth) / outputWidth - 0.5,
  (0.5 * inputHeight) / outputHeight - 0.5,
];

const EASU_SOURCE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uInput;
uniform vec4 uCon;
out vec4 fragColor;

// The reference's low-precision reciprocal and reciprocal square root: one
// integer subtraction each. Finite at zero, which 1.0 / x is not, and the
// filter relies on that where a gradient is flat.
float prxLoRcp(float a) {
  return uintBitsToFloat(0x7ef07ebbu - floatBitsToUint(a));
}
float prxLoRsq(float a) {
  return uintBitsToFloat(0x5f347d74u - (floatBitsToUint(a) >> 1u));
}

// One texel, exactly, clamped at the edges as the reference's sampler is.
vec4 tap(ivec2 f, int dx, int dy) {
  ivec2 last = textureSize(uInput, 0) - 1;
  return texelFetch(uInput, clamp(f + ivec2(dx, dy), ivec2(0), last), 0);
}

// Luma times two, in two multiply-adds, as the reference has it.
float lumaOf(vec4 c) {
  return c.b * 0.5 + (c.r * 0.5 + c.g);
}

// Accumulate the gradient direction and the edge length from one of the four
// nearest texels' crosses, weighted by that texel's bilinear share.
void easuSet(
  inout vec2 dir, inout float len, vec2 pp,
  bool biS, bool biT, bool biU, bool biV,
  float lA, float lB, float lC, float lD, float lE
) {
  float w = 0.0;
  if (biS) w = (1.0 - pp.x) * (1.0 - pp.y);
  if (biT) w = pp.x * (1.0 - pp.y);
  if (biU) w = (1.0 - pp.x) * pp.y;
  if (biV) w = pp.x * pp.y;
  float dc = lD - lC;
  float cb = lC - lB;
  float lenX = max(abs(dc), abs(cb));
  lenX = prxLoRcp(lenX);
  float dirX = lD - lB;
  dir.x += dirX * w;
  lenX = clamp(abs(dirX) * lenX, 0.0, 1.0);
  lenX *= lenX;
  len += lenX * w;
  float ec = lE - lC;
  float ca = lC - lA;
  float lenY = max(abs(ec), abs(ca));
  lenY = prxLoRcp(lenY);
  float dirY = lE - lA;
  dir.y += dirY * w;
  lenY = clamp(abs(dirY) * lenY, 0.0, 1.0);
  lenY *= lenY;
  len += lenY * w;
}

// One tap: its offset rotated into the gradient's frame, stretched along the
// edge, weighted by the reference's polynomial stand-in for a Lanczos lobe.
void easuTap(
  inout vec4 aC, inout float aW, vec2 off, vec2 dir, vec2 len,
  float lob, float clp, vec4 c
) {
  vec2 v;
  v.x = (off.x * dir.x) + (off.y * dir.y);
  v.y = (off.x * (-dir.y)) + (off.y * dir.x);
  v *= len;
  float d2 = v.x * v.x + v.y * v.y;
  d2 = min(d2, clp);
  float wB = (2.0 / 5.0) * d2 + (-1.0);
  float wA = lob * d2 + (-1.0);
  wB *= wB;
  wA *= wA;
  wB = (25.0 / 16.0) * wB + (-(25.0 / 16.0 - 1.0));
  float w = wB * wA;
  aC += c * w;
  aW += w;
}

void main() {
  vec2 ip = floor(gl_FragCoord.xy);
  vec2 pp = ip * uCon.xy + uCon.zw;
  vec2 fp = floor(pp);
  pp -= fp;
  ivec2 f = ivec2(fp);
  // The twelve taps around f, by the reference's letters:
  //    b c
  //  e f g h
  //  i j k l
  //    n o
  vec4 b = tap(f, 0, -1);
  vec4 c = tap(f, 1, -1);
  vec4 e = tap(f, -1, 0);
  vec4 ff = tap(f, 0, 0);
  vec4 g = tap(f, 1, 0);
  vec4 h = tap(f, 2, 0);
  vec4 i = tap(f, -1, 1);
  vec4 j = tap(f, 0, 1);
  vec4 k = tap(f, 1, 1);
  vec4 l = tap(f, 2, 1);
  vec4 n = tap(f, 0, 2);
  vec4 o = tap(f, 1, 2);
  float bL = lumaOf(b);
  float cL = lumaOf(c);
  float eL = lumaOf(e);
  float fL = lumaOf(ff);
  float gL = lumaOf(g);
  float hL = lumaOf(h);
  float iL = lumaOf(i);
  float jL = lumaOf(j);
  float kL = lumaOf(k);
  float lL = lumaOf(l);
  float nL = lumaOf(n);
  float oL = lumaOf(o);
  vec2 dir = vec2(0.0);
  float len = 0.0;
  easuSet(dir, len, pp, true, false, false, false, bL, eL, fL, gL, jL);
  easuSet(dir, len, pp, false, true, false, false, cL, fL, gL, hL, kL);
  easuSet(dir, len, pp, false, false, true, false, fL, iL, jL, kL, nL);
  easuSet(dir, len, pp, false, false, false, true, gL, jL, kL, lL, oL);
  vec2 dir2 = dir * dir;
  float dirR = dir2.x + dir2.y;
  bool zro = dirR < (1.0 / 32768.0);
  dirR = prxLoRsq(dirR);
  dirR = zro ? 1.0 : dirR;
  dir.x = zro ? 1.0 : dir.x;
  dir *= vec2(dirR);
  len = len * 0.5;
  len *= len;
  float stretch = (dir.x * dir.x + dir.y * dir.y) * prxLoRcp(max(abs(dir.x), abs(dir.y)));
  vec2 len2 = vec2(1.0 + (stretch - 1.0) * len, 1.0 + (-0.5) * len);
  float lob = 0.5 + ((1.0 / 4.0 - 0.04) - 0.5) * len;
  float clp = prxLoRcp(lob);
  vec4 min4 = min(min(ff, g), min(j, k));
  vec4 max4 = max(max(ff, g), max(j, k));
  vec4 aC = vec4(0.0);
  float aW = 0.0;
  easuTap(aC, aW, vec2(0.0, -1.0) - pp, dir, len2, lob, clp, b);
  easuTap(aC, aW, vec2(1.0, -1.0) - pp, dir, len2, lob, clp, c);
  easuTap(aC, aW, vec2(-1.0, 1.0) - pp, dir, len2, lob, clp, i);
  easuTap(aC, aW, vec2(0.0, 1.0) - pp, dir, len2, lob, clp, j);
  easuTap(aC, aW, vec2(0.0, 0.0) - pp, dir, len2, lob, clp, ff);
  easuTap(aC, aW, vec2(-1.0, 0.0) - pp, dir, len2, lob, clp, e);
  easuTap(aC, aW, vec2(1.0, 1.0) - pp, dir, len2, lob, clp, k);
  easuTap(aC, aW, vec2(2.0, 1.0) - pp, dir, len2, lob, clp, l);
  easuTap(aC, aW, vec2(2.0, 0.0) - pp, dir, len2, lob, clp, h);
  easuTap(aC, aW, vec2(1.0, 0.0) - pp, dir, len2, lob, clp, g);
  easuTap(aC, aW, vec2(1.0, 2.0) - pp, dir, len2, lob, clp, o);
  easuTap(aC, aW, vec2(0.0, 2.0) - pp, dir, len2, lob, clp, n);
  fragColor = min(max4, max(min4, aC * vec4(1.0 / aW)));
}
`;

const RCAS_SOURCE = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uInput;
uniform float uSharp;
out vec4 fragColor;

// The reference's medium-precision reciprocal: one Newton step on the bit
// trick. Exact enough that the resolve shows no tonality shift.
float prxMedRcp(float a) {
  float b = uintBitsToFloat(0x7ef19fffu - floatBitsToUint(a));
  return b * (-b * a + 2.0);
}

float max3(float x, float y, float z) { return max(x, max(y, z)); }
float min3(float x, float y, float z) { return min(x, min(y, z)); }

vec4 load(ivec2 p) {
  return texelFetch(uInput, clamp(p, ivec2(0), textureSize(uInput, 0) - 1), 0);
}

void main() {
  ivec2 sp = ivec2(gl_FragCoord.xy);
  //    b
  //  d e f
  //    h
  vec3 b = load(sp + ivec2(0, -1)).rgb;
  vec3 d = load(sp + ivec2(-1, 0)).rgb;
  vec4 ee = load(sp);
  vec3 e = ee.rgb;
  vec3 f = load(sp + ivec2(1, 0)).rgb;
  vec3 h = load(sp + ivec2(0, 1)).rgb;
  float bL = b.b * 0.5 + (b.r * 0.5 + b.g);
  float dL = d.b * 0.5 + (d.r * 0.5 + d.g);
  float eL = e.b * 0.5 + (e.r * 0.5 + e.g);
  float fL = f.b * 0.5 + (f.r * 0.5 + f.g);
  float hL = h.b * 0.5 + (h.r * 0.5 + h.g);
  // Noise detection: a high-pass normalised against the local contrast.
  float nz = 0.25 * bL + 0.25 * dL + 0.25 * fL + 0.25 * hL - eL;
  nz = clamp(abs(nz) * prxMedRcp(max3(max3(bL, dL, eL), fL, hL) - min3(min3(bL, dL, eL), fL, hL)), 0.0, 1.0);
  nz = -0.5 * nz + 1.0;
  vec3 mn4 = min(min(b, d), min(f, h));
  vec3 mx4 = max(max(b, d), max(f, h));
  vec2 peakC = vec2(1.0, -1.0 * 4.0);
  // The reference divides by 4·max and by 4·min − 4, both of which are zero
  // on a flat black or white ring and leave the lobe to whatever max(NaN, x)
  // does on the driver. Nudged off zero instead: the lobe comes out zero, as
  // it does on the drivers where the reference happens to work.
  vec3 hitMin = min(mn4, e) / (4.0 * mx4 + 1e-6);
  vec3 hitMax = (peakC.x - max(mx4, e)) / (4.0 * mn4 + peakC.y - 1e-6);
  vec3 lobe3 = max(-hitMin, hitMax);
  float lobe = max(-(0.25 - 1.0 / 16.0), min(max3(lobe3.r, lobe3.g, lobe3.b), 0.0)) * uSharp;
  lobe *= nz;
  float rcpL = prxMedRcp(4.0 * lobe + 1.0);
  vec3 pix = (lobe * b + lobe * d + lobe * h + lobe * f + e) * rcpL;
  fragColor = vec4(pix, ee.a);
}
`;

export interface IFsrPasses {
  /** EASU: the small `input` texture up to the bound target's `width × height`. */
  easu(
    input: WebGLTexture,
    inputWidth: number,
    inputHeight: number,
    width: number,
    height: number,
  ): void;
  /** RCAS: sharpen `input`, the same size as the bound target. */
  rcas(input: WebGLTexture): void;
  dispose(): void;
}

/** `null` when the GPU cannot give it what it needs; the scene then draws at size. */
export const createFsrPasses = (
  gl: WebGL2RenderingContext,
): IFsrPasses | null => {
  const easu: IPostPass | null = linkPostProgram(gl, EASU_SOURCE, [
    'uInput',
    'uCon',
  ]);
  const rcas: IPostPass | null = linkPostProgram(gl, RCAS_SOURCE, [
    'uInput',
    'uSharp',
  ]);
  if (!easu || !rcas) {
    easu?.dispose();
    rcas?.dispose();
    return null;
  }
  const sharp = 2 ** -RCAS_SHARPNESS_STOPS;
  return {
    easu: (input, inputWidth, inputHeight, width, height) => {
      easu.use(input);
      gl.uniform4f(
        easu.where.uCon,
        ...easuConstants(inputWidth, inputHeight, width, height),
      );
      easu.draw();
    },
    rcas: (input) => {
      rcas.use(input);
      gl.uniform1f(rcas.where.uSharp, sharp);
      rcas.draw();
    },
    dispose: () => {
      easu.dispose();
      rcas.dispose();
    },
  };
};
