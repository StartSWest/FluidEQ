/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  buyFailureOf,
  CREDIT_PACK_ID,
  type TCheckoutLocale,
  parseSceneStore,
  type ISceneStore,
  type TBuyFailure,
  type TCheckoutFailure,
  type TStarterFailure,
  type TStoreFailure,
} from '../../common/sceneStore';
import { PLUS_TERMS_VERSION } from '../../common/plusTerms';
import type { IGalleryAuth } from './galleryAccess';
import { headers, rpc } from './galleryApi';

/**
 * The store's four questions to the server (premium 0055 and 0057): what this
 * account holds, the starter credits, one scene bought, and a page to pay
 * for a pack. Every rule — who may buy, what a pack costs, whether a credit is
 * there to spend — is the server's; this only carries the answers.
 */

/** Whatever the server said about a refusal: PostgREST's `message`, the function's `error`. */
const refusalOf = async (response: Response): Promise<unknown> => {
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      const { message, error } = body as Record<string, unknown>;
      return message ?? error;
    }
  } catch {
    // An unreadable refusal is still a refusal; its status decides.
  }
  return undefined;
};

const storeFailureOf = (status: number): TStoreFailure => {
  if (status === 401) {
    return 'signed-out';
  }
  // A server before 0055 has no such function: there is no store to show.
  return status === 404 ? 'unavailable' : 'server';
};

export const fetchSceneStore = async (
  auth: IGalleryAuth,
): Promise<
  { ok: true; store: ISceneStore } | { ok: false; reason: TStoreFailure }
> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_store', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: storeFailureOf(response.status) };
  }
  try {
    const store = parseSceneStore(await response.json());
    return store ? { ok: true, store } : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** One scene for one credit. The balance it answers is re-read with the store. */
export const buyScene = async (
  auth: IGalleryAuth,
  scene: { authorId: string; sceneId: string },
): Promise<{ ok: true } | { ok: false; reason: TBuyFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, 'buy_scene', {
      p_author: scene.authorId,
      p_scene: scene.sceneId,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.ok) {
    return { ok: true };
  }
  if (response.status === 404) {
    return { ok: false, reason: 'unavailable' };
  }
  const failure = buyFailureOf(await refusalOf(response));
  return {
    ok: false,
    reason:
      failure === 'server' && response.status === 401 ? 'signed-out' : failure,
  };
};

export const claimStarterCredits = async (
  auth: IGalleryAuth,
): Promise<{ ok: true } | { ok: false; reason: TStarterFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, 'claim_starter_credits', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (response.ok) {
    return { ok: true };
  }
  if ((await refusalOf(response)) === 'unconfirmed') {
    return { ok: false, reason: 'unconfirmed' };
  }
  return { ok: false, reason: storeFailureOf(response.status) };
};

/** Stripe's own page, and nothing else, is a place this app sends somebody to pay. */
export const STRIPE_CHECKOUT_ORIGIN = 'https://checkout.stripe.com';

const isCheckoutPage = (url: unknown): url is string => {
  if (typeof url !== 'string') {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.origin === STRIPE_CHECKOUT_ORIGIN && parsed.username === '';
  } catch {
    return false;
  }
};

/** A Stripe Checkout page made for this account and this pack. */
export const startCreditCheckout = async (
  auth: IGalleryAuth,
  packId: string,
  locale: TCheckoutLocale,
): Promise<
  { ok: true; url: string } | { ok: false; reason: TCheckoutFailure }
> => {
  if (!CREDIT_PACK_ID.test(packId)) {
    return { ok: false, reason: 'not-on-sale' };
  }
  let response: Response;
  try {
    response = await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/create-credit-checkout`,
      {
        method: 'POST',
        headers: headers(auth),
        // The terms this app shows; the server records the agreement and
        // refuses one older than the terms credits are sold under. The
        // language picks Stripe's and the page the payment returns to; a
        // server from before it ignores the field.
        body: JSON.stringify({
          packId,
          termsVersion: PLUS_TERMS_VERSION,
          locale,
        }),
      },
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    const refusal = await refusalOf(response);
    if (refusal === 'unconfirmed') {
      return { ok: false, reason: 'unconfirmed' };
    }
    if (refusal === 'terms_outdated') {
      return { ok: false, reason: 'terms-outdated' };
    }
    // `pack_not_on_sale`: a pack the store lists with no Stripe price yet. A
    // server without the function answers 404 with no such word.
    if (refusal === 'pack_not_on_sale' || refusal === 'invalid_pack') {
      return { ok: false, reason: 'not-on-sale' };
    }
    return { ok: false, reason: storeFailureOf(response.status) };
  }
  try {
    const body: unknown = await response.json();
    const url =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).url
        : undefined;
    return isCheckoutPage(url)
      ? { ok: true, url }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/**
 * The admin makes one of FluidEQ's scenes free for every account, or paid
 * again (premium 0061). Whether the caller is the admin is the server's to
 * say: anyone else is refused there.
 */
export const setOfficialSceneFree = async (
  auth: IGalleryAuth,
  sceneId: string,
  free: boolean,
): Promise<{ ok: true } | { ok: false; reason: TStoreFailure }> => {
  let response: Response;
  try {
    response = await rpc(auth, 'set_official_scene_free', {
      p_scene: sceneId,
      p_free: free,
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: storeFailureOf(response.status) };
};
