/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import FoldStrip from './FoldStrip';
import PlayerBandFloor from './PlayerBandFloor';
import PlayerDock from './PlayerDock';
import PlayerGap from './PlayerGap';
import PlayerNow from './PlayerNow';
import PlayerSheet from './PlayerSheet';
import PlayerStage from './PlayerStage';
import PlayerTitleStrip, { type TPlayerPage } from './PlayerTitleStrip';
import {
  usePlayerFold,
  usePlayerSheet,
  usePlayerVisFull,
} from './playerLayout';
import useGraphScenePack from './useGraphScenePack';
import usePlayerHeightLimit from './usePlayerHeightLimit';

/**
 * THE STAGE (Ivan, 2026-09-27): the amp while the window wears the Backdrop.
 *
 * The visualizer is the window's background (`PlayerStage`), and the amp
 * stands on it in glass: the header the window is dragged by, the song in
 * large type, the dock that drives it, the open space the picture is seen
 * through with the visualizer's own bar at its foot (`PlayerGap`), and the
 * sheet along the bottom with the equalizer and what plays next on its two
 * pages (`PlayerSheet`). In a wide window the sheet stands beside the rest
 * rather than under it. Folded, one line.
 *
 * Glass over the picture in the Backdrop alone, as the full app's panes are:
 * in every other mode the amp is the 2.0 amp (`ClassicAmp`), and
 * `MiniPlayer` chooses.
 */
const StageAmp = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const { t } = useTranslation();
  const { isFolded, fold, unfold } = usePlayerFold();
  const { sheet } = usePlayerSheet();
  const isVisFull = usePlayerVisFull();
  const rootRef = useRef<HTMLDivElement>(null);
  // One load of the graph's Plus visualizer for the whole amp: the stage
  // draws it, and the gap and its bar only need to know it is there. Not
  // while folded, where nothing draws it.
  const scene = useGraphScenePack(!isFolded);
  // The scene that failed here, so the free look stands in until another is
  // picked.
  const [troubled, setTroubled] = useState<string>();
  const drawn =
    scene.state === 'ready' && scene.identity !== troubled ? scene : undefined;
  const onTrouble = useCallback(() => {
    if (scene.state === 'ready') {
      setTroubled(scene.identity);
    }
  }, [scene]);
  const fit = usePlayerHeightLimit(rootRef, sheet, isFolded);

  // Focus inside the player, so the keys typed there are the player's: a
  // press on something that takes no focus of its own lands on the player.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, [isFolded]);

  return (
    <div
      ref={rootRef}
      className={`mini-player${isFolded ? ' is-folded' : ''}${
        isVisFull ? ' is-vis-full' : ''
      }${fit === 'roomy' ? '' : ` is-${fit}`}`}
      tabIndex={-1}
      role="region"
      aria-label={t('player.aria')}
    >
      <PlayerBandFloor rootRef={rootRef} />
      {/* Folded, the ground alone: nothing loads a picture for one line. */}
      <PlayerStage scene={drawn} onTrouble={onTrouble} />
      {isFolded ? (
        <FoldStrip onUnfold={unfold} />
      ) : (
        <>
          <PlayerTitleStrip onFold={fold} onOpenPage={onOpenPage} />
          <div className="player-main">
            <div className="player-main__lead">
              <PlayerNow onOpenPage={onOpenPage} />
              <PlayerDock />
              <PlayerGap
                isScene={drawn !== undefined}
                isLoading={scene.state === 'loading'}
              />
            </div>
            <PlayerSheet onOpenLibrary={() => onOpenPage('library')} />
          </div>
        </>
      )}
    </div>
  );
};

export default StageAmp;
