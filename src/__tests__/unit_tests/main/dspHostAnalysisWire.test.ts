/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one frame in this protocol whose length lives inside itself.
 *
 * Every other frame the host sends is a fixed struct with a fixed size, which
 * is what makes a desynchronised stream obvious rather than merely wrong. The
 * analysis frame cannot be: three spectra are twelve kilobytes and a frame
 * padded to hold them would make every silent moment cost what a loud one does.
 *
 * That buys a real hazard. If the reader computes the length wrongly by even
 * one byte it does not drop a frame — it takes the next frame's first bytes as
 * spectrum, and every frame after that is misread. A pipe hands over whatever
 * the OS felt like giving, so the arithmetic has to hold when a frame arrives
 * in one chunk, in two, or a byte at a time.
 */
import { FrameReader } from '../../../main/dspHost/transport';
import {
  ANALYSIS_BINS,
  ANALYSIS_HEADER_BYTES,
  ANALYSIS_SCOPE_PAIRS,
  ANALYSIS_STAGES,
  IHostAnalysis,
  MAGIC_ANALYSIS,
  MAGIC_TELEMETRY,
  TELEMETRY_BYTES,
  analysisFrameLength,
  decodeAnalysis,
} from '../../../main/dspHost/wire';

/** The header fields past the scope, which are all fixed-width. */
interface IAnalysisTail {
  dimensionGuard: number;
  autoHeadroomReductionDb: number;
  autoHeadroomTruePeakDb: number;
  safetyReductionDb: number;
  safetyTruePeakDb: number;
  dcCorrectionDb: number;
  repairedSamples: number;
  truePeakFactor: number;
  safetyEnabled: boolean;
  normalizerInputPeaks: readonly [number, number];
  normalizerOutputPeaks: readonly [number, number];
  normalizerAppliedGainDb: number;
}

/** An analysis frame exactly as the host lays one out. */
const buildAnalysis = (options: {
  stages: readonly (typeof ANALYSIS_STAGES)[number][];
  withScope: boolean;
  sequence?: number;
  correlation?: number;
  peaks?: readonly [number, number];
  fill?: (stageIndex: number, bin: number) => number;
  tail?: IAnalysisTail;
}): Buffer => {
  const stageMask = options.stages.reduce(
    // The wire field IS a bit mask; the arithmetic spelling is less readable.
    // eslint-disable-next-line no-bitwise
    (mask, stage) => mask | (1 << ANALYSIS_STAGES.indexOf(stage)),
    0,
  );
  const pairs = options.withScope ? ANALYSIS_SCOPE_PAIRS : 0;
  const bytes =
    ANALYSIS_HEADER_BYTES +
    options.stages.length * ANALYSIS_BINS * 4 +
    pairs * 2 * 4;
  const frame = Buffer.alloc(bytes);
  frame.writeUInt32LE(MAGIC_ANALYSIS, 0);
  frame.writeUInt32LE(options.sequence ?? 1, 4);
  frame.writeUInt32LE(stageMask, 8);
  frame.writeUInt32LE(ANALYSIS_BINS, 12);
  frame.writeUInt32LE(pairs, 16);
  frame.writeUInt32LE(0, 20);
  frame.writeDoubleLE(options.correlation ?? 0.5, 24);
  frame.writeFloatLE(options.peaks?.[0] ?? 0.25, 32);
  frame.writeFloatLE(options.peaks?.[1] ?? 0.75, 36);

  /**
   * The tail, written at the offsets `wire.h` puts it at.
   *
   * Spelled out here rather than taken from `decodeAnalysis`, because a test
   * that asked the decoder where its own fields are would agree with any answer
   * it gave. These numbers are the second, independent copy — so moving a field
   * in the decoder without moving it here fails, which is the only thing a
   * TypeScript test can guard. That the C++ struct still agrees is held by the
   * `static_assert` on `sizeof(FeqWireAnalysisFrame)` and by nothing else.
   */
  const { tail } = options;
  if (tail) {
    frame.writeFloatLE(tail.dimensionGuard, 60);
    frame.writeFloatLE(tail.autoHeadroomReductionDb, 64);
    frame.writeFloatLE(tail.autoHeadroomTruePeakDb, 68);
    frame.writeFloatLE(tail.safetyReductionDb, 72);
    frame.writeFloatLE(tail.safetyTruePeakDb, 76);
    frame.writeFloatLE(tail.dcCorrectionDb, 80);
    frame.writeUInt32LE(tail.repairedSamples, 84);
    frame.writeUInt32LE(tail.truePeakFactor, 88);
    frame.writeUInt32LE(tail.safetyEnabled ? 1 : 0, 92);
    frame.writeFloatLE(tail.normalizerInputPeaks[0], 96);
    frame.writeFloatLE(tail.normalizerInputPeaks[1], 100);
    frame.writeFloatLE(tail.normalizerOutputPeaks[0], 104);
    frame.writeFloatLE(tail.normalizerOutputPeaks[1], 108);
    frame.writeFloatLE(tail.normalizerAppliedGainDb, 112);
  }

  let at = ANALYSIS_HEADER_BYTES;
  options.stages.forEach((_stage, index) => {
    for (let bin = 0; bin < ANALYSIS_BINS; bin += 1) {
      frame.writeFloatLE(options.fill ? options.fill(index, bin) : -60, at);
      at += 4;
    }
  });
  for (let sample = 0; sample < pairs * 2; sample += 1) {
    frame.writeFloatLE(sample / 1000, at);
    at += 4;
  }
  return frame;
};

const telemetryFrame = (): Buffer => {
  const frame = Buffer.alloc(TELEMETRY_BYTES);
  frame.writeUInt32LE(MAGIC_TELEMETRY, 0);
  return frame;
};

const collectingReader = () => {
  const analyses: IHostAnalysis[] = [];
  const desynchronised: number[] = [];
  let telemetry = 0;
  const reader = new FrameReader({
    onHandshake: () => undefined,
    onAck: () => undefined,
    onTelemetry: () => {
      telemetry += 1;
    },
    onAnalysis: (analysis) => analyses.push(analysis),
    onDesynchronised: (magic) => desynchronised.push(magic),
  });
  return {
    reader,
    analyses,
    desynchronised,
    telemetryCount: () => telemetry,
  };
};

describe('the analysis frame length', () => {
  it('counts one stage and no scope', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    expect(analysisFrameLength(frame)).toBe(
      ANALYSIS_HEADER_BYTES + ANALYSIS_BINS * 4,
    );
    expect(frame.length).toBe(analysisFrameLength(frame));
  });

  // Counted from `ANALYSIS_STAGES` rather than written as a literal. The
  // frame carried three taps until Denoise added a fourth, and a hard-coded
  // count here fails on the day a stage is added instead of proving the
  // arithmetic still holds — which is the only thing this test is for.
  it('counts every stage and the scope', () => {
    const frame = buildAnalysis({
      stages: [...ANALYSIS_STAGES],
      withScope: true,
    });
    expect(analysisFrameLength(frame)).toBe(
      ANALYSIS_HEADER_BYTES +
        ANALYSIS_STAGES.length * ANALYSIS_BINS * 4 +
        ANALYSIS_SCOPE_PAIRS * 8,
    );
    expect(frame.length).toBe(analysisFrameLength(frame));
  });

  /**
   * A header this build cannot read refuses the stream rather than guessing.
   *
   * The length is how the next frame is found at all, so a header that cannot
   * be trusted has already lost the stream. Skipping "just this frame" would
   * resume reading in the middle of one and misread every frame after it.
   */
  it('refuses a bin count it does not recognise', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    frame.writeUInt32LE(777, 12);
    expect(analysisFrameLength(frame)).toBe(0);
  });

  it('refuses a stage bit that names no stage', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    frame.writeUInt32LE(0xffff, 8);
    expect(analysisFrameLength(frame)).toBe(0);
  });

  it('refuses a scope size that is neither absent nor the agreed one', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: true });
    frame.writeUInt32LE(7, 16);
    expect(analysisFrameLength(frame)).toBe(0);
  });
});

describe('decoding an analysis frame', () => {
  it('reads back the stages that were written, and only those', () => {
    const frame = buildAnalysis({
      stages: ['exciter', 'master'],
      withScope: false,
      fill: (stageIndex, bin) => stageIndex * 1000 + bin,
    });
    const decoded = decodeAnalysis(frame);
    expect(decoded).toBeDefined();
    expect(Object.keys(decoded?.spectra ?? {}).sort()).toEqual([
      'exciter',
      'master',
    ]);
    // Written in stage order, so the second stage present is `master` and its
    // values must be the second block — not the first read twice.
    expect(decoded?.spectra.exciter?.[5]).toBeCloseTo(5, 5);
    expect(decoded?.spectra.master?.[5]).toBeCloseTo(1005, 5);
    expect(decoded?.scatter).toBeUndefined();
  });

  it('reads the scope, the correlation and the peaks', () => {
    const frame = buildAnalysis({
      stages: ['eq'],
      withScope: true,
      correlation: -0.25,
      peaks: [0.5, 0.125],
    });
    const decoded = decodeAnalysis(frame);
    expect(decoded?.correlation).toBeCloseTo(-0.25, 6);
    expect(decoded?.peaks[0]).toBeCloseTo(0.5, 6);
    expect(decoded?.peaks[1]).toBeCloseTo(0.125, 6);
    expect(decoded?.scatter?.length).toBe(ANALYSIS_SCOPE_PAIRS * 2);
  });

  /**
   * Copied out of the transport's buffer, not viewed into it.
   *
   * `frame` is a subarray of a buffer the reader reassigns as the next chunk
   * arrives, so a view would be a window onto bytes that are about to become a
   * different frame — values changing under the renderer between one animation
   * frame and the next, which reads as noise in the spectrum.
   */
  it('does not alias the buffer it was decoded from', () => {
    const frame = buildAnalysis({
      stages: ['eq'],
      withScope: false,
      fill: () => 1,
    });
    const decoded = decodeAnalysis(frame);
    frame.fill(0, ANALYSIS_HEADER_BYTES);
    expect(decoded?.spectra.eq?.[0]).toBeCloseTo(1, 6);
  });

  it('refuses a frame whose payload is short of its own header', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    expect(decodeAnalysis(frame.subarray(0, frame.length - 4))).toBeUndefined();
  });

  /**
   * The drift case, stated as a test because a comment saying it was stated
   * the opposite for long enough to send three readers hunting for a check
   * that was already here.
   *
   * A host whose header grew without this build following writes a frame
   * longer than the fields inside it describe. That is the failure the fixed
   * offsets would otherwise turn into plausible numbers, and it is refused.
   */
  it('refuses a frame longer than its own header describes', () => {
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    // The control: the same frame, unpadded, decodes. Without it this passes
    // just as well against a decoder that refuses everything.
    expect(decodeAnalysis(frame)).toBeDefined();
    expect(
      decodeAnalysis(Buffer.concat([frame, Buffer.alloc(24)])),
    ).toBeUndefined();
  });
});

describe('reading analysis frames off a pipe', () => {
  it('takes one delivered whole', () => {
    const { reader, analyses } = collectingReader();
    reader.push(buildAnalysis({ stages: ['eq'], withScope: true }));
    expect(analyses).toHaveLength(1);
  });

  /**
   * The case the fixed-length reader could not have handled.
   *
   * Twelve kilobytes will not arrive in one chunk on any real pipe, so this is
   * the ordinary path rather than an edge case.
   */
  it('reassembles one split across many chunks', () => {
    const { reader, analyses } = collectingReader();
    const frame = buildAnalysis({
      stages: [...ANALYSIS_STAGES],
      withScope: true,
    });
    for (let at = 0; at < frame.length; at += 1500) {
      reader.push(frame.subarray(at, Math.min(at + 1500, frame.length)));
    }
    expect(analyses).toHaveLength(1);
    expect(Object.keys(analyses[0].spectra)).toHaveLength(
      ANALYSIS_STAGES.length,
    );
  });

  /** Including a split that lands inside the header itself. */
  it('reassembles one split inside its own header', () => {
    const { reader, analyses } = collectingReader();
    const frame = buildAnalysis({ stages: ['master'], withScope: false });
    reader.push(frame.subarray(0, 6));
    expect(analyses).toHaveLength(0);
    reader.push(frame.subarray(6));
    expect(analyses).toHaveLength(1);
  });

  /**
   * The arithmetic that matters: the frame after it must still be found.
   *
   * A length wrong by one byte does not lose one frame, it loses every frame
   * after it — so a fixed-size frame following a variable one is the assertion
   * that actually proves the size was right.
   */
  it('finds the next frame exactly where the analysis frame ends', () => {
    const { reader, analyses, telemetryCount, desynchronised } =
      collectingReader();
    reader.push(
      Buffer.concat([
        buildAnalysis({ stages: ['eq', 'master'], withScope: true }),
        telemetryFrame(),
        buildAnalysis({ stages: ['exciter'], withScope: false }),
        telemetryFrame(),
      ]),
    );
    expect(analyses).toHaveLength(2);
    expect(telemetryCount()).toBe(2);
    expect(desynchronised).toEqual([]);
  });

  /** A header that cannot be trusted stops the reader rather than guessing. */
  it('reports a desynchronised stream on an unreadable header', () => {
    const { reader, analyses, desynchronised } = collectingReader();
    const frame = buildAnalysis({ stages: ['eq'], withScope: false });
    frame.writeUInt32LE(4242, 12);
    reader.push(frame);
    expect(analyses).toHaveLength(0);
    expect(desynchronised).toEqual([MAGIC_ANALYSIS]);
  });
});

/**
 * The fixed tail: the Master's five readouts, the Normalizer's bars, Dimension.
 *
 * These share one stretch of header and were added by two separate pieces of
 * work, one of which took the float that used to pad the frame to eight-byte
 * alignment. That is exactly the kind of neighbour that collides silently — a
 * field landing four bytes out still decodes to a plausible number, and the
 * only symptom is a readout that is wrong rather than missing.
 *
 * So every field is written and read back individually, at a distinct value.
 * Filling them all with the same number would pass just as well if the decoder
 * read one field twice and another never.
 */
describe('the Master, Normalizer and Dimension fields', () => {
  const tail = {
    dimensionGuard: 0.5,
    autoHeadroomReductionDb: -6.5,
    autoHeadroomTruePeakDb: -1.25,
    safetyReductionDb: -0.75,
    safetyTruePeakDb: -0.25,
    dcCorrectionDb: -54,
    repairedSamples: 7,
    truePeakFactor: 2,
    safetyEnabled: false,
    normalizerInputPeaks: [0.375, 0.4375] as const,
    normalizerOutputPeaks: [0.625, 0.6875] as const,
    normalizerAppliedGainDb: 4.5,
  };

  it('round-trips every one of them', () => {
    const decoded = decodeAnalysis(
      buildAnalysis({ stages: ['master'], withScope: false, tail }),
    );

    expect(decoded?.dimensionGuard).toBeCloseTo(0.5, 6);
    expect(decoded?.master).toEqual({
      autoHeadroomReductionDb: -6.5,
      autoHeadroomTruePeakDb: -1.25,
      safetyReductionDb: -0.75,
      safetyTruePeakDb: -0.25,
      dcCorrectionDb: -54,
      repairedSamples: 7,
      truePeakFactor: 2,
      safetyEnabled: false,
    });
    expect(decoded?.normalizer).toEqual({
      inputPeaks: [0.375, 0.4375],
      outputPeaks: [0.625, 0.6875],
      appliedGainDb: 4.5,
    });
  });

  /**
   * The tail survives the payload it sits in front of.
   *
   * Three spectra and a scope is twelve kilobytes written after this header. A
   * length computed one field short would put the bins over the top of it, and
   * the spectra would still decode — they are just floats — while the readouts
   * quietly became whatever the first bins happened to be.
   */
  it('is not overwritten by a full payload', () => {
    const decoded = decodeAnalysis(
      buildAnalysis({
        stages: [...ANALYSIS_STAGES],
        withScope: true,
        fill: () => -12,
        tail,
      }),
    );

    expect(decoded?.master.autoHeadroomReductionDb).toBeCloseTo(-6.5, 6);
    expect(decoded?.normalizer.appliedGainDb).toBeCloseTo(4.5, 6);
    expect(decoded?.spectra.master?.[0]).toBeCloseTo(-12, 6);
  });

  /**
   * An oversampling factor this build does not know is not printed as a fact.
   *
   * The panel puts this number beside the ceiling it was measured at. A zero
   * from a frame written by some other build would read as "measured at 0x",
   * which is not a thing; four overstates the measurement rather than
   * understating it, which is the safe direction for a headroom readout.
   */
  it('falls back to 4x for a true-peak factor it does not recognise', () => {
    const frame = buildAnalysis({
      stages: ['master'],
      withScope: false,
      tail,
    });
    frame.writeUInt32LE(0, 88);
    expect(decodeAnalysis(frame)?.master.truePeakFactor).toBe(4);

    frame.writeUInt32LE(1, 88);
    expect(decodeAnalysis(frame)?.master.truePeakFactor).toBe(1);
  });
});
