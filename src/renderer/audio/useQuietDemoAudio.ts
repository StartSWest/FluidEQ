import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveAudioControl, useLiveAudioFrame } from './LiveAudioContext';
import { useSceneAudio, type ISceneAudio } from './SceneAudioContext';
import { useTransportSources } from './transportSource';
import createPublishDemoAudio from '../studio/publishDemoAudio';

type TDemoAudio = ReturnType<typeof createPublishDemoAudio>;

/**
 * Music plainly playing: the output meter's held peak above this, in dBFS.
 * The meter reads from -60; a song's quietest passages still peak around
 * -40 and its body at -20 to -6, while the hum and tails that flickered sit
 * at the capture's -95 floor, nowhere near it.
 */
const MUSIC_DB = -48;

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
 *
 * TWO LEVELS, NOT ONE (Ivan, 2026-11-09: "is glitching because the sound
 * threshold make it come and goes fast, needs to be smooth"). Heard used to
 * mean anything over the capture's floor, both ways: a sound hovering at
 * that floor - a faint hum, a fade's tail, another program idling - was
 * over it one frame and under it the next, and the scene and its tag swapped
 * between the music and the demo many times a second. Music now has to be
 * plainly there to take the scene back from the demo (`MUSIC_DB` on the
 * meter's held peak, far above the floor), and only true silence gives the
 * scene to the demo; anything in between keeps what it has.
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
  const { outputLevels } = useLiveAudioFrame();
  const anything = !live.isPaused && live.points.length > 0;
  const plain =
    anything && outputLevels.some(({ peakDb }) => peakDb > MUSIC_DB);
  // Kept between renders, and set while rendering when it changes, so the
  // music and the demo never disagree for a render.
  const [heard, setHeard] = useState(false);
  const nowHeard = heard ? anything : plain;
  if (nowHeard !== heard) {
    setHeard(nowHeard);
  }
  // The capture's error is the empty string while it has none.
  const wanted =
    listening && (isActive || error !== '') && !nowHeard && !playerPlays;

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
