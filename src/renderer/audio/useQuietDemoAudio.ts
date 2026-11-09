import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveAudioControl } from './LiveAudioContext';
import { useSceneAudio, type ISceneAudio } from './SceneAudioContext';
import { useTransportSources } from './transportSource';
import createPublishDemoAudio from '../studio/publishDemoAudio';

type TDemoAudio = ReturnType<typeof createPublishDemoAudio>;

/**
 * What a scene previewed in the Gallery or on the Studio's stage hears: the
 * music playing, or, while nothing is, the app's own demo song measured
 * without a sound (Ivan, 2026-11-09: "if there is no audio playing the scenes
 * on preview use a fake audio but that don't sound, just move, and tell that
 * in the scene ... and if audio, automatically pick up the audio playing";
 * and for the Studio, "playing with demo data if no sound"). A scene that
 * only ever heard the capture sat at rest with nothing playing and looked
 * broken.
 *
 * Quiet is a state, never a stretch of time: nothing heard by the capture
 * (whose own floor already calls anything under -95 dBFS silence) AND no
 * player reporting that it plays. The second half is what keeps the gap
 * between two songs on the music: the player still says it is playing there,
 * so the demo does not blink on for a second of silence, and it starts the
 * moment the music is paused or stopped. Sound from a program that reports
 * nothing is heard by the capture and wins at once. Nothing is decided until
 * the capture has started (or failed), so a page opened over music does not
 * flash the demo while the capture opens.
 * The demo's audio context exists only while it is wanted, and never while
 * the page is not `listening` to the music at all: the Studio's made-up test
 * signals replace everything the scene hears, so a demo under them would be
 * measured for nobody - and Silence has to stay silence.
 */
export default function useQuietDemoAudio(listening = true): {
  audio: ISceneAudio;
  /** True while the scene moves to the demo song, for the page's tag. */
  demo: boolean;
} {
  const live = useSceneAudio();
  const { isActive, error } = useLiveAudioControl();
  const sources = useTransportSources();
  const playerPlays = Object.values(sources).some(
    (source) => source?.isPlaying === true,
  );
  const heard = !live.isPaused && live.points.length > 0;
  // The capture's error is the empty string while it has none.
  const wanted =
    listening && (isActive || error !== '') && !heard && !playerPlays;

  const [playing, setPlaying] = useState<TDemoAudio>();
  const playingRef = useRef<TDemoAudio | undefined>(undefined);
  useEffect(() => {
    if (!wanted) {
      return undefined;
    }
    let demo: TDemoAudio;
    try {
      demo = createPublishDemoAudio(false, { audible: false });
    } catch {
      // No audio context to be had: the scene rests, as it did before.
      return undefined;
    }
    playingRef.current = demo;
    setPlaying(demo);
    // A demo that cannot start (its file missing, audio refused) is dropped:
    // the scene rests as before, and the tag never claims a song it is not
    // moving to.
    demo.ready.catch(() => {
      if (playingRef.current === demo) {
        playingRef.current = undefined;
        setPlaying(undefined);
      }
    });
    return () => {
      if (playingRef.current === demo) {
        playingRef.current = undefined;
      }
      setPlaying((current) => (current === demo ? undefined : current));
      demo.stop().catch(() => undefined);
    };
  }, [wanted]);

  const demo = wanted && playing !== undefined;
  const audio = useMemo<ISceneAudio>(
    () =>
      demo && playing
        ? {
            // The demo's own arrays, filled in place by `readFrame`: never
            // empty, so the runner wakes a scene that had come to rest in the
            // silence before the demo began.
            points: playing.points,
            waveform: playing.waveform,
            isPaused: false,
            readFrame: playing.readFrame,
          }
        : live,
    [demo, playing, live],
  );
  return { audio, demo };
}
