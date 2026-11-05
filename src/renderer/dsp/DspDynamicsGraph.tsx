/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef } from 'react';
import type { IDynamicsSettings } from '../../common/dsp/dynamicsStage';
import { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import DspDynamicsSpectrum from './DspDynamicsSpectrum';

const BAND_KEYS: readonly TranslationKey[] = [
  'dsp.dynamics.band.low',
  'dsp.dynamics.band.mid',
  'dsp.dynamics.band.high',
];

/** Music and applied lift/hold together, all measured across this stage. */
export default function DspDynamicsGraph({
  dynamics,
}: {
  dynamics: IDynamicsSettings;
}) {
  const { t } = useTranslation();
  const readouts = useRef<(HTMLOutputElement | null)[]>([]);
  const onReading = (gains: readonly number[] | undefined) => {
    readouts.current.forEach((node, band) => {
      if (!node) {
        return;
      }
      const db = gains?.[band];
      const text =
        db === undefined
          ? '—'
          : `${Math.abs(db) < 0.05 ? '0.0' : `${db > 0 ? '+' : ''}${db.toFixed(1)}`} dB`;
      if (node.textContent !== text) {
        node.textContent = text;
      }
    });
  };
  return (
    <figure
      className={`dsp-dynamics-graph${dynamics.enabled ? '' : ' is-off'}`}
      aria-label={t('dsp.dynamics.graphLabel')}
    >
      <div className="dsp-dynamics-graph-head">
        <div className="dsp-dynamics-key">
          <span className="dsp-dynamics-key-item is-input">
            {t('dsp.eq.legend.input')}
          </span>
          <span className="dsp-dynamics-key-item is-output">
            {t('dsp.eq.legend.spectrum')}
          </span>
          <span className="dsp-dynamics-key-item is-gain">
            {t('dsp.dynamics.appliedGain')}
          </span>
        </div>
        <div className="dsp-dynamics-readouts">
          {BAND_KEYS.map((key, band) => (
            <span key={key} className={`dsp-dynamics-readout is-band-${band}`}>
              <span>{t(key)}</span>
              <output
                aria-live="off"
                aria-label={`${t(key)} · ${t('dsp.dynamics.appliedGain')}`}
                ref={(node) => {
                  readouts.current[band] = node;
                }}
              >
                —
              </output>
            </span>
          ))}
        </div>
      </div>
      <DspDynamicsSpectrum enabled={dynamics.enabled} onReading={onReading} />
      <figcaption>{t('dsp.dynamics.graphHint')}</figcaption>
    </figure>
  );
}
