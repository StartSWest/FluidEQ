import { useSyncExternalStore } from 'react';
import type { IEntitlementStatus } from 'main/account/entitlement';
import type { TBillingOutcome } from 'main/ipc/account';

/**
 * Whether this account is paying for Plus, as the renderer sees it.
 *
 * Same shape as `accountStore`, for the same reason: one value, read from a
 * few places far apart in the tree. Nothing here reaches the network — the
 * main process owns the lookup, the cache and the grace window, and this side
 * only ever asks it to look again or to open a page in the browser.
 */

const NONE: IEntitlementStatus = { state: 'none' };

let status: IEntitlementStatus = NONE;
// Whether the main process has answered yet; see `accountStore`'s own. "None"
// before the answer drew the Plus tab's offer to a member for a moment.
let known = false;
let subscribed = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

const publish = (next: IEntitlementStatus) => {
  status = next;
  known = true;
  notify();
};

const bridge = () => window.electron?.ipcRenderer;

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  const first = api?.getEntitlementStatus?.();
  if (first) {
    first.then(publish).catch(() => {
      // No handler. Not subscribed is already the state, and now the answer.
      known = true;
      notify();
    });
  } else {
    // No backend: nobody to ask, nothing to wait for.
    known = true;
  }
  return api?.onEntitlementChanged?.(publish) ?? (() => {});
};

let stop: () => void = () => {};

export const subscribeEntitlement = (listener: () => void) => {
  if (listeners.size === 0) {
    stop = start();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getEntitlementSnapshot = (): IEntitlementStatus => status;

export const useEntitlement = (): IEntitlementStatus =>
  useSyncExternalStore(
    subscribeEntitlement,
    getEntitlementSnapshot,
    getEntitlementSnapshot,
  );

const getEntitlementKnown = () => known;

/** Whether `useEntitlement` is the main process's answer yet, not the start. */
export const useEntitlementKnown = (): boolean =>
  useSyncExternalStore(
    subscribeEntitlement,
    getEntitlementKnown,
    getEntitlementKnown,
  );

export const refreshEntitlement = async () => {
  const next = await bridge()?.refreshEntitlement?.();
  if (next) {
    publish(next);
  }
};

const NOTHING_TO_OPEN: TBillingOutcome = { ok: false, failure: 'rejected' };

/** Only after the terms were shown and agreed to: the version is that proof. */
export const openCheckout = async (
  termsVersion: number,
): Promise<TBillingOutcome> =>
  (await bridge()?.openCheckout?.(termsVersion)) ?? NOTHING_TO_OPEN;

export const openSubscriptionPortal = async (): Promise<TBillingOutcome> =>
  (await bridge()?.openSubscriptionPortal?.()) ?? NOTHING_TO_OPEN;

/**
 * Development only. The merchant has no test mode, so the main process can
 * send the merchant's own signed events to the real server instead; these
 * are the switches. Answers "not available" in every packaged build.
 */
export type TMembershipSimulation = 'started' | 'cancelled';

export const isMembershipSimulatorAvailable = async (): Promise<boolean> =>
  (await bridge()?.isMembershipSimulatorAvailable?.()) ?? false;

export const simulateMembership = async (
  simulation: TMembershipSimulation,
): Promise<TBillingOutcome> =>
  (await bridge()?.simulateMembership?.(simulation)) ?? NOTHING_TO_OPEN;

/** Releases the IPC listener. For a test that wants a clean module between runs. */
export const resetEntitlementStore = () => {
  stop();
  stop = () => {};
  subscribed = false;
  listeners.clear();
  status = NONE;
  known = false;
};
