/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * HOW A DATABASE OR FEED SYNC WRITES ITSELF INTO THE LOG.
 *
 * One line per event, the same shape for every feed, so a bug report reads as
 * a list of facts rather than a page of stack (Ivan, 2026-11-13: "maybe
 * infrequent errors, but we need to log them and make sure they record
 * nicely"):
 *
 *   <feed>: <what happened> (<why>); <what happens next>.
 *
 * An expected network or HTTP condition — offline, a rate limit, a 404, a
 * 5xx — is a `SyncFeedError` and gets this line and nothing else. Anything
 * that is not one is a bug in the app and keeps its stack, logged by the
 * caller with `log.error` and the feed's name.
 */
export interface ISyncLogLine {
  feed: string;
  what: string;
  why: string;
  next: string;
}

export const syncLogLine = ({ feed, what, why, next }: ISyncLogLine) =>
  `${feed}: ${what} (${why}); ${next}.`;

const two = (value: number) => String(value).padStart(2, '0');

/** `20:05 (2026-11-13T20:05:33.000Z)`: the reader's clock, then the instant. */
export const syncLogTime = (at: number) => {
  const date = new Date(at);
  return `${two(date.getHours())}:${two(date.getMinutes())} (${date.toISOString()})`;
};

export type TSyncFailure = 'offline' | 'http' | 'invalid';

/**
 * An expected way for a sync to fail. `why` is said as it stands in the log
 * line: "HTTP 503", "offline or unreachable: fetch failed", "the published
 * manifest is not a manifest".
 */
export class SyncFeedError extends Error {
  readonly failure: TSyncFailure;

  readonly why: string;

  constructor(failure: TSyncFailure, why: string) {
    super(why);
    this.name = 'SyncFeedError';
    this.failure = failure;
    this.why = why;
  }
}

export const isSyncFeedError = (error: unknown): error is SyncFeedError =>
  error instanceof SyncFeedError;

/** A rejected `fetch` (no network, DNS, TLS, reset) as the failure it is. */
export const offlineError = (error: unknown) => {
  // Node's fetch says only "fetch failed"; what failed (DNS, refused, TLS)
  // is in its cause.
  const reason: unknown =
    error instanceof Error && 'cause' in error ? error.cause : undefined;
  const cause =
    reason instanceof Error && reason.message ? `: ${reason.message}` : '';
  const message = error instanceof Error ? error.message : String(error);
  return new SyncFeedError(
    'offline',
    `offline or unreachable: ${message}${cause}`,
  );
};
