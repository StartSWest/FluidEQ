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
let subscribed = false;
const listeners = new Set<() => void>();

const publish = (next: IEntitlementStatus) => {
  status = next;
  listeners.forEach((listener) => listener());
};

const bridge = () => window.electron?.ipcRenderer;

const start = () => {
  if (subscribed) {
    return () => {};
  }
  subscribed = true;
  const api = bridge();
  api
    ?.getEntitlementStatus?.()
    .then(publish)
    .catch(() => {
      // No backend, or no handler. Not subscribed is already the state.
    });
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
};
