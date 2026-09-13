/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Normalizer page's live readings, each subscribed where it is drawn.
 *
 * The engine publishes these with every host frame, a hundred times a second.
 * Read once at the top of `DspNormalizerCard`, they re-rendered the whole
 * page on each frame — the mode switch, both dials and every label — to move
 * two bars and a handful of numbers. Here only the readings themselves redraw.
 */

import { ILibraryNormalizationAnalysis } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { useDspNormalizerMeter } from './store';

const LIVE_STATES = [
  'dsp.normalizer.off',
  'dsp.normalizer.livePeak',
  'dsp.normalizer.learning',
  'dsp.normalizer.holding',
  'dsp.normalizer.liveLeveling',
  'dsp.normalizer.liveLimited',
] as const;

const peakDb = (value: number) =>
  value > 0.000001 ? 20 * Math.log10(value) : -120;

const meterWidth = (value: number) =>
  `${Math.max(0, Math.min(100, ((peakDb(value) + 60) / 66) * 100))}%`;

const analysisValue = (value: number | undefined, unit: string) =>
  value === undefined ? '—' : `${value.toFixed(1)} ${unit}`;

/** What the engine's leveller is doing right now, under the FluidEQ Engine. */
export const DspNormalizerLiveState = () => {
  const { t } = useTranslation();
  const { levelState } = useDspNormalizerMeter();
  return levelState === undefined ? null : (
    <>{t(LIVE_STATES[levelState] ?? 'dsp.normalizer.learning')}</>
  );
};

interface IDspNormalizerStatsProps {
  isLive: boolean;
  analysis: ILibraryNormalizationAnalysis | undefined;
}

/** Peak, loudness and the gain applied: measured live, or from the analysis. */
export const DspNormalizerStats = ({
  isLive,
  analysis,
}: IDspNormalizerStatsProps) => {
  const { t } = useTranslation();
  const liveMeter = useDspNormalizerMeter();
  return (
    <dl className="dsp-normalizer-stats">
      <div>
        <dt>{t('dsp.normalizer.measuredPeak')}</dt>
        <dd>
          {analysisValue(
            isLive ? liveMeter.inputTruePeakDb : analysis?.truePeakDbtp,
            'dBTP',
          )}
        </dd>
      </div>
      <div>
        <dt>
          {t(
            isLive
              ? 'dsp.normalizer.shortTerm'
              : 'dsp.normalizer.measuredLoudness',
          )}
        </dt>
        <dd>
          {analysisValue(
            isLive ? liveMeter.inputLufs : analysis?.integratedLufs,
            'LUFS',
          )}
        </dd>
      </div>
      <div>
        <dt>{t('dsp.normalizer.appliedGain')}</dt>
        <dd>{analysisValue(liveMeter.appliedGainDb, 'dB')}</dd>
      </div>
    </dl>
  );
};

/** The before and after bars for both channels. */
export const DspNormalizerLiveMeter = () => {
  const { t } = useTranslation();
  const liveMeter = useDspNormalizerMeter();
  return (
    <section className="dsp-normalizer-live">
      <div className="dsp-band-head">
        <span className="dsp-band-title">{t('dsp.normalizer.liveMeter')}</span>
        <span className="dsp-dev-safety-spec">
          {liveMeter.appliedGainDb.toFixed(1)} dB
        </span>
      </div>
      <div className="dsp-normalizer-meter" aria-live="off">
        {(['L', 'R'] as const).map((channel, channelIndex) => (
          <div className="dsp-normalizer-meter-channel" key={channel}>
            <span className="dsp-normalizer-meter-channel-name">{channel}</span>
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
  );
};
