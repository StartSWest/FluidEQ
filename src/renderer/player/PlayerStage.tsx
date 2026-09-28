/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import ScenePreview from '../plus/ScenePreview';
import type { IGraphScenePack } from './useGraphScenePack';
import usePlayerScenePulse from './usePlayerScenePulse';

interface IPlayerStageProps {
  /** The Plus visualizer to draw, loaded and not troubled; none otherwise. */
  scene: IGraphScenePack | undefined;
  onTrouble: () => void;
}

/**
 * THE PICTURE IS THE AMP'S BACKGROUND (the Stage, Ivan 2026-09-27): the
 * graph's Plus visualizer drawn the size of the whole window, behind the
 * glass the amp's controls stand on. One runner for it, as the graph has one.
 *
 * Without a Plus visualizer the window is a soft ground in the theme's own
 * colours, and the free look the graph is set to is drawn in the open space
 * between the dock and the sheet (`PlayerGap`) — the graph's drawings are
 * lines and bars laid out along a band, not pictures to fill a window with.
 */
const PlayerStage = ({ scene, onTrouble }: IPlayerStageProps) => {
  const layerRef = useRef<HTMLDivElement>(null);
  // The window's light beats with this picture in Ambient, as it does with
  // the graph's in the full app.
  const onDrawn = usePlayerScenePulse(scene !== undefined, layerRef);
  return (
    <div
      ref={layerRef}
      className={`player-stage${scene ? ' has-scene' : ''}`}
      aria-hidden="true"
    >
      {scene && (
        <ScenePreview
          identity={scene.identity}
          madeBy={scene.madeBy}
          pack={scene.pack}
          label={scene.label}
          tuning={scene.tuning}
          wave={scene.wave}
          onTrouble={onTrouble}
          onDrawn={onDrawn}
        />
      )}
    </div>
  );
};

export default PlayerStage;
