import type { IAccountConfig } from '../../common/accountConfig';
import { memberLookId, parseMemberLookId } from '../../common/memberScenes';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
import { AuthError } from '../account/authClient';
import type { TGalleryFailure } from './galleryApi';
import type { ISceneOwnership } from './sceneOwnership';

/**
 * Who is asking, for the gallery's channels: the account, whether it has
 * Plus right now, which scenes it owns, and its token for the server — asked
 * fresh on every call, never remembered from startup.
 */

export interface IGalleryAuth {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export type TGalleryAuthorization =
  { ok: true; auth: IGalleryAuth } | { ok: false; reason: TGalleryFailure };

export interface IGalleryAccess {
  accountId(): string | undefined;
  entitled(): boolean;
  /** Bought, or every scene while Plus lasts (`sceneOwnership.ts`). */
  owns(lookId: string): boolean;
  /** The token wrapped for the server client, or nothing when signed out. */
  auth(): Promise<IGalleryAuth | undefined>;
  /** List reads must distinguish an offline refresh from a dead credential. */
  authorize?(): Promise<TGalleryAuthorization>;
}

export const createGalleryAccess = ({
  config,
  session,
  entitlement,
  ownership,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  ownership: Pick<ISceneOwnership, 'owns'>;
  fetchImpl?: typeof fetch;
}): IGalleryAccess => {
  const accountId = () => session.state().identity?.id;
  const authorize = async (): Promise<TGalleryAuthorization> => {
    try {
      const accessToken = await session.accessToken();
      return accessToken
        ? { ok: true, auth: { config, accessToken, fetchImpl } }
        : { ok: false, reason: 'signed-out' };
    } catch (error) {
      if (error instanceof AuthError) {
        if (error.failure === 'network') {
          return { ok: false, reason: 'offline' };
        }
        if (
          error.failure === 'expired' ||
          error.failure === 'signed_out_elsewhere'
        ) {
          return { ok: false, reason: 'signed-out' };
        }
      }
      return { ok: false, reason: 'server' };
    }
  };
  return {
    accountId,
    entitled: () =>
      entitlement.status().state !== 'none' && accountId() !== undefined,
    owns: (lookId) => ownership.owns(lookId),
    authorize,
    auth: async () => {
      const outcome = await authorize();
      return outcome.ok ? outcome.auth : undefined;
    },
  };
};

/** Keep the failure and the account that started the read together. */
export const authorizeGallery = async (
  access: IGalleryAccess,
  me: string | undefined,
): Promise<TGalleryAuthorization> => {
  if (!me) {
    return { ok: false, reason: 'signed-out' };
  }
  let outcome: TGalleryAuthorization;
  try {
    if (access.authorize) {
      outcome = await access.authorize();
    } else {
      const auth = await access.auth();
      outcome = auth ? { ok: true, auth } : { ok: false, reason: 'signed-out' };
    }
  } catch {
    outcome = { ok: false, reason: 'offline' };
  }
  return access.accountId() === me
    ? outcome
    : { ok: false, reason: 'signed-out' };
};

/** A scene named by the page: both ids, checked together the way a look id is. */
export const sceneRefOf = (authorId: unknown, sceneId: unknown) =>
  typeof authorId === 'string' && typeof sceneId === 'string'
    ? parseMemberLookId(memberLookId(authorId.toLowerCase(), sceneId))
    : undefined;
