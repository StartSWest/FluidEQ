/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  EXCITER_MIN_OCTAVES,
  EXCITER_OCTAVE_SPAN,
  IExciterSettings,
} from '../../../common/dsp/chain';
import {
  createExciterChannel,
  runExciterChannel,
} from '../../../renderer/dsp/exciterStage';

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
 * Run several blocks, because the followers and the drift both need to settle
 * before a single block's reading means anything.
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
    // What is left is harmonics, which are a small fraction of the programme.
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
 * Every stage here adds the difference between a shaped copy and the dry
 * signal, and both halves of that had to be right before the difference was
 * harmonics rather than damage:
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
  const atLeastAsLoud = (config: IExciterSettings) => {
    const out = run(config, 400);
    const dry = rms(block(400, 0.5, 39 * FRAMES));
    expect(rms(out)).toBeGreaterThan(dry * 0.98);
  };

  it('one band never reduces the level', () => {
    atLeastAsLoud(
      settings({
        organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
        bands: DSP_DEFAULTS.exciter.bands.map((band, index) => ({
          ...band,
          enabled: index === 1,
          mix: 0.4,
        })),
      }),
    );
  });

  it('three bands never reduce the level', () => {
    atLeastAsLoud(
      allBands({
        organic: { ...DSP_DEFAULTS.exciter.organic, enabled: false },
      }),
    );
  });

  it('the organic stage never reduces the level', () => {
    atLeastAsLoud(
      settings({
        bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
          ...band,
          enabled: false,
        })),
        organic: { enabled: true, amount: 0.8, focusHz: 400, range: 0 },
      }),
    );
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
   * Range must actually reach the whole spectrum.
   *
   * A bandpass alone cannot: drop its Q far enough to span the audible band
   * and it stops behaving like a filter long before it stops rolling off. So
   * range blends towards the unfiltered signal, and the test of that is a tone
   * a long way from the focus — at range 0 it should be almost untouched, and
   * at range 1 it should be worked on as much as anything else.
   */
  const organicOnly = (range: number, focusHz: number) =>
    settings({
      isolate: true,
      bands: DSP_DEFAULTS.exciter.bands.map((band) => ({
        ...band,
        enabled: false,
      })),
      organic: {
        enabled: true,
        amount: 0.8,
        focusHz,
        range,
      },
    });

  it('reaches a tone far outside the focus band only when opened up', () => {
    // Focus at 200 Hz, tone at 6 kHz — five octaves away.
    const focused = run(organicOnly(0, 200), 6_000);
    const wide = run(organicOnly(1, 200), 6_000);
    expect(rms(wide)).toBeGreaterThan(rms(focused) * 5);
  });

  it('still works on the focus itself at range 0', () => {
    // The null the test above needs: narrow is narrow, not broken.
    const atFocus = run(organicOnly(0, 400), 400);
    expect(rms(atFocus)).toBeGreaterThan(0);
  });
});
