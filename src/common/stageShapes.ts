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

/**
 * The Compact player's whole column, which a scene is drawn behind: its
 * picture is the panel near the top, and the two thirds under it - behind
 * the player's frosted controls - are more of the same scene, `uv` running
 * on below 0 (`sceneView.ts`). A scene that draws nothing there shows a
 * black slab under the player (Ivan, 2026-11-11: "aware of the mobile UI to
 * fill the black bottom"), and the picture alone, which is all the member's
 * AI could look at, never showed it.
 *
 * The column's height and where the panel ends are the player's own, kept
 * in `playerPictureData.ts` beside the pictures they were measured for;
 * `studioAgentColumn.test.ts` holds these to them.
 */
export const COMPACT_PLAYER_COLUMN = {
  width: PLAYER_WIDTH,
  height: 966,
  /** Rows from the column's top to the foot of the panel. */
  panelFoot: 346,
} as const;

/**
 * Where the player's panel stands on its column, as a scene's view: left,
 * bottom, width and height in shares of the column, from the bottom-left.
 */
export const COMPACT_PLAYER_COLUMN_VIEW: readonly [
  number,
  number,
  number,
  number,
] = [
  0,
  1 - COMPACT_PLAYER_COLUMN.panelFoot / COMPACT_PLAYER_COLUMN.height,
  1,
  PLAYER_PICTURE_HEIGHT / COMPACT_PLAYER_COLUMN.height,
];
