/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useState } from 'react';
import type { ISceneAudio } from '../audio/SceneAudioContext';
import { reportError } from '../utils/logger';
import createPublishDemoAudio from './publishDemoAudio';

type TDemo = ReturnType<typeof createPublishDemoAudio>;

const nothing = () => undefined;

/** Before the demo has started, or where it could not. */
const SILENT: ISceneAudio = {
  points: [],
  waveform: [],
  isPaused: true,
  readFrame: nothing,
};

export interface IPublishSignal {
  /** What the scene hears, for its `SceneAudioProvider`. */
  audio: ISceneAudio;
  /**
   * The demo could not be read or started: the scene rests, and a take
   * asked for now would wait for sound that never comes, so it fails.
   */
  failed: boolean;
}

/**
 * What the scene in the Publish dialog hears: the demo loop that ships with
 * the app (`publishDemoAudio.ts`), measured without a sound, from the moment
 * the dialog opens until it closes (Ivan, 2026-11-23: "instead of allowing
 * them to play their own music, we just automatically record ... using a
 * demo music. We don't need to hear the music ... we need to actually make
 * it move like if there were some music"). The member's own music used to
 * be the first choice, and a cover or a clip waited on it: a quiet track
 * held the take, a paused player stopped it, and Demo was a second button
 * to find. Every clip is now shot on the same song, so two scenes in the
 * gallery are compared on the same music, and nothing in the dialog waits on
 * a player.
 */
export default function usePublishSignal(): IPublishSignal {
  const [demo, setDemo] = useState<TDemo>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let playing: TDemo;
    try {
      playing = createPublishDemoAudio(false, { audible: false });
    } catch (error) {
      reportError('Starting the publish demo', error);
      setFailed(true);
      return undefined;
    }
    setDemo(playing);
    playing.ready.catch((error: unknown) => {
      reportError('Starting the publish demo', error);
      setDemo((current) => (current === playing ? undefined : current));
      setFailed(true);
    });
    return () => {
      setDemo((current) => (current === playing ? undefined : current));
      playing
        .stop()
        .catch((error: unknown) =>
          reportError('Stopping the publish demo', error),
        );
    };
  }, []);

  const audio = useMemo<ISceneAudio>(
    () =>
      demo
        ? {
            // The demo's own arrays, filled in place by `readFrame`: never
            // empty, so the runner wakes a scene that had come to rest.
            points: demo.points,
            waveform: demo.waveform,
            isPaused: false,
            readFrame: demo.readFrame,
          }
        : SILENT,
    [demo],
  );
  return { audio, failed };
}
