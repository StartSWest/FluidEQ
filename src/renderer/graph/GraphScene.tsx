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
import { useSceneColumnHost } from '../utils/sceneCover';
import {
  graphScenePlace,
  isGraphWaveDrawn,
  useScenePlot,
} from './graphScenePlace';
import SceneCanvas from './SceneCanvas';
import { useGraphSceneStoodIn } from './sceneStandIn';

/**
 * The graph's Plus visualizer, run once for the whole window.
 *
 * Mounted above the pages, beside the graph rather than inside it, so the
 * scene is not the graph's to take down: the plot moving from the EQ column
 * to its own card, the graph going full screen and back — each moves the
 * same canvas (`graphScenePlace`). A page without the graph has nowhere to
 * show it, and it stops; and it stops wherever another player stands in for
 * it (`sceneStandIn.ts`).
 */
export default function GraphScene() {
  const scene = useSceneLook();
  const plot = useScenePlot();
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
    plot,
    column,
  });
  if (!scene || !target) {
    return null;
  }
  return <SceneCanvas scene={scene} target={target} plot={plot} />;
}
