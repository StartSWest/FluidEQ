/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fftInPlace from '../../common/dsp/fft';
import {
  INoiseHumPartial,
  INoiseProfile,
  NOISE_HUM_MAX_HARMONICS,
  NOISE_PROFILE_BANDS,
  NOISE_PROFILE_SILENCE_DB,
  noiseProfileBandHz,
  noiseProfileBandOf,
} from '../../common/dsp/noiseProfile';

/**
 * Measuring a track's noise floor, in the same pass that measures its loudness.
 *
 * Streaming, and arithmetic only — no decoding and no yielding, exactly like
 * `loudnessAnalysis.ts` and for the same reason. `analyzeInputTrack` owns the
 * decode and the yield boundary, and feeding a file in one call or in
 * one-second chunks produces identical results because all the state is here.
 *
 * The one contract that matters is the UNITS. `bands_db` is a power DENSITY —
 * power per hertz, full-scale referenced — and not a per-bin level. A per-bin
 * level depends on the transform that measured it, and the transform that
 * measures here runs at the file's sample rate while the one that consumes it
 * runs at the device's. Those are routinely different, and a profile that
 * silently meant something else at 48 kHz than at 44.1 would subtract the
 * wrong amount at every frequency while still plotting like a noise floor.
 * `profile_bin_power` in `denoise_spectral.cpp` is the other half of this
 * contract and the two have to move together.
 */

/** Held near 21 ms, matching `kDenoiseWindowMs`. */
const WINDOW_MS = 21.3;
const OVERLAP = 4;

/**
 * Frames per sub-window for the minimum.
 *
 * The floor in a bin is estimated as "the quietest this bin got", because
 * music stops and noise does not. Taking a MEDIAN of those minima across the
 * whole file is what stops one silent intro or one loud outro from deciding
 * the answer for the entire track.
 */
const MINIMUM_FRAMES = 16;

/**
 * Which percentile of the sub-window minima is taken as the floor.
 *
 * A TENTH. The percentile is a direct statement of how much of a track has to
 * be quiet in a given band for the floor there to be measurable, and that has
 * to hold for dense material. Measured against a tone playing roughly half the
 * time under a smooth envelope, worst band: the median read 8 dB high — it
 * sits exactly on the boundary between the noise-only windows and the rest,
 * where nothing decides it — the quartile 4.5 dB, a tenth 4.0 dB. Away from
 * the tone every band lands within half a decibel at a tenth.
 *
 * Lower is not automatically better. The percentile is taken over the pooled
 * sub-window minima of every bin in the band, so a tenth still has hundreds of
 * observations beneath it on a real track, while a hundredth would start
 * reporting the quietest accident in the file.
 */
const FLOOR_PERCENTILE = 0.1;

/**
 * How far below the true noise power that quartile sits, as a factor.
 *
 * MEASURED, not derived, and the derivation is written down here because it is
 * wrong in an instructive way. The idealisation says sixteen frames at
 * three-quarter overlap are `MINIMUM_FRAMES / OVERLAP + 1` = 5 independent
 * looks, and that the quantity wanted is the median: together, 8.6 dB. Both
 * halves are off. Bin powers of overlapped Hann frames decorrelate
 * substantially faster than their sample overlap suggests, so the effective
 * count is nearer the full sixteen than a quarter of it, and the quartile sits
 * lower than the median besides.
 *
 * Measured against white noise of known density at amplitudes 0.002, 0.02 and
 * 0.2 — the offset came out level-independent to three decimal places, which
 * is what makes a single constant the correct shape of fix rather than a
 * fitted curve. `dspNoiseAnalysis.test.ts` holds it to that density, so a
 * change to the window, the overlap or the percentile fails there rather than
 * quietly re-tuning every noise floor the app has ever measured.
 */
const MINIMUM_BIAS_DB = 21.77;
const MINIMUM_BIAS = 10 ** (MINIMUM_BIAS_DB / 10);

/**
 * A log histogram per band, which is how the median is taken in one pass.
 *
 * The obvious streaming approach — a multiplicative tracker stepping toward
 * each observation, as the click detector uses — does not work at this time
 * scale and the failure is quiet. At two percent per sub-window it can travel
 * about eight decibels across an entire eight-second file, so wherever it
 * starts is roughly where it ends: seeded low it reads seventeen decibels
 * under, seeded from the first observation it reads whatever the first second
 * of the track happened to be. It is a tracker being asked for a statistic.
 *
 * A histogram has no convergence behaviour at all. Half-decibel buckets over a
 * range wide enough for digital silence and full scale, forty bands, is 45 kB
 * and gives an exact median regardless of what order the file arrives in.
 */
const HISTOGRAM_MIN_DB = -200;
const HISTOGRAM_MAX_DB = 80;
const HISTOGRAM_STEP_DB = 0.5;
const HISTOGRAM_BUCKETS = Math.round(
  (HISTOGRAM_MAX_DB - HISTOGRAM_MIN_DB) / HISTOGRAM_STEP_DB,
);

/** Below this a bin is digital silence rather than a level. */
const POWER_EPSILON = 1e-30;

/** Half a band, as a ratio, for turning a centre back into its edges. */
const BAND_EDGE_RATIO = 2 ** (Math.log2(20_000 / 20) / NOISE_PROFILE_BANDS / 2);

/**
 * The transform used to find the mains fundamental, and why it is a second one.
 *
 * The floor is measured with a 21 ms window, whose bins are 47 Hz apart at
 * 48 kHz — which cannot tell 50 Hz from 60, let alone 50.0 from 50.2. Hum
 * needs frequency resolution exactly where the floor needs time resolution, so
 * it gets its own long window and a parabolic interpolation of the peak, which
 * resolves the fundamental to a few tenths of a hertz.
 */
const HUM_WINDOW = 16_384;
/**
 * How far a partial may sit from its nominal frequency, as a fraction of it.
 *
 * Two percent, which covers material transferred off-speed — the case the
 * allowance actually exists for, and one that stretches the whole comb rather
 * than shifting it. A grid holds its frequency far tighter than this.
 */
const HUM_DRIFT_FRACTION = 0.02;

/**
 * Frames before the running minimum is trusted over the mean.
 *
 * Each frame is a third of a second, so this is under three seconds of audio.
 * Below it there are too few observations for "the quietest this bin ever got"
 * to distinguish a note that stopped from one that never played.
 */
const HUM_MIN_STATIONARY_FRAMES = 8;

/**
 * How far a partial's quietest frame may fall below its average, in dB.
 *
 * Hum is on for the whole file, so its quietest frame is its average and this
 * ratio is near zero. A bass note playing a quarter of the time has an average
 * four times its absence, so it lands far below. Six decibels leaves room for
 * hum that breathes with the supply without leaving room for a note.
 */
const HUM_STATIONARITY_DB = -6;
const HUM_CANDIDATES = [50, 60] as const;

/** Clicks are counted with the detector's own logic, so the card agrees. */
const CLICK_THRESHOLD_FACTOR = 12;
const CLICK_MEDIAN_STEP = 0.005;
const CLICK_WARMUP = 2048;
const CLICK_MIN_SCALE = 1e-7;

const nextPowerOfTwo = (value: number): number => {
  let size = 64;
  while (size < value) {
    size *= 2;
  }
  return size > 64 && size - value > value - size / 2 ? size / 2 : size;
};

export interface INoiseProfileAnalyzer {
  /** Arithmetic only. Never yields; the caller owns that boundary. */
  feed: (channels: readonly Float32Array[], from: number, to: number) => void;
  finish: () => INoiseProfile;
}

export const createNoiseProfileAnalyzer = (
  sampleRate: number,
  channelCount: number,
): INoiseProfileAnalyzer => {
  const window = nextPowerOfTwo((sampleRate * WINDOW_MS) / 1000);
  const hop = window / OVERLAP;
  const bins = window / 2 + 1;

  const shape = new Float64Array(window);
  let windowEnergy = 0;
  for (let i = 0; i < window; i += 1) {
    shape[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / window);
    windowEnergy += shape[i] * shape[i];
  }

  const frame = new Float64Array(window);
  const real = new Float64Array(window);
  const imaginary = new Float64Array(window);
  let fill = 0;

  const subMinimum = new Float64Array(bins).fill(Infinity);
  /**
   * Which band each transform bin belongs to, resolved once.
   *
   * -1 for bins outside the profile's span, and for bin zero, which is DC and
   * describes an offset rather than a noise floor.
   */
  const bandOfBin = new Int32Array(bins).fill(-1);
  for (let bin = 1; bin < bins; bin += 1) {
    bandOfBin[bin] = noiseProfileBandOf((bin * sampleRate) / window);
  }

  const histogram = new Uint32Array(NOISE_PROFILE_BANDS * HISTOGRAM_BUCKETS);
  const bandTotals = new Uint32Array(NOISE_PROFILE_BANDS);
  let subFrames = 0;
  let completedSubWindows = 0;

  /*
   * Two spectra, and the second one is what makes the detector work.
   *
   * The mean over the file is what a partial present throughout stands out of,
   * and that was the whole of it. But a bass note stands out of a mean too —
   * G1 is 49.0 Hz and B1 is 61.7 Hz, either side of the two frequencies being
   * looked for — so on bass-heavy material the detector reported hum that was
   * a bassline, placed a comb on its harmonics, and notched the instrument.
   *
   * The running MINIMUM separates them, and nothing else does. Hum is in every
   * frame of the file by definition; a note is not, and the moment the bass
   * moves off that pitch its bin collapses to the floor and takes the minimum
   * with it. A sinusoid's per-frame power barely varies, so its minimum is its
   * level. That is the same discrimination minimum statistics rests on, at a
   * third of a second per frame instead of five milliseconds.
   *
   * The mean is kept as the fallback for files too short for a minimum to mean
   * anything.
   */
  /*
   * Blackman-Harris, not Hann, and this window is the difference between the
   * detector working on music and not.
   *
   * Hann's sidelobes are about 45 dB down a few bins out. A bass note at 0.15
   * sits some 88 dB over the noise floor of a quiet recording, so it leaks
   * forty-odd decibels into every bin for a hundred hertz either side — in
   * EVERY frame it plays. That defeats the running minimum completely: the
   * 60 Hz bin never falls to the floor, because whichever note is playing is
   * always putting something there, and the detector duly finds a stationary
   * partial that is an artefact of its own window.
   *
   * The four-term Blackman-Harris is 92 dB down, which puts that leakage under
   * the floor instead of forty decibels over it. It costs main-lobe width —
   * four bins rather than two — and that is the right trade here, because what
   * this transform is doing is looking for a small tone standing next to very
   * large ones. Nothing is calibrated against it: every hum decision is a ratio
   * against the local floor measured through the same window.
   */
  const humShape = new Float64Array(HUM_WINDOW);
  for (let i = 0; i < HUM_WINDOW; i += 1) {
    const t = (2 * Math.PI * i) / HUM_WINDOW;
    humShape[i] =
      0.35875 -
      0.48829 * Math.cos(t) +
      0.14128 * Math.cos(2 * t) -
      0.01168 * Math.cos(3 * t);
  }

  const humFrame = new Float64Array(HUM_WINDOW);
  const humReal = new Float64Array(HUM_WINDOW);
  const humImaginary = new Float64Array(HUM_WINDOW);
  const humPower = new Float64Array(HUM_WINDOW / 2 + 1);
  const humStationary = new Float64Array(HUM_WINDOW / 2 + 1).fill(Infinity);
  let humFill = 0;
  let humFrames = 0;

  let clickScale = CLICK_MIN_SCALE;
  let clickWarmup = CLICK_WARMUP;
  let clickPrevious = 0;
  let clickBefore = 0;
  let clickInRun = false;
  let clicks = 0;
  let samples = 0;

  const processFrame = () => {
    for (let i = 0; i < window; i += 1) {
      real[i] = frame[i] * shape[i];
      imaginary[i] = 0;
    }
    fftInPlace(real, imaginary, false);
    for (let bin = 0; bin < bins; bin += 1) {
      const power = real[bin] * real[bin] + imaginary[bin] * imaginary[bin];
      if (power < subMinimum[bin]) {
        subMinimum[bin] = power;
      }
    }
    subFrames += 1;
    if (subFrames >= MINIMUM_FRAMES) {
      for (let bin = 1; bin < bins; bin += 1) {
        const band = bandOfBin[bin];
        if (band >= 0) {
          const observed = Math.max(POWER_EPSILON, subMinimum[bin]);
          const db = 10 * Math.log10(observed);
          const bucket = Math.max(
            0,
            Math.min(
              HISTOGRAM_BUCKETS - 1,
              Math.floor((db - HISTOGRAM_MIN_DB) / HISTOGRAM_STEP_DB),
            ),
          );
          histogram[band * HISTOGRAM_BUCKETS + bucket] += 1;
          bandTotals[band] += 1;
        }
        subMinimum[bin] = Infinity;
      }
      subFrames = 0;
      completedSubWindows += 1;
    }
    frame.copyWithin(0, hop);
  };

  const processHumFrame = () => {
    for (let i = 0; i < HUM_WINDOW; i += 1) {
      humReal[i] = humFrame[i] * humShape[i];
      humImaginary[i] = 0;
    }
    fftInPlace(humReal, humImaginary, false);
    for (let bin = 0; bin < humPower.length; bin += 1) {
      const power =
        humReal[bin] * humReal[bin] + humImaginary[bin] * humImaginary[bin];
      humPower[bin] += power;
      if (power < humStationary[bin]) {
        humStationary[bin] = power;
      }
    }
    humFrames += 1;
    humFill = 0;
  };

  const feedClick = (value: number) => {
    const predicted = 2 * clickPrevious - clickBefore;
    const error = Math.abs(value - predicted);
    clickScale = Math.max(
      CLICK_MIN_SCALE,
      error > clickScale
        ? clickScale * (1 + CLICK_MEDIAN_STEP)
        : clickScale * (1 - CLICK_MEDIAN_STEP),
    );
    if (clickWarmup > 0) {
      clickWarmup -= 1;
    } else if (error > clickScale * CLICK_THRESHOLD_FACTOR) {
      if (!clickInRun) {
        clicks += 1;
        clickInRun = true;
      }
    } else {
      clickInRun = false;
    }
    clickBefore = clickPrevious;
    clickPrevious = value;
  };

  return {
    feed: (channels, from, to) => {
      const left = channels[0];
      const right = channelCount > 1 ? channels[1] : channels[0];
      for (let i = from; i < to; i += 1) {
        // Mono sum. A noise floor is a property of the recording rather than
        // of one side of it, and measuring each channel separately would
        // double the work to produce two numbers the engine averages anyway.
        const value = (left[i] + right[i]) * 0.5;
        samples += 1;
        feedClick(value);

        frame[window - hop + fill] = value;
        fill += 1;
        if (fill === hop) {
          processFrame();
          fill = 0;
        }

        humFrame[humFill] = value;
        humFill += 1;
        if (humFill === HUM_WINDOW) {
          processHumFrame();
        }
      }
    },

    finish: () => {
      if (completedSubWindows === 0 || samples === 0) {
        return {
          bandsDb: new Array<number>(NOISE_PROFILE_BANDS).fill(
            NOISE_PROFILE_SILENCE_DB,
          ),
          floorDbfs: NOISE_PROFILE_SILENCE_DB,
          humHz: 0,
          humPartials: [],
          clicksPerMinute: 0,
        };
      }

      // Per-bin power back to a density, which is the inverse of what
      // `profile_bin_power` in `denoise_spectral.cpp` does with it.
      const referenceBandwidth = sampleRate * 0.5;
      const bandsDb = new Array<number>(NOISE_PROFILE_BANDS).fill(
        NOISE_PROFILE_SILENCE_DB,
      );
      const measured = new Array<boolean>(NOISE_PROFILE_BANDS).fill(false);

      for (let band = 0; band < NOISE_PROFILE_BANDS; band += 1) {
        const total = bandTotals[band];
        if (total > 0) {
          const target = total * FLOOR_PERCENTILE;
          let seen = 0;
          let bucket = 0;
          for (; bucket < HISTOGRAM_BUCKETS; bucket += 1) {
            seen += histogram[band * HISTOGRAM_BUCKETS + bucket];
            if (seen >= target) {
              break;
            }
          }
          const percentileDb =
            HISTOGRAM_MIN_DB + (bucket + 0.5) * HISTOGRAM_STEP_DB;
          const binPower = 10 ** (percentileDb / 10) * MINIMUM_BIAS;
          const density = binPower / (windowEnergy * referenceBandwidth);
          bandsDb[band] =
            density > 0
              ? Math.max(NOISE_PROFILE_SILENCE_DB, 10 * Math.log10(density))
              : NOISE_PROFILE_SILENCE_DB;
          measured[band] = true;
        }
      }

      // The lowest bands are narrower than one transform bin, so nothing ever
      // lands in them. Held from the nearest band that was measured rather
      // than left at silence, which would tell the engine there is no noise
      // down there instead of that nothing looked.
      let nearest = bandsDb.findIndex((_unused, band) => measured[band]);
      if (nearest >= 0) {
        for (let band = 0; band < NOISE_PROFILE_BANDS; band += 1) {
          if (measured[band]) {
            nearest = band;
          } else {
            bandsDb[band] = bandsDb[nearest];
          }
        }
      }

      // Integrated across the span, so the headline number is the level of the
      // noise as a whole rather than of one band of it.
      let totalPower = 0;
      for (let band = 0; band < NOISE_PROFILE_BANDS; band += 1) {
        const low = noiseProfileBandHz(band) / BAND_EDGE_RATIO;
        const high = noiseProfileBandHz(band) * BAND_EDGE_RATIO;
        totalPower += 10 ** (bandsDb[band] / 10) * (high - low);
      }
      const floorDbfs =
        totalPower > 0
          ? Math.max(NOISE_PROFILE_SILENCE_DB, 10 * Math.log10(totalPower))
          : NOISE_PROFILE_SILENCE_DB;

      // Levels from the mean; presence over time from the minimum. Too few
      // frames to have taken a meaningful minimum and the stationarity test is
      // disabled by handing it the mean, which scores every bin at zero.
      const humMean = new Float64Array(humPower.length);
      for (let bin = 0; bin < humPower.length; bin += 1) {
        humMean[bin] = humPower[bin] / Math.max(1, humFrames);
      }
      const { humHz, humPartials } = findHum(
        humMean,
        humFrames >= HUM_MIN_STATIONARY_FRAMES ? humStationary : humMean,
        sampleRate,
      );

      const minutes = samples / sampleRate / 60;
      return {
        bandsDb,
        floorDbfs,
        humHz,
        humPartials,
        clicksPerMinute: minutes > 0 ? clicks / minutes : 0,
      };
    },
  };
};

/**
 * The mains fundamental and the partials that actually stand above the floor.
 *
 * Reported as a measured frequency rather than as a choice between 50 and 60,
 * because a notch nailed to 50.0 misses hum sitting at 50.2 and widening it
 * until it does not is how a hum filter starts removing bass. The peak is
 * interpolated parabolically across its two neighbours, which resolves it well
 * inside one bin of the long transform.
 */
const findHum = (
  power: Float64Array,
  stationary: Float64Array,
  sampleRate: number,
): { humHz: number; humPartials: INoiseHumPartial[] } => {
  const binHz = sampleRate / HUM_WINDOW;

  /**
   * How much of a bin's average level is there in its quietest frame, in dB.
   *
   * Zero for something present the whole way through, deeply negative for
   * something that comes and goes. That is the entire distinction between hum
   * and a note, and it is measured rather than assumed.
   *
   * The two spectra do different jobs and the split matters. The MEAN is what
   * levels are read from, because averaging is what pulls a small partial out
   * of the noise it sits on. The MINIMUM is only ever used as this ratio: the
   * minimum of an exponentially distributed power has enormous relative
   * scatter, so reading a level off it invents six-decibel peaks out of plain
   * noise — which is exactly what it did when it was tried as the spectrum.
   */
  const stationarityDb = (bin: number): number => {
    if (bin <= 0 || bin >= power.length || power[bin] <= 0) {
      return -Infinity;
    }
    const quietest = Number.isFinite(stationary[bin]) ? stationary[bin] : 0;
    return quietest > 0 ? 10 * Math.log10(quietest / power[bin]) : -Infinity;
  };

  /*
   * The search window widens with the harmonic, and at the fundamental it is
   * ONE BIN.
   *
   * It was a flat six hertz, which put 44-56 around fifty and 54-66 around
   * sixty. Those overlap. A single peak anywhere in 54-56 was found by both
   * searches and awarded to whichever scored marginally higher, and a peak at
   * 56 could be returned as the fifty-hertz candidate — after which every
   * harmonic was placed at a multiple of 56 and the comb sat on nothing.
   *
   * A grid never deviates by more than a fraction of a hertz. What the width
   * is really for is material transferred off-speed, and that scales the whole
   * comb rather than shifting it, so the allowance belongs proportional to the
   * harmonic: two percent, which at the tenth partial is ten hertz and at the
   * fundamental is less than the bin spacing, so the two candidates can no
   * longer reach each other.
   */
  const peakNear = (hz: number): { hz: number; power: number } => {
    // In HERTZ around the target, then converted to bins — not the target
    // rounded to a bin and widened by whole bins from there. That skews the
    // window by up to half a bin: sixty hertz rounds to a bin at 58.6, so
    // "one bin either side" reached down to 55.7 and could claim a tone that
    // is nowhere near sixty.
    const toleranceHz = Math.max(binHz * 1.5, hz * HUM_DRIFT_FRACTION);
    const lowest = Math.max(1, Math.ceil((hz - toleranceHz) / binHz));
    const highest = Math.min(
      power.length - 2,
      Math.floor((hz + toleranceHz) / binHz),
    );
    if (lowest > highest) {
      return { hz: 0, power: 0 };
    }
    let best = lowest;
    for (let bin = lowest; bin <= highest; bin += 1) {
      if (power[bin] > power[best]) {
        best = bin;
      }
    }
    if (best <= 0 || best >= power.length - 1) {
      return { hz: 0, power: 0 };
    }
    /*
     * It has to be a PEAK, not merely the largest thing in the window.
     *
     * A strong tone just outside the window leaves the spectrum climbing
     * steadily toward it, so the largest bin inside sits on the edge and is
     * part of somebody else's skirt. Taking it produced the worst failure this
     * detector had: a sustained 55 Hz tone, which is neither mains frequency,
     * was returned as the fundamental — and the comb then went onto 110, 165
     * and 220, notching an instrument at four frequencies because of a peak
     * that was never there.
     *
     * A true partial falls away on both sides. Equality is allowed, since a
     * tone landing exactly between two bins fills them equally.
     */
    if (power[best] < power[best - 1] || power[best] < power[best + 1]) {
      return { hz: 0, power: 0 };
    }
    // Parabolic interpolation on the log magnitudes, which is the standard
    // correction for a peak that does not land exactly on a bin.
    const left = Math.log(Math.max(1e-30, power[best - 1]));
    const middle = Math.log(Math.max(1e-30, power[best]));
    const right = Math.log(Math.max(1e-30, power[best + 1]));
    const denominator = left - 2 * middle + right;
    const offset =
      Math.abs(denominator) > 1e-12 ? (0.5 * (left - right)) / denominator : 0;
    const refined = (best + Math.max(-0.5, Math.min(0.5, offset))) * binHz;
    // The tolerance is checked against the REFINED frequency, not against the
    // bin it came from. A bin is nearly three hertz wide here, so a peak whose
    // bin is inside the window can interpolate to a frequency that is plainly
    // outside it — which is how a 55 Hz tone was still being handed back as a
    // sixty-hertz partial after the window itself had been fixed.
    if (Math.abs(refined - hz) > toleranceHz) {
      return { hz: 0, power: 0 };
    }
    return { hz: refined, power: power[best] };
  };

  /**
   * The floor beside a partial, so its excess is measured and not assumed.
   *
   * A MEDIAN, not a mean. The window reaches twenty-four bins either side,
   * which at this transform is seventy hertz — so for a fundamental at fifty
   * it contains the hundred-hertz partial and, at the low end, DC. Averaging
   * those in raises the "floor" by whatever the neighbouring harmonic is
   * doing and hides the very peak being measured. A median is unmoved by a few
   * loud bins in the window, which is the entire reason to prefer it here.
   */
  const neighbourhood = (bin: number): number => {
    const around: number[] = [];
    // The eight bins nearest the peak are skipped: a partial spreads into its
    // immediate neighbours through the window, so measuring the floor from
    // those would be measuring the hum and calling it the floor.
    for (let offset = -24; offset <= 24; offset += 1) {
      const at = bin + offset;
      if (Math.abs(offset) >= 8 && at > 0 && at < power.length) {
        around.push(power[at]);
      }
    }
    if (around.length === 0) {
      return 0;
    }
    around.sort((a, b) => a - b);
    return around[Math.floor(around.length / 2)];
  };

  /** A candidate's height over the floor around it, in dB. */
  const excessAt = (found: { hz: number; power: number }): number => {
    if (found.hz <= 0) {
      return 0;
    }
    const local = neighbourhood(Math.round(found.hz / binHz));
    return local > 0 && found.power > 0
      ? 10 * Math.log10(found.power / local)
      : 0;
  };

  /*
   * Score a candidate on its WHOLE COMB, not on its fundamental.
   *
   * Deciding between fifty and sixty by whichever fundamental is taller is
   * wrong in the common case and not merely imprecise. Mains hum reaches a
   * recording through transformers and ground loops that are anything but
   * linear, so the second and third partials routinely stand above the first,
   * and any recording that has been high-passed — most of them — has no
   * fundamental left at all. The comb is the signature. Ten evenly spaced
   * partials at sixty and none at fifty is an unambiguous answer even when
   * there is nothing whatsoever at sixty hertz itself.
   */
  const scoreComb = (
    fundamental: number,
  ): { score: number; partials: INoiseHumPartial[]; orders: number[] } => {
    const partials: INoiseHumPartial[] = [];
    const orders: number[] = [];
    let score = 0;
    for (let order = 1; order <= NOISE_HUM_MAX_HARMONICS; order += 1) {
      const target = fundamental * order;
      if (target >= sampleRate * 0.45 || target >= 2_000) {
        break;
      }
      const found = peakNear(target);
      const excessDb = found.hz > 0 ? excessAt(found) : 0;
      // Present throughout, not merely present. A bass note is as loud as hum
      // and stands as far above the floor; what it does not do is play in
      // every frame of the file.
      const steady =
        found.hz > 0 &&
        stationarityDb(Math.round(found.hz / binHz)) >= HUM_STATIONARITY_DB;
      // Six decibels over the surrounding floor, the same bar the notch
      // placement uses. Below that the peak is the floor, and a notch there is
      // all cost.
      if (found.hz > 0 && steady && excessDb >= 6) {
        score += excessDb;
        partials.push({ hz: found.hz, excessDb });
        orders.push(order);
      }
    }
    return { score, partials, orders };
  };

  let chosen = {
    score: 0,
    partials: [] as INoiseHumPartial[],
    orders: [] as number[],
  };
  HUM_CANDIDATES.forEach((candidate) => {
    const scored = scoreComb(candidate);
    if (scored.score > chosen.score) {
      chosen = scored;
    }
  });

  if (chosen.partials.length === 0) {
    return { humHz: 0, humPartials: [] };
  }

  /*
   * The fundamental, solved from every partial rather than read off the first.
   *
   * Each located partial says f_n is about n times f0, so the least-squares f0
   * over all of them is sum(n*f_n) / sum(n*n) — and a partial's frequency
   * error does not grow with its order while the LEVER n does, so the tenth
   * harmonic pins f0 roughly ten times as tightly as the first. This matters
   * downstream and the notch placement says so: the comb is built at multiples
   * of this number, and by the eighth partial an f0 that is a tenth of a hertz
   * out is nearly a hertz out, which for a Q of thirty is outside the notch.
   */
  let weighted = 0;
  let orderSquares = 0;
  chosen.orders.forEach((order, index) => {
    weighted += order * chosen.partials[index].hz;
    orderSquares += order * order;
  });
  const humHz = orderSquares > 0 ? weighted / orderSquares : 0;

  return { humHz, humPartials: chosen.partials };
};
