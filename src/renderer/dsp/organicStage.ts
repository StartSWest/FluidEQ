/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { FilterTypeEnum } from '../../common/constants';
import { IOrganicSettings, organicRangeQ } from '../../common/dsp/chain';
import {
  IBiquadCoefficients,
  IBiquadState,
  biquadCoefficients,
  createBiquadState,
  processBiquad,
} from './biquad';
import {
  IOrganicState,
  ORGANIC_FOUNDATION_GAIN,
  createOrganicState,
  organicBlock,
  resetOrganicTransient,
} from './organic';
import {
  IExciterGuardState,
  createExciterGuard,
  guardExciterReturn,
  organicSibilanceProtection,
} from './exciterGuard';

const DC_POLE = 0.9974;

interface IDcState {
  x: number;
  y: number;
}

export interface IOrganicPathState {
  filter: IBiquadState;
  coefficients: IBiquadCoefficients;
  focusHz: number;
  quality: number;
  sampleRate: number;
  shaper: IOrganicState;
  band: Float32Array;
  foundation: Float32Array;
  dc: IDcState;
  guard: IExciterGuardState;
}

const identity: IBiquadCoefficients = {
  b0: 1,
  b1: 0,
  b2: 0,
  a1: 0,
  a2: 0,
};

export const createOrganicPath = (blockSize: number): IOrganicPathState => ({
  filter: createBiquadState(),
  coefficients: identity,
  focusHz: 0,
  quality: 0,
  sampleRate: 0,
  shaper: createOrganicState(blockSize),
  band: new Float32Array(blockSize),
  foundation: new Float32Array(blockSize),
  dc: { x: 0, y: 0 },
  guard: createExciterGuard(),
});

export const resetOrganicPathTransient = (state: IOrganicPathState): void =>
  resetOrganicTransient(state.shaper);

const blockDc = (state: IDcState, buffer: Float32Array): void => {
  for (let i = 0; i < buffer.length; i += 1) {
    const x = buffer[i];
    const y = x - state.x + DC_POLE * state.y;
    state.x = x;
    state.y = y;
    buffer[i] = y;
  }
};

/**
 * Build Organic's complete excited sidechain return.
 *
 * Filtering, phase shift, the continuous foundation, harmonic creation and the
 * frequency-dependent guard all happen in this path. Isolate therefore plays
 * exactly the signal the normal path adds, with no external carrier layer.
 */
export const runOrganicPath = (
  state: IOrganicPathState,
  source: Float32Array,
  settings: IOrganicSettings,
  amount: number,
  sampleRate: number,
): Float32Array => {
  if (state.band.length !== source.length) {
    state.band = new Float32Array(source.length);
    state.foundation = new Float32Array(source.length);
  }
  state.band.set(source);

  const quality = organicRangeQ(settings.range);
  if (
    state.focusHz !== settings.focusHz ||
    state.quality !== quality ||
    state.sampleRate !== sampleRate
  ) {
    state.focusHz = settings.focusHz;
    state.quality = quality;
    state.sampleRate = sampleRate;
    state.coefficients = biquadCoefficients(
      {
        type: FilterTypeEnum.BP,
        frequency: settings.focusHz,
        gainDb: 0,
        quality,
      },
      sampleRate,
    );
  }

  processBiquad(state.filter, state.band, state.coefficients);
  state.foundation.set(state.band);
  organicBlock(state.shaper, state.band, amount, sampleRate);
  blockDc(state.dc, state.band);
  for (let sample = 0; sample < state.band.length; sample += 1) {
    state.band[sample] += state.foundation[sample] * ORGANIC_FOUNDATION_GAIN;
  }
  guardExciterReturn(
    state.guard,
    state.band,
    sampleRate,
    organicSibilanceProtection(settings.focusHz),
  );
  return state.band;
};
