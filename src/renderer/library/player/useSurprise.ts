/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Surprise me: a song from anywhere in the library, now, and Up Next
 * carrying on in its style.
 *
 * The carrying on is Keep playing's, unchanged (`useUpNext`): a surprise
 * starts as a queue of itself, and the last song of a queue is exactly when
 * Keep playing draws ten more of its genre. Nothing here draws a second
 * list, and nothing here waits on a clock — a press asks the store once and
 * plays the answer.
 *
 * Split out of `LibraryPlayerContext` beside the other commands that each
 * own one decision.
 */
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useRef,
  useState,
} from 'react';
import type { ILibraryQueue } from '../../../common/library/queue';
import { readRecentSurprises, writeRecentSurprises } from './playbackMemory';
import {
  picksAhead,
  rememberSurprise,
  surpriseQueue,
  surpriseRequest,
} from './surpriseRules';

/** The last surprise started, numbered so the same song twice is two. */
export interface ILastSurprise {
  trackId: string;
  serial: number;
}

export interface ISurprise {
  /** Starts a surprise; answers the song started, or null for none. */
  surprise: () => Promise<string | null>;
  /** What the draw (`SurpriseDrawLayer`) plays for: the last one started. */
  lastSurprise: ILastSurprise | undefined;
}

export const useSurprise = (options: {
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  /** The listener's own picks, which a surprise keeps. */
  addedIdsRef: MutableRefObject<ReadonlySet<string>>;
  /** Everything heard this session, skipped while anything else is left. */
  playedIdsRef: { readonly current: ReadonlySet<string> };
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  setQueue: (
    update: (current: ILibraryQueue | undefined) => ILibraryQueue | undefined,
  ) => void;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
}): ISurprise => {
  const {
    queueRef,
    addedIdsRef,
    playedIdsRef,
    playTracks,
    setQueue,
    setAddedIds,
  } = options;

  /** Read from storage on the first press, not on every render. */
  const recentRef = useRef<string[] | undefined>(undefined);
  /**
   * One ask at a time. Two quick presses would otherwise draw two songs and
   * start them one after the other; the second press means "another one",
   * which a press after the first answer still says.
   */
  const askingRef = useRef(false);
  const [lastSurprise, setLastSurprise] = useState<ILastSurprise | undefined>(
    undefined,
  );

  const surprise = useCallback(async (): Promise<string | null> => {
    if (askingRef.current) {
      return null;
    }
    askingRef.current = true;
    try {
      recentRef.current ??= readRecentSurprises();
      const recent = recentRef.current;
      const picked = await window.electron.ipcRenderer.queryLibrary({
        type: 'surprise',
        ...surpriseRequest(queueRef.current, playedIdsRef.current, recent),
      });
      if (picked === null) {
        return null;
      }
      const remembered = rememberSurprise(recent, picked);
      recentRef.current = remembered;
      writeRecentSurprises(remembered);
      // Read after the answer: the queue may have moved on while it was out.
      const picks = picksAhead(queueRef.current, (id) =>
        addedIdsRef.current.has(id),
      );
      playTracks([picked], picked);
      // In the same turn as the play, after it: `playTracks` forgets the
      // picks and builds the queue from the surprise alone, and these put
      // the picks back behind it in their own order. State updates given as
      // functions run in the order they were asked, so the play's own
      // clearing comes first and these land on the queue it built.
      if (picks.length > 0) {
        setAddedIds(() => new Set(picks));
      }
      setQueue((current) =>
        current ? surpriseQueue(current, picks) : current,
      );
      setLastSurprise((current) => ({
        trackId: picked,
        serial: (current?.serial ?? 0) + 1,
      }));
      return picked;
    } catch (error: unknown) {
      // eslint-disable-next-line no-console -- context-rich error before it is dropped; the press simply starts nothing
      console.error('Could not draw a song to surprise with', error);
      return null;
    } finally {
      askingRef.current = false;
    }
  }, [addedIdsRef, playTracks, playedIdsRef, queueRef, setAddedIds, setQueue]);

  return { surprise, lastSurprise };
};
