import type { IAccountConfig } from 'common/accountConfig';

/**
 * What the app asks the billing server about a Plus membership: a look-up at
 * the merchant, so one still being paid for is read right. Plus is not sold
 * any more (credits replaced it, `sceneStore.ts`), and nothing about a
 * subscription is shown in the app (Ivan, 2026-10-21: "no more subs") — a
 * member who still pays manages it on Buy Me a Coffee, where it was bought,
 * which is all the old "Manage subscription" page ever opened.
 */
export type TBillingFailure = 'network' | 'signed_out' | 'rejected';

export class BillingError extends Error {
  readonly failure: TBillingFailure;

  constructor(failure: TBillingFailure, message: string) {
    super(message);
    this.name = 'BillingError';
    this.failure = failure;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Ask the server to look this account up at the merchant.
 *
 * The merchant matches a payment to an account by email, and its notice of a
 * payment can arrive before the account exists or not arrive at all. This
 * asks the server to check directly, right before the app reads its
 * subscription row. Resolves to whether anything was written; a failure is
 * the caller's to ignore — the row read that follows is the real answer.
 */
const sync = async (
  config: IAccountConfig,
  accessToken: string,
  fetchImpl: typeof fetch,
): Promise<boolean> => {
  let response: Response;
  try {
    response = await fetchImpl(`${config.apiUrl}/sync-membership`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
  } catch (error) {
    throw new BillingError(
      'network',
      `sync-membership is unreachable: ${error}`,
    );
  }
  if (response.status === 401) {
    throw new BillingError('signed_out', 'sync-membership refused the token.');
  }
  if (!response.ok) {
    throw new BillingError(
      'rejected',
      `sync-membership answered ${response.status}.`,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return false;
  }
  return isRecord(body) && body.synced === true;
};

export interface IBillingClient {
  /** Have the server match this account against the merchant's records. */
  syncMembership(accessToken: string): Promise<boolean>;
}

export const createBillingClient = (
  config: IAccountConfig,
  fetchImpl: typeof fetch = fetch,
): IBillingClient => ({
  syncMembership: (accessToken) => sync(config, accessToken, fetchImpl),
});
