/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import PlayerIcon from '../player/PlayerIcon';
import { useTranslation } from '../utils/I18nContext';
import { setStudioGridShown, useStudioGridShown } from './studioPaper';
import type { TStagePreview } from './studioStageScreen';
import { FULLSCREEN_ICON } from './studioTestIcons';

interface IStudioStageControlsProps {
  isFullscreen: boolean;
  onFullscreen: () => void;
  preview: TStagePreview;
  /** Shows the scene as `next`, or the stage again when `next` is on. */
  onPreview: (next: TStagePreview) => void;
  /** The player's own parts over the scene, while the player is shown. */
  hasPlayerParts: boolean;
  onPlayerParts: () => void;
}

/**
 * The stage's own controls, on the stage: full screen, the scene on an
 * ultra-wide window's graph, the scene in the Compact player's frame, and
 * the graph's grid over it (layout A, Ivan 2026-09-27). They were rows in
 * the side column, a scroll away from the picture they change.
 *
 * They stand on the stage's plate beside the reading of how the scene keeps
 * up (`StudioStage`: "join all into one with runs smoothly"), as drawings
 * alone, taking as little of the picture as they can; each name is still the
 * button's accessible name and its tooltip. The stage is tried at the graph's
 * own shape: the Graph, Narrow and Wide sizes that stood here went (Ivan,
 * 2026-09-27: "remove these option from studop no neede"); the two shapes
 * that came back are the ones the stage's divider cannot give it — a graph
 * five and a half times as wide as tall, and the player's column (Ivan,
 * 2026-11-09).
 *
 * While the player is shown the grid's place holds the player's parts
 * instead: the player draws no grid behind a scene, so the grid has nothing
 * to change there, and the plate keeps its width. The scene alone in the
 * player's frame unless asked (Ivan, 2026-11-09: "don't show the amp", "or
 * allow user to select if just the frame and if with amp ui on top").
 */
export default function StudioStageControls({
  isFullscreen,
  onFullscreen,
  preview,
  onPreview,
  hasPlayerParts,
  onPlayerParts,
}: IStudioStageControlsProps) {
  const { t } = useTranslation();
  const isGridShown = useStudioGridShown();
  const fullName = t('studio.size.full');
  const ultraWideName = t('studio.size.ultraWide');
  const playerName = t('studio.size.player');
  const partsName = t('studio.size.playerParts');
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
        aria-pressed={preview === 'ultraWide'}
        aria-label={ultraWideName}
        title={`${ultraWideName}\n${t('studio.size.ultraWideHint')}`}
        onClick={() => onPreview('ultraWide')}
      >
        {/* A curved monitor on its stand, far wider than it is tall: a wave
            drawn inside it was a smudge at the plate's 15 pixels. */}
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M1.2 4.4Q8 3.1 14.8 4.4V10.4Q8 9.1 1.2 10.4Z" />
          <path d="M8 9.8V13M5.5 13h5" />
        </svg>
      </button>
      <button
        type="button"
        className="studio-stage-controls__button"
        aria-pressed={preview === 'player'}
        aria-label={playerName}
        title={`${playerName}\n${t('studio.size.playerHint')}`}
        onClick={() => onPreview('player')}
      >
        {/* The glyph the window's own switch to the player wears. */}
        <PlayerIcon name="player" />
      </button>
      {preview === 'player' ? (
        <button
          type="button"
          className="studio-stage-controls__button"
          aria-pressed={hasPlayerParts}
          aria-label={partsName}
          title={`${partsName}\n${t('studio.size.playerPartsHint')}`}
          onClick={onPlayerParts}
        >
          {/* A layer laid over another: the player's parts over the scene. */}
          <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path d="M8 2.2l6.2 3.3L8 8.8 1.8 5.5z" />
            <path d="M1.8 8.8L8 12.1l6.2-3.3" />
          </svg>
        </button>
      ) : (
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
      )}
    </div>
  );
}
