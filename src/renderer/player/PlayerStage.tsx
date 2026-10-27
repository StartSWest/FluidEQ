/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useLayoutEffect, useRef } from 'react';
import type { ISceneFrame } from '../graph/sceneGl';
import { FULL_VIEW, sceneViewOf, type TSceneView } from '../graph/sceneView';
import ScenePreview from '../plus/ScenePreview';
import type { IGraphScenePack } from './useGraphScenePack';
import usePlayerScenePulse from './usePlayerScenePulse';
import { layoutBoxIn } from '../utils/layoutBox';

interface IPlayerStageProps {
  /** The Plus visualizer to draw, loaded and not troubled; none otherwise. */
  scene: IGraphScenePack | undefined;
  onTrouble: () => void;
  /**
   * The scene's own panel, where it is framed, on a stage larger than it:
   * the amp's top part, while the stage is the whole window (the Backdrop);
   * null until the panel is on the page. Absent, the stage is the panel.
   *
   * The element, not a ref to it: the panel stands after the stage on the
   * page, so it is attached after the stage's own effects run, and a ref read
   * there was still empty. The stage then framed the scene to the whole
   * window — the top third of it in the panel, a sun with no city — until
   * the scene itself changed, which on a first launch its loading did and
   * on an unfold from one line nothing does (Ivan, 2026-10-27).
   */
  panel?: HTMLElement | null;
}

/**
 * THE PICTURE BEHIND THE AMP: the graph's Plus visualizer, drawn behind the
 * top panel and the transport, and in the Backdrop behind the whole window.
 * One runner for it, as the graph has one. Without one, the amp's flat
 * floor, which a standard look is drawn over (`PlayerHero`).
 *
 * IN THE BACKDROP THE TOP PART IS STILL THE SCENE'S PANEL (Ivan, 2026-10-25:
 * "the scenes need to display on the top part, they just complete the rest
 * of the content down", "similar to what we do on the full app backdrop").
 * The stage is the window's size, and the scene is told where its panel
 * stands on it (`view`, `sceneView.ts`), exactly as the full app's Backdrop
 * keeps the graph its panel: the picture in the top part is the one it is
 * in every other mode, and the rest of the window is more of the same scene,
 * its coordinates running on past the panel's edges. Measured whenever the
 * stage or the panel changes size, and as the column the panel stands in
 * scrolls.
 */
const PlayerStage = ({ scene, onTrouble, panel }: IPlayerStageProps) => {
  const layerRef = useRef<HTMLDivElement>(null);
  // The window's light beats with this picture in Ambient, as it does with
  // the graph's in the full app.
  const onDrawn = usePlayerScenePulse(scene !== undefined, layerRef);
  const viewRef = useRef<TSceneView>(FULL_VIEW);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer || !panel || typeof ResizeObserver === 'undefined') {
      viewRef.current = FULL_VIEW;
      return undefined;
    }
    const measure = () => {
      // Laid out, never drawn: the column's opening turns the panel and the
      // transport as it plays, and framed from their drawn boxes the scene
      // was framed for a strip until something happened to measure again
      // (`layoutBoxIn`).
      const root = layer.offsetParent;
      const panelBox =
        root instanceof HTMLElement ? layoutBoxIn(panel, root) : undefined;
      const layerBox =
        root instanceof HTMLElement ? layoutBoxIn(layer, root) : undefined;
      if (!panelBox || !layerBox) {
        viewRef.current = FULL_VIEW;
        return;
      }
      viewRef.current = sceneViewOf(panelBox, layerBox);
      const panelBottom = panelBox.top + panelBox.height;
      // Where the panel's foot stands on the stage, and where its transport
      // starts: the frost under the amp's panes rises through the transport
      // and is whole from the foot down, and the shade that holds the window
      // dark starts at the foot (`_miniPlayerStage.scss`).
      const transport = panel.querySelector('.player-dock');
      const transportBox =
        transport instanceof HTMLElement && root instanceof HTMLElement
          ? layoutBoxIn(transport, root)
          : undefined;
      const frostTop = transportBox ? transportBox.top : panelBottom;
      layer.style.setProperty(
        '--player-panel-foot',
        `${Math.round(panelBottom - layerBox.top)}px`,
      );
      layer.style.setProperty(
        '--player-frost-top',
        `${Math.round(frostTop - layerBox.top)}px`,
      );
      layer.style.setProperty(
        '--player-frost-ramp',
        `${Math.round(panelBottom - frostTop)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    observer.observe(panel);
    const column = panel.closest('.player-body');
    column?.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      column?.removeEventListener('scroll', measure);
    };
  }, [panel]);

  const shapeFrame = useCallback(
    (frame: ISceneFrame): ISceneFrame =>
      viewRef.current === FULL_VIEW
        ? frame
        : { ...frame, view: viewRef.current },
    [],
  );

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
          shapeFrame={panel !== undefined ? shapeFrame : undefined}
        />
      )}
    </div>
  );
};

export default PlayerStage;
