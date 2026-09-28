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
import { useSceneColumnHost, useSceneCoverHost } from '../utils/sceneCover';
import { useSceneTintMode } from '../utils/sceneTintStore';
import type { TWorkspaceTab } from '../workspaceTabs';
import {
  graphScenePlace,
  isGraphWaveDrawn,
  sceneModeOnPage,
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
 * (`graphScenePlace`). The Backdrop is the EQ page's alone
 * (`sceneModeOnPage`): every other page draws it as Ambient does. In Colours
 * and Ambient a page without the graph has nowhere to show it, and it stops;
 * and it stops wherever another player stands in for it (`sceneStandIn.ts`).
 */
export default function GraphScene({ page }: { page: TWorkspaceTab }) {
  const scene = useSceneLook();
  const mode = sceneModeOnPage(useSceneTintMode(), page);
  const plot = useScenePlot();
  const backdrop = useSceneCoverHost();
  const column = useSceneColumnHost();
  const { isEngineUsable } = useFluidEqShell();
  const isClean = useGraphContents() === 'clean';
  const isWaveHidden = useGraphWaveHidden();
  // Another player showing a scene where this one would be seen - the
  // Video page's own in its full screen - and this one stops rather than
  // draw a second (`sceneStandIn.ts`).
  const isStoodIn = useGraphSceneStoodIn();
  const target = graphScenePlace({
    drawsScene:
      scene !== null &&
      !isStoodIn &&
      isGraphWaveDrawn({ isClean, isEngineUsable, isWaveHidden }),
    mode,
    plot,
    backdrop,
    column,
  });
  // Expanded or full screen, the Backdrop's scene is drawn on the plot, which
  // is the window then, so nothing marks the root `is-scene-backdrop`; this
  // says so instead, and in full screen keeps the title bar and the transport
  // the Backdrop's glass over the picture (`SceneCover.scss`).
  const isBackdropOnPlot =
    mode === 'cover' &&
    target !== undefined &&
    plot !== undefined &&
    !plot.isPartOfWindow;
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
