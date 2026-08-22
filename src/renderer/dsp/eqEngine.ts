/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TEqEngine } from '../../common/dsp/chain';
import { IBiquadCoefficients, IBiquadState, processBiquad } from './biquad';

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
export const processEqBands = (
  states: IBiquadState[],
  coefficients: readonly IBiquadCoefficients[],
  target: Float32Array,
  engine: TEqEngine,
  /** Scratch the length of `target`. Supplied by the caller so the audio
   * thread never allocates. */
  dry: Float32Array,
  wet: Float32Array,
): void => {
  if (engine === 'serial') {
    for (let band = 0; band < coefficients.length; band += 1) {
      processBiquad(states[band], target, coefficients[band]);
    }
    return;
  }

  const { length } = target;
  for (let i = 0; i < length; i += 1) {
    dry[i] = target[i];
  }
  for (let band = 0; band < coefficients.length; band += 1) {
    for (let i = 0; i < length; i += 1) {
      wet[i] = dry[i];
    }
    processBiquad(states[band], wet, coefficients[band]);
    // Only what this band CHANGED is added. Summing the bands themselves would
    // stack one copy of the dry signal per band and come out N times too loud.
    for (let i = 0; i < length; i += 1) {
      target[i] += wet[i] - dry[i];
    }
  }
};
