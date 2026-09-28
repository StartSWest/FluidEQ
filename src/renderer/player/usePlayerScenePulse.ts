/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, type RefObject } from 'react';
import type { ISceneFrame } from '../graph/sceneGl';
import { reportSceneBeat, reportSceneLeft } from '../utils/scenePulse';

/**
 * The window's light on the beats of the amp's own picture, in Ambient and
 * the Backdrop (`ScenePulse.tsx`).
 *
 * The light answers the beats a scene reports from the frames it draws, and
 * in the full app that is the graph's renderer (`SceneCanvas`). The amp
 * plays the same visualizer through its own runner — in its deck, or behind
 * its equalizer's curve — which reported nothing, so Ambient in the amp was
 * its colours and its drifting elements and never its light. Reported as the
 * graph's, because it is the graph's visualizer, playing.
 *
 * Gives what the runner calls with each frame drawn (`ScenePreview`'s
 * `onDrawn`), and takes the light away with the picture when it stops being
 * drawn here.
 */
const usePlayerScenePulse = (
  isDrawing: boolean,
  place: RefObject<HTMLElement | null>,
) => {
  useEffect(
    () => (isDrawing ? () => reportSceneLeft('graph') : undefined),
    [isDrawing],
  );
  return useCallback(
    (frame: ISceneFrame) => reportSceneBeat('graph', frame, place.current),
    [place],
  );
};

export default usePlayerScenePulse;
