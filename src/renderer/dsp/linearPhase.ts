/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { fftInPlace } from '../../common/dsp/fft';
import { CONVOLVER_LATENCY } from './convolver';
import { IEqSettings } from '../../common/dsp/chain';
import { FilterTypeEnum } from '../../common/constants';
import { biquadCoefficients, createBiquadState, processBiquad } from './biquad';

/**
 * Turning the rack into a filter with the same magnitude and no phase shift.
 *
 * A biquad cannot do this. Every minimum-phase filter shifts phase where it
 * changes amplitude — that is not a flaw in the implementation, it is what
 * makes the filter causal, and it is why two overlapping bands interact and
 * why a steep cut smears a transient behind itself. The trade is real rather
 * than free: a linear-phase filter delays every frequency equally instead,
 * which costs latency, and rings symmetrically about a transient rather than
 * after it, which is pre-echo on sharp material.
 *
 * The construction runs an impulse through the ACTUAL cascade and linearises
 * that, rather than sampling the magnitude at the transform's bins. Frequency
 * sampling was the first attempt and it is where this went wrong: measured, a
 * Q of 8 at 50 Hz has a bandwidth of about 6 Hz, narrower than the 11.7 Hz
 * between bins at 4096 taps, so the design simply stepped over the peak and
 * built a +4.3 dB band where +9 was asked for. Published correction files do
 * use Qs that high down low, so that is not a corner case. Taking the impulse
 * response instead cannot miss a peak: it is the filter, and the only error
 * left is what falls off the end of the buffer.
 */

/**
 * 16384 taps, and the length is a measurement rather than a default.
 *
 * The whole error is truncation now, so the question is only how long the
 * cascade rings. A bell's impulse decays roughly as `Q / (pi * f)`: 9 ms for
 * the rack's own ISO bands at Q 1.4, and 51 ms for a Q of 8 down at 50 Hz,
 * which is what published correction files actually contain. Measured against
 * that band, asked for +9 dB:
 *
 *  - 8192 taps returned +6.12, and the skirts either side by 1.0 to 1.6 dB.
 *  - 16384 returned +8.87, with nothing anywhere worse than 0.74 dB.
 *
 * The rack's own presets are exact to 0.00 dB at either length, so this buys
 * nothing for them and everything for an import. It costs latency — half the
 * kernel, 8192 samples or 171 ms at 48 kHz — which is a slower start to
 * playback and no more than that, because nothing here is monitored live.
 * Accuracy is the entire
 * reason to choose linear phase; a mode that quietly rebuilt a +9 dB
 * correction as +6 would be worth less than the minimum-phase filter it
 * replaced.
 *
 * It is still not unlimited. Something narrower and lower than this rings past
 * the end of even 16384, and the honest answer there is that linear phase and
 * a 6 Hz band at 50 Hz are close to incompatible at any latency a player
 * should have.
 */
export const KERNEL_SIZE = 16_384;

/** Half the kernel: the delay every frequency is shifted by, in samples. */
export const KERNEL_LATENCY = KERNEL_SIZE / 2;

/**
 * Everything the mode delays by, in milliseconds at a given rate.
 *
 * The kernel's own half-length plus the convolver's block buffering, which are
 * two separate numbers in two separate modules and are only meaningful added
 * together. Shown on the control rather than kept in a comment: a mode that
 * quietly puts the sound a fifth of a second behind the transport should say
 * so before it is chosen, not after somebody notices the karaoke drifting.
 */
export const LINEAR_PHASE_LATENCY = KERNEL_LATENCY + CONVOLVER_LATENCY;

export const linearPhaseLatencyMs = (sampleRate: number): number =>
  Math.round((LINEAR_PHASE_LATENCY / sampleRate) * 1_000);

/**
 * The rack's own impulse response — the exact thing the bands do, in time.
 *
 * The subsonic filter is in here for the same reason it is in the trim: it is
 * part of what the rack does, and a protective filter that switched itself off
 * when the phase mode changed would be worse than one never offered.
 *
 * At the base rate, and NOT at the oversampled design rate. The impulse is a
 * base-rate buffer, so coefficients designed for twice that would place every
 * band at half the frequency asked for — a whole-rack error, silent, from one
 * word. Oversampling has nothing to offer this path anyway: it exists to move
 * a band's skirt away from where the bilinear transform squeezes it, and an
 * FIR built from an impulse response has no bilinear transform in it.
 */
const impulseResponse = (eq: IEqSettings, sampleRate: number): Float32Array => {
  const buffer = new Float32Array(KERNEL_SIZE);
  buffer[0] = 1;
  eq.bands
    /**
     * Static bands only, and the reacting ones are handled elsewhere.
     *
     * A kernel is a fixed filter: it is computed once from the settings and
     * convolved with everything after. A dynamic band changes what it does
     * per sample from what it hears, and no fixed kernel can express that —
     * baking one in at full strength would leave a band that was permanently
     * engaged, which is a static band with extra steps and the opposite of
     * what was asked for.
     *
     * They run after the convolution as ordinary biquads instead. That means
     * a reacting band is minimum phase while the curve around it is linear,
     * which is the trade every linear-phase equaliser with a dynamics section
     * makes: one or two bands carry a phase shift, and the shape the other
     * thirteen make does not.
     */
    .filter((band) => band.enabled && !band.dynamic)
    .forEach((band) => {
      processBiquad(
        createBiquadState(),
        buffer,
        biquadCoefficients(
          {
            type: band.type as FilterTypeEnum,
            frequency: band.frequency,
            gainDb: band.gainDb,
            quality: band.quality,
          },
          sampleRate,
          eq.model,
          eq.modelAmount,
        ),
      );
    });
  if (eq.subsonicHz > 0) {
    processBiquad(
      createBiquadState(),
      buffer,
      biquadCoefficients(
        {
          type: FilterTypeEnum.HPQ,
          frequency: eq.subsonicHz,
          gainDb: 0,
          quality: 0.707,
        },
        sampleRate,
        eq.model,
      ),
    );
  }
  return buffer;
};

/**
 * A linear-phase impulse response for the rack as it currently stands.
 *
 * Built in the renderer and posted to the worklet rather than built there: it
 * costs two transforms and only changes when a setting does, whereas the audio
 * thread has 128 samples of budget per callback and must never be the place a
 * kernel is computed.
 *
 * Deliberately unwindowed. A window was the first thing tried and it is pure
 * loss here: measured against a +6 dB band at 80 Hz, Blackman over 4096 taps
 * returned +5.36 and Hann +5.55, while no window at all returned +5.99. There
 * is no sharp spectral edge for a window to tame — the magnitude being
 * transformed is a sum of biquad responses and is smooth by construction — so
 * all a window does is attenuate the tail of a real impulse response.
 */
export const buildLinearPhaseKernel = (
  eq: IEqSettings,
  sampleRate: number,
): Float32Array => {
  const impulse = impulseResponse(eq, sampleRate);
  const real = new Float64Array(KERNEL_SIZE);
  const imaginary = new Float64Array(KERNEL_SIZE);
  real.set(impulse);

  fftInPlace(real, imaginary, false);

  // Throw the phase away and keep the magnitude. Real and symmetric going in,
  // so what comes back out of the inverse transform is real and symmetric too
  // — which is the definition of linear phase, not an approximation of it.
  for (let bin = 0; bin < KERNEL_SIZE; bin += 1) {
    real[bin] = Math.hypot(real[bin], imaginary[bin]);
    imaginary[bin] = 0;
  }

  fftInPlace(real, imaginary, true);

  // The inverse transform leaves the 1/N to the caller, and the impulse it
  // produces is centred on sample 0 with its second half wrapped to the end.
  // Rotating by half puts the centre in the middle, which is both what makes
  // the filter causal and where every sample of the latency comes from.
  const half = KERNEL_SIZE / 2;
  const kernel = new Float32Array(KERNEL_SIZE);
  for (let i = 0; i < KERNEL_SIZE; i += 1) {
    kernel[i] = real[(i + half) % KERNEL_SIZE] / KERNEL_SIZE;
  }
  return kernel;
};
