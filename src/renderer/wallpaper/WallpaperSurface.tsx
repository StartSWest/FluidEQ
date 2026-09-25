import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { IScenePerformance } from 'common/scenePerformance';
import {
  type IWallpaperAudio,
  type IWallpaperBootstrap,
  type IWallpaperSurfaceBridge,
  type IWallpaperSurfaceState,
  type IWallpaperTuning,
  type IWallpaperWave,
  type TWallpaperMotion,
} from 'common/wallpaper';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
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
  tuning,
  asleep,
}: {
  bootstrap: IWallpaperBootstrap;
  bridge: IWallpaperSurfaceBridge;
  generation: number;
  wave: IWallpaperWave;
  motion: TWallpaperMotion;
  /** Paused: the picture stays on the desktop and no frame is drawn. */
  asleep: boolean;
  /** Main's copy of the window's choice: this page has no store of its own. */
  performance: IScenePerformance;
  /** And of what the listener set for this visualizer, when they set any. */
  tuning: IWallpaperTuning | undefined;
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
      // Main's word on whose scene it is, the same answer the window's own
      // list gives: the listener's own is run as their own here too. Told
      // only that a member had made it, this page ran the listener's own
      // scene through the brightness limiter and ghosted it on the desktop
      // while the Studio showed it clean.
      madeBy: bootstrap.madeBy,
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
  return <div ref={host} className="wallpaper-scene" aria-hidden="true" />;
}

export default function WallpaperSurface({
  bridge,
}: {
  bridge: IWallpaperSurfaceBridge;
}) {
  const [bootstrap, setBootstrap] = useState<IWallpaperBootstrap>();
  const [state, setState] = useState<IWallpaperSurfaceState>();
  const playing = state?.phase === 'starting' || state?.phase === 'running';
  // A calm background never asks for the music, and main would not send it.
  const listening = playing && state?.motion === 'music';
  const heard = useRef<IWallpaperAudio>(SILENCE);
  const listeningRef = useRef(listening);
  /**
   * Which stretch of listening a read belongs to: a pause, or a switch to
   * the calm motion, starts another, and an answer from before it is late.
   */
  const stretchRef = useRef(0);
  const readingRef = useRef(false);
  // The music is read when the scene draws a frame, as the graph reads its
  // own analyser on every frame it draws. It used to be read on a clock of
  // its own at thirty a second, so on a display drawing at its own rate
  // everything the music moves here stepped at thirty, beside a graph and a
  // Studio that heard it on every frame. Asked only while a frame is drawn,
  // it stops by itself while the background is paused, and at most one read
  // is on the wire; each frame draws with the newest answer.
  const readFrame = useCallback(() => {
    if (listeningRef.current && !readingRef.current) {
      readingRef.current = true;
      const stretch = stretchRef.current;
      bridge
        .requestAudio()
        .then((frame) => {
          readingRef.current = false;
          if (stretch === stretchRef.current) {
            heard.current = frame ?? SILENCE;
          }
          return undefined;
        })
        .catch(() => {
          readingRef.current = false;
          if (stretch === stretchRef.current) {
            bridge.failed();
          }
        });
    }
    return heard.current;
  }, [bridge]);
  const audio = useMemo(
    () => ({ ...SILENCE, isPaused: false, readFrame }),
    [readFrame],
  );
  useEffect(() => {
    listeningRef.current = listening;
    stretchRef.current += 1;
    if (!listening) {
      heard.current = SILENCE;
    }
  }, [listening]);
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
  // A paused background keeps its scene and its last frame, and draws
  // nothing: the window is never hidden, so taking the scene down would
  // leave the desktop black where its picture was, and bring it back only
  // after a whole build. Offscreen Chromium stays visible to the scheduler,
  // so the frames have to be stopped where they are asked for — `asleep`.
  return bootstrap && state ? (
    <SceneAudioProvider value={audio}>
      <Scene
        key={state.renderGeneration}
        bootstrap={bootstrap}
        bridge={bridge}
        generation={state.renderGeneration}
        wave={state.wave}
        motion={state.motion}
        performance={state.performance}
        tuning={state.tuning}
        asleep={!playing}
      />
    </SceneAudioProvider>
  ) : null;
}
