/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';

interface IGamingStageWaitingProps {
  gameName: string;
  onTryNow: () => void;
  isBusy: boolean;
}

/**
 * Where a part's editor stands while the game's own sound is not the one
 * on. A sound that cannot be heard is not tuned blind: the panel says so and
 * offers to put it on. Drawn by the page and by its Help drawing
 * (`help/live/gamingFigures`).
 */
const GamingStageWaiting = ({
  gameName,
  onTryNow,
  isBusy,
}: IGamingStageWaitingProps) => {
  const { t } = useTranslation();
  return (
    <div className="gaming-editor gaming-editor--waiting">
      <div className="gaming-editor__waiting">
        <svg
          className="gaming-editor__art"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M8 7.5h8a5 5 0 0 1 5 5v1a3.6 3.6 0 0 1-6.3 2.4l-.7-.8h-4l-.7.8A3.6 3.6 0 0 1 3 13.5v-1a5 5 0 0 1 5-5z" />
          <path d="M7.4 11.4v2.4M6.2 12.6h2.4M15.8 11.6h.01M18 13.4h.01" />
        </svg>
        <p className="gaming-editor__title">
          {t('gaming.editor.notLoaded', { game: gameName })}
        </p>
        <p className="gaming-editor__more">
          {t('gaming.editor.notLoadedMore')}
        </p>
        <button
          type="button"
          className="button small"
          disabled={isBusy}
          onClick={onTryNow}
        >
          {t('gaming.action.try')}
        </button>
      </div>
    </div>
  );
};

export default GamingStageWaiting;
