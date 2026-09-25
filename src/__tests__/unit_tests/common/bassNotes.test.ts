/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { isBassBin } from '../../../common/bassNotes';

/**
 * Which low bins are a bass note's (`bassNotes.ts`): each one followed uphill
 * to the peak it lies on, and a bass note's only when that peak's note is
 * from 30 to 115 Hz. The window spreads a man's sung note down through every
 * bin below it, and summed, those bins read his voice as bass.
 */

/** The long window's bins at 48 kHz: 2048 samples, 23.4 Hz apart. */
const BIN_HZ = 48_000 / 2_048;

/**
 * A spectrum in dB with a peak at `hz` falling away `slope` dB a bin either
 * side, over a floor at -100.
 */
const peakAt = (hz: number, slope = 12, top = -20) =>
  Float32Array.from({ length: 17 }, (_, bin) =>
    Math.max(-100, top - slope * Math.abs(bin - hz / BIN_HZ)),
  );

const bassBins = (bins: Float32Array) =>
  Array.from(bins.keys()).filter((bin) => isBassBin(bins, BIN_HZ, bin));

describe('a bass note', () => {
  it('owns every bin of its own peak', () => {
    // A1, 55 Hz: its peak and both sides of it, down to the floor.
    const bins = peakAt(55);
    const sounding = Array.from(bins.keys()).filter((bin) => bins[bin] > -100);
    expect(sounding.length).toBeGreaterThan(5);
    expect(bassBins(bins)).toEqual(expect.arrayContaining(sounding));
  });

  it('is placed between bins, not at the bin it happens to peak in', () => {
    // 117 Hz lands in the 117.2 Hz bin, and between the bins the parabola
    // puts it just over the top: a skirt's, not a note's.
    expect(bassBins(peakAt(118))).toEqual([]);
    // The control: 108 Hz, an A2 sung a little flat, is a bass note.
    expect(bassBins(peakAt(108)).length).toBeGreaterThan(0);
  });
});

describe("a man's sung note", () => {
  it('owns the skirt it spreads under itself, which is no bass note', () => {
    // A sung A3 at 147 Hz reaching down through the low bins.
    const bins = peakAt(147, 6);
    expect(bassBins(bins)).toEqual([]);
  });

  it('leaves a bass note under it the bass', () => {
    // A 55 Hz bass line under the same voice: the bins on the bass's own
    // peak are the bass's, the voice's slope beyond the dip between them is
    // not.
    const voice = peakAt(147, 6);
    const bass = peakAt(55, 12, -10);
    const both = Float32Array.from(voice, (db, bin) => Math.max(db, bass[bin]));
    const owned = bassBins(both);
    expect(owned).toContain(Math.round(55 / BIN_HZ));
    expect(owned).not.toContain(Math.round(147 / BIN_HZ));
    expect(Math.max(...owned) * BIN_HZ).toBeLessThan(147);
  });
});
