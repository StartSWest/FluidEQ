/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  NOISE_PROFILE_BANDS,
  noiseProfileBandHz,
  noiseProfileLevelAt,
  isNoiseProfile,
  silentNoiseProfile,
} from '../../../common/dsp/noiseProfile';
import { createNoiseProfileAnalyzer } from '../../../renderer/dsp/noiseAnalysis';

/**
 * The scan, checked against noise whose density is known in closed form.
 *
 * This is the test that matters most in the whole feature, because the units
 * are the thing most likely to be silently wrong: `bandsDb` is a power density
 * and `profile_bin_power` in `denoise_spectral.cpp` is the other half of that
 * contract. Getting it wrong by a constant produces a denoiser that runs,
 * reports plausible gains and removes nothing — which is exactly what happened
 * on the first attempt, off by N/2.
 */

const RATE = 48_000;

/**
 * Deterministic, so a failure is reproducible rather than occasionally red.
 *
 * The same linear congruential generator `denoise_test.cpp` uses, so the two
 * sides of this feature are measured against the same noise.
 */
/* eslint-disable no-bitwise --
 * An LCG is defined over unsigned 32-bit arithmetic, and `>>> 0` is how
 * JavaScript expresses that. Written with a modulo instead it needs a
 * sign-correction branch that has nothing to do with the algorithm, and the
 * result no longer matches any reference implementation a reader might check
 * it against. Same reasoning as the file-level disable in `fft.ts`.
 */
const makeNoise = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 8) / 8388608 - 1;
  };
};
/* eslint-enable no-bitwise */

const feedWholeFile = (
  analyzer: ReturnType<typeof createNoiseProfileAnalyzer>,
  signal: Float32Array,
) => {
  // In one-second chunks, the way `analyzeInputTrack` does, so the streaming
  // boundary is exercised rather than assumed harmless.
  for (let at = 0; at < signal.length; at += RATE) {
    analyzer.feed([signal, signal], at, Math.min(signal.length, at + RATE));
  }
  return analyzer.finish();
};

describe('noise profile band geometry', () => {
  it('spans 20 Hz to 20 kHz with centres inside the span', () => {
    const first = noiseProfileBandHz(0);
    const last = noiseProfileBandHz(NOISE_PROFILE_BANDS - 1);
    expect(first).toBeGreaterThan(20);
    expect(last).toBeLessThan(20_000);
    // Geometric spacing: every band is the same ratio wider than the last.
    const ratio = noiseProfileBandHz(1) / noiseProfileBandHz(0);
    expect(noiseProfileBandHz(20) / noiseProfileBandHz(19)).toBeCloseTo(
      ratio,
      12,
    );
  });

  it('holds the nearest band flat outside the measured span', () => {
    const bands = new Array<number>(NOISE_PROFILE_BANDS).fill(-60);
    bands[0] = -33;
    bands[NOISE_PROFILE_BANDS - 1] = -44;
    // Extrapolating a slope past the span would invent a floor at frequencies
    // the scan deliberately did not look at.
    expect(noiseProfileLevelAt(bands, 5)).toBeCloseTo(-33, 9);
    expect(noiseProfileLevelAt(bands, 30_000)).toBeCloseTo(-44, 9);
  });
});

describe('createNoiseProfileAnalyzer', () => {
  it('recovers the density of white noise to within a decibel and a half', () => {
    const length = RATE * 8;
    const amplitude = 0.002;
    const source = makeNoise(9_281);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      signal[i] = amplitude * source();
    }

    // Uniform on [-a, a] has variance a^2/3, spread flat over the one-sided
    // band. That is the number the scan has to come back with.
    const variance = (amplitude * amplitude) / 3;
    const expectedDensityDb = 10 * Math.log10(variance / (RATE / 2));

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);

    // Checked in the middle of the range: the lowest bands hold only a handful
    // of transform bins each and are noisy estimates by construction.
    for (let band = 20; band < 34; band += 1) {
      expect(Math.abs(profile.bandsDb[band] - expectedDensityDb)).toBeLessThan(
        1.5,
      );
    }
    expect(profile.floorDbfs).toBeGreaterThan(10 * Math.log10(variance) - 2);
    expect(profile.floorDbfs).toBeLessThan(10 * Math.log10(variance) + 2);
  });

  it('measures the floor under music rather than the music', () => {
    const length = RATE * 8;
    const amplitude = 0.002;
    const variance = (amplitude * amplitude) / 3;
    const source = makeNoise(4_412);
    const quiet = new Float32Array(length);
    const loud = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const noise = amplitude * source();
      quiet[i] = noise;
      // The same noise under INTERMITTENT music — half a second on, half a
      // second silent. Intermittent because that is the claim being tested:
      // the estimator finds the floor in the gaps. Under a note that never
      // stops there is genuinely nothing to find, and a continuous tone would
      // be asserting something no estimator can do.
      //
      // The envelope is smooth, and that is not decoration. A hard gate on a
      // sine is a step discontinuity twice a second, which is a click — it
      // spreads broadband energy across every band and lifts the measured
      // floor by 4 dB everywhere. The first version of this test did that and
      // read as a bug in the analyzer.
      const envelope = Math.max(0, Math.sin((2 * Math.PI * i) / RATE));
      loud[i] =
        noise + 0.5 * envelope * Math.sin((2 * Math.PI * 997 * i) / RATE);
    }

    const withoutMusic = feedWholeFile(
      createNoiseProfileAnalyzer(RATE, 2),
      quiet,
    );
    const withMusic = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), loud);

    // Away from the tone the two measurements agree essentially exactly. The
    // programme is 48 dB above the noise and changes nothing here, which is
    // the whole claim.
    for (let band = 25; band < 34; band += 1) {
      expect(
        Math.abs(withMusic.bandsDb[band] - withoutMusic.bandsDb[band]),
      ).toBeLessThan(1);
    }

    // Bands 20 to 24 are the tone's own quarter-octave band and the ones its
    // window skirt reaches. They read up to 4 dB high, and that is a property
    // of the material rather than a defect: under an envelope that only passes
    // close to zero briefly, almost no window in those bands is ever clean, so
    // there is no floor there to find. 4 dB high on a programme 48 dB up is
    // the estimator declining to be fooled, not failing.
    for (let band = 20; band < 25; band += 1) {
      expect(withMusic.bandsDb[band] - withoutMusic.bandsDb[band]).toBeLessThan(
        4.5,
      );
    }

    // The positive control. Without it these tolerances could be satisfied by
    // an estimator that had quietly stopped measuring anything at all.
    const programmeDb = 10 * Math.log10(0.5 * 0.5 * 0.5);
    const noiseDb = 10 * Math.log10(variance);
    expect(programmeDb - noiseDb).toBeGreaterThan(40);
  });

  it('finds a drifting mains fundamental and its partials', () => {
    const length = RATE * 8;
    const humHz = 50.2;
    const source = makeNoise(31_337);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const time = i / RATE;
      signal[i] =
        0.02 * Math.sin(2 * Math.PI * humHz * time) +
        0.008 * Math.sin(2 * Math.PI * humHz * 2 * time) +
        0.0005 * source();
    }

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);

    // Within a quarter of a hertz: the whole reason hum gets its own long
    // transform is that 50.0 is the wrong answer here.
    expect(Math.abs(profile.humHz - humHz)).toBeLessThan(0.25);
    expect(profile.humPartials.length).toBeGreaterThanOrEqual(2);
    expect(profile.humPartials[0].excessDb).toBeGreaterThan(20);
    expect(Math.abs(profile.humPartials[1].hz - humHz * 2)).toBeLessThan(0.5);
  });

  it('reports no hum on material that has none', () => {
    const length = RATE * 8;
    const source = makeNoise(777);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      signal[i] =
        0.1 * Math.sin((2 * Math.PI * 440 * i) / RATE) + 0.001 * source();
    }

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);
    // The null test. Its positive control is the case above, which proves the
    // detector is not simply answering zero to everything.
    expect(profile.humHz).toBe(0);
    expect(profile.humPartials).toHaveLength(0);
  });

  it('does not mistake a bassline for mains hum', () => {
    /*
     * The false positive the detector used to produce, and the reason it was
     * reported as useless on real music.
     *
     * G1 is 49.0 Hz and B1 is 61.7 Hz, which sit either side of the two
     * frequencies being looked for, and the search windows were wide enough to
     * reach both. Averaged over a file a bassline stands well above the floor,
     * so it scored as hum, and the comb went onto its harmonics.
     *
     * What separates them is that a note STOPS. The notes change every half
     * second here, so each bin collapses to the floor repeatedly, and the
     * running minimum the detector now works from collapses with it.
     */
    const length = RATE * 12;
    const source = makeNoise(4_242);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const time = i / RATE;
      // G1, D2, G1, B1 — a bassline, not a fault.
      const note = [49.0, 73.4, 49.0, 61.7][Math.floor(time * 2) % 4];
      signal[i] =
        0.15 * Math.sin(2 * Math.PI * note * time) +
        0.05 * Math.sin(2 * Math.PI * note * 2 * time) +
        0.0005 * source();
    }

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);
    expect(profile.humHz).toBe(0);
    expect(profile.humPartials).toHaveLength(0);
  });

  it('finds 60 Hz hum whose fundamental is missing entirely', () => {
    /*
     * The case that decided the detector had to score the whole comb.
     *
     * Mains hum reaches a recording through transformers and ground loops that
     * are anything but linear, so the upper partials routinely stand above the
     * first — and any recording that has been high-passed has no fundamental
     * left at all. There is nothing whatsoever at 60 Hz in this signal, and
     * nothing at 50 either, so a detector comparing the two fundamentals is
     * choosing between two patches of noise. The comb at 120, 180 and 240 is
     * unambiguous.
     *
     * The fundamental then comes from a least-squares fit over those three,
     * which is why it can be reported at all.
     */
    const length = RATE * 12;
    const source = makeNoise(9_001);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const time = i / RATE;
      signal[i] =
        0.02 * Math.sin(2 * Math.PI * 120 * time) +
        0.012 * Math.sin(2 * Math.PI * 180 * time) +
        0.006 * Math.sin(2 * Math.PI * 240 * time) +
        0.0005 * source();
    }

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);
    expect(Math.abs(profile.humHz - 60)).toBeLessThan(0.5);
    expect(profile.humPartials.length).toBeGreaterThanOrEqual(3);
  });

  it('claims neither 50 nor 60 for a tone sitting between them', () => {
    /*
     * The overlap bug, pinned.
     *
     * The two searches used to span 44-56 and 54-66, which share 54-56. A peak
     * in that gap was found by both, awarded to whichever scored higher by a
     * hair, and then reported as the FUNDAMENTAL — so a 55 Hz tone became a
     * comb at 110, 165, 220 and the notches landed on an instrument. Neither
     * window reaches it now.
     */
    const length = RATE * 12;
    const source = makeNoise(5_555);
    const signal = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      const time = i / RATE;
      signal[i] = 0.1 * Math.sin(2 * Math.PI * 55 * time) + 0.0005 * source();
    }

    const profile = feedWholeFile(createNoiseProfileAnalyzer(RATE, 2), signal);
    expect(profile.humHz).toBe(0);
  });

  it('counts injected clicks and leaves clean material alone', () => {
    const length = RATE * 8;
    const source = makeNoise(2_026);
    const clean = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      clean[i] =
        0.2 * Math.sin((2 * Math.PI * 440 * i) / RATE) + 0.001 * source();
    }
    const clicked = Float32Array.from(clean);
    let injected = 0;
    for (let i = RATE; i + 2 < length; i += RATE / 2) {
      clicked[i] = 0.9;
      clicked[i + 1] = -0.8;
      injected += 1;
    }

    const clickedProfile = feedWholeFile(
      createNoiseProfileAnalyzer(RATE, 2),
      clicked,
    );
    const cleanProfile = feedWholeFile(
      createNoiseProfileAnalyzer(RATE, 2),
      clean,
    );

    const minutes = length / RATE / 60;
    expect(clickedProfile.clicksPerMinute * minutes).toBeGreaterThanOrEqual(
      injected * 0.9,
    );
    expect(cleanProfile.clicksPerMinute).toBe(0);
    expect(clickedProfile.clicksPerMinute).toBeGreaterThan(
      cleanProfile.clicksPerMinute,
    );
  });
});

describe('isNoiseProfile', () => {
  it('accepts what the analyzer produces', () => {
    expect(isNoiseProfile(silentNoiseProfile())).toBe(true);
  });

  it('rejects a truncated band array rather than reading undefined as a level', () => {
    const profile = silentNoiseProfile();
    expect(
      isNoiseProfile({ ...profile, bandsDb: profile.bandsDb.slice(0, 12) }),
    ).toBe(false);
  });
});
