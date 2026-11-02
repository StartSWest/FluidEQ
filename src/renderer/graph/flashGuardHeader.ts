/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { SCENE_VERTEX_SOURCE } from '../../common/sceneUniformContract';
import {
  FLASH_AREA_WINDOW,
  FLASH_CALM_TEXELS,
  FLASH_LIMIT_PER_SECOND,
  FLASH_STATE_REST,
  FLASHING_MEMORY_S,
  MAX_FRAME_MS,
  TRAVEL_SECONDS,
} from './sceneFlashGuard';
import {
  CALM_SOURCE,
  COMPOSITE_SOURCE,
  STATE_SOURCE,
} from './sceneFlashGuardGpu';

/**
 * The flash limiter as the C++ scene host runs it on the lamps
 * (`native/scene-host/src/flash_guard_sources.h`, read by `flash_guard.cpp`):
 * the three programs exactly as `sceneFlashGuardGpu.ts` links them, and the
 * numbers its passes are driven by. One author, so a member's scene is held
 * to the same limit on the desk as on the screen; `flashGuardHeader.test.ts`
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

export const flashGuardHeader = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/renderer/graph/sceneFlashGuardGpu.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    'namespace feq::scene::flash {',
    '',
    raw('kVertexSource', SCENE_VERTEX_SOURCE),
    raw('kStateSource', STATE_SOURCE),
    raw('kCalmSource', CALM_SOURCE),
    raw('kCompositeSource', COMPOSITE_SOURCE),
    '',
    `inline constexpr double kLimitPerSecond = ${cDouble(FLASH_LIMIT_PER_SECOND)};`,
    `inline constexpr double kMaxFrameMs = ${cDouble(MAX_FRAME_MS)};`,
    `inline constexpr double kCalmTexels = ${cDouble(FLASH_CALM_TEXELS)};`,
    `inline constexpr double kRestSinceTurn = ${cDouble(FLASH_STATE_REST.sinceTurn)};`,
    `inline constexpr double kRestFlashing = ${cDouble(FLASH_STATE_REST.flashing)};`,
    `inline constexpr double kFlashingMemoryS = ${cDouble(FLASHING_MEMORY_S)};`,
    `inline constexpr double kTravelSeconds = ${cDouble(TRAVEL_SECONDS)};`,
    `inline constexpr double kAreaWindow = ${cDouble(FLASH_AREA_WINDOW)};`,
    '',
    '}  // namespace feq::scene::flash',
    '',
  ].join('\n');
