/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DYNAMICS_DEFAULTS,
  DYNAMICS_RANGES,
  IDynamicsBand,
  IDynamicsSettings,
} from '../../common/dsp/dynamicsStage';
import type { TranslationKey } from '../../common/i18n/en';
import { useTranslation } from '../utils/I18nContext';
import { Dial } from './DspControls';

interface IProps {
  dynamics: IDynamicsSettings;
  onPatch: (next: IDynamicsSettings) => void;
  onCommit: () => void;
}

const BANDS: readonly { title: TranslationKey; hint: TranslationKey }[] = [
  { title: 'dsp.dynamics.band.low', hint: 'dsp.dynamics.band.lowHint' },
  { title: 'dsp.dynamics.band.mid', hint: 'dsp.dynamics.band.midHint' },
  { title: 'dsp.dynamics.band.high', hint: 'dsp.dynamics.band.highHint' },
];

/** The card and Help share the same controls; the drawing has no saved profiles or audio side effects. */
export default function DspDynamicsControls({
  dynamics,
  onPatch,
  onCommit,
}: IProps) {
  const { t } = useTranslation();
  const isOff = !dynamics.enabled;
  const r = DYNAMICS_RANGES;
  /** A sound edit stops a profile being that profile. */
  const patch = (next: Partial<IDynamicsSettings>) =>
    onPatch({ ...dynamics, ...next, presetId: '' });
  const patchBand = (index: number, next: Partial<IDynamicsBand>) => {
    const bands: IDynamicsSettings['bands'] = [
      dynamics.bands[0],
      dynamics.bands[1],
      dynamics.bands[2],
    ];
    bands[index] = { ...bands[index], ...next };
    patch({ bands });
  };
  const neutral = DYNAMICS_DEFAULTS.bands[0];

  return (
    <div className="dsp-dynamics-bands">
      {BANDS.map((meta, index) => {
        const band = dynamics.bands[index];
        return (
          <section
            key={meta.title}
            className={`dsp-band dsp-dynamics-band is-band-${index}`}
          >
            <div className="dsp-band-head">
              <span className="dsp-band-title">{t(meta.title)}</span>
            </div>
            <p className="dsp-band-hint">{t(meta.hint)}</p>
            <span className="dsp-dynamics-side">{t('dsp.dynamics.lift')}</span>
            <div className="dsp-band-dials">
              <Dial
                labelKey="dsp.dynamics.upThreshold"
                value={band.upThresholdDb}
                defaultValue={neutral.upThresholdDb}
                min={r.upThresholdDb.min}
                max={r.upThresholdDb.max}
                unit="dB"
                step={1}
                isDisabled={isOff}
                onCommit={onCommit}
                onChange={(upThresholdDb) =>
                  patchBand(index, { upThresholdDb })
                }
              />
              <Dial
                labelKey="dsp.dynamics.upRatio"
                value={band.upRatio}
                defaultValue={neutral.upRatio}
                min={r.upRatio.min}
                max={r.upRatio.max}
                unit=":1"
                step={0.1}
                isDisabled={isOff}
                onCommit={onCommit}
                onChange={(upRatio) => patchBand(index, { upRatio })}
              />
              <Dial
                labelKey="dsp.dynamics.upMax"
                value={band.upMaxDb}
                defaultValue={neutral.upMaxDb}
                min={r.upMaxDb.min}
                max={r.upMaxDb.max}
                unit="dB"
                step={0.5}
                isDisabled={isOff}
                onCommit={onCommit}
                onChange={(upMaxDb) => patchBand(index, { upMaxDb })}
              />
            </div>
            <span className="dsp-dynamics-side">{t('dsp.dynamics.hold')}</span>
            <div className="dsp-band-dials">
              <Dial
                labelKey="dsp.dynamics.downThreshold"
                value={band.downThresholdDb}
                defaultValue={neutral.downThresholdDb}
                min={r.downThresholdDb.min}
                max={r.downThresholdDb.max}
                unit="dB"
                step={1}
                isDisabled={isOff}
                onCommit={onCommit}
                onChange={(downThresholdDb) =>
                  patchBand(index, { downThresholdDb })
                }
              />
              <Dial
                labelKey="dsp.dynamics.downRatio"
                value={band.downRatio}
                defaultValue={neutral.downRatio}
                min={r.downRatio.min}
                max={r.downRatio.max}
                unit=":1"
                step={0.1}
                isDisabled={isOff}
                onCommit={onCommit}
                onChange={(downRatio) => patchBand(index, { downRatio })}
              />
            </div>
          </section>
        );
      })}

      <section className="dsp-band dsp-dynamics-timing">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.dynamics.timing')}</span>
        </div>
        <p className="dsp-band-hint">{t('dsp.dynamics.timingHint')}</p>
        <div className="dsp-band-dials">
          <Dial
            labelKey="dsp.dynamics.attack"
            value={dynamics.attackMs}
            defaultValue={DYNAMICS_DEFAULTS.attackMs}
            min={r.attackMs.min}
            max={r.attackMs.max}
            unit="ms"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(attackMs) => patch({ attackMs })}
          />
          <Dial
            labelKey="dsp.dynamics.release"
            value={dynamics.releaseMs}
            defaultValue={DYNAMICS_DEFAULTS.releaseMs}
            min={r.releaseMs.min}
            max={r.releaseMs.max}
            unit="ms"
            step={5}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(releaseMs) => patch({ releaseMs })}
          />
          <Dial
            labelKey="dsp.dynamics.makeup"
            value={dynamics.makeupDb}
            defaultValue={DYNAMICS_DEFAULTS.makeupDb}
            min={r.makeupDb.min}
            max={r.makeupDb.max}
            unit="dB"
            step={0.1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(makeupDb) => patch({ makeupDb })}
          />
          <Dial
            labelKey="dsp.dynamics.mix"
            value={Math.round(dynamics.mix * 100)}
            defaultValue={100}
            min={0}
            max={100}
            unit="%"
            step={1}
            isDisabled={isOff}
            onCommit={onCommit}
            onChange={(percent) => patch({ mix: percent / 100 })}
          />
        </div>
      </section>
    </div>
  );
}
