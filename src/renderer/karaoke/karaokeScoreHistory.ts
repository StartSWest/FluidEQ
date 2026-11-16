/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// Each song's sung attempts, kept in this window's local storage beside the
// workspace's other remembered choices (`karaokeWorkspacePrefs.ts`): the
// best one, and the last six for the end-of-song card's bars.

const SCORE_HISTORY_KEY = 'fluideq-karaoke-score-history';
/** The bars on the card: this attempt and the five before it. */
export const KARAOKE_ATTEMPTS_KEPT = 6;
/**
 * Songs remembered at most, the least recently sung forgotten first. A song
 * with a hundred lines costs about 2 KB, so the whole entry stays far under
 * the storage's quota however many songs are sung.
 */
const SONGS_KEPT = 120;

export interface IKaraokeAttempt {
  /** When it was sung, ms since the epoch. */
  at: number;
  score: number;
  /** Each scored line's 0-100, null for a line nothing of was judged. */
  lines: (number | null)[];
}

export interface IKaraokeSongHistory {
  best: IKaraokeAttempt | undefined;
  /** Oldest first, at most `KARAOKE_ATTEMPTS_KEPT`. */
  attempts: IKaraokeAttempt[];
}

const EMPTY: IKaraokeSongHistory = { best: undefined, attempts: [] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toAttempt = (value: unknown): IKaraokeAttempt | undefined => {
  if (
    !isRecord(value) ||
    typeof value.at !== 'number' ||
    typeof value.score !== 'number' ||
    !Array.isArray(value.lines)
  ) {
    return undefined;
  }
  return {
    at: value.at,
    score: value.score,
    lines: value.lines.map((line: unknown) =>
      typeof line === 'number' ? line : null,
    ),
  };
};

const toHistory = (value: unknown): IKaraokeSongHistory => {
  if (!isRecord(value)) {
    return EMPTY;
  }
  const attempts = Array.isArray(value.attempts)
    ? value.attempts
        .map(toAttempt)
        .filter((attempt): attempt is IKaraokeAttempt => attempt !== undefined)
        .slice(-KARAOKE_ATTEMPTS_KEPT)
    : [];
  return { best: toAttempt(value.best), attempts };
};

const readAll = (): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(SCORE_HISTORY_KEY) ?? '{}',
    );
    return isRecord(parsed) ? parsed : {};
  } catch {
    // Unreadable or unavailable storage remembers nothing.
    return {};
  }
};

export const readKaraokeSongHistory = (songId: string): IKaraokeSongHistory =>
  toHistory(readAll()[songId]);

const lastSungAt = (history: IKaraokeSongHistory): number =>
  history.attempts[history.attempts.length - 1]?.at ?? 0;

/**
 * Add an attempt to a song's history and keep it if it is the best; the
 * history as it now stands. The history before it is the caller's to read
 * first, for "a new best" and the line-by-line comparison.
 */
export const recordKaraokeAttempt = (
  songId: string,
  attempt: IKaraokeAttempt,
): IKaraokeSongHistory => {
  const all = readAll();
  const before = toHistory(all[songId]);
  const next: IKaraokeSongHistory = {
    best:
      before.best && before.best.score >= attempt.score ? before.best : attempt,
    attempts: [...before.attempts, attempt].slice(-KARAOKE_ATTEMPTS_KEPT),
  };
  const kept = Object.entries({ ...all, [songId]: next })
    .map(([id, history]) => [id, toHistory(history)] as const)
    .sort(([, left], [, right]) => lastSungAt(right) - lastSungAt(left))
    .slice(0, SONGS_KEPT);
  try {
    window.localStorage.setItem(
      SCORE_HISTORY_KEY,
      JSON.stringify(Object.fromEntries(kept)),
    );
  } catch {
    // Storage full or unavailable: the card still shows this attempt.
  }
  return next;
};
