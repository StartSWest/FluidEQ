/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';

/**
 * A game curve's shape on a profile's card: its fifteen bands (`gameCurves.ts`,
 * the canonical rack's 32 Hz to 16 kHz) on a log axis from 20 Hz to 20 kHz,
 * over the 0 dB line, lifts filled above it and cuts below. Not a graph to
 * read values from — the Curve part in the Lab is that — but enough to tell
 * Competitive's 2-8 kHz rise from Story's bass at a glance.
 */
const BANDS_HZ = [
  32, 50, 80, 125, 200, 315, 500, 800, 1250, 2000, 3150, 5000, 8000, 12500,
  16000,
];
const WIDTH = 240;
const HEIGHT = 48;
/**
 * ±5 dB fills the height, one scale for every card so two curves compare
 * as drawn: the game curves reach -4.3 to +3.7 dB (Battle royale). A curve
 * that reaches further widens its own scale rather than leave the card.
 */
const LEAST_RANGE_DB = 5;

const xOf = (hz: number): number =>
  (Math.log10(hz / 20) / Math.log10(20000 / 20)) * WIDTH;

interface IGamingProfileCurveProps {
  gains: readonly number[];
}

const GamingProfileCurve = ({ gains }: IGamingProfileCurveProps) => {
  // React's ids carry colons, which a `url(#…)` reference does not take.
  const id = useId().replace(/:/g, '');
  const range = Math.max(
    LEAST_RANGE_DB,
    ...gains.map((gain) => Math.abs(gain) + 0.5),
  );
  const yOf = (db: number): number =>
    HEIGHT / 2 - (db / range) * (HEIGHT / 2 - 2);
  // Held flat past the first and last band to the axis's ends, then a
  // smooth line through every band: a cubic through each pair's midpoints.
  const points: [number, number][] = [
    [0, yOf(gains[0] ?? 0)],
    ...BANDS_HZ.map((hz, band): [number, number] => [
      xOf(hz),
      yOf(gains[band] ?? 0),
    ]),
    [WIDTH, yOf(gains[gains.length - 1] ?? 0)],
  ];
  const line = points.reduce((path, [x, y], index) => {
    if (index === 0) {
      return `M${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const [px, py] = points[index - 1];
    const mx = (px + x) / 2;
    return `${path} C${mx.toFixed(1)} ${py.toFixed(1)} ${mx.toFixed(1)} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');
  const zero = yOf(0);
  const area = `${line} L${WIDTH} ${zero.toFixed(1)} L0 ${zero.toFixed(1)} Z`;

  return (
    <svg
      className="gaming-profile__curve"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
          <stop offset="0.5" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.32" />
        </linearGradient>
      </defs>
      <line
        className="gaming-profile__curve-zero"
        x1="0"
        x2={WIDTH}
        y1={zero}
        y2={zero}
        vectorEffect="non-scaling-stroke"
      />
      <path d={area} fill={`url(#${id}-fill)`} stroke="none" />
      <path
        className="gaming-profile__curve-line"
        d={line}
        fill="none"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default GamingProfileCurve;
