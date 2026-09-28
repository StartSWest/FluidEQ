/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { formatDuration } from '../library/player/NowPlayingBar';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import PlayerVolume from './PlayerVolume';
import SeekRange from './SeekRange';
import { useLibraryDeck } from './libraryDeck';
import usePlayerClock from './usePlayerClock';
import usePlayerSource from './usePlayerSource';

/** The bar's own step for back and forward on a source with no seek line. */
const NUDGE_MS = 5_000;

/**
 * The dock: the glass panel that drives the song (the Stage, Ivan 2026-09-27).
 *
 * The song's line with what has played and what is left at its ends; the
 * five keys that move through it round one large play key; and under them
 * the computer's volume, with the queue's shuffle, repeat and stop at the
 * end. It offers only what the source can do: no seek for a source that
 * cannot seek, shuffle and repeat only for the Library's queue.
 */
const PlayerDock = () => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  const library = useLibraryDeck();
  const { second, durationMs, hasPosition } = usePlayerClock(source);
  const [scrubMs, setScrubMs] = useState<number>();
  const isLibrary = source?.owner === 'library' && library !== undefined;
  const shownMs = scrubMs ?? (second ?? 0) * 1000;
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

  return (
    <section className="player-dock" aria-label={t('player.transport')}>
      <div className={`player-dock__seek${canSeek ? '' : ' is-still'}`}>
        <SeekRange
          positionMs={shownMs}
          durationMs={durationMs}
          onSeek={canSeek ? source?.seek : undefined}
          onScrub={setScrubMs}
        />
        <span className="player-dock__times">
          <span>{hasPosition ? formatDuration(shownMs) : '–:––'}</span>
          <span>
            {hasPosition
              ? `−${formatDuration(Math.max(0, durationMs - shownMs))}`
              : '–:––'}
          </span>
        </span>
      </div>
      <div className="player-dock__keys">
        <button
          type="button"
          className="player-dock__key is-side"
          aria-label={t('library.back5')}
          title={t('library.back5')}
          disabled={!canNudge}
          onClick={() => nudge(-NUDGE_MS)}
        >
          <PlayerIcon name="back5" />
        </button>
        <button
          type="button"
          className="player-dock__key"
          aria-label={t('library.previous')}
          title={t('library.previous')}
          disabled={!source?.previous}
          onClick={() => source?.previous?.()}
        >
          <PlayerIcon name="previous" />
        </button>
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
        <button
          type="button"
          className="player-dock__key"
          aria-label={t('library.next')}
          title={t('library.next')}
          disabled={!source?.next}
          onClick={() => source?.next?.()}
        >
          <PlayerIcon name="next" />
        </button>
        <button
          type="button"
          className="player-dock__key is-side"
          aria-label={t('library.forward5')}
          title={t('library.forward5')}
          disabled={!canNudge}
          onClick={() => nudge(NUDGE_MS)}
        >
          <PlayerIcon name="forward5" />
        </button>
      </div>
      <div className="player-dock__row">
        <PlayerVolume />
        <span className="player-dock__rule" aria-hidden="true" />
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
        <button
          type="button"
          className="player-dock__mode"
          aria-label={t('library.stop')}
          title={t('library.stop')}
          disabled={!stop}
          onClick={() => stop?.()}
        >
          <PlayerIcon name="stop" />
        </button>
      </div>
    </section>
  );
};

export default PlayerDock;
