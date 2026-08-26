/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  DSP_DEFAULTS,
  IInputNormalizerSettings,
  TNormalizerMode,
} from '../../common/dsp/chain';
import { useTranslation } from '../utils/I18nContext';
import { Dial, ProcessorCard } from './DspControls';
import { normalizerGainDb } from './inputNormalizer';
import { IDspInputAnalysisState, useDspNormalizerMeter } from './store';

interface IDspNormalizerCardProps {
  normalizer: IInputNormalizerSettings;
  analysisState: IDspInputAnalysisState;
  onPatch: (next: IInputNormalizerSettings) => void;
  onCommit: () => void;
}

const MODES: readonly {
  mode: TNormalizerMode;
  label:
    | 'dsp.normalizer.off'
    | 'dsp.normalizer.truePeak'
    | 'dsp.normalizer.loudness';
}[] = [
  { mode: 'off', label: 'dsp.normalizer.off' },
  { mode: 'truePeak', label: 'dsp.normalizer.truePeak' },
  { mode: 'loudness', label: 'dsp.normalizer.loudness' },
];

const DspNormalizerCard = ({
  normalizer,
  analysisState,
  onPatch,
  onCommit,
}: IDspNormalizerCardProps) => {
  const { t } = useTranslation();
  const { analysis } = analysisState;
  const liveMeter = useDspNormalizerMeter();
  const appliedGain = normalizerGainDb(normalizer, analysis);
  const enabled = normalizer.mode !== 'off';
  const peakDb = (value: number) =>
    value > 0.000001 ? 20 * Math.log10(value) : -120;
  const meterWidth = (value: number) =>
    `${Math.max(0, Math.min(100, ((peakDb(value) + 60) / 66) * 100))}%`;

  const selectMode = (mode: TNormalizerMode) => {
    onPatch({ ...normalizer, mode });
    onCommit();
  };

  return (
    <ProcessorCard
      id="dsp-normalizer"
      titleKey="dsp.normalizer.title"
      descriptionKey="dsp.normalizer.description"
      isEnabled={enabled}
      onToggle={() => selectMode(enabled ? 'off' : 'truePeak')}
    >
      <div className="dsp-crossovers">
        <div
          className="segmented"
          role="group"
          aria-label={t('dsp.normalizer.mode')}
        >
          {MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className={`segmented__option${
                normalizer.mode === mode ? ' is-selected' : ''
              }`}
              aria-pressed={normalizer.mode === mode}
              onClick={() => selectMode(mode)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <Dial
          labelKey="dsp.normalizer.ceiling"
          value={normalizer.truePeakDbtp}
          defaultValue={DSP_DEFAULTS.normalizer.truePeakDbtp}
          min={-12}
          max={-0.1}
          unit="dBTP"
          step={0.1}
          isDisabled={!enabled}
          onCommit={onCommit}
          onChange={(truePeakDbtp) => onPatch({ ...normalizer, truePeakDbtp })}
        />
        <Dial
          labelKey="dsp.normalizer.target"
          value={normalizer.targetLufs}
          defaultValue={DSP_DEFAULTS.normalizer.targetLufs}
          min={-24}
          max={-5}
          unit="LUFS"
          step={0.5}
          isDisabled={normalizer.mode !== 'loudness'}
          onCommit={onCommit}
          onChange={(targetLufs) => onPatch({ ...normalizer, targetLufs })}
        />
      </div>

      <div className="dsp-band" aria-live="polite">
        <span className="dsp-band-title">{t('dsp.normalizer.analysis')}</span>
        {analysisState.status === 'analyzing' ? (
          <p className="dsp-band-hint">
            {t('dsp.normalizer.analyzing', {
              progress: Math.round(analysisState.fraction * 100),
            })}
          </p>
        ) : undefined}
        {analysisState.status === 'unavailable' ? (
          <p className="dsp-band-hint">{t('dsp.normalizer.unavailable')}</p>
        ) : undefined}
        {analysis ? (
          <div className="dsp-level-meters">
            <span>
              {t('dsp.normalizer.measuredPeak')}{' '}
              {analysis.truePeakDbtp.toFixed(1)} dBTP
            </span>
            <span>
              {t('dsp.normalizer.measuredLoudness')}{' '}
              {analysis.integratedLufs.toFixed(1)} LUFS
            </span>
            <span>
              {t('dsp.normalizer.appliedGain')} {appliedGain.toFixed(1)} dB
            </span>
          </div>
        ) : undefined}
        {analysisState.status === 'idle' && !analysis ? (
          <p className="dsp-band-hint">{t('dsp.normalizer.waiting')}</p>
        ) : undefined}
      </div>
      <div className="dsp-band dsp-normalizer-live">
        <div className="dsp-band-head">
          <span className="dsp-band-title">
            {t('dsp.normalizer.liveMeter')}
          </span>
          <span className="dsp-dev-safety-spec">
            {liveMeter.appliedGainDb.toFixed(1)} dB
          </span>
        </div>
        <div className="dsp-normalizer-meter" aria-live="off">
          {(['L', 'R'] as const).map((channel, channelIndex) => (
            <div className="dsp-normalizer-meter-channel" key={channel}>
              <span className="dsp-normalizer-meter-channel-name">
                {channel}
              </span>
              <div className="dsp-normalizer-meter-pair">
                <span className="dsp-normalizer-meter-name">
                  {t('dsp.normalizer.before')}
                </span>
                <span className="dsp-normalizer-meter-track">
                  <span
                    className={`dsp-normalizer-meter-fill is-before${
                      liveMeter.inputPeaks[channelIndex] > 1 ? ' is-over' : ''
                    }`}
                    style={{
                      width: meterWidth(liveMeter.inputPeaks[channelIndex]),
                    }}
                  />
                  <span className="dsp-normalizer-meter-zero" />
                </span>
                <span className="dsp-normalizer-meter-value">
                  {peakDb(liveMeter.inputPeaks[channelIndex]).toFixed(1)} dBFS
                </span>
              </div>
              <div className="dsp-normalizer-meter-pair">
                <span className="dsp-normalizer-meter-name">
                  {t('dsp.normalizer.after')}
                </span>
                <span className="dsp-normalizer-meter-track">
                  <span
                    className={`dsp-normalizer-meter-fill is-after${
                      liveMeter.outputPeaks[channelIndex] > 1 ? ' is-over' : ''
                    }`}
                    style={{
                      width: meterWidth(liveMeter.outputPeaks[channelIndex]),
                    }}
                  />
                  <span className="dsp-normalizer-meter-zero" />
                </span>
                <span className="dsp-normalizer-meter-value">
                  {peakDb(liveMeter.outputPeaks[channelIndex]).toFixed(1)} dBFS
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="dsp-band-hint">{t('dsp.normalizer.liveMeterHint')}</p>
      </div>
      <p className="dsp-band-hint">{t('dsp.normalizer.honesty')}</p>
    </ProcessorCard>
  );
};

export default DspNormalizerCard;
