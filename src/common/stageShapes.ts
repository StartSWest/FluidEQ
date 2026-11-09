/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PLAYER_PICTURE_HEIGHT, PLAYER_WIDTH } from './constants';

/**
 * The shapes FluidEQ shows a scene at, measured, in one place: the Studio's
 * stage previews them (`studioStageScreen.ts`, `useStudioStageRatio.ts`) and
 * the Studio's AI looks at a scene in them (`STUDIO_AGENT_SHAPES`). Kept here
 * so the two cannot disagree: the AI asked to improve a scene "on ultra
 * wide" looked at four shapes of its own making, 4:1 to 12:1, and none of
 * them was the one the stage shows (Ivan, 2026-11-09: "make sure when I ask
 * the agent it knows is that aspect ratio not any other invented one").
 */

/** The EQ graph's own shape, and the Studio stage's until it is dragged. */
export const GRAPH_STAGE_RATIO = 2.35;

/**
 * The EQ tab's graph on a 3440 by 1440 monitor, the window maximised
 * (3440 by 1392 CSS pixels at 100%), measured in the full-app harness with
 * the panes as a new install opens them: 2956 by 534, about 5.5:1. A
 * 2560-wide window gives 3.9 and a 1920-wide one 3.8, so 5.5 is the shape
 * only an ultra-wide screen shows a scene at, and the one a scene composed
 * for 16:9 is most likely to come apart in.
 */
export const ULTRA_WIDE_GRAPH = { width: 2956, height: 534 } as const;

/**
 * The Compact player's picture: its top panel, where a scene is seen whole,
 * 480 by 309 (`PLAYER_WIDTH`, `PLAYER_PICTURE_HEIGHT`).
 */
export const COMPACT_PLAYER_PICTURE = {
  width: PLAYER_WIDTH,
  height: PLAYER_PICTURE_HEIGHT,
} as const;
