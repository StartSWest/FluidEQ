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
import { normalizerGainBreakdown, TNormalizerLimit } from './inputNormalizer';
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

/**
 * `as const` and not an annotation: `t` is typed against the literal union of
 * every shipped key, so widening these to `string` loses the one check that
 * catches a key that was never added to the locale files.
 */
const LIMIT_LABELS = {
  ceiling: 'dsp.normalizer.limitedByCeiling',
  maxGain: 'dsp.normalizer.limitedByMaxGain',
  minGain: 'dsp.normalizer.limitedByMinGain',
  gate: 'dsp.normalizer.limitedByGate',
} as const satisfies Record<Exclude<TNormalizerLimit, 'none'>, string>;

/** Signed, because the whole point is that the sign was not what was asked for. */
const signedDb = (value: number) =>
  `${value > 0 ? '+' : ''}${value.toFixed(1)} dB`;

const DspNormalizerCard = ({
  normalizer,
  analysisState,
  onPatch,
  onCommit,
}: IDspNormalizerCardProps) => {
  const { t } = useTranslation();
  const { analysis } = analysisState;
  const liveMeter = useDspNormalizerMeter();
  const gain = normalizerGainBreakdown(normalizer, analysis);
  const enabled = normalizer.mode !== 'off';
  const peakDb = (value: number) =>
    value > 0.000001 ? 20 * Math.log10(value) : -120;
  const meterWidth = (value: number) =>
    `${Math.max(0, Math.min(100, ((peakDb(value) + 60) / 66) * 100))}%`;
  const analysisValue = (value: number | undefined, unit: string) =>
    value === undefined ? '—' : `${value.toFixed(1)} ${unit}`;

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
      <div className="dsp-normalizer-dashboard">
        <section className="dsp-normalizer-control-surface">
          <span className="dsp-band-title">{t('dsp.normalizer.mode')}</span>
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
          <div className="dsp-normalizer-dials">
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
              onChange={(truePeakDbtp) =>
                onPatch({ ...normalizer, truePeakDbtp })
              }
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
        </section>

        <section className="dsp-normalizer-analysis" aria-live="polite">
          <div className="dsp-band-head">
            <span className="dsp-band-title">
              {t('dsp.normalizer.analysis')}
            </span>
            <span
              className={`dsp-normalizer-status is-${analysisState.status}`}
            >
              {analysisState.status === 'analyzing'
                ? t('dsp.normalizer.analyzing', {
                    progress: Math.round(analysisState.fraction * 100),
                  })
                : undefined}
              {analysisState.status === 'unavailable'
                ? t('dsp.normalizer.unavailable')
                : undefined}
              {analysisState.status === 'idle' && !analysis
                ? t('dsp.normalizer.waiting')
                : undefined}
              {analysisState.status === 'ready'
                ? t('dsp.normalizer.analysis')
                : undefined}
            </span>
          </div>
          <div
            className="dsp-normalizer-progress"
            role="progressbar"
            aria-label={t('dsp.normalizer.analysis')}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(analysisState.fraction * 100)}
          >
            <span style={{ width: `${analysisState.fraction * 100}%` }} />
          </div>
          <dl className="dsp-normalizer-stats">
            <div>
              <dt>{t('dsp.normalizer.measuredPeak')}</dt>
              <dd>{analysisValue(analysis?.truePeakDbtp, 'dBTP')}</dd>
            </div>
            <div>
              <dt>{t('dsp.normalizer.measuredLoudness')}</dt>
              <dd>{analysisValue(analysis?.integratedLufs, 'LUFS')}</dd>
            </div>
            <div>
              <dt>{t('dsp.normalizer.appliedGain')}</dt>
              <dd>
                {analysisValue(analysis ? gain.appliedDb : undefined, 'dB')}
              </dd>
            </div>
          </dl>
          {/* Under all three numbers, because it is the sentence that
              reconciles them. A loudness target asking for a boost on a track
              already at the rails is answered with attenuation, and both dials
              beside it still read as obeyed — so the control that actually won
              is named rather than left to be inferred. */}
          {analysis && gain.limitedBy !== 'none' ? (
            <p className="dsp-band-hint dsp-normalizer-limit">
              {t(LIMIT_LABELS[gain.limitedBy], {
                requested: signedDb(gain.requestedDb),
              })}
            </p>
          ) : null}
        </section>
      </div>

      <section className="dsp-normalizer-live">
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
      </section>
      <p className="dsp-band-hint dsp-normalizer-honesty">
        {t('dsp.normalizer.honesty')}
      </p>
    </ProcessorCard>
  );
};

export default DspNormalizerCard;
