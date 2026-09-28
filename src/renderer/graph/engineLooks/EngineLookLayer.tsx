/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useMemo, useRef, type RefObject } from 'react';
import { GRAPH_STYLE_LABELS, type GraphStyle } from 'common/graphStyles';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from '../sceneGl';
import type { ISceneSource } from '../sceneRunnerTypes';
import useSceneRunner from '../useSceneRunner';
import type { IEngineLookInput } from './engineLookInput';
import { markEngineLookFailed } from './engineLookHealth';

/**
 * One of the graph's looks drawn by the scene engine, in the trace canvas's
 * own box (`LiveTraceCanvas`).
 *
 * The trace canvas still reads the music and lays the look out every frame,
 * as it always has — the reading, the pieces, the peaks — and writes that
 * layout to `inputRef`; this hands it to the engine with the frame, and the
 * engine paints it on the GPU, in its worker, with everything a Plus scene
 * has: the display's own rate, the size ladder, a lost context rebuilt, and
 * nothing drawn while it cannot be seen. What it does not have is a Plus
 * scene's failure: one that fails goes back to being drawn on the page
 * (`engineLookHealth.ts`), as the same look.
 */

/**
 * Where the engine is with the look, as the trace canvas needs to know it:
 * `building` until it can draw the look — its program being built, or built
 * again after a new size or a lost context — `drawing` once it draws, and
 * `showing` once a frame laid out for this look is on its canvas.
 */
export type TEngineLookPhase = 'building' | 'drawing' | 'showing';

interface IEngineLookLayerProps {
  style: GraphStyle;
  pack: IScenePack;
  /** The newest layout, which the trace canvas writes every frame. */
  inputRef: RefObject<IEngineLookInput | undefined>;
  /** Told each time the engine's phase with the look changes. */
  onPhase: (phase: TEngineLookPhase) => void;
  left: number;
  top: number;
  width: number;
  height: number;
}

// The whole panel: a look is laid out by the page and never reads the
// engine's own mapping of the spectrum.
const WHOLE_PANEL = [0, 1, 0, 1] as const;

export default function EngineLookLayer({
  style,
  pack,
  inputRef,
  onPhase,
  left,
  top,
  width,
  height,
}: IEngineLookLayerProps) {
  const name = GRAPH_STYLE_LABELS[style];
  const source = useMemo<ISceneSource>(() => {
    const fail = () => markEngineLookFailed(style);
    return {
      identity: pack.id,
      version: String(pack.version),
      name,
      load: () => Promise.resolve(pack),
      block: fail,
      reportFailure: (reason, log) => {
        // eslint-disable-next-line no-console -- the one trace a look the engine could not draw leaves, with the driver's own words, before it quietly goes back to the page
        console.error(
          `The engine could not draw the ${name} look (${reason})${
            log ? `: ${log}` : ''
          }; it is drawn on the page until the next launch.`,
        );
        fail();
      },
      tooSlow: fail,
      madeBy: 'fluideq',
    };
  }, [style, pack, name]);

  const phaseRef = useRef<TEngineLookPhase>('building');
  const onPhaseRef = useRef(onPhase);
  onPhaseRef.current = onPhase;
  const enter = useCallback((phase: TEngineLookPhase) => {
    if (phaseRef.current !== phase) {
      phaseRef.current = phase;
      onPhaseRef.current(phase);
    }
  }, []);
  const onWaiting = useCallback(
    (waiting: boolean) => {
      if (waiting) {
        enter('building');
      } else if (phaseRef.current === 'building') {
        enter('drawing');
      }
    },
    [enter],
  );
  const onDrawn = useCallback(
    (frame: ISceneFrame) => {
      if (phaseRef.current === 'drawing' && frame.look?.style === style) {
        enter('showing');
      }
    },
    [enter, style],
  );
  const shapeFrame = useCallback(
    (frame: ISceneFrame): ISceneFrame => {
      const look = inputRef.current;
      return look && look.style === style ? { ...frame, look } : frame;
    },
    [inputRef, style],
  );
  const hostRef = useSceneRunner({
    source,
    width,
    height,
    spectrumRect: WHOLE_PANEL,
    shapeFrame,
    onWaiting,
    onDrawn,
  });
  return (
    <div
      ref={hostRef}
      className="chart-live-canvas"
      style={{ left, top, width, height }}
      aria-hidden
    />
  );
}
