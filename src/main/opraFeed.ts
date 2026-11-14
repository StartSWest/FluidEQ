/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IOpraDatabaseManifest } from '../common/profileTypes';

/**
 * WHERE THE OPRA LIBRARY IS PUBLISHED, AND HOW OFTEN IT IS ASKED.
 *
 * One fixed prerelease, `opra-database`, holds the manifest and the archive
 * (the database workflow uploads both there). A release download is served
 * from github.com and its CDN, not from api.github.com, so it is not counted
 * against the REST API's 60 unauthenticated requests an hour per address. The
 * updater used to list the last twenty releases through that API on every
 * launch and every visit to the headphone page; a few dev restarts, or a
 * hundred users behind one office or carrier address, spent the hour and
 * every check after it came back 403 with a stack in the log (Ivan,
 * 2026-11-13).
 *
 * Asked at most once a day per machine, and conditionally: the ETag and
 * Last-Modified of the manifest last read go back as If-None-Match and
 * If-Modified-Since, so an unchanged library costs a 304 and no body. A 403 or
 * 429 is a rate limit: the reset the server names (Retry-After, else
 * X-RateLimit-Reset) is kept, and nothing is asked until it has passed.
 * Whether a day has passed is read from the clock at the moment of asking,
 * never from a timer.
 */
export const OPRA_FEED_BASE =
  'https://github.com/StartSWest/FluidEQ/releases/download/opra-database';
export const OPRA_MANIFEST_URL = `${OPRA_FEED_BASE}/opra-version.json`;
export const OPRA_ARCHIVE_URL = `${OPRA_FEED_BASE}/opra-database.zip`;

export const OPRA_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** How long to stay away after a rate limit that names no reset. */
const DEFAULT_BACKOFF_MS = 60 * 60 * 1000;

/** What one machine remembers between launches (`opra-feed.json`). */
export interface IOpraFeedState {
  /** When the manifest was last asked for and answered (ms since epoch). */
  checkedAt?: number;
  etag?: string;
  lastModified?: string;
  /** The manifest those validators belong to. */
  latest?: IOpraDatabaseManifest;
  /** Nothing is asked before this (ms since epoch): a rate limit's reset. */
  notBefore?: number;
}

export type TOpraFeedOutcome =
  /** Asked within the day: the remembered manifest, no request. */
  | 'remembered'
  /** Asked, and the server said 304: the remembered manifest stands. */
  | 'unchanged'
  /** Asked, and a manifest came back. */
  | 'read'
  /** Rate limited, now or still: nothing asked until `notBefore`. */
  | 'rate-limited'
  /** Asked, and nothing is published there yet (404). */
  | 'missing';

export interface IOpraFeedAnswer {
  outcome: TOpraFeedOutcome;
  latest?: IOpraDatabaseManifest;
  state: IOpraFeedState;
}

type TFetch = (url: string, init: RequestInit) => Promise<Response>;

const isManifest = (value: unknown): value is IOpraDatabaseManifest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const manifest = value as Record<string, unknown>;
  return (
    manifest.version === 1 &&
    typeof manifest.contentHash === 'string' &&
    manifest.contentHash.length > 0 &&
    typeof manifest.productCount === 'number' &&
    typeof manifest.vendorCount === 'number' &&
    typeof manifest.curveCount === 'number' &&
    typeof manifest.generatedAt === 'string'
  );
};

/** The state file's contents, or nothing for anything that is not one. */
export const parseOpraFeedState = (
  text: string | undefined,
): IOpraFeedState => {
  if (!text) {
    return {};
  }
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== 'object' || value === null) {
      return {};
    }
    const raw = value as Record<string, unknown>;
    const time = (key: string) =>
      typeof raw[key] === 'number' && Number.isFinite(raw[key])
        ? (raw[key] as number)
        : undefined;
    const word = (key: string) =>
      typeof raw[key] === 'string' ? (raw[key] as string) : undefined;
    return {
      checkedAt: time('checkedAt'),
      notBefore: time('notBefore'),
      etag: word('etag'),
      lastModified: word('lastModified'),
      latest: isManifest(raw.latest) ? raw.latest : undefined,
    };
  } catch {
    return {};
  }
};

/**
 * When a rate-limited answer says the limit lifts: Retry-After in seconds (or
 * as a date), else X-RateLimit-Reset in epoch seconds, else an hour from now.
 */
export const rateLimitResetAt = (headers: Headers, now: number): number => {
  const retryAfter = headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return now + seconds * 1000;
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date) && date > now) {
      return date;
    }
  }
  const reset = Number(headers.get('x-ratelimit-reset'));
  if (Number.isFinite(reset) && reset * 1000 > now) {
    return reset * 1000;
  }
  return now + DEFAULT_BACKOFF_MS;
};

/**
 * The newest published manifest, asking the server only when a day has passed
 * since the last answer and no rate limit is still running.
 *
 * Returns the state to keep; nothing here touches the disk, so the decision is
 * the same in a test as on a machine.
 */
export const readOpraManifest = async (
  state: IOpraFeedState,
  now: number,
  request: TFetch,
): Promise<IOpraFeedAnswer> => {
  if (state.notBefore !== undefined && now < state.notBefore) {
    return { outcome: 'rate-limited', latest: state.latest, state };
  }
  if (
    state.latest &&
    state.checkedAt !== undefined &&
    now >= state.checkedAt &&
    now - state.checkedAt < OPRA_CHECK_INTERVAL_MS
  ) {
    return { outcome: 'remembered', latest: state.latest, state };
  }

  // Validators only alongside the manifest they describe: a 304 with nothing
  // remembered to stand for would leave no manifest at all.
  const headers: Record<string, string> = {
    'User-Agent': 'FluidEQ-Opra-Updater',
  };
  if (state.latest && state.etag) {
    headers['If-None-Match'] = state.etag;
  }
  if (state.latest && state.lastModified) {
    headers['If-Modified-Since'] = state.lastModified;
  }
  const response = await request(OPRA_MANIFEST_URL, { headers });

  if (response.status === 304 && state.latest) {
    const next = { ...state, checkedAt: now, notBefore: undefined };
    return { outcome: 'unchanged', latest: state.latest, state: next };
  }
  if (response.status === 403 || response.status === 429) {
    const next = {
      ...state,
      notBefore: rateLimitResetAt(response.headers, now),
    };
    return { outcome: 'rate-limited', latest: state.latest, state: next };
  }
  if (response.status === 404) {
    // Not published yet. Asked again tomorrow, not at every launch.
    const next = { ...state, checkedAt: now, notBefore: undefined };
    return { outcome: 'missing', latest: state.latest, state: next };
  }
  if (!response.ok) {
    throw new Error(`The OPRA manifest returned HTTP ${response.status}`);
  }
  const manifest: unknown = await response.json();
  if (!isManifest(manifest)) {
    throw new Error('The published OPRA manifest is not a manifest.');
  }
  const next: IOpraFeedState = {
    checkedAt: now,
    etag: response.headers.get('etag') ?? undefined,
    lastModified: response.headers.get('last-modified') ?? undefined,
    latest: manifest,
  };
  return { outcome: 'read', latest: manifest, state: next };
};
