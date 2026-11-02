// Written by .erb/scripts/generate-sound-hops-fixture.ts from
// src/renderer/graph/scenePost.ts and sceneUpscale.ts. Do not edit;
// regenerate.
//
// The FXAA program is ported from NVIDIA FXAA 3.11 by Timothy Lottes
// (Fxaa3_11.h, quality preset 12), Copyright (c) 2014, NVIDIA CORPORATION,
// used under its three-clause BSD licence, reproduced in assets/licenses/
// THIRD-PARTY-NOTICES.txt.
//
// The EASU and RCAS programs are ported from AMD FidelityFX Super Resolution
// 1.0 (ffx_fsr1.h), Copyright (c) 2021 Advanced Micro Devices, Inc., used
// under the MIT licence:
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
#pragma once

namespace feq::scene::finish {

inline constexpr const char* kVertexSource = R"glsl(#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = corner;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
)glsl";
inline constexpr const char* kDownsampleSource = R"glsl(#version 300 es
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
)glsl";
inline constexpr const char* kFxaaSource = R"glsl(#version 300 es
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
)glsl";
inline constexpr const char* kEasuSource = R"glsl(#version 300 es
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
)glsl";
inline constexpr const char* kRcasSource = R"glsl(#version 300 es
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
)glsl";

/** RCAS strength, in stops below the hardest it allows. */
inline constexpr double kRcasSharpnessStops = 0.2;

}  // namespace feq::scene::finish
