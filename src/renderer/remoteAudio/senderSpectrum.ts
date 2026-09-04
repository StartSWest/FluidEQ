/* FluidEQ — GPL-3.0-or-later */

import { fftInPlace } from '../../common/dsp/fft';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';

export const SENDER_SPECTRUM_SIZE = 2048;

export interface ISenderSpectrum {
  sampleRate: number;
  frequency: Float32Array;
  peaks: number[];
  waveform: number[];
}

/** A rolling, contiguous window. Decimating packets before FFT invents gaps. */
export const createSenderSpectrum = () => {
  let channels: Float32Array[] = [];
  let sampleRate = 0;
  let cursor = 0;
  let filled = 0;
  let expectedSequence: number | undefined;
  const reset = () => {
    channels = [];
    sampleRate = 0;
    cursor = 0;
    filled = 0;
    expectedSequence = undefined;
  };
  const push = (chunk: ILanRemoteAudioChunk) => {
    const count = Math.min(2, chunk.channels);
    if (
      sampleRate !== chunk.sampleRate ||
      channels.length !== count ||
      expectedSequence !== chunk.sequence
    ) {
      reset();
      sampleRate = chunk.sampleRate;
      channels = Array.from(
        { length: count },
        () => new Float32Array(SENDER_SPECTRUM_SIZE),
      );
    }
    const samples = new Float32Array(chunk.pcm);
    for (let frame = 0; frame < chunk.frames; frame += 1) {
      for (let channel = 0; channel < count; channel += 1) {
        channels[channel][cursor] = samples[frame * chunk.channels + channel];
      }
      cursor = (cursor + 1) % SENDER_SPECTRUM_SIZE;
    }
    filled = Math.min(SENDER_SPECTRUM_SIZE, filled + chunk.frames);
    expectedSequence = chunk.sequence === 0xffff_ffff ? 0 : chunk.sequence + 1;
  };
  const read = (): ISenderSpectrum | undefined => {
    if (filled < SENDER_SPECTRUM_SIZE) {
      return undefined;
    }
    const frequency = new Float32Array(SENDER_SPECTRUM_SIZE / 2);
    const power = new Float64Array(frequency.length);
    const waveform = new Array<number>(96).fill(0);
    const peaks = channels.map((samples) => {
      const real = new Float64Array(SENDER_SPECTRUM_SIZE);
      const imaginary = new Float64Array(SENDER_SPECTRUM_SIZE);
      let peak = 0;
      for (let frame = 0; frame < SENDER_SPECTRUM_SIZE; frame += 1) {
        const value = samples[(cursor + frame) % SENDER_SPECTRUM_SIZE];
        peak = Math.max(peak, Math.abs(value));
        const point = Math.floor(
          (frame * waveform.length) / SENDER_SPECTRUM_SIZE,
        );
        waveform[point] = Math.max(waveform[point], Math.abs(value));
        const phase = (2 * Math.PI * frame) / SENDER_SPECTRUM_SIZE;
        real[frame] =
          value * (0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase));
      }
      fftInPlace(real, imaginary, false);
      for (let bin = 0; bin < frequency.length; bin += 1) {
        // Combine energy, not waveforms: opposite-polarity stereo is audible
        // on both channels and must not disappear from the sender spectrum.
        power[bin] += real[bin] ** 2 + imaginary[bin] ** 2;
      }
      return peak;
    });
    for (let bin = 0; bin < frequency.length; bin += 1) {
      frequency[bin] =
        10 *
        Math.log10(
          Math.max(
            1e-20,
            power[bin] /
              channels.length /
              ((SENDER_SPECTRUM_SIZE * 0.42) / 2) ** 2,
          ),
        );
    }
    return { sampleRate, frequency, peaks, waveform };
  };
  return { push, read, reset };
};
