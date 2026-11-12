/* FluidEQ — GPL-3.0-or-later */

import type { IAccountConfig } from '../../common/accountConfig';
import {
  editionCreditsOf,
  editionOrderOf,
  editionPriceOf,
  type TEditionDownload,
  type TEditionLinkFinish,
  type TEditionLinkStart,
} from '../../common/signedEdition';
import { headers, rpc, type IAuthorised } from './galleryApi';

/**
 * The Signed Edition's side of the server (premium 0104): whether the account
 * owns it, the price to show, the download, and linking a purchase paid with
 * another address. Every answer the server can give is told apart here; none
 * of them is ever a reason for the app to stop working.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const bodyOf = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    // The body stopped arriving, or was not JSON.
    return undefined;
  }
};

export type TEditionOwning =
  | { known: true; owned: boolean; order?: string; credits?: number }
  | { known: false; signedOut: boolean };

/**
 * Whether this account owns the edition. Asking also takes a purchase that
 * was waiting under the account's confirmed address, which is how one bought
 * on the site with no sign-in arrives.
 */
export const editionOwning = async (
  auth: IAuthorised,
): Promise<TEditionOwning> => {
  let response: Response;
  try {
    response = await rpc(auth, 'claim_my_edition', {});
  } catch {
    return { known: false, signedOut: false };
  }
  if (response.status === 401 || response.status === 403) {
    return { known: false, signedOut: true };
  }
  const body = response.ok ? await bodyOf(response) : undefined;
  if (!isRecord(body) || typeof body.signed !== 'boolean') {
    // A server before 0104 has no such question: not known, never "no".
    return { known: false, signedOut: false };
  }
  const order = editionOrderOf(body.order);
  const credits = editionCreditsOf(body.credits);
  return {
    known: true,
    owned: body.signed,
    ...(order ? { order } : {}),
    ...(credits ? { credits } : {}),
  };
};

/** The price to show, asked with the public key: anybody may know it. */
export const editionPrice = async (
  config: IAccountConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<string | undefined> => {
  try {
    const response = await fetchImpl(
      new URL(
        '/rest/v1/rpc/signed_edition_price',
        config.supabaseUrl,
      ).toString(),
      {
        method: 'POST',
        headers: {
          apikey: config.supabaseAnonKey,
          Authorization: `Bearer ${config.supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      },
    );
    return response.ok ? editionPriceOf(await bodyOf(response)) : undefined;
  } catch {
    return undefined;
  }
};

const callEdition = (
  auth: IAuthorised,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> =>
  (auth.fetchImpl ?? fetch)(`${auth.config.apiUrl}/signed-edition${path}`, {
    method: 'POST',
    headers: headers(auth),
    body: JSON.stringify(body),
  });

/**
 * The installer lives in Cloudflare R2, not the account's own server: a file
 * stored there is capped at 50 MB and the installer is about 210 MB. Whatever
 * the server answers is opened in the browser, so only an https link to an R2
 * bucket endpoint (`<32-hex account>.r2.cloudflarestorage.com`, or a
 * jurisdiction's `<account>.<eu>.r2…`) on the default port, with no
 * credentials in it, is ever opened.
 */
const R2_HOST = /^[0-9a-f]{32}\.(?:[a-z]+\.)?r2\.cloudflarestorage\.com$/;

const isInstallerLink = (text: string): boolean => {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    R2_HOST.test(url.hostname)
  );
};

export const editionDownload = async (
  auth: IAuthorised,
): Promise<TEditionDownload> => {
  let response: Response;
  try {
    response = await callEdition(auth, '', {});
  } catch {
    return { ok: false, reason: 'failed' };
  }
  const body = await bodyOf(response);
  if (response.status === 401) {
    return { ok: false, reason: 'signed-out' };
  }
  if (response.status === 403) {
    return { ok: false, reason: 'not-owned' };
  }
  if (response.status === 503) {
    return { ok: false, reason: 'no-release' };
  }
  if (
    !response.ok ||
    !isRecord(body) ||
    typeof body.version !== 'string' ||
    typeof body.url !== 'string' ||
    !isInstallerLink(body.url)
  ) {
    return { ok: false, reason: 'failed' };
  }
  return { ok: true, version: body.version, url: body.url };
};

export const startEditionLink = async (
  auth: IAuthorised,
  email: string,
): Promise<TEditionLinkStart> => {
  let response: Response;
  try {
    response = await callEdition(auth, '/link', { email });
  } catch {
    return 'failed';
  }
  if (response.status === 401) {
    return 'signed-out';
  }
  if (response.status === 429) {
    return 'limited';
  }
  return response.ok ? 'sent' : 'failed';
};

export const finishEditionLink = async (
  auth: IAuthorised,
  email: string,
  code: string,
): Promise<TEditionLinkFinish> => {
  let response: Response;
  try {
    response = await callEdition(auth, '/link/confirm', { email, code });
  } catch {
    return 'failed';
  }
  if (response.status === 401) {
    return 'signed-out';
  }
  if (response.status === 409) {
    return 'too-soon';
  }
  if (response.status === 403) {
    return 'no';
  }
  const body = response.ok ? await bodyOf(response) : undefined;
  return isRecord(body) && body.linked === true ? 'linked' : 'failed';
};
