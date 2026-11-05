/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import createDynamicsSpectrum from '../../../renderer/dsp/dynamicsSpectrum';

const analyser = {
  frequencyBinCount: 1024,
  getFloatFrequencyData: (target: Float32Array) => target.fill(-120),
};

it('draws the actual music frequencies, with a smooth release', () => {
  let toneHz = 100;
  const source = {
    ...analyser,
    getFloatFrequencyData: (target: Float32Array) => {
      target.fill(-120);
      target[Math.round((toneHz * 2048) / 48_000)] = -12;
    },
  };
  const spectrum = createDynamicsSpectrum();
  const bass = spectrum.read(source, 48_000, 0);
  const at = (hz: number) =>
    bass.axis.reduce(
      (best, value, index) =>
        Math.abs(value - hz) < Math.abs(bass.axis[best] - hz) ? index : best,
      0,
    );
  const low = at(100);
  const high = at(8_000);
  expect(bass.levels[low]).toBeGreaterThan(-30);
  expect(bass.levels[high]).toBeLessThan(-80);
  const before = bass.levels[low];
  toneHz = 8_000;
  const next = spectrum.read(source, 48_000, 16);
  expect(next.levels[high]).toBeGreaterThan(-30);
  expect(next.levels[low]).toBeLessThan(before);
  expect(next.levels[low]).toBeGreaterThan(-40);
});

it('clears held music on engine loss and rebuilds for a different output rate', () => {
  const spectrum = createDynamicsSpectrum();
  spectrum.read(
    { ...analyser, getFloatFrequencyData: (bins) => bins.fill(-12) },
    48_000,
    0,
  );
  spectrum.reset();
  const silent = spectrum.read(analyser, 96_000, 16);
  expect(Math.max(...silent.levels)).toBeLessThan(-80);
  expect(silent.axis[silent.axis.length - 1]).toBeGreaterThan(20_000);
});
