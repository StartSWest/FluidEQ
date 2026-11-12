/* FluidEQ — GPL-3.0-or-later */

import { ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import type {
  ISignedEditionStatus,
  TEditionDownload,
  TEditionLinkFinish,
  TEditionLinkStart,
} from '../../common/signedEdition';
import type { IGalleryAccess } from '../plus/galleryAccess';
import {
  editionDownload,
  editionOwning,
  editionPrice,
  finishEditionLink,
  startEditionLink,
} from '../plus/signedEditionApi';

/**
 * The Signed Edition over IPC: what the account card and the un-activated
 * notice read, the download, the checkout, and linking a purchase paid with
 * another address.
 *
 * The checkout is the site's page, opened in the person's own browser with
 * the account and its address in the URL's FRAGMENT, which no server is
 * sent: Paddle's checkout then opens with that address filled in and the
 * purchase lands on this account by itself.
 */

/** Where the edition is sold. The site reads the fragment and clears it. */
export const SIGNED_EDITION_PAGE = 'https://fluideq.com/pricing';

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}$/;
const CODE = /^[0-9]{6}$/;

export const signedEditionCheckoutUrl = (identity?: {
  id: string;
  email?: string;
}): string => {
  if (!identity) {
    return `${SIGNED_EDITION_PAGE}#signed`;
  }
  const fields = new URLSearchParams({ account: identity.id });
  if (identity.email && EMAIL.test(identity.email)) {
    fields.set('email', identity.email);
  }
  return `${SIGNED_EDITION_PAGE}#signed?${fields.toString()}`;
};

export interface ISignedEditionIpcDeps {
  access: IGalleryAccess;
  config: IAccountConfig;
  /** The signed-in account, for the checkout's fragment. */
  identity: () => { id: string; email?: string } | undefined;
  /** Whether this build is the signed one (`signedAutoUpdates.ts`'s pins). */
  signedCopy: boolean;
  /** The signed copy's publisher, as its certificate names it. */
  publisher?: string;
  openExternal: (url: string) => Promise<void>;
  fetchImpl?: typeof fetch;
}

const CHANNELS = [
  'signed-edition-status',
  'signed-edition-download',
  'signed-edition-buy',
  'signed-edition-link-start',
  'signed-edition-link-finish',
] as const;

export const registerSignedEditionIpc = ({
  access,
  config,
  identity,
  signedCopy,
  publisher,
  openExternal,
  fetchImpl,
}: ISignedEditionIpcDeps) => {
  // Which copy this is, said with every answer.
  const copy = {
    signedCopy,
    ...(signedCopy && publisher ? { publisher } : {}),
  };
  ipcMain.handle(
    'signed-edition-status',
    async (): Promise<ISignedEditionStatus> => {
      const me = access.accountId();
      const [auth, price] = await Promise.all([
        me ? access.auth() : undefined,
        editionPrice(config, fetchImpl),
      ]);
      const shown = price ? { price } : {};
      if (!me || !auth) {
        return {
          ...copy,
          account: me ? 'unknown' : 'signed-out',
          ...shown,
        };
      }
      const owning = await editionOwning(auth);
      // Somebody else signed in while the question was out: not theirs.
      if (access.accountId() !== me) {
        return { ...copy, account: 'unknown', ...shown };
      }
      if (!owning.known) {
        return {
          ...copy,
          account: owning.signedOut ? 'signed-out' : 'unknown',
          ...shown,
        };
      }
      return {
        ...copy,
        account: owning.owned ? 'owned' : 'not-owned',
        ...(owning.order ? { order: owning.order } : {}),
        ...shown,
      };
    },
  );

  // The link is opened here, in the browser, and never handed to the page.
  ipcMain.handle(
    'signed-edition-download',
    async (): Promise<TEditionDownload> => {
      const me = access.accountId();
      const auth = me ? await access.auth() : undefined;
      if (!auth || access.accountId() !== me) {
        return { ok: false, reason: 'signed-out' };
      }
      const outcome = await editionDownload(auth);
      if (outcome.ok) {
        await openExternal(outcome.url);
      }
      return outcome;
    },
  );

  ipcMain.handle('signed-edition-buy', async (): Promise<boolean> => {
    await openExternal(signedEditionCheckoutUrl(identity()));
    return true;
  });

  ipcMain.handle(
    'signed-edition-link-start',
    async (_event, email: unknown): Promise<TEditionLinkStart> => {
      if (typeof email !== 'string' || !EMAIL.test(email.trim())) {
        return 'failed';
      }
      const me = access.accountId();
      const auth = me ? await access.auth() : undefined;
      if (!auth || access.accountId() !== me) {
        return 'signed-out';
      }
      return startEditionLink(auth, email.trim());
    },
  );

  ipcMain.handle(
    'signed-edition-link-finish',
    async (
      _event,
      email: unknown,
      code: unknown,
    ): Promise<TEditionLinkFinish> => {
      if (
        typeof email !== 'string' ||
        !EMAIL.test(email.trim()) ||
        typeof code !== 'string' ||
        !CODE.test(code)
      ) {
        return 'no';
      }
      const me = access.accountId();
      const auth = me ? await access.auth() : undefined;
      if (!auth || access.accountId() !== me) {
        return 'signed-out';
      }
      return finishEditionLink(auth, email.trim(), code);
    },
  );

  return {
    dispose: () =>
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel)),
  };
};
