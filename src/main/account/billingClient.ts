import type { IAccountConfig } from 'common/accountConfig';

/**
 * The two things the app asks the billing server for: a checkout to open, and
 * the page where an existing subscription is managed.
 *
 * Both come from the server, on request, for the signed-in account — the app
 * sends its token and gets back a URL to open. That is why neither address is
 * configured into the build: which merchant, and whether it can mint a
 * per-person page, is the server's business, and a change of merchant is a
 * server deploy rather than an app release. The card, the price and the tax
 * all live on the merchant's page; the app only ever opens it.
 */

/**
 * `terms_outdated` is the server refusing a checkout because the terms the
 * person agreed to are older than the ones it now requires: the app is out
 * of date, and paying under text nobody showed them is exactly what the
 * version exists to prevent.
 *
 * `price_outdated` is the same refusal for the price: the prices this build
 * shows are not the ones the merchant charges. An old build after a price
 * change, or a copy somebody edited — either way the person would be agreeing
 * to one figure and paying another, and updating the app is the way through.
 */
export type TBillingFailure =
  'network' | 'signed_out' | 'rejected' | 'terms_outdated' | 'price_outdated';

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
 * Only an https URL is opened.
 *
 * The server is ours, but the URL it returns came from the merchant's API and
 * is about to be handed to the operating system's browser. Refusing anything
 * that is not https costs nothing and closes the one door a compromised
 * server-side dependency would have into somebody's browser.
 */
export const readBillingUrl = (value: unknown): string | undefined => {
  if (!isRecord(value) || typeof value.url !== 'string') {
    return undefined;
  }
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

/** Which of the outdated-app refusals a 409 names, if either. */
const outdatedFailure = async (
  response: Response,
): Promise<'terms_outdated' | 'price_outdated' | undefined> => {
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      return undefined;
    }
    return body.error === 'terms_outdated' || body.error === 'price_outdated'
      ? body.error
      : undefined;
  } catch {
    return undefined;
  }
};

const call = async (
  config: IAccountConfig,
  name: 'create-checkout' | 'create-portal',
  accessToken: string,
  fetchImpl: typeof fetch,
  request: Record<string, unknown> = {},
): Promise<string> => {
  let response: Response;
  try {
    response = await fetchImpl(`${config.apiUrl}/${name}`, {
      method: 'POST',
      headers: {
        apikey: config.supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new BillingError('network', `${name} is unreachable: ${error}`);
  }
  if (response.status === 401) {
    throw new BillingError('signed_out', `${name} refused the token.`);
  }
  if (!response.ok) {
    const outdated =
      response.status === 409 ? await outdatedFailure(response) : undefined;
    throw new BillingError(
      outdated ?? 'rejected',
      `${name} answered ${response.status}.`,
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new BillingError('rejected', `${name} sent no JSON.`);
  }
  const url = readBillingUrl(body);
  if (!url) {
    throw new BillingError('rejected', `${name} sent no usable URL.`);
  }
  return url;
};

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
  /**
   * Where to pay, for this account, having agreed to this version of the Plus
   * terms at the prices this build shows. The server refuses either one when
   * it is not what it now requires, and records the agreement as it answers,
   * so the record and the checkout cannot come apart.
   */
  checkoutUrl(accessToken: string, termsVersion: number): Promise<string>;
  /** Where this account's subscription is managed. */
  portalUrl(accessToken: string): Promise<string>;
  /** Have the server match this account against the merchant's records. */
  syncMembership(accessToken: string): Promise<boolean>;
}

export const createBillingClient = (
  config: IAccountConfig,
  fetchImpl: typeof fetch = fetch,
): IBillingClient => ({
  // The prices come from the main process's own copy of the build's values,
  // never from the window: what is checked is what this build quotes.
  checkoutUrl: (accessToken, termsVersion) =>
    call(config, 'create-checkout', accessToken, fetchImpl, {
      termsVersion,
      prices: { monthly: config.plusPrice, yearly: config.plusYearlyPrice },
    }),
  portalUrl: (accessToken) =>
    call(config, 'create-portal', accessToken, fetchImpl),
  syncMembership: (accessToken) => sync(config, accessToken, fetchImpl),
});
