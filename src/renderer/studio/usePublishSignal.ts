/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSceneAudio, type ISceneAudio } from '../audio/SceneAudioContext';
import { reportError } from '../utils/logger';
import createPublishDemoAudio from './publishDemoAudio';
import type { TCameraSignal } from './publishCameraSettings';
import type { TPublishVideoState } from './usePublishVideo';

type TDemo = ReturnType<typeof createPublishDemoAudio>;

const SILENCE = { points: [], waveform: [], sound: undefined };

export interface IPublishSignal {
  /** What the stage listens to, and what the preview clip is keyed on. */
  signal: TCameraSignal;
  /** The demo loop is sounding: Demo reads as chosen only while it is. */
  demoPlaying: boolean;
  select: (next: TCameraSignal) => void;
  startDemo: () => void;
  stopDemo: () => void;
  /** What the scene hears, for its `SceneAudioProvider`. */
  audio: ISceneAudio;
  /** The member's player is paused, read at the moment it is asked. */
  livePaused: () => boolean;
}

/**
 * What the scene in the Publish dialog hears: the member's music, or the
 * demo loop that ships with the app (`publishDemoAudio.ts`). The loop
 * follows the member's player into a pause, as it always has, and a loop
 * that cannot be read or started is a failed take (`onFail`).
 */
export default function usePublishSignal(onFail: () => void): IPublishSignal {
  const liveAudio = useSceneAudio();
  const [signal, setSignal] = useState<TCameraSignal>('live');
  const [demoPlaying, setDemoPlaying] = useState(false);
  const failRef = useRef(onFail);
  failRef.current = onFail;
  const signalRef = useRef(signal);
  signalRef.current = signal;
  const audioRef = useRef(liveAudio);
  audioRef.current = liveAudio;
  const demo = useRef<TDemo | undefined>(undefined);

  const release = useCallback(() => {
    const playing = demo.current;
    demo.current = undefined;
    playing
      ?.stop()
      .catch((error: unknown) =>
        reportError('Stopping the preview demo', error),
      );
  }, []);
  // On closing: the loop's context goes with the dialog.
  useEffect(() => release, [release]);

  const stopDemo = useCallback(() => {
    release();
    setDemoPlaying(false);
  }, [release]);

  const startDemo = useCallback(() => {
    release();
    try {
      const playing = createPublishDemoAudio(audioRef.current.isPaused);
      demo.current = playing;
      setDemoPlaying(true);
      playing.ready.catch(() => {
        if (demo.current === playing) {
          stopDemo();
          failRef.current();
        }
      });
    } catch {
      setDemoPlaying(false);
      failRef.current();
    }
  }, [release, stopDemo]);

  useEffect(() => {
    const playing = demo.current;
    playing?.setPaused(liveAudio.isPaused).catch(() => {
      if (demo.current === playing) {
        stopDemo();
        failRef.current();
      }
    });
  }, [demoPlaying, liveAudio.isPaused, stopDemo]);

  const select = useCallback(
    (next: TCameraSignal) => {
      if (next === 'showcase') {
        startDemo();
      } else {
        stopDemo();
      }
      setSignal(next);
    },
    [startDemo, stopDemo],
  );

  const audio = useMemo<ISceneAudio>(
    () => ({
      points: signal === 'live' ? liveAudio.points : [],
      waveform: signal === 'live' ? liveAudio.waveform : [],
      isPaused: liveAudio.isPaused,
      readFrame: () =>
        signalRef.current === 'live'
          ? audioRef.current.readFrame()
          : (demo.current?.readFrame() ?? SILENCE),
    }),
    [signal, liveAudio.points, liveAudio.waveform, liveAudio.isPaused],
  );
  const livePaused = useCallback(() => audioRef.current.isPaused, []);

  return {
    signal,
    demoPlaying,
    select,
    startDemo,
    stopDemo,
    audio,
    livePaused,
  };
}

/**
 * THE DEMO ENDS WITH THE TAKE IT WAS RECORDED ON (Ivan, 2026-11-18: "When
 * it's done recording, I want to stop the demo, if they used the demo for
 * recording. Stop it, and that's it."). The loop played on for as long as the
 * dialog stayed open, because nothing but the member's own press ever
 * stopped it. Now the moment a take on the demo is finished the loop stops
 * and Demo reads as unchosen; the member's own music is never touched. The
 * clip stays keyed on the demo, so it is kept, and Demo pressed again plays
 * the loop for the live scene without recording anything.
 *
 * A new take on the demo — Record again, or the hour changed — needs the
 * loop to hear, so it starts it again. Both on the phase's change alone: a
 * press of Demo after the take must not be undone by the rule that ended it.
 */
export function useDemoEndsWithTake(
  hearing: IPublishSignal,
  phase: TPublishVideoState['phase'],
) {
  const { signal, demoPlaying, startDemo, stopDemo } = hearing;
  const lastPhase = useRef(phase);
  useEffect(() => {
    const before = lastPhase.current;
    lastPhase.current = phase;
    if (signal !== 'showcase' || before === phase) {
      return;
    }
    if (phase === 'ready') {
      stopDemo();
    } else if (phase === 'waiting' && !demoPlaying) {
      startDemo();
    }
  }, [phase, signal, demoPlaying, startDemo, stopDemo]);
}
