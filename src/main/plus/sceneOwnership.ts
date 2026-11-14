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
  type TSuspensionRefundOutcome,
} from '../../common/sceneStore';
import type { IAccountConfig } from '../../common/accountConfig';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import type { IEncryptedJsonStore } from '../encryptedJsonStore';
import type { ICreditsPush } from './creditsPush';
import type { IGalleryAuth } from './galleryAccess';
import {
  buyScene,
  claimStarterCredits,
  dismissNotices,
  fetchSceneStore,
  requestSuspensionRefund,
  startCreditCheckout,
} from './sceneStoreApi';

/**
 * Which scenes the signed-in account may play: the ones it bought, its own
 * whether published or not, and — until the cutover ends Plus — every other
 * scene while it is a Plus member (`mayPlayLook`).
 *
 * Every gate in main asks `owns(lookId)`, the graph's load, the desktop
 * background and the desk lights alike, so a scene is one answer wherever it
 * plays. The answer is the server's `my_store`, kept on disk with the
 * credential cipher like the membership: a scene bought is the buyer's for
 * good, and being offline must not take it away.
 *
 * The server is asked at events, never on a clock (`comeBackSignals.ts`), and
 * after every buy. Paying happens in the browser, so once somebody is sent to
 * the checkout the server's push is listened to (`creditsPush.ts`) and every
 * event asks too, until the balance they left with has changed — the push so
 * the credits arrive with the window behind the browser, the events for a
 * server that does not push, or a socket that dropped.
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
  /**
   * Whether any scene at all is this account's to play (`mayPlayAnything`):
   * one bought or free, or one of `held`, the looks this computer holds —
   * which is where a maker's own scene still waiting for review is.
   */
  ownsAnything(held: readonly string[]): boolean;
  /** The last store the server gave the signed-in account. */
  known(): ISceneStore | undefined;
  /** Hear about anything that changes `owns`: a buy, an account, Plus. */
  subscribe(listener: () => void): () => void;
  /**
   * Hear how many credits a pack paid for in the browser brought, once, at
   * the moment its payment is confirmed: the first store after the checkout
   * opened whose balance is above the one it opened from. Never at launch
   * (nothing is owed then) and never on a refresh while nothing is owed.
   */
  onCreditsArrived(listener: (credits: number) => void): () => void;
  refreshIfDue(reason: string): Promise<void>;
  refreshNow(): Promise<TSceneStoreOutcome>;
  buy(scene: { authorId: string; sceneId: string }): Promise<TBuyOutcome>;
  claimStarter(): Promise<TStarterOutcome>;
  /** A Stripe page to pay for the pack, in this language; the caller opens it. */
  checkout(
    packId: string,
    locale: TCheckoutLocale,
  ): Promise<
    { ok: true; url: string } | { ok: false; reason: TCheckoutFailure }
  >;
  /** A suspended account's refund asked for; the store read again after. */
  requestSuspensionRefund(): Promise<TSuspensionRefundOutcome>;
  /** Notices read, taken out of the store here and on the server. */
  dismissNotices(ids: readonly number[]): Promise<void>;
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
  /** The server's word that the credits moved, heard while a payment is owed. */
  createCreditsPush?: (onCredits: () => void) => ICreditsPush;
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
  createCreditsPush,
}: ISceneOwnershipDeps): ISceneOwnership => {
  let record: ISceneStoreRecord | undefined;
  // Read the first time the cipher can read it, as the membership is: this is
  // built before Electron's `ready`, when Windows reports the cipher missing.
  let loaded = false;
  let checkedAt = 0;
  let checkedFor: string | undefined;
  /** The balance somebody left for the checkout with, while it is owed. */
  let awaiting: { userId: string; balance: number } | undefined;
  // Listened to exactly while a payment is owed, and asked for the store
  // whenever it says the credits moved.
  const push = createCreditsPush?.(() => {
    refreshNow().catch(() => undefined);
  });
  const owe = (next: typeof awaiting) => {
    awaiting = next;
    if (next) {
      push?.watch();
    } else {
      push?.stop();
    }
  };
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
  const arrivals = new Set<(credits: number) => void>();

  const adopt = (userId: string, next: ISceneStore) => {
    // The balance the checkout opened from has moved: the payment is
    // settled, and it is settled once, here, because the wait ends with it.
    // A fall (a scene bought meanwhile) settles the wait and brings nothing.
    let arrived = 0;
    if (awaiting?.userId === userId && awaiting.balance !== next.balance) {
      arrived = next.balance - awaiting.balance;
      owe(undefined);
    }
    if (record?.userId !== userId || !sameStore(record.store, next)) {
      record = { userId, store: next };
      loaded = true;
      if (store.available()) {
        store.write(record);
      }
      announce();
    }
    // After the store itself has gone out, so the window that celebrates the
    // credits already shows them in the balance they fly to.
    if (arrived > 0) {
      arrivals.forEach((listener) => listener(arrived));
    }
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
    if (awaiting?.userId === userId) {
      // A socket that dropped and stopped rejoining listens again from here.
      push?.watch();
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
    owe(undefined);
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
    ownsAnything: (held) =>
      mayPlayAnything({
        accountId: accountId(),
        plus: plusMember(),
        store: known(),
        held,
      }),
    known,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onCreditsArrived: (listener) => {
      arrivals.add(listener);
      return () => {
        arrivals.delete(listener);
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
    checkout: async (packId, locale) => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const page = await startCreditCheckout(auth, packId, locale);
      if (page.ok && accountId() === userId) {
        owe({ userId, balance: known()?.balance ?? 0 });
      }
      return page;
    },
    requestSuspensionRefund: async () => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth) {
        return { ok: false, reason: 'signed-out' };
      }
      const asked = await requestSuspensionRefund(auth);
      if (!asked.ok) {
        return asked;
      }
      const refreshed = await refreshNow();
      return refreshed.ok
        ? { ok: true, store: refreshed.store }
        : { ok: false, reason: refreshed.reason };
    },
    dismissNotices: async (ids) => {
      const userId = accountId();
      const auth = userId ? await authFor(userId) : undefined;
      if (!userId || !auth || ids.length === 0) {
        return;
      }
      // Taken out here at once, so the window does not show them again
      // while the server is asked; a server that did not hear it gives them
      // back with the next store, and they are shown once more then.
      const last = known();
      if (last?.notices) {
        const left = last.notices.filter((notice) => !ids.includes(notice.id));
        const next: ISceneStore = { ...last, notices: left };
        if (left.length === 0) {
          delete next.notices;
        }
        adopt(userId, next);
      }
      await dismissNotices(auth, ids);
    },
    dispose: () => {
      push?.stop();
      offEntitlement();
      offIdentity();
      listeners.clear();
    },
  };
};
