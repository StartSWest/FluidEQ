/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import PlayerIcon from '../player/PlayerIcon';
import { useTranslation } from '../utils/I18nContext';
import { setStudioGridShown, useStudioGridShown } from './studioPaper';
import { FULLSCREEN_ICON } from './studioTestIcons';

interface IStudioStageControlsProps {
  isFullscreen: boolean;
  onFullscreen: () => void;
  isPlayer: boolean;
  onPlayer: () => void;
}

/**
 * The stage's own controls, on the stage: full screen, the scene behind the
 * compact player, and the graph's grid over it (layout A, Ivan 2026-09-27).
 * They were rows in the side column, a scroll away from the picture they
 * change.
 *
 * They stand on the stage's plate beside the reading of how the scene keeps
 * up (`StudioStage`: "join all into one with runs smoothly"), as drawings
 * alone, taking as little of the picture as they can; each name is still the
 * button's accessible name and its tooltip. The stage is tried at the graph's
 * own shape: the Graph, Narrow and Wide sizes that stood here went (Ivan,
 * 2026-09-27: "remove these option from studop no neede").
 */
export default function StudioStageControls({
  isFullscreen,
  onFullscreen,
  isPlayer,
  onPlayer,
}: IStudioStageControlsProps) {
  const { t } = useTranslation();
  const isGridShown = useStudioGridShown();
  const fullName = t('studio.size.full');
  const playerName = t('studio.size.player');
  const gridName = t('studio.grid.label');
  return (
    <div className="studio-stage-controls">
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-pressed={isFullscreen}
        aria-label={fullName}
        title={fullName}
        onClick={onFullscreen}
      >
        {FULLSCREEN_ICON}
      </button>
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-pressed={isPlayer}
        aria-label={playerName}
        title={`${playerName}\n${t('studio.size.playerHint')}`}
        onClick={onPlayer}
      >
        {/* The glyph the window's own switch to the player wears. */}
        <PlayerIcon name="player" />
      </button>
      <button
        type="button"
        className="studio-stage-controls__button studio-stage-controls__grid"
        aria-pressed={isGridShown}
        aria-label={gridName}
        // The name first, then what it is for: a drawing alone says neither.
        title={`${gridName}\n${t('studio.grid.hint')}`}
        onClick={() => setStudioGridShown(!isGridShown)}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M2.5 2.5h11v11h-11zM2.5 6.2h11M2.5 9.8h11M6.2 2.5v11M9.8 2.5v11" />
        </svg>
      </button>
    </div>
  );
}
