/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useState } from 'react';
import { isLockedLookId } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import LookPicker from '../graph/LookPicker';
import { formatDuration } from '../library/player/NowPlayingBar';
import { setGraphLook, useSelectedLookId } from '../utils/graphStyle';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import PlayerVolume from './PlayerVolume';
import SeekRange from './SeekRange';
import { useLibraryDeck } from './libraryDeck';
import usePlayerClock from './usePlayerClock';
import usePlayerSource from './usePlayerSource';
import { setWindowMode } from './windowModeStore';

/** The bar's own step for back and forward on a source with no seek line. */
const NUDGE_MS = 5_000;

/**
 * The transport, under the picture (the one amp, Ivan 2026-10-25): the
 * song's line with what has played and what is left at its ends; the keys
 * that move through it round one large play key, stop last; and under them
 * the computer's volume, the queue's shuffle and repeat, and the visualizer
 * the picture above is drawing, whose press opens the whole list of looks
 * (Ivan: "make sure the viz dropdown opens the menu right to pick not just
 * to cycle"). It offers only what the source can do: no seek for a source
 * that cannot seek, shuffle and repeat only for the Library's queue.
 */
const PlayerDock = () => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  const library = useLibraryDeck();
  const selectedLookId = useSelectedLookId();
  const { second, durationMs, hasPosition } = usePlayerClock(source);
  const [scrubMs, setScrubMs] = useState<number>();
  const isLibrary = source?.owner === 'library' && library !== undefined;
  /**
   * Where the source says it is — what the seek line is handed, never
   * `shownMs`. The line holds a seek until this moves to where it was asked
   * for (`SeekRange`), and handed `shownMs` it was watching its own held
   * place come back through `onScrub`: that number never moves, so the hold
   * never ended and the line stood still after every jump while the song
   * played on (Ivan, 2026-10-25: "the music continue playing but the bar
   * not moving").
   */
  const clockMs = (second ?? 0) * 1000;
  const shownMs = scrubMs ?? clockMs;
  const canSeek = source?.seek !== undefined && hasPosition;
  const canNudge = source?.nudge !== undefined || canSeek;
  const nudge = (deltaMs: number) => {
    if (source?.nudge) {
      source.nudge(deltaMs);
    } else if (canSeek) {
      source?.seek?.(Math.max(0, Math.min(durationMs, shownMs + deltaMs)));
    }
  };
  // The Library's own stop takes the queue with it; any other source's is
  // its own.
  const stop = isLibrary ? library.stop : source?.stop;
  const isPlaying = source?.isPlaying === true;
  const chooseLook = useCallback((lookId: string) => {
    if (!isLockedLookId(lookId)) {
      setGraphLook(lookId);
      return;
    }
    // Plus is explained and bought in the Account panel, which is the full
    // app's; the look on screen stays put, as it does there.
    setWindowMode('app')
      .then(() => requestAccountPanel())
      .catch(() => undefined);
  }, []);

  const key = (
    name: 'back5' | 'previous' | 'next' | 'forward5' | 'stop',
    label: string,
    isDisabled: boolean,
    onPress: () => void,
  ) => (
    <button
      type="button"
      className="player-dock__key"
      aria-label={label}
      title={label}
      disabled={isDisabled}
      onClick={onPress}
    >
      <PlayerIcon name={name} />
    </button>
  );

  return (
    <section className="player-dock" aria-label={t('player.transport')}>
      <div className={`player-dock__seek${canSeek ? '' : ' is-still'}`}>
        <span className="player-dock__time">
          {hasPosition ? formatDuration(shownMs) : '–:––'}
        </span>
        <SeekRange
          positionMs={clockMs}
          durationMs={durationMs}
          onSeek={canSeek ? source?.seek : undefined}
          onScrub={setScrubMs}
        />
        <span className="player-dock__time is-left">
          {hasPosition
            ? `−${formatDuration(Math.max(0, durationMs - shownMs))}`
            : '–:––'}
        </span>
      </div>
      <div className="player-dock__keys">
        {key('previous', t('library.previous'), !source?.previous, () =>
          source?.previous?.(),
        )}
        {key('back5', t('library.back5'), !canNudge, () => nudge(-NUDGE_MS))}
        <button
          type="button"
          className="player-dock__play"
          aria-label={isPlaying ? t('library.pause') : t('library.play')}
          title={isPlaying ? t('library.pause') : t('library.play')}
          disabled={!source || source.canToggle === false}
          onClick={() => source?.toggle()}
        >
          <PlayerIcon name={isPlaying ? 'pause' : 'play'} />
        </button>
        {key('forward5', t('library.forward5'), !canNudge, () =>
          nudge(NUDGE_MS),
        )}
        {key('next', t('library.next'), !source?.next, () => source?.next?.())}
        {key('stop', t('library.stop'), !stop, () => stop?.())}
      </div>
      <div className="player-dock__row">
        <PlayerVolume />
        <button
          type="button"
          className="player-dock__mode"
          aria-label={t('library.shuffle')}
          title={t('library.shuffle')}
          aria-pressed={isLibrary && library.isShuffled}
          disabled={!isLibrary}
          onClick={() => library?.setShuffle(!library.isShuffled)}
        >
          <PlayerIcon name="shuffle" />
        </button>
        <button
          type="button"
          className={`player-dock__mode${
            isLibrary && library.repeat === 'one' ? ' is-one' : ''
          }`}
          aria-label={t(`library.repeat.${isLibrary ? library.repeat : 'off'}`)}
          title={t(`library.repeat.${isLibrary ? library.repeat : 'off'}`)}
          aria-pressed={isLibrary && library.repeat !== 'off'}
          disabled={!isLibrary}
          onClick={() => library?.cycleRepeat()}
        >
          <PlayerIcon name="repeat" />
        </button>
        <span className="player-dock__look">
          <LookPicker
            value={selectedLookId}
            disabled={false}
            onChoose={chooseLook}
          />
        </span>
      </div>
    </section>
  );
};

export default PlayerDock;
