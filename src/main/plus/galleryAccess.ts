import type { IAccountConfig } from '../../common/accountConfig';
import { memberLookId, parseMemberLookId } from '../../common/memberScenes';
import type { IEntitlement } from '../account/entitlement';
import type { IAccountSession } from '../account/session';
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

export interface IGalleryAccess {
  accountId(): string | undefined;
  entitled(): boolean;
  /** Bought, or every scene while Plus lasts (`sceneOwnership.ts`). */
  owns(lookId: string): boolean;
  /** The token wrapped for the server client, or nothing when signed out. */
  auth(): Promise<IGalleryAuth | undefined>;
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
  return {
    accountId,
    entitled: () =>
      entitlement.status().state !== 'none' && accountId() !== undefined,
    owns: (lookId) => ownership.owns(lookId),
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
