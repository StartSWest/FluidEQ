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
  createDelayLine,
  processDelayLine,
} from '../../src/renderer/dsp/delayLine';
import {
  createCrossoverState,
  splitBands,
} from '../../src/renderer/dsp/crossover';
import {
  createTruePeakState,
  truePeakOfSample,
} from '../../src/renderer/dsp/truePeak';
import {
  createSaturator,
  fuzzBlend,
  fuzzDrive,
  saturateBlock,
} from '../../src/renderer/dsp/saturate';
import {
  createLimiterState,
  processLimiter,
  createLinkedLimiterState,
  processLinkedLimiter,
} from '../../src/renderer/dsp/limiter';
import {
  createCompressorState,
  processBand,
  processBandLinked,
} from '../../src/renderer/dsp/compressor';
import {
  createOutputSafety,
  processOutputSafety,
} from '../../src/renderer/dsp/outputSafety';
import {
  createPostFilterNormalizer,
  processPostFilterNormalizer,
} from '../../src/renderer/dsp/postFilterNormalizer';
import {
  analogDiodeExcitedSample,
  createExciterTransientState,
  exciterTransientSample,
} from '../../src/renderer/dsp/analogDiode';
import {
  alignChannel,
  createPhaseAlign,
} from '../../src/renderer/dsp/phaseAlign';
import {
  createExciterGuard,
  guardExciterReturn,
} from '../../src/renderer/dsp/exciterGuard';
import {
  createOrganicState,
  organicBlock,
} from '../../src/renderer/dsp/organic';
import {
  createOrganicPath,
  runOrganicPath,
} from '../../src/renderer/dsp/organicStage';
import {
  createExciterChannel,
  runExciterChannel,
} from '../../src/renderer/dsp/exciterStage';
import {
  convolve,
  createConvolver,
  prepareKernel,
} from '../../src/renderer/dsp/convolver';
import {
  createBandDynamics,
  refreshBandDynamics,
} from '../../src/renderer/dsp/dynamics';
import {
  buildLinearPhaseKernel,
  KERNEL_SIZE,
} from '../../src/renderer/dsp/linearPhase';
import { createLoudnessAnalyzer } from '../../src/renderer/dsp/loudnessAnalysis';
import { crossfadeGain } from '../../src/renderer/dsp/deckCrossfade';
import {
  CROSSFADE_CURVES,
  EQ_ENGINES,
  EQ_PHASE_MODES,
  EQ_STEREO_MODES,
} from '../../src/common/dsp/chain';
import { createWorkletHarness } from './lib/workletHarness';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import { DSP_DEFAULTS, EQ_MODELS } from '../../src/common/dsp/chain';
import type {
  IEqSettings,
  TEqEngine,
  TEqModel,
} from '../../src/common/dsp/chain';

/**
 * The AudioWorklet global several of these modules fall back to.
 *
 * `sampleRate` is defined by `AudioWorkletGlobalScope` and by nothing else, so
 * importing a processor that reads it into plain Node fails at load. Every
 * fixture supplies an explicit rate and the fallback is never the value used —
 * but the module still has to load, so the global is provided.
 *
 * That fallback is itself the reason these modules cannot be unit-tested
 * outside a worklet today, and it is one of the things the port removes: the
 * C++ side takes its rate as an argument, always.
 */
(globalThis as { sampleRate?: number }).sampleRate = 48_000;

const OUTPUT = path.join(__dirname, '..', '..', 'native', '.build', 'fixtures');

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
  DelayLine = 6,
  Crossover = 7,
  TruePeak = 8,
  Saturate = 9,
  Limiter = 10,
  LinkedLimiter = 11,
  Compressor = 12,
  CompressorLinked = 13,
  OutputSafety = 14,
  AutoHeadroom = 15,
  ExciterTransient = 16,
  AnalogDiode = 17,
  PhaseAlign = 18,
  ExciterGuard = 19,
  Organic = 20,
  OrganicPath = 21,
  Exciter = 22,
  Convolver = 23,
  LinearPhase = 24,
  Loudness = 25,
  Crossfade = 26,
  Chain = 27,
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
  const size = HEADER_BYTES + fixture.params.length * 8 + samples * 4 * 2;
  const buffer = Buffer.alloc(size);
  const view = new DataView(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength,
  );

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

// The primitives the dynamics processors are built from. Each is small, and
// each is somewhere a port goes wrong in its own way: a delay line by one
// sample, a crossover by not summing back to its input, a true-peak detector
// by reporting the sample peak and calling it true.
[1, 12, 64, 511].forEach((delay) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `delay/${delay}/48000/${signal.name}`,
      processor: ProcessorId.DelayLine,
      sampleRate: 48000,
      params: [delay],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const target = Float32Array.from(channel);
        processDelayLine(createDelayLine(delay), target);
        return target;
      }),
      // A delay moves samples; it does not change them.
      maxAbsTolerance: 0,
      rmsTolerance: 0,
    });
  });
});

// One fixture per band, so each is compared on its own rather than averaged
// into a sum that could hide two errors cancelling.
(['low', 'mid', 'high'] as const).forEach((band, bandIndex) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `crossover/${band}/48000/${signal.name}`,
      processor: ProcessorId.Crossover,
      sampleRate: 48000,
      params: [bandIndex, 250, 3000],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const low = new Float32Array(channel.length);
        const mid = new Float32Array(channel.length);
        const high = new Float32Array(channel.length);
        splitBands(
          createCrossoverState(),
          channel,
          low,
          mid,
          high,
          [250, 3000],
          48000,
        );
        return [low, mid, high][bandIndex];
      }),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

// The magnitude per sample, written out as a signal so the same comparison
// machinery applies. A limiter reads exactly this, one sample at a time.
[1, 2, 4].forEach((factor) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `truepeak/${factor}x/48000/${signal.name}`,
      processor: ProcessorId.TruePeak,
      sampleRate: 48000,
      params: [factor],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const state = createTruePeakState(factor as 1 | 2 | 4);
        return Float32Array.from(channel, (value) =>
          truePeakOfSample(state, value),
        );
      }),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

/**
 * The colour curve, raw and blended, at the drives the dial actually reaches.
 *
 * A negative blend means the raw shaper — the form measurement uses. Zero to
 * one is the parallel path the EQ runs, where the carrier is preserved and
 * only the difference is scaled.
 */
[0.05, 0.5, 0.72].forEach((amount) => {
  const drive = amount === 0.72 ? fuzzDrive(1) : fuzzDrive(amount);
  [-1, fuzzBlend(amount)].forEach((blend) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `saturate/${drive.toFixed(3)}/${blend < 0 ? 'raw' : 'blend'}/${signal.name}`,
        processor: ProcessorId.Saturate,
        sampleRate: 48000,
        params: [drive, blend],
        input: processorInput(signal.channels),
        expected: processorInput(signal.channels).map((channel) => {
          const target = Float32Array.from(channel);
          saturateBlock(
            createSaturator(target.length),
            target,
            drive,
            blend < 0 ? undefined : blend,
            48000,
          );
          return target;
        }),
        // A tanh through a 4x resampler both ways: the FIR rounding dominates,
        // as it does for the oversampled EQ.
        maxAbsTolerance: 1e-4,
        rmsTolerance: 1e-5,
      });
    });
  });
});

/**
 * Look-ahead limiting, at the look-aheads and ceilings the app offers.
 *
 * A zero look-ahead is included on purpose: it takes a different branch — the
 * emitted sample is the incoming one rather than a delayed slot — and it is
 * the branch a port is most likely to get wrong, because it is the one the
 * ordinary case never exercises.
 */
[0, 8, 64, 480].forEach((lookAhead) => {
  [0.5, 0.891].forEach((ceiling) => {
    [0, 3].forEach((kneeDb) => {
      parityCorpus(FRAMES, 48000).forEach((signal) => {
        fixtures.push({
          name: `limiter/${lookAhead}/${ceiling}/k${kneeDb}/${signal.name}`,
          processor: ProcessorId.Limiter,
          sampleRate: 48000,
          params: [lookAhead, ceiling, 0.9995, 0.998, kneeDb, ceiling],
          input: processorInput(signal.channels),
          expected: processorInput(signal.channels).map((channel) => {
            const output = new Float32Array(channel.length);
            processLimiter(createLimiterState(lookAhead), channel, output, {
              ceiling,
              activationThreshold: ceiling,
              releaseCoefficient: 0.9995,
              limitingReleaseCoefficient: 0.998,
              kneeDb,
            });
            return output;
          }),
          maxAbsTolerance: 1e-6,
          rmsTolerance: 1e-7,
        });
      });
    });
  });
});

/**
 * The linked limiter, in both of its two quite different modes.
 *
 * Without a slew it back-fills a delayed control signal with a linear-in-dB
 * ramp; with one it moves the gain at a fixed rate and holds the target across
 * the look-ahead. They share almost no code path, so both are generated.
 */
[
  { label: 'ramped', slew: 0, hold: 0 },
  { label: 'slewed', slew: 300, hold: 64 },
].forEach((mode) => {
  [8, 480].forEach((lookAhead) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      const options = {
        ceiling: 0.891,
        activationThreshold: 0.891,
        releaseCoefficient: 0.9995,
        limitingReleaseCoefficient: 0.998,
        kneeDb: 2,
        releaseHoldSamples: mode.hold,
        attackSlewDbPerSecond: mode.slew > 0 ? mode.slew : undefined,
        releaseSnapRatio: 0.01,
        sampleRate: 48000,
      };
      fixtures.push({
        name: `linklim/${mode.label}/${lookAhead}/${signal.name}`,
        processor: ProcessorId.LinkedLimiter,
        sampleRate: 48000,
        params: [
          lookAhead,
          options.ceiling,
          options.releaseCoefficient,
          options.limitingReleaseCoefficient,
          options.kneeDb,
          options.activationThreshold,
          options.releaseHoldSamples,
          mode.slew,
          options.releaseSnapRatio,
          48000,
        ],
        input: processorInput(signal.channels),
        expected: (() => {
          const targets = processorInput(signal.channels).map((channel) =>
            Float32Array.from(channel),
          );
          processLinkedLimiter(
            createLinkedLimiterState(targets.length, lookAhead),
            targets,
            options,
          );
          return targets;
        })(),
        maxAbsTolerance: 1e-6,
        rmsTolerance: 1e-7,
      });
    });
  });
});

// One compressor band, dual-mono and linked. Ratios span gentle to near-brick,
// because `over ** (1 / ratio - 1)` behaves differently at each end.
[
  { label: 'gentle', thresholdDb: -24, ratio: 2, attackMs: 20, releaseMs: 200 },
  { label: 'firm', thresholdDb: -30, ratio: 8, attackMs: 1, releaseMs: 60 },
  {
    label: 'brick',
    thresholdDb: -12,
    ratio: 20,
    attackMs: 0.1,
    releaseMs: 500,
  },
].forEach((band) => {
  [ProcessorId.Compressor, ProcessorId.CompressorLinked].forEach(
    (processor) => {
      const linked = processor === ProcessorId.CompressorLinked;
      parityCorpus(FRAMES, 48000).forEach((signal) => {
        fixtures.push({
          name: `comp${linked ? 'link' : ''}/${band.label}/${signal.name}`,
          processor,
          sampleRate: 48000,
          params: [
            band.thresholdDb,
            band.ratio,
            band.attackMs,
            band.releaseMs,
            3,
          ],
          input: processorInput(signal.channels),
          expected: (() => {
            const settings = { ...band, makeupDb: 3 };
            if (linked) {
              const targets = processorInput(signal.channels).map((channel) =>
                Float32Array.from(channel),
              );
              processBandLinked(
                createCompressorState(),
                targets,
                settings,
                48000,
              );
              return targets;
            }
            return processorInput(signal.channels).map((channel) => {
              const target = Float32Array.from(channel);
              processBand(createCompressorState(), target, settings, 48000);
              return target;
            });
          })(),
          maxAbsTolerance: 1e-6,
          rmsTolerance: 1e-7,
        });
      });
    },
  );
});

/**
 * The always-on guard, bypassed and engaged.
 *
 * Bypassed is not a no-op and that is the point: the DC blocker still runs and
 * the delay line still advances, so toggling Safety cannot change latency or
 * replay stale audio. A fixture that only covered the engaged path would let a
 * port skip the whole stage when disabled and still pass.
 */
[0, 1].forEach((enabled) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `safety/${enabled ? 'on' : 'bypassed'}/${signal.name}`,
      processor: ProcessorId.OutputSafety,
      sampleRate: 48000,
      params: [enabled, 10 ** (-0.1 / 20), 10 ** (-0.1 / 20), 1, 0, 0],
      // Raw, and the only fixture that is. This stage IS the repair — every
      // other processor is handed input the engine has already cleaned, but
      // feeding this one clean input would skip the branch that clears the DC
      // history, which is the only thing stopping one NaN from making every
      // later sample NaN.
      input: signal.channels,
      expected: (() => {
        const targets = signal.channels.map((channel) =>
          Float32Array.from(channel),
        );
        processOutputSafety(
          createOutputSafety(targets.length, 48000),
          targets,
          {
            limiterEnabled: enabled === 1,
            ceiling: 10 ** (-0.1 / 20),
            activationThreshold: 10 ** (-0.1 / 20),
            releaseCoefficient: 1,
            kneeDb: 0,
            releaseHoldSamples: 0,
          },
        );
        return targets;
      })(),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

/**
 * Auto Headroom, with the following gain both positive and negative.
 *
 * The sign matters and is easy to drop: positive Master gain needs room
 * reserved ahead of it, negative gain already creates real room and must be
 * credited. A port that took the magnitude would attenuate twice for the same
 * decibel and nobody would hear anything except that it was quiet.
 */
[0, 1].forEach((enabled) => {
  [-6, 0, 4].forEach((followingGainDb) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `headroom/${enabled ? 'on' : 'off'}/${followingGainDb}/${signal.name}`,
        processor: ProcessorId.AutoHeadroom,
        sampleRate: 48000,
        params: [enabled, -1, followingGainDb, 1200, 4],
        input: processorInput(signal.channels),
        expected: (() => {
          const targets = processorInput(signal.channels).map((channel) =>
            Float32Array.from(channel),
          );
          processPostFilterNormalizer(
            createPostFilterNormalizer(targets.length, 48000, 4),
            targets,
            {
              enabled: enabled === 1,
              outputCeilingDb: -1,
              followingGainDb,
              releaseMs: 1200,
              sampleRate: 48000,
            },
          );
          return targets;
        })(),
        maxAbsTolerance: 1e-6,
        rmsTolerance: 1e-7,
      });
    });
  });
});

// The Exciter's two building blocks. The discriminator's amount is written out
// as a signal, the same way the true-peak magnitudes are, so the ordinary
// comparison applies to a control voltage.
parityCorpus(FRAMES, 48000).forEach((signal) => {
  fixtures.push({
    name: `transient/48000/${signal.name}`,
    processor: ProcessorId.ExciterTransient,
    sampleRate: 48000,
    params: [],
    input: processorInput(signal.channels),
    expected: processorInput(signal.channels).map((channel) => {
      const state = createExciterTransientState();
      return Float32Array.from(channel, (value) =>
        exciterTransientSample(state, value, 48000),
      );
    }),
    maxAbsTolerance: 1e-6,
    rmsTolerance: 1e-7,
  });
});

// Character spans the full travel: bias moves from warm to air across it, and
// the two ends produce quite different harmonic balances.
[
  { drive: 1.0, character: 0.0, harmonic: 1.0 },
  { drive: 2.5, character: 0.35, harmonic: 0.5 },
  { drive: 4.0, character: 0.7, harmonic: 1.0 },
].forEach((setting) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `diode/${setting.drive}/${setting.character}/${signal.name}`,
      processor: ProcessorId.AnalogDiode,
      sampleRate: 48000,
      params: [setting.drive, setting.character, 0.8, setting.harmonic],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) =>
        Float32Array.from(channel, (value) =>
          analogDiodeExcitedSample(
            value,
            setting.drive,
            setting.character,
            0.8,
            setting.harmonic,
          ),
        ),
      ),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

/**
 * Timing, including fully off.
 *
 * Off is not simply an early return: the delays are still glided toward zero,
 * so a block at amount 0 arriving while they are non-zero must keep processing
 * or the signal steps. A port that returned early on the amount alone would
 * pass every other fixture here and click on the way down.
 */
[0, 0.35, 1].forEach((amount) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `align/${amount}/48000/${signal.name}`,
      processor: ProcessorId.PhaseAlign,
      sampleRate: 48000,
      params: [amount],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const target = Float32Array.from(channel);
        alignChannel(
          createPhaseAlign(target.length, 48000),
          target,
          amount,
          48000,
        );
        return target;
      }),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

// The sibilance guard on the return path, at three blend amounts.
[0, 0.5, 1].forEach((amount) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `guard/${amount}/48000/${signal.name}`,
      processor: ProcessorId.ExciterGuard,
      sampleRate: 48000,
      params: [amount],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const target = Float32Array.from(channel);
        guardExciterReturn(createExciterGuard(), target, 48000, amount);
        return target;
      }),
      maxAbsTolerance: 1e-6,
      rmsTolerance: 1e-7,
    });
  });
});

// Organic across its travel. Its parameters are smoothed at the OVERSAMPLED
// rate, so a port that smoothed at the session rate glides four times too fast
// and the corpus catches it as a level difference through the whole block.
[0, 0.5, 1].forEach((amount) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `organic/${amount}/48000/${signal.name}`,
      processor: ProcessorId.Organic,
      sampleRate: 48000,
      params: [amount],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const target = Float32Array.from(channel);
        organicBlock(createOrganicState(target.length), target, amount, 48000);
        return target;
      }),
      maxAbsTolerance: 1e-4,
      rmsTolerance: 1e-5,
    });
  });
});

/**
 * The whole Organic path, at focuses inside and outside the guarded region.
 *
 * 800 Hz gets no sibilance protection at all, 7 kHz gets the full amount, and
 * 10 kHz sits on the upper ramp. A corpus with one focus would exercise one
 * branch of `organicSibilanceProtection` and leave the other two unverified.
 */
[800, 7000, 10000].forEach((focusHz) => {
  [0.3, 1].forEach((amount) => {
    parityCorpus(FRAMES, 48000).forEach((signal) => {
      fixtures.push({
        name: `organicpath/${focusHz}/${amount}/${signal.name}`,
        processor: ProcessorId.OrganicPath,
        sampleRate: 48000,
        params: [focusHz, 0.5, amount],
        input: processorInput(signal.channels),
        expected: processorInput(signal.channels).map((channel) => {
          const path = createOrganicPath(channel.length);
          return Float32Array.from(
            runOrganicPath(
              path,
              channel,
              {
                enabled: true,
                amount,
                focusHz,
                range: 0.5,
              },
              amount,
              48000,
            ),
          );
        }),
        maxAbsTolerance: 1e-4,
        rmsTolerance: 1e-5,
      });
    });
  });
});

/**
 * The whole three-band Exciter.
 *
 * The overdriven case exists to exercise the return normaliser: three bands
 * each asking for a large mix sum past unity, and the stage has to scale them
 * together while preserving their relative balance. A corpus of modest mixes
 * would never reach that branch, and a port that dropped it would sound louder
 * rather than wrong.
 *
 * Isolate is covered because it is a different signal path, not a mute: the
 * dry mix glides to zero and what remains is the excited return alone.
 */
const EXCITER_BANDS = [
  { enabled: 1, freqHz: 90, range: 0.4, drive: 2.0, mix: 0.35, texture: 0.3 },
  { enabled: 1, freqHz: 1200, range: 0.5, drive: 2.4, mix: 0.4, texture: 0.4 },
  { enabled: 1, freqHz: 8000, range: 0.45, drive: 2.6, mix: 0.5, texture: 0.5 },
];
const EXCITER_HOT = EXCITER_BANDS.map((band) => ({ ...band, mix: 0.95 }));

[
  { label: 'normal', isolate: 0, bands: EXCITER_BANDS },
  { label: 'isolate', isolate: 1, bands: EXCITER_BANDS },
  { label: 'overdriven', isolate: 0, bands: EXCITER_HOT },
].forEach((setting) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `exciter/${setting.label}/48000/${signal.name}`,
      processor: ProcessorId.Exciter,
      sampleRate: 48000,
      params: [
        1,
        setting.isolate,
        ...setting.bands.flatMap((band) => [
          band.enabled,
          band.freqHz,
          band.range,
          band.drive,
          band.mix,
          band.texture,
        ]),
      ],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const target = Float32Array.from(channel);
        runExciterChannel(
          createExciterChannel(target.length),
          target,
          {
            enabled: true,
            isolate: setting.isolate === 1,
            presetId: '',
            stereo: 'stereo',
            bands: setting.bands.map((band) => ({
              enabled: band.enabled === 1,
              freqHz: band.freqHz,
              range: band.range,
              drive: band.drive,
              mix: band.mix,
              texture: band.texture,
            })),
            organic: {
              enabled: false,
              amount: 0,
              focusHz: 1000,
              range: 0.5,
            },
            align: { enabled: false, amount: 0 },
          },
          48000,
        );
        return target;
      }),
      maxAbsTolerance: 1e-4,
      rmsTolerance: 1e-5,
    });
  });
});

/**
 * Partitioned convolution, at kernel lengths on either side of a partition.
 *
 * 512 is exactly one partition, 1500 is not a multiple of one, and 4096 is
 * eight. The non-multiple is the case that matters: the last partition is
 * short and zero-padded, and a port that assumed whole partitions would be
 * wrong only in the tail — where nobody listens.
 *
 * The kernel travels as a seed rather than as data, and both sides rebuild it
 * with the same integer recurrence. A 16k impulse response would be 64 kB per
 * fixture, and the point is to compare the convolution rather than to ship a
 * table twice.
 */
const convolverKernel = (length: number, seed: number): Float32Array => {
  let state = seed >>> 0;
  return Float32Array.from({ length }, (_unused, at) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const unit = (state >>> 8) / 16777216;
    return (unit * 2 - 1) * Math.exp((-3 * at) / length);
  });
};

[512, 1500, 4096].forEach((length) => {
  parityCorpus(FRAMES, 48000).forEach((signal) => {
    fixtures.push({
      name: `convolver/${length}/48000/${signal.name}`,
      processor: ProcessorId.Convolver,
      sampleRate: 48000,
      params: [length, 0x1a2b3c4d],
      input: processorInput(signal.channels),
      expected: processorInput(signal.channels).map((channel) => {
        const prepared = prepareKernel(convolverKernel(length, 0x1a2b3c4d));
        const target = Float32Array.from(channel);
        convolve(createConvolver(prepared), target);
        return target;
      }),
      // Two 1024-point transforms per partition, accumulated across every
      // partition: more rounding than any filter here, and still far below
      // anything audible.
      maxAbsTolerance: 1e-4,
      rmsTolerance: 1e-5,
    });
  });
});

/**
 * The linear-phase kernel itself, compared sample for sample.
 *
 * Not a render: the input block is unused and the expectation IS the 16384-tap
 * kernel. Every other fixture here would still pass if the kernel were a few dB
 * shallow or rotated to the wrong half, because a wrong kernel still sounds
 * like an equaliser — this is the only case that can tell.
 *
 * The Q-8 band at 50 Hz is deliberately present: it rings for about 51 ms and
 * is the band that made 8192 taps return +6.12 dB where +9 was asked for, so it
 * is where truncation shows up first. Both topologies are covered because
 * parallel was once silently built as serial here, and both character models
 * because they reshape Q before the impulse is ever run.
 */
const LINEAR_PHASE_RACKS: {
  label: string;
  model: TEqModel;
  modelAmount: number;
  subsonicHz: number;
  bands: IRackBand[];
}[] = [
  {
    label: 'three-band',
    model: 'clean',
    modelAmount: 1,
    subsonicHz: 0,
    bands: RACKS[0].bands,
  },
  {
    label: 'ten-band-subsonic',
    model: 'clean',
    modelAmount: 1,
    subsonicHz: 30,
    bands: RACKS[1].bands,
  },
  {
    // A dynamic band beside a static one: the dynamic band must be left OUT of
    // the kernel and the static one kept, and a port that filtered on the
    // wrong side of that predicate would produce a plausible kernel with one
    // band too many.
    label: 'dynamic-excluded',
    model: 'clean',
    modelAmount: 1,
    subsonicHz: 0,
    bands: RACKS[2].bands,
  },
  {
    label: 'narrow-low-proportional',
    model: 'proportional',
    modelAmount: 0.75,
    subsonicHz: 20,
    bands: [
      { type: FilterTypeEnum.PK, frequency: 50, gainDb: 9, quality: 8 },
      { type: FilterTypeEnum.HSC, frequency: 8000, gainDb: -4, quality: 0.707 },
    ],
  },
  {
    label: 'wide',
    model: 'wide',
    modelAmount: 1,
    subsonicHz: 0,
    bands: [
      { type: FilterTypeEnum.LSC, frequency: 120, gainDb: 6, quality: 0.9 },
      { type: FilterTypeEnum.PK, frequency: 2500, gainDb: -5, quality: 2 },
    ],
  },
];

LINEAR_PHASE_RACKS.forEach((rack) => {
  ENGINES.forEach((engine) => {
    const eq: IEqSettings = {
      ...DSP_DEFAULTS.eq,
      engine,
      model: rack.model,
      modelAmount: rack.modelAmount,
      subsonicHz: rack.subsonicHz,
      phase: 'linear',
      bands: rack.bands.map((band) => ({
        enabled: true,
        dynamic: band.dynamic === true,
        thresholdDb: band.thresholdDb ?? -24,
        type: band.type,
        frequency: band.frequency,
        gainDb: band.gainDb,
        quality: band.quality,
      })) as IEqSettings['bands'],
    };
    [44100, 48000].forEach((sampleRate) => {
      fixtures.push({
        name: `linear-phase/${rack.label}/${engine}/${sampleRate}`,
        processor: ProcessorId.LinearPhase,
        sampleRate,
        params: [
          ENGINES.indexOf(engine),
          EQ_MODELS.indexOf(rack.model),
          rack.modelAmount,
          rack.subsonicHz,
          rack.bands.length,
          ...rack.bands.flatMap((band) => [
            FILTER_TYPE_ORDER.indexOf(band.type),
            band.frequency,
            band.gainDb,
            band.quality,
            band.dynamic === true ? 1 : 0,
            band.thresholdDb ?? -24,
          ]),
        ],
        // Unused by the runner, and zero rather than noise so that a port which
        // accidentally read it would produce silence instead of something that
        // happened to correlate.
        input: [new Float32Array(KERNEL_SIZE)],
        expected: [buildLinearPhaseKernel(eq, sampleRate)],
        // Two 16384-point transforms, and a tap's magnitude out at the skirts
        // is around 1e-5. Tighter than the convolver's because nothing is
        // accumulated across blocks here.
        maxAbsTolerance: 2e-6,
        rmsTolerance: 2e-8,
      });
    });
  });
});

/**
 * Whole-track loudness and true peak, compared as two numbers.
 *
 * These need seconds rather than milliseconds: a 400 ms block with a 100 ms hop
 * means anything shorter produces no blocks at all and both sides agree on
 * -120 for the wrong reason. 121500 frames is 2.53 s — several blocks, and a
 * final partial one, which is where an off-by-one in the hop boundary shows.
 *
 * The expectation is the measurement itself, in the first two samples of
 * channel zero, because there is no output signal to compare: the analyser
 * consumes audio and produces two dB values.
 *
 * `invalid-samples` is deliberately absent. It is the one corpus signal that
 * carries NaN, nothing repairs it on this path — the analyser measures decoded
 * audio, which never contains one — and both sides would agree on NaN, which
 * the comparator correctly refuses to call a pass.
 */
const LOUDNESS_FRAMES = 121_500;
const LOUDNESS_SIGNALS = [
  'silence',
  'sweep',
  'white-noise',
  'pink-noise',
  'dc-offset',
  'intersample-peak',
  'transient-then-silence',
];

[48000, 44100].forEach((sampleRate) => {
  const chosen = parityCorpus(LOUDNESS_FRAMES, sampleRate).filter((signal) =>
    LOUDNESS_SIGNALS.includes(signal.name),
  );
  // A name that no longer matches would silently drop a case, and this file's
  // own count line would report the smaller number as if it were the intent.
  // Two of these were misspelled on the first attempt and the suite went green.
  if (chosen.length !== LOUDNESS_SIGNALS.length) {
    throw new Error(
      `loudness corpus: asked for ${LOUDNESS_SIGNALS.length} signals, matched ${chosen.length}`,
    );
  }
  chosen.forEach((signal) => {
    const analyzer = createLoudnessAnalyzer(sampleRate, signal.channels.length);
    analyzer.feed(signal.channels, 0, LOUDNESS_FRAMES);
    const measured = analyzer.finish();
    const expected = signal.channels.map(
      () => new Float32Array(LOUDNESS_FRAMES),
    );
    expected[0][0] = measured.integratedLufs;
    expected[0][1] = measured.truePeakDbtp;
    fixtures.push({
      name: `loudness/${sampleRate}/${signal.name}`,
      processor: ProcessorId.Loudness,
      sampleRate,
      params: [],
      input: signal.channels,
      expected,
      // A tenth of a thousandth of a LU. The only real source of divergence
      // is the last ULP of a log10, multiplied by ten or twenty.
      maxAbsTolerance: 1e-4,
      rmsTolerance: 1e-6,
    });
  });
});

/**
 * The crossfade curve, compared point by point.
 *
 * Only the curve: the TypeScript side has no sample-accurate mixer to compare
 * a mix against, because it schedules the shape onto two `GainNode`s and lets
 * the browser interpolate. That is the thing being replaced, so the fixture
 * holds the one piece both implementations must agree on — what gain each deck
 * has at a given point — and the native mixer's own behaviour is covered by
 * `engine_test.cpp` instead.
 *
 * The ramp deliberately runs past both ends. A progress below zero or above
 * one arrives whenever a fade is restarted or a block overruns the end, and
 * both sides must clamp rather than continue the curve into a negative gain.
 */
const CROSSFADE_POINTS = 1_024;
CROSSFADE_CURVES.forEach((curve) => {
  [0, 1].forEach((incoming) => {
    const progress = new Float32Array(CROSSFADE_POINTS);
    const gains = new Float32Array(CROSSFADE_POINTS);
    for (let at = 0; at < CROSSFADE_POINTS; at += 1) {
      progress[at] = -0.25 + (1.5 * at) / (CROSSFADE_POINTS - 1);
      // Read back rather than reused: the fixture carries the progress as a
      // float and the native side sees only that, so computing the gain from
      // the unrounded double would put the two sides one ULP apart by
      // construction and call it a porting error.
      gains[at] = crossfadeGain(curve, progress[at], incoming === 1);
    }
    fixtures.push({
      name: `crossfade/${curve}/${incoming === 1 ? 'incoming' : 'outgoing'}`,
      processor: ProcessorId.Crossfade,
      sampleRate: 48000,
      params: [CROSSFADE_CURVES.indexOf(curve), incoming],
      input: [progress],
      expected: [gains],
      // A gain, not a sample: the only rounding is one sin, one cos and the
      // division that normalises them.
      maxAbsTolerance: 1e-7,
      rmsTolerance: 1e-8,
    });
  });
});

/**
 * The wire encoder the app itself uses, not a copy of it.
 *
 * These fixtures hold the native chain to the TypeScript worklet, and the
 * layout they push through `feq_chain_settings_decode` is the same one the
 * renderer sends at runtime â so a field added to the encoder and forgotten in
 * the C++ fails here rather than in somebody's headphones.
 */
const chainParams = (settings: IDspSettings): number[] =>
  encodeChainSettings(settings);

/**
 * The whole chain, held to the worklet that is being replaced.
 *
 * Every stage below already has its own fixtures. What those cannot see is the
 * orchestration: a stage in the wrong order, a mid/side encode wrapping the
 * wrong span, a smoothing ramp that starts a block late, an isolate reference
 * taken before a gain instead of after. So the reference here is the real
 * `dspProcessor.worklet` running under `workletHarness.ts`, fed in 128-frame
 * render quanta exactly as a browser would.
 *
 * Linear phase is deliberately absent from these presets. Its kernel arrives
 * on a separate message and its 8192-sample latency would dominate every
 * comparison; `linear-phase/*` already holds the kernel itself to the
 * reference, and the convolution to `convolver/*`.
 */
const CHAIN_FRAMES = 12_288;
const CHAIN_PRESETS: { label: string; settings: IDspSettings }[] = [
  {
    // Everything off but the master switch: proves the chain is a wire before
    // it is asked to be anything else. A port that leaked one stage's default
    // into the signal fails here and nowhere else.
    label: 'bypass',
    settings: DSP_DEFAULTS,
  },
  {
    label: 'eq-stereo',
    settings: {
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        subsonicHz: 30,
        bands: RACKS[0].bands.map((band) => ({
          enabled: true,
          dynamic: false,
          thresholdDb: -24,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        })) as IEqSettings['bands'],
      },
    },
  },
  {
    // Mid/side plus the mono-below high pass, which is the one configuration
    // where the encode wraps a different span from the filtering.
    label: 'eq-mid-side',
    settings: {
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        stereo: 'mid',
        monoBelowHz: 120,
        model: 'proportional',
        modelAmount: 0.6,
        bands: RACKS[1].bands.map((band) => ({
          enabled: true,
          dynamic: false,
          thresholdDb: -24,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        })) as IEqSettings['bands'],
      },
    },
  },
  {
    // Oversampled, parallel, with fuzz: three things that each add their own
    // scratch buffers and their own latency-matched dry reference.
    label: 'eq-oversampled-fuzz',
    settings: {
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        engine: 'parallel',
        oversample: 2,
        fuzzAmount: 0.4,
        bands: RACKS[0].bands.map((band) => ({
          enabled: true,
          dynamic: false,
          thresholdDb: -24,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        })) as IEqSettings['bands'],
      },
    },
  },
  {
    // Dynamic bands, where an envelope can diverge and never come back.
    label: 'eq-dynamic',
    settings: {
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        bands: RACKS[2].bands.map((band) => ({
          enabled: true,
          dynamic: band.dynamic === true,
          thresholdDb: band.thresholdDb ?? -24,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        })) as IEqSettings['bands'],
      },
    },
  },
  {
    label: 'compressor-maximizer',
    settings: {
      ...DSP_DEFAULTS,
      compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
      maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true, ceilingDb: -3 },
    },
  },
  {
    // Master gain and Auto Headroom, which is the pair that reserves room for
    // a gain that has not been applied yet.
    label: 'master-headroom',
    settings: {
      ...DSP_DEFAULTS,
      master: {
        ...DSP_DEFAULTS.master,
        enabled: true,
        outputTrimDb: -3,
        loudnessMaximize: true,
      },
    },
  },
  {
    label: 'exciter',
    settings: {
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
    },
  },
  {
    // Everything at once, which is the only case that can catch two stages
    // interacting through a buffer neither of them owns.
    label: 'everything',
    settings: {
      ...DSP_DEFAULTS,
      eq: {
        ...DSP_DEFAULTS.eq,
        enabled: true,
        subsonicHz: 25,
        fuzzAmount: 0.2,
        bands: RACKS[0].bands.map((band) => ({
          enabled: true,
          dynamic: false,
          thresholdDb: -24,
          type: band.type,
          frequency: band.frequency,
          gainDb: band.gainDb,
          quality: band.quality,
        })) as IEqSettings['bands'],
      },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
      compressor: { ...DSP_DEFAULTS.compressor, enabled: true },
      maximizer: { ...DSP_DEFAULTS.maximizer, enabled: true },
      master: { ...DSP_DEFAULTS.master, enabled: true, outputTrimDb: -2 },
    },
  },
];

const CHAIN_SIGNALS = ['sweep', 'white-noise', 'transient-then-silence'];

CHAIN_PRESETS.forEach((preset) => {
  const chosen = parityCorpus(CHAIN_FRAMES, 48000).filter((signal) =>
    CHAIN_SIGNALS.includes(signal.name),
  );
  if (chosen.length !== CHAIN_SIGNALS.length) {
    throw new Error(
      `chain corpus: asked for ${CHAIN_SIGNALS.length} signals, matched ${chosen.length}`,
    );
  }
  chosen.forEach((signal) => {
    const harness = createWorkletHarness(48000, preset.settings);
    const rendered = harness.render(signal.channels);
    /**
     * The positive control this corpus needs.
     *
     * A chain that did nothing would produce its input, and a native chain
     * that also did nothing would match it perfectly â a whole suite of
     * green for an engine that is a wire. Every preset except `bypass` has to
     * change the audio measurably before its fixture is worth writing.
     */
    if (preset.label !== 'bypass') {
      let moved = 0;
      rendered.forEach((channel, index) => {
        channel.forEach((value, at) => {
          moved = Math.max(moved, Math.abs(value - signal.channels[index][at]));
        });
      });
      if (moved <= 1e-3) {
        throw new Error(
          `chain/${preset.label}/${signal.name}: the chain changed nothing (max ${moved})`,
        );
      }
    }
    fixtures.push({
      name: `chain/${preset.label}/${signal.name}`,
      processor: ProcessorId.Chain,
      sampleRate: 48000,
      params: chainParams(preset.settings),
      input: signal.channels,
      expected: rendered,
      // Wider than a single stage's, and deliberately so: this is nine stages
      // deep and the tolerances compound. A wrong stage order is off by
      // decibels, not by 1e-5, so nothing this is here to catch hides under it.
      maxAbsTolerance: 2e-4,
      rmsTolerance: 2e-5,
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
  .map(
    ([label, value]) =>
      `${label.toLowerCase()} ${byProcessor.get(value as number) ?? 0}`,
  )
  .join(', ');
console.log(
  `parity fixtures: ${fixtures.length} written to ${OUTPUT} (${breakdown})`,
);
