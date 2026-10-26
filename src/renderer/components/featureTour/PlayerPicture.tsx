/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import Chevron from '../../icons/Chevron';
import LookIcon from '../../icons/LookIcon';
import SceneLookIcon from '../../icons/SceneLookIcon';
import LibraryCoverArt from '../../library/LibraryCoverArt';
import { formatDuration } from '../../library/player/NowPlayingBar';
import Marquee from '../../player/Marquee';
import PlayerIcon from '../../player/PlayerIcon';
import PlayerSource from '../../player/PlayerSource';
import SeekRange from '../../player/SeekRange';
import { useTranslation } from '../../utils/I18nContext';
import SignalBrandMark from '../SignalBrandMark';
import {
  PlayerPictureFoot,
  PlayerPictureShelf,
  PlayerPictureSound,
} from './PlayerPictureDeck';
import {
  PICTURE_LEVEL_DB,
  PICTURE_LOOK,
  PICTURE_NOW,
  PICTURE_POSITION_MS,
  PICTURE_QUEUE,
  PICTURE_SCENE,
  PICTURE_STAGE_LAYER,
  PICTURE_VOLUME,
} from './playerPictureData';
import playerAurora from '../../../../assets/tour/player-aurora.jpg';
import playerSynthwave from '../../../../assets/tour/player-synthwave.jpg';
import '../../styles/MiniPlayer.scss';

/**
 * THE COMPACT PLAYER, DRAWN BY ITS OWN PARTS (Ivan, 2026-10-26: "make help
 * use the app code for UI instead of pictures so it's easy to update"): the
 * player's own markup and stylesheet — applied here through the scope that
 * applies it to the player's window (`MiniPlayer.scss`, `.player-picture`)
 * — with its own pieces wherever a piece draws from what it is given: the
 * seek bar, the faders, the knobs, the icons, the covers, the song's source
 * and its marquee. The rest of each part is its markup, class for class, as
 * the player renders it, because the parts themselves read the app's live
 * stores and speak to the window. It plays the made-up queue of
 * `playerPictureData.ts`, at the player's own width, and the slide scales it.
 *
 * ONLY THE VISUALIZERS ARE STILLS: the aurora scene behind the whole player,
 * and the Synthwave look in its panel — a scene is drawn by the graphics
 * card and a look from the live sound, neither of which a slide has
 * (`assets/tour/player-aurora.jpg`, `player-synthwave.jpg`, taken from the
 * player's harness with every control hidden).
 *
 * Nothing in it can be pressed, focused or read out: the slide gives it
 * `inert` and `aria-hidden` and says what it shows in words.
 */
export type TPlayerPicture = 'scene' | 'look';

const nothing = () => undefined;

const PictureTitle = () => {
  const { t } = useTranslation();
  return (
    <div className="player-title">
      <div className="player-title__lead">
        <div className="player-title__menu">
          <button
            type="button"
            className="player-title__mark"
            aria-label={t('player.menu')}
          >
            <SignalBrandMark />
            <PlayerIcon
              name="caret"
              className="player-icon player-icon--caret"
            />
          </button>
        </div>
      </div>
      <span className="player-title__handle">
        <span className="player-title__line" />
        <span className="player-title__name">{PRODUCT_NAME}</span>
        <span className="player-title__line" />
      </span>
      <div className="player-title__controls">
        <button
          type="button"
          className="player-title__button"
          aria-label={t('player.menu.alwaysOnTop')}
        >
          <PlayerIcon name="pin" />
        </button>
        <button
          type="button"
          role="switch"
          aria-checked
          aria-label={t('player.switch.name')}
          className="window-mode-switch is-player"
        >
          <span className="window-mode-switch__side window-mode-switch__side--app">
            <PlayerIcon name="app" />
          </span>
          <span className="window-mode-switch__side window-mode-switch__side--player">
            <PlayerIcon name="player" />
          </span>
        </button>
        <button
          type="button"
          className="player-title__button"
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
      </div>
    </div>
  );
};

const PictureHero = ({ picture }: { picture: TPlayerPicture }) => {
  const { t } = useTranslation();
  const song = PICTURE_QUEUE[PICTURE_NOW];
  const isScene = picture === 'scene';
  return (
    <section className={`player-hero${isScene ? ' has-scene' : ''}`}>
      {!isScene && (
        <div className="player-hero__view">
          <img className="player-picture__still" src={playerSynthwave} alt="" />
        </div>
      )}
      <div className="player-hero__shade" />
      <div className="player-hero__top">
        <span className="player-hero__keys">
          <button
            type="button"
            className="player-hero__key"
            aria-label={t('graph.view.fullscreen')}
          >
            <PlayerIcon name="expand" />
          </button>
        </span>
      </div>
      <div className="player-hero__now">
        <span className="player-hero__art">
          <LibraryCoverArt src={song.cover} label={song.title} size="tile" />
        </span>
        <span className="player-hero__words">
          <PlayerSource source={{ owner: 'library' }} onOpenPage={nothing} />
          <Marquee text={song.title} className="player-hero__title" />
          <span className="player-hero__artist">{song.artist}</span>
          <span className="player-readouts">
            <span className="player-readouts__chip">
              <b>{PICTURE_LEVEL_DB.toFixed(1)}</b>
              <small>dB</small>
            </span>
          </span>
        </span>
        <button
          type="button"
          className="player-hero__heart"
          aria-label={t('library.playlist.addToFavorites')}
        >
          <PlayerIcon name="heart" />
        </button>
      </div>
    </section>
  );
};

const PictureDock = ({ picture }: { picture: TPlayerPicture }) => {
  const { t } = useTranslation();
  const song = PICTURE_QUEUE[PICTURE_NOW];
  const key = (
    name: 'back5' | 'previous' | 'next' | 'forward5' | 'stop',
    label: string,
  ) => (
    <button type="button" className="player-dock__key" aria-label={label}>
      <PlayerIcon name={name} />
    </button>
  );
  return (
    <section className="player-dock">
      <div className="player-dock__seek">
        <span className="player-dock__time">
          {formatDuration(PICTURE_POSITION_MS)}
        </span>
        <SeekRange
          positionMs={PICTURE_POSITION_MS}
          durationMs={song.durationMs}
          onSeek={nothing}
        />
        <span className="player-dock__time is-left">
          {`−${formatDuration(song.durationMs - PICTURE_POSITION_MS)}`}
        </span>
      </div>
      <div className="player-dock__keys">
        {key('previous', t('library.previous'))}
        {key('back5', t('library.back5'))}
        <button
          type="button"
          className="player-dock__play"
          aria-label={t('library.pause')}
        >
          <PlayerIcon name="pause" />
        </button>
        {key('forward5', t('library.forward5'))}
        {key('next', t('library.next'))}
        {key('stop', t('library.stop'))}
      </div>
      <div className="player-dock__row">
        <div className="player-volume">
          <button
            type="button"
            className="player-icon-button"
            aria-label={t('player.volume.system')}
          >
            <PlayerIcon name="speaker" />
          </button>
          <input
            className="player-range player-range--volume"
            type="range"
            min={0}
            max={100}
            value={PICTURE_VOLUME}
            readOnly
            aria-label={t('player.volume.system')}
            style={{ '--fill': `${PICTURE_VOLUME}%` } as CSSProperties}
          />
          <span className="player-volume__value">{`${PICTURE_VOLUME}%`}</span>
        </div>
        <button
          type="button"
          className="player-dock__mode"
          aria-label={t('library.shuffle')}
        >
          <PlayerIcon name="shuffle" />
        </button>
        <button
          type="button"
          className="player-dock__mode"
          aria-label={t('library.repeat.off')}
        >
          <PlayerIcon name="repeat" />
        </button>
        <span className="player-dock__look">
          <div className="dropdown look-picker">
            <button
              type="button"
              className="look-picker__trigger"
              aria-label={t('graph.picker.label')}
            >
              <span className="graph-look-option">
                {picture === 'scene' ? (
                  <>
                    <SceneLookIcon
                      className="graph-look-option__icon graph-look-option__icon--scene"
                      swatch={PICTURE_SCENE.swatch}
                    />
                    <span className="graph-look-name graph-look-name--premium">
                      {PICTURE_SCENE.name}
                    </span>
                    <span className="graph-look-badge">
                      {t('graph.scene.badge')}
                    </span>
                  </>
                ) : (
                  <>
                    <LookIcon
                      className="graph-look-option__icon"
                      style={PICTURE_LOOK}
                      palette="auto"
                    />
                    <span className="graph-look-name">
                      {t('graph.styleName.synthwave')}
                    </span>
                  </>
                )}
              </span>
              <Chevron className="arrow" />
            </button>
          </div>
        </span>
      </div>
    </section>
  );
};

/**
 * One Compact player at its own size, 480 CSS pixels wide, over a scene on
 * the Backdrop with its bands open (`scene`) or with a standard look in its
 * panel and its Tone open (`look`), laid out `zoom` times that size.
 */
export default function PlayerPicture({
  picture,
  zoom,
}: {
  picture: TPlayerPicture;
  zoom: number;
}) {
  const isScene = picture === 'scene';
  return (
    <div className="player-picture" style={{ zoom }}>
      <div className={`mini-player${isScene ? ' has-scene is-backdrop' : ''}`}>
        {isScene && (
          <div
            className="player-stage has-scene"
            style={PICTURE_STAGE_LAYER as CSSProperties}
          >
            <img className="player-picture__still" src={playerAurora} alt="" />
          </div>
        )}
        <PictureTitle />
        <div className="player-body">
          <div className="player-top">
            {!isScene && <div className="player-stage" />}
            <PictureHero picture={picture} />
            <PictureDock picture={picture} />
          </div>
          <PlayerPictureSound face={isScene ? 'bands' : 'tone'} />
          <PlayerPictureShelf />
        </div>
        <PlayerPictureFoot />
      </div>
    </div>
  );
}
