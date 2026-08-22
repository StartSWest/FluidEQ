/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import { FilterTypeEnum } from '../../common/constants';
import { IEqSettings } from '../../common/dsp/chain';
import { biquadCoefficients, biquadMagnitudeDb } from './biquad';

/** The band the curve is drawn over, and the octave marks under it. */
const MIN_HZ = 20;
const MAX_HZ = 20_000;
const GRID_HZ = [100, 1_000, 10_000];

/** Vertical range. Wider than the +-24dB a band can reach, so a stack of
 * bands that add up still lands inside the box rather than being clipped
 * against its edge, which would read as the EQ refusing to go further. */
const RANGE_DB = 30;

const WIDTH = 640;
const HEIGHT = 132;

/** Enough points that a Q of 18 still draws as a curve rather than a spike. */
const POINTS = 320;

const toX = (hz: number): number =>
  (Math.log10(hz / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) * WIDTH;

const toY = (db: number): number => HEIGHT / 2 - (db / RANGE_DB) * (HEIGHT / 2);

interface IDspEqCurveProps {
  eq: IEqSettings;
  sampleRate: number;
}

/**
 * The combined response of every enabled band, drawn from the coefficients.
 *
 * From the coefficients and not from the parameters, which is the point: this
 * shows what the filters ARE, so the warping near Nyquist that
 * `dspBiquad.test.ts` measures is visible here rather than hidden behind an
 * idealised curve. An EQ display that draws the request rather than the result
 * is a display that lies exactly where the filter is least accurate.
 */
const DspEqCurve = ({ eq, sampleRate }: IDspEqCurveProps) => {
  const path = useMemo(() => {
    const coefficients = eq.bands
      .filter((band) => band.enabled)
      .map((band) =>
        biquadCoefficients(
          {
            type: band.type as FilterTypeEnum,
            frequency: band.frequency,
            gainDb: band.gainDb,
            quality: band.quality,
          },
          sampleRate,
          eq.model,
        ),
      );
    const steps: string[] = [];
    for (let i = 0; i <= POINTS; i += 1) {
      const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / POINTS);
      // Summed in dB because that is what cascaded filters do to a level:
      // multiply in magnitude, add in decibels.
      const db = coefficients.reduce(
        (total, one) => total + biquadMagnitudeDb(one, hz, sampleRate),
        0,
      );
      const y = Math.max(0, Math.min(HEIGHT, toY(db)));
      steps.push(`${i === 0 ? 'M' : 'L'}${toX(hz).toFixed(1)},${y.toFixed(1)}`);
    }
    return steps.join(' ');
  }, [eq, sampleRate]);

  return (
    <svg
      className="dsp-eq-curve"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <line
        className="dsp-eq-curve__zero"
        x1="0"
        x2={WIDTH}
        y1={HEIGHT / 2}
        y2={HEIGHT / 2}
      />
      {GRID_HZ.map((hz) => (
        <line
          key={hz}
          className="dsp-eq-curve__grid"
          x1={toX(hz)}
          x2={toX(hz)}
          y1="0"
          y2={HEIGHT}
        />
      ))}
      <path className="dsp-eq-curve__path" d={path} />
    </svg>
  );
};

export default DspEqCurve;
