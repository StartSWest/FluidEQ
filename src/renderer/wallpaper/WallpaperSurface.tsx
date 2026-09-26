import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type {
  IWallpaperAudio,
  IWallpaperSurfaceBridge,
} from 'common/wallpaper';
import { SceneAudioProvider } from '../audio/SceneAudioContext';
import { prefersReducedMotion } from '../utils/bandReveal';
import {
  layersOf,
  needsScene,
  NO_CROSSFADE,
  stepCrossfade,
} from './sceneCrossfade';
import WallpaperSceneLayer from './WallpaperSceneLayer';

const SILENCE: IWallpaperAudio = { points: [], waveform: [] };

export default function WallpaperSurface({
  bridge,
}: {
  bridge: IWallpaperSurfaceBridge;
}) {
  const [fade, dispatch] = useReducer(stepCrossfade, NO_CROSSFADE);
  const state = fade.latest;
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
  // is on the wire; each frame draws with the newest answer — both layers'
  // frames while two are crossing.
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
  useEffect(
    () => bridge.onState((next) => dispatch({ kind: 'state', state: next })),
    [bridge],
  );
  // The scene is asked for at the start and again for each newer one main
  // announces (`needsScene`); an answer lands whenever it lands, and the
  // crossfade decides what it is (`stepCrossfade`).
  const asking = needsScene(fade);
  useEffect(() => {
    if (!asking) {
      return;
    }
    dispatch({ kind: 'asking' });
    bridge
      .bootstrap()
      .then((value) => {
        if (!value) {
          bridge.failed();
        }
        dispatch({ kind: 'answered', bootstrap: value });
        return undefined;
      })
      .catch(() => {
        bridge.failed();
        dispatch({ kind: 'answered', bootstrap: undefined });
      });
  }, [asking, bridge]);
  const onFirstFrame = useCallback(
    (generation: number) =>
      dispatch({
        kind: 'drawn',
        generation,
        reducedMotion: prefersReducedMotion(),
      }),
    [],
  );
  const onCrossed = useCallback(
    (generation: number) => dispatch({ kind: 'crossed', generation }),
    [],
  );
  // A paused background keeps its scene and its last frame, and draws
  // nothing: the window is never hidden, so taking the scene down would
  // leave the desktop black where its picture was, and bring it back only
  // after a whole build. Offscreen Chromium stays visible to the scheduler,
  // so the frames have to be stopped where they are asked for — `asleep`.
  return state ? (
    <SceneAudioProvider value={audio}>
      <div className="wallpaper-stage">
        {layersOf(fade).map(({ layer, stage }) => (
          <WallpaperSceneLayer
            key={layer.generation}
            layer={layer}
            stage={stage}
            current={layer.generation === state.renderGeneration}
            bridge={bridge}
            performance={state.performance}
            asleep={!playing}
            onFirstFrame={onFirstFrame}
            onCrossed={onCrossed}
          />
        ))}
      </div>
    </SceneAudioProvider>
  ) : null;
}
