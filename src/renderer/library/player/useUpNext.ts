/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What is coming, and where each of it came from.
 *
 * The Up Next list is not simply "the rest of the queue". Three different
 * answers share it and the panel heads them separately, so each entry has to
 * remember which it is: the record the listener chose and is playing through,
 * the tracks they added by hand, and the guesses continuation appended when
 * the list was running out.
 *
 * Continuation itself lives here too, and one rule about it is worth keeping
 * where it can be seen: **it is not a timer and must never become one.** The
 * condition is how much is left ahead of the playhead, which changes exactly
 * when the queue does — so the queue changing is the trigger, and nothing else
 * needs to wake up to check.
 *
 * Split out of `LibraryPlayerContext` because none of it makes a sound. It
 * decides what a list says, which is a different job from playing the thing at
 * the top of it.
 */
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CONTINUATION_LOW_WATER,
  pickContinuation,
} from '../../../common/library/continuation';
import { ILibraryQueue, currentTrackId } from '../../../common/library/queue';
import { ILibraryTrack } from '../../../common/library/types';
import {
  readStoredContinuation,
  writeStoredContinuation,
} from './playbackMemory';

/** One row of Up Next, tagged with which of the three lists it came from. */
export interface IUpNextEntry {
  position: number;
  trackId: string;
  /** The listener put this here by hand. */
  isAdded: boolean;
  /** Continuation guessed it, which is a third thing and heads its own group. */
  isContinued: boolean;
}

export interface IUpNext {
  upNext: readonly IUpNextEntry[];
  isContinuationOn: boolean;
  setIsContinuationOn: (value: boolean) => void;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
  addedIdsRef: React.MutableRefObject<ReadonlySet<string>>;
  continuedIdsRef: React.MutableRefObject<ReadonlySet<string>>;
}

export const useUpNext = (options: {
  queue: ILibraryQueue | undefined;
  trackId: string | undefined;
  trackById: Map<string, ILibraryTrack>;
  /** Everything the library knows, which is where continuation draws from. */
  libraryTracks: readonly ILibraryTrack[];
  setQueue: (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => void;
}): IUpNext => {
  const { queue, trackId, trackById, libraryTracks, setQueue } = options;

  /**
   * KEEP PLAYING WHEN THE LIST RUNS OUT.
   *
   * A queue is whatever shelf was being read, and a shelf ends: `advanceQueue`
   * holds at the last entry and `handleEnded` stops there. That is right for a
   * player with nothing queued and wrong for somebody who put a record on —
   * the answer arrives as silence with no explanation, which is the shape of
   * failure this project's rules are written against.
   *
   * So when the run ahead gets short, more of the same genre is drawn from
   * the whole library and appended. `pickContinuation` owns the choosing and
   * is pure; this owns only when to ask.
   *
   * NOT A TIMER, and it must never become one: the condition is how much is
   * left ahead of the playhead, which changes exactly when the queue does.
   */
  const [isContinuationOn, setIsContinuationOn] = useState<boolean>(
    readStoredContinuation,
  );
  useEffect(() => {
    writeStoredContinuation(isContinuationOn);
  }, [isContinuationOn]);

  /** Ids this drew, so the panel can head them as their own run rather than
   * passing them off as the rest of the record. */
  const [continuedIds, setContinuedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Read by `retargetQueue` for the same reason `addedIdsRef` is: that
  // callback has no dependencies and must see the set as it is when the view
  // changes, not as it was when the callback was made.
  const continuedIdsRef = useRef(continuedIds);
  continuedIdsRef.current = continuedIds;

  /**
   * Everything played this session.
   *
   * Kept so continuation never hands back a song that has just been heard —
   * a genre of forty tracks would otherwise start repeating itself inside an
   * hour, which reads as the feature being broken rather than as a small
   * pool. A ref rather than state: nothing renders from it, and a set that
   * grew by one every three minutes would re-render every consumer of this
   * context for it.
   */
  const playedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (trackId !== undefined) {
      playedIds.current.add(trackId);
    }
  }, [trackId]);

  useEffect(() => {
    // `repeat` other than 'off' means the queue never runs out — 'all' wraps
    // and 'one' holds — so there is nothing here to answer.
    if (!isContinuationOn || !queue || queue.repeat !== 'off') {
      return;
    }
    const ahead = queue.order.length - queue.position - 1;
    if (ahead >= CONTINUATION_LOW_WATER) {
      return;
    }
    const playing = currentTrackId(queue);
    const seed = playing === undefined ? undefined : trackById.get(playing);
    // A film ending is not a request for more films. Continuation is about
    // music carrying on in the background; `pickContinuation` draws audio
    // only, and seeding it from a video would answer a question nobody asked.
    if (!seed || seed.kind !== 'audio') {
      return;
    }
    const exclude = new Set([...queue.trackIds, ...playedIds.current]);
    const picked = pickContinuation(libraryTracks, seed, exclude);
    if (picked.length === 0) {
      // Nothing left in the genre that has not been heard. The player stops
      // at the end of the run, which is the honest answer — better than
      // starting the same forty songs again without being asked.
      return;
    }
    setContinuedIds((current) => {
      const next = new Set(current);
      picked.forEach((id) => next.add(id));
      return next;
    });
    // AT THE END, not after the playhead: what sits directly after the
    // current track is the listener's own picks, and a continuation that
    // pushed itself in front of them would answer a decision they made with
    // a guess this made.
    setQueue((current) => {
      if (!current) {
        return current;
      }
      const base = current.trackIds.length;
      return {
        ...current,
        trackIds: [...current.trackIds, ...picked],
        order: [...current.order, ...picked.map((_, index) => base + index)],
      };
    });
  }, [isContinuationOn, queue, libraryTracks, trackById, setQueue]);

  /**
   * The ids the listener added by hand, ever.
   *
   * Kept beside the queue rather than inside it because the queue's job is
   * unchanged — it is still one run of tracks with a position in it, and the
   * added ones are spliced into that run so everything downstream (advance,
   * repeat, shuffle, the loader) needs to know nothing about where a track
   * came from. This set is only what tells the panel which of them to draw.
   */
  const [addedIds, setAddedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // Read by `retargetQueue`, which runs from a callback with no dependencies
  // — it must see the set as it is when the view changes, not as it was when
  // that callback was made.
  const addedIdsRef = useRef(addedIds);
  addedIdsRef.current = addedIds;

  /**
   * Everything still ahead of the playhead, in the order it arrives.
   *
   * What was added by hand sits at the front of it — `appendToQueue` splices
   * those in right after the current track — and the rest of the album, the
   * folder or the shelf follows. A list that showed ONLY hand-picked entries
   * was empty for the ordinary case of pressing play on a record and reading
   * as broken; a list that shows what is genuinely coming answers the
   * question either way.
   */
  const upNext = useMemo(() => {
    if (!queue) {
      return [];
    }
    return queue.order
      .slice(queue.position + 1)
      .map((trackIndex, offset) => {
        const trackId = queue.trackIds[trackIndex];
        return {
          position: queue.position + 1 + offset,
          trackId,
          // Which half of the list this belongs to: a decision the listener
          // made, or the record they happen to be playing through. The panel
          // draws the two under headings of their own — the whole point of
          // showing both is being able to tell them apart.
          isAdded: trackId !== undefined && addedIds.has(trackId),
          // Drawn by continuation rather than by the shelf. A third answer to
          // the same question the two above split, and it has to be its own:
          // heading a guess as "then" would claim the record does not end.
          isContinued: trackId !== undefined && continuedIds.has(trackId),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          position: number;
          trackId: string;
          isAdded: boolean;
          isContinued: boolean;
        } => entry.trackId !== undefined,
      );
  }, [addedIds, continuedIds, queue]);

  return {
    upNext,
    isContinuationOn,
    setIsContinuationOn,
    setAddedIds,
    addedIdsRef,
    continuedIdsRef,
  };
};
