/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useMemo } from 'react';
import type { IDynamicsBand } from '../../common/dsp/dynamicsStage';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsLiveMarks from './DspDynamicsLiveMarks';
import DspDynamicsPoints from './DspDynamicsPoints';
import { bandHolds, bandLifts } from './dynamicsCurve';
import { dynamicsCurveShape } from './dynamicsCurvePaths';
import { PLOT_LOW_DB, meterY, type IDynamicsPlot } from './dynamicsPlot';
import type { IDynamicsBus } from './useDynamicsLive';

interface IProps {
  index: number;
  band: IDynamicsBand;
  makeupDb: number;
  mix: number;
  plot: IDynamicsPlot;
  bandName: string;
  isDisabled: boolean;
  bus: IDynamicsBus;
  onBand: (next: IDynamicsBand) => void;
  onCommit: () => void;
}

const GRID_DB = [-60, -40, -20] as const;
const TICKS_DB = [-60, -40, -20, 0] as const;
/** A tick this near a threshold's own label gives way to it. */
const CROWDED_DB = 9;
const METER_TICKS_DB = [-6, 6] as const;

const label = (db: number) => `${db}`;

/**
 * One band's curve: level in across, level out up, the line of unity
 * dashed, and the curve the band plays — the ground it lifts filled, the
 * ground it holds down hatched — with its points to drag and its live dot
 * riding it. The gain meter stands beside the square: up a lift, down a hold.
 */
const DspDynamicsCurve = ({
  index,
  band,
  makeupDb,
  mix,
  plot,
  bandName,
  isDisabled,
  bus,
  onBand,
  onCommit,
}: IProps) => {
  const { t } = useTranslation();
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const shape = useMemo(
    () => dynamicsCurveShape(band, makeupDb, mix, plot),
    [band, makeupDb, mix, plot],
  );
  const { x, y, left, top, size } = plot;
  const bottom = top + size;
  const lifts = bandLifts(band);
  const holds = bandHolds(band);
  const guides = [
    ...(lifts ? [band.upThresholdDb] : []),
    ...(holds ? [band.downThresholdDb] : []),
  ];
  const hatch = `dsp-dynamics-hatch-${id}`;
  const clip = `dsp-dynamics-clip-${id}`;

  return (
    <svg
      className={`dsp-dynamics-curve is-band-${index}`}
      width={plot.width}
      height={plot.height}
      viewBox={`0 0 ${plot.width} ${plot.height}`}
      role="group"
      aria-label={`${bandName} · ${t('dsp.dynamics.graphLabel')}`}
    >
      <defs>
        <pattern
          id={hatch}
          width="5"
          height="5"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect className="dsp-dynamics-hatch__ground" width="5" height="5" />
          <line
            className="dsp-dynamics-hatch__line"
            x1="0"
            y1="0"
            x2="0"
            y2="5"
          />
        </pattern>
        <clipPath id={clip}>
          <rect x={left} y={top} width={size} height={size} />
        </clipPath>
      </defs>

      <g aria-hidden="true">
        <rect
          className="dsp-dynamics-curve__frame"
          x={left + 0.5}
          y={top + 0.5}
          width={size - 1}
          height={size - 1}
          rx="4"
        />
        {GRID_DB.map((db) => (
          <g key={db} className="dsp-dynamics-curve__grid">
            <line x1={x(db)} y1={top} x2={x(db)} y2={bottom} />
            <line x1={left} y1={y(db)} x2={left + size} y2={y(db)} />
          </g>
        ))}
        <line
          className="dsp-dynamics-curve__unity"
          x1={x(PLOT_LOW_DB)}
          y1={y(PLOT_LOW_DB)}
          x2={x(0)}
          y2={y(0)}
        />
        <g clipPath={`url(#${clip})`}>
          <path className="dsp-dynamics-curve__body" d={shape.body} />
          {shape.lifted.map((d) => (
            <path key={d} className="dsp-dynamics-curve__lifted" d={d} />
          ))}
          {shape.held.map((d) => (
            <path key={d} d={d} fill={`url(#${hatch})`} />
          ))}
          {shape.setting ? (
            <path className="dsp-dynamics-curve__setting" d={shape.setting} />
          ) : null}
        </g>

        {guides.map((db) => (
          <g key={`guide${db}`} className="dsp-dynamics-curve__guide">
            <line x1={x(db)} y1={y(db)} x2={x(db)} y2={bottom} />
            <text x={x(db)} y={bottom + 14} textAnchor="middle">
              {label(db)}
            </text>
          </g>
        ))}
        {TICKS_DB.filter(
          (db) => !guides.some((guide) => Math.abs(guide - db) < CROWDED_DB),
        ).map((db) => (
          <text
            key={`in${db}`}
            className="dsp-dynamics-curve__tick"
            x={x(db)}
            y={bottom + 14}
            textAnchor="middle"
          >
            {label(db)}
          </text>
        ))}
        {TICKS_DB.map((db) => (
          <text
            key={`out${db}`}
            className="dsp-dynamics-curve__tick"
            x={left - 5}
            y={y(db) + 3}
            textAnchor="end"
          >
            {label(db)}
          </text>
        ))}
        <text
          className="dsp-dynamics-curve__axis"
          x={left + size - 4}
          y={bottom - 6}
          textAnchor="end"
        >
          {t('dsp.dynamics.axisIn')}
        </text>
        <text className="dsp-dynamics-curve__axis" x={left + 5} y={top + 13}>
          {t('dsp.dynamics.axisOut')}
        </text>

        <path
          className="dsp-dynamics-curve__line"
          d={shape.line}
          clipPath={`url(#${clip})`}
        />

        <rect
          className="dsp-dynamics-meter__frame"
          x={plot.meterX + 0.5}
          y={top + 0.5}
          width={plot.meterWidth - 1}
          height={size - 1}
          rx="3"
        />
        {METER_TICKS_DB.map((db) => (
          <line
            key={db}
            className="dsp-dynamics-meter__tick"
            x1={plot.meterX}
            y1={meterY(plot, db)}
            x2={plot.meterX + plot.meterWidth}
            y2={meterY(plot, db)}
          />
        ))}
        <line
          className="dsp-dynamics-meter__zero"
          x1={plot.meterX - 2}
          y1={meterY(plot, 0)}
          x2={plot.meterX + plot.meterWidth + 2}
          y2={meterY(plot, 0)}
        />
        <text
          className="dsp-dynamics-curve__tick"
          x={plot.meterX + plot.meterWidth / 2}
          y={top - 2}
          textAnchor="middle"
        >
          +
        </text>
        <text
          className="dsp-dynamics-curve__tick"
          x={plot.meterX + plot.meterWidth / 2}
          y={bottom + 14}
          textAnchor="middle"
        >
          −
        </text>
      </g>

      <DspDynamicsLiveMarks index={index} plot={plot} bus={bus} />
      <DspDynamicsPoints
        band={band}
        plot={plot}
        bandName={bandName}
        isDisabled={isDisabled}
        onBand={onBand}
        onCommit={onCommit}
      />
    </svg>
  );
};

export default DspDynamicsCurve;
