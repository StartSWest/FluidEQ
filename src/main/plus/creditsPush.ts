/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../common/accountConfig';
import type { IAccountSession } from '../account/session';
import { createAccountPush, type IAccountPush } from './accountPush';

export { MAX_REJOINS, realtimeSocketUrl } from './accountPush';

/**
 * The server telling the app that this account's credits moved, while a pack
 * is being paid for in the browser.
 *
 * Ivan, 2026-11-09: "the payment is fine but I need to click back to fluid so
 * fluid reload the credits ... fluid needs to also refresh and receive the
 * paid hook by it self automatically". Paying happens in the browser, and the
 * app used to hear of it only when somebody came back to its window. The
 * server now broadcasts an empty `credits` message to the private topic
 * `credits:<account>` whenever the account's ledger gains a row (premium
 * migration 0099), and only that account may join the topic.
 *
 * The socket is the account push (`accountPush.ts`), open only while a
 * payment is owed — from the checkout opening until the balance moves, the
 * account changes or the app quits — and every join reads the store once, so
 * a payment that landed while the socket was between two connections is
 * still seen.
 */

export type ICreditsPush = IAccountPush;

export interface ICreditsPushDeps {
  config: Pick<IAccountConfig, 'supabaseUrl' | 'supabaseAnonKey'>;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  /** The credits moved, or may have while nobody was listening. */
  onCredits: () => void;
  createSocket?: (url: string) => WebSocket;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const creditsTopic = (userId: string) => `credits:${userId}`;

export const createCreditsPush = ({
  onCredits,
  ...deps
}: ICreditsPushDeps): ICreditsPush =>
  createAccountPush({
    ...deps,
    topicOf: creditsTopic,
    event: 'credits',
    name: 'credits',
    onEvent: onCredits,
  });
