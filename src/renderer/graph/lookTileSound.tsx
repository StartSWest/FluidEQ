/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadAudioClock,
  startAudioClock,
  type IAudioClock,
} from '../audio/audioClock';
import {
  useIsLiveAudioProvided,
  useLiveAudioCapture,
  useLiveAudioFrames,
  type IAudioStandIn,
} from '../audio/LiveAudioContext';
import type { ILiveAudioFrame, ILiveFrameStore } from '../audio/liveFrameStore';
import useQuietDemoAudio, { type TDemoAudio } from '../audio/useQuietDemoAudio';
import type { ILiveFrame } from './liveFrameReader';

/**
 * What the look picker's live tiles draw (`LookTileArt`): the music
 * playing, or - while nothing is - the demo song measured without a sound,
 * as a scene previewed in the Gallery moves to it (`useQuietDemoAudio`).
 * Undefined until one of them is actually there: the tiles keep their
 * stills until then, and never swap them for flat lines while the capture
 * opens or the song decodes.
 *
 * READ ONCE FOR EVERY TILE. The graph reads the analyser again at every
 * frame it draws, a fresh transform of the long window each time, and
 * renders on every frame the capture publishes. Forty tiles doing that were
 * forty transforms and forty renders per frame. Here the frame is taken
 * once - the capture's own as it publishes it, or the demo's on its audio
 * clock at the capture's rate - and every tile's drawing reads that same
 * frame when the tiles' one loop draws it (`lookTileLoop.ts`). The frames
 * the drawings render on never change after they mount (`stillFrames`), so
 * no tile re-renders for the music at all.
 */
const TileSoundContext = createContext<IAudioStandIn | undefined>(undefined);

/** The sound the styles grid's live tiles draw, once there is one. */
export const useTileSound = () => useContext(TileSoundContext);

/** A frame as a drawing reads one, from a frame as the capture publishes it. */
const asLiveFrame = (frame: ILiveAudioFrame): ILiveFrame => ({
  points: frame.points,
  graphPoints: frame.graphPoints,
  waveform: frame.waveform,
  audioMs: 0,
  channelPeaks: [],
});

/**
 * The frame a drawing mounts on, and nothing after: it only has to give the
 * drawing its points (their number above all); what it draws is read fresh.
 */
const stillFrames = (frame: ILiveAudioFrame): ILiveFrameStore => ({
  read: () => frame,
  subscribe: () => () => undefined,
});

const EMPTY_FRAME: ILiveAudioFrame = {
  graphPoints: [],
  points: [],
  waveform: [],
  isClipping: false,
  outputLevels: [],
};

/**
 * The demo song, taken once on each tick of its own audio clock
 * (`audioClock.ts`: the capture's thirty a second) and copied, because the
 * reader writes its next frame into the same arrays. Undefined until the
 * first frame with music is in, and where the clock cannot run - which
 * leaves the tiles on their stills: there is nothing honest to draw instead.
 */
const useDemoSound = (demo: TDemoAudio | undefined) => {
  const [sound, setSound] = useState<IAudioStandIn>();
  useEffect(() => {
    if (!demo) {
      return undefined;
    }
    const { context } = demo.tap;
    let latest: ILiveFrame | undefined;
    let made: IAudioStandIn | undefined;
    const take = () => {
      const read = demo.readFrame();
      if (read.graphPoints.length === 0) {
        return;
      }
      latest = {
        points: read.points.map((point) => ({ ...point })),
        graphPoints: read.graphPoints.map((point) => ({ ...point })),
        waveform: [...read.waveform],
        audioMs: read.audioMs,
        channelPeaks: [...read.channelPeaks],
      };
      if (!made) {
        made = {
          frames: stillFrames({ ...EMPTY_FRAME, ...latest }),
          readFrame: () => latest,
          tap: demo.tap,
        };
        setSound(made);
      }
    };
    let clock: IAudioClock | undefined;
    let stopped = false;
    const start = async () => {
      await Promise.all([demo.ready, loadAudioClock(context)]);
      if (!stopped) {
        clock = startAudioClock(context, take);
      }
    };
    start().catch(() => undefined);
    return () => {
      stopped = true;
      clock?.close();
      setSound(undefined);
    };
  }, [demo]);
  return sound;
};

/**
 * The capture's frames as the tiles read them: the store's newest, read
 * when a tile draws - the capture has already published it, so nothing is
 * transformed again - on frames made anew only when the number of points
 * changes (another sample rate), which is what a drawing mounts on.
 */
const useMusicSound = (music: boolean) => {
  const frames = useLiveAudioFrames();
  const [count, setCount] = useState(() => frames.read().graphPoints.length);
  useEffect(() => {
    if (!music) {
      return undefined;
    }
    return frames.subscribe(() => setCount(frames.read().graphPoints.length));
  }, [frames, music]);
  return useMemo<IAudioStandIn | undefined>(() => {
    const now = frames.read();
    if (!music || count === 0 || now.graphPoints.length !== count) {
      return undefined;
    }
    let seen = now;
    let read = asLiveFrame(now);
    return {
      frames: stillFrames(now),
      readFrame: () => {
        const newest = frames.read();
        if (newest !== seen) {
          seen = newest;
          read = asLiveFrame(newest);
        }
        return read;
      },
    };
  }, [frames, music, count]);
};

/**
 * Decides the sound and holds what it needs: the capture claimed, as any
 * drawing of it does, and the demo's silent audio context while nothing
 * plays. A hidden window releases the capture, which takes the demo away
 * with it (`useQuietDemoAudio`), and the tiles back to their stills.
 */
const TileSoundReader = ({
  onSound,
}: {
  onSound: (sound: IAudioStandIn | undefined) => void;
}) => {
  useLiveAudioCapture(true);
  const { demoAudio, music } = useQuietDemoAudio();
  const demo = useDemoSound(music ? undefined : demoAudio);
  const live = useMusicSound(music);
  const sound = music ? live : demo;
  useEffect(() => onSound(sound), [sound, onSound]);
  useEffect(() => () => onSound(undefined), [onSound]);
  return null;
};

/**
 * The sound of the styles grid, from the first tile that plays (`listening`)
 * for as long as the grid is open.
 */
export const LookTileSoundScope = ({
  listening,
  children,
}: {
  listening: boolean;
  children: ReactNode;
}) => {
  const [sound, setSound] = useState<IAudioStandIn>();
  const hasCapture = useIsLiveAudioProvided();
  return (
    <TileSoundContext.Provider value={sound}>
      {hasCapture && listening && <TileSoundReader onSound={setSound} />}
      {children}
    </TileSoundContext.Provider>
  );
};
