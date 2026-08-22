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

import { DragEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ILibraryTrack } from '../../common/library/types';
import { useTranslation } from '../utils/I18nContext';
import { useLibrary } from './LibraryContext';
import { useLibraryPlayer } from './player/LibraryPlayerContext';
import LibraryCoverArt from './LibraryCoverArt';

/**
 * How long the queue really is, as the header and the folded chip both say it.
 *
 * Two disjoint halves, added: what the queue is CARRYING, and what the shelf
 * still has that the queue has not reached. `upNext` is the first — a sliding
 * 200-entry window of a shelf that can be ten thousand long, so counting it
 * alone reports the window. `restTotal` is the second, and the caller owes us
 * a number with nothing in it that the queue already holds.
 *
 * They have to be disjoint or this is nonsense. Thirteen songs added by hand
 * off a thirteen-song folder came out as "13 / 25" when the two halves
 * overlapped: the picks were counted, and then the same files were counted
 * again as the folder's remainder.
 *
 * Exported because the panel and the chip that replaces it when folded have to
 * agree — two counts for one queue is the kind of thing that reads as a bug in
 * the queue rather than in the arithmetic.
 */
export const upNextTotal = (
  upNext: readonly unknown[],
  restTotal: number | undefined,
): number => upNext.length + (restTotal ?? 0);

/**
 * The queue, folded: what you press to get it back.
 *
 * One component and not two inline copies, because it is drawn in two places
 * that could not be more different — in the folder row on a shelf, floating on
 * the picture over a video — and the thing a reader has to recognise in both
 * is the same glyph and the same count. `className` is the only difference,
 * and it only ever says WHERE.
 */
export const LibraryUpNextChip = ({
  className,
  isOpen,
  count,
  onToggle,
}: {
  className?: string;
  /** Lit while the queue is showing. The chip is drawn in both states — that
   * is what keeps the toolbar from re-laying itself out when the queue opens
   * — so it has to say which state it is in. */
  isOpen: boolean;
  count: number;
  onToggle: () => void;
}) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`library-toolbar__chip library-up-next__chip${
        isOpen ? ' is-active' : ''
      }${className ? ` ${className}` : ''}`}
      aria-expanded={isOpen}
      title={t('library.upNext')}
      onClick={onToggle}
    >
      {/* A stack of lines with a play triangle at its head: the queue glyph
          every player uses, so the chip is findable without reading the two
          words beside it. */}
      <svg viewBox="0 0 16 16" aria-hidden>
        <path d="M2 4h8M2 8h8M2 12h5" />
        <path d="M11 9.5l4 2.5-4 2.5z" className="is-filled" />
      </svg>
      <span>{t('library.upNext')}</span>
      <span className="library-up-next__count">{count}</span>
    </button>
  );
};

/** A track row: 30px of picture with 6px either side of it. */
const ROW_HEIGHT = 42;
/** An album heading: one small line and the space above it. */
const HEADING_HEIGHT = 26;
/** Entries kept mounted beyond the scrollport, either side. */
const OVERSCAN = 6;

/**
 * A queued song, and its PLACE in the run.
 *
 * The place is what everything here acts on rather than the track's id: the
 * same song can sit in this list several times — a request asked for twice is
 * played twice — so an id says nothing about which of them was meant, and it
 * cannot key a row either.
 */
/** A section heading: one small line and the rule under it. */
const SECTION_HEIGHT = 32;

type TEntry =
  | { kind: 'section'; key: string; isAdded: boolean }
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'track'; key: string; position: number; track: ILibraryTrack };

/**
 * The list, grouped the way the library groups everything else.
 *
 * A run of twelve songs from one record is one record, and drawn as twelve
 * loose rows it reads as twelve unrelated decisions — which is not what
 * adding an album to the list was. Consecutive tracks sharing an album get
 * one heading; a song added on its own falls back to its artist, because a
 * heading naming a record that is not there says less than nothing.
 */
const buildEntries = (
  queued: readonly {
    position: number;
    track: ILibraryTrack;
    isAdded: boolean;
  }[],
): TEntry[] => {
  const entries: TEntry[] = [];
  let section: boolean | undefined;
  let heading: string | undefined;
  queued.forEach(({ position, track, isAdded }) => {
    if (section !== isAdded) {
      section = isAdded;
      // A new section starts its grouping over: the record above the rule and
      // the record below it are two different answers even when they are the
      // same record.
      heading = undefined;
      entries.push({
        kind: 'section',
        key: `section|${position}`,
        isAdded,
      });
    }
    const label = track.album ?? track.albumArtist ?? track.artist ?? '';
    if (label !== heading) {
      heading = label;
      if (label !== '') {
        entries.push({
          kind: 'heading',
          key: `heading|${position}`,
          label,
        });
      }
    }
    entries.push({ kind: 'track', key: `track|${position}`, position, track });
  });
  return entries;
};

/**
 * What is coming, on the right of the library.
 *
 * Anything added by hand sits at the front of it and the rest of the album,
 * folder or shelf follows — so the panel answers "what is next" whether or
 * not a list has been built. Rows drag into a different order, can be taken
 * back out, and can hold the same song more than once.
 *
 * WINDOWED. Only the entries over the scrollport are mounted and two spacers
 * stand in for the rest, measured from a real offset table rather than from
 * one row height — a heading is shorter than a row, so arithmetic on a single
 * height would drift by the difference at every group.
 *
 * Folding is the caller's: the panel is a strip of the tab's width and the
 * tab is the thing that has to give it up, so `LibraryWorkspace` owns that
 * state and hands it down.
 */
const LibraryUpNext = ({
  isCollapsed,
  onCollapsedChange,
  restTotal,
}: {
  isCollapsed: boolean;
  onCollapsedChange: (next: boolean) => void;
  /**
   * How much of the shelf is still to come that the queue is NOT already
   * carrying — see `upNextTotal`, which adds it to the rows in hand.
   *
   * The queue is a 200-entry window that slides as the playhead moves, so a
   * ten-thousand-song shelf plays through in full while never holding more
   * than a slice of itself. Counting rows reported the slice — "199" for a
   * shelf with nine thousand left to play — so the caller, which is the one
   * that knows the whole list, says what the slice leaves out.
   */
  restTotal: number | undefined;
}) => {
  const { t } = useTranslation();
  const { index } = useLibrary();
  const { upNext, jumpToQueuePosition, removeUpNextAt, moveUpNext } =
    useLibraryPlayer();

  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [paneHeight, setPaneHeight] = useState(0);
  const [draggingAt, setDraggingAt] = useState<number | undefined>(undefined);

  // The scrollport's own height, watched rather than read once: this panel
  // folds and is resized by its edge, and the window is not a fixed size.
  useLayoutEffect(() => {
    const pane = listRef.current;
    if (!pane) {
      return undefined;
    }
    const measure = () => setPaneHeight(pane.clientHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(pane);
    return () => observer.disconnect();
  }, [isCollapsed]);

  /**
   * Back to the top when the playhead moves.
   *
   * This list is everything AFTER what is playing, so choosing a song out of
   * it drops that song and everything above it — the list can go from ninety
   * entries to nine in one press. The scroll offset does not know that: it
   * stayed where it was and left the reader looking at empty space below a
   * short list, able to scroll through nothing.
   *
   * Keyed on WHICH SONG is next, not on its place in the run and not on the
   * length. Places are renumbered wholesale every time the queue is re-aimed
   * at the current view — which happens on every track change — and resetting
   * on that threw the reader back to the top while they were reading, in the
   * middle of ordinary playback. The length moves for an add or a remove, and
   * neither of those should move the scroll either.
   *
   * What genuinely means "this list is a different list" is the song at the
   * head of it changing without one having finished.
   */
  const firstTrackId = upNext[0]?.trackId;
  useLayoutEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
    setScrollTop(0);
  }, [firstTrackId]);

  /** Built from the index alone, so a queue change does not rebuild it. */
  const byId = useMemo(
    () => new Map(index.tracks.map((track) => [track.id, track])),
    [index.tracks],
  );

  const entries = useMemo(
    () =>
      buildEntries(
        upNext
          .map((entry) => ({
            position: entry.position,
            isAdded: entry.isAdded,
            track: byId.get(entry.trackId),
          }))
          .filter(
            (
              entry,
            ): entry is {
              position: number;
              isAdded: boolean;
              track: ILibraryTrack;
            } => entry.track !== undefined,
          ),
      ),
    [byId, upNext],
  );

  /** Where each entry starts, and how tall the whole list is. */
  const layout = useMemo(() => {
    const offsets: number[] = [];
    let y = 0;
    entries.forEach((entry) => {
      offsets.push(y);
      if (entry.kind === 'section') {
        y += SECTION_HEIGHT;
      } else if (entry.kind === 'heading') {
        y += HEADING_HEIGHT;
      } else {
        y += ROW_HEIGHT;
      }
    });
    return { offsets, height: y };
  }, [entries]);

  const rowWindow = useMemo(() => {
    const viewport = paneHeight || ROW_HEIGHT * 12;
    // CLAMPED TO THE LIST AS IT IS NOW, not as it was when this offset was
    // last read.
    //
    // The queue shortens under this panel all the time — choosing a song
    // drops everything above it, removing a row drops one — and the offset
    // held here is from before that happened. Left alone, the arithmetic ran
    // off the end: `start` landed past the last entry, so nothing mounted and
    // both spacers came out zero, and the panel went blank while the
    // scrollbar still claimed a list. That is the "it stops filling" and it
    // is intermittent because it needs the list to shrink under a scroll that
    // was already deep.
    const clamped = Math.max(
      0,
      Math.min(scrollTop, Math.max(0, layout.height - viewport)),
    );
    const top = clamped - OVERSCAN * ROW_HEIGHT;
    const bottom = clamped + viewport + OVERSCAN * ROW_HEIGHT;
    let start = 0;
    while (start < entries.length && layout.offsets[start] + ROW_HEIGHT < top) {
      start += 1;
    }
    let end = start;
    while (end < entries.length && layout.offsets[end] < bottom) {
      end += 1;
    }
    return { start, end };
  }, [entries.length, layout.height, layout.offsets, paneHeight, scrollTop]);

  /**
   * BOTH NUMBERS, because either one alone lies.
   *
   * The whole queue was "99", which is mostly the record already playing and
   * says nothing about the list being built. The picks alone read as "9" over
   * a panel holding fifty rows, which says the opposite. So: what was chosen,
   * lit, and what is coming altogether, quiet — and only the total when
   * nothing has been chosen yet.
   */
  const addedCount = upNext.filter((entry) => entry.isAdded).length;
  const trackCount = upNext.length;
  const listCount = upNextTotal(upNext, restTotal);
  // Clamped at zero, both of them. Widening the panel re-measures the
  // scrollport a frame after the list has already been re-laid out, and for
  // that frame the arithmetic can ask for a negative spacer — which the
  // browser answers by resetting the scroll position, which is the scrollbar
  // jumping about at the end of the list.
  const above = Math.max(0, layout.offsets[rowWindow.start] ?? 0);
  const below = Math.max(
    0,
    layout.height - (layout.offsets[rowWindow.end] ?? layout.height),
  );

  /** Dropped on a row moves before it; dropped on the list moves to the end. */
  const onDrop = (event: DragEvent<HTMLElement>, target?: number) => {
    event.preventDefault();
    if (draggingAt !== undefined) {
      moveUpNext(
        draggingAt,
        target ?? (upNext[upNext.length - 1]?.position ?? draggingAt) + 1,
      );
    }
    setDraggingAt(undefined);
  };

  return (
    <aside
      className={`library-up-next${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label={t('library.upNext')}
    >
      {/* The header is the fold, and says which way it will go by which way
          the chevron points. */}
      <button
        type="button"
        className="library-up-next__head"
        aria-expanded={!isCollapsed}
        onClick={() => onCollapsedChange(!isCollapsed)}
      >
        <svg className="library-up-next__caret" viewBox="0 0 16 16" aria-hidden>
          <path d="M4 6.5l4 4 4-4" />
        </svg>
        <span className="library-up-next__title">{t('library.upNext')}</span>
        <span className="library-up-next__count">
          {addedCount > 0 && (
            <b className="library-up-next__count-picked">{addedCount}</b>
          )}
          {addedCount > 0 && <span aria-hidden="true">/</span>}
          {listCount}
        </span>
      </button>
      {!isCollapsed && trackCount === 0 && (
        <p className="library-up-next__empty">{t('library.upNext.empty')}</p>
      )}
      {!isCollapsed && trackCount > 0 && (
        <div
          ref={listRef}
          className="library-up-next__list"
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => onDrop(event)}
        >
          {/* The entries that are not mounted, as height — without these the
              scrollbar would describe the handful on screen rather than the
              list. */}
          <div style={{ height: above }} aria-hidden="true" />
          {entries.slice(rowWindow.start, rowWindow.end).map((entry) => {
            if (entry.kind === 'section') {
              return (
                <p
                  key={entry.key}
                  className={`library-up-next__section${
                    entry.isAdded ? ' is-added' : ''
                  }`}
                >
                  {t(
                    entry.isAdded
                      ? 'library.upNext.added'
                      : 'library.upNext.rest',
                  )}
                </p>
              );
            }
            return entry.kind === 'heading' ? (
              <p key={entry.key} className="library-up-next__group">
                {entry.label}
              </p>
            ) : (
              <div
                key={entry.key}
                className={`library-up-next__entry${
                  draggingAt === entry.position ? ' is-dragging' : ''
                }`}
                draggable
                onDragStart={() => setDraggingAt(entry.position)}
                onDragEnd={() => setDraggingAt(undefined)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.stopPropagation();
                  onDrop(event, entry.position);
                }}
              >
                {/* The row is the control: every part of it means the same
                    thing — play this one now instead of waiting for it. */}
                <button
                  type="button"
                  className="library-up-next__row"
                  onClick={() => jumpToQueuePosition(entry.position)}
                >
                  <LibraryCoverArt
                    artId={entry.track.artId}
                    label={entry.track.title}
                    size="row"
                  />
                  <span className="library-up-next__text">
                    <span className="library-up-next__track">
                      {entry.track.title}
                    </span>
                    <span className="library-up-next__artist">
                      {entry.track.artist ?? ''}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="library-up-next__remove"
                  aria-label={t('library.queue.remove')}
                  title={t('library.queue.remove')}
                  onClick={() => removeUpNextAt(entry.position)}
                >
                  <svg viewBox="0 0 16 16" aria-hidden>
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            );
          })}
          <div style={{ height: below }} aria-hidden="true" />
        </div>
      )}
    </aside>
  );
};

export default LibraryUpNext;
