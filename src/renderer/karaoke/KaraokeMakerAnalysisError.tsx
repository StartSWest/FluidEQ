/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';

export type TKaraokeMakerAnalysisRetry =
  'whisper' | 'whisper-runtime' | 'pitch';

interface IKaraokeMakerAnalysisErrorProps {
  error: string;
  retry: TKaraokeMakerAnalysisRetry | undefined;
  onRetry: (retry: TKaraokeMakerAnalysisRetry) => Promise<void>;
  onDismiss: () => void;
  /** Inside the lyrics modal instead of floating over the Maker workspace. */
  inline?: boolean;
}

/** The same visible failure surface wherever the analysis progress was shown. */
const KaraokeMakerAnalysisError = ({
  error,
  inline = false,
  onDismiss,
  onRetry,
  retry,
}: IKaraokeMakerAnalysisErrorProps) => {
  const { t } = useTranslation();
  let title = t('karaoke.maker.localAnalysisFailed');
  if (retry === 'whisper') {
    title = t('karaoke.maker.downloadFailed');
  } else if (retry === 'pitch') {
    title = t('karaoke.maker.pitchDownloadFailed');
  }

  return (
    <div
      className={`karaoke-maker__analysis-error${inline ? ' is-inline' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <div className="karaoke-maker__analysis-error-icon" aria-hidden="true">
        !
      </div>
      <div>
        <strong>{title}</strong>
        <span>{error}</span>
      </div>
      <div className="karaoke-maker__analysis-error-actions">
        {retry !== undefined && (
          <button
            type="button"
            className="karaoke-maker__analysis-error-retry"
            onClick={() => onRetry(retry).catch(() => undefined)}
          >
            {t('karaoke.maker.tryAgain')}
          </button>
        )}
        <button
          type="button"
          className="karaoke-maker__analysis-error-close"
          onClick={onDismiss}
          aria-label={t('karaoke.maker.dismiss')}
        >
          ×
        </button>
      </div>
    </div>
  );
};

export default KaraokeMakerAnalysisError;
