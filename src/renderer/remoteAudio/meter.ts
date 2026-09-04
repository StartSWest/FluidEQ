/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';

export interface IRemoteAudioMeter {
  bufferedMs?: number;
  peak: number;
  rms: number;
  sourceId?: string;
  waveform: Float32Array;
}

export type TRemoteAudioMeterListener = (meter: IRemoteAudioMeter) => void;

const WAVEFORM_POINTS = 64;

/** Measure a sender block without changing or copying the transmitted PCM. */
export const measureRemoteAudioChunk = (
  chunk: Omit<ILanRemoteAudioChunk, 'peerId'>,
): IRemoteAudioMeter => {
  const samples = new Float32Array(chunk.pcm);
  const waveform = new Float32Array(WAVEFORM_POINTS);
  let peak = 0;
  let squareSum = 0;
  for (let frame = 0; frame < chunk.frames; frame += 1) {
    let mono = 0;
    for (let channel = 0; channel < chunk.channels; channel += 1) {
      mono += samples[frame * chunk.channels + channel] ?? 0;
    }
    mono /= chunk.channels;
    peak = Math.max(peak, Math.abs(mono));
    squareSum += mono * mono;
    const point = Math.min(
      WAVEFORM_POINTS - 1,
      Math.floor((frame * WAVEFORM_POINTS) / chunk.frames),
    );
    if (Math.abs(mono) > Math.abs(waveform[point])) {
      waveform[point] = mono;
    }
  }
  return {
    peak,
    rms: Math.sqrt(squareSum / chunk.frames),
    waveform,
  };
};
