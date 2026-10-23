/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  isSceneStore,
  lookIdOfOwned,
  mayPlayAnything,
  mayPlayLook,
  type ISceneStore,
  type TBuyOutcome,
  type TCheckoutFailure,
  type TCheckoutLocale,
  type TSceneStoreOutcome,
  type TStarterOutcome,
} from '../../common/sceneStore';
import type { IAccountConfig } from '../../common/accountConfig';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import type { IEncryptedJsonStore } from '../encryptedJsonStore';
import type { IGalleryAuth } from './galleryAccess';
import {
  buyScene,
  claimStarterCredits,
  fetchSceneStore,
  setOfficialSceneFree,
  startCreditCheckout,
} from './sceneStoreApi';

/**
 * Which scenes the signed-in account may play: the ones it bought, its own
 * once published, and — until the cutover ends Plus — every other scene
 * while it is a Plus member (`mayPlayLook`).
 *
 * Every gate in main asks `owns(lookId)`, the graph's load, the desktop
 * background and the desk lights alike, so a scene is one answer wherever it
 * plays. The answer is the server's `my_store`, kept on disk with the
 * credential cipher like the membership: a scene bought is the buyer's for
 * good, and being offline must not take it away.
 *
 * The server is asked at events, never on a clock (`comeBackSignals.ts`), and
 * after every buy. Paying happens in the browser, which the app cannot hear,
 * so once somebody is sent to the checkout every event asks until the
 * balance they left with has changed — the entitlement's `expectChange`, for
 * the same reason.
 */

export interface ISceneStoreRecord {
  userId: string;
  store: ISceneStore;
}

export const isSceneStoreRecord = (
  value: unknown,
): value is ISceneStoreRecord =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Record<string, unknown>).userId === 'string' &&
  isSceneStore((value as Record<string, unknown>).store);

/** As the membership: an event asks again once the last answer is this old. */
export const SCENE_STORE_STALE_AFTER_MS = 4 * 60 * 60 * 1000;

export interface ISceneOwnership {
  /** Whether this account may play this look anywhere, right now. */
  owns(lookId: string): boolean;
  /** Whether any scene at all is this account's to play: Plus, or one bought. */
  ownsAnything(): boolean;
  /** The last store the server gave the signed-in account. */
  known(): ISceneStore | undefined;
  /** Hear about anything that changes `owns`: a buy, an account, Plus. */
  subscribe(listener: () => void): () => void;
  refreshIfDue(reason: string): Promise<void>;
  refreshNow(): Promise<TSceneStoreOutcome>;
  buy(scene: { authorId: string; sceneId: string }): Promise<TBuyOutcome>;
  claimStarter(): Promise<TStarterOutcome>;
  /**
   * The admin makes one of FluidEQ's scenes free, or paid again; the store
   * is read again so every gate follows at once.
   */
  setFree(sceneId: string, free: boolean): Promise<TSceneStoreOutcome>;
  /** A Stripe page to pay for the pack, in this language; the caller opens it. */
  checkout(
    packId: string,
    locale: TCheckoutLocale,
  ): Promise<
    { ok: true; url: string } | { ok: false; reason: TCheckoutFailure }
  >;
  dispose(): void;
}

export interface ISceneOwnershipDeps {
  config: IAccountConfig;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  entitlement: Pick<IEntitlement, 'status' | 'subscribe'>;
  onIdentityChange: (listener: () => void) => () => void;
  store: IEncryptedJsonStore<ISceneStoreRecord>;
  logger?: { warn(message: string): void };
  now?: () => number;
  fetchImpl?: typeof fetch;
}

const sameStore = (a: ISceneStore | undefined, b: ISceneStore) =>
  a !== undefined && JSON.stringify(a) === JSON.stringify(b);

export const createSceneOwnership = ({
  config,
  session,
  entitlement,
  onIdentityChange,
  store,
  logger,
  now = Date.now,
  fetchImpl = fetch,
}: ISceneOwnershipDeps): ISceneOwnership => {
  let record: ISceneStoreRecord | undefined;
  // Read the first time the cipher can read it, as the membership is: this is
  // built before Electron's `ready`, when Windows reports the cipher missing.
  let loaded = false;
  let checkedAt = 0;
  let checkedFor: string | undefined;
  /** The balance somebody left for the checkout with, while it is owed. */
  let awaiting: { userId: string; balance: number } | undefined;
  let inFlight:
    { userId: string; promise: Promise<TSceneStoreOutcome> } | undefined;
  const listeners = new Set<() => void>();

  const accountId = () => session.state().identity?.id;

  const stored = () => {
    if (!loaded && store.available()) {
      record = store.read();
      loaded = true;
    }
    return record;
  };

  const known = (): ISceneStore | undefined => {
    const current = stored();
    const id = accountId();
    return current && id && current.userId === id ? current.store : undefined;
  };

  const announce = () => listeners.forEach((listener) => listener());

  const adopt = (userId: string, next: ISceneStore) => {
    if (awaiting?.userId === userId && awaiting.balance !== next.balance) {
      awaiting = undefined;
    }
    if (record?.userId === userId && sameStore(record.store, next)) {
      return;
    }
    record = { userId, store: next };
    loaded = true;
    if (store.available()) {
      store.write(record);
    }
    announce();
  };

  const authFor = async (userId: string): Promise<IGalleryAuth | undefined> => {
    try {
      const accessToken = await session.accessToken();
      return accessToken && accountId() === userId
        ? { config, accessToken, fetchImpl }
        : undefined;
    } catch {
      return undefined;
    }
  };

  const ask = async (userId: string): Promise<TSceneStoreOutcome> => {
    const auth = await authFor(userId);
    if (!auth) {
      return { ok: false, reason: 'signed-out' };
    }
    const answer = await fetchSceneStore(auth);
    if (accountId() !== userId) {
      return { ok: false, reason: 'signed-out' };
    }
    if (answer.ok || answer.reason !== 'offline') {
      // Only a server that answered counts: offline asks again next event.
      checkedAt = now();
      checkedFor = userId;
    }
    if (!answer.ok) {
      if (answer.reason === 'server') {
        logger?.warn('The scene store could not be read.');
      }
      const last = known();
      return last
        ? { ok: false, reason: answer.reason, known: last }
        : { ok: false, reason: answer.reason };
    }
    adopt(userId, answer.store);
    return answer;
  };

  const refreshNow = (): Promise<TSceneStoreOutcome> => {
    const userId = accountId();
    if (!userId) {
      return Promise.resolve({ ok: false, reason: 'signed-out' });
    }
    if (inFlight?.userId === userId) {
      return inFlight.promise;
    }
    const promise = ask(userId).finally(() => {
      if (inFlight?.promise === promise) {
        inFlight = undefined;
      }
    });
    inFlight = { userId, promise };
    return promise;
  };

  // The reason is the caller's, for its own log; every event asks the same.
  const refreshIfDue = async () => {
    const userId = accountId();
    if (!userId) {
      return;
    }
    if (
      awaiting?.userId === userId ||
      checkedFor !== userId ||
      now() - checkedAt >= SCENE_STORE_STALE_AFTER_MS
    ) {
      await refreshNow();
    }
  };

  /** After the server said yes: the store read again, or the yes alone. */
  const afterChange = async (
    userId: string,
    fallback: (last: ISceneStore) => ISceneStore,
  ): Promise<ISceneStore | undefined> => {
    const refreshed = await refreshNow();
    if (refreshed.ok) {
      return refreshed.store;
    }
    const last = known();
    if (!last || accountId() !== userId) {
      return undefined;
    }
    const next = fallback(last);
    adopt(userId, next);
    return next;
  };

  const plusMember = () =>
    accountId() !== undefined && entitlement.status().state !== 'none';

  const offEntitlement = entitlement.subscribe(announce);
  const offIdentity = onIdentityChange(() => {
    awaiting = undefined;
    announce();
    refreshIfDue().catch(() => undefined);
  });

  return {
    owns: (lookId) =>
      mayPlayLook({
        lookId,
        accountId: accountId(),
        plus: plusMember(),
        store: known(),
      }),
    ownsAnything: () =>
      accountId() !== undefined && mayPlayAnything(plusMember(), known()),
    known,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refreshIfDue,
    refreshNow,
    buy: async (scene) => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const bought = await buyScene(auth, scene);
      if (!bought.ok) {
        // `already-owned` means this computer's copy of the store is behind.
        if (bought.reason === 'already-owned') {
          refreshNow().catch(() => undefined);
        }
        return bought;
      }
      const lookId = lookIdOfOwned(scene.authorId, scene.sceneId);
      const next = await afterChange(userId, (last) => ({
        ...last,
        balance: last.balance - 1,
        owned:
          lookId && !last.owned.includes(lookId)
            ? [...last.owned, lookId]
            : last.owned,
      }));
      return next
        ? { ok: true, store: next }
        : { ok: false, reason: 'signed-out' };
    },
    claimStarter: async () => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const claimed = await claimStarterCredits(auth);
      if (!claimed.ok) {
        return claimed;
      }
      const refreshed = await refreshNow();
      return refreshed.ok
        ? { ok: true, store: refreshed.store }
        : { ok: false, reason: refreshed.reason };
    },
    setFree: async (sceneId, free) => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const set = await setOfficialSceneFree(auth, sceneId, free);
      return set.ok ? refreshNow() : set;
    },
    checkout: async (packId, locale) => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const page = await startCreditCheckout(auth, packId, locale);
      if (page.ok && accountId() === userId) {
        awaiting = { userId, balance: known()?.balance ?? 0 };
      }
      return page;
    },
    dispose: () => {
      offEntitlement();
      offIdentity();
      listeners.clear();
    },
  };
};
