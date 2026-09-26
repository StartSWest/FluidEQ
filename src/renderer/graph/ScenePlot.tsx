/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLayoutEffect, useRef } from 'react';
import { useIsChromeIdle } from '../utils/idleChrome';
import { publishScenePlot, useGraphSceneRun } from './graphScenePlace';
import { sceneIdentityOf, type TDrawableScene } from './SceneCanvas';
import SceneLoading from './SceneLoading';
import SceneViewReset from './SceneViewReset';

interface IScenePlotProps {
  scene: TDrawableScene;
  /** The full panel, including the toolbar and axis gutters. */
  width: number;
  height: number;
  spectrumRect: readonly [number, number, number, number];
  /**
   * Whether a plain drag on the plot turns a scene that can be turned: only
   * while it is not the band marquee. A right or middle drag turns it
   * whichever it is.
   */
  dragTurns: boolean;
  /** How far in from the panel's right and bottom the ruled plot stands. */
  inset: { right: number; bottom: number };
  /** See `IScenePlot.isPartOfWindow`. */
  isPartOfWindow: boolean;
}

/**
 * The graph's Plus visualizer as the plot has it: its loading, the panel it
 * is framed by, the place its canvas stands while it is drawn here, and the
 * way back to its own view.
 *
 * Not the scene itself. That runs above the pages (`GraphScene`), so it
 * outlives this plot and is never built again for the plot moving — see
 * `graphScenePlace.ts`. This says where the plot is, and shows what the
 * running scene reports back.
 */
export default function ScenePlot({
  scene,
  width,
  height,
  spectrumRect,
  dragTurns,
  inset,
  isPartOfWindow,
}: IScenePlotProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);

  // A layout effect, so the scene is told before the frame is painted and a
  // move lands in the same frame as whatever moved the plot.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const slot = slotRef.current;
    if (panel && slot) {
      publishScenePlot({
        slot,
        panel,
        width,
        height,
        spectrumRect,
        dragTurns,
        isPartOfWindow,
      });
    }
  }, [width, height, spectrumRect, dragTurns, isPartOfWindow]);
  useLayoutEffect(() => () => publishScenePlot(undefined), []);

  const run = useGraphSceneRun();
  const isChromeIdle = useIsChromeIdle();

  return (
    <>
      <SceneLoading
        lookId={scene.lookId}
        swatch={scene.swatch}
        settled={run?.drawnIdentity === sceneIdentityOf(scene)}
        width={width}
        height={height}
      />
      <div
        ref={panelRef}
        className="chart-scene-panel"
        aria-hidden="true"
        style={{ width, height }}
      />
      {/* Where the canvas stands while the scene is drawn on the plot: here
          in the order, over the loading and under the drawing. It is put
          in and taken out by the scene (`useMovableContainer`), never by
          React, and lays nothing out itself. */}
      <div
        ref={slotRef}
        className="chart-scene-slot"
        aria-hidden="true"
        style={{ display: 'contents' }}
      />
      {run && (
        <SceneViewReset
          interaction={run.interaction}
          className={isChromeIdle ? 'is-idle' : ''}
          // In the drawing's own corner, clear of the axes' labels.
          style={{ right: inset.right + 8, bottom: inset.bottom + 8 }}
        />
      )}
    </>
  );
}
