import { createHash } from 'crypto';
import type { IAccountConfig } from '../../common/accountConfig';
import {
  isSceneDownloadsPaused,
  type ISceneDownloadsPaused,
} from '../../common/sceneDownloads';

/**
 * Scene files from the server's R2 bucket (server migration 0117).
 *
 * The server's database and file store charge for every byte that leaves
 * them, and scene packs, pictures and clips were nearly all of it. They are
 * now kept in a private bucket that charges nothing for downloads, behind
 * links the `scene-media` function signs for two minutes. The function
 * decides everything: what this account may read (the same rules the old
 * paths enforce), whether the bucket holds it yet, and whether today's
 * allowance has room. This file only asks, downloads, and checks that the
 * bytes are the ones the server recorded.
 *
 * Every answer but a link and a refusal means "read it the old way" — the
 * switch is off, the file is not copied yet, the function is not deployed,
 * the network dropped — so the old paths go on serving until they are taken
 * away. A REFUSAL never falls back: an allowance used up stays used up.
 */

export type TSceneMediaItem = { object: string } | { pack: string };

export type TSceneMediaOutcome =
  /** The bytes, checked against the size and SHA-256 the server recorded. */
  | { kind: 'bytes'; bytes: Uint8Array; version?: number }
  /** Read it the old way. */
  | { kind: 'fallback' }
  /** Not this account's to read. */
  | { kind: 'refused' }
  /** Today's allowance, or the service's, is used up. */
  | { kind: 'paused'; paused: ISceneDownloadsPaused };

export interface ISceneMediaAuth {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/** The function's own limit per ask. */
const MAX_BATCH = 24;

type TLink =
  | {
      state: 'ready';
      url: string;
      bytes: number;
      sha256: string;
      version?: number;
    }
  | { state: 'fallback' }
  | { state: 'refused' }
  | { state: 'paused'; paused: ISceneDownloadsPaused };

interface IPending {
  auth: ISceneMediaAuth;
  item: TSceneMediaItem;
  resolve: (link: TLink) => void;
}

interface IConfigState {
  queue: IPending[];
  sending: boolean;
  /** `notLiveGeneration === generation`: the server said not live. */
  notLiveGeneration: number;
}

/**
 * Asked again at every come-back (`comeBackSignals.ts`): the switch may have
 * been turned on since the server last said it was off.
 */
let generation = 0;
const states = new WeakMap<IAccountConfig, IConfigState>();
const pauseListeners = new Set<(paused: ISceneDownloadsPaused) => void>();

const stateOf = (config: IAccountConfig): IConfigState => {
  let state = states.get(config);
  if (!state) {
    state = { queue: [], sending: false, notLiveGeneration: -1 };
    states.set(config, state);
  }
  return state;
};

/** Forgets every "not live" the server said, so the next download asks again. */
export const recheckSceneMedia = () => {
  generation += 1;
};

/** Told each time the server refuses a download for the allowance. */
export const onSceneDownloadsPaused = (
  listener: (paused: ISceneDownloadsPaused) => void,
): (() => void) => {
  pauseListeners.add(listener);
  return () => {
    pauseListeners.delete(listener);
  };
};

const SHA256_HEX = /^[0-9a-f]{64}$/;

const linkOf = (value: unknown): TLink => {
  if (typeof value !== 'object' || value === null || !('state' in value)) {
    return { state: 'fallback' };
  }
  if (value.state === 'refused') {
    return { state: 'refused' };
  }
  if (
    value.state === 'ready' &&
    'url' in value &&
    typeof value.url === 'string' &&
    value.url.startsWith('https://') &&
    'bytes' in value &&
    typeof value.bytes === 'number' &&
    Number.isSafeInteger(value.bytes) &&
    value.bytes > 0 &&
    'sha256' in value &&
    typeof value.sha256 === 'string' &&
    SHA256_HEX.test(value.sha256)
  ) {
    const version =
      'version' in value &&
      typeof value.version === 'number' &&
      Number.isSafeInteger(value.version)
        ? value.version
        : undefined;
    return {
      state: 'ready',
      url: value.url,
      bytes: value.bytes,
      sha256: value.sha256,
      ...(version === undefined ? {} : { version }),
    };
  }
  return { state: 'fallback' };
};

/** One ask to the function for up to 24 items of one account. */
const askOnce = async (
  auth: ISceneMediaAuth,
  items: readonly TSceneMediaItem[],
): Promise<TLink[]> => {
  const fallback = (): TLink[] => items.map(() => ({ state: 'fallback' }));
  const state = stateOf(auth.config);
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/scene-media`,
      {
        method: 'POST',
        headers: {
          apikey: auth.config.supabaseAnonKey,
          Authorization: `Bearer ${auth.accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ items }),
      },
    );
  } catch {
    return fallback();
  }
  if (response.status === 404) {
    // A server without the function: the old way, until the next come-back.
    state.notLiveGeneration = generation;
    return fallback();
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return fallback();
  }
  if (response.status === 429) {
    const paused =
      typeof body === 'object' && body !== null
        ? {
            reason: 'error' in body ? body.error : undefined,
            resetsAt: 'resetsAt' in body ? body.resetsAt : undefined,
          }
        : undefined;
    if (isSceneDownloadsPaused(paused)) {
      pauseListeners.forEach((listener) => listener(paused));
      return items.map(() => ({ state: 'paused', paused }));
    }
    return items.map(() => ({ state: 'refused' }));
  }
  if (!response.ok || typeof body !== 'object' || body === null) {
    return fallback();
  }
  if ('live' in body && body.live === false) {
    state.notLiveGeneration = generation;
  }
  const answered =
    'items' in body && Array.isArray(body.items) ? body.items : undefined;
  return answered && answered.length === items.length
    ? answered.map(linkOf)
    : fallback();
};

/**
 * Sends what is queued for one config, one account's batch at a time, until
 * the queue is empty. Asks made while one is on the way wait for it and go
 * together in the next, so a screen of tiles asking at once costs two calls,
 * not twelve.
 */
const drain = async (state: IConfigState) => {
  state.sending = true;
  try {
    while (state.queue.length > 0) {
      const { accessToken } = state.queue[0].auth;
      const batch = state.queue
        .filter((pending) => pending.auth.accessToken === accessToken)
        .slice(0, MAX_BATCH);
      state.queue = state.queue.filter((pending) => !batch.includes(pending));
      const links = await askOnce(
        batch[0].auth,
        batch.map((pending) => pending.item),
      );
      batch.forEach((pending, index) => pending.resolve(links[index]));
    }
  } finally {
    state.sending = false;
  }
};

const linkFor = (
  auth: ISceneMediaAuth,
  item: TSceneMediaItem,
): Promise<TLink> => {
  const state = stateOf(auth.config);
  if (state.notLiveGeneration === generation) {
    return Promise.resolve({ state: 'fallback' });
  }
  return new Promise<TLink>((resolve) => {
    state.queue.push({ auth, item, resolve });
    if (!state.sending) {
      state.sending = true;
      // After the current turn, so every ask made in it goes in one call:
      // a list of packs asked for together, the tiles of one render.
      queueMicrotask(() => {
        drain(state).catch((error) => {
          console.error('Asking for scene download links', error);
          state.queue
            .splice(0)
            .forEach((pending) => pending.resolve({ state: 'fallback' }));
        });
      });
    }
  });
};

/**
 * One scene file from R2: a bucket object by the name the old path reads it
 * by, or one of FluidEQ's own packs by scene id.
 */
export const fetchSceneMedia = async (
  auth: ISceneMediaAuth,
  item: TSceneMediaItem,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<TSceneMediaOutcome> => {
  const link = await linkFor(auth, item);
  if (link.state === 'refused') {
    return { kind: 'refused' };
  }
  if (link.state === 'paused') {
    return { kind: 'paused', paused: link.paused };
  }
  if (link.state === 'fallback' || link.bytes > maxBytes) {
    return { kind: 'fallback' };
  }
  try {
    // The link is the whole authority: no account token goes to R2.
    const response = await (auth.fetchImpl ?? fetch)(link.url, {
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      return { kind: 'fallback' };
    }
    // Read whole rather than streamed: see CLAUDE.md on `pipeline`.
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.length !== link.bytes ||
      createHash('sha256').update(bytes).digest('hex') !== link.sha256
    ) {
      // Not the bytes the server recorded: the old path has the real ones.
      return { kind: 'fallback' };
    }
    return {
      kind: 'bytes',
      bytes,
      ...(link.version === undefined ? {} : { version: link.version }),
    };
  } catch {
    return signal?.aborted ? { kind: 'refused' } : { kind: 'fallback' };
  }
};
