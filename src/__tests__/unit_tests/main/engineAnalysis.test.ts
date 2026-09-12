/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import {
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_BINS,
  MAGIC_ANALYSIS,
} from '../../../main/dspHost/wire';
import decodeEngineAnalysis from '../../../main/dspHost/engineAnalysis';

const packet = (extra: readonly number[] = []) => {
  const frame = Buffer.alloc(
    ANALYSIS_HEADER_BYTES + ANALYSIS_BINS * 4 + extra.length * 4,
  );
  frame.writeUInt32LE(MAGIC_ANALYSIS, 0);
  frame.writeUInt32LE(1, 8);
  frame.writeUInt32LE(ANALYSIS_BINS, 12);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    frame.writeFloatLE(-42, ANALYSIS_HEADER_BYTES + bin * 4);
  }
  extra.forEach((value, index) =>
    frame.writeFloatLE(
      value,
      ANALYSIS_HEADER_BYTES + ANALYSIS_BINS * 4 + index * 4,
    ),
  );
  return frame;
};
describe('external engine analysis', () => {
  it('accepts the original spectrum frame and both live extensions', () => {
    expect(decodeEngineAnalysis(packet())).toBeDefined();
    expect(decodeEngineAnalysis(packet([-6, -18]))?.normalizer.inputLufs).toBe(
      -18,
    );
    expect(
      decodeEngineAnalysis(packet([-6, -32, -18, 3]))?.normalizer,
    ).toMatchObject({
      inputTruePeakDb: -6,
      inputLufs: -32,
      referenceLufs: -18,
      levelState: 3,
    });
  });
  it.each([
    [-6, Number.NaN],
    [-6, -18, Number.POSITIVE_INFINITY, 3],
    [-6, -18, -18, 6],
    [-6, -18, -18, 2.5],
    [-6, -18, -18],
  ])('refuses malformed live metadata %p', (...values) => {
    expect(decodeEngineAnalysis(packet(values))).toBeUndefined();
  });
  it('rejects truncated spectra instead of interpreting their end as metadata', () => {
    const frame = packet([-6, -18, -18, 4]);
    expect(
      decodeEngineAnalysis(frame.subarray(0, frame.length - 1)),
    ).toBeUndefined();
    frame.writeUInt32LE(0, 0);
    expect(decodeEngineAnalysis(frame)).toBeUndefined();
  });
});
