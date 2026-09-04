/* FluidEQ — GPL-3.0-or-later */

import { createSenderSpectrum } from '../../../renderer/remoteAudio/senderSpectrum';

const fill = (opposite: boolean, silent = false) => {
  const spectrum = createSenderSpectrum();
  for (let sequence = 0; sequence < 8; sequence += 1) {
    const samples = new Float32Array(960);
    for (let frame = 0; frame < 480; frame += 1) {
      const value = silent
        ? 0
        : Math.sin((2 * Math.PI * 1000 * (sequence * 480 + frame)) / 48000) *
          0.5;
      samples[frame * 2] = value;
      samples[frame * 2 + 1] = opposite ? -value : value;
    }
    spectrum.push({
      peerId: 'sender',
      sequence,
      channels: 2,
      frames: 480,
      sampleRate: 48000,
      pcm: samples.buffer,
    });
  }
  return spectrum;
};

describe('outgoing audio spectrum', () => {
  it.each([false, true])(
    'measures a contiguous 1 kHz stereo window (opposite polarity: %s)',
    (opposite) => {
      const frame = fill(opposite).read();
      expect(frame).toBeDefined();
      const frequency = frame?.frequency ?? new Float32Array();
      let loudest = 0;
      frequency.forEach((value, index) => {
        if (value > frequency[loudest]) {
          loudest = index;
        }
      });
      expect((loudest * 48000) / 2048).toBeGreaterThan(975);
      expect((loudest * 48000) / 2048).toBeLessThan(1025);
      expect(frame?.peaks).toEqual([0.5, 0.5]);
      expect(Math.max(...(frame?.waveform ?? []))).toBeCloseTo(0.5);
    },
  );

  it('reports silence and discards history when a sharing session ends', () => {
    const silent = fill(false, true).read();
    expect(silent?.peaks).toEqual([0, 0]);
    expect(Math.max(...(silent?.frequency ?? []))).toBeLessThan(-95);
    const active = fill(false);
    expect(active.read()?.peaks[0]).toBeGreaterThan(0);
    active.reset();
    expect(active.read()).toBeUndefined();
  });
});
