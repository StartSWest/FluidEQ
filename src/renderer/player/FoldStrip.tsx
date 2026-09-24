/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { PRODUCT_NAME } from 'common/branding';
import TrafficLightSlot from '../components/TrafficLightSlot';
import BrandMark from '../icons/BrandMark';
import { useTranslation } from '../utils/I18nContext';
import runsOnMac from '../utils/platform';
import useEqualizerPower from '../utils/useEqualizerPower';
import LedClock from './LedClock';
import Marquee from './Marquee';
import PlayerIcon from './PlayerIcon';
import SeekRange from './SeekRange';
import { useLibraryDeck } from './libraryDeck';
import { toggleTimeLeft, useIsTimeLeft } from './playerLayout';
import { clockFor, nowPlayingLine, playerStateOf } from './playerText';
import usePlayerClock from './usePlayerClock';
import usePlayerSource from './usePlayerSource';

/**
 * The player folded to one line, as Winamp's windowshade was.
 *
 * The mark on its key and the name beside it, as at the top of the unfolded
 * player; then the transport — previous, play, next, stop — the scrolling
 * title and the clock, the song's line and FluidEQ's own switch; and at the
 * end only the window's own three buttons: minimise, unfold, close (Ivan,
 * 2026-09-22).
 *
 * THE MARK UNFOLDS THE PLAYER HERE, and opens no menu. The unfolded strip's
 * mark opens one, and it was tried on this line too: a window one line tall
 * has nowhere for a menu to open, so the key did nothing anybody could see
 * (Ivan, 2026-09-22: "the menu doesn't open because no space in the line
 * view" — and then "not the full app, restore just to the normal amp"). So
 * the key at the head of the line is the same press as the restore button at
 * its end: the biggest target on the strip gives the player back.
 *
 * A narrow strip gives things up in the order a listener can afford to lose
 * them (`_miniPlayerFold.scss`): the EQ key, the seek line, Stop, then
 * Minimise. The name and the transport stay at every width.
 *
 * On a Mac the window's own traffic lights open the line, and of the three
 * buttons at its end only unfold is drawn: minimise and close are two of the
 * lights.
 */
const FoldStrip = ({ onUnfold }: { onUnfold: () => void }) => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  const library = useLibraryDeck();
  const power = useEqualizerPower();
  const isTimeLeft = useIsTimeLeft();
  const { second, durationMs, hasPosition } = usePlayerClock(source);
  const shownMs = (second ?? 0) * 1000;
  const state = playerStateOf(source, second);
  const canSeek = source?.seek !== undefined && hasPosition;
  // The Library's own stop takes the queue with it; any other source's is
  // its own (`PlayerDeck` does the same).
  const stop =
    source?.owner === 'library' && library !== undefined
      ? library.stop
      : source?.stop;
  const isMac = runsOnMac();

  return (
    <div className="player-fold" data-window-strip>
      <TrafficLightSlot />
      <div className="player-fold__lead">
        <button
          type="button"
          className="player-title__mark player-fold__mark"
          aria-label={t('player.unfold')}
          title={t('player.unfold')}
          onClick={onUnfold}
        >
          <BrandMark />
        </button>
        <span className="player-fold__name" aria-hidden="true">
          {PRODUCT_NAME}
        </span>
        <span className="player-fold__transport">
          <button
            type="button"
            className="player-key player-key--fold"
            aria-label={t('library.previous')}
            title={t('library.previous')}
            disabled={!source?.previous}
            onClick={() => source?.previous?.()}
          >
            <PlayerIcon name="previous" />
          </button>
          <button
            type="button"
            className="button small player-play player-play--mini"
            aria-label={
              source?.isPlaying ? t('library.pause') : t('library.play')
            }
            title={source?.isPlaying ? t('library.pause') : t('library.play')}
            disabled={!source || source.canToggle === false}
            onClick={() => source?.toggle()}
          >
            <PlayerIcon name={source?.isPlaying ? 'pause' : 'play'} />
          </button>
          <button
            type="button"
            className="player-key player-key--fold"
            aria-label={t('library.next')}
            title={t('library.next')}
            disabled={!source?.next}
            onClick={() => source?.next?.()}
          >
            <PlayerIcon name="next" />
          </button>
          <button
            type="button"
            className="player-key player-key--fold player-fold__stop"
            aria-label={t('library.stop')}
            title={t('library.stop')}
            disabled={!stop}
            onClick={() => stop?.()}
          >
            <PlayerIcon name="stop" />
          </button>
        </span>
        <div className="player-fold__screen">
          <Marquee
            text={nowPlayingLine(source, t('library.nothingPlaying'))}
            className="player-fold__title"
          />
          <button
            type="button"
            className="player-clock-button"
            aria-label={t('player.clock.aria')}
            title={t('player.clock.hint')}
            aria-pressed={isTimeLeft}
            disabled={!hasPosition}
            onClick={toggleTimeLeft}
          >
            <span
              className={`player-clock${state === 'pause' ? ' is-paused' : ''}`}
            >
              <LedClock
                text={clockFor({
                  shownMs,
                  durationMs,
                  isTimeLeft,
                  isKnown: second !== undefined,
                })}
              />
            </span>
          </button>
        </div>
        <SeekRange
          className="player-fold__seek"
          positionMs={shownMs}
          durationMs={durationMs}
          onSeek={canSeek ? source?.seek : undefined}
        />
        <button
          type="button"
          className="button small subtle player-led player-fold__eq"
          aria-pressed={power.isEnabled}
          disabled={power.isBlockingError}
          title={t('player.eq.onHint')}
          onClick={() => {
            power.toggle().catch(() => undefined);
          }}
        >
          <span className="player-led__lamp" aria-hidden="true" />
          {t('player.eq.short')}
        </button>
      </div>
      <div className="player-fold__tail">
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
              window.electron.ipcRenderer.closeWindow().catch(() => undefined);
            }}
          >
            <PlayerIcon name="close" />
          </button>
        )}
      </div>
    </div>
  );
};

export default FoldStrip;
