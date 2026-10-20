/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each band's response along the DSP EQ's curve, worked out once per edit.
 *
 * The graph draws every frame the screen does — at 144 or 240 Hz as readily
 * as 60 — and the filter maths is the expensive part of a frame: every band
 * at every plotted point, four trig calls and two square roots each. It only
 * changes when a band, the rate or the Treble choice does, so it is kept
 * here and the frame only adds the columns up (Ivan, 2026-10-17: "really
 * smooth no limit ... but performance at the same time").
 */
import { FilterTypeEnum } from '../../common/constants';
import { IEqSettings } from '../../common/dsp/chain';
import {
  biquadCoefficients,
  biquadMagnitudeDb,
  IBiquadCoefficients,
} from './biquad';
import { MAX_HZ, MIN_HZ, toSpec } from './dspEqGraphScale';

export interface IEqResponses {
  /** The plotted frequencies, `steps + 1` of them, log-spaced. */
  hz: Float64Array;
  /** Each band's dB at those points; undefined for a band switched off. */
  bands: (Float64Array | undefined)[];
  /** The subsonic high pass's dB, when there is one. */
  subsonic?: Float64Array;
}

interface ICacheKey {
  eq: IEqSettings;
  sampleRate: number;
  matched: boolean;
  steps: number;
}

const along = (
  coefficients: IBiquadCoefficients,
  hz: Float64Array,
  sampleRate: number,
): Float64Array =>
  hz.map((frequency) => biquadMagnitudeDb(coefficients, frequency, sampleRate));

/** The responses, remade only when what they depend on changes. */
export const createEqResponses = () => {
  let key: ICacheKey | undefined;
  let held: IEqResponses | undefined;
  return (
    eq: IEqSettings,
    sampleRate: number,
    matched: boolean,
    steps: number,
  ): IEqResponses => {
    if (
      held &&
      key &&
      key.eq === eq &&
      key.sampleRate === sampleRate &&
      key.matched === matched &&
      key.steps === steps
    ) {
      return held;
    }
    /**
     * The rate the filters are actually BUILT at, not the session's.
     *
     * With oversampling on, the worklet designs every band for the doubled
     * or quadrupled rate. Drawing them at the session rate showed a curve
     * that was not the one being heard — the difference lives near Nyquist,
     * which is exactly where oversampling is meant to help, so the graph was
     * hiding the very thing the control does. Linear phase is designed at
     * the base rate whatever the oversampling control says, so the curve is
     * drawn there too.
     */
    const designRate =
      eq.phase === 'linear'
        ? sampleRate
        : sampleRate * Math.max(1, eq.oversample);
    const hz = new Float64Array(steps + 1);
    for (let i = 0; i <= steps; i += 1) {
      hz[i] = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / steps);
    }
    // Audible and, until it was drawn, invisible: the subsonic high pass runs
    // ahead of the bands and shaped the sound without appearing on the curve.
    const subsonic =
      eq.subsonicHz > 0
        ? along(
            biquadCoefficients(
              {
                type: FilterTypeEnum.HPQ,
                frequency: eq.subsonicHz,
                gainDb: 0,
                quality: 0.707,
              },
              sampleRate,
            ),
            hz,
            sampleRate,
          )
        : undefined;
    held = {
      hz,
      bands: eq.bands.map((band) =>
        band.enabled
          ? along(
              biquadCoefficients(
                toSpec(band),
                designRate,
                eq.model,
                eq.modelAmount,
                matched,
              ),
              hz,
              designRate,
            )
          : undefined,
      ),
      subsonic,
    };
    key = { eq, sampleRate, matched, steps };
    return held;
  };
};
