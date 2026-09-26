/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IScenePerformance } from 'common/scenePerformance';
import type { IWallpaperSurfaceBridge } from 'common/wallpaper';
import type { ISceneFrame } from '../graph/sceneGl';
import useSceneRunner, { type ISceneSource } from '../graph/useSceneRunner';
import { studioSpectrumRect } from '../studio/studioWave';
import { createCalmShaper } from './calmMotion';
import type { ISceneLayer, TSceneLayerStage } from './sceneCrossfade';

const STAGE_CLASS: Record<TSceneLayerStage, string> = {
  alone: 'wallpaper-scene',
  over: 'wallpaper-scene wallpaper-scene--over',
  leaving: 'wallpaper-scene wallpaper-scene--over wallpaper-scene--leaving',
  under: 'wallpaper-scene',
};

/**
 * One visualizer on the desktop page: its own scene runner, worker and
 * canvas, drawn in a layer of the page (`sceneCrossfade.ts`).
 */
export default function WallpaperSceneLayer({
  layer,
  stage,
  current,
  bridge,
  performance,
  asleep,
  onFirstFrame,
  onCrossed,
}: {
  layer: ISceneLayer;
  stage: TSceneLayerStage;
  /**
   * Whether this is the visualizer main last said the monitor shows. Only
   * that one's failures are reported: main would write a failure of the one
   * being replaced down against its successor's look.
   */
  current: boolean;
  bridge: IWallpaperSurfaceBridge;
  /** Main's copy of the window's choice: this page has no store of its own. */
  performance: IScenePerformance;
  /** Paused: the picture stays on the desktop and no frame is drawn. */
  asleep: boolean;
  /** Its first frame with anything in it, once. */
  onFirstFrame(generation: number): void;
  /** The fade of this layer off its successor ended, or was cut short. */
  onCrossed(generation: number): void;
}) {
  const { generation, bootstrap, state } = layer;
  const { wave, motion, tuning } = state;
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const reported = useRef(false);
  const currentRef = useRef(current);
  currentRef.current = current;
  const source = useMemo<ISceneSource>(
    () => ({
      identity: bootstrap.pack.id,
      version: String(bootstrap.pack.version),
      name: bootstrap.pack.names.en,
      load: async () => bootstrap.pack,
      block: () => {
        if (currentRef.current) {
          bridge.failed();
        }
      },
      // The scene's own failure, with its reason, so main keeps that code from
      // running again — on this monitor and wherever else it is shown.
      reportFailure: (reason) => {
        if (currentRef.current) {
          bridge.failed(reason);
        }
      },
      tooSlow: () => {
        if (currentRef.current) {
          bridge.failed();
        }
      },
      // Main's word on whose scene it is, the same answer the window's own
      // list gives: the listener's own is run as their own here too. Told
      // only that a member had made it, this page ran the listener's own
      // scene through the brightness limiter and ghosted it on the desktop
      // while the Studio showed it clean.
      madeBy: bootstrap.madeBy,
    }),
    [bootstrap, bridge],
  );
  const firstFrameRef = useRef(onFirstFrame);
  firstFrameRef.current = onFirstFrame;
  // The runner's own rule for a first frame: a fade still at zero is black.
  const onDrawn = useCallback(
    (frame: ISceneFrame) => {
      if (!reported.current && frame.fade > 0) {
        reported.current = true;
        bridge.drawn(generation);
        firstFrameRef.current(generation);
      }
    },
    [bridge, generation],
  );
  // `[left, right, floor, ceiling]`. The desktop is a stage with no gutters,
  // as the Studio's is, so it takes the Studio's band for the graph's wave: a
  // background set with a short or lifted wave draws exactly that. The band
  // this replaced, [0, 0, 1, 1], had no width and sat on the top edge.
  const { height: waveHeight, position: wavePosition } = wave;
  const spectrumRect = useMemo(
    () =>
      studioSpectrumRect(bootstrap.pack, {
        height: waveHeight,
        position: wavePosition,
      }),
    [bootstrap.pack, waveHeight, wavePosition],
  );
  // One for the scene's life: switched between the music and the calm motion
  // in place, so a background changed from one to the other eases across
  // instead of starting its scene again.
  const [shaper] = useState(() => createCalmShaper(motion));
  useEffect(() => shaper.setMotion(motion), [shaper, motion]);
  const host = useSceneRunner({
    source,
    ...size,
    spectrumRect,
    shapeFrame: shaper.shape,
    performance,
    asleep,
    // The listener's own controls and timing for this visualizer, read on the
    // frames it draws, so moving a slider in the window moves the desktop.
    ...(tuning ? { tuning } : {}),
    onDrawn,
  });
  useEffect(() => {
    const resize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  // The fade's own end says it is over, and so does its being cut short,
  // which React has no prop for. Only this layer's opacity counts: the
  // canvas inside has a fade of its own whose end bubbles through here.
  const crossedRef = useRef(onCrossed);
  crossedRef.current = onCrossed;
  useEffect(() => {
    const element = host.current;
    if (!element || stage !== 'leaving') {
      return undefined;
    }
    const finish = (event: TransitionEvent) => {
      if (event.target === element && event.propertyName === 'opacity') {
        crossedRef.current(generation);
      }
    };
    element.addEventListener('transitionend', finish);
    element.addEventListener('transitioncancel', finish);
    return () => {
      element.removeEventListener('transitionend', finish);
      element.removeEventListener('transitioncancel', finish);
    };
  }, [host, stage, generation]);
  return <div ref={host} className={STAGE_CLASS[stage]} aria-hidden="true" />;
}
