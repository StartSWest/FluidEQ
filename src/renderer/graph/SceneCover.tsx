/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useCallback } from 'react';
import { useBackdropBlurOnRoot } from '../utils/backdropBlur';
import { useBackdropVeilOnRoot } from '../utils/backdropVeil';
import { publishSceneCoverHost } from '../utils/sceneCover';
import '../styles/SceneCover.scss';

/**
 * The back of the window, where the graph's Plus visualizer is drawn while
 * the Transparency slider is above 0, behind every page (Ivan, 2026-09-25:
 * "cover the app bg"; 2026-11-16: "is just transparency and blur").
 *
 * Empty, and costing nothing, until the graph's scene is drawn into it
 * (`SceneCanvas`): the scene's own canvas, the size of the window, with the
 * graph still its frame (`sceneView.ts`). Everything in the window stands in
 * front of it, and the panes let it through (`SceneCover.scss`).
 */
export default function SceneCover() {
  // How much of the floor veils it behind the panes, and how soft it is
  // there (the Transparency and Blur sliders).
  useBackdropVeilOnRoot();
  useBackdropBlurOnRoot();
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
