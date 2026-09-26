/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useFluidEqShell } from '../utils/FluidEqContext';
import {
  useGraphContents,
  useGraphWaveHidden,
  useSceneLook,
} from '../utils/graphStyle';
import { useSceneColumnHost, useSceneCoverHost } from '../utils/sceneCover';
import { useSceneTintMode } from '../utils/sceneTintStore';
import {
  graphScenePlace,
  isGraphWaveDrawn,
  useScenePlot,
} from './graphScenePlace';
import SceneCanvas from './SceneCanvas';

/**
 * The graph's Plus visualizer, run once for the whole window.
 *
 * Mounted above the pages, beside the graph rather than inside it, so the
 * scene is not the graph's to take down: the plot moving from the EQ column
 * to its own card, the graph going full screen and back, the window's
 * colours going from Colours to the Backdrop — each moves the same canvas
 * (`graphScenePlace`), and the Backdrop's picture stays behind every page
 * when the graph's own page is left. In Colours and Ambient a page without
 * the graph has nowhere to show it, and it stops.
 */
export default function GraphScene() {
  const scene = useSceneLook();
  const mode = useSceneTintMode();
  const plot = useScenePlot();
  const backdrop = useSceneCoverHost();
  const column = useSceneColumnHost();
  const { isEngineUsable } = useFluidEqShell();
  const isClean = useGraphContents() === 'clean';
  const isWaveHidden = useGraphWaveHidden();
  const target = graphScenePlace({
    drawsScene:
      scene !== null &&
      isGraphWaveDrawn({ isClean, isEngineUsable, isWaveHidden }),
    mode,
    plot,
    backdrop,
    column,
  });
  if (!scene || !target) {
    return null;
  }
  return <SceneCanvas scene={scene} target={target} plot={plot} />;
}
