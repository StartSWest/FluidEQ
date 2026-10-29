/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  CREATOR_AGREEMENT_VERSION,
  isPayableCountry,
  parseCreatorStatus,
  type TCreatorFailure,
  type TCreatorOutcome,
} from '../../common/creatorPayouts';
import type { TCheckoutLocale } from '../../common/sceneStore';
import type { IGalleryAuth } from './galleryAccess';
import { headers, rpc } from './galleryApi';

/**
 * A creator's payouts on the server (premium 0064 and `creator-account`):
 * the creator's own figures, and the Stripe pages to sign up and to see their
 * payouts. Every rule is the server's; this carries the answers, and hands
 * back a page only when it is Stripe's own.
 */

const STRIPE_CONNECT = 'https://connect.stripe.com/';

const failureOf = async (response: Response): Promise<TCreatorFailure> => {
  let word: unknown;
  try {
    const body: unknown = await response.json();
    if (typeof body === 'object' && body !== null) {
      word =
        (body as Record<string, unknown>).error ??
        (body as Record<string, unknown>).message;
    }
  } catch {
    // An unreadable refusal is still a refusal; its status decides.
  }
  if (response.status === 401 || word === 'signed_out') {
    return 'signed-out';
  }
  if (word === 'unconfirmed') {
    return 'unconfirmed';
  }
  if (word === 'agreement_outdated') {
    return 'agreement-outdated';
  }
  if (word === 'country_not_payable') {
    return 'country';
  }
  if (word === 'banned') {
    return 'banned';
  }
  // Signing up closed until FluidEQ can pay creators (premium 0070).
  if (word === 'payouts_closed') {
    return 'unavailable';
  }
  // A server before 0064 has neither the function nor the table.
  return response.status === 404 && word !== 'no_account'
    ? 'unavailable'
    : 'server';
};

export const fetchCreatorStatus = async (
  auth: IGalleryAuth,
): Promise<TCreatorOutcome> => {
  let response: Response;
  try {
    response = await rpc(auth, 'my_creator', {});
  } catch {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: await failureOf(response) };
  }
  try {
    const status = parseCreatorStatus(await response.json());
    return status ? { ok: true, status } : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

type TPage = { ok: true; url: string } | { ok: false; reason: TCreatorFailure };

const callAccount = async (
  auth: IGalleryAuth,
  body: Record<string, unknown>,
): Promise<Response | undefined> => {
  try {
    return await (auth.fetchImpl ?? fetch)(
      `${auth.config.apiUrl}/creator-account`,
      {
        method: 'POST',
        headers: headers(auth),
        body: JSON.stringify(body),
      },
    );
  } catch {
    return undefined;
  }
};

const pageOf = async (response: Response | undefined): Promise<TPage> => {
  if (!response) {
    return { ok: false, reason: 'offline' };
  }
  if (!response.ok) {
    return { ok: false, reason: await failureOf(response) };
  }
  try {
    const body: unknown = await response.json();
    const url =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>).url
        : undefined;
    return typeof url === 'string' && url.startsWith(STRIPE_CONNECT)
      ? { ok: true, url }
      : { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'server' };
  }
};

/** Stripe's sign-up page for this account, made the first time in `country`. */
export const startCreatorSignUp = async (
  auth: IGalleryAuth,
  country: string | undefined,
  locale: TCheckoutLocale,
): Promise<TPage> => {
  if (country !== undefined && !isPayableCountry(country)) {
    return { ok: false, reason: 'country' };
  }
  return pageOf(
    await callAccount(auth, {
      action: 'link',
      agreementVersion: CREATOR_AGREEMENT_VERSION,
      ...(country ? { country } : {}),
      locale,
    }),
  );
};

/** The creator's Stripe Express dashboard, one time. */
export const openCreatorDashboard = async (
  auth: IGalleryAuth,
): Promise<TPage> => pageOf(await callAccount(auth, { action: 'dashboard' }));

/** Stripe asked what the account can do now; the answer is kept on the server. */
export const refreshCreatorAccount = async (
  auth: IGalleryAuth,
): Promise<{ ok: true } | { ok: false; reason: TCreatorFailure }> => {
  const response = await callAccount(auth, { action: 'refresh' });
  if (!response) {
    return { ok: false, reason: 'offline' };
  }
  return response.ok
    ? { ok: true }
    : { ok: false, reason: await failureOf(response) };
};
