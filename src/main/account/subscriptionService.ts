/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { BILLING_MODE } from '../../common/billingMode';
import { PLUS_TERMS_VERSION } from '../../common/plusTerms';
import { isCheckoutLocale, mayPlayLook } from '../../common/sceneStore';
import {
  isLibraryPlanId,
  type ILapseOffer,
  type ISubscriptionState,
  type TManageResult,
  type TSubscribeResult,
} from '../../common/subscription';
import type { IGalleryAuth } from '../plus/galleryAccess';
import { headers } from '../plus/galleryApi';
import type { ISceneOwnership } from '../plus/sceneOwnership';
import { STRIPE_CHECKOUT_ORIGIN } from '../plus/sceneStoreApi';
import type { ISubscriptionAccount } from './subscriptionAccount';
import type { ISubscriptionRecords } from './subscriptionRecord';

/**
 * Plus for the window: its plans and how the account stands, Stripe's
 * checkout and portal, and the offer made when it ended. Built on the
 * account's Plus view (`subscriptionAccount.ts`) the way the credits are
 * built on its store, and with the same rules (ported from FluidWallpapers):
 *
 * - **Only what the server says exists.** Against a server before premium
 *   0122 (no `libraryPlans` in `my_store`) there are no plans, nothing is
 *   manageable, and neither function is ever called:
 *   `create-subscription-checkout` only for a plan listed,
 *   `create-billing-portal` only once the server knows the subscription.
 * - **The terms agreed are the terms shown.** The window says which revision
 *   it showed beside Continue; a checkout goes out only when that is the one
 *   in force here (`PLUS_TERMS_VERSION`), which is the one the server
 *   records. In development main and the window can run different copies of
 *   the terms (main does not hot-reload), and the agreement recorded must be
 *   to the text the person read.
 * - **Stripe only.** The checkout opens in the person's browser only on
 *   `https://checkout.stripe.com/`, the portal only on
 *   `https://billing.stripe.com/`. Their addresses carry the session, so
 *   only the origin is logged. After either, the account expects a change
 *   (every event reads the row until it moves, and the server's push is
 *   heard). Stripe returns to fluideq.com's own pages, never here.
 */

/** The app the server picks its return pages for. */
export const SUBSCRIPTION_APP = 'fluideq';

/** Stripe's own portal, the one place Manage Plus opens. */
export const BILLING_PORTAL_ORIGIN = 'https://billing.stripe.com';

export interface ISubscriptionService {
  state(): ISubscriptionState;
  /**
   * Opens Stripe's checkout for a plan in the browser, under the terms
   * revision the window showed. Never throws.
   */
  subscribe(
    plan: unknown,
    locale: unknown,
    termsShown: unknown,
  ): Promise<TSubscribeResult>;
  /** Opens Stripe's portal in the browser. Never throws. */
  manage(locale: unknown): Promise<TManageResult>;
  /** Puts away the offer made when Plus ended. */
  dismissLapse(id: unknown): void;
  /** Hear about anything `state()` reads. Returns unsubscribe. */
  onChange(listener: () => void): () => void;
  dispose(): void;
}

export interface ISubscriptionServiceDeps {
  /** A backend is configured: a build without one sells nothing. */
  configured: () => boolean;
  accountId: () => string | undefined;
  subscription: ISubscriptionAccount;
  ownership: Pick<ISceneOwnership, 'refreshNow' | 'known' | 'subscribe'>;
  records: ISubscriptionRecords;
  /** The token for the signed-in account, or nothing. */
  auth: () => Promise<IGalleryAuth | undefined>;
  /** `safeExternal`'s gate: opens a page in the person's own browser. */
  openExternal: (url: string) => boolean;
  logger?: { info(message: string): void; warn(message: string): void };
}

/** A page on `origin` itself, over https, with no credentials in it. */
export const pageOn = (url: unknown, origin: string): string | undefined => {
  if (typeof url !== 'string') {
    return undefined;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      parsed.origin === origin &&
      parsed.username === '' &&
      parsed.password === ''
      ? parsed.origin
      : undefined;
  } catch {
    return undefined;
  }
};

/** What a function said of a refusal: its `error`, or PostgREST's `message`. */
export const refusalOf = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const { error, message } = body as Record<string, unknown>;
      const word = error ?? message;
      return typeof word === 'string' ? word : undefined;
    }
  } catch {
    // An unreadable refusal is still a refusal.
  }
  return undefined;
};

/** The `url` a function answered with, or nothing. */
const urlOf = async (response: Response): Promise<unknown> => {
  try {
    const body: unknown = await response.json();
    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>).url
      : undefined;
  } catch {
    return undefined;
  }
};

const CHECKOUT_REFUSALS: ReadonlyMap<string, TSubscribeResult> = new Map<
  string,
  TSubscribeResult
>([
  ['unconfirmed', 'needs-email'],
  ['terms_outdated', 'needs-update'],
  ['already_subscribed', 'already-subscribed'],
  ['plan_not_on_sale', 'not-on-sale'],
  ['banned', 'banned'],
  ['signed_out', 'signed-out'],
]);

export const createSubscriptionService = ({
  configured,
  accountId: signedIn,
  subscription,
  ownership,
  records,
  auth,
  openExternal,
  logger,
}: ISubscriptionServiceDeps): ISubscriptionService => {
  const listeners = new Set<() => void>();
  const accountId = (): string | undefined =>
    configured() ? signedIn() : undefined;
  /** An account the checkout said already has Plus (Manage it). */
  let knownSubscribed: string | undefined;

  const emit = () => {
    [...listeners].forEach((listener) => {
      try {
        listener();
      } catch (error) {
        logger?.warn(`A Plus listener failed: ${String(error)}`);
      }
    });
  };

  /** The server knows Plus: `my_store` from 0122 on. */
  const aware = () => subscription.answer()?.aware === true;

  /** The plans the account's own answer has on sale: what a checkout needs. */
  const plans = () => {
    const answer = subscription.answer();
    return answer?.aware && !answer.suspended ? answer.plans : [];
  };

  /**
   * The plans the window shows: the account's own answer once it came;
   * before it, and signed out, the plans this computer last heard on sale,
   * so Get Plus shows at once and, signed out, leads to sign-in, said to be
   * remembered. A checkout reads the account's own answer first.
   */
  const plansShown = (): Pick<
    ISubscriptionState,
    'plans' | 'plansRemembered'
  > => {
    if (!configured()) {
      return { plans: [] };
    }
    if (subscription.answer()) {
      return { plans: plans() };
    }
    const known = records.knownPlans();
    return known.length > 0
      ? { plans: known, plansRemembered: true }
      : { plans: known };
  };

  /**
   * The account's own answer, read once if it has not come yet (the app's
   * start, a fresh sign-in): whether a checkout can be decided on it. A
   * read that fails (offline, the server down) is a failed checkout, never
   * a plan not on sale.
   */
  const ownAnswer = async (
    id: string,
  ): Promise<'answered' | 'signed-out' | 'failed'> => {
    if (subscription.answer()) {
      return 'answered';
    }
    try {
      const read = await ownership.refreshNow();
      if (!read.ok) {
        logger?.warn(
          `The Plus prices could not be read before a checkout: ${read.reason}`,
        );
        return read.reason === 'signed-out' ? 'signed-out' : 'failed';
      }
      await subscription.settled();
    } catch (error) {
      logger?.warn(
        `The Plus prices could not be read before a checkout: ${String(error)}`,
      );
      return 'failed';
    }
    if (accountId() !== id) {
      return 'failed';
    }
    return subscription.answer() ? 'answered' : 'failed';
  };

  const manageable = (): boolean => {
    const id = accountId();
    if (!id || !aware()) {
      return false;
    }
    return (
      subscription.subscribed() ||
      subscription.answer()?.membership.kind === 'present' ||
      knownSubscribed === id
    );
  };

  /** The last ending's offer, less every scene the account owns now. */
  const lapse = (): ILapseOffer | undefined => {
    const id = accountId();
    if (!id || subscription.subscribed()) {
      return undefined;
    }
    const offer = records.lapse(id);
    if (!offer) {
      return undefined;
    }
    const store = ownership.known();
    const scenes = offer.scenes.filter(
      ({ lookId }) =>
        !mayPlayLook({ lookId, accountId: id, plus: false, store }),
    );
    return scenes.length > 0 ? { ...offer, scenes } : undefined;
  };

  const state = (): ISubscriptionState => {
    const id = accountId();
    if (!id) {
      return {
        signedIn: false,
        ...plansShown(),
        subscribed: false,
        manageable: false,
      };
    }
    const status = subscription.status();
    const offer = lapse();
    return {
      signedIn: true,
      ...plansShown(),
      ...(subscription.answer()?.suspended ? { suspended: true as const } : {}),
      subscribed: subscription.subscribed(),
      ...(status ? { status } : {}),
      manageable: manageable(),
      ...(offer ? { lapse: offer } : {}),
    };
  };

  /** The token, for the account it was asked for only. */
  const authFor = async (id: string): Promise<IGalleryAuth | undefined> => {
    try {
      const token = await auth();
      return token && accountId() === id ? token : undefined;
    } catch {
      return undefined;
    }
  };

  const post = (
    token: IGalleryAuth,
    name: string,
    body: Record<string, unknown>,
  ): Promise<Response> =>
    (token.fetchImpl ?? fetch)(`${token.config.apiUrl}/${name}`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    });

  const readStoreAgain = () => {
    ownership.refreshNow().catch(() => undefined);
  };

  /** Opens a Stripe page the function answered with, on `origin` only. */
  const openOn = (url: unknown, origin: string, what: string): boolean => {
    const at = pageOn(url, origin);
    if (!at || typeof url !== 'string') {
      logger?.warn(`The ${what} answered a page that is not Stripe’s`);
      return false;
    }
    if (!openExternal(url)) {
      logger?.warn(`The ${what} could not be opened`);
      return false;
    }
    // The origin only: the rest of the address is the payment session.
    logger?.info(`The ${what} opened at ${at}`);
    return true;
  };

  const subscribe = async (
    plan: unknown,
    locale: unknown,
    termsShown: unknown,
  ): Promise<TSubscribeResult> => {
    const id = accountId();
    if (!id || !isLibraryPlanId(plan)) {
      return 'failed';
    }
    if (termsShown !== PLUS_TERMS_VERSION) {
      logger?.warn(
        `A Plus checkout was asked under terms revision ${String(termsShown)}, and ${PLUS_TERMS_VERSION} is in force: the terms are shown again`,
      );
      return 'terms-changed';
    }
    // Decided on the account's own answer only, read once if it has not
    // come: remembered plans are never taken for the account's.
    const own = await ownAnswer(id);
    if (own !== 'answered') {
      return own;
    }
    if (!plans().some((each) => each.id === plan)) {
      // Not listed: a server that sells none (before 0122), or not this one.
      // The prices are read again, as the window then says.
      readStoreAgain();
      return 'not-on-sale';
    }
    if (subscription.subscribed()) {
      return 'already-subscribed';
    }
    const token = await authFor(id);
    if (!token) {
      return 'failed';
    }
    let response: Response;
    try {
      response = await post(token, 'create-subscription-checkout', {
        plan,
        app: SUBSCRIPTION_APP,
        // The terms the window showed, which are the ones in force here;
        // the server records the agreement and refuses one below Plus's
        // floor (15) as `terms_outdated`.
        termsVersion: PLUS_TERMS_VERSION,
        locale: isCheckoutLocale(locale) ? locale : 'en',
        // The Stripe mode this build buys in (`common/billingMode.ts`): a
        // development build asks for a test checkout; a release asks as
        // every release before 0124 did, with no mode, which the server
        // reads as live. The portal takes none: it opens in the mode of the
        // account's own subscription.
        ...(BILLING_MODE === 'test' ? { mode: 'test' } : {}),
      });
    } catch (error) {
      logger?.warn(`The Plus checkout could not be reached: ${String(error)}`);
      return 'failed';
    }
    if (!response.ok) {
      const refusal = await refusalOf(response);
      const result =
        (refusal === undefined ? undefined : CHECKOUT_REFUSALS.get(refusal)) ??
        'failed';
      logger?.warn(
        `The Plus checkout was refused: ${response.status} ${refusal ?? 'without a word'}`,
      );
      if (result === 'already-subscribed') {
        // Here or in FluidWallpapers: the account has Plus this computer was
        // not told of yet. Manage is the way on, and the store says it soon.
        knownSubscribed = id;
        readStoreAgain();
        emit();
      } else if (result === 'not-on-sale') {
        // Its price changed or went: the plans are read again.
        readStoreAgain();
      }
      return result;
    }
    if (
      !openOn(await urlOf(response), STRIPE_CHECKOUT_ORIGIN, 'Plus checkout')
    ) {
      return 'failed';
    }
    subscription.expectChange();
    return 'opened';
  };

  const manage = async (locale: unknown): Promise<TManageResult> => {
    const id = accountId();
    if (!id) {
      return 'failed';
    }
    if (!manageable()) {
      return 'no-subscription';
    }
    const token = await authFor(id);
    if (!token) {
      return 'failed';
    }
    let response: Response;
    try {
      response = await post(token, 'create-billing-portal', {
        app: SUBSCRIPTION_APP,
        locale: isCheckoutLocale(locale) ? locale : 'en',
      });
    } catch (error) {
      logger?.warn(`The Plus portal could not be reached: ${String(error)}`);
      return 'failed';
    }
    if (!response.ok) {
      const refusal = await refusalOf(response);
      logger?.warn(
        `The Plus portal was refused: ${response.status} ${refusal ?? 'without a word'}`,
      );
      if (refusal === 'no_subscription') {
        return 'no-subscription';
      }
      return refusal === 'signed_out' ? 'signed-out' : 'failed';
    }
    if (!openOn(await urlOf(response), BILLING_PORTAL_ORIGIN, 'Plus portal')) {
      return 'failed';
    }
    subscription.expectChange();
    return 'opened';
  };

  const offSubscription = subscription.onChange(emit);
  const offRecords = records.onChange(emit);
  // A scene got with a credit leaves the lapse offer.
  const offOwnership = ownership.subscribe(emit);

  return {
    state,

    subscribe: (plan, locale, termsShown) => {
      logger?.info(`Get Plus (${String(plan)}): started`);
      return subscribe(plan, locale, termsShown)
        .catch((error: unknown): TSubscribeResult => {
          logger?.warn(`Get Plus failed: ${String(error)}`);
          return 'failed';
        })
        .then((result) => {
          logger?.info(`Get Plus (${String(plan)}): ${result}`);
          return result;
        });
    },

    manage: (locale) => {
      logger?.info('Manage Plus: started');
      return manage(locale)
        .catch((error: unknown): TManageResult => {
          logger?.warn(`Manage Plus failed: ${String(error)}`);
          return 'failed';
        })
        .then((result) => {
          logger?.info(`Manage Plus: ${result}`);
          return result;
        });
    },

    dismissLapse: (id) => {
      const accountNow = accountId();
      if (!accountNow || typeof id !== 'string') {
        return;
      }
      if (records.lapse(accountNow)?.id === id) {
        records.setLapse(accountNow, undefined);
        logger?.info('The offer made when Plus ended was put away');
      }
    },

    onChange: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose: () => {
      offSubscription();
      offRecords();
      offOwnership();
      listeners.clear();
    },
  };
};
