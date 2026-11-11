/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SPECTRUM_TEXELS, WAVEFORM_TEXELS } from 'common/sceneUniformContract';
import { turnRun } from 'common/spectrumEnergy';
import { connectDemoReader } from '../studio/publishDemoAudio';
import type { ILiveFrame } from './liveFrameReader';
import type { ISceneFrame } from './sceneGl';
import { musicFrameOf } from './sceneMusicFrame';
import { isSilentWaveform } from './sceneRest';
import { fillSpectrumTexels, fillWaveformTexels } from './sceneUniforms';
import { createStereoFollower } from './stereoImage';

/**
 * The demo song as a scene hears it, frame by frame, worked out faster than
 * it plays: what the review measures a scene's flashing against
 * (`sceneFlashMeasure.ts`), so the drops in it are heard.
 *
 * Played in an offline audio context through the demo's own reader
 * (`connectDemoReader`), stopped at each frame's moment to read it, so every
 * frame is what the live demo would have given a scene at that point of the
 * song, and the same on every machine.
 */

/** Frames a second of music: enough to see three flashes a second twice over. */
export const FLASH_FPS = 30;
const STEP_MS = 1000 / FLASH_FPS;
/** One pass of the loop at most this long, and a short one played twice. */
const LONGEST_S = 60;
const PLAYED_TWICE_UNDER_S = 30;

/** How much of a loop `duration` seconds long is measured. */
export const demoSecondsToMeasure = (duration: number): number =>
  Math.min(
    LONGEST_S,
    duration < PLAYED_TWICE_UNDER_S ? duration * 2 : duration,
  );

/** Builds each frame from the reader's, carrying what a frame carries on. */
const createFrameMaker = (accent: readonly [number, number, number]) => {
  let run = 0;
  const stereo = createStereoFollower();
  return (live: ILiveFrame, atSeconds: number): ISceneFrame | undefined => {
    const energy = live.sound?.music();
    if (!energy) {
      return undefined;
    }
    run = turnRun(run, energy.runSpeed, STEP_MS);
    const spectrum = new Uint8Array(SPECTRUM_TEXELS);
    fillSpectrumTexels(live.points, spectrum, MIN_GAIN, MAX_GAIN);
    const waveform = new Uint8Array(WAVEFORM_TEXELS);
    fillWaveformTexels(live.waveform, waveform);
    return {
      timeSeconds: atSeconds,
      musicSeconds: atSeconds,
      deltaMs: STEP_MS,
      ...musicFrameOf(energy, run),
      accent,
      fade: 1,
      playing: live.points.length > 0 && !isSilentWaveform(live.waveform),
      spectrum,
      waveform,
      params: {},
      stereo: stereo(live.stereo, STEP_MS),
    };
  };
};

export type TDemoFrames =
  | { ok: true; frames: ISceneFrame[]; seconds: number }
  | { ok: false; reason: 'unavailable' | 'aborted' };

/** The demo song's frames, from its bytes. */
export const readDemoFrames = async (
  bytes: Uint8Array,
  accent: readonly [number, number, number],
  signal?: AbortSignal,
): Promise<TDemoFrames> => {
  let music: AudioBuffer;
  try {
    // A copy of exactly the file's bytes: decoding takes its buffer over.
    music = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(
      bytes.slice().buffer,
    );
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }
  const seconds = demoSecondsToMeasure(music.duration);
  const { sampleRate } = music;
  const offline = new OfflineAudioContext(
    Math.max(2, music.numberOfChannels),
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
  const make = createFrameMaker(accent);
  const frames: ISceneFrame[] = [];
  const count = Math.floor(seconds * FLASH_FPS);
  // Read where the render stopped, then let it go on. A frame that could
  // not be read is simply not there: a run is whole or it is unavailable.
  const readAt = (at: number) => () => {
    if (!signal?.aborted) {
      const frame = make(reader.read(), at);
      if (frame) {
        frames.push(frame);
      }
    }
    return offline.resume();
  };
  for (let index = 1; index <= count; index += 1) {
    const at = index / FLASH_FPS;
    offline
      .suspend(at)
      .then(readAt(at))
      .catch(() => undefined);
  }
  source.start();
  try {
    await offline.startRendering();
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (signal?.aborted) {
    return { ok: false, reason: 'aborted' };
  }
  return count > 0 && frames.length === count
    ? { ok: true, frames, seconds }
    : { ok: false, reason: 'unavailable' };
};
