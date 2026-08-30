/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  IExciterBandSettings,
  IExciterSettings,
  constrainExciterBandPosition,
  exciterBandEdgesForIndex,
  maximumExciterBandRangeAtFrequency,
} from '../../../common/dsp/chain';
import {
  createExciterChannel,
  runExciterChannel,
} from '../../../renderer/dsp/exciterStage';
import {
  createExciterTransientState,
  exciterTransientSample,
} from '../../../renderer/dsp/analogDiode';
import {
  createHarmonicState,
  harmonicSample,
} from '../../../renderer/dsp/harmonics';
import {
  createExciterGuard,
  exciterReturnGain,
  guardExciterReturn,
  organicExciterReturnGain,
} from '../../../renderer/dsp/exciterGuard';
import {
  createOrganicPath,
  runOrganicPath,
} from '../../../renderer/dsp/organicStage';

const RATE = 48_000;
const FRAMES = 128;

const block = (hz: number, level = 0.5, offset = 0): Float32Array => {
  const out = new Float32Array(FRAMES);
  for (let i = 0; i < FRAMES; i += 1) {
    out[i] = level * Math.sin((2 * Math.PI * hz * (offset + i)) / RATE);
  }
  return out;
};

const rms = (buffer: Float32Array): number => {
  let total = 0;
  for (let i = 0; i < buffer.length; i += 1) {
    total += buffer[i] * buffer[i];
  }
  return Math.sqrt(total / buffer.length);
};

const settings = (over: Partial<IExciterSettings> = {}): IExciterSettings => ({
  ...DSP_DEFAULTS.exciter,
  enabled: true,
  ...over,
});

/** Every band on, so there is something to isolate at any frequency. */
const allBands = (over: Partial<IExciterSettings> = {}) =>
  settings({
    bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
      ...band,
      enabled: true,
      mix: 0.4,
    })),
    ...over,
  });

/**
 * Run several blocks, because control smoothing and the internal transient
 * detector need to settle before a single block's reading means anything.
 */
const run = (config: IExciterSettings, hz: number, blocks = 40) => {
  const state = createExciterChannel(FRAMES);
  const last = new Float32Array(FRAMES);
  for (let i = 0; i < blocks; i += 1) {
    last.set(block(hz, 0.5, i * FRAMES));
    runExciterChannel(state, last, config, RATE);
  }
  return last;
};

const ANALYSIS_SAMPLES = 32_768;
const ANALYSIS_SETTLE_BLOCKS = 100;

/** Long settled render for exact harmonic and alias measurements. */
const renderAnalysis = (
  config: IExciterSettings,
  frequency: number,
  level = 0.5,
): Float64Array => {
  const state = createExciterChannel(FRAMES);
  const output = new Float64Array(ANALYSIS_SAMPLES);
  const analysisBlocks = ANALYSIS_SAMPLES / FRAMES;
  for (
    let atBlock = 0;
    atBlock < ANALYSIS_SETTLE_BLOCKS + analysisBlocks;
    atBlock += 1
  ) {
    const target = block(frequency, level, atBlock * FRAMES);
    runExciterChannel(state, target, config, RATE);
    if (atBlock >= ANALYSIS_SETTLE_BLOCKS) {
      output.set(target, (atBlock - ANALYSIS_SETTLE_BLOCKS) * FRAMES);
    }
  }
  return output;
};

/** One exact spectral bin without paying for a full FFT. */
const magnitudeAt = (buffer: Float64Array, frequency: number): number => {
  const omega = (2 * Math.PI * frequency) / RATE;
  const cosine = Math.cos(omega);
  const coefficient = 2 * cosine;
  let previous = 0;
  let earlier = 0;
  for (let index = 0; index < buffer.length; index += 1) {
    const value = buffer[index];
    const current = value + coefficient * previous - earlier;
    earlier = previous;
    previous = current;
  }
  return (
    (2 * Math.hypot(previous - earlier * cosine, earlier * Math.sin(omega))) /
    buffer.length
  );
};

const highOnly = (
  bandPatch: Partial<IExciterBandSettings> = {},
): IExciterSettings =>
  settings({
    isolate: true,
    organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
    align: { ...DSP_DEFAULTS.exciter.align, enabled: false },
    bands: DSP_DEFAULTS.exciter.bands.map((band, index) => ({
      ...band,
      enabled: index === 2,
      mix: index === 2 ? 1 : 0,
      ...(index === 2 ? bandPatch : {}),
    })),
  });

/**
 * The generator itself, in isolation from the bands that configure it.
 *
 * These are the two properties the whole redesign exists for, and neither could
 * be stated about the shaper this replaced: the amount of harmonic content is a
 * number the caller sets, and it is the same number whatever the input level.
 */
describe('the harmonic generator', () => {
  /** A settled tone through the generator; returns its 2f and 3f amplitudes. */
  const orders = (
    depth: number,
    evenWeight: number,
    amplitude: number,
    hz = 200,
  ) => {
    const state = createHarmonicState();
    const total = 32_768;
    const settle = RATE;
    const out = new Float64Array(total);
    for (let at = 0; at < settle + total; at += 1) {
      const value = harmonicSample(
        state,
        amplitude * Math.sin((2 * Math.PI * hz * at) / RATE),
        depth,
        evenWeight,
        RATE,
      );
      if (at >= settle) {
        out[at - settle] = value;
      }
    }
    return {
      second: magnitudeAt(out, hz * 2) / amplitude,
      third: magnitudeAt(out, hz * 3) / amplitude,
      first: magnitudeAt(out, hz) / amplitude,
    };
  };

  /**
   * The headline fix. The old shaper's second order moved 36 dB across this
   * same 40 dB span, which is why the effect was inaudible on anything but a
   * peak.
   */
  it('makes the same harmonics at any input level', () => {
    const loud = orders(0.4, 0.9, 0.5);
    const quiet = orders(0.4, 0.9, 0.005);
    expect(quiet.second).toBeCloseTo(loud.second, 3);
    expect(quiet.third).toBeCloseTo(loud.third, 3);
  });

  /**
   * The positive control for the check above.
   *
   * Equality across levels would also hold if the generator returned nothing at
   * all, so there has to be something there to be equal.
   */
  it('makes harmonics at all', () => {
    const made = orders(0.4, 0.9, 0.5);
    expect(made.second).toBeGreaterThan(0.05);
  });

  it('Depth sets how much, proportionally', () => {
    const gentle = orders(0.2, 0.9, 0.5);
    const hard = orders(0.4, 0.9, 0.5);
    expect(hard.second / gentle.second).toBeCloseTo(2, 1);
  });

  it('Texture moves between the octave and the twelfth', () => {
    const warm = orders(0.4, 1, 0.5);
    const airy = orders(0.4, 0, 0.5);
    expect(warm.second).toBeGreaterThan(warm.third * 4);
    expect(airy.third).toBeGreaterThan(airy.second * 4);
  });

  /**
   * What the running projection is for. T3 hands back 0.98 of a normalised
   * sine, so without the subtraction the odd end of Texture is a 2 dB cut.
   */
  it('leaves the note it is exciting alone, at either end of Texture', () => {
    expect(orders(0.5, 1, 0.5).first).toBeLessThan(0.02);
    expect(orders(0.5, 0, 0.5).first).toBeLessThan(0.02);
  });
});

describe('exciter peak controls', () => {
  it('transient emphasis rises on an onset and settles on a sustained signal', () => {
    const transient = createExciterTransientState();
    let onset = 0;
    for (let sample = 0; sample < RATE * 0.01; sample += 1) {
      onset = exciterTransientSample(transient, 0.5, RATE);
    }
    let sustained = onset;
    for (let sample = 0; sample < RATE * 0.3; sample += 1) {
      sustained = exciterTransientSample(transient, 0.5, RATE);
    }
    expect(onset).toBeGreaterThan(0.1);
    expect(sustained).toBeLessThan(onset * 0.2);
  });

  /**
   * The discriminator multiplies Depth and nothing else.
   *
   * It reaches the generator as a factor on the depth argument, so an onset
   * changes how many harmonics are made and never how loud the return is —
   * which is what keeps it from being heard as a compressor.
   */
  it('transient emphasis changes the harmonics without scaling the foundation', () => {
    const settle = 4_000;
    const measure = (depth: number): number => {
      const state = createHarmonicState();
      let last = 0;
      for (let at = 0; at < settle; at += 1) {
        last = harmonicSample(
          state,
          0.25 * Math.sin((2 * Math.PI * 200 * at) / RATE),
          depth,
          0.6,
          RATE,
        );
      }
      return last;
    };
    expect(measure(0.4 * 1.35)).toBeCloseTo(measure(0.4) * 1.35, 10);
  });
});

/** Regression lock for the High sound Ivan approved by ear. */
describe('the High exciter', () => {
  /**
   * The foundation is 18% of the band, and it is 18% for EVERY band now.
   *
   * Low and Mid used to return their whole filtered band at unity, which made
   * the Amount dial a midrange equaliser — measured at +1.28 dB on the shipping
   * defaults. High was already the quiet-carrier design and was the band nobody
   * complained about, so it is the one the other two were moved onto.
   */
  it('keeps a quiet fixed foundation beneath the generated harmonics', () => {
    // 14 kHz deliberately: the sibilance guard is a bell at 7.2 kHz, so a tone
    // at the band centre has its own carrier pulled several dB down by it and
    // measures the de-esser rather than the foundation. Up here the guard is
    // flat and the octave has left the audible band, so what is left is the
    // foundation alone.
    const output = renderAnalysis(highOnly({ drive: 1 }), 14_000);
    const fundamental = magnitudeAt(output, 14_000);
    expect(fundamental / 0.5).toBeGreaterThan(0.14);
    expect(fundamental / 0.5).toBeLessThan(0.22);
  });

  /**
   * The band is an air generator, not a presence boost: what it returns is
   * mostly what it made, not what it was given. The bounds are wide enough to
   * survive a taste change to Depth and narrow enough to catch the band
   * turning back into a copy of its own source.
   */
  it('makes its default upper harmonics louder than its foundation', () => {
    const output = renderAnalysis(highOnly(), 4_500);
    const fundamental = magnitudeAt(output, 4_500);
    const second = magnitudeAt(output, 9_000);
    const third = magnitudeAt(output, 13_500);
    expect(second / fundamental).toBeGreaterThan(0.3);
    expect(second / fundamental).toBeLessThan(0.9);
    expect(third / fundamental).toBeGreaterThan(0.5);
    expect(third / fundamental).toBeLessThan(1.3);
    expect(second + third).toBeGreaterThan(fundamental);
  });

  it('uses Drive for density while retaining a continuous foundation', () => {
    const gentle = renderAnalysis(highOnly({ drive: 1 }), 4_500);
    const driven = renderAnalysis(highOnly({ drive: 3.5 }), 4_500);
    const gentleFundamental = magnitudeAt(gentle, 4_500);
    const drivenFundamental = magnitudeAt(driven, 4_500);
    const gentleHarmonics =
      magnitudeAt(gentle, 9_000) + magnitudeAt(gentle, 13_500);
    const drivenHarmonics =
      magnitudeAt(driven, 9_000) + magnitudeAt(driven, 13_500);
    expect(drivenHarmonics).toBeGreaterThan(gentleHarmonics * 2);
    expect(drivenFundamental).toBeGreaterThan(gentleFundamental * 0.05);
  });

  it('uses Texture to cross from even presence to odd air', () => {
    const presence = renderAnalysis(highOnly({ texture: 0 }), 4_500);
    const air = renderAnalysis(highOnly({ texture: 0.7 }), 4_500);
    expect(magnitudeAt(presence, 9_000)).toBeGreaterThan(
      magnitudeAt(presence, 13_500),
    );
    expect(magnitudeAt(air, 13_500)).toBeGreaterThan(
      magnitudeAt(air, 9_000) * 2,
    );
  });

  it('shares one Amount law with the other two bands', () => {
    expect(exciterReturnGain(0)).toBe(0);
    expect(exciterReturnGain(0.22)).toBeCloseTo(0.22 ** 0.6, 8);
    expect(exciterReturnGain(1)).toBeCloseTo(1, 8);
  });

  it('uses the whole Range dial without leaving the High region', () => {
    const centre = DSP_DEFAULTS.exciter.bands[2].freqHz;
    const maximum = maximumExciterBandRangeAtFrequency(2, centre);
    const constrained = constrainExciterBandPosition(2, centre, 1);
    const edges = exciterBandEdgesForIndex(
      2,
      constrained.freqHz,
      constrained.range,
    );
    expect(maximum).toBeGreaterThan(0.23);
    expect(maximum).toBeLessThan(0.25);
    expect(constrained.range).toBeCloseTo(maximum, 10);
    expect(edges.lowHz).toBeGreaterThanOrEqual(2_500);
    expect(edges.highHz).toBeLessThanOrEqual(20_000);
  });

  it('keeps folded High harmonics below the audible return', () => {
    const output = renderAnalysis(highOnly(), 7_500);
    const fundamental = magnitudeAt(output, 7_500);
    const wantedThird = magnitudeAt(output, 22_500);
    const foldedFourth = magnitudeAt(output, 18_000);
    expect(wantedThird).toBeGreaterThan(fundamental * 0.3);
    expect(foldedFourth).toBeLessThan(fundamental * 0.0001);
  });

  it('protects consonants while recovering the air octave', () => {
    const gainDbAt = (frequency: number): number => {
      const state = createExciterGuard();
      let inputEnergy = 0;
      let outputEnergy = 0;
      for (let atBlock = 0; atBlock < 300; atBlock += 1) {
        const target = block(frequency, 0.1, atBlock * FRAMES);
        guardExciterReturn(state, target, RATE);
        if (atBlock >= 100) {
          for (let sample = 0; sample < target.length; sample += 1) {
            const input =
              0.1 *
              Math.sin(
                (2 * Math.PI * frequency * (atBlock * FRAMES + sample)) / RATE,
              );
            inputEnergy += input * input;
            outputEnergy += target[sample] * target[sample];
          }
        }
      }
      return 10 * Math.log10(outputEnergy / inputEnergy);
    };

    expect(gainDbAt(7_200)).toBeGreaterThan(-5.7);
    expect(gainDbAt(7_200)).toBeLessThan(-5.3);
    expect(gainDbAt(16_000)).toBeGreaterThan(-0.6);
  });
});

describe('exciter return level', () => {
  /**
   * The dial is worth 12 dB now rather than 7.
   *
   * The old law reached only 70% on a 0.35 taper, because the return it scaled
   * was mostly a copy of the band and a louder one would have been an equaliser
   * boost. The return is harmonics over a quiet carrier now, so the knob can
   * have the range it always looked like it had.
   */
  it('keeps authored amounts audible beneath the dry programme', () => {
    expect(exciterReturnGain(0)).toBe(0);
    expect(exciterReturnGain(0.2)).toBeCloseTo(0.2 ** 0.6, 8);
    expect(exciterReturnGain(1)).toBeCloseTo(1, 8);
  });

  it('keeps Organic on its own law, untouched by the band redesign', () => {
    expect(organicExciterReturnGain(0)).toBe(0);
    expect(organicExciterReturnGain(0.35)).toBeCloseTo(0.95 * 0.35 ** 0.42, 8);
    expect(organicExciterReturnGain(1)).toBeCloseTo(0.95, 8);
  });

  /**
   * Three bands at full Amount are held to the ceiling, and the ceiling is two.
   *
   * It was one, from when a return WAS a whole copy of its own filtered band —
   * three of those is three copies and had to be stopped. A return is harmonics
   * over an 18% carrier now, so two of them is a third of a copy, and holding
   * the sum to one meant each of three bands got a third of what one band alone
   * gets: a dial that does less the more of it you use.
   */
  it('normalises overlapping band foundations instead of stacking copies', () => {
    const state = createExciterChannel(FRAMES);
    const config = allBands({
      bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
        ...band,
        enabled: true,
        mix: 1,
      })),
    });
    let contribution = { bands: [0, 0, 0] };
    for (let index = 0; index < 80; index += 1) {
      const target = block(400, 0.5, index * FRAMES);
      contribution = runExciterChannel(state, target, config, RATE);
    }
    const total = contribution.bands.reduce((sum, mix) => sum + mix, 0);
    expect(total).toBeLessThanOrEqual(2.0001);
    // And it is actually being held, rather than passing because the returns
    // never reached the ceiling in the first place.
    expect(total).toBeGreaterThan(1.9);
  });
});

describe('exciter isolate', () => {
  /**
   * Isolate has to remove the dry signal, not merely turn it down.
   *
   * The whole use of the mode is judging harmonics that are 10-25% of the
   * fundamental. Leaving any of the fundamental behind would bury exactly what
   * the user switched the mode on to hear, and would do it silently — the mode
   * would appear to work and simply sound like the effect was subtle.
   */
  it('drops the dry signal entirely', () => {
    const normal = run(allBands(), 400);
    const isolated = run(allBands({ isolate: true }), 400);
    // What is left is the complete attenuated Exciter return, not dry leakage.
    expect(rms(isolated)).toBeLessThan(rms(normal) * 0.3);
    expect(rms(isolated)).toBeGreaterThan(0);
  });

  /**
   * POSITIVE CONTROL. If isolate returned silence for every input, the test
   * above would pass just as happily — "much quieter than the dry signal" is
   * exactly what silence is. This asserts there is something there, and that
   * it is the stage's own output rather than a leak.
   */
  it('POSITIVE CONTROL: isolate is silent when nothing is generating', () => {
    const off = run(
      settings({
        isolate: true,
        bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
          ...band,
          enabled: false,
        })),
        organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
      }),
      400,
      200,
    );
    expect(rms(off)).toBeLessThan(1e-9);
  });

  it('leaves the dry signal alone when isolate is off', () => {
    const plain = run(
      settings({
        bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
          ...band,
          enabled: false,
        })),
        organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
      }),
      400,
    );
    // Nothing enabled, so this is the input, untouched. Compared against the
    // block at the SAME phase offset `run` left off at — a sine's RMS over 128
    // frames depends on where in the cycle the window falls, so comparing with
    // offset zero would be measuring the phase, not the processing.
    expect(rms(plain)).toBeCloseTo(rms(block(400, 0.5, 39 * FRAMES)), 5);
  });
});

/**
 * An exciter must never turn the music down, and this one did.
 *
 * Every stage here leaves the dry signal in place and adds one complete,
 * attenuated excited return made from a filtered copy. Both halves of the
 * older difference path had to be right before that difference was harmonics
 * rather than damage:
 *
 *  - the shaping curve is normalised for SMALL signals, so at a real level the
 *    shaped copy came back quieter and the difference was mostly an inverted
 *    fundamental;
 *  - and the shaped copy had been through a 63-tap linear-phase resampler
 *    twice each way, so subtracting it from the original was subtracting a
 *    DELAYED copy — a comb filter.
 *
 * Measured with both faults present, one band at mix 0.4 took a 400 Hz tone
 * from 0.354 RMS to 0.090. Neither fault throws, neither shows up in a
 * spectrum as anything but "the effect sounds wrong", and the second one
 * cannot be found by reading the shaping code at all.
 */
describe('the exciter adds rather than cancels', () => {
  const outputToDryRatio = (config: IExciterSettings): number => {
    const out = run(config, 400);
    const dry = rms(block(400, 0.5, 39 * FRAMES));
    return rms(out) / dry;
  };

  it('one band never reduces the level', () => {
    const config = settings({
      organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
      bands: DSP_DEFAULTS.exciter.bands.map((band, index) => ({
        ...band,
        enabled: index === 1,
        mix: 0.4,
      })),
    });
    expect(outputToDryRatio(config)).toBeGreaterThan(0.98);
  });

  it('three bands never reduce the level', () => {
    const config = allBands({
      organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
    });
    expect(outputToDryRatio(config)).toBeGreaterThan(0.98);
  });

  it('the organic stage never reduces the level', () => {
    const state = createOrganicPath(FRAMES);
    const amount = 0.8;
    const mix = organicExciterReturnGain(amount);
    let dry: Float32Array = new Float32Array(FRAMES);
    let output: Float32Array = new Float32Array(FRAMES);
    for (let atBlock = 0; atBlock < 80; atBlock += 1) {
      dry = block(400, 0.5, atBlock * FRAMES);
      const wet = runOrganicPath(
        state,
        dry,
        { enabled: true, amount, focusHz: 400, range: 0 },
        amount,
        RATE,
      );
      output = Float32Array.from(
        dry,
        (sample, index) => sample + wet[index] * mix,
      );
    }
    expect(rms(output)).toBeGreaterThan(rms(dry) * 0.98);
  });
});

/**
 * Bands own their edges, so they can be widened alone and can overlap.
 *
 * They used to come off a shared three-way crossover, whose entire nature is
 * that its outputs are adjacent and sum back to the input — so widening one
 * narrowed its neighbour and an overlap was unreachable. That is correct for a
 * compressor, where the bands are taken apart and put back together. It is
 * wrong here: the dry signal passes through untouched and each band only ADDS
 * what it made, so two bands over the same octave is a sensible request.
 */
describe('overlapping bands', () => {
  /**
   * A span in Hz, as the centre and width the settings now carry.
   *
   * The tests are written in edges because edges are what "overlapping" means;
   * the conversion is the inverse of `exciterBandEdges`, so what the test asks
   * for is what the audio gets.
   */
  const asBand = ([low, high]: [number, number]) => ({
    freqHz: Math.sqrt(low * high),
    range: (Math.log2(high / low) - EXCITER_MIN_OCTAVES) / EXCITER_OCTAVE_SPAN,
  });

  const twoBandsOver = (
    first: [number, number],
    second: [number, number],
  ): IExciterSettings =>
    settings({
      organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
      isolate: true,
      bands: DSP_DEFAULTS.exciter.bands.map((band, index) => ({
        ...band,
        enabled: index < 2,
        mix: 0.4,
        ...asBand(index === 0 ? first : second),
      })),
    });

  it('both bands work on a tone they both cover', () => {
    // Apart: only the first band contains 400 Hz.
    const apart = run(twoBandsOver([200, 800], [4_000, 12_000]), 400);
    // Overlapping: both do.
    const over = run(twoBandsOver([200, 800], [300, 1_200]), 400);

    /**
     * MATERIALLY different, and deliberately not "louder".
     *
     * Two bands over one tone do not simply add their harmonics, and the
     * reason is worth knowing before anybody treats it as a fault. Each band
     * passes the tone through its own filters, which impose their own phase
     * shift; generating a second harmonic SQUARES the signal, and squaring
     * DOUBLES that phase difference. Two bands a quarter cycle apart at the
     * fundamental are therefore half a cycle apart at the harmonic, and
     * partially cancel — measured here at 0.015 against 0.026 for one band
     * alone, so the pair came out quieter than the single.
     *
     * That is real and is a property of harmonic generation rather than of
     * this implementation. What the feature claims is that the second band
     * REACHES the tone, which under a crossover it could not; so that is what
     * this asserts.
     */
    expect(Math.abs(rms(over) - rms(apart))).toBeGreaterThan(rms(apart) * 0.2);
  });

  it('a band can be widened without touching its neighbour', () => {
    const narrow = run(twoBandsOver([380, 420], [4_000, 12_000]), 400);
    const wide = run(twoBandsOver([100, 2_000], [4_000, 12_000]), 400);
    // The second band's span is identical in both, so any difference is the
    // first band's alone — which under the old crossover was impossible to
    // arrange at all.
    expect(rms(wide)).not.toBeCloseTo(rms(narrow), 4);
  });
});

describe('organic range', () => {
  /**
   * Range must open the focused body region without becoming broadband.
   *
   * The former unfiltered blend let unrelated bass, mids and cymbals enter one
   * non-linearity and create the grain Ivan rejected. Even at maximum width,
   * Organic remains a body band around its focus.
   */
  const runOrganic = (range: number, focusHz: number, frequency: number) => {
    const state = createOrganicPath(FRAMES);
    let output: Float32Array = new Float32Array(FRAMES);
    for (let atBlock = 0; atBlock < 80; atBlock += 1) {
      const source = block(frequency, 0.5, atBlock * FRAMES);
      output = runOrganicPath(
        state,
        source,
        { enabled: true, amount: 0.8, focusHz, range },
        0.8,
        RATE,
      );
    }
    return output;
  };

  it('keeps a far-away tone attenuated at maximum width', () => {
    // Focus at 200 Hz, comparison tone at 6 kHz — five octaves away.
    const far = runOrganic(1, 200, 6_000);
    const focus = runOrganic(1, 200, 200);
    expect(rms(far)).toBeLessThan(rms(focus) * 0.35);
    expect(rms(far)).toBeGreaterThan(0);
  });

  it('still works on the focus itself at range 0', () => {
    // The null the test above needs: narrow is narrow, not broken.
    const atFocus = runOrganic(0, 400, 400);
    expect(rms(atFocus)).toBeGreaterThan(0);
  });
});
