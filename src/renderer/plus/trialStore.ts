import { useSyncExternalStore } from 'react';
import {
  PLUS_TRIAL_PLAN,
  type IPlusTrialOffer,
  type TPlusTrialFailure,
  type TPlusTrialOutcome,
} from 'common/plusTrial';
import { getAccountSnapshot, subscribeAccount } from '../account/accountStore';
import {
  subscribeEntitlement,
  useEntitlement,
} from '../account/entitlementStore';

/**
 * A free trial of Plus already taken, as the server reports it: running, or
 * ended. No trial is started from here any more — Plus is not sold, and the
 * starter credits are the way in now — so this only reads.
 */
interface ITrialState {
  owner: string;
  offer?: IPlusTrialOffer;
  loading: boolean;
  error?: TPlusTrialFailure;
}

const ownerNow = () => {
  const account = getAccountSnapshot();
  return account.status === 'signed-in' ? (account.identity?.id ?? '') : '';
};
const initial = (owner: string): ITrialState => ({
  owner,
  loading: true,
});
let state = initial('');
let generation = 0;
let request = 0;
let pending: Promise<void> | undefined;
const listeners = new Set<() => void>();
const bridge = () => window.electron?.ipcRenderer;
const notify = () => listeners.forEach((listener) => listener());
const publish = (next: Partial<ITrialState>) => {
  state = { ...state, ...next };
  notify();
};

const bindAccount = () => {
  const owner = ownerNow();
  if (state.owner !== owner) {
    generation += 1;
    request += 1;
    pending = undefined;
    state = initial(owner);
    notify();
  }
};

/** Account, focus and entitlement events refresh this; no background clock. */
const refreshPlusTrial = (): Promise<void> => {
  bindAccount();
  if (pending) {
    return pending;
  }
  const { owner } = state;
  const epoch = generation;
  request += 1;
  const serial = request;
  publish({ loading: true, error: undefined });
  const current = () =>
    generation === epoch && request === serial && ownerNow() === owner;
  const run = async () => {
    let result: TPlusTrialOutcome;
    try {
      result = (await bridge()?.getPlusTrialOffer?.()) ?? {
        ok: false,
        reason: 'unavailable',
      };
    } catch {
      result = { ok: false, reason: 'offline' };
    }
    if (!current()) {
      return;
    }
    publish(
      result.ok
        ? { offer: result.offer, error: undefined, loading: false }
        : { error: result.reason, loading: false },
    );
  };
  pending = run().finally(() => {
    if (current()) {
      pending = undefined;
    }
  });
  return pending;
};

let stop = () => {};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (listeners.size === 1) {
    const refresh = () => refreshPlusTrial();
    const stopAccount = subscribeAccount(refresh);
    const stopEntitlement = subscribeEntitlement(refresh);
    const visible = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    stop = () => {
      stopAccount();
      stopEntitlement();
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

export const getPlusTrialSnapshot = () => state;
export const usePlusTrial = () => {
  const entitlement = useEntitlement();
  const snapshot = useSyncExternalStore(
    subscribe,
    getPlusTrialSnapshot,
    getPlusTrialSnapshot,
  );
  const { offer } = snapshot;
  // Paid/gift access is authoritative even if the offer refresh failed. An
  // old trial must never announce expiry over a membership that is active.
  if (
    entitlement.state !== 'none' &&
    entitlement.plan !== PLUS_TRIAL_PLAN &&
    offer
  ) {
    return { ...snapshot, offer: { ...offer, state: 'ineligible' as const } };
  }
  // The server fixes the end date. Re-rendering after focus or entitlement
  // expiry must not keep an old "active" label just because we are offline.
  if (
    offer?.state === 'active' &&
    offer.endsAt !== undefined &&
    offer.endsAt <= Date.now()
  ) {
    return { ...snapshot, offer: { ...offer, state: 'ended' as const } };
  }
  return snapshot;
};

export const resetPlusTrialStore = () => {
  stop();
  generation += 1;
  request += 1;
  pending = undefined;
  listeners.clear();
  state = initial('');
};
