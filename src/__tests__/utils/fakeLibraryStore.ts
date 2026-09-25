/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act } from '@testing-library/react';
import { pickContinuation } from '../../common/library/continuation';
import type {
  ILibraryAnswers,
  ILibrarySummary,
  TLibraryRequest,
} from '../../common/library/query';
import type {
  ILibraryRoot,
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../common/library/types';

/**
 * Rounds of answers `settle` gives before calling it a loop. A launch that
 * restores a queue takes four — the summary, the stored queue's songs, the
 * songs the restored queue names, and what to play once it runs out — so ten
 * is past anything a render asks for honestly, and short of a hang.
 */
const MAX_ROUNDS = 10;

interface IWaitingQuestion {
  give: () => void;
  given: Promise<unknown>;
}

/** The members of `window.electron.ipcRenderer` the library is read through. */
export interface IFakeLibraryBridge {
  getLibrarySummary: () => Promise<ILibrarySummary>;
  onLibraryChanged: (
    listener: (summary: ILibrarySummary) => void,
  ) => () => void;
  onLibraryScanProgress: (
    listener: (progress: ILibraryScanProgress) => void,
  ) => () => void;
  queryLibrary: (
    request: TLibraryRequest,
  ) => Promise<ILibraryAnswers[TLibraryRequest['type']]>;
}

export interface IFakeLibraryStore {
  bridge: IFakeLibraryBridge;
  /** A scan's result: the store now holds these songs, and says so. */
  setTracks: (tracks: readonly ILibraryTrack[]) => void;
  /** `library-root-remove`: the folder and every song under it go. */
  removeRoot: (rootId: string) => void;
  /** Answers everything asked so far, and whatever those answers lead to. */
  settle: () => Promise<void>;
}

/**
 * The library's store in main, as the window reaches it: the summary, the
 * broadcast every change sends, and the questions asked by id — the songs
 * a queue names, how long they run, and what to play when a queue runs out.
 *
 * NOTHING IS ANSWERED WHEN IT IS ASKED. Main answers over IPC, a turn later
 * at the earliest, and the player treats a song it has not been told about
 * yet differently from one the store has said is gone. An answer handed back
 * on the spot would hide exactly that gap, so answers wait for `settle`, which
 * gives them inside `act` and keeps going for as long as the renders they
 * cause ask something new.
 *
 * Each answer is main's own (`libraryTrackQuestions.ts`): songs in the order
 * their ids were listed, a missing id simply absent; a duration summed over
 * the ids as listed; a continuation by `pickContinuation`'s rules, drawn
 * without chance so a test reads the same every run. A question it does not
 * answer fails the `settle` that reached it rather than leaving a caller
 * waiting on nothing.
 */
const createFakeLibraryStore = (
  roots: readonly ILibraryRoot[],
  initialTracks: readonly ILibraryTrack[],
): IFakeLibraryStore => {
  let version = 1;
  let heldRoots = [...roots];
  let tracks = [...initialTracks];
  const listeners = new Set<(summary: ILibrarySummary) => void>();
  const waiting: IWaitingQuestion[] = [];
  const refused: string[] = [];

  const summary = (): ILibrarySummary => ({
    version,
    roots: heldRoots,
    trackCount: tracks.filter((track) => track.kind === 'audio').length,
    videoCount: tracks.filter((track) => track.kind === 'video').length,
    wasReset: false,
  });

  const byId = (id: string) => tracks.find((track) => track.id === id);

  const answer = (
    request: TLibraryRequest,
  ): ILibraryAnswers[TLibraryRequest['type']] => {
    switch (request.type) {
      case 'tracks':
        return request.ids.flatMap((id) => {
          const track = byId(id);
          return track === undefined ? [] : [track];
        });
      case 'duration':
        return request.ids.reduce(
          (total, id) => total + (byId(id)?.durationMs ?? 0),
          0,
        );
      case 'continuation': {
        const seed = byId(request.seedId);
        return seed === undefined
          ? []
          : pickContinuation(
              tracks,
              seed,
              new Set(request.exclude),
              request.count,
              () => 0,
            );
      }
      default:
        throw new Error(
          `The fake library store does not answer '${request.type}'`,
        );
    }
  };

  const ask = <T>(compute: () => T): Promise<T> => {
    let give: () => void = () => undefined;
    const given = new Promise<T>((resolve, reject) => {
      give = () => {
        try {
          resolve(compute());
        } catch (error) {
          refused.push(error instanceof Error ? error.message : String(error));
          reject(error);
        }
      };
    });
    waiting.push({ give, given });
    return given;
  };

  const broadcast = () => {
    version += 1;
    const next = summary();
    listeners.forEach((listener) => listener(next));
  };

  const answerRounds = async (round: number): Promise<void> => {
    if (waiting.length === 0) {
      return;
    }
    if (round === MAX_ROUNDS) {
      throw new Error(
        `The library was still being asked after ${MAX_ROUNDS} rounds of answers: something asks again on every answer`,
      );
    }
    const batch = waiting.splice(0, waiting.length);
    await act(async () => {
      batch.forEach(({ give }) => give());
      // The callers' own continuations were attached first, so they have run
      // — and set their state — by the time every answer here has settled.
      await Promise.allSettled(batch.map(({ given }) => given));
    });
    if (refused.length > 0) {
      throw new Error(refused.splice(0, refused.length).join('\n'));
    }
    await answerRounds(round + 1);
  };

  return {
    bridge: {
      getLibrarySummary: () => ask(summary),
      onLibraryChanged: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      onLibraryScanProgress: () => () => undefined,
      queryLibrary: (request) => ask(() => answer(request)),
    },
    setTracks: (next) => {
      tracks = [...next];
      broadcast();
    },
    removeRoot: (rootId) => {
      heldRoots = heldRoots.filter((root) => root.id !== rootId);
      tracks = tracks.filter((track) => track.rootId !== rootId);
      broadcast();
    },
    settle: () => answerRounds(0),
  };
};

export default createFakeLibraryStore;
