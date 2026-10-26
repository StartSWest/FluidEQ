/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from '../utils/I18nContext';
import FoldStrip from './FoldStrip';
import PlayerDock from './PlayerDock';
import PlayerFoot from './PlayerFoot';
import PlayerHeightGrip from './PlayerHeightGrip';
import PlayerHero from './PlayerHero';
import PlayerQueue from './PlayerQueue';
import PlayerSound from './PlayerSound';
import PlayerStage from './PlayerStage';
import PlayerTitleStrip, { type TPlayerPage } from './PlayerTitleStrip';
import {
  usePlayerFold,
  usePlayerShelfOpen,
  usePlayerSound,
  usePlayerVisFull,
} from './playerLayout';
import useGraphScenePack from './useGraphScenePack';
import usePlayerHeightFloor from './usePlayerHeightFloor';
import useIsBackdrop from '../utils/useIsBackdrop';
import PlayerIcon from './PlayerIcon';
import useMusicDrop from './useMusicDrop';

/**
 * THE AMP (Ivan, 2026-10-25: "lets do an unified amp ui so we only have one
 * mode"): one column, the same in every window colour, and one width.
 *
 * The visualizer is the panel at the top, with the song over it — a standard
 * look drawn in the panel, a Plus visualizer drawn behind the panel and the
 * transport under it, and in the Backdrop behind the whole amp
 * (`PlayerStage`). Under them the sound, folding to its header, then what
 * plays next and the playlists in whatever room is left, folding to their
 * tabs, and the foot.
 *
 * THE WINDOW'S HEIGHT IS THE LISTENER'S, NOTHING INSIDE MOVES IT, AND
 * NOTHING SCROLLS BUT THE QUEUE'S OWN LIST (Ivan, 2026-10-25: "it cannot
 * change app height", "we need a way to avoid scroll on the full amp ui").
 * The column shares the room out (`.player-body`): the sound keeps its own
 * height, the queue its least, the picture takes what it would like down to
 * its least, and the queue the rest — or the picture, with the queue folded.
 * The window may not be dragged shorter than all of that with the sound open
 * (`usePlayerHeightFloor`). Folded to one line, with a Plus visualizer still
 * moving behind it.
 */
const PlayerAmp = ({
  onOpenPage,
}: {
  onOpenPage: (page: TPlayerPage) => void;
}) => {
  const { t } = useTranslation();
  const { isFolded, fold, unfold } = usePlayerFold();
  const isVisFull = usePlayerVisFull();
  const { isShelfOpen } = usePlayerShelfOpen();
  const { sound } = usePlayerSound();
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  // One load of the graph's Plus visualizer for the whole amp, folded or not:
  // it keeps moving behind the folded line.
  const scene = useGraphScenePack();
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
  usePlayerHeightFloor(rootRef, isFolded, sound.face);
  const drop = useMusicDrop();
  // THE BACKDROP: the window colours that put the visualizer behind the
  // whole window. The scene is still framed in the top part, as in every
  // mode, and the rest of the window is more of the same scene, header and
  // all (`PlayerStage`, as the full app's Backdrop keeps the graph its
  // panel), under panes of glass at the strength Transparency leaves them
  // (Ivan, 2026-10-25: "backdrop is not really showing the viz on the rest of
  // the app", "the app is too opaque", "the scenes need to display on the
  // top part, they just complete the rest of the content down"). In every
  // other mode a Plus visualizer is the top panel's, spreading faintly down
  // the panes under it.
  const isBackdrop = useIsBackdrop() && drawn !== undefined;

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
      }${drawn ? ' has-scene' : ''}${isBackdrop ? ' is-backdrop' : ''}${
        isShelfOpen ? '' : ' is-shelf-folded'
      }`}
      tabIndex={-1}
      role="region"
      aria-label={t('player.aria')}
      onDragOver={drop.onDragOver}
      onDragLeave={drop.onDragLeave}
      onDrop={drop.onDrop}
    >
      {isFolded ? (
        <>
          <PlayerStage scene={drawn} onTrouble={onTrouble} />
          <FoldStrip onUnfold={unfold} />
        </>
      ) : (
        <>
          {isBackdrop && (
            <PlayerStage
              scene={drawn}
              onTrouble={onTrouble}
              panelRef={topRef}
            />
          )}
          <PlayerTitleStrip onFold={fold} onOpenPage={onOpenPage} />
          <div className="player-body">
            <div className="player-top" ref={topRef}>
              {!isBackdrop && (
                <PlayerStage scene={drawn} onTrouble={onTrouble} />
              )}
              <PlayerHero
                scene={drawn}
                isLoading={scene.state === 'loading'}
                onOpenPage={onOpenPage}
              />
              <PlayerDock />
            </div>
            <PlayerSound />
            <PlayerQueue onOpenLibrary={() => onOpenPage('library')} />
          </div>
          <PlayerFoot />
          <PlayerHeightGrip edge="top" />
          <PlayerHeightGrip edge="bottom" />
          {/* Over the amp rather than in its flow: a message that pushed
              anything down would move it out from under the pointer that is
              about to let go. */}
          {drop.isOver && (
            <div className="player-drop" aria-hidden="true">
              <PlayerIcon name="queue" />
              <span>{t('player.queue.drop')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PlayerAmp;
