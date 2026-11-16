/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect } from 'react';
import { useFluidEqShell } from '../utils/FluidEqContext';
import {
  useGraphContents,
  useGraphWaveHidden,
  useSceneLook,
} from '../utils/graphStyle';
import {
  useSceneColumnHost,
  useSceneCoverHost,
  useSceneKaraokeHost,
} from '../utils/sceneCover';
import { useIsAppBackdrop } from '../utils/useIsBackdrop';
import {
  graphScenePlace,
  isGraphWaveDrawn,
  useGraphSceneRun,
  useScenePlot,
} from './graphScenePlace';
import SceneCanvas from './SceneCanvas';
import { useGraphSceneStoodIn } from './sceneStandIn';

/**
 * The graph's Plus visualizer, run once for the whole window.
 *
 * Mounted above the pages, beside the graph rather than inside it, so the
 * scene is not the graph's to take down: the plot moving from the EQ column
 * to its own card, the graph going full screen and back, the window's
 * colours going from Colours to the Backdrop — each moves the same canvas
 * (`graphScenePlace`). The Backdrop is the whole app's: behind every page,
 * the one canvas, from the moment Transparency leaves 0. Without it a page
 * without the graph has nowhere to show it, and it stops;
 * and it stops wherever another player stands in for it (`sceneStandIn.ts`).
 */
export default function GraphScene() {
  const scene = useSceneLook();
  const isBackdrop = useIsAppBackdrop();
  const plot = useScenePlot();
  const backdrop = useSceneCoverHost();
  const column = useSceneColumnHost();
  const karaoke = useSceneKaraokeHost();
  const { isEngineUsable } = useFluidEqShell();
  const isClean = useGraphContents() === 'clean';
  const isWaveHidden = useGraphWaveHidden();
  // Another player showing a scene where this one would be seen - the
  // Video page's own in its full screen - and this one stops rather than
  // draw a second (`sceneStandIn.ts`).
  const isStoodIn = useGraphSceneStoodIn();
  const target = graphScenePlace({
    isChosen: scene !== null && !isStoodIn,
    drawsScene: isGraphWaveDrawn({ isClean, isEngineUsable, isWaveHidden }),
    isBackdrop,
    plot,
    backdrop,
    column,
    karaoke,
  });
  // Expanded or full screen, the Backdrop's scene is drawn on the plot, which
  // is the window then, so nothing marks the root `is-scene-backdrop`; this
  // says so instead, and in full screen keeps the title bar and the transport
  // the Backdrop's glass over the picture (`SceneCover.scss`) — once there is
  // a picture, as the layer's own mark waits for one (`SceneCanvas`).
  const hasDrawn = useGraphSceneRun()?.drawnIdentity !== undefined;
  const isBackdropOnPlot =
    isBackdrop &&
    target !== karaoke &&
    target !== undefined &&
    plot !== undefined &&
    !plot.isPartOfWindow &&
    hasDrawn;
  useLayoutEffect(() => {
    if (!isBackdropOnPlot) {
      return undefined;
    }
    const root = document.documentElement;
    root.classList.add('is-scene-full');
    return () => root.classList.remove('is-scene-full');
  }, [isBackdropOnPlot]);
  if (!scene || !target) {
    return null;
  }
  return <SceneCanvas scene={scene} target={target} plot={plot} />;
}
