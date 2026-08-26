/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DSP_DEFAULTS, IMasterSettings } from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import Switch from '../widgets/Switch';
import { Dial, ProcessorCard } from './DspControls';
import DspMasterGraph from './DspMasterGraph';
import { OUTPUT_SAFETY_SOFT_KNEE_DB } from './outputSafety';
import { IDspOutputSafetyMeter } from './store';

const IS_DEV = process.env.NODE_ENV !== 'production';

const meterDb = (value: number): string =>
  value <= -119.5 ? '≤−120 dB' : `${value.toFixed(1)} dB`;

const meterDbfs = (value: number): string =>
  value <= -119.5 ? '≤−120 dBFS' : `${value.toFixed(1)} dBFS`;

interface IDspMasterCardProps {
  master: IMasterSettings;
  meter: IDspOutputSafetyMeter;
  safetyEnabled: boolean;
  loudnessGainDb: number;
  onSafetyToggle: () => void;
  onPatch: (next: IMasterSettings) => void;
  onCommit: () => void;
}

/** The transparent output boundary, deliberately last in the visible chain. */
const DspMasterCard = ({
  master,
  meter,
  safetyEnabled,
  loudnessGainDb,
  onSafetyToggle,
  onPatch,
  onCommit,
}: IDspMasterCardProps) => {
  const { t } = useTranslation();
  const usesSelectedHeadroom = master.autoHeadroom || master.loudnessMaximize;
  const effectiveCeiling = usesSelectedHeadroom ? master.ceilingDb : 0;
  const effectiveKnee = usesSelectedHeadroom ? OUTPUT_SAFETY_SOFT_KNEE_DB : 0;
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
    master.enabled && usesSelectedHeadroom ? projectedHeadroomInputDb : -120,
    safetyEnabled ? meter.inputTruePeakDb : -120,
  );

  return (
    <ProcessorCard
      id="dsp-master"
      titleKey="dsp.master.title"
      descriptionKey="dsp.master.description"
      isEnabled={master.enabled}
      onToggle={() => {
        onPatch({ ...master, enabled: !master.enabled });
        onCommit();
      }}
    >
      <DspMasterGraph
        master={master}
        meter={meter}
        safetyEnabled={safetyEnabled}
        loudnessGainDb={loudnessGainDb}
      />
      <div className="dsp-crossovers">
        <Dial
          labelKey="dsp.master.outputTrim"
          value={master.outputTrimDb}
          defaultValue={DSP_DEFAULTS.master.outputTrimDb}
          min={-24}
          max={6}
          unit="dB"
          step={0.1}
          isDisabled={!master.enabled}
          onCommit={onCommit}
          onChange={(outputTrimDb) => onPatch({ ...master, outputTrimDb })}
        />
        <Dial
          labelKey="dsp.master.ceiling"
          value={master.ceilingDb}
          defaultValue={DSP_DEFAULTS.master.ceilingDb}
          min={-12}
          max={-0.1}
          unit="dBTP"
          step={0.1}
          isDisabled={!master.enabled || !master.autoHeadroom}
          onCommit={onCommit}
          onChange={(ceilingDb) => onPatch({ ...master, ceilingDb })}
        />
        <Dial
          labelKey="dsp.master.release"
          value={master.releaseMs}
          defaultValue={DSP_DEFAULTS.master.releaseMs}
          min={4_000}
          max={12_000}
          unit="ms"
          step={500}
          isDisabled={!master.enabled || !usesSelectedHeadroom}
          onCommit={onCommit}
          onChange={(releaseMs) => onPatch({ ...master, releaseMs })}
        />
        <Dial
          labelKey="dsp.master.loudnessTarget"
          value={master.loudnessTargetLufs}
          defaultValue={DSP_DEFAULTS.master.loudnessTargetLufs}
          min={-18}
          max={-6}
          unit="LUFS"
          step={0.5}
          isDisabled={!master.enabled || !master.loudnessMaximize}
          onCommit={onCommit}
          onChange={(loudnessTargetLufs) =>
            onPatch({ ...master, loudnessTargetLufs })
          }
        />
      </div>

      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {t('dsp.master.loudnessMaximize')}
          </span>
          <Switch
            id="dsp-master-loudness-maximize"
            isOn={master.loudnessMaximize}
            isDisabled={!master.enabled}
            handleToggle={() => {
              onPatch({
                ...master,
                loudnessMaximize: !master.loudnessMaximize,
                autoHeadroom: master.loudnessMaximize
                  ? master.autoHeadroom
                  : true,
              });
              onCommit();
            }}
            ariaLabel={t('dsp.master.loudnessMaximize')}
          />
        </div>
        <p className="dsp-band-hint">
          {t('dsp.master.loudnessMaximizeHint', {
            gain: loudnessGainDb.toFixed(1),
          })}
        </p>
      </div>

      <div className="dsp-band">
        <div className="dsp-band-head">
          <span className="dsp-band-title">{t('dsp.master.autoHeadroom')}</span>
          <Switch
            id="dsp-master-auto-headroom"
            isOn={master.autoHeadroom || master.loudnessMaximize}
            isDisabled={!master.enabled || master.loudnessMaximize}
            handleToggle={() => {
              onPatch({ ...master, autoHeadroom: !master.autoHeadroom });
              onCommit();
            }}
            ariaLabel={t('dsp.master.autoHeadroom')}
          />
        </div>
        <p className="dsp-band-hint">{t('dsp.master.autoHeadroomHint')}</p>
      </div>

      <div className="dsp-band">
        <span className="dsp-band-title">{t('dsp.master.meter')}</span>
        <p className="dsp-band-hint">
          {master.enabled && usesSelectedHeadroom
            ? t('dsp.master.safetyHint', {
                factor: meter.truePeakFactor,
                ceiling: effectiveCeiling.toFixed(1),
                knee: effectiveKnee.toFixed(1),
              })
            : t('dsp.master.manualHint')}
        </p>
        <div className="dsp-level-meters" aria-live="polite">
          <span>
            {t('dsp.master.truePeak')} {meterDb(displayedTruePeakDb)}
          </span>
          <span>
            {t('dsp.master.autoHeadroom')} {meterDb(autoGainReductionDb)}
          </span>
          <span>
            {t('dsp.master.graph.safetyActive')}{' '}
            {meterDb(safetyGainReductionDb)}
          </span>
        </div>
      </div>

      {IS_DEV ? (
        <div
          className={`dsp-band dsp-dev-safety${
            safetyEnabled ? ' is-on' : ' is-off'
          }${totalGainReductionDb < -0.05 ? ' is-reducing' : ''}`}
        >
          <div className="dsp-band-head">
            <div className="dsp-dev-safety-control">
              <span className="dsp-band-title">
                {t('dsp.master.devSafety')}
              </span>
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
              {t('dsp.master.graph.safetyActive')}{' '}
              {meterDb(safetyGainReductionDb)}
            </span>
            <span>
              {t('dsp.master.dcCorrection')} {meterDbfs(meter.dcCorrectionDb)}
            </span>
            <span>
              {t('dsp.master.faults')} {meter.repairedSamples}
            </span>
          </span>
        </div>
      ) : undefined}
    </ProcessorCard>
  );
};

export default DspMasterCard;
