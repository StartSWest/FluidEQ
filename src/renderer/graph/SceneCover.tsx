/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback } from 'react';
import { useBackdropVeilOnRoot } from '../utils/backdropVeil';
import { publishSceneCoverHost } from '../utils/sceneCover';
import '../styles/SceneCover.scss';

/**
 * The back of the window, where the graph's Plus visualizer is drawn in the
 * Backdrop mode (Ivan, 2026-09-25: "cover the app bg … as the 4th option").
 *
 * Empty, and costing nothing, until the graph's scene is drawn into it
 * (`SceneCanvas`): the scene's own canvas, the size of the window, with the
 * graph still its frame (`sceneView.ts`). Everything in the window stands in
 * front of it, and the panes let it through (`SceneCover.scss`).
 */
export default function SceneCover() {
  // How much of the floor veils it behind the panes (the View menu's slider).
  useBackdropVeilOnRoot();
  const attach = useCallback((element: HTMLDivElement | null) => {
    publishSceneCoverHost(element);
  }, []);
  return (
    <div
      ref={attach}
      className="scene-cover"
      data-scene-layer="backdrop"
      aria-hidden="true"
    />
  );
}
