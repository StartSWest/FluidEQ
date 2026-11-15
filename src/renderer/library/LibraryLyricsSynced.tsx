/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type ILyricsLine,
  type ILyricsWord,
  reachedIndex,
} from '../../common/library/lyrics';
import { useTranslation } from '../utils/I18nContext';
import { prefersReducedMotion } from '../utils/bandReveal';
import { useLibraryPlayer } from './player/LibraryPlayerContext';
import { useSungWord } from './useSungWord';

type TLineState = 'past' | 'active' | 'next';

/**
 * Where the line being sung is held, as a share of the list's height from
 * its top: the upper third, so most of what is shown is what comes next —
 * the part a listener singing along reads ahead into. The stylesheet's room
 * above the first line and below the last (`_libraryLyrics.scss`) is sized
 * from the same share, so either end can reach it.
 */
const HOLD_AT = 0.32;

/** Keys that scroll a list by themselves, which the reader means as "let
 * me look around". */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

/** The active line's words, lit up to the one being sung. */
const SungWords = ({
  words,
  positionMs,
  isPlaying,
}: {
  words: readonly ILyricsWord[];
  positionMs: number;
  isPlaying: boolean;
}) => {
  const sung = useSungWord(words, positionMs, isPlaying);
  return (
    <>
      {words.map((word, index) => (
        <span
          // Words keep their file order and never move: the index is the word.
          // eslint-disable-next-line react/no-array-index-key -- see above
          key={index}
          className={`library-lyrics__word${index <= sung ? ' is-sung' : ''}`}
        >
          {word.text}
        </span>
      ))}
    </>
  );
};

/**
 * One line. Only the active one hears the clock (`positionMs`), so a reading
 * re-renders the line being sung and the two whose state changed, never the
 * whole song.
 */
const LyricsRow = memo(
  ({
    line,
    index,
    state,
    positionMs,
    isPlaying,
    onSeek,
  }: {
    line: ILyricsLine;
    index: number;
    state: TLineState;
    positionMs: number | undefined;
    isPlaying: boolean;
    onSeek: (line: ILyricsLine) => void;
  }) => {
    const stateClass = state === 'next' ? '' : ` is-${state}`;
    if (line.text === '') {
      // A stamped pause: an instrumental stretch, drawn as one.
      return (
        <li
          className={`library-lyrics__gap${stateClass}`}
          data-line={index}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </li>
      );
    }
    return (
      <li data-line={index}>
        <button
          type="button"
          className={`library-lyrics__line${stateClass}`}
          aria-current={state === 'active' ? 'true' : undefined}
          onClick={() => onSeek(line)}
        >
          {line.words !== undefined && positionMs !== undefined ? (
            <SungWords
              words={line.words}
              positionMs={positionMs}
              isPlaying={isPlaying}
            />
          ) : (
            line.text
          )}
        </button>
      </li>
    );
  },
);

/**
 * Timed lyrics, following the song: the line being sung lit and held in the
 * upper third of the pane (`HOLD_AT`), the ones sung dimmed, a press on any line playing from
 * it. Scrolling by hand lets go of the song until the reader asks for it back
 * or presses a line. Everything moves on the player's own clock — a reading
 * moves the line, a painted frame moves the word — and never on a timer.
 */
const LibraryLyricsSynced = ({ lines }: { lines: readonly ILyricsLine[] }) => {
  const { t } = useTranslation();
  const { positionMs, isPlaying, seek, toggle } = useLibraryPlayer();
  const active = reachedIndex(lines, positionMs);
  const listRef = useRef<HTMLOListElement>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  /** The first placement jumps; after it, the line glides to its place. */
  const hasPlacedRef = useRef(false);
  const activeRef = useRef(active);
  activeRef.current = active;

  const place = useCallback((isInstant: boolean) => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(
      `[data-line="${Math.max(0, activeRef.current)}"]`,
    );
    if (!list || !row || list.clientHeight === 0) {
      return;
    }
    const top = row.offsetTop - list.clientHeight * HOLD_AT;
    list.scrollTo({
      top: Math.max(0, top),
      behavior:
        isInstant || !hasPlacedRef.current || prefersReducedMotion()
          ? 'auto'
          : 'smooth',
    });
    hasPlacedRef.current = true;
  }, []);

  useEffect(() => {
    if (isFollowing) {
      place(false);
    }
  }, [active, isFollowing, place]);

  // A pane opened, widened or narrowed re-wraps every line: the line being
  // sung goes straight back to its place while the song is followed.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !isFollowing) {
      return undefined;
    }
    const observer = new ResizeObserver(() => place(true));
    observer.observe(list);
    return () => observer.disconnect();
  }, [isFollowing, place]);

  // The reader's own scrolling — the wheel, a finger, the scroll bar, the
  // keys of a focused list — lets go of the song. Listened to on the element
  // and passive: a scroll the window does itself fires none of these.
  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return undefined;
    }
    const letGo = () => setIsFollowing(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key) && event.target === list) {
        letGo();
      }
    };
    // A press on the list itself and not on a line is its scroll bar.
    const onPointerDown = (event: PointerEvent) => {
      if (event.target === list) {
        letGo();
      }
    };
    list.addEventListener('wheel', letGo, { passive: true });
    list.addEventListener('touchmove', letGo, { passive: true });
    list.addEventListener('keydown', onKeyDown);
    list.addEventListener('pointerdown', onPointerDown);
    return () => {
      list.removeEventListener('wheel', letGo);
      list.removeEventListener('touchmove', letGo);
      list.removeEventListener('keydown', onKeyDown);
      list.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  // A press plays the song from that line, paused or stopped as it may be:
  // the jump alone left a paused song sitting silent at the new line, which
  // read as the press doing nothing (Ivan, 2026-11-15). Play is the bar's
  // own (`toggle`), after the jump, so it starts where the line is.
  const handleSeek = useCallback(
    (line: ILyricsLine) => {
      seek(line.timeMs);
      if (!isPlaying) {
        toggle();
      }
      setIsFollowing(true);
    },
    [isPlaying, seek, toggle],
  );

  return (
    // The lines and the button back to the song, in one box: the button
    // floats from this box's foot, above the tab's own foot whatever its
    // height (`_libraryLyrics.scss`).
    <div className="library-lyrics__stage">
      <ol
        ref={listRef}
        className="library-lyrics__lines"
        aria-label={t('library.lyrics.listLabel')}
        // A focusable list scrolls from the keyboard, as any scroll area.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrollable region must be reachable by keyboard
        tabIndex={0}
      >
        {lines.map((line, index) => {
          let state: TLineState = 'next';
          if (index === active) {
            state = 'active';
          } else if (index < active) {
            state = 'past';
          }
          return (
            <LyricsRow
              // Lines keep their order for the life of the answer.
              // eslint-disable-next-line react/no-array-index-key -- see above
              key={index}
              line={line}
              index={index}
              state={state}
              positionMs={state === 'active' ? positionMs : undefined}
              isPlaying={isPlaying}
              onSeek={handleSeek}
            />
          );
        })}
      </ol>
      {!isFollowing && (
        <button
          type="button"
          className="button small subtle library-lyrics__follow"
          onClick={() => setIsFollowing(true)}
        >
          {t('library.lyrics.follow')}
        </button>
      )}
    </div>
  );
};

export default LibraryLyricsSynced;
