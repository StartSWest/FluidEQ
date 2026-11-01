/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Library was playing, and how far in, kept across restarts — and
 * what is safe to believe of it when it comes back.
 *
 * The app's core keeps it (`main/libraryPlayer/playbackFile.ts`); the window
 * kept it in its own storage until the player moved, and hands that copy
 * over once. Pure, so the rules are held by tests rather than by a restart.
 */
import type { ILibraryQueue, TLibraryRepeat } from './queue';

/** Positions nearer the start than this are not worth restoring: coming back
 * to a track two seconds in is indistinguishable from coming back to its
 * beginning, and the beginning is the less surprising of the two. */
export const MIN_RESTORE_MS = 5_000;
/** Nor nearer the end than this — restoring somebody to the last few seconds
 * of a song hands them a track that immediately ends. */
const END_MARGIN_MS = 5_000;

const REPEATS: readonly TLibraryRepeat[] = ['off', 'all', 'one'];

export interface IPlaybackMemory {
  trackIds: readonly string[];
  order: readonly number[];
  position: number;
  repeat: TLibraryRepeat;
  isShuffled: boolean;
  positionMs: number;
  /** The list on screen the queue was aimed at (`ILibraryQueue.source`), so
   * the same list after a restart tops it up instead of rebuilding the order
   * the listener made. */
  source?: string;
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

/**
 * Read what was stored, defensively.
 *
 * The file is user-editable and outlives the version that wrote it, so every
 * field is untrusted: anything malformed becomes "nothing was playing" rather
 * than a queue with holes in it that the player would then have to survive.
 * Every index in `order` is checked against the length of `trackIds`,
 * because an out-of-range index is the one corruption that would look valid
 * and then index past the end of the queue.
 *
 * NOT FOR BEING THE SAME LENGTH. Taking a song out of Up Next edits `order`
 * alone, so an `order` shorter than `trackIds` is an ordinary queue — and
 * checking the two for equal length threw the whole session away at the
 * next launch, every time a song had been taken out.
 */
export const parsePlaybackMemory = (
  parsed: unknown,
): IPlaybackMemory | undefined => {
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const value = parsed as Record<string, unknown>;
  const { trackIds, order } = value;
  if (!isStringArray(trackIds) || trackIds.length === 0) {
    return undefined;
  }
  if (
    !isNumberArray(order) ||
    order.some(
      (index) =>
        !Number.isInteger(index) || index < 0 || index >= trackIds.length,
    )
  ) {
    return undefined;
  }
  if (
    typeof value.position !== 'number' ||
    !Number.isInteger(value.position) ||
    value.position < 0 ||
    value.position >= order.length
  ) {
    return undefined;
  }
  const repeat = REPEATS.find((entry) => entry === value.repeat) ?? 'off';
  const positionMs =
    typeof value.positionMs === 'number' && Number.isFinite(value.positionMs)
      ? Math.max(0, value.positionMs)
      : 0;
  return {
    trackIds,
    order,
    position: value.position,
    repeat,
    isShuffled: value.isShuffled === true,
    positionMs,
    ...(typeof value.source === 'string' ? { source: value.source } : {}),
  };
};

/** The queue and playhead as they would be stored, or nothing to store. */
export const playbackMemoryOf = (
  queue: ILibraryQueue | undefined,
  positionMs: number,
): IPlaybackMemory | undefined =>
  !queue || queue.trackIds.length === 0
    ? undefined
    : {
        trackIds: [...queue.trackIds],
        order: [...queue.order],
        position: queue.position,
        repeat: queue.repeat,
        isShuffled: queue.isShuffled,
        positionMs: Math.max(0, positionMs),
        ...(queue.source === undefined ? {} : { source: queue.source }),
      };

/**
 * Whether the player keeps going once the queue runs out.
 *
 * ON unless explicitly stored off. Music that stops dead at the end of a
 * record is the surprising behaviour, not the other way round, and anybody
 * who wants a player that stops has the toggle in the Up Next panel — where
 * they can see what it did. Only an explicit false (or the window's old
 * `'off'`) turns it off, so a truncated or corrupt entry reads as the
 * default rather than as silence.
 */
export const parseContinuationSwitch = (raw: unknown): boolean =>
  raw !== false && raw !== 'off';

/**
 * The position worth resuming at, or nothing.
 *
 * `durationMs` is what the track's own tag says, which is why this tolerates
 * not knowing it: a pending track has no duration yet, and refusing to
 * restore in that case would mean the one launch after a scan forgets where
 * the reader was.
 */
export const restorablePositionMs = (
  storedMs: number,
  durationMs: number | undefined,
): number | undefined => {
  if (storedMs < MIN_RESTORE_MS) {
    return undefined;
  }
  if (durationMs !== undefined && durationMs > 0) {
    if (storedMs > durationMs - END_MARGIN_MS) {
      return undefined;
    }
  }
  return storedMs;
};

export interface IRestoredSession {
  queue: ILibraryQueue;
  /** The song the playhead goes back to, cued and never started. */
  trackId: string;
  /** Where in it, zero when the stored place was not worth resuming. */
  positionMs: number;
}

/**
 * The queue as it was, minus whatever the library no longer has.
 *
 * One missing file used to drop the whole thing — a scan that lost a folder,
 * or a track renamed, and a two-hundred-song queue came back empty, which the
 * next write then made permanent (Ivan, 2026-09-21: keep Up Next across a
 * restart). What is left is still the queue the listener had, in the order
 * they had it, so it is rebuilt from the survivors: the play order is
 * filtered, the ids renumbered against it — a queue may hold the same track
 * twice, so they are numbered by first appearance — and the playhead put back
 * on the song it was on, or the next one still there.
 *
 * `durationById` holds every stored song the library still has, with its
 * tagged duration where it knows one.
 */
export const restoreSession = (
  memory: IPlaybackMemory,
  durationById: ReadonlyMap<string, number | undefined>,
): IRestoredSession | undefined => {
  const playOrder = memory.order.map((index) => memory.trackIds[index]);
  const keptOrder = playOrder.filter((id) => durationById.has(id));
  if (keptOrder.length === 0) {
    return undefined;
  }
  const trackIds: string[] = [];
  keptOrder.forEach((id) => {
    if (!trackIds.includes(id)) {
      trackIds.push(id);
    }
  });
  const order = keptOrder.map((id) => trackIds.indexOf(id));
  // And the songs taken out of Up Next, still held though no longer queued,
  // as they were before the restart: the queue tops itself up with what it
  // has never held (`extendQueue`), so forgetting these brought each one
  // back the first time its list was asked for again.
  memory.trackIds.forEach((id) => {
    if (durationById.has(id) && !trackIds.includes(id)) {
      trackIds.push(id);
    }
  });
  const wantedId = playOrder[memory.position];
  const stillThere = durationById.has(wantedId)
    ? wantedId
    : playOrder.slice(memory.position).find((id) => durationById.has(id));
  const position = Math.max(
    0,
    stillThere === undefined ? 0 : keptOrder.indexOf(stillThere),
  );
  const trackId = keptOrder[position];
  return {
    queue: {
      trackIds,
      order,
      position,
      repeat: memory.repeat,
      isShuffled: memory.isShuffled,
      ...(memory.source === undefined ? {} : { source: memory.source }),
    },
    trackId,
    positionMs:
      restorablePositionMs(memory.positionMs, durationById.get(trackId)) ?? 0,
  };
};
