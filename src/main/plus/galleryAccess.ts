import type { IAccountConfig } from '../../common/accountConfig';
import { memberLookId, parseMemberLookId } from '../../common/memberScenes';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';

/**
 * Who is asking, for the gallery's channels: the account, whether it has
 * Plus right now, and its token for the server — asked fresh on every call,
 * never remembered from startup.
 */

export interface IGalleryAuth {
  config: IAccountConfig;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export interface IGalleryAccess {
  accountId(): string | undefined;
  entitled(): boolean;
  /** The token wrapped for the server client, or nothing when signed out. */
  auth(): Promise<IGalleryAuth | undefined>;
}

export const createGalleryAccess = ({
  config,
  session,
  entitlement,
  fetchImpl = fetch,
}: {
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  fetchImpl?: typeof fetch;
}): IGalleryAccess => {
  const accountId = () => session.state().identity?.id;
  return {
    accountId,
    entitled: () =>
      entitlement.status().state !== 'none' && accountId() !== undefined,
    auth: async () => {
      try {
        const accessToken = await session.accessToken();
        return accessToken ? { config, accessToken, fetchImpl } : undefined;
      } catch {
        return undefined;
      }
    },
  };
};

/** A scene named by the page: both ids, checked together the way a look id is. */
export const sceneRefOf = (authorId: unknown, sceneId: unknown) =>
  typeof authorId === 'string' && typeof sceneId === 'string'
    ? parseMemberLookId(memberLookId(authorId.toLowerCase(), sceneId))
    : undefined;
