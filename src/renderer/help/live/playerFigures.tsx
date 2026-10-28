/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { PLAYER_FOLD_HEIGHT } from 'common/constants';
import SignalBrandMark from '../../components/SignalBrandMark';
import PlayerPicture from '../../components/featureTour/PlayerPicture';
import {
  PICTURE_NOW,
  PICTURE_POSITION_MS,
  PICTURE_QUEUE,
} from '../../components/featureTour/playerPictureData';
import Marquee from '../../player/Marquee';
import PlayerIcon from '../../player/PlayerIcon';
import { PlayerMarkMenuItems } from '../../player/PlayerMarkMenu';
import SeekRange from '../../player/SeekRange';
import { clockFor } from '../../player/playerText';
import { useTranslation } from '../../utils/I18nContext';
import playerAurora from '../../../../assets/tour/player-aurora.jpg';

/**
 * The Compact player's chapter, drawn by the player's own parts
 * (`helpChapters/start.ts` frames each figure out of these).
 *
 * The whole player is What's New's picture of it (`PlayerPicture`): its
 * markup and stylesheet, its seek bar, faders, knobs and icons, playing the
 * made-up queue, over a scene on the Backdrop. Three figures frame its
 * header and picture, its Sound and its Up next. The mark's menu is the
 * menu's own contents (`PlayerMarkMenuItems`), so it reads the reader's own
 * settings as the menu would; and the folded line is the line's markup,
 * class for class, as `FoldStrip` draws it, playing the same song — the
 * line itself reads the live player, which may be somebody's real music.
 */

const nothing = () => undefined;

/** The whole player, as its window holds it. */
export const PlayerDrawing = () => <PlayerPicture picture="scene" zoom={1} />;

/** The mark's menu, open, on its own glass. */
export const PlayerMenuDrawing = () => (
  <div className="player-part">
    <div className="player-menu player-menu--mark" role="menu">
      <PlayerMarkMenuItems
        onFold={nothing}
        onOpenPage={nothing}
        onClose={nothing}
      />
    </div>
  </div>
);

/** The player folded to one line, over the scene, playing the queue's song. */
export const PlayerFoldDrawing = () => {
  const { t } = useTranslation();
  const song = PICTURE_QUEUE[PICTURE_NOW];
  return (
    <div className="player-part" style={{ height: PLAYER_FOLD_HEIGHT }}>
      <div className="mini-player is-folded has-scene is-backdrop">
        <div className="player-stage has-scene">
          <img className="player-picture__still" src={playerAurora} alt="" />
        </div>
        <div className="player-fold">
          <button
            type="button"
            className="player-fold__mark"
            aria-label={t('player.unfold')}
          >
            <SignalBrandMark />
          </button>
          <button
            type="button"
            className="player-fold__play"
            aria-label={t('library.pause')}
          >
            <PlayerIcon name="pause" />
          </button>
          <span className="player-fold__text">
            <Marquee text={song.title} className="player-fold__title" />
            <span className="player-fold__artist">{song.artist}</span>
          </span>
          <button
            type="button"
            className="player-fold__time"
            aria-label={t('player.clock.aria')}
          >
            {clockFor({
              shownMs: PICTURE_POSITION_MS,
              durationMs: song.durationMs,
              isTimeLeft: false,
              isKnown: true,
            })}
          </button>
          <span className="player-fold__window">
            <button
              type="button"
              className="player-title__button"
              aria-label={t('player.unfold')}
            >
              <PlayerIcon name="unfoldLine" />
            </button>
            <button
              type="button"
              className="player-title__button player-fold__minimize"
              aria-label={t('app.window.minimizeApp')}
            >
              <PlayerIcon name="minimize" />
            </button>
            <button
              type="button"
              className="player-title__button player-title__button--close"
              aria-label={t('app.window.closeApp')}
            >
              <PlayerIcon name="close" />
            </button>
          </span>
          <SeekRange
            className="player-fold__seek"
            positionMs={PICTURE_POSITION_MS}
            durationMs={song.durationMs}
            onSeek={nothing}
          />
        </div>
      </div>
    </div>
  );
};
