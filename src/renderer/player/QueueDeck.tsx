/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, DragEvent } from 'react';
import { libraryFileKind } from 'common/library/files';
import { useTransportSources } from '../audio/transportSource';
import LibraryCoverArt from '../library/LibraryCoverArt';
import { formatDuration } from '../library/player/NowPlayingBar';
import { useTranslation } from '../utils/I18nContext';
import PlayerIcon from './PlayerIcon';
import { useLibraryDeck } from './libraryDeck';

/**
 * The drag type a queue row carries, so a song being reordered and music
 * being dragged in from the computer never answer the same drag.
 */
const ROW_TYPE = 'application/x-fluideq-queue-row';

/** A queue's length, which runs past an hour where a song's never does. */
const formatTotal = (ms: number) => {
  const whole = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(whole / 3600);
  if (hours === 0) {
    return formatDuration(ms);
  }
  const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
  const seconds = String(whole % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
};

/**
 * The Library's play order, around the song playing: a few already played,
 * then what comes next. A press plays that song.
 *
 * The queue is the Library's — online media, another program and another
 * computer have no list here to show — and before the Library has been
 * opened this session there is none, which the deck says, with the way to
 * the Library, rather than drawing an empty box.
 */
const QueueDeck = ({ onOpenLibrary }: { onOpenLibrary: () => void }) => {
  const { t } = useTranslation();
  const library = useLibraryDeck();
  // THE LIBRARY'S OWN TRANSPORT, not whichever player the deck above is
  // showing. This list is the Library's queue, so its bars say whether the
  // Library is sounding, and a press starts the Library: asking the deck's
  // player instead, a press with a browser tab playing moved the Library's
  // playhead and started nothing.
  const transport = useTransportSources().library;
  const isSounding = transport?.isPlaying === true;
  const listRef = useRef<HTMLOListElement>(null);
  // The song under the playhead when the latest press began; see `restart`.
  const positionAtPressRef = useRef<number | undefined>(undefined);
  // True while a drag carrying files is over the deck, so it can say it will
  // take them.
  const [isDropTarget, setIsDropTarget] = useState(false);
  // The row being dragged, and the row it would land before.
  const [draggingAt, setDraggingAt] = useState<number>();
  const [dropAt, setDropAt] = useState<number>();
  const nowRef = useRef<HTMLButtonElement>(null);
  const position = library?.position;
  const hasQueue = library !== undefined && library.total > 0;

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

  // The song playing stays in view as the queue moves on under it. The list
  // is scrolled and nothing else: `scrollIntoView` scrolls every box around
  // it as well, and a new song would pull the player's own body away from
  // the equalizer somebody was using.
  useEffect(() => {
    const list = listRef.current;
    const row = nowRef.current;
    if (!list || !row) {
      return;
    }
    const top = row.offsetTop;
    const bottom = top + row.offsetHeight;
    if (top < list.scrollTop) {
      list.scrollTop = top;
    } else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = bottom - list.clientHeight;
    }
  }, [position, hasQueue]);

  /**
   * Music dragged in from the computer.
   *
   * `webUtils.getPathForFile` is the only source of a dropped file's path —
   * `File.path` was removed from Electron — and what comes back is handed
   * across. ONLY THE KINDS THE LIBRARY TAKES (Ivan, 2026-09-22: "the same we
   * allow in the library"): the same audio and video extensions its scan
   * admits (`libraryFileKind`), decided here by name so a folder's stray
   * cover art and text never leave the page, and again in main, which is
   * where a path is checked for being local, real and a file.
   */
  const droppedPaths = (event: DragEvent<HTMLElement>) =>
    Array.from(event.dataTransfer.files)
      .filter((file) => libraryFileKind(file.name) !== undefined)
      .map((file) => {
        try {
          return window.electron?.ipcRenderer.getPathForFile?.(file) ?? '';
        } catch {
          return '';
        }
      })
      .filter((path) => path.length > 0);

  const onDragOver = (event: DragEvent<HTMLElement>) => {
    // Without this the browser refuses the drop outright. Only for a drag
    // carrying files: a row being dragged within the queue carries `ROW_TYPE`
    // instead, and a drag of selected text should not light the deck up.
    if (!event.dataTransfer.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    setIsDropTarget(true);
  };

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
    if (draggingAt === undefined || !canMove(at)) {
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
    if (draggingAt === undefined) {
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
    if (draggingAt === undefined || !canMove(end)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropAt(end);
  };

  const onListDrop = (event: DragEvent<HTMLElement>) => {
    if (draggingAt === undefined) {
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

  const onDragLeave = (event: DragEvent<HTMLElement>) => {
    // The pointer crossing onto a row inside the deck is not leaving it.
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setIsDropTarget(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDropTarget(false);
    const paths = droppedPaths(event);
    if (paths.length && library) {
      library.addFiles(paths).catch(() => undefined);
    }
  };

  return (
    <section
      className={`player-queue${isDropTarget ? ' is-drop-target' : ''}`}
      aria-label={t('library.upNext')}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Over the deck rather than in its flow: a message that pushed the
          list down would move the rows out from under the pointer that is
          about to let go of them. */}
      {isDropTarget && (
        <div className="player-queue__drop" aria-hidden="true">
          <PlayerIcon name="chevronRight" />
          <span>{t('player.queue.drop')}</span>
        </div>
      )}
      {/* THE HEAD IS AN INSTRUMENT, not a caption (Ivan, 2026-09-22: "make
          this piece nicer"). Where the playhead stands and how much is still
          to come, each on the readout the deck's own display uses — the
          figure in ink, the rest dim — and between them and the Library key
          a thin line lit as far through the queue as the playhead has got.
          The figures carry no words, so the three languages that put the
          total before the position read them the same; the words are on
          each readout's hover. */}
      <div className="player-queue__head">
        <span className="player-eyebrow">{t('library.upNext')}</span>
        {hasQueue && (
          <>
            <span
              className="player-readout player-queue__readout"
              title={t('player.queue.summary', {
                position: library.position + 1,
                total: library.total,
              })}
            >
              <b>{library.position + 1}</b>
              <small>/ {library.total}</small>
            </span>
            <span
              className="player-readout player-queue__readout"
              title={t('player.queue.leftHint', {
                duration: formatTotal(library.leftDurationMs),
              })}
            >
              <PlayerIcon
                name="clock"
                className="player-icon player-icon--readout"
              />
              <b>{formatTotal(library.leftDurationMs)}</b>
            </span>
            <span
              className="player-queue__progress"
              aria-hidden="true"
              style={
                {
                  '--queue-progress':
                    (library.position + 1) / Math.max(1, library.total),
                } as CSSProperties
              }
            />
          </>
        )}
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
      {hasQueue ? (
        <ol
          className={`player-queue__list${
            dropAt === end && draggingAt !== undefined ? ' is-drop-after' : ''
          }`}
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
            return (
              <li key={`${item.position}:${item.trackId}`}>
                <button
                  type="button"
                  ref={isNow ? nowRef : undefined}
                  className={`player-queue__row${isNow ? ' is-now' : ''}${
                    item.position < library.position ? ' is-played' : ''
                  }${draggingAt === item.position ? ' is-dragging' : ''}${
                    dropAt === item.position && draggingAt !== item.position
                      ? ' is-drop-before'
                      : ''
                  }`}
                  aria-current={isNow ? 'true' : undefined}
                  title={t('player.queue.play', { title: item.title })}
                  draggable={canMove(item.position)}
                  onClick={() => play(item.position)}
                  onDoubleClick={() => restart(item.position)}
                  onDragStart={(event) => onRowDragStart(event, item.position)}
                  onDragOver={(event) => onRowDragOver(event, item.position)}
                  onDrop={(event) => onRowDrop(event, item.position)}
                  onDragEnd={endRowDrag}
                >
                  <span className="player-queue__number" aria-hidden="true">
                    {/* Still while the song is paused: the bars say "this is
                        sounding", and a paused song is not (Ivan,
                        2026-09-23). They stop where they stood rather than
                        leaving, so the song under the playhead keeps its
                        mark, and pick up from there when it plays again. */}
                    {isNow ? (
                      <span
                        className={`player-queue__bars${
                          isSounding ? '' : ' is-still'
                        }`}
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : (
                      item.position + 1
                    )}
                  </span>
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
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="player-queue__empty">
          <strong>{t('player.queue.emptyTitle')}</strong>
          <span>{t('player.queue.emptyNote')}</span>
        </div>
      )}
    </section>
  );
};

export default QueueDeck;
