/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

/**
 * Where a scene's own panel stands on the canvas it is drawn on.
 *
 * A scene is written for a panel — the graph's plot — and `uv` runs 0..1
 * across it. Covering the window (the Backdrop mode, Ivan 2026-09-25: "for
 * the full bg cover we use the same engine, we just expand it") draws the
 * same scene on a canvas the size of the window, with the graph still its
 * panel: the picture in the graph is exactly the one it always was, and the
 * rest of the window is more of the same scene, `uv` running on past 0 and 1
 * around it. A flat scene is widened by its coordinates
 * (`SCENE_VIEW_VERTEX_SOURCE`), a 3D world by its camera (`setViewOffset`);
 * `uResolution` stays the panel's, so a scene's aspect and every size it
 * works out from it are the ones it has in the graph.
 *
 * `[left, bottom, width, height]`, as fractions of the canvas, from its
 * bottom-left corner as GL counts: the panel's rectangle on the canvas.
 */
export type TSceneView = readonly [number, number, number, number];

/** The panel is the canvas: every place a scene is drawn but the Backdrop. */
export const FULL_VIEW: TSceneView = [0, 0, 1, 1];

/**
 * The scene's triangle, its `uv` measured across the panel rather than the
 * canvas. The same single triangle as `SCENE_VERTEX_SOURCE`, which the flash
 * guard and the finishing passes still use unchanged: they work on the canvas
 * itself, whatever was drawn on it. `uView` is always set (`sceneGl.ts`), so
 * its width and height are never the zero an unset uniform would divide by.
 */
export const SCENE_VIEW_VERTEX_SOURCE = `#version 300 es
uniform vec4 uView;
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = (corner - uView.xy) / uView.zw;
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Whether the panel is the whole canvas, as it is everywhere but the Backdrop. */
export const isFullView = (view: TSceneView): boolean =>
  view[0] === 0 && view[1] === 0 && view[2] === 1 && view[3] === 1;

/** The panel's size in the canvas's pixels: the scene's `uResolution`. */
export const panelSize = (
  width: number,
  height: number,
  view: TSceneView = FULL_VIEW,
): { width: number; height: number } => ({
  width: Math.max(1, width * view[2]),
  height: Math.max(1, height * view[3]),
});

/**
 * The panel's rectangle as a fraction of the canvas's, both measured on the
 * screen (top-left origin, as the page lays them out). A panel the canvas
 * does not frame at all, or a canvas with no size, is the full view.
 */
export const sceneViewOf = (
  panel: { left: number; top: number; width: number; height: number },
  canvas: { left: number; top: number; width: number; height: number },
): TSceneView => {
  if (
    canvas.width <= 0 ||
    canvas.height <= 0 ||
    panel.width <= 0 ||
    panel.height <= 0
  ) {
    return FULL_VIEW;
  }
  const left = (panel.left - canvas.left) / canvas.width;
  const top = (panel.top - canvas.top) / canvas.height;
  const width = panel.width / canvas.width;
  const height = panel.height / canvas.height;
  return [left, 1 - top - height, width, height];
};
