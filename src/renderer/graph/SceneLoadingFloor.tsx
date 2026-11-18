/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

interface ISceneLoadingFloorProps {
  /** The scene has drawn its first frame: the floor fades out after it. */
  settled: boolean;
  /** The panel's size where it is known; absent, it fills its parent. */
  width?: number;
  height?: number;
}

/**
 * The ground under a Plus scene on its way to the plot: the app's own floor
 * where the scene is about to be (Ivan, 2026-09-25: "when loading the plus viz
 * in the graph no black screen only current app bg color"), so a scene
 * arrives on the window it is part of.
 *
 * It outlives the loading: it stays under the canvas while the scene fades in
 * over its first quarter second, and fades out after it, so nothing moves
 * behind a half-drawn scene.
 *
 * Only for a scene drawn in the plot's own slot, which stands over this
 * floor. A scene drawn on a layer of the window - the EQ column's, the
 * Backdrop - is behind the plot, so this floor would stand in front of it:
 * the picture came in over the head and everywhere else round the plot, and
 * the plot's part of it only once this had waited out the fade and faded
 * after it (Ivan, 2026-11-18: "it's showing the top bar first, and then it
 * draws the other part"). That layer's canvas has the floor under it already
 * and fades in as one picture (`sceneWorkerClient.ts`).
 */
export default function SceneLoadingFloor({
  settled,
  width,
  height,
}: ISceneLoadingFloorProps) {
  return (
    <div
      className={`chart-scene-backdrop${settled ? ' is-settled' : ''}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
