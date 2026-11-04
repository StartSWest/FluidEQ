/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDynamicsSettings } from '../../common/dsp/dynamicsStage';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import dynamicsGainDb from './dynamicsCurve';
import DspDynamicsSpectrum from './DspDynamicsSpectrum';

/** Input and output, dBFS of the band: the range a game or a record uses. */
const LOW_DB = -70;
const HIGH_DB = 0;
const WIDTH = 480;
const HEIGHT = 240;
const PAD = { left: 36, right: 12, top: 12, bottom: 24 };
const STEP_DB = 0.5;

const x = (db: number) =>
  PAD.left +
  ((db - LOW_DB) / (HIGH_DB - LOW_DB)) * (WIDTH - PAD.left - PAD.right);
const y = (db: number) =>
  PAD.top +
  (1 -
    (Math.min(Math.max(db, LOW_DB), HIGH_DB) - LOW_DB) / (HIGH_DB - LOW_DB)) *
    (HEIGHT - PAD.top - PAD.bottom);

const BAND_KEYS: readonly TranslationKey[] = [
  'dsp.dynamics.band.low',
  'dsp.dynamics.band.mid',
  'dsp.dynamics.band.high',
];

/**
 * What each band does to its level: input on the bottom, output up the side,
 * the diagonal where nothing is changed. Above it a band is lifted, under it
 * held. Drawn from `dynamicsGainDb`, the engine's own curve, with the make-up
 * on top, so it is the curve that plays — steady levels, the timing aside.
 */
const DspDynamicsGraph = ({ dynamics }: { dynamics: IDynamicsSettings }) => {
  const { t } = useTranslation();
  const curve = (band: IDynamicsSettings['bands'][number]): string => {
    const points: string[] = [];
    for (let db = LOW_DB; db <= HIGH_DB + 1e-9; db += STEP_DB) {
      const gain = dynamicsGainDb(band, db) + dynamics.makeupDb;
      // The engine blends amplitudes, so Mix 0 is the unity diagonal even
      // with compression and make-up configured on the unused wet signal.
      const out =
        db +
        20 * Math.log10(1 - dynamics.mix + dynamics.mix * 10 ** (gain / 20));
      points.push(`${x(db).toFixed(1)},${y(out).toFixed(1)}`);
    }
    return points.join(' ');
  };
  const grid: number[] = [];
  for (let db = LOW_DB; db <= HIGH_DB; db += 10) {
    grid.push(db);
  }
  return (
    <figure
      className={`dsp-dynamics-graph${dynamics.enabled ? '' : ' is-off'}`}
      aria-label={t('dsp.dynamics.graphLabel')}
    >
      <DspDynamicsSpectrum />
      <svg
        className="dsp-dynamics-transfer"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
      >
        {grid.map((db) => (
          <g key={db}>
            <line
              className="dsp-dynamics-grid"
              x1={x(db)}
              x2={x(db)}
              y1={y(HIGH_DB)}
              y2={y(LOW_DB)}
            />
            <line
              className="dsp-dynamics-grid"
              x1={x(LOW_DB)}
              x2={x(HIGH_DB)}
              y1={y(db)}
              y2={y(db)}
            />
            <text
              className="dsp-dynamics-tick"
              x={PAD.left - 6}
              y={y(db) + 3}
              textAnchor="end"
            >
              {db}
            </text>
          </g>
        ))}
        <line
          className="dsp-dynamics-unity"
          x1={x(LOW_DB)}
          y1={y(LOW_DB)}
          x2={x(HIGH_DB)}
          y2={y(HIGH_DB)}
        />
        {dynamics.bands.map((band, index) => (
          <polyline
            key={BAND_KEYS[index]}
            className={`dsp-dynamics-curve is-band-${index}`}
            points={curve(band)}
          />
        ))}
        <text
          className="dsp-dynamics-axis"
          x={x(HIGH_DB)}
          y={HEIGHT - 6}
          textAnchor="end"
        >
          {t('dsp.dynamics.graphIn')}
        </text>
        <text className="dsp-dynamics-axis" x={PAD.left + 4} y={PAD.top + 10}>
          {t('dsp.dynamics.graphOut')}
        </text>
      </svg>
      <figcaption className="dsp-dynamics-key">
        {BAND_KEYS.map((key, index) => (
          <span key={key} className={`dsp-dynamics-key-item is-band-${index}`}>
            {t(key)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};

export default DspDynamicsGraph;
