/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TEqEngine } from '../../common/dsp/chain';
import { IBiquadCoefficients, IBiquadState, processBiquad } from './biquad';
import { IOversamplerState, downsample, upsample } from './oversample';
import { IBandDynamics, bandDynamicAmount } from './dynamics';

/**
 * How the bands are put against the audio, which is a separate question from
 * what shape each band is.
 *
 * **Serial** is a cascade: the first band filters the signal, the second
 * filters the first one's output, and so on. Every band therefore inherits the
 * phase shift of every band before it, and those shifts accumulate. Where two
 * bands overlap the interaction depends on their order in the chain, and a
 * curve built from many overlapping bands ends up smeared in a way the
 * magnitude plot does not show at all. It is the cheapest arrangement and it is
 * what almost every digital EQ does.
 *
 * **Parallel** filters the ORIGINAL signal with every band independently and
 * adds what each one changed. No band hears another band's phase, the result
 * does not depend on their order, and overlapping bands sum rather than
 * compound. It is the arrangement passive and inductor-based hardware falls
 * into by construction, and it is why those units keep their focus with a lot
 * of bands running.
 *
 * The magnitude curves are close but NOT identical — overlapping bands add
 * differently than they multiply — and the phase behaviour is entirely
 * different. That difference is the whole reason to offer the choice.
 */
/**
 * The bands cascaded at twice the rate.
 *
 * What this buys is real but specific. A biquad is linear, so it cannot alias
 * and gains nothing from headroom — what it gains is ROOM. The bilinear
 * transform squeezes the frequency axis as it approaches Nyquist, and a band
 * placed high loses its upper skirt against that wall: measured at 44.1 kHz, a
 * 16 kHz bell asked for +6 dB carries 0.6 dB an octave below its centre and
 * 0.03 an octave above. Run at 88.2 kHz the wall is an octave further away and
 * the band keeps its shape.
 *
 * The coefficients MUST be built for the doubled rate — that is the whole
 * mechanism, not a detail. Handing this the ordinary set would place every band
 * an octave low and be a bug rather than a mode.
 */
export const processEqOversampled = (
  states: IBiquadState[],
  coefficients: readonly IBiquadCoefficients[],
  target: Float32Array,
  /** Whichever topology was chosen. This is not a third one. */
  engine: TEqEngine,
  oversampler: IOversamplerState,
  /** 2 or 4. The three buffers below are exactly this many times as long. */
  factor: number,
  doubled: Float32Array,
  dryDoubled: Float32Array,
  wetDoubled: Float32Array,
  dynamics: readonly IBandDynamics[],
): void => {
  upsample(oversampler, target, doubled, factor);
  processEqBands(
    states,
    coefficients,
    doubled,
    engine,
    dryDoubled,
    wetDoubled,
    dynamics,
  );
  downsample(oversampler, doubled, target, factor);
};

/** Oversampled EQ with one dynamic amount applied to every stereo channel. */
export const processEqOversampledLinked = (
  states: readonly IBiquadState[][],
  coefficients: readonly IBiquadCoefficients[],
  targets: readonly Float32Array[],
  engine: TEqEngine,
  oversamplers: readonly IOversamplerState[],
  factor: number,
  doubled: readonly Float32Array[],
  dryDoubled: readonly Float32Array[],
  wetDoubled: readonly Float32Array[],
  dynamics: readonly IBandDynamics[],
): void => {
  const channels = Math.min(
    states.length,
    targets.length,
    oversamplers.length,
    doubled.length,
  );
  for (let channel = 0; channel < channels; channel += 1) {
    upsample(oversamplers[channel], targets[channel], doubled[channel], factor);
  }
  processEqBandsLinked(
    states,
    coefficients,
    doubled,
    engine,
    dryDoubled,
    wetDoubled,
    dynamics,
    channels,
  );
  for (let channel = 0; channel < channels; channel += 1) {
    downsample(
      oversamplers[channel],
      doubled[channel],
      targets[channel],
      factor,
    );
  }
};

export const processEqBands = (
  states: IBiquadState[],
  coefficients: readonly IBiquadCoefficients[],
  target: Float32Array,
  engine: TEqEngine,
  /** Scratch the length of `target`. Supplied by the caller so the audio
   * thread never allocates. */
  dry: Float32Array,
  wet: Float32Array,
  /** One per band, in the same order. Static bands cost nothing here. */
  dynamics: readonly IBandDynamics[],
): void => {
  const { length } = target;

  if (engine === 'serial') {
    for (let band = 0; band < coefficients.length; band += 1) {
      const dynamic = dynamics[band];
      if (!dynamic?.active) {
        // Untouched from before dynamics existed: a static band in a cascade
        // filters in place, with no copy and no envelope.
        processBiquad(states[band], target, coefficients[band]);
      } else {
        // A dynamic band in a cascade needs its own input kept, because what
        // is blended is this band's change against what reached it — the
        // previous band's output, not the signal that entered the rack.
        for (let i = 0; i < length; i += 1) {
          dry[i] = target[i];
          wet[i] = target[i];
        }
        processBiquad(states[band], wet, coefficients[band]);
        let peak = 0;
        for (let i = 0; i < length; i += 1) {
          const difference = wet[i] - dry[i];
          const amount = bandDynamicAmount(dynamic, difference);
          target[i] = dry[i] + difference * amount;
          peak = amount > peak ? amount : peak;
        }
        dynamic.amount = peak;
      }
    }
    return;
  }

  for (let i = 0; i < length; i += 1) {
    dry[i] = target[i];
  }
  for (let band = 0; band < coefficients.length; band += 1) {
    for (let i = 0; i < length; i += 1) {
      wet[i] = dry[i];
    }
    processBiquad(states[band], wet, coefficients[band]);
    const dynamic = dynamics[band];
    if (!dynamic?.active) {
      // Only what this band CHANGED is added. Summing the bands themselves
      // would stack one copy of the dry signal per band and come out N times
      // too loud.
      for (let i = 0; i < length; i += 1) {
        target[i] += wet[i] - dry[i];
      }
    } else {
      // The same difference, scaled by how much of the band the material is
      // currently asking for. Parallel needs no extra buffer for this: the
      // difference the dynamic stage works on is the one already being summed.
      let peak = 0;
      for (let i = 0; i < length; i += 1) {
        const difference = wet[i] - dry[i];
        const amount = bandDynamicAmount(dynamic, difference);
        target[i] += difference * amount;
        peak = amount > peak ? amount : peak;
      }
      dynamic.amount = peak;
    }
  }
};

/**
 * Process a stereo-domain EQ with one exact dynamic trajectory per band.
 *
 * Filter histories remain channel-local, but each dynamic detector listens to
 * the loudest channel and its amount is applied to every channel at the same
 * sample. Static bands remain ordinary matched L/R filters. This prevents a
 * dynamic cut or boost from pulling a centred source sideways.
 */
export const processEqBandsLinked = (
  states: readonly IBiquadState[][],
  coefficients: readonly IBiquadCoefficients[],
  targets: readonly Float32Array[],
  engine: TEqEngine,
  dry: readonly Float32Array[],
  wet: readonly Float32Array[],
  dynamics: readonly IBandDynamics[],
  requestedChannels: number = targets.length,
): void => {
  const channels = Math.min(
    requestedChannels,
    states.length,
    targets.length,
    dry.length,
    wet.length,
  );
  const length = targets[0]?.length ?? 0;
  if (channels === 0 || length === 0) {
    return;
  }

  if (engine === 'serial') {
    for (let band = 0; band < coefficients.length; band += 1) {
      const dynamic = dynamics[band];
      if (!dynamic?.active) {
        for (let channel = 0; channel < channels; channel += 1) {
          processBiquad(
            states[channel][band],
            targets[channel],
            coefficients[band],
          );
        }
        continue;
      }

      for (let channel = 0; channel < channels; channel += 1) {
        dry[channel].set(targets[channel]);
        wet[channel].set(targets[channel]);
        processBiquad(states[channel][band], wet[channel], coefficients[band]);
      }
      let peak = 0;
      for (let frame = 0; frame < length; frame += 1) {
        let detectorDifference = 0;
        for (let channel = 0; channel < channels; channel += 1) {
          const difference = wet[channel][frame] - dry[channel][frame];
          if (Math.abs(difference) > Math.abs(detectorDifference)) {
            detectorDifference = difference;
          }
        }
        const amount = bandDynamicAmount(dynamic, detectorDifference);
        for (let channel = 0; channel < channels; channel += 1) {
          targets[channel][frame] =
            dry[channel][frame] +
            (wet[channel][frame] - dry[channel][frame]) * amount;
        }
        peak = amount > peak ? amount : peak;
      }
      dynamic.amount = peak;
    }
    return;
  }

  for (let channel = 0; channel < channels; channel += 1) {
    dry[channel].set(targets[channel]);
  }
  for (let band = 0; band < coefficients.length; band += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      wet[channel].set(dry[channel]);
      processBiquad(states[channel][band], wet[channel], coefficients[band]);
    }
    const dynamic = dynamics[band];
    if (!dynamic?.active) {
      for (let channel = 0; channel < channels; channel += 1) {
        for (let frame = 0; frame < length; frame += 1) {
          targets[channel][frame] += wet[channel][frame] - dry[channel][frame];
        }
      }
      continue;
    }

    let peak = 0;
    for (let frame = 0; frame < length; frame += 1) {
      let detectorDifference = 0;
      for (let channel = 0; channel < channels; channel += 1) {
        const difference = wet[channel][frame] - dry[channel][frame];
        if (Math.abs(difference) > Math.abs(detectorDifference)) {
          detectorDifference = difference;
        }
      }
      const amount = bandDynamicAmount(dynamic, detectorDifference);
      for (let channel = 0; channel < channels; channel += 1) {
        targets[channel][frame] +=
          (wet[channel][frame] - dry[channel][frame]) * amount;
      }
      peak = amount > peak ? amount : peak;
    }
    dynamic.amount = peak;
  }
};
