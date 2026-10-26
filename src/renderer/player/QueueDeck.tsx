/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { Fragment, useLayoutEffect, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { useTransportSources } from '../audio/transportSource';
import LibraryCoverArt from '../library/LibraryCoverArt';
import LibraryScanProgress from '../library/LibraryScanProgress';
import { formatDuration } from '../library/player/NowPlayingBar';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import QueueDropNotice from './QueueDropNotice';
import QueueNaming from './QueueSave';
import { useLibraryDeck } from './libraryDeck';
import type { TMusicDrop } from './useMusicDrop';

/**
 * The drag type a queue row carries, so a song being reordered and music
 * being dragged in from the computer never answer the same drag.
 */
const ROW_TYPE = 'application/x-fluideq-queue-row';

/**
 * The Library's play order, around the song playing: a few already played,
 * then what comes next. A press plays that song; the cross beside one still
 * to come takes it out, and while the queue's save key is pressed a line
 * over the list asks the name to keep the whole order under as a playlist.
 *
 * The queue is the Library's — online media, another program and another
 * computer have no list here to show — and before the Library has been
 * opened this session there is none, which the deck says, with the way to
 * the Library, rather than drawing an empty box.
 *
 * Each row has the grip it is dragged by, its cover, the song, its length
 * and the cross that takes it out (Ivan, 2026-10-25, the one amp); the song
 * playing is tinted and ringed in the accent.
 */
const QueueDeck = ({
  isNaming,
  onNamed,
  onOpenLibrary,
  musicDrop,
}: {
  isNaming: boolean;
  onNamed: () => void;
  onOpenLibrary: () => void;
  musicDrop: TMusicDrop;
}) => {
  const { t } = useTranslation();
  const library = useLibraryDeck();
  // THE LIBRARY'S OWN TRANSPORT, not whichever player the deck above is
  // showing. This list is the Library's queue, so a press starts the Library:
  // asking the deck's player instead, a press with a browser tab playing
  // moved the Library's playhead and started nothing.
  const transport = useTransportSources().library;
  const listRef = useRef<HTMLOListElement>(null);
  // The song under the playhead when the latest press began; see `restart`.
  const positionAtPressRef = useRef<number | undefined>(undefined);
  // Whether the list has been put at the song playing once since it was
  // drawn: the first time it is placed at once, every later time it glides.
  const isPlacedRef = useRef(false);
  // The row being dragged, and the row it would land before.
  const [draggingAt, setDraggingAt] = useState<number>();
  const [dropAt, setDropAt] = useState<number>();
  const nowRef = useRef<HTMLButtonElement>(null);
  const position = library?.position;
  const hasQueue = library !== undefined && library.total > 0;
  const fileDropAt = musicDrop.isOver ? musicDrop.dropAt : undefined;
  const markerAt = fileDropAt ?? dropAt;
  const lastShown = library?.items[library.items.length - 1]?.position;
  const markerEnd =
    fileDropAt !== undefined && lastShown !== undefined
      ? lastShown + 1
      : (library?.total ?? 0);

  // The upper/lower half of a row means before/after it, including a drop
  // on its cover, remove button, or the space after the last visible row.
  // History stays history: the earliest gap is after the song playing.
  const filePosition = (event: DragEvent<HTMLElement>) => {
    if (!library || !hasQueue) {
      return undefined;
    }
    const first = library.position + 1;
    const rows = listRef.current?.querySelectorAll<HTMLElement>(
      '[data-queue-position]',
    );
    const before = Array.from(rows ?? []).find((row) => {
      const { top, height } = row.getBoundingClientRect();
      return event.clientY < top + height / 2;
    });
    return Math.max(
      first,
      before
        ? Number(before.dataset.queuePosition)
        : (lastShown ?? library.position) + 1,
    );
  };
  /** Where Keep playing's songs still to come begin, if any are listed. */
  const firstGuessAhead = library?.items.find(
    (item) => item.isContinued === true && item.position > library.position,
  )?.position;

  /**
   * A press on a song plays it.
   *
   * Moving the playhead is not playing: pressing the song already under it
   * while the player is stopped changed nothing at all, and pressing
   * another one while stopped only loaded it (Ivan, 2026-09-21). So the
   * press starts the transport too, whenever it is not already running.
   */
  const play = (at: number) => {
    library?.jumpTo(at);
    if (transport && !transport.isPlaying && transport.canToggle !== false) {
      transport.toggle();
    }
  };

  /**
   * A DOUBLE-PRESS STARTS THE SONG AGAIN, even the one already playing.
   *
   * A single press moves the playhead, and moving it to where it already is
   * does nothing at all — so the row under the playhead was the one row in
   * the list that could not be pressed to any effect, and getting back to the
   * top of the song meant pressing another one and pressing back (Ivan,
   * 2026-09-22). Seeking to zero rather than reloading: the sound carries on
   * without a gap, and a source that cannot seek falls back to the press it
   * already had.
   *
   * Only a song that was ALREADY under the playhead when the double-press
   * began. By the time a double-press lands, its first press has moved the
   * playhead to a new song and started it from the top; seeking that one back
   * to nought would replay whatever of its opening had already been heard.
   */
  const restart = (at: number) => {
    if (at !== positionAtPressRef.current || !transport?.seek) {
      play(at);
      return;
    }
    transport.seek(0);
    if (!transport.isPlaying && transport.canToggle !== false) {
      transport.toggle();
    }
  };

  // The song playing stays in view as the queue moves on under it, and
  // otherwise the list stays exactly where it was scrolled to (Ivan,
  // 2026-10-25: "it needs to keep same scroll position, and if the song is
  // at the bottom, sure, scroll a bit further to show more below"): a row
  // that has come within a row and a half of the foot is brought that far
  // up, so what plays after it shows too; one above the top is brought down
  // into view with as much over it; a row anywhere else moves nothing. The
  // list is scrolled and nothing else: `scrollIntoView` scrolls every box
  // around it as well, and a new song would pull the player's own body away
  // from the equalizer somebody was using.
  //
  // MEASURED AGAINST THE LIST, never with `offsetTop`: that is measured from
  // the row's positioned parent, which is its own line in the list now (the
  // remove cross stands in it), so every row read as standing at the top and
  // a press on any song scrolled the list to the top ("when selecting an
  // item in the up next it is scrolling top").
  //
  // THE FIRST TIME THE LIST IS DRAWN it is simply there, at the song playing
  // with the one before it over it, whole — no glide from the top of the
  // queue to it (Ivan, 2026-10-25: "when the app opens in amp ui it animates
  // scroll to that current song, I don't want that, it needs to show
  // directly that position, also make sure it's on screen, not cut on top").
  //
  // WHOLE IN A SHORT LIST TOO. On a laptop's screen the list can be a row and
  // a half tall (`--player-shelf-least`): the row before the playing one goes
  // first, and no nudge takes the playing row past either edge. And a list
  // drawn folded has no height to place anything in, so it is placed the
  // moment it is given one.
  useLayoutEffect(() => {
    const list = listRef.current;
    const row = nowRef.current;
    if (!list || !row) {
      return undefined;
    }
    const measure = () => {
      const listBox = list.getBoundingClientRect();
      const rowBox = row.getBoundingClientRect();
      const top = rowBox.top - listBox.top + list.scrollTop;
      return { top, bottom: top + rowBox.height, height: rowBox.height };
    };
    if (!isPlacedRef.current) {
      const place = () => {
        const { top, bottom, height } = measure();
        if (list.clientHeight < height) {
          return false;
        }
        isPlacedRef.current = true;
        list.scrollTop = Math.max(0, bottom - list.clientHeight, top - height);
        return true;
      };
      if (place() || typeof ResizeObserver === 'undefined') {
        return undefined;
      }
      const observer = new ResizeObserver(() => {
        if (place()) {
          observer.disconnect();
        }
      });
      observer.observe(list);
      return () => observer.disconnect();
    }
    const { top, bottom, height } = measure();
    const margin = height * 1.5;
    if (top < list.scrollTop) {
      list.scrollTo({
        top: Math.max(0, bottom - list.clientHeight, top - margin),
        behavior: 'smooth',
      });
    } else if (bottom + margin > list.scrollTop + list.clientHeight) {
      list.scrollTo({
        top: Math.min(top, bottom + margin - list.clientHeight),
        behavior: 'smooth',
      });
    }
    return undefined;
  }, [position, hasQueue]);

  /**
   * A song being dragged to a different place in what is coming up.
   *
   * Only what is still ahead of the playhead: a song already played is a
   * record of what happened, and the queue refuses to move it anyway
   * (`moveUpNext`). Dropped ON a row it goes before that row; dropped past
   * the last one it goes to the end.
   */
  const canMove = (at: number) =>
    library !== undefined && at > library.position;

  const onRowDragStart = (event: DragEvent<HTMLElement>, at: number) => {
    if (!canMove(at)) {
      event.preventDefault();
      return;
    }
    // A type of our own, so the deck's file drop and this never answer the
    // same drag. `setData` is required or Firefox starts no drag at all.
    event.dataTransfer.setData(ROW_TYPE, String(at));
    event.dataTransfer.effectAllowed = 'move';
    setDraggingAt(at);
  };

  const onRowDragOver = (event: DragEvent<HTMLElement>, at: number) => {
    if (
      event.dataTransfer.types.includes('Files') ||
      draggingAt === undefined ||
      !canMove(at)
    ) {
      return;
    }
    event.preventDefault();
    // Stopped here, or the list under the row answers the same drag with
    // "after the last one".
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDropAt(at);
  };

  const onRowDrop = (event: DragEvent<HTMLElement>, at: number) => {
    if (
      event.dataTransfer.types.includes('Files') ||
      draggingAt === undefined
    ) {
      return;
    }
    // Stopped here, or the deck's own drop handler clears the file overlay
    // and reads an empty file list.
    event.preventDefault();
    event.stopPropagation();
    library?.move(draggingAt, at);
    setDraggingAt(undefined);
    setDropAt(undefined);
  };

  /**
   * Dropped on the list itself — the space under its last row — a song goes
   * to the end, as it does in the Library's own Up Next. Without this the
   * last place in the queue was the one place a song could not be dragged
   * to: every row means "before me", and there is no row after the last.
   */
  const end = library?.total ?? 0;
  const onListDragOver = (event: DragEvent<HTMLElement>) => {
    if (
      event.dataTransfer.types.includes('Files') ||
      draggingAt === undefined ||
      !canMove(end)
    ) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropAt(end);
  };

  const onListDrop = (event: DragEvent<HTMLElement>) => {
    if (
      event.dataTransfer.types.includes('Files') ||
      draggingAt === undefined
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    library?.move(draggingAt, end);
    setDraggingAt(undefined);
    setDropAt(undefined);
  };

  const endRowDrag = () => {
    setDraggingAt(undefined);
    setDropAt(undefined);
  };

  return (
    <section
      className="player-queue"
      aria-label={t('library.upNext')}
      onDragOver={(event) => musicDrop.onDragOver(event, filePosition(event))}
      onDragLeave={musicDrop.onDragLeave}
      onDrop={(event) => musicDrop.onDrop(event, filePosition(event))}
    >
      {hasQueue && isNaming && <QueueNaming onDone={onNamed} />}
      {library?.scanProgress ? (
        <LibraryScanProgress
          progress={library.scanProgress}
          onCancel={library.cancelScan}
        />
      ) : (
        <QueueDropNotice position={position} total={library?.total} />
      )}
      {hasQueue ? (
        <ol
          className={`player-queue__list${
            markerAt === markerEnd ? ' is-drop-after' : ''
          }${fileDropAt !== undefined ? ' is-file-drop' : ''}`}
          ref={listRef}
          onDragOver={onListDragOver}
          onDrop={onListDrop}
          // Captured ahead of the row's own press, so it still names the song
          // that was playing before that press moved the playhead.
          onClickCapture={(event) => {
            if (event.detail === 1) {
              positionAtPressRef.current = library.position;
            }
          }}
        >
          {library.items.map((item) => {
            const isNow = item.position === library.position;
            // "MORE LIKE THIS" STANDS APART from the listener's own list, as
            // it does in the Library's Up Next (Ivan, 2026-10-25: "as a
            // different section"): a heading over the first of Keep
            // playing's songs still to come. They only exist once the last
            // song queued is playing, so the heading only appears then.
            const startsGuesses =
              item.isContinued === true &&
              canMove(item.position) &&
              item.position === firstGuessAhead;
            return (
              <Fragment key={`${item.position}:${item.trackId}`}>
                {startsGuesses && (
                  <li className="player-queue__section" aria-hidden="true">
                    <span>{t('library.upNext.continued')}</span>
                  </li>
                )}
                <li
                  className={canMove(item.position) ? 'is-ahead' : undefined}
                  data-queue-position={item.position}
                >
                  <button
                    type="button"
                    ref={isNow ? nowRef : undefined}
                    className={`player-queue__row${isNow ? ' is-now' : ''}${
                      item.position < library.position ? ' is-played' : ''
                    }${draggingAt === item.position ? ' is-dragging' : ''}${
                      markerAt === item.position && draggingAt !== item.position
                        ? ' is-drop-before'
                        : ''
                    }`}
                    aria-current={isNow ? 'true' : undefined}
                    title={t('player.queue.play', { title: item.title })}
                    draggable={canMove(item.position)}
                    onClick={() => play(item.position)}
                    onDoubleClick={() => restart(item.position)}
                    onDragStart={(event) =>
                      onRowDragStart(event, item.position)
                    }
                    onDragOver={(event) => onRowDragOver(event, item.position)}
                    onDrop={(event) => onRowDrop(event, item.position)}
                    onDragEnd={endRowDrag}
                  >
                    <PlayerIcon
                      name="grip"
                      className="player-icon player-queue__grip"
                    />
                    <span className="player-queue__art">
                      <LibraryCoverArt
                        artId={item.artId}
                        label={item.title}
                        size="row"
                      />
                    </span>
                    <span className="player-queue__song">
                      <span className="player-queue__title">{item.title}</span>
                      {item.artist && (
                        <span className="player-queue__artist">
                          {item.artist}
                        </span>
                      )}
                    </span>
                    <span className="player-queue__time">
                      {item.durationMs ? formatDuration(item.durationMs) : ''}
                    </span>
                  </button>
                  {/* Beside the row and not in it, so a press on it is never a
                    press on the song. Only on what is still to come: what has
                    played is a record of what happened, and the song playing
                    is stopped from the transport. */}
                  {canMove(item.position) && (
                    <button
                      type="button"
                      className="player-queue__remove"
                      aria-label={t('library.queue.remove')}
                      title={t('library.queue.remove')}
                      onClick={() => library.remove(item.position)}
                    >
                      <PlayerIcon name="remove" />
                    </button>
                  )}
                </li>
              </Fragment>
            );
          })}
        </ol>
      ) : (
        <div className="player-queue__empty">
          <strong>{t('player.queue.emptyTitle')}</strong>
          <span>{t('player.queue.emptyNote')}</span>
          <button
            type="button"
            className="button small subtle player-queue__open"
            title={t('player.queue.openLibraryHint')}
            onClick={onOpenLibrary}
          >
            {t('tabs.library')}
            <PlayerIcon name="chevronRight" />
          </button>
        </div>
      )}
    </section>
  );
};

export default QueueDeck;
