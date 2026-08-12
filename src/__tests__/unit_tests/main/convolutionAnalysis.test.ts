/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import { analyzeConvolutionBuffer } from '../../../main/convolutionAnalysis';

const pcm16Wav = (channels: number[][], sampleRate = 48000) => {
  const channelCount = channels.length;
  const frameCount = Math.max(...channels.map((channel) => channel.length));
  const blockAlign = channelCount * 2;
  const dataSize = frameCount * blockAlign;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * blockAlign, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const value = channels[channel][frame] ?? 0;
      buffer.writeInt16LE(
        Math.max(-32768, Math.min(32767, Math.round(value * 32768))),
        44 + frame * blockAlign + channel * 2,
      );
    }
  }
  return buffer;
};

describe('convolution WAV analysis', () => {
  it('measures the absolute gain baked into an impulse response', () => {
    const analysis = analyzeConvolutionBuffer(pcm16Wav([[0.5, 0, 0, 0]]));

    expect(analysis.sampleRate).toBe(48000);
    expect(analysis.peakGainDb).toBeCloseTo(-6.02, 2);
    expect(analysis.response.length).toBeGreaterThan(1000);
    expect(Math.max(...analysis.response.map(({ gain }) => gain))).toBeCloseTo(
      -6.02,
      2,
    );
  });

  it('uses the loudest channel for clipping-safe normalization', () => {
    const analysis = analyzeConvolutionBuffer(
      pcm16Wav([
        [0.25, 0, 0, 0],
        [0.5, 0, 0, 0],
      ]),
    );

    expect(analysis.peakGainDb).toBeCloseTo(-6.02, 2);
  });

  it('rejects invalid sample values in floating-point WAVs', () => {
    const buffer = Buffer.alloc(48);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(40, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(3, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(48000, 24);
    buffer.writeUInt32LE(192000, 28);
    buffer.writeUInt16LE(4, 32);
    buffer.writeUInt16LE(32, 34);
    buffer.write('data', 36, 'ascii');
    buffer.writeUInt32LE(4, 40);
    buffer.writeFloatLE(Number.NaN, 44);

    expect(() => analyzeConvolutionBuffer(buffer)).toThrow('invalid samples');
  });
});
