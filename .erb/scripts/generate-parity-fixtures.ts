/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Freeze what the TypeScript engine does, so a C++ port can be held to it.
 *
 * The reference is regenerated from the TypeScript modules on every run rather
 * than committed. During a migration that is the correct direction — the
 * TypeScript engine IS the specification, and a committed corpus would let the
 * two drift apart with the fixtures insisting the old answer was right. It
 * also means this suite cannot catch a regression in the reference itself;
 * that is what the Jest tests over those modules are for, and the two are not
 * substitutes.
 *
 * Written to `native/.build/fixtures`, which is gitignored along with the rest
 * of the build tree.
 */
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import path from 'path';
import { FilterTypeEnum } from '../../src/common/constants';
import {
  PARITY_SAMPLE_RATES,
  parityCorpus,
} from '../../src/common/dsp/paritySignals';
import {
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from '../../src/renderer/dsp/biquad';
import {
  processEqBands,
  processEqBandsLinked,
  processEqOversampled,
  processEqOversampledLinked,
} from '../../src/renderer/dsp/eqEngine';
import { createOversampler } from '../../src/renderer/dsp/oversample';
import {
  createBandDynamics,
  refreshBandDynamics,
} from '../../src/renderer/dsp/dynamics';
import type { TEqEngine } from '../../src/common/dsp/chain';

const OUTPUT = path.join(
  __dirname,
  '..',
  '..',
  'native',
  '.build',
  'fixtures',
);

/** Must match `parity_test.cpp`. 'FEQF'. */
const MAGIC = 0x46514546;
const VERSION = 1;
const HEADER_BYTES = 112;
const NAME_BYTES = 64;

/**
 * Not a multiple of 128.
 *
 * A processor that has only ever seen whole render quanta is a processor whose
 * tail handling is untested, and a device hands over partial blocks routinely.
 */
const FRAMES = 2053;

enum ProcessorId {
  Identity = 0,
  Biquad = 1,
  EqBands = 2,
  EqLinked = 3,
  EqOversampled = 4,
  EqOversampledLinked = 5,
}

interface IRackBand {
  type: FilterTypeEnum;
  frequency: number;
  gainDb: number;
  quality: number;
  dynamic?: boolean;
  thresholdDb?: number;
}

interface IFixture {
  name: string;
  processor: ProcessorId;
  sampleRate: number;
  params: number[];
  input: Float32Array[];
  expected: Float32Array[];
  maxAbsTolerance: number;
  rmsTolerance: number;
}

const write = (fixture: IFixture, index: number): void => {
  const channels = fixture.input.length;
  const frames = fixture.input[0].length;
  const samples = channels * frames;
  const size =
    HEADER_BYTES + fixture.params.length * 8 + samples * 4 * 2;
  const buffer = Buffer.alloc(size);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  view.setUint32(0, MAGIC, true);
  view.setUint32(4, VERSION, true);
  view.setUint32(8, fixture.processor, true);
  view.setUint32(12, fixture.sampleRate, true);
  view.setUint32(16, channels, true);
  view.setUint32(20, frames, true);
  view.setUint32(24, fixture.params.length, true);
  view.setUint32(28, 0, true);
  view.setFloat64(32, fixture.maxAbsTolerance, true);
  view.setFloat64(40, fixture.rmsTolerance, true);
  // Truncated rather than allowed to overrun the field: the name is for a
  // human reading a failure, and a name that walked into the parameter block
  // would corrupt the case it was describing.
  buffer.write(fixture.name.slice(0, NAME_BYTES - 1), 48, 'utf8');

  let at = HEADER_BYTES;
  fixture.params.forEach((value) => {
    view.setFloat64(at, value, true);
    at += 8;
  });
  // Planar: one channel's frames, then the next. The same order the engine's
  // pointer array implies, so neither side has to interleave to compare.
  fixture.input.forEach((channel) => {
    channel.forEach((value) => {
      view.setFloat32(at, value, true);
      at += 4;
    });
  });
  fixture.expected.forEach((channel) => {
    channel.forEach((value) => {
      view.setFloat32(at, value, true);
      at += 4;
    });
  });

  const safe = fixture.name.replace(/[^a-z0-9-]/gi, '_');
  writeFileSync(
    path.join(OUTPUT, `${String(index).padStart(4, '0')}-${safe}.feqfix`),
    buffer,
  );
};

/**
 * The engine's own contract, not a TypeScript processor's.
 *
 * `feq_engine_process_planar` promises the samples back unchanged except that
 * a non-finite one becomes silence. Nothing in TypeScript performs that
 * repair, so the expectation is written from the contract in `dsp.h` — which
 * is exactly why these cases are worth having: they are the only ones that
 * check the guard rather than the arithmetic.
 */
const repaired = (input: Float32Array[]): Float32Array[] =>
  input.map((channel) =>
    Float32Array.from(channel, (value) => (Number.isFinite(value) ? value : 0)),
  );

const identityExpectation = (input: Float32Array[]): Float32Array[] =>
  repaired(input);

/**
 * Repair happens once, at the engine's input, and never again.
 *
 * So a processor's fixture is fed what the chain would actually hand it —
 * already repaired — rather than a raw NaN. Feeding one straight into a biquad
 * tests an input the engine cannot produce, and both sides then answer NaN,
 * which compares equal to nothing and proves nothing.
 *
 * The signal keeps its value after repair: a steady level with three samples
 * punched to zero is a discontinuity, and a filter's response to one is worth
 * checking on both sides.
 */
const processorInput = (input: Float32Array[]): Float32Array[] =>
  repaired(input);

const biquadExpectation = (
  input: Float32Array[],
  sampleRate: number,
  type: FilterTypeEnum,
  frequency: number,
  gainDb: number,
  quality: number,
): Float32Array[] => {
  const coefficients = biquadCoefficients(
    { type, frequency, gainDb, quality },
    sampleRate,
  );
  return input.map((channel) => {
    // A copy, because `processBiquad` writes in place and the input has to
    // survive to be written into the fixture beside its own answer.
    const output = Float32Array.from(channel);
    processBiquad(createBiquadState(), output, coefficients);
    return output;
  });
};

/**
 * A whole rack, through the arrangement the user chose.
 *
 * The detector state is rebuilt per channel alongside the filter state,
 * exactly as the engine does: an envelope is channel-local, and sharing one
 * between two channels would let the left channel's sibilant duck the right.
 */
const eqExpectation = (
  input: Float32Array[],
  sampleRate: number,
  engine: TEqEngine,
  bands: readonly IRackBand[],
): Float32Array[] => {
  const coefficients = bands.map((band) =>
    biquadCoefficients(
      {
        type: band.type,
        frequency: band.frequency,
        gainDb: band.gainDb,
        quality: band.quality,
      },
      sampleRate,
    ),
  );
  return input.map((channel) => {
    const target = Float32Array.from(channel);
    const dry = new Float32Array(target.length);
    const wet = new Float32Array(target.length);
    const dynamics = bands.map((band) => {
      const state = createBandDynamics();
      refreshBandDynamics(
        state,
        {
          enabled: true,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
          dynamic: band.dynamic === true,
          thresholdDb: band.thresholdDb ?? -24,
        },
        sampleRate,
        true,
      );
      return state;
    });
    processEqBands(
      bands.map(() => createBiquadState()),
      coefficients,
      target,
      engine,
      dry,
      wet,
      dynamics,
    );
    return target;
  });
};

/** The detector states a rack needs, built the way the engine builds them. */
const rackDynamics = (bands: readonly IRackBand[], sampleRate: number) =>
  bands.map((band) => {
    const state = createBandDynamics();
    refreshBandDynamics(
      state,
      {
        enabled: true,
        type: band.type,
        frequency: band.frequency,
        gainDb: band.gainDb,
        quality: band.quality,
        dynamic: band.dynamic === true,
        thresholdDb: band.thresholdDb ?? -24,
      },
      sampleRate,
      true,
    );
    return state;
  });

const rackCoefficients = (bands: readonly IRackBand[], sampleRate: number) =>
  bands.map((band) =>
    biquadCoefficients(
      {
        type: band.type,
        frequency: band.frequency,
        gainDb: band.gainDb,
        quality: band.quality,
      },
      sampleRate,
    ),
  );

/**
 * The linked rack: one detector for every channel.
 *
 * Filter histories stay per channel; the dynamics array does not. That is the
 * whole point — a shared envelope is what stops a dynamic cut engaging on the
 * left a few samples before the right and dragging a centred vocal sideways.
 */
const eqLinkedExpectation = (
  input: Float32Array[],
  sampleRate: number,
  engine: TEqEngine,
  bands: readonly IRackBand[],
): Float32Array[] => {
  const targets = input.map((channel) => Float32Array.from(channel));
  const dry = targets.map((channel) => new Float32Array(channel.length));
  const wet = targets.map((channel) => new Float32Array(channel.length));
  processEqBandsLinked(
    targets.map(() => bands.map(() => createBiquadState())),
    rackCoefficients(bands, sampleRate),
    targets,
    engine,
    dry,
    wet,
    rackDynamics(bands, sampleRate),
  );
  return targets;
};

/**
 * Up, through the rack, and back down.
 *
 * The coefficients are built for the OVERSAMPLED rate. Handing this the
 * ordinary set would place every band an octave low, which is a bug rather
 * than a mode — so the fixture builds them the same way the engine must.
 */
const eqOversampledExpectation = (
  input: Float32Array[],
  sampleRate: number,
  engine: TEqEngine,
  bands: readonly IRackBand[],
  factor: number,
): Float32Array[] => {
  const coefficients = rackCoefficients(bands, sampleRate * factor);
  return input.map((channel) => {
    const target = Float32Array.from(channel);
    const doubled = new Float32Array(target.length * factor);
    processEqOversampled(
      bands.map(() => createBiquadState()),
      coefficients,
      target,
      engine,
      createOversampler(target.length),
      factor,
      doubled,
      new Float32Array(doubled.length),
      new Float32Array(doubled.length),
      rackDynamics(bands, sampleRate * factor),
    );
    return target;
  });
};

const eqOversampledLinkedExpectation = (
  input: Float32Array[],
  sampleRate: number,
  engine: TEqEngine,
  bands: readonly IRackBand[],
  factor: number,
): Float32Array[] => {
  const targets = input.map((channel) => Float32Array.from(channel));
  const doubled = targets.map(
    (channel) => new Float32Array(channel.length * factor),
  );
  processEqOversampledLinked(
    targets.map(() => bands.map(() => createBiquadState())),
    rackCoefficients(bands, sampleRate * factor),
    targets,
    engine,
    targets.map((channel) => createOversampler(channel.length)),
    factor,
    doubled,
    doubled.map((channel) => new Float32Array(channel.length)),
    doubled.map((channel) => new Float32Array(channel.length)),
    rackDynamics(bands, sampleRate * factor),
  );
  return targets;
};

/**
 * Two racks: a small one and a crowded one.
 *
 * The three-band case is the ordinary shape. The ten-band case is the one that
 * matters for parity — parallel sums a difference per band, so ten of them
 * compound whatever rounding the port gets wrong, and serial cascades ten sets
 * of filter state. A port that is a few ULPs out survives three bands and
 * fails ten.
 */
const RACKS: { label: string; bands: IRackBand[] }[] = [
  {
    label: 'three-band',
    bands: [
      {
        type: FilterTypeEnum.LSC,
        frequency: 100,
        gainDb: 4,
        quality: 0.707,
      },
      { type: FilterTypeEnum.PK, frequency: 1000, gainDb: -3, quality: 1.4 },
      {
        type: FilterTypeEnum.HSC,
        frequency: 6000,
        gainDb: 2.5,
        quality: 0.707,
      },
    ],
  },
  {
    label: 'ten-band',
    bands: [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000].map(
      (frequency, index) => ({
        type: FilterTypeEnum.PK,
        frequency,
        // Alternating boost and cut, so neighbouring bands genuinely overlap
        // and fight rather than all pushing the same way.
        gainDb: index % 2 === 0 ? 3.5 : -2.5,
        quality: 1.1,
      }),
    ),
  },
  {
    /**
     * Dynamic bands, which is where an envelope can diverge and never come
     * back. A one-pole follower has no way to re-converge once two ports
     * disagree, so any drift here compounds for the rest of the block — the
     * opposite of a static filter, where an error decays with the impulse
     * response.
     *
     * Thresholds are set low enough that the corpus actually crosses them;
     * a detector that never opens tests only the branch that returns zero.
     */
    label: 'dynamic-mixed',
    bands: [
      {
        type: FilterTypeEnum.PK,
        frequency: 6000,
        gainDb: -8,
        quality: 3,
        dynamic: true,
        thresholdDb: -40,
      },
      // Static, beside a dynamic one: the ordinary rack is a mixture, and the
      // serial path takes a different branch per band.
      { type: FilterTypeEnum.PK, frequency: 200, gainDb: 3, quality: 1 },
      {
        type: FilterTypeEnum.HSC,
        frequency: 10000,
        gainDb: 5,
        quality: 0.707,
        dynamic: true,
        thresholdDb: -50,
      },
    ],
  },
];

const ENGINES: TEqEngine[] = ['serial', 'parallel'];

/**
 * Three filters that fail in three different ways.
 *
 * A low bell at high Q is where Direct Form II's state blows up at 32-bit
 * float — the reason `processBiquad` is Form I. A high shelf is where the
 * cookbook squeezes a skirt near Nyquist. A high-pass has no gain term at all,
 * which is where a port that assumes one produces silence.
 */
const BIQUAD_CASES: {
  label: string;
  type: FilterTypeEnum;
  frequency: number;
  gainDb: number;
  quality: number;
}[] = [
  {
    label: 'peak-30hz-q8',
    type: FilterTypeEnum.PK,
    frequency: 30,
    gainDb: 9,
    quality: 8,
  },
  {
    label: 'highshelf-8k',
    type: FilterTypeEnum.HSC,
    frequency: 8000,
    gainDb: -6,
    quality: 0.707,
  },
  {
    label: 'highpass-80hz',
    type: FilterTypeEnum.HPQ,
    frequency: 80,
    gainDb: 0,
    quality: 0.707,
  },
];

const FILTER_TYPE_ORDER = [
  FilterTypeEnum.PK,
  FilterTypeEnum.NO,
  FilterTypeEnum.LSC,
  FilterTypeEnum.HSC,
  FilterTypeEnum.LPQ,
  FilterTypeEnum.HPQ,
  FilterTypeEnum.BP,
];

const fixtures: IFixture[] = [];

// Identity across every rate the app can run at. Passing at 48 kHz says
// nothing about 192, where a block is four times shorter in wall time.
PARITY_SAMPLE_RATES.forEach((sampleRate) => {
  parityCorpus(FRAMES, sampleRate).forEach((signal) => {
    fixtures.push({
      name: `identity/${sampleRate}/${signal.name}`,
      processor: ProcessorId.Identity,
      sampleRate,
      params: [],
      input: signal.channels,
      expected: identityExpectation(signal.channels),
      // A copy has no tolerance. Anything other than bit-exact here is a bug
      // in the copy, not a difference of opinion between compilers.
      maxAbsTolerance: 0,
      rmsTolerance: 0,
    });
  });
});

// The biquad corpus at one rate, plus a sweep at every rate. The corpus finds
// behavioural faults; the rate sweep finds coefficient maths that only holds
// at 48 kHz.
BIQUAD_CASES.forEach((filter) => {
  const typeIndex = FILTER_TYPE_ORDER.indexOf(filter.type);
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `biquad/${filter.label}/48000/${signal.name}`,
      processor: ProcessorId.Biquad,
      sampleRate: 48000,
      params: [typeIndex, filter.frequency, filter.gainDb, filter.quality],
      input: processorInput(signal.channels),
      expected: biquadExpectation(
        processorInput(signal.channels),
        48000,
        filter.type,
        filter.frequency,
        filter.gainDb,
        filter.quality,
      ),
      // Coefficients are built in double and the state is stored back into
      // float32 every sample, so a faithful port lands within a float ULP of
      // the reference across the whole block rather than exactly on it.
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });

  PARITY_SAMPLE_RATES.forEach((sampleRate) => {
    const signal = parityCorpus(FRAMES, sampleRate).find(
      (entry) => entry.name === 'sweep',
    );
    if (!signal) {
      return;
    }
    fixtures.push({
      name: `biquad/${filter.label}/${sampleRate}/sweep`,
      processor: ProcessorId.Biquad,
      sampleRate,
      params: [typeIndex, filter.frequency, filter.gainDb, filter.quality],
      input: processorInput(signal.channels),
      expected: biquadExpectation(
        processorInput(signal.channels),
        sampleRate,
        filter.type,
        filter.frequency,
        filter.gainDb,
        filter.quality,
      ),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

// The rack, both arrangements, at 48 kHz across the whole corpus.
RACKS.forEach((rack) => {
  ENGINES.forEach((engine) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `eq/${rack.label}/${engine}/48000/${signal.name}`,
        processor: ProcessorId.EqBands,
        sampleRate: 48000,
        params: [
          ENGINES.indexOf(engine),
          rack.bands.length,
          // Six per band, and the runner asserts that count: a layout the two
          // sides disagree about would silently read a threshold as a Q.
          ...rack.bands.flatMap((band) => [
            FILTER_TYPE_ORDER.indexOf(band.type),
            band.frequency,
            band.gainDb,
            band.quality,
            band.dynamic === true ? 1 : 0,
            band.thresholdDb ?? -24,
          ]),
        ],
        input: processorInput(signal.channels),
        expected: eqExpectation(
          processorInput(signal.channels),
          48000,
          engine,
          rack.bands,
        ),
        // Looser than one biquad, and it has to be: parallel accumulates a
        // rounding per band into the same sample, so ten bands is ten chances
        // for the last bit to move. Still far below anything audible — a
        // millionth of full scale is about -120 dBFS.
        maxAbsTolerance: 1e-5,
        rmsTolerance: 1e-6,
      });
    });
  });
});

/** `[engine, bandCount, (type, hz, gain, q, dynamic, thresholdDb) * count]`. */
const rackParams = (engine: TEqEngine, bands: readonly IRackBand[]) => [
  ENGINES.indexOf(engine),
  bands.length,
  ...bands.flatMap((band) => [
    FILTER_TYPE_ORDER.indexOf(band.type),
    band.frequency,
    band.gainDb,
    band.quality,
    band.dynamic === true ? 1 : 0,
    band.thresholdDb ?? -24,
  ]),
];

// The linked detector, and the oversampled paths at both factors. The
// dynamic-mixed rack is the one that matters for linking: a rack with no
// active detector takes the same branch linked or not.
RACKS.forEach((rack) => {
  ENGINES.forEach((engine) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `eqlinked/${rack.label}/${engine}/48000/${signal.name}`,
        processor: ProcessorId.EqLinked,
        sampleRate: 48000,
        params: rackParams(engine, rack.bands),
        input: processorInput(signal.channels),
        expected: eqLinkedExpectation(
          processorInput(signal.channels),
          48000,
          engine,
          rack.bands,
        ),
        maxAbsTolerance: 1e-5,
        rmsTolerance: 1e-6,
      });
    });

    [2, 4].forEach((factor) => {
      parityCorpus(FRAMES, 48000).forEach((signal) => {
        fixtures.push({
          name: `eqos${factor}x/${rack.label}/${engine}/48000/${signal.name}`,
          processor: ProcessorId.EqOversampled,
          sampleRate: 48000,
          params: [factor, ...rackParams(engine, rack.bands)],
          input: processorInput(signal.channels),
          expected: eqOversampledExpectation(
            processorInput(signal.channels),
            48000,
            engine,
            rack.bands,
            factor,
          ),
          // A sixty-three tap FIR run twice each way accumulates more
          // rounding than a biquad does, and 4x runs it four times. Still
          // around -100 dBFS, which is below the noise floor of any record.
          maxAbsTolerance: 1e-4,
          rmsTolerance: 1e-5,
        });
      });
    });

    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `eqoslinked/${rack.label}/${engine}/48000/${signal.name}`,
        processor: ProcessorId.EqOversampledLinked,
        sampleRate: 48000,
        params: [4, ...rackParams(engine, rack.bands)],
        input: processorInput(signal.channels),
        expected: eqOversampledLinkedExpectation(
          processorInput(signal.channels),
          48000,
          engine,
          rack.bands,
          4,
        ),
        maxAbsTolerance: 1e-4,
        rmsTolerance: 1e-5,
      });
    });
  });
});

rmSync(OUTPUT, { recursive: true, force: true });
mkdirSync(OUTPUT, { recursive: true });
fixtures.forEach(write);

const byProcessor = new Map<number, number>();
fixtures.forEach((fixture) =>
  byProcessor.set(
    fixture.processor,
    (byProcessor.get(fixture.processor) ?? 0) + 1,
  ),
);
// Derived from the enum rather than listed by hand: a processor added above
// and forgotten here would be written, verified and never mentioned, which is
// the quiet half of a suite reporting more coverage than it has.
const breakdown = Object.entries(ProcessorId)
  .filter(([, value]) => typeof value === 'number')
  .map(([label, value]) => `${label.toLowerCase()} ${byProcessor.get(value as number) ?? 0}`)
  .join(', ');
console.log(
  `parity fixtures: ${fixtures.length} written to ${OUTPUT} (${breakdown})`,
);
