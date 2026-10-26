/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import {
  mayPlayAnything,
  mayPlayLook,
  type ISceneStore,
  type TBuyOutcome,
  type TCheckoutOutcome,
  type TStarterOutcome,
  type TStoreFailure,
} from 'common/sceneStore';
import { getAccountSnapshot, subscribeAccount } from '../account/accountStore';
import {
  getEntitlementSnapshot,
  subscribeEntitlement,
} from '../account/entitlementStore';

/**
 * The account's credits and the scenes it owns, as the window sees them.
 *
 * Main holds the answer (`plus/sceneOwnership.ts`) and pushes every change;
 * this asks it again when somebody is back at the window — focus, the page
 * shown again, the account changing — never on a clock. That is also how a
 * pack paid for in the browser arrives: coming back to the window is the
 * event, and main asks the server at every one until the balance moves.
 */

interface ISceneStoreState {
  owner: string;
  store?: ISceneStore;
  loading: boolean;
  error?: TStoreFailure;
}

const ownerNow = () => {
  const account = getAccountSnapshot();
  return account.status === 'signed-in' ? (account.identity?.id ?? '') : '';
};

let state: ISceneStoreState = { owner: '', loading: true };
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const bridge = () => window.electron?.ipcRenderer;
const notify = () => listeners.forEach((listener) => listener());
const publish = (next: Partial<ISceneStoreState>) => {
  state = { ...state, ...next };
  notify();
};

/** A different account is a different store: nothing of the last one shows. */
const bindAccount = () => {
  const owner = ownerNow();
  if (state.owner !== owner) {
    pending = undefined;
    state = { owner, loading: owner !== '' };
    notify();
  }
};

/** Main's answer, kept only while it is still this account's. */
const adoptStore = (owner: string, store: ISceneStore) => {
  if (ownerNow() === owner && state.owner === owner) {
    publish({ store, loading: false, error: undefined });
  }
};

export const refreshSceneStore = (): Promise<void> => {
  bindAccount();
  const { owner } = state;
  if (!owner) {
    return Promise.resolve();
  }
  if (pending) {
    return pending;
  }
  const run = async () => {
    const outcome = (await bridge()?.getSceneStore?.()) ?? {
      ok: false as const,
      reason: 'unavailable' as const,
    };
    if (ownerNow() !== owner || state.owner !== owner) {
      return;
    }
    if (outcome.ok) {
      adoptStore(owner, outcome.store);
    } else {
      publish({
        loading: false,
        error: outcome.reason,
        ...(outcome.known ? { store: outcome.known } : {}),
      });
    }
  };
  const request = run()
    .catch(() => {
      if (state.owner === owner) {
        publish({ loading: false, error: 'offline' });
      }
    })
    .finally(() => {
      if (pending === request) {
        pending = undefined;
      }
    });
  pending = request;
  return request;
};

export const buyScene = async (
  authorId: string,
  sceneId: string,
): Promise<TBuyOutcome> => {
  bindAccount();
  const { owner } = state;
  const outcome: TBuyOutcome = (await bridge()
    ?.buyScene?.(authorId, sceneId)
    .catch(() => undefined)) ?? { ok: false, reason: 'offline' };
  if (outcome.ok) {
    adoptStore(owner, outcome.store);
  }
  return outcome;
};

export const claimStarterCredits = async (): Promise<TStarterOutcome> => {
  bindAccount();
  const { owner } = state;
  const outcome: TStarterOutcome = (await bridge()
    ?.claimStarterCredits?.()
    .catch(() => undefined)) ?? { ok: false, reason: 'offline' };
  if (outcome.ok) {
    adoptStore(owner, outcome.store);
  }
  return outcome;
};

/**
 * Opens Stripe's page in the browser, in the window's language. The credits
 * arrive when the return page's "Back to FluidEQ" opens the app, or with the
 * window's next focus.
 */
export const checkoutCreditPack = async (
  packId: string,
  locale: string,
): Promise<TCheckoutOutcome> =>
  (await bridge()
    ?.checkoutCreditPack?.(packId, locale)
    .catch(() => undefined)) ?? { ok: false, reason: 'offline' };

/** How a pack's payment ended, once its return page has opened FluidEQ. */
export const onCheckoutReturned = (
  listener: (ended: 'paid' | 'cancelled') => void,
): (() => void) => bridge()?.onCheckoutReturned?.(listener) ?? (() => {});

let stop = () => {};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    const refresh = () => {
      refreshSceneStore().catch(() => undefined);
    };
    const visible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    const stopAccount = subscribeAccount(refresh);
    const stopPushes =
      bridge()?.onSceneStoreChanged?.((store) => {
        bindAccount();
        if (store) {
          adoptStore(state.owner, store);
        }
      }) ?? (() => {});
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    stop = () => {
      stopAccount();
      stopPushes();
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', visible);
    };
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
    }
  };
};

const snapshot = () => state;

export const useSceneStore = (): ISceneStoreState =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

/**
 * Plus asked of the entitlement store, which every caller here already
 * subscribes to through `useSyncExternalStore` below.
 */
const plusNow = () => getEntitlementSnapshot().state !== 'none';

const subscribeBoth = (listener: () => void) => {
  const stopStore = subscribe(listener);
  const stopPlus = subscribeEntitlement(listener);
  return () => {
    stopStore();
    stopPlus();
  };
};

/**
 * Whether this account may play the look: its maker's own, bought, or — until
 * the cutover ends Plus — any while Plus lasts. Main decides the same from
 * the same answer (`sceneOwnership.ts`); this only draws it.
 */
export const ownsLookNow = (lookId: string): boolean => {
  const owner = ownerNow();
  return mayPlayLook({
    lookId,
    accountId: owner || undefined,
    plus: plusNow(),
    store: state.owner === owner ? state.store : undefined,
  });
};

export const useOwnsLook = (lookId: string): boolean =>
  useSyncExternalStore(
    subscribeBoth,
    () => ownsLookNow(lookId),
    () => ownsLookNow(lookId),
  );

const ownsAnythingNow = () =>
  ownerNow() !== '' &&
  mayPlayAnything(
    plusNow(),
    state.owner === ownerNow() ? state.store : undefined,
  );

/** Any scene playable here — Plus, one bought, or one's own published: what the lamps ask. */
export const useOwnsAnything = (): boolean =>
  useSyncExternalStore(subscribeBoth, ownsAnythingNow, ownsAnythingNow);

/** For tests: a clean module between runs. */
export const resetSceneStore = () => {
  stop();
  stop = () => {};
  listeners.clear();
  pending = undefined;
  state = { owner: '', loading: true };
};
