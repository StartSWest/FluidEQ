/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { ReactNode } from 'react';
import { CURVE_FREQUENCY_LABELS, ICurveBox, curveScales } from './curvePreview';
import '../styles/EqCurveChart.scss';

export interface IEqCurveLine {
  id: string;
  /** The `d` attribute, from `makePath`. */
  path: string;
  /** Applied on top of the base line class, for weight, dashes or opacity. */
  className?: string;
  stroke: string;
}

interface IEqCurveChartProps {
  box: ICurveBox;
  bounds: { min: number; max: number };
  lines: IEqCurveLine[];
  ariaLabel: string;
  className?: string;
  /** Gradient or filter definitions the lines refer to by id. */
  defs?: ReactNode;
}

/**
 * A layer's response, drawn small.
 *
 * Grid at the two bounds and at zero, decade labels along the bottom, and one
 * path per line the caller hands over. The scales come from `curveScales`, the
 * same function that placed the points, so the zero line is where zero is
 * rather than near it.
 *
 * The caller keeps the colours: an import preview and an applied correction are
 * different things to look at, and only the panel showing them knows which.
 */
export default function EqCurveChart({
  box,
  bounds,
  lines,
  ariaLabel,
  className,
  defs,
}: IEqCurveChartProps) {
  const { x, y } = curveScales(box, bounds);

  return (
    <svg
      className={`eq-curve-chart${className ? ` ${className}` : ''}`}
      viewBox={`0 0 ${box.width} ${box.height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {defs && <defs>{defs}</defs>}
      {[bounds.min, 0, bounds.max].map((gain) => (
        <line
          key={gain}
          x1={box.padding.left}
          x2={box.width - box.padding.right}
          y1={y(gain)}
          y2={y(gain)}
          className="eq-curve-chart__grid"
        />
      ))}
      {lines.map((line) => (
        <path
          key={line.id}
          d={line.path}
          className={`eq-curve-chart__line${
            line.className ? ` ${line.className}` : ''
          }`}
          fill="none"
          stroke={line.stroke}
        />
      ))}
      {CURVE_FREQUENCY_LABELS.map((entry) => (
        <text
          key={entry.value}
          x={x(entry.value)}
          y={box.height - 6}
          className="eq-curve-chart__axis"
          textAnchor="middle"
        >
          {entry.label}
        </text>
      ))}
    </svg>
  );
}
