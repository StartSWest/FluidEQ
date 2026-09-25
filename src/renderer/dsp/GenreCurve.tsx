/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useMemo } from 'react';
import type { IEqSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { curveGainDb } from './genreNotesModel';

const MIN_HZ = 20;
const MAX_HZ = 20_000;
/**
 * ±6 dB, where every genre curve lives: the deepest move in the catalogue is
 * Metal's -5.3 at 315 Hz. On the main graph's ±20 the same curves are a
 * ripple, and a ripple is not something anybody reads a reason off.
 */
const RANGE_DB = 6;
const POINTS = 180;
const GRID_HZ = [100, 1_000, 10_000];
const LABEL_HZ = [
  [50, '50'],
  [100, '100'],
  [200, '200'],
  [500, '500'],
  [1_000, '1k'],
  [2_000, '2k'],
  [5_000, '5k'],
  [10_000, '10k'],
] as const;
/** The scale's top, middle and bottom, with the real minus sign. */
const GAIN_LABELS = [
  [RANGE_DB, `+${RANGE_DB}`],
  [0, '0'],
  [-RANGE_DB, `−${RANGE_DB}`],
] as const;

interface IGeometry {
  width: number;
  height: number;
  pad: { left: number; right: number; top: number; bottom: number };
  toX: (hz: number) => number;
  toY: (db: number) => number;
}

const geometryOf = (
  width: number,
  height: number,
  pad: IGeometry['pad'],
): IGeometry => ({
  width,
  height,
  pad,
  toX: (hz) =>
    pad.left +
    (Math.log10(hz / MIN_HZ) / Math.log10(MAX_HZ / MIN_HZ)) *
      (width - pad.left - pad.right),
  toY: (db) =>
    pad.top +
    ((RANGE_DB - Math.max(-RANGE_DB, Math.min(RANGE_DB, db))) /
      (2 * RANGE_DB)) *
      (height - pad.top - pad.bottom),
});

/** The notes' drawing, with room for its scale down the left and along the foot. */
const LABELLED = geometryOf(520, 176, {
  left: 30,
  right: 10,
  top: 26,
  bottom: 22,
});
/** The picker preview's: the badges' headroom and nothing else. */
const BARE = geometryOf(320, 104, { left: 6, right: 6, top: 22, bottom: 6 });

interface IGenreCurveProps {
  curve: IEqSettings;
  pins: readonly number[];
  name: string;
  /**
   * With its scale and labels, for the notes; without, for the picker's
   * preview, where the list's own width is all there is.
   */
  isLabelled: boolean;
  activePin?: number;
  onPin?: (index: number | undefined) => void;
}

/**
 * A genre's curve, as the Preset layer plays it, with its pins numbered on it.
 *
 * Drawn in the preset line's own violet (`ColorEnum.TRIADIC1`, via
 * `--genre-curve`), so the curve here and the line on the main graph read as
 * the same thing, because they are.
 */
const GenreCurve = ({
  curve,
  pins,
  name,
  isLabelled,
  activePin,
  onPin,
}: IGenreCurveProps) => {
  const { t } = useTranslation();
  const geometry = isLabelled ? LABELLED : BARE;
  const { width, height, pad, toX, toY } = geometry;

  const { line, area } = useMemo(() => {
    const { toX: x, toY: y } = geometry;
    const steps: string[] = [];
    for (let i = 0; i <= POINTS; i += 1) {
      const hz = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / POINTS);
      steps.push(
        `${i === 0 ? 'M' : 'L'}${x(hz).toFixed(1)},${y(
          curveGainDb(curve, hz),
        ).toFixed(1)}`,
      );
    }
    const path = steps.join(' ');
    return {
      line: path,
      area: `${path} L${x(MAX_HZ).toFixed(1)},${y(0).toFixed(1)} L${x(
        MIN_HZ,
      ).toFixed(1)},${y(0).toFixed(1)} Z`,
    };
  }, [curve, geometry]);

  return (
    <svg
      className={`genre-curve${isLabelled ? ' is-labelled' : ''}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={t('genre.notes.curveLabel', { name })}
    >
      <g className="genre-curve__grid">
        {GRID_HZ.map((hz) => (
          <line
            key={hz}
            x1={toX(hz)}
            x2={toX(hz)}
            y1={pad.top}
            y2={height - pad.bottom}
          />
        ))}
        {[-RANGE_DB, -RANGE_DB / 2, RANGE_DB / 2, RANGE_DB].map((db) => (
          <line
            key={db}
            x1={pad.left}
            x2={width - pad.right}
            y1={toY(db)}
            y2={toY(db)}
          />
        ))}
        <line
          className="genre-curve__zero"
          x1={pad.left}
          x2={width - pad.right}
          y1={toY(0)}
          y2={toY(0)}
        />
      </g>
      {isLabelled && (
        <g className="genre-curve__labels" aria-hidden="true">
          {LABEL_HZ.map(([hz, label]) => (
            <text key={hz} x={toX(hz)} y={height - 6} textAnchor="middle">
              {label}
            </text>
          ))}
          {GAIN_LABELS.map(([db, label]) => (
            <text key={db} x={pad.left - 7} y={toY(db) + 3} textAnchor="end">
              {label}
            </text>
          ))}
        </g>
      )}
      <path className="genre-curve__area" d={area} />
      <path className="genre-curve__line" d={line} />
      {pins.map((hz, index) => {
        const x = toX(hz);
        const y = toY(curveGainDb(curve, hz));
        const isActive = index === activePin;
        return (
          <g
            key={hz}
            className={`genre-curve__pin${isActive ? ' is-active' : ''}`}
            onPointerEnter={onPin ? () => onPin(index) : undefined}
            onPointerLeave={onPin ? () => onPin(undefined) : undefined}
            aria-hidden="true"
          >
            <circle className="genre-curve__halo" cx={x} cy={y} r={9} />
            <circle className="genre-curve__dot" cx={x} cy={y} r={3.6} />
            <circle className="genre-curve__badge" cx={x} cy={y - 15} r={7} />
            <text
              x={x}
              y={y - 15}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export default GenreCurve;
