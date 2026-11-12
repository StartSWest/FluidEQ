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
 * The whole window that ultra-wide graph stands in, as a scene covers it
 * behind the app (the Backdrop: the same scene drawn on the window, the
 * graph still its panel, `sceneView.ts`). Measured in the full-app harness
 * at 3440 by 1392 on the EQ tab: the graph's plot at 143,166, 2956 by 534.
 * A scene composed only for the band stops short of the window's foot, and
 * on the Backdrop a member saw the picture end half-way down the window
 * with a flat brown under the faders (Ivan, 2026-11-12: "the picture leaves
 * a black part at the bottom ... in the Studio the user has no way to know
 * what it covers").
 */
export const ULTRA_WIDE_WINDOW = {
  width: 3440,
  height: 1392,
  graphLeft: 143,
  graphTop: 166,
} as const;

/**
 * How far round the graph the window is shown: a band's height above and
 * below it, at the window's whole width (Ivan, 2026-11-12: the overflow
 * seen "at a maximum size"). Enough to see a picture run on past the graph
 * or stop short of it; the whole window made the band a strip under two
 * fifths of the preview, for rows under the faders. Above, the window has
 * only 166 pixels, so the cut is its own top; below, it stops 158 pixels
 * short of its foot.
 */
const ULTRA_WIDE_REACH = ULTRA_WIDE_GRAPH.height;
const shownTop = Math.max(0, ULTRA_WIDE_WINDOW.graphTop - ULTRA_WIDE_REACH);
const shownFoot = Math.min(
  ULTRA_WIDE_WINDOW.height,
  ULTRA_WIDE_WINDOW.graphTop + ULTRA_WIDE_GRAPH.height + ULTRA_WIDE_REACH,
);

/**
 * The part of the ultra-wide window shown round its graph, in the window's
 * pixels: what the Studio's stage and publish dialog show, and what the
 * member's AI looks at as `ultra-wide-window`, so the two see one picture.
 */
export const ULTRA_WIDE_SHOWN = {
  left: 0,
  top: shownTop,
  width: ULTRA_WIDE_WINDOW.width,
  height: shownFoot - shownTop,
} as const;

/**
 * Where the ultra-wide graph stands on the part of its window shown, as a
 * scene's view: left, bottom, width and height in shares of it, from the
 * bottom-left.
 */
export const ULTRA_WIDE_WINDOW_VIEW: readonly [number, number, number, number] =
  [
    (ULTRA_WIDE_WINDOW.graphLeft - ULTRA_WIDE_SHOWN.left) /
      ULTRA_WIDE_SHOWN.width,
    1 -
      (ULTRA_WIDE_WINDOW.graphTop -
        ULTRA_WIDE_SHOWN.top +
        ULTRA_WIDE_GRAPH.height) /
        ULTRA_WIDE_SHOWN.height,
    ULTRA_WIDE_GRAPH.width / ULTRA_WIDE_SHOWN.width,
    ULTRA_WIDE_GRAPH.height / ULTRA_WIDE_SHOWN.height,
  ];

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
