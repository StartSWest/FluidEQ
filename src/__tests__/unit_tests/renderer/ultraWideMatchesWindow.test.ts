/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's Ultra wide promises what the window shows: every pixel of the
 * part of the window it previews must reach the scene at the same `uv` as
 * the same pixel of the EQ page under the Backdrop. A scene is a function of
 * `uv` (and the panel's size and time), so equal `uv` is equal pixels.
 *
 * The EQ page's view is `sceneViewOf` of the plot's own box on the window,
 * as `SceneCanvas` measures it; the box below is the plot measured in the
 * full-app harness at 3440 by 1392 on 2026-11-13 (`.graph-plot`, the panel
 * `ScenePlot` hands the scene). The Studio's is `ULTRA_WIDE_PANEL_VIEW` on
 * `ULTRA_WIDE_SHOWN`.
 */

import {
  ULTRA_WIDE_GRAPH,
  ULTRA_WIDE_SHOWN,
  ULTRA_WIDE_WINDOW,
} from 'common/stageShapes';
import { sceneViewOf, type TSceneView } from 'renderer/graph/sceneView';
import { ULTRA_WIDE_PANEL_VIEW } from 'renderer/studio/studioStageScreen';

const MEASURED_PLOT = { left: 143, top: 174, width: 2956, height: 534 };
const WINDOW = {
  left: 0,
  top: 0,
  width: ULTRA_WIDE_WINDOW.width,
  height: ULTRA_WIDE_WINDOW.height,
};

/** `uv` as `SCENE_VIEW_VERTEX_SOURCE` gives it, for a point on a canvas. */
const uvOf = (
  view: TSceneView,
  canvas: { width: number; height: number },
  x: number,
  y: number,
) => {
  const fromLeft = x / canvas.width;
  const fromBottom = 1 - y / canvas.height;
  return [
    (fromLeft - view[0]) / view[2],
    (fromBottom - view[1]) / view[3],
  ] as const;
};

/** Window pixels across the shown part: above, inside and under the graph. */
const samples = () => {
  const points: Array<[number, number]> = [];
  for (let x = 0; x <= ULTRA_WIDE_SHOWN.width; x += 215) {
    for (
      let y = ULTRA_WIDE_SHOWN.top;
      y <= ULTRA_WIDE_SHOWN.top + ULTRA_WIDE_SHOWN.height;
      y += 41
    ) {
      points.push([x, y]);
    }
  }
  return points;
};

const worstGap = (windowView: TSceneView) =>
  Math.max(
    ...samples().map(([x, y]) => {
      const onWindow = uvOf(windowView, WINDOW, x, y);
      const onStudio = uvOf(
        ULTRA_WIDE_PANEL_VIEW,
        ULTRA_WIDE_SHOWN,
        x,
        y - ULTRA_WIDE_SHOWN.top,
      );
      return Math.max(
        Math.abs(onWindow[0] - onStudio[0]),
        Math.abs(onWindow[1] - onStudio[1]),
      );
    }),
  );

it('reaches every previewed pixel at the uv the EQ page gives it', () => {
  const page = sceneViewOf(MEASURED_PLOT, WINDOW);
  expect(samples().length).toBeGreaterThan(400);
  expect(worstGap(page)).toBeLessThan(1e-9);
  // The graph's band is the same size on both: the panel the scene sizes
  // itself from.
  expect(ULTRA_WIDE_GRAPH).toEqual({
    width: MEASURED_PLOT.width,
    height: MEASURED_PLOT.height,
  });
});

it('would tell a stale measurement apart: the 166 of 2026-11-12', () => {
  const stale = sceneViewOf({ ...MEASURED_PLOT, top: 166 }, WINDOW);
  // Eight rows of a 534-row panel: the preview a band's 1.5% off the window.
  expect(worstGap(stale)).toBeCloseTo(8 / 534, 6);
});
