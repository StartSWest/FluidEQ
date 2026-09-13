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
import {
  DspNormalizerLiveMeter,
  DspNormalizerLiveState,
  DspNormalizerStats,
} from './DspNormalizerReadouts';
import { normalizerGainBreakdown, TNormalizerLimit } from './inputNormalizer';
import { IDspInputAnalysisState } from './store';
import { useRackGate } from './rackPlacement';

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

const LIVE_MODES = {
  off: 'dsp.normalizer.off',
  truePeak: 'dsp.normalizer.livePeak',
  loudness: 'dsp.normalizer.liveLeveling',
} as const;

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
  const gate = useRackGate();
  const isLive = gate.engine === 'fluid' && !gate.libraryAudible;
  // The live meter is not read here: see `DspNormalizerReadouts`.
  const gain = normalizerGainBreakdown(normalizer, analysis);
  const enabled = normalizer.mode !== 'off';

  const selectMode = (mode: TNormalizerMode) => {
    onPatch({ ...normalizer, mode });
    onCommit();
  };

  return (
    <ProcessorCard
      id="dsp-normalizer"
      titleKey={isLive ? 'dsp.normalizer.liveTitle' : 'dsp.normalizer.title'}
      descriptionKey={
        isLive ? 'dsp.normalizer.liveDescription' : 'dsp.normalizer.description'
      }
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
                {t(isLive ? LIVE_MODES[mode] : label)}
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
              {t(
                isLive
                  ? 'dsp.normalizer.liveAnalysis'
                  : 'dsp.normalizer.analysis',
              )}
            </span>
            <span
              className={`dsp-normalizer-status is-${analysisState.status}`}
            >
              {isLive ? <DspNormalizerLiveState /> : undefined}
              {!isLive && analysisState.status === 'analyzing'
                ? t('dsp.normalizer.analyzing', {
                    progress: Math.round(analysisState.fraction * 100),
                  })
                : undefined}
              {!isLive && analysisState.status === 'unavailable'
                ? t('dsp.normalizer.unavailable')
                : undefined}
              {!isLive && analysisState.status === 'idle' && !analysis
                ? t('dsp.normalizer.waiting')
                : undefined}
              {!isLive && analysisState.status === 'ready'
                ? t('dsp.normalizer.analysis')
                : undefined}
            </span>
          </div>
          {!isLive && (
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
          )}
          <DspNormalizerStats isLive={isLive} analysis={analysis} />
          {/* Under all three numbers, because it is the sentence that
              reconciles them. A loudness target asking for a boost on a track
              already at the rails is answered with attenuation, and both dials
              beside it still read as obeyed — so the control that actually won
              is named rather than left to be inferred. */}
          {!isLive && analysis && gain.limitedBy !== 'none' ? (
            <p className="dsp-band-hint dsp-normalizer-limit">
              {t(LIMIT_LABELS[gain.limitedBy], {
                requested: signedDb(gain.requestedDb),
              })}
            </p>
          ) : null}
        </section>
      </div>

      <DspNormalizerLiveMeter />
      <p className="dsp-band-hint dsp-normalizer-honesty">
        {t(isLive ? 'dsp.normalizer.liveGuidance' : 'dsp.normalizer.honesty')}
      </p>
    </ProcessorCard>
  );
};

export default DspNormalizerCard;
