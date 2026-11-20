import { useEffect, useMemo, useRef, useState } from 'react';
import {
  useLiveAudioControl,
  useLiveAudioFrameSelector,
} from './LiveAudioContext';
import { useSceneAudio, type ISceneAudio } from './SceneAudioContext';
import { useTransportSources } from './transportSource';
import { LEVEL_FLOOR_DB } from '../graph/outputLevel';
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
 * Music is what the capture HEARS, never what a player says. A player
 * reporting that it plays only keeps music that was heard - through the gap
 * between two songs, where the player still says it plays, so the demo does
 * not blink on for a second of silence - and the demo starts the moment the
 * music is paused or stopped. Sound from a program that reports nothing is
 * heard by the capture and wins at once. Nothing is decided until the capture
 * has started (or failed), so a page opened over music does not flash the
 * demo while the capture opens.
 *
 * TWO LEVELS, NOT ONE (Ivan, 2026-11-09: "is glitching because the sound
 * threshold make it come and goes fast, needs to be smooth"). Heard used to
 * mean anything over the capture's floor, both ways: a sound hovering at
 * that floor - a faint hum, a fade's tail, another program idling - was
 * over it one frame and under it the next, and the scene and its tag swapped
 * between the music and the demo many times a second. Music has to be
 * plainly there to take the scene from the demo (`MUSIC_DB` on the meter's
 * held peak), and it is gone once the meter shows nothing at all (every held
 * peak at `LEVEL_FLOOR_DB`, 12 dB under that) or the capture hears nothing;
 * anything in between keeps what it has.
 *
 * WHY THE PREVIEW SAT STILL (Ivan, 2026-11-19: "if not [sound] it should a
 * demo not the sound but the animation"). Two rules here could each hold a
 * scene on silence while its tag said it was playing on the music. Any
 * player saying it plays kept the demo off whether or not anything had been
 * heard, and a game in front always says it plays (`gameSource`), as a paused
 * browser tab's media session can. And once music had been heard, only the
 * capture's own -95 dBFS floor handed the scene back, so a faint sound left
 * after the music - another program idling, a device's hiss - kept it on the
 * silence for good.
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
  const isLoud = useLiveAudioFrameSelector(({ outputLevels }) =>
    outputLevels.some(({ peakDb }) => peakDb > MUSIC_DB),
  );
  // The meter shows nothing: every channel's held peak at its floor.
  const isUnderMeter = useLiveAudioFrameSelector(({ outputLevels }) =>
    outputLevels.every(({ peakDb }) => peakDb <= LEVEL_FLOOR_DB),
  );
  const anything = !live.isPaused && live.points.length > 0;
  const plain = anything && isLoud;
  const gone = !anything || isUnderMeter;
  // Kept between renders, and set while rendering when it changes, so the
  // music and the demo never disagree for a render. A player saying it plays
  // keeps music that was heard, through the gap between two songs; it never
  // stands for music on its own.
  const [heard, setHeard] = useState(false);
  const nowHeard = heard ? !gone || playerPlays : plain;
  if (nowHeard !== heard) {
    setHeard(nowHeard);
  }
  // The capture's error is the empty string while it has none.
  const wanted = listening && (isActive || error !== '') && !nowHeard;

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
