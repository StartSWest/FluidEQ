import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IScenePerformance } from 'common/scenePerformance';
import { SMOOTH_FRAME_MS, shouldDrawFrame } from 'common/smoothing';
import {
  type IWallpaperAudio,
  type IWallpaperBootstrap,
  type IWallpaperSurfaceBridge,
  type IWallpaperSurfaceState,
  type IWallpaperWave,
  type TWallpaperMotion,
} from 'common/wallpaper';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import { createCostLadder } from '../graph/sceneHealth';
import { createWarmupLadder } from '../graph/sceneWarmup';
import { createFlashGuard } from '../graph/sceneFlashGuard';
import useSceneRunner, { type ISceneSource } from '../graph/useSceneRunner';
import { studioSpectrumRect } from '../studio/studioWave';
import { createCalmShaper } from './calmMotion';

const SILENCE: IWallpaperAudio = { points: [], waveform: [] };

function Scene({
  bootstrap,
  bridge,
  generation,
  wave,
  motion,
  performance,
}: {
  bootstrap: IWallpaperBootstrap;
  bridge: IWallpaperSurfaceBridge;
  generation: number;
  wave: IWallpaperWave;
  motion: TWallpaperMotion;
  /** Main's copy of the window's choice: this page has no store of its own. */
  performance: IScenePerformance;
}) {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const reported = useRef(false);
  const source = useMemo<ISceneSource>(
    () => ({
      identity: bootstrap.pack.id,
      version: String(bootstrap.pack.version),
      name: bootstrap.pack.names.en,
      load: async () => bootstrap.pack,
      block: () => bridge.failed(),
      // The scene's own failure, with its reason, so main keeps that code from
      // running again — on this monitor and wherever else it is shown.
      reportFailure: (reason) => bridge.failed(reason),
      tooSlow: () => bridge.failed(),
      createLadder: bootstrap.member ? createWarmupLadder : createCostLadder,
      createGuard: bootstrap.member ? createFlashGuard : undefined,
      restsInSilence: true,
    }),
    [bootstrap, bridge],
  );
  const onDrawn = useCallback(() => {
    if (!reported.current) {
      reported.current = true;
      bridge.drawn(generation);
    }
  }, [bridge, generation]);
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
    onDrawn,
  });
  useEffect(() => {
    const resize = () =>
      setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  return <div ref={host} className="wallpaper-scene" aria-hidden="true" />;
}

export default function WallpaperSurface({
  bridge,
}: {
  bridge: IWallpaperSurfaceBridge;
}) {
  const [bootstrap, setBootstrap] = useState<IWallpaperBootstrap>();
  const [state, setState] = useState<IWallpaperSurfaceState>();
  const heard = useRef<IWallpaperAudio>(SILENCE);
  const readFrame = useCallback(() => heard.current, []);
  const audio = useMemo(
    () => ({ ...SILENCE, isPaused: false, readFrame }),
    [readFrame],
  );
  useEffect(() => {
    let cancelled = false;
    let changed = false;
    const unsubscribe = bridge.onState((next) => {
      changed = true;
      setState(next);
    });
    bridge
      .bootstrap()
      .then((value) => {
        if (cancelled) {
          return undefined;
        }
        if (!value) {
          bridge.failed();
          return undefined;
        }
        setBootstrap(value);
        if (!changed) {
          setState(value.state);
        }
        return undefined;
      })
      .catch(() => {
        if (!cancelled) {
          bridge.failed();
        }
      });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [bridge]);
  const playing = state?.phase === 'starting' || state?.phase === 'running';
  // A calm background never asks for the music, and main would not send it.
  const listening = playing && state?.motion === 'music';
  useEffect(() => {
    if (!listening) {
      heard.current = SILENCE;
      return undefined;
    }
    let stopped = false;
    let frameId: number | undefined;
    let requestedAt = 0;
    const pull = (now: number) => {
      if (!shouldDrawFrame(now - requestedAt, SMOOTH_FRAME_MS)) {
        frameId = requestAnimationFrame(pull);
        return;
      }
      requestedAt = now;
      bridge
        .requestAudio()
        .then((frame) => {
          if (stopped) {
            return undefined;
          }
          heard.current = frame ?? SILENCE;
          frameId = requestAnimationFrame(pull);
          return undefined;
        })
        .catch(() => {
          if (!stopped) {
            bridge.failed();
          }
        });
    };
    frameId = requestAnimationFrame(pull);
    return () => {
      stopped = true;
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [bridge, listening]);
  // Offscreen Chromium stays visible to the scheduler. Removing the scene
  // releases its worker/GPU context as soon as desktop policy pauses it.
  return bootstrap && state && playing ? (
    <SceneAudioProvider value={audio}>
      <Scene
        key={state.renderGeneration}
        bootstrap={bootstrap}
        bridge={bridge}
        generation={state.renderGeneration}
        wave={state.wave}
        motion={state.motion}
        performance={state.performance}
      />
    </SceneAudioProvider>
  ) : null;
}
