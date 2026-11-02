/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';
import { DOWNSAMPLE_SOURCE, FXAA_SOURCE } from './scenePost';
import { EASU_SOURCE, RCAS_SHARPNESS_STOPS, RCAS_SOURCE } from './sceneUpscale';

/**
 * The finishing passes as the C++ scene host runs them on the desktop
 * (`native/scene-host/src/scene_finish_sources.h`, read by
 * `scene_finish.cpp`): the programs exactly as `scenePost.ts` and
 * `sceneUpscale.ts` link them — all but the copy, which the host does as a
 * blit. One author, so a background drawn by C++ is
 * sharpened and smoothed as its page did it; `sceneFinishHeader.test.ts`
 * holds the header to this byte for byte, and
 * `.erb/scripts/generate-sound-hops-fixture.ts` writes it.
 */

const raw = (name: string, source: string) => {
  if (source.includes(')glsl"')) {
    throw new Error(`${name} cannot be a raw string literal`);
  }
  return `inline constexpr const char* ${name} = R"glsl(${source})glsl";`;
};

/** A double as C++ reads it back exactly. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

/**
 * The notices the ported programs travel with, as their TypeScript carries
 * them: the header is a copy of both.
 */
const NOTICES = [
  '// The FXAA program is ported from NVIDIA FXAA 3.11 by Timothy Lottes',
  '// (Fxaa3_11.h, quality preset 12), Copyright (c) 2014, NVIDIA CORPORATION,',
  '// used under its three-clause BSD licence, reproduced in assets/licenses/',
  '// THIRD-PARTY-NOTICES.txt.',
  '//',
  '// The EASU and RCAS programs are ported from AMD FidelityFX Super Resolution',
  '// 1.0 (ffx_fsr1.h), Copyright (c) 2021 Advanced Micro Devices, Inc., used',
  '// under the MIT licence:',
  '//',
  '// Permission is hereby granted, free of charge, to any person obtaining a copy',
  '// of this software and associated documentation files (the "Software"), to deal',
  '// in the Software without restriction, including without limitation the rights',
  '// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell',
  '// copies of the Software, and to permit persons to whom the Software is',
  '// furnished to do so, subject to the following conditions:',
  '//',
  '// The above copyright notice and this permission notice shall be included in',
  '// all copies or substantial portions of the Software.',
  '//',
  '// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR',
  '// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,',
  '// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE',
  '// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER',
  '// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,',
  '// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN',
  '// THE SOFTWARE.',
];

export const sceneFinishHeader = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/renderer/graph/scenePost.ts and sceneUpscale.ts. Do not edit;',
    '// regenerate.',
    '//',
    ...NOTICES,
    '#pragma once',
    '',
    'namespace feq::scene::finish {',
    '',
    raw('kVertexSource', SCENE_VERTEX_SOURCE),
    raw('kDownsampleSource', DOWNSAMPLE_SOURCE),
    raw('kFxaaSource', FXAA_SOURCE),
    raw('kEasuSource', EASU_SOURCE),
    raw('kRcasSource', RCAS_SOURCE),
    '',
    '/** RCAS strength, in stops below the hardest it allows. */',
    `inline constexpr double kRcasSharpnessStops = ${cDouble(RCAS_SHARPNESS_STOPS)};`,
    '',
    '}  // namespace feq::scene::finish',
    '',
  ].join('\n');
