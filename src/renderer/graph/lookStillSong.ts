/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { GraphStyle } from 'common/graphStyles';
import type { IAudioStandIn } from '../audio/LiveAudioContext';
import { createLiveFrameStore } from '../audio/liveFrameStore';
import { connectDemoReader, readDemoMusic } from '../studio/publishDemoAudio';
import { PHASE_SPAN_MS } from './analysis/phaseView';
import { UPDATE_INTERVAL_MS } from './liveSpectrumFrames';

/**
 * The stretch of the demo song a look picker's still is drawn against
 * (`LookStillPainter`), played in an offline audio context faster than it
 * plays and stopped at every frame's moment for the drawing to draw it, as
 * the review measures a scene against the demo (`sceneFlashMusic.ts`). A
 * still is then the look as it stands after this much of the song: every
 * reading - the spectrum, the wave, each channel's samples for the stereo
 * views - is the song at that moment, and the same on every machine.
 */

/**
 * How much song a still has heard. Enough for the Spectrogram to fill most
 * of a tile (a row each 25 ms: 120 rows on a plate 128 to 200 px wide), the
 * peak holds to stand where the music put them and the scenes' clocks to
 * have moved; at a frame each `UPDATE_INTERVAL_MS`, 90 drawings a still.
 */
export const STILL_SECONDS = 3;

/**
 * How much song a look's still hears: `STILL_SECONDS`, or the whole strip
 * of a look whose history is longer - Phase history holds twenty seconds,
 * and three of them drew a hairline at the plate's edge.
 */
export const stillSecondsOf = (style: GraphStyle): number =>
  style === 'phase' ? PHASE_SPAN_MS / 1000 : STILL_SECONDS;

/** The song's frames a second, read in blocks of this many seconds. */
const BLOCK_SECONDS = 0.25;

/**
 * Where the loudest `STILL_SECONDS` of the song begin: a still drawn over a
 * quiet intro would picture a look at rest. Energy summed per block and
 * slid across the loop, its join included.
 */
export const loudestStretch = (music: AudioBuffer): number => {
  const blockFrames = Math.max(1, Math.round(music.sampleRate * BLOCK_SECONDS));
  const blocks = Math.floor(music.length / blockFrames);
  const span = Math.round(STILL_SECONDS / BLOCK_SECONDS);
  if (blocks <= span) {
    return 0;
  }
  const energy = new Float64Array(blocks);
  for (let channel = 0; channel < music.numberOfChannels; channel += 1) {
    const samples = music.getChannelData(channel);
    for (let block = 0; block < blocks; block += 1) {
      let sum = 0;
      const end = (block + 1) * blockFrames;
      for (let at = block * blockFrames; at < end; at += 1) {
        sum += samples[at] * samples[at];
      }
      energy[block] += sum;
    }
  }
  let running = 0;
  for (let block = 0; block < span; block += 1) {
    running += energy[block];
  }
  let best = running;
  let bestStart = 0;
  for (let start = 1; start < blocks; start += 1) {
    running += energy[(start + span - 1) % blocks] - energy[start - 1];
    if (running > best) {
      best = running;
      bestStart = start;
    }
  }
  return (bestStart * blockFrames) / music.sampleRate;
};

interface IDemoMusic {
  music: AudioBuffer;
  /** Where its loudest stretch begins, in seconds. */
  startAt: number;
}

/** The song decoded, once a session; undefined where it cannot be had. */
let decoded: Promise<IDemoMusic | undefined> | undefined;

const demoMusic = (): Promise<IDemoMusic | undefined> => {
  if (!decoded) {
    decoded = (async () => {
      if (typeof OfflineAudioContext === 'undefined') {
        return undefined;
      }
      const bytes = await readDemoMusic();
      if (!bytes) {
        return undefined;
      }
      // A copy of exactly the file's bytes: decoding takes its buffer over.
      const music = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
        bytes.slice().buffer,
      );
      return { music, startAt: loudestStretch(music) };
    })().catch(() => undefined);
  }
  return decoded;
};

/** The demo song, held at its first frame until a drawing plays it. */
export interface IStillSong extends IAudioStandIn {
  /**
   * Plays the stretch to its end, `onStep` called at every frame's moment
   * with the time since the last, and resolves once it has all played.
   */
  play: (onStep: (deltaMs: number) => void) => Promise<void>;
}

/**
 * The song ready to be drawn against: rendered to its first frame, which
 * the frames already carry, so the drawing that mounts on them has its
 * points before the first frame it is asked to draw. Undefined where the
 * song cannot be had (no file, no offline audio), or when `signal` aborts.
 *
 * @param seconds how much of the song is played (`stillSecondsOf`)
 */
export const prepareStillSong = async (
  seconds: number,
  signal: AbortSignal,
): Promise<IStillSong | undefined> => {
  const demo = await demoMusic();
  if (!demo || signal.aborted) {
    return undefined;
  }
  const { music, startAt } = demo;
  const { sampleRate } = music;
  const offline = new OfflineAudioContext(
    2,
    Math.ceil(seconds * sampleRate) + 1,
    sampleRate,
  );
  const source = offline.createBufferSource();
  source.buffer = music;
  source.loop = true;
  const input = offline.createGain();
  source.connect(input);
  input.connect(offline.destination);
  const reader = connectDemoReader(offline, input);
  const frames = createLiveFrameStore({
    graphPoints: [],
    points: [],
    waveform: [],
    isClipping: false,
    outputLevels: [],
  });

  // Who draws each frame, once `play` says; and the first frame's hold.
  const hold: {
    step?: (deltaMs: number) => void;
    release: () => void;
    primed: (ready: boolean) => void;
  } = { release: () => undefined, primed: () => undefined };
  const released = new Promise<void>((resolve) => {
    hold.release = resolve;
  });
  signal.addEventListener('abort', () => hold.release(), { once: true });
  const isPrimed = new Promise<boolean>((resolve) => {
    hold.primed = resolve;
  });

  /** What happens where the render stops at frame `index`. */
  const reach = (index: number) => async () => {
    if (index === 1) {
      // The frame the drawing mounts on, copied: the reader's arrays are
      // overwritten by its next read.
      const first = reader.read();
      frames.publish({
        graphPoints: first.graphPoints.map((point) => ({ ...point })),
        points: first.points.map((point) => ({ ...point })),
        waveform: [...first.waveform],
      });
      hold.primed(first.graphPoints.length > 0);
      await released;
    }
    if (!signal.aborted) {
      hold.step?.(UPDATE_INTERVAL_MS);
    }
    return offline.resume();
  };
  const count = Math.floor((seconds * 1000) / UPDATE_INTERVAL_MS);
  for (let index = 1; index <= count; index += 1) {
    offline
      .suspend((index * UPDATE_INTERVAL_MS) / 1000)
      .then(reach(index))
      .catch(() => undefined);
  }
  source.start(0, startAt);
  const rendered = offline.startRendering().then(
    () => undefined,
    () => undefined,
  );
  // A song that will not render, or one silent at its first frame, is no
  // still; the render is let run out so nothing waits on it.
  const ready = await Promise.race([isPrimed, rendered.then(() => false)]);
  if (!ready || signal.aborted) {
    hold.release();
    return undefined;
  }
  return {
    frames,
    readFrame: () => reader.read(),
    tap: { context: offline, source: input },
    play: (onStep) => {
      hold.step = onStep;
      hold.release();
      return rendered;
    },
  };
};
