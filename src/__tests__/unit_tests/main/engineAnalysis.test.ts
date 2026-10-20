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
import {
  ANALYSIS_DEESSER_BANDS,
  ANALYSIS_EQ_DETAIL_BINS,
  ANALYSIS_EQ_DETAIL_WINDOW,
  ANALYSIS_LEGACY_HEADER_BYTES,
} from '../../../common/dsp/analysisWire';

const packet = (
  extra: readonly number[] = [],
  header: number = ANALYSIS_HEADER_BYTES,
) => {
  const frame = Buffer.alloc(header + ANALYSIS_BINS * 4 + extra.length * 4);
  frame.writeUInt32LE(MAGIC_ANALYSIS, 0);
  frame.writeUInt32LE(1, 8);
  frame.writeUInt32LE(ANALYSIS_BINS, 12);
  for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
    frame.writeFloatLE(-42, header + bin * 4);
  }
  extra.forEach((value, index) =>
    frame.writeFloatLE(value, header + ANALYSIS_BINS * 4 + index * 4),
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

/**
 * The engine is installed apart from the app, so the app reads the frame of
 * an engine from before the De-esser too: 224 bytes shorter, with nothing of
 * the stage in it.
 */
describe('an engine with the De-esser and one without', () => {
  it('reads the De-esser’s window where the engine writes it', () => {
    const frame = packet([-6, -18]);
    frame.writeFloatLE(-4.5, 560);
    frame.writeFloatLE(7200, 564);
    frame.writeFloatLE(0.85, 568);
    frame.writeUInt32LE(3, 588);
    [5000, 6300, 8000].forEach((hz, band) => {
      frame.writeFloatLE(hz, 592 + band * 4);
      frame.writeFloatLE(
        -4.5 + band,
        592 + ANALYSIS_DEESSER_BANDS * 12 + band * 4,
      );
    });
    const read = decodeEngineAnalysis(frame);
    expect(read?.deEsser).toMatchObject({
      reductionDb: -4.5,
      frequencyHz: 7200,
      bandHz: [5000, 6300, 8000],
      bandCutDb: [-4.5, -3.5, -2.5],
    });
    expect(read?.deEsser?.confidence).toBeCloseTo(0.85, 6);
    // The extension after the spectrum is still read at the new length.
    expect(read?.normalizer.inputLufs).toBe(-18);
  });

  it('reads an older engine’s frame, with no De-esser in it', () => {
    const older = packet([-6, -18], ANALYSIS_LEGACY_HEADER_BYTES);
    const read = decodeEngineAnalysis(older);
    expect(read).toBeDefined();
    expect(read?.deEsser).toBeUndefined();
    expect(read?.normalizer.inputLufs).toBe(-18);
  });

  it('never reads one length as the other', () => {
    expect(ANALYSIS_HEADER_BYTES - ANALYSIS_LEGACY_HEADER_BYTES).toBe(224);
    const frame = packet();
    // Cut to a length neither header explains: refused, not misread.
    expect(decodeEngineAnalysis(frame.subarray(0, frame.length - 100))).toBe(
      undefined,
    );
  });
});

/**
 * The EQ tap's long window (`meters_eq_live.h`) sits between the bands and
 * the engine's own live-input tail, which is found by length from the end:
 * the window has to be counted, or the tail is read out of its last floats.
 */
describe('an engine that sends the EQ tap live', () => {
  it('reads its long window and the tail after it', () => {
    const detail = Array.from(
      { length: ANALYSIS_EQ_DETAIL_BINS },
      (_unused, bin) => -40 - bin / 1000,
    );
    const frame = packet([...detail, -6, -32, -18, 3]);
    frame.writeUInt32LE(ANALYSIS_EQ_DETAIL_WINDOW, 84);
    frame.writeUInt32LE(ANALYSIS_EQ_DETAIL_BINS, 88);
    const read = decodeEngineAnalysis(frame);
    expect(read?.eqLive?.detailWindow).toBe(ANALYSIS_EQ_DETAIL_WINDOW);
    expect(read?.eqLive?.detail?.[ANALYSIS_EQ_DETAIL_BINS - 1]).toBeCloseTo(
      detail[ANALYSIS_EQ_DETAIL_BINS - 1],
      5,
    );
    expect(read?.normalizer).toMatchObject({
      inputTruePeakDb: -6,
      inputLufs: -32,
      referenceLufs: -18,
      levelState: 3,
    });
  });

  it('refuses a frame that says it carries a long window and does not', () => {
    const frame = packet([-6, -32, -18, 3]);
    frame.writeUInt32LE(ANALYSIS_EQ_DETAIL_WINDOW, 84);
    frame.writeUInt32LE(ANALYSIS_EQ_DETAIL_BINS, 88);
    expect(decodeEngineAnalysis(frame)).toBeUndefined();
    // Control: the same frame saying it carries none reads.
    frame.writeUInt32LE(0, 88);
    expect(decodeEngineAnalysis(frame)?.eqLive?.detail).toBeUndefined();
    expect(decodeEngineAnalysis(frame)?.normalizer.inputLufs).toBe(-32);
  });
});
