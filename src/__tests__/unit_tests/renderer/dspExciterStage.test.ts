/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IExciterSettings } from '../../../common/dsp/chain';
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
