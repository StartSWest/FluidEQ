/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode } from 'react';
import {
  KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED,
  TKaraokeMakerWhisperStage,
} from './makerAi';
import { karaokeMakerAnalysisProgress } from './makerAnalysisProgress';
import { useTranslation } from '../utils/I18nContext';
import KaraokeMakerToolIcon from './KaraokeMakerToolIcon';
import KaraokeMakerAnalysisError, {
  TKaraokeMakerAnalysisRetry,
} from './KaraokeMakerAnalysisError';

/**
 * What a run looks like while it is happening, and after it fails.
 *
 * Two panels rather than one, because a run in progress and a run that stopped
 * want opposite things from the user: the first offers a way out, the second a
 * way to try again. They came out together because neither is ever shown
 * without the other being considered.
 *
 * Both hide themselves when the lyrics dialog is open — it shows the same
 * progress inline, and two live readouts of one run disagree the moment either
 * lags.
 */
export interface IKaraokeMakerAnalysisPanelsProps {
  /** A run is in flight when this is set. */
  analysisProgress: number | undefined;
  analysisMessage: string | undefined;
  displayedAnalysisProgress: number;
  analysisProgressIsIndeterminate: boolean;
  whisperStage: TKaraokeMakerWhisperStage | undefined;
  visibleWhisperStages: ReturnType<
    typeof karaokeMakerAnalysisProgress
  >['stages'];
  cancelAnalysis: () => void;

  /** What went wrong, and which retry to offer for it. */
  analysisError: string | undefined;
  analysisRetry: TKaraokeMakerAnalysisRetry | undefined;
  retryAnalysis: (retry: TKaraokeMakerAnalysisRetry) => Promise<void>;
  dismissAnalysisError: () => void;

  /** Suppressed while the dialog shows the same run inline. */
  lyricsOpen: boolean;
  renderWhisperDownloadDetails: () => ReactNode;
}

const KaraokeMakerAnalysisPanels = ({
  analysisError,
  analysisMessage,
  analysisProgress,
  analysisProgressIsIndeterminate,
  analysisRetry,
  cancelAnalysis,
  displayedAnalysisProgress,
  dismissAnalysisError,
  lyricsOpen,
  renderWhisperDownloadDetails,
  retryAnalysis,
  visibleWhisperStages,
  whisperStage,
}: IKaraokeMakerAnalysisPanelsProps) => {
  const { t } = useTranslation();
  return (
    <>
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
        analysisProgress !== undefined &&
        !lyricsOpen && (
          <div className="karaoke-maker__analysis-progress" role="status">
            <div className="karaoke-maker__analysis-progress-copy">
              <KaraokeMakerToolIcon name="transcribe" />
              <div>
                <div className="karaoke-maker__analysis-progress-heading">
                  <strong>
                    {analysisMessage ?? t('karaoke.maker.localAnalysis')}
                  </strong>
                  {analysisProgressIsIndeterminate ? (
                    <span
                      className="karaoke-maker__analysis-activity"
                      aria-hidden="true"
                    >
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : (
                    <span>{Math.round(displayedAnalysisProgress * 100)}%</span>
                  )}
                </div>
              </div>
            </div>
            {renderWhisperDownloadDetails()}
            {whisperStage && (
              <ol
                className="karaoke-maker__whisper-stages"
                aria-label={t('karaoke.maker.whisperPreparing')}
              >
                {visibleWhisperStages.map((stageName, index) => {
                  const activeIndex =
                    whisperStage === 'complete'
                      ? visibleWhisperStages.length
                      : visibleWhisperStages.indexOf(whisperStage);
                  const complete = index < activeIndex;
                  const active = index === activeIndex;
                  let label = t('karaoke.maker.whisperTranscribing');
                  if (stageName === 'decode') {
                    label = t('karaoke.maker.whisperDecoding');
                  } else if (stageName === 'download') {
                    label = t('karaoke.maker.downloadingWhisper');
                  } else if (stageName === 'load') {
                    label = t('karaoke.maker.loadingWhisper');
                  }
                  return (
                    <li
                      key={stageName}
                      className={`${complete ? 'is-complete' : ''} ${
                        active ? 'is-active' : ''
                      }`}
                    >
                      <span aria-hidden="true">
                        {complete ? '✓' : index + 1}
                      </span>
                      <em>{label}</em>
                    </li>
                  );
                })}
              </ol>
            )}
            <div
              className={`karaoke-maker__analysis-progress-bar ${
                analysisProgressIsIndeterminate ? 'is-indeterminate' : ''
              }`}
              role="progressbar"
              aria-label={
                analysisMessage ?? t('karaoke.maker.whisperPreparing')
              }
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                analysisProgressIsIndeterminate
                  ? undefined
                  : Math.round(displayedAnalysisProgress * 100)
              }
            >
              <span
                style={
                  analysisProgressIsIndeterminate
                    ? undefined
                    : { width: `${displayedAnalysisProgress * 100}%` }
                }
              />
            </div>
            <button type="button" onClick={cancelAnalysis}>
              {t('karaoke.maker.cancel')}
            </button>
          </div>
        )}
      {KARAOKE_AUTOMATIC_DETECTOR_UI_ENABLED &&
        analysisProgress === undefined &&
        analysisError &&
        !lyricsOpen && (
          <KaraokeMakerAnalysisError
            error={analysisError}
            retry={analysisRetry}
            onRetry={retryAnalysis}
            onDismiss={dismissAnalysisError}
          />
        )}
    </>
  );
};

export default KaraokeMakerAnalysisPanels;
