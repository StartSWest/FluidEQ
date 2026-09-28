/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useLastShown } from '../audio/lastShown';
import TrafficLightSlot from '../components/TrafficLightSlot';
import BrandMark from '../icons/BrandMark';
import { useTranslation } from '../utils/I18nContext';
import runsOnMac from '../utils/platform';
import Marquee from './Marquee';
import PlayerIcon from './PlayerIcon';
import SeekRange from './SeekRange';
import { toggleTimeLeft, useIsTimeLeft } from './playerLayout';
import { clockFor, playerStateOf } from './playerText';
import usePlayerClock from './usePlayerClock';
import usePlayerSource from './usePlayerSource';

/**
 * The amp folded to one line, as Winamp's windowshade was: one strip of the
 * Stage's glass over its ground (Ivan, 2026-09-27).
 *
 * The mark, the song and who sings it, previous, play and next, the time,
 * and at the end only the window's own buttons: minimise, unfold, close
 * (Ivan, 2026-09-22). Along the foot, the song's line, thin, which can still
 * be pressed to jump.
 *
 * THE MARK UNFOLDS THE PLAYER HERE, and opens no menu. The unfolded strip's
 * mark opens one, and it was tried on this line too: a window one line tall
 * has nowhere for a menu to open, so the key did nothing anybody could see
 * (Ivan, 2026-09-22: "the menu doesn't open because no space in the line
 * view" — and then "not the full app, restore just to the normal amp"). So
 * the key at the head of the line is the same press as the unfold button at
 * its end: the biggest target on the strip gives the player back.
 *
 * A narrow strip gives the singer up first and then Minimise
 * (`_miniPlayerFold.scss`); the song, the three keys and the time stay at
 * every width.
 *
 * On a Mac the window's own traffic lights open the line, and of the three
 * buttons at its end only unfold is drawn: minimise and close are two of the
 * lights.
 */
const FoldStrip = ({ onUnfold }: { onUnfold: () => void }) => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  // The last thing played, while no player is live, as the unfolded amp
  // shows it (`PlayerNow`).
  const remembered = useLastShown();
  const shown = source ?? remembered;
  const isTimeLeft = useIsTimeLeft();
  const { second, durationMs, hasPosition } = usePlayerClock(source);
  const shownMs = (second ?? 0) * 1000;
  const canSeek = source?.seek !== undefined && hasPosition;
  const isPaused = playerStateOf(source, second) === 'pause';
  const isPlaying = source?.isPlaying === true;
  const isMac = runsOnMac();

  return (
    <div className="player-fold" data-window-strip>
      <TrafficLightSlot />
      <div className="player-fold__glass">
        <button
          type="button"
          className="player-fold__mark"
          aria-label={t('player.unfold')}
          title={t('player.unfold')}
          onClick={onUnfold}
        >
          <BrandMark />
        </button>
        <span className="player-fold__text">
          <Marquee
            text={shown?.title ?? t('library.nothingPlaying')}
            className="player-fold__title"
          />
          {shown?.subtitle && (
            <span className="player-fold__artist">{shown.subtitle}</span>
          )}
        </span>
        <span className="player-fold__keys">
          <button
            type="button"
            className="player-fold__key"
            aria-label={t('library.previous')}
            title={t('library.previous')}
            disabled={!source?.previous}
            onClick={() => source?.previous?.()}
          >
            <PlayerIcon name="previous" />
          </button>
          <button
            type="button"
            className="player-fold__play"
            aria-label={isPlaying ? t('library.pause') : t('library.play')}
            title={isPlaying ? t('library.pause') : t('library.play')}
            disabled={!source || source.canToggle === false}
            onClick={() => source?.toggle()}
          >
            <PlayerIcon name={isPlaying ? 'pause' : 'play'} />
          </button>
          <button
            type="button"
            className="player-fold__key"
            aria-label={t('library.next')}
            title={t('library.next')}
            disabled={!source?.next}
            onClick={() => source?.next?.()}
          >
            <PlayerIcon name="next" />
          </button>
        </span>
        <button
          type="button"
          className={`player-fold__time${isPaused ? ' is-paused' : ''}`}
          aria-label={t('player.clock.aria')}
          title={t('player.clock.hint')}
          aria-pressed={isTimeLeft}
          disabled={!hasPosition}
          onClick={toggleTimeLeft}
        >
          {clockFor({
            shownMs,
            durationMs,
            isTimeLeft,
            isKnown: second !== undefined,
          })}
        </button>
        <span className="player-fold__window">
          {!isMac && (
            <button
              type="button"
              className="player-title__button player-fold__minimize"
              aria-label={t('app.window.minimizeApp')}
              title={t('app.window.minimize')}
              onClick={() => {
                window.electron.ipcRenderer
                  .minimizeWindow()
                  .catch(() => undefined);
              }}
            >
              <PlayerIcon name="minimize" />
            </button>
          )}
          <button
            type="button"
            className="player-title__button"
            aria-label={t('player.unfold')}
            title={t('player.unfold')}
            onClick={onUnfold}
          >
            <PlayerIcon name="unfold" />
          </button>
          {!isMac && (
            <button
              type="button"
              className="player-title__button player-title__button--close"
              aria-label={t('app.window.closeApp')}
              title={t('app.window.close')}
              onClick={() => {
                window.electron.ipcRenderer
                  .closeWindow()
                  .catch(() => undefined);
              }}
            >
              <PlayerIcon name="close" />
            </button>
          )}
        </span>
      </div>
      <SeekRange
        className="player-fold__seek"
        positionMs={shownMs}
        durationMs={durationMs}
        onSeek={canSeek ? source?.seek : undefined}
      />
    </div>
  );
};

export default FoldStrip;
