/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import fs from 'fs';
import path from 'path';
import { IConvolutionProfile, IGraphicEqPoint } from '../common/constants';
import {
  RESPONSE_END,
  RESPONSE_START,
  SAMPLE_FREQUENCIES,
} from '../common/response';

/* Bit reversal and 24-bit PCM sign extension are inherently bitwise. */
/* eslint-disable no-bitwise */

interface IWavLayout {
  audioFormat: number;
  bitsPerSample: number;
  blockAlign: number;
  channels: number;
  dataOffset: number;
  dataSize: number;
  sampleRate: number;
}

export interface IConvolutionAnalysis {
  sampleRate: number;
  response: IGraphicEqPoint[];
  peakGainDb: number;
}

/** Four-times zero padding catches FIR peaks between the WAV's natural bins. */
const FFT_OVERSAMPLE = 4;
/** About 21 seconds at 48 kHz before padding; long for an EQ impulse. */
const MAX_FFT_SIZE = 1 << 21;
const MIN_DB = -300;

const parseWavLayout = (buffer: Buffer): IWavLayout => {
  if (
    buffer.length < 44 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE'
  ) {
    throw new Error('That file is not a WAV impulse response.');
  }

  let format: Omit<IWavLayout, 'dataOffset' | 'dataSize'> | undefined;
  let dataOffset = 0;
  let dataSize = 0;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkOffset = offset + 8;
    const chunkEnd = chunkOffset + chunkSize;
    if (chunkEnd > buffer.length) {
      throw new Error('That WAV file is truncated.');
    }
    if (chunkId === 'fmt ' && chunkSize >= 16) {
      let audioFormat = buffer.readUInt16LE(chunkOffset);
      const channels = buffer.readUInt16LE(chunkOffset + 2);
      const sampleRate = buffer.readUInt32LE(chunkOffset + 4);
      const blockAlign = buffer.readUInt16LE(chunkOffset + 12);
      const bitsPerSample = buffer.readUInt16LE(chunkOffset + 14);
      // WAVE_FORMAT_EXTENSIBLE stores the real PCM/float tag at the start of
      // its sub-format GUID.
      if (audioFormat === 0xfffe && chunkSize >= 40) {
        audioFormat = buffer.readUInt16LE(chunkOffset + 24);
      }
      format = {
        audioFormat,
        bitsPerSample,
        blockAlign,
        channels,
        sampleRate,
      };
    } else if (chunkId === 'data') {
      dataOffset = chunkOffset;
      dataSize = chunkSize;
    }
    offset = chunkEnd + (chunkSize % 2);
  }

  if (!format || dataSize === 0) {
    throw new Error('That WAV file has no usable format or data chunk.');
  }
  const bytesPerSample = format.bitsPerSample / 8;
  const supportedPcm =
    format.audioFormat === 1 && [8, 16, 24, 32].includes(format.bitsPerSample);
  const supportedFloat =
    format.audioFormat === 3 && [32, 64].includes(format.bitsPerSample);
  if (
    format.channels < 1 ||
    !Number.isInteger(bytesPerSample) ||
    (!supportedPcm && !supportedFloat) ||
    format.blockAlign < format.channels * bytesPerSample
  ) {
    throw new Error('That WAV sample format cannot be analyzed safely.');
  }
  return { ...format, dataOffset, dataSize };
};

const readSample = (
  buffer: Buffer,
  offset: number,
  audioFormat: number,
  bitsPerSample: number,
) => {
  if (audioFormat === 3) {
    return bitsPerSample === 32
      ? buffer.readFloatLE(offset)
      : buffer.readDoubleLE(offset);
  }
  if (bitsPerSample === 8) {
    return (buffer.readUInt8(offset) - 128) / 128;
  }
  if (bitsPerSample === 16) {
    return buffer.readInt16LE(offset) / 32768;
  }
  if (bitsPerSample === 24) {
    let value = buffer.readUIntLE(offset, 3);
    if (value & 0x800000) {
      value -= 0x1000000;
    }
    return value / 8388608;
  }
  return buffer.readInt32LE(offset) / 2147483648;
};

const nextPowerOfTwo = (value: number) => {
  let result = 1;
  while (result < value) {
    result *= 2;
  }
  return result;
};

/** In-place radix-2 FFT. The input is real but keeping the full transform here
 * makes the implementation small, auditable and independent of native addons.
 */
const fft = (real: Float64Array, imaginary: Float64Array) => {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    while (reversed & bit) {
      reversed ^= bit;
      bit >>= 1;
    }
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [
        imaginary[reversed],
        imaginary[index],
      ];
    }
  }

  for (let length = 2; length <= size; length *= 2) {
    const angle = (-2 * Math.PI) / length;
    const stepReal = Math.cos(angle);
    const stepImaginary = Math.sin(angle);
    for (let start = 0; start < size; start += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      const half = length / 2;
      for (let index = 0; index < half; index += 1) {
        const even = start + index;
        const odd = even + half;
        const oddReal =
          real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary =
          real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal =
          twiddleReal * stepReal - twiddleImaginary * stepImaginary;
        twiddleImaginary =
          twiddleReal * stepImaginary + twiddleImaginary * stepReal;
        twiddleReal = nextReal;
      }
    }
  }
};

const magnitudeDb = (real: number, imaginary: number) => {
  const magnitude = Math.hypot(real, imaginary);
  return magnitude > 0 && Number.isFinite(magnitude)
    ? Math.max(MIN_DB, 20 * Math.log10(magnitude))
    : MIN_DB;
};

export const analyzeConvolutionBuffer = (
  buffer: Buffer,
): IConvolutionAnalysis => {
  const layout = parseWavLayout(buffer);
  const bytesPerSample = layout.bitsPerSample / 8;
  const frameCount = Math.floor(layout.dataSize / layout.blockAlign);
  if (frameCount < 1) {
    throw new Error('That WAV impulse response contains no samples.');
  }
  const fftSize = nextPowerOfTwo(frameCount * FFT_OVERSAMPLE);
  if (fftSize > MAX_FFT_SIZE) {
    throw new Error(
      'That impulse response is too long to analyze for safe normalization.',
    );
  }

  const responseGain = new Float64Array(SAMPLE_FREQUENCIES.length);
  responseGain.fill(Number.NEGATIVE_INFINITY);
  let peakGainDb = Number.NEGATIVE_INFINITY;
  let peakFrequency = RESPONSE_START;

  for (let channel = 0; channel < layout.channels; channel += 1) {
    const real = new Float64Array(fftSize);
    const imaginary = new Float64Array(fftSize);
    for (let frame = 0; frame < frameCount; frame += 1) {
      const sampleOffset =
        layout.dataOffset +
        frame * layout.blockAlign +
        channel * bytesPerSample;
      const sample = readSample(
        buffer,
        sampleOffset,
        layout.audioFormat,
        layout.bitsPerSample,
      );
      if (!Number.isFinite(sample)) {
        throw new Error('That WAV impulse response contains invalid samples.');
      }
      real[frame] = sample;
    }
    fft(real, imaginary);

    const firstBin = Math.max(
      0,
      Math.ceil((RESPONSE_START * fftSize) / layout.sampleRate),
    );
    const lastBin = Math.min(
      fftSize / 2,
      Math.floor((RESPONSE_END * fftSize) / layout.sampleRate),
    );
    for (let bin = firstBin; bin <= lastBin; bin += 1) {
      const gain = magnitudeDb(real[bin], imaginary[bin]);
      if (gain > peakGainDb) {
        peakGainDb = gain;
        peakFrequency = (bin * layout.sampleRate) / fftSize;
      }
    }

    SAMPLE_FREQUENCIES.forEach((frequency, index) => {
      const position = (frequency * fftSize) / layout.sampleRate;
      const before = Math.max(0, Math.min(fftSize / 2, Math.floor(position)));
      const after = Math.max(0, Math.min(fftSize / 2, Math.ceil(position)));
      const progress = position - before;
      const beforeMagnitude = Math.hypot(real[before], imaginary[before]);
      const afterMagnitude = Math.hypot(real[after], imaginary[after]);
      const magnitude =
        beforeMagnitude + (afterMagnitude - beforeMagnitude) * progress;
      const gain =
        magnitude > 0 && Number.isFinite(magnitude)
          ? Math.max(MIN_DB, 20 * Math.log10(magnitude))
          : MIN_DB;
      responseGain[index] = Math.max(responseGain[index], gain);
    });
  }

  if (!Number.isFinite(peakGainDb)) {
    throw new Error('That WAV impulse response has no measurable response.');
  }
  const response = SAMPLE_FREQUENCIES.map((frequency, index) => ({
    frequency,
    gain: responseGain[index],
  }));
  // Preserve the exact FFT-bin peak as an additional point. The shared chain
  // analyzer evaluates every curve point, so a narrow FIR peak cannot hide
  // between the normal logarithmic probes.
  response.push({ frequency: peakFrequency, gain: peakGainDb });
  response.sort((left, right) => left.frequency - right.frequency);

  return {
    sampleRate: layout.sampleRate,
    response,
    peakGainDb: Math.round(peakGainDb * 100) / 100,
  };
};

interface ICachedAnalysis {
  modifiedMs: number;
  size: number;
  analysis: IConvolutionAnalysis;
}

const fileCache = new Map<string, ICachedAnalysis>();

export const analyzeConvolutionFile = (
  filePath: string,
): IConvolutionAnalysis => {
  const stat = fs.statSync(filePath);
  const cached = fileCache.get(filePath);
  if (cached?.modifiedMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.analysis;
  }
  const analysis = analyzeConvolutionBuffer(fs.readFileSync(filePath));
  fileCache.set(filePath, {
    modifiedMs: stat.mtimeMs,
    size: stat.size,
    analysis,
  });
  return analysis;
};

export const hasConvolutionAnalysis = (
  profile: IConvolutionProfile | undefined,
) =>
  Boolean(
    profile &&
    Number.isFinite(profile.peakGainDb) &&
    profile.response?.some(
      ({ frequency, gain }) =>
        Number.isFinite(frequency) && frequency > 0 && Number.isFinite(gain),
    ),
  );

/** Add measured metadata to a legacy file-backed profile on first use. */
export const hydrateConvolutionAnalysis = (
  profile: IConvolutionProfile | undefined,
  configDir: string,
): IConvolutionProfile | undefined => {
  if (
    !profile?.fileName ||
    hasConvolutionAnalysis(profile) ||
    profile.fileName !== path.basename(profile.fileName)
  ) {
    return profile;
  }
  const analysis = analyzeConvolutionFile(
    path.join(configDir, profile.fileName),
  );
  return {
    ...profile,
    response: analysis.response,
    peakGainDb: analysis.peakGainDb,
  };
};
