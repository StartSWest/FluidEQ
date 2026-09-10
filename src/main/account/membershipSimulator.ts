import type { IAccountConfig } from '../../common/accountConfig';
import { BillingError, type TBillingFailure } from './billingClient';

/**
 * A pretend membership, for development.
 *
 * Buy Me a Coffee has no test mode: the only way to see a payment is to make
 * one, and the creator cannot pay their own page. What CAN be exercised
 * without money is everything after the card — the merchant's webhook
 * arriving at the server, the signature check, the email match, the row
 * written, the app noticing. The server's `dev-membership` function does
 * exactly that: it builds the merchant's own event for the caller's address,
 * signs it with the secret only the server holds, and posts it to the real
 * webhook beside it. This side only asks for it and reads the answer; no
 * secret ever reaches the app, so a development build needs no setup at all.
 *
 * DEVELOPMENT ONLY on this side — `main.ts` builds this only when the app is
 * not packaged — and admins only on the server, which reads the role from
 * the database and answers 403 to anyone else.
 *
 * `started` writes an active month; `cancelled` writes the end of it — the
 * merchant's `membership.cancelled` with a period that has already run out,
 * which is what the app treats as "not Plus".
 */

export type TMembershipSimulation = 'started' | 'cancelled';

export interface IMembershipSimulator {
  /** Ask the server to send one event; resolves when the webhook took it. */
  send(accessToken: string, simulation: TMembershipSimulation): Promise<void>;
}

export interface IMembershipSimulatorOptions {
  config: IAccountConfig;
  fetchImpl?: typeof fetch;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const createMembershipSimulator = ({
  config,
  fetchImpl = fetch,
  logger,
}: IMembershipSimulatorOptions): IMembershipSimulator => ({
  send: async (accessToken, simulation) => {
    let response: Response;
    try {
      response = await fetchImpl(`${config.apiUrl}/dev-membership`, {
        method: 'POST',
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ simulation }),
      });
    } catch (error) {
      throw new BillingError(
        'network',
        `dev-membership is unreachable: ${error}`,
      );
    }
    const answer = await response.text();
    logger?.info(
      `Pretend membership ${simulation}: server answered ${response.status} ${answer}`,
    );
    if (!response.ok) {
      const failure: TBillingFailure =
        response.status === 401 ? 'signed_out' : 'rejected';
      throw new BillingError(
        failure,
        `dev-membership answered ${response.status}: ${answer}`,
      );
    }
  },
});
