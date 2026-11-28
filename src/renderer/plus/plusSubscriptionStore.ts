/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import { PLUS_TERMS_VERSION } from 'common/plusTerms';
import type {
  ISubscriptionState,
  TLibraryPlanId,
  TManageResult,
  TPlusReturn,
  TSubscribeResult,
} from 'common/subscription';

/**
 * Plus, the scene subscription, as the window sees it: main reads the
 * server, holds the record and opens Stripe's pages
 * (`main/account/subscriptionService.ts`); this mirrors the state main sends
 * and passes the window's presses back. Nothing here reaches the network.
 *
 * Plus lives only inside Scenes (Ivan, 2026-11-28: "no plus elsewere in the
 * app"), so only the Scenes tab and its pages read this store; what plays is
 * still the entitlement (`account/entitlementStore.ts`), never these words.
 */

let state: ISubscriptionState | undefined;
// Back from Stripe's checkout through "Back to FluidEQ" and not subscribed
// yet: Stripe tells the server a moment later than it tells the browser.
let backFromCheckout = false;
let started = false;
let stopListening: Array<() => void> = [];
const listeners = new Set<() => void>();
const returnListeners = new Set<(returned: TPlusReturn) => void>();

const bridge = () => window.electron?.ipcRenderer;

const notify = () => listeners.forEach((listener) => listener());

const publish = (next: ISubscriptionState) => {
  state = next;
  if (next.subscribed) {
    backFromCheckout = false;
  }
  notify();
};

/**
 * Asks main once and listens for good, as the entitlement store does: a
 * change that lands before the first answer wins over it, because main sends
 * a change only once it has read something newer.
 */
const start = () => {
  if (started) {
    return;
  }
  started = true;
  const api = bridge();
  let changed = false;
  stopListening = [
    api?.onPlusChanged?.((next) => {
      changed = true;
      publish(next);
    }),
    api?.onPlusReturned?.((returned) => {
      const waiting = returned === 'subscribed' && state?.subscribed !== true;
      if (waiting !== backFromCheckout) {
        backFromCheckout = waiting;
        notify();
      }
      returnListeners.forEach((listener) => listener(returned));
    }),
  ].flatMap((stop) => (stop ? [stop] : []));
  api
    ?.getPlusState?.()
    .then((first) => {
      if (!changed) {
        publish(first);
      }
      return undefined;
    })
    .catch(() => undefined);
};

const subscribe = (listener: () => void) => {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const snapshot = () => state;

/** Undefined until main has answered. */
export const usePlusSubscription = (): ISubscriptionState | undefined =>
  useSyncExternalStore(subscribe, snapshot, snapshot);

const backSnapshot = () => backFromCheckout;

/**
 * Stripe's return page said the checkout went through and main has not read
 * the subscription yet. Ends when it does, by main's own word, never a clock.
 */
export const usePlusBackFromCheckout = (): boolean =>
  useSyncExternalStore(subscribe, backSnapshot, backSnapshot);

/**
 * Whether Plus is anywhere in the window: the account has it, it is on sale
 * to this account, or the scenes it played are still offered back. Against a
 * server that knows no subscription, and while nothing is on sale, nothing
 * about Plus shows at all (`ISubscriptionState.plans`).
 */
export const plusShown = (plus: ISubscriptionState | undefined): boolean =>
  plus !== undefined &&
  (plus.subscribed || plus.plans.length > 0 || plus.lapse !== undefined);

/** Whether this account can start Plus now. */
export const plusOnSale = (plus: ISubscriptionState | undefined): boolean =>
  plus !== undefined &&
  !plus.subscribed &&
  plus.suspended !== true &&
  plus.plans.length > 0;

/** How a trip to Stripe ended, as fluideq.com's "Back to FluidEQ" says it. */
export const subscribePlusReturns = (
  listener: (returned: TPlusReturn) => void,
) => {
  start();
  returnListeners.add(listener);
  return () => {
    returnListeners.delete(listener);
  };
};

/**
 * How many Get Plus sheets are open. A sheet answers a trip to Stripe on its
 * own - it is the one waiting for it - so the window only takes somebody to
 * Plus's page when they come back with none open.
 */
let sheets = 0;

export const holdPlusSheet = () => {
  sheets += 1;
  return () => {
    sheets -= 1;
  };
};

export const plusSheetOpen = (): boolean => sheets > 0;

/**
 * Stripe's checkout for a plan, under the terms revision this window shows
 * beside Continue: main refuses any other (`terms-changed`), so the agreement
 * recorded is the one that was on screen.
 */
export const getPlus = (
  plan: TLibraryPlanId,
  locale: string,
): Promise<TSubscribeResult> =>
  bridge()?.getPlus?.(plan, locale, PLUS_TERMS_VERSION) ??
  Promise.resolve('failed');

/** Stripe's portal: cancel, the card, monthly or yearly. */
export const managePlus = (locale: string): Promise<TManageResult> =>
  bridge()?.managePlus?.(locale) ?? Promise.resolve('failed');

/** Puts away the offer made the last time Plus ended. */
export const dismissPlusLapse = (id: string): Promise<void> =>
  bridge()?.dismissPlusLapse?.(id) ?? Promise.resolve();

/** For tests: a clean module between runs. */
export const resetPlusSubscriptionStore = () => {
  stopListening.forEach((stop) => stop());
  stopListening = [];
  state = undefined;
  backFromCheckout = false;
  started = false;
  sheets = 0;
  listeners.clear();
  returnListeners.clear();
};
