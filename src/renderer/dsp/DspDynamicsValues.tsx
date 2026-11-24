/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_RANGES,
  type IDynamicsBand,
} from '../../common/dsp/dynamicsStage';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsCell from './DspDynamicsCell';
import { bandHolds, bandLifts } from './dynamicsCurve';

interface IProps {
  band: IDynamicsBand;
  bandName: string;
  isDisabled: boolean;
  onBand: (next: IDynamicsBand) => void;
  onCommit: () => void;
}

/** Whole decibels as whole numbers, a half step with its half. */
const decimalsOf = (value: number) => (Number.isInteger(value) ? 0 : 1);

/**
 * A band's five numbers as a small table: the lift's start, ratio and most,
 * the hold's start and ratio — the same values the points move, for when
 * the value wanted is an exact one. A half of the band that does nothing
 * shows its numbers dashed and faint, still there to be typed into.
 */
const DspDynamicsValues = ({
  band,
  bandName,
  isDisabled,
  onBand,
  onCommit,
}: IProps) => {
  const { t } = useTranslation();
  const r = DYNAMICS_RANGES;
  const lifts = bandLifts(band);
  const holds = bandHolds(band);
  const lift = t('dsp.dynamics.lift');
  const hold = t('dsp.dynamics.hold');
  const cell = (
    side: string,
    name: string,
    field: keyof IDynamicsBand,
    unit: string,
    step: number,
    isIdle: boolean,
  ) => (
    <DspDynamicsCell
      label={`${bandName} · ${side} · ${name}`}
      value={band[field]}
      unit={unit}
      min={r[field].min}
      max={r[field].max}
      step={step}
      decimals={field.endsWith('Ratio') ? 1 : decimalsOf(band[field])}
      isIdle={isIdle}
      isDisabled={isDisabled}
      onValue={(next) => onBand({ ...band, [field]: next })}
      onCommit={onCommit}
    />
  );
  return (
    <div className="dsp-dynamics-values">
      <span aria-hidden="true" />
      <span className="dsp-dynamics-values__column" aria-hidden="true">
        {t('dsp.dynamics.table.starts')}
      </span>
      <span className="dsp-dynamics-values__column" aria-hidden="true">
        {t('dsp.dynamics.upRatio')}
      </span>
      <span className="dsp-dynamics-values__column" aria-hidden="true">
        {t('dsp.dynamics.table.atMost')}
      </span>

      <span className="dsp-dynamics-values__side">
        {t('dsp.dynamics.table.liftUnder')}
      </span>
      {cell(
        lift,
        t('dsp.dynamics.upThreshold'),
        'upThresholdDb',
        'dB',
        1,
        !lifts,
      )}
      {cell(lift, t('dsp.dynamics.upRatio'), 'upRatio', ':1', 0.1, !lifts)}
      {cell(lift, t('dsp.dynamics.upMax'), 'upMaxDb', 'dB', 0.5, !lifts)}

      <span className="dsp-dynamics-values__side">
        {t('dsp.dynamics.table.holdOver')}
      </span>
      {cell(
        hold,
        t('dsp.dynamics.downThreshold'),
        'downThresholdDb',
        'dB',
        1,
        !holds,
      )}
      {cell(hold, t('dsp.dynamics.downRatio'), 'downRatio', ':1', 0.1, !holds)}
      <span className="dsp-dynamics-values__none" aria-hidden="true">
        —
      </span>
    </div>
  );
};

export default DspDynamicsValues;
