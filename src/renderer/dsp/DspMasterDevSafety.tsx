/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IMasterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { useDspOutputSafetyMeter } from './store';

const meterDb = (value: number): string =>
  value <= -119.5 ? '≤−120 dB' : `${value.toFixed(1)} dB`;

const meterDbfs = (value: number): string =>
  value <= -119.5 ? '≤−120 dBFS' : `${value.toFixed(1)} dBFS`;

interface IDspMasterDevSafetyProps {
  master: IMasterSettings;
  safetyEnabled: boolean;
  loudnessGainDb: number;
  onSafetyToggle: () => void;
}

/**
 * The development-only A/B for the output guard, with its five live readings.
 *
 * Its own component because those readings change with every host frame. As
 * part of `DspMasterCard` they re-rendered the whole Master page — five dials,
 * three switches and the preset bar — a hundred times a second to update five
 * numbers in one corner of it.
 */
const DspMasterDevSafety = ({
  master,
  safetyEnabled,
  loudnessGainDb,
  onSafetyToggle,
}: IDspMasterDevSafetyProps) => {
  const { t } = useTranslation();
  const meter = useDspOutputSafetyMeter();
  const autoGainReductionDb = meter.postFilterNormalizer.gainReductionDb;
  const safetyGainReductionDb = safetyEnabled ? meter.gainReductionDb : 0;
  const totalGainReductionDb = autoGainReductionDb + safetyGainReductionDb;
  const projectedHeadroomInputDb =
    meter.postFilterNormalizer.inputTruePeakDb <= -119.5
      ? -120
      : meter.postFilterNormalizer.inputTruePeakDb +
        master.outputTrimDb +
        loudnessGainDb;
  const displayedTruePeakDb = Math.max(
    master.enabled && master.loudnessMaximize ? projectedHeadroomInputDb : -120,
    safetyEnabled ? meter.inputTruePeakDb : -120,
  );

  return (
    <div
      className={`dsp-band dsp-dev-safety${
        safetyEnabled ? ' is-on' : ' is-off'
      }${totalGainReductionDb < -0.05 ? ' is-reducing' : ''}`}
    >
      <div className="dsp-band-head">
        <div className="dsp-dev-safety-control">
          <span className="dsp-band-title">{t('dsp.master.devSafety')}</span>
          <span className="dsp-dev-safety-state">
            {safetyEnabled ? t('dsp.enabled') : t('dsp.bypassed')}
          </span>
        </div>
        <Switch
          id="dsp-dev-output-safety"
          isOn={safetyEnabled}
          isDisabled={false}
          handleToggle={onSafetyToggle}
          ariaLabel={t('dsp.master.devSafety')}
        />
      </div>
      <p className="dsp-band-hint">{t('dsp.master.devSafetyHint')}</p>
      <span className="dsp-dev-safety-spec">
        {t('dsp.master.devSafetySpec')}
      </span>
      <span className="dsp-level-meters" aria-live="polite">
        <span>
          {t('dsp.master.truePeak')} {meterDb(displayedTruePeakDb)}
        </span>
        <span>
          {t('dsp.master.autoHeadroom')} {meterDb(autoGainReductionDb)}
        </span>
        <span>
          {t('dsp.master.graph.safetyActive')} {meterDb(safetyGainReductionDb)}
        </span>
        <span>
          {t('dsp.master.dcCorrection')} {meterDbfs(meter.dcCorrectionDb)}
        </span>
        <span>
          {t('dsp.master.faults')} {meter.repairedSamples}
        </span>
      </span>
    </div>
  );
};

export default DspMasterDevSafety;
