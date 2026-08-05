/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <FluidEQ multiple-output contributors>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { AutoEqFormat, IFilter, IState } from 'common/constants';
import { getDriverFilters } from 'common/driver';
import { getTFCoefficients } from 'common/response';
import { getSmartEqFilters } from 'common/smartEq';
import { getVoicingFilters } from 'common/voicing';

/** Everything the maths needs; the layers produce this without an id. */
export type TMirrorFilter = Pick<
  IFilter,
  'type' | 'frequency' | 'gain' | 'quality'
>;

/**
 * The mirror's own equaliser: a second engine, in Web Audio, beside APO.
 *
 * It exists because the captured audio has **already been corrected by APO for
 * the primary device**. Sending that to a different speaker is worse than
 * sending nothing, since a correction built for one driver is actively wrong
 * on another — so the mirror strips nothing and simply applies the profile
 * belonging to the device it is feeding.
 *
 * Two implementations of the same equaliser is a liability, and the way it is
 * kept honest is that only one of them derives anything. `getTFCoefficients`
 * in `src/common/response` is the single source of the band maths: APO's file,
 * the response graph and this chain all come from it. Anything else — most
 * temptingly `BiquadFilterNode`, which takes a type, a frequency and a Q and
 * looks like exactly the right tool — computes its own coefficients using
 * Chromium's derivation, which is close to ours but not identical. Close is
 * what produces a graph that disagrees with the speaker, and a disagreement
 * nobody can explain is worse than an honest difference.
 *
 * Hence `IIRFilterNode`, which takes the coefficients themselves and applies
 * them literally.
 */

export interface IMirrorEqChain {
  /** Feed the audio in here. */
  input: AudioNode;
  /** Take it out here. Identical to `input` when there is nothing to do. */
  output: AudioNode;
  /** Release every node. The caller disconnects the ends. */
  dispose(): void;
}

/** Chromium refuses an IIR filter whose coefficients are not finite. */
const isUsable = (values: number[]): boolean =>
  values.every((value) => Number.isFinite(value));

/**
 * Build the chain for one device's profile.
 *
 * `preAmp` is applied as a plain gain in front, exactly as APO's `Preamp:` is,
 * so a boosted chain has the same headroom reserved on both paths.
 *
 * The context's **own** sample rate is what the coefficients are built at, not
 * the response graph's nominal 96 kHz. Windows commonly runs an endpoint at
 * 48 kHz, and coefficients made at twice the rate they run at put every band
 * an octave low — which would be audible, wrong, and very hard to attribute.
 */
/**
 * Every filter a device's profile contributes, in the order APO writes them.
 *
 * The user's bands first, then voicing, then driver compensation, then Smart
 * EQ — the same sequence as `stateToString`. Cascaded biquads multiply, so the
 * order does not change the magnitude response, but keeping it identical means
 * the two paths can be compared line by line when they ever disagree.
 *
 * Two things are deliberately absent, and a profile using either is mirrored
 * without it:
 *
 * - **GraphicEQ.** A `GraphicEQ:` profile writes no filters at all; it is an
 *   arbitrary curve, and reproducing one faithfully needs an FIR rather than a
 *   handful of biquads.
 * - **Convolution.** `ConvolverNode` could carry it, but the impulse response
 *   lives in a WAV written for APO, and fetching and decoding it per mirror is
 *   its own piece of work rather than a line here.
 */
export const getMirrorFilters = (
  // Only the layers, so a caller holding these fields loose — the live editing
  // context hands them out individually — can ask without rebuilding a whole
  // IState around them.
  state: Pick<
    IState,
    'eqFormat' | 'graphicEq' | 'filters' | 'voicing' | 'driver' | 'smartEq'
  >,
): TMirrorFilter[] => {
  // A GraphicEQ profile keeps its curve in `graphicEq` and leaves `filters`
  // as whatever editable projection existed; using those would apply a
  // fragment of a curve, which is worse than applying none of it.
  if (state.eqFormat === AutoEqFormat.GRAPHIC && state.graphicEq?.length) {
    return [];
  }
  return [
    ...Object.values(state.filters ?? {}),
    ...getVoicingFilters(state.voicing),
    ...getDriverFilters(state.driver),
    ...getSmartEqFilters(state.smartEq),
  ];
};

export const createMirrorEqChain = (
  context: BaseAudioContext,
  filters: TMirrorFilter[],
  preAmp: number,
): IMirrorEqChain => {
  const nodes: AudioNode[] = [];

  const input = context.createGain();
  input.gain.value = 10 ** (preAmp / 20);
  nodes.push(input);

  let output: AudioNode = input;

  filters.forEach((filter) => {
    const { b0, b1, b2, a1, a2 } = getTFCoefficients(
      filter,
      context.sampleRate,
    );
    const feedforward = [b0, b1, b2];
    // a0 is divided out by `getTFCoefficients`, so it is 1 here by
    // construction. Web Audio wants it stated anyway.
    const feedback = [1, a1, a2];
    if (!isUsable(feedforward) || !isUsable(feedback)) {
      // A band can be degenerate — zero quality, or a frequency at or above
      // Nyquist for this rate. Skipping it keeps the rest of the chain
      // audible, where letting Chromium throw would silence the whole mirror
      // over one bad band.
      return;
    }
    const node = context.createIIRFilter(feedforward, feedback);
    output.connect(node);
    output = node;
    nodes.push(node);
  });

  return {
    input,
    output,
    dispose: () => {
      nodes.forEach((node) => node.disconnect());
      nodes.length = 0;
    },
  };
};
