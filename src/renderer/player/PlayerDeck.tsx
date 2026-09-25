/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useState } from 'react';
import { useLiveAudioCapture } from '../audio/LiveAudioContext';
import LibraryCoverArt from '../library/LibraryCoverArt';
import { formatDuration } from '../library/player/NowPlayingBar';
import { useTranslation } from '../utils/I18nContext';
import LedClock from './LedClock';
import Marquee from './Marquee';
import PlayerBeatMark from './PlayerBeatMark';
import PlayerIcon from './PlayerIcon';
import PlayerReadouts from './PlayerReadouts';
import PlayerVolume, { type IVolumeAdjust } from './PlayerVolume';
import SeekRange from './SeekRange';
import SpectrumWell from './SpectrumWell';
import VolumeReadout from './VolumeReadout';
import { useLibraryDeck } from './libraryDeck';
import {
  toggleTimeLeft,
  useIsTimeLeft,
  usePlayerColumns,
  type IPlayerDecks,
  type TPlayerDeck,
} from './playerLayout';
import {
  clockFor,
  nowPlayingLine,
  playerStateOf,
  sourceLabel,
} from './playerText';
import usePlayerClock from './usePlayerClock';
import usePlayerSource from './usePlayerSource';

/** The bar's own step for back and forward on a source with no seek line. */
const NUDGE_MS = 5_000;

interface IPlayerDeckProps {
  decks: IPlayerDecks;
  onToggleDeck: (deck: TPlayerDeck) => void;
}

/**
 * The player's deck: what is playing, how far in, and the keys to drive it.
 *
 * Whatever is making sound, from whichever source — the Library, the Media
 * page, Karaoke, another program, another computer — through the one shape
 * they all publish (`transportSource.ts`). The deck offers only what the
 * source can do: no seek line for a source that cannot seek; the volume is
 * FluidEQ's own where the source takes it and the system's where it does
 * not (`PlayerVolume`). The Library adds its cover, shuffle, repeat and stop
 * through `libraryDeck.ts`.
 */
const PlayerDeck = ({ decks, onToggleDeck }: IPlayerDeckProps) => {
  const { t } = useTranslation();
  const source = usePlayerSource();
  const library = useLibraryDeck();
  const isTimeLeft = useIsTimeLeft();
  // In two columns the deck stands as tall as the equalizer beside it, and the
  // meter takes the whole width under the clock and the song rather than a
  // third of it beside a column of empty glass (Ivan, 2026-09-24).
  const isWide = usePlayerColumns() >= 2;
  const { second, durationMs, hasPosition } = usePlayerClock(source);
  const [scrubMs, setScrubMs] = useState<number>();
  // The volume while its slider is held: the display shows it in the
  // title's place for exactly that long.
  const [adjust, setAdjust] = useState<IVolumeAdjust>();
  // The well and the readouts read the live capture; it runs while anything
  // that draws it is on screen, and this deck always is.
  useLiveAudioCapture(true);

  const isLibrary = source?.owner === 'library' && library !== undefined;
  const title = source?.title ?? t('library.nothingPlaying');
  const shownMs = scrubMs ?? (second ?? 0) * 1000;
  const clock = clockFor({
    shownMs,
    durationMs,
    isTimeLeft,
    isKnown: second !== undefined,
  });
  const state = playerStateOf(source, second);

  const canSeek = source?.seek !== undefined && hasPosition;
  const canNudge = source?.nudge !== undefined || canSeek;
  const nudge = (deltaMs: number) => {
    if (source?.nudge) {
      source.nudge(deltaMs);
    } else if (canSeek) {
      source?.seek?.(Math.max(0, Math.min(durationMs, shownMs + deltaMs)));
    }
  };
  const stop = isLibrary ? library.stop : source?.stop;

  const deckButton = (deck: TPlayerDeck, label: string, hint: string) => (
    <button
      type="button"
      className="button small subtle player-led"
      aria-pressed={decks[deck]}
      title={hint}
      onClick={() => onToggleDeck(deck)}
    >
      <span className="player-led__lamp" aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <section className="player-deck" aria-label={t('player.deck.aria')}>
      <div className={`player-screen${isWide ? ' is-wide' : ''}`}>
        <div className="player-screen__left">
          <span className="player-screen__state">
            <PlayerIcon
              name={state}
              className="player-icon player-icon--state"
            />
            <span className="player-screen__source">
              {source ? sourceLabel(source, t) : ''}
            </span>
          </span>
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
              <LedClock text={clock} />
            </span>
          </button>
        </div>
        <div className="player-screen__right">
          {adjust ? (
            <VolumeReadout adjust={adjust} />
          ) : (
            <Marquee
              text={nowPlayingLine(source, t('library.nothingPlaying'))}
              className="player-screen__title"
            />
          )}
          <div className="player-screen__meta">
            <span className="player-screen__art">
              <LibraryCoverArt
                src={isLibrary ? undefined : source?.artworkUrl}
                artId={isLibrary ? library.track?.artId : undefined}
                label={title}
                size="row"
              />
            </span>
            <PlayerReadouts />
          </div>
        </div>
        <div className="player-screen__well">
          <SpectrumWell />
        </div>
      </div>

      <div className="player-deck__row">
        <PlayerVolume onAdjust={setAdjust} />
        <div className="player-deck__leds">
          {deckButton('eq', t('player.eq.short'), t('player.deck.eqHint'))}
          {deckButton('vis', t('player.deck.vis'), t('player.deck.visHint'))}
          {deckButton(
            'queue',
            t('player.deck.queue'),
            t('player.deck.queueHint'),
          )}
        </div>
      </div>

      <div className={`player-seek${canSeek ? '' : ' is-still'}`}>
        <span className="player-seek__time">
          {hasPosition ? formatDuration(shownMs) : '–:––'}
        </span>
        <SeekRange
          positionMs={shownMs}
          durationMs={durationMs}
          onSeek={canSeek ? source?.seek : undefined}
          onScrub={setScrubMs}
        />
        <span className="player-seek__time">
          {hasPosition ? `-${formatDuration(durationMs - shownMs)}` : '–:––'}
        </span>
      </div>

      <div className="player-transport">
        <button
          type="button"
          className="player-key"
          aria-label={t('library.previous')}
          title={t('library.previous')}
          disabled={!source?.previous}
          onClick={() => source?.previous?.()}
        >
          <PlayerIcon name="previous" />
        </button>
        <button
          type="button"
          className="player-key"
          aria-label={t('library.back5')}
          title={t('library.back5')}
          disabled={!canNudge}
          onClick={() => nudge(-NUDGE_MS)}
        >
          <PlayerIcon name="back5" />
        </button>
        <button
          type="button"
          className="button small player-play"
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
          className="player-key"
          aria-label={t('library.forward5')}
          title={t('library.forward5')}
          disabled={!canNudge}
          onClick={() => nudge(NUDGE_MS)}
        >
          <PlayerIcon name="forward5" />
        </button>
        <button
          type="button"
          className="player-key"
          aria-label={t('library.next')}
          title={t('library.next')}
          disabled={!source?.next}
          onClick={() => source?.next?.()}
        >
          <PlayerIcon name="next" />
        </button>
        <button
          type="button"
          className="player-key"
          aria-label={t('library.stop')}
          title={t('library.stop')}
          disabled={!stop}
          onClick={() => stop?.()}
        >
          <PlayerIcon name="stop" />
        </button>
        <span className="player-transport__gap" />
        <button
          type="button"
          className="player-key player-key--small"
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
          className={`player-key player-key--small${
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
        <PlayerBeatMark />
      </div>
    </section>
  );
};

export default PlayerDeck;
