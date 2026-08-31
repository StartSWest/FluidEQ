/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Remembering what was playing, and putting it back.
 *
 * Two halves of one promise. On the way in, the stored queue is rebuilt from
 * whichever of its tracks the library still knows, and the playhead is offered
 * back as a PENDING restore rather than applied — the loader decides when the
 * ranges are known well enough for a seek to land, and cues the track without
 * playing it. Coming back to the app and having it start making noise on its
 * own is the wrong side of the line between "where you were" and "what you
 * asked for".
 *
 * On the way out, the position is written from a ref rather than from state,
 * because the save runs on `pagehide` — a render is not guaranteed to have
 * happened between the last tick and the window going away.
 */
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useRef,
} from 'react';
import { ILibraryQueue } from '../../../common/library/queue';
import { ILibraryTrack } from '../../../common/library/types';
import {
  readPlaybackMemory,
  restorablePositionMs,
  writePlaybackMemory,
} from './playbackMemory';

export interface ISessionMemory {
  /**
   * Where the last session left off, offered to the loader rather than
   * applied here — see the ref's own comment.
   */
  pendingRestore: MutableRefObject<
    { trackId: string; positionMs: number } | undefined
  >;
}

export const useSessionMemory = (options: {
  queue: ILibraryQueue | undefined;
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  positionMs: number;
  trackById: Map<string, ILibraryTrack>;
  /** Everything the library knows, so a stored id can be checked. */
  libraryTracks: readonly ILibraryTrack[];
  setQueue: Dispatch<SetStateAction<ILibraryQueue | undefined>>;
  setPositionMs: (value: number) => void;
}): ISessionMemory => {
  const {
    queue,
    queueRef,
    positionMs,
    trackById,
    libraryTracks,
    setQueue,
    setPositionMs,
  } = options;

  /**
   * Where the last session left off, waiting for the element to be ready for
   * it.
   *
   * Applied on `loadedmetadata`, never at load time — assigning a position
   * while the element is still at `HAVE_NOTHING` is exactly what emptied the
   * seekable range and broke seeking for the whole of that load; see the
   * loader's own comment. Cleared as soon as it is used, so it can only ever
   * move the playhead once.
   */
  const pendingRestore = useRef<
    { trackId: string; positionMs: number } | undefined
  >(undefined);
  /** True until the stored session has been read back. Nothing is written
   * before that, or the first render's empty queue would erase the very
   * thing being restored. */
  const isRestoringRef = useRef(true);

  /**
   * Puts the last session's queue and playhead back, once.
   *
   * Waits for the index, because a queue is a list of ids and every one of
   * them has to still exist — a rescan that dropped the folder must leave
   * the player empty rather than pointing at files that are gone. Runs while
   * `libraryTracks` is empty on the very first render and simply does nothing,
   * then again when the index arrives.
   */
  useEffect(() => {
    if (!isRestoringRef.current || libraryTracks.length === 0) {
      return;
    }
    isRestoringRef.current = false;
    const memory = readPlaybackMemory();
    if (!memory) {
      return;
    }
    const survivors = memory.trackIds.filter((id) => trackById.has(id));
    if (survivors.length !== memory.trackIds.length) {
      // The library moved under it. Rebuilding a partial queue would silently
      // renumber `order` and put the reader on a different song than the one
      // they left, which is worse than starting empty.
      return;
    }
    const restoreTrackId = memory.trackIds[memory.order[memory.position]];
    const restoreMs = restorablePositionMs(
      memory.positionMs,
      trackById.get(restoreTrackId)?.durationMs,
    );
    /**
     * Cued, never started — and that is unconditional.
     *
     * These are two separate questions and they were answered by one `if`.
     * `restorablePositionMs` decides whether the PLAYHEAD is worth putting
     * back, and it declines under five seconds; but the loader reads this same
     * ref to decide whether to cue the track or call `play()` on it. So a
     * session that ended two seconds into a song set nothing here, fell through
     * to the play branch, and the app started making noise on its own at
     * launch.
     *
     * Whether to resume a position is a judgement. Whether to start playing
     * unasked is not.
     */
    pendingRestore.current = {
      trackId: restoreTrackId,
      positionMs: restoreMs ?? 0,
    };
    if (restoreMs !== undefined) {
      setPositionMs(restoreMs);
    }
    setQueue({
      trackIds: memory.trackIds,
      order: memory.order,
      position: memory.position,
      repeat: memory.repeat,
      isShuffled: memory.isShuffled,
    });
  }, [
    libraryTracks,
    trackById,
    setQueue,
    setPositionMs,
    pendingRestore,
    isRestoringRef,
  ]);

  /**
   * Records what is playing and how far in.
   *
   * On the queue rather than on `positionMs`, which changes four times a
   * second — the position is read at that moment through a ref, and the
   * `pagehide` listener below catches the far more common case of the window
   * simply going away mid-track.
   */
  const positionRef = useRef(positionMs);
  positionRef.current = positionMs;
  useEffect(() => {
    if (isRestoringRef.current) {
      return;
    }
    writePlaybackMemory(queue, positionRef.current);
  }, [queue, isRestoringRef]);

  useEffect(() => {
    const save = () => {
      if (!isRestoringRef.current) {
        writePlaybackMemory(queueRef.current, positionRef.current);
      }
    };
    // `pagehide` rather than `beforeunload`: it fires on the reload a hot
    // rebuild triggers as well as on the window closing, and unlike
    // `unload` it is not skipped when the page goes into the back/forward
    // cache.
    window.addEventListener('pagehide', save);
    return () => {
      window.removeEventListener('pagehide', save);
      save();
    };
    // Refs, spelled out because the rule cannot see they are stable through a
    // hook boundary.
  }, [isRestoringRef, queueRef]);

  return { pendingRestore };
};
