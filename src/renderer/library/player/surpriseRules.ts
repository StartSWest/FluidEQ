/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Surprise me asks the store, and what it does to the queue.
 *
 * Ivan, 2026-11-13: "a nice surprise play button in the Library, so it
 * starts playing any random music, and then Up Next continues with that
 * style; when the user clicks Surprise me again it changes to another random
 * song from the library, which may change the genre". The store draws the
 * song (`surprise` in `libraryTrackQuestions.ts`); these decide what it is
 * asked to avoid and which of the queue survives the answer.
 *
 * Pure, so each rule is held by a test rather than by a button somebody has
 * to press.
 */
import { ILibraryQueue, currentTrackId } from '../../../common/library/queue';
import { uniqueTrackIds } from './upNextRules';

/**
 * How many surprises are remembered and skipped while anything else is
 * left. Enough that a library of a few hundred songs goes a long way before
 * one comes round again; bounded, because the list is kept across launches.
 */
export const RECENT_SURPRISES = 50;

/**
 * How many of the last surprises' genres the next one moves away from,
 * beside the playing song's: the press after a jazz surprise and a salsa one
 * goes somewhere that is neither, when the library has somewhere else.
 */
export const AWAY_FROM_SURPRISES = 2;

export interface ISurpriseRequest {
  playing?: string;
  awayFrom: string[];
  exclude: string[];
}

/** The songs still ahead of the playhead, in the order they come. */
const idsAhead = (queue: ILibraryQueue): string[] =>
  queue.order
    .slice(queue.position + 1)
    .map((index) => queue.trackIds[index])
    .filter((id): id is string => id !== undefined);

/**
 * What to ask for: away from the playing song's genres and the last
 * surprises', and none of what was heard this session, what the queue holds
 * or what was surprised lately — the store relaxes those in order when the
 * library runs out, never the other way round.
 */
export const surpriseRequest = (
  queue: ILibraryQueue | undefined,
  played: Iterable<string>,
  recent: readonly string[],
): ISurpriseRequest => {
  const playing = queue ? currentTrackId(queue) : undefined;
  const awayFrom = uniqueTrackIds([
    ...(playing === undefined ? [] : [playing]),
    ...recent.slice(-AWAY_FROM_SURPRISES),
  ]);
  const exclude = uniqueTrackIds([
    ...played,
    ...recent,
    ...(queue ? queue.trackIds : []),
  ]);
  return playing === undefined
    ? { awayFrom, exclude }
    : { playing, awayFrom, exclude };
};

/**
 * The listener's own picks still ahead, in their order: what a surprise
 * keeps. Everything else ahead is the record they were in or Keep playing's
 * guesses, and a surprise is asking for something other than either.
 */
export const picksAhead = (
  queue: ILibraryQueue | undefined,
  isPick: (trackId: string) => boolean,
): string[] => (queue ? uniqueTrackIds(idsAhead(queue).filter(isPick)) : []);

/**
 * The queue a surprise leaves behind: the surprise, then the listener's
 * picks in their order, after the shuffle the queue already has — a list of
 * picks is an order somebody chose, never one to deal again.
 *
 * Repeat all becomes off. It means "the queue never runs out", and a queue
 * that is one surprise and nothing else would repeat that one song for ever
 * while Keep playing, which only answers a queue that runs out, waited for a
 * moment that never came. Repeat one stays: it was asked for this song.
 */
export const surpriseQueue = (
  built: ILibraryQueue,
  picks: readonly string[],
): ILibraryQueue => {
  const playing = currentTrackId(built);
  const joining = uniqueTrackIds(picks).filter(
    (id) => id !== playing && !built.trackIds.includes(id),
  );
  const base = built.trackIds.length;
  return {
    ...built,
    trackIds: [...built.trackIds, ...joining],
    order: [...built.order, ...joining.map((_, index) => base + index)],
    repeat: built.repeat === 'all' ? 'off' : built.repeat,
  };
};

/** The surprises remembered after `id`, newest last, each once. */
export const rememberSurprise = (
  recent: readonly string[],
  id: string,
): string[] =>
  [...recent.filter((kept) => kept !== id), id].slice(-RECENT_SURPRISES);
