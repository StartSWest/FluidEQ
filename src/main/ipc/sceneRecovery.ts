/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import { memberLookId, parseMemberLookId } from '../../common/memberScenes';
import {
  createSceneRecovery,
  type ISceneRecoveryDeps,
  type TSceneRecovery,
} from '../memberScenes/sceneRecovery';
import type { IMemberSceneStore } from '../memberScenes/store';
import { fetchEnvelope } from '../plus/galleryApi';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { fetchKeptEnvelope } from '../plus/keptScene';

/**
 * The window's request to put right a look that would not play
 * (`memberScenes/sceneRecovery.ts`). Asked only for a scene this account may
 * play - its own, or one it owns - and never for one FluidEQ has blocked:
 * a recovery fetches and keeps a copy, and must give nobody a scene they did
 * not have.
 */

export interface ISceneRecoveryIpcDeps {
  access: Pick<IGalleryAccess, 'accountId' | 'auth' | 'owns'>;
  store: IMemberSceneStore;
  ownProjectFolders: ISceneRecoveryDeps['ownProjectFolders'];
  announce: () => void;
  /**
   * The version kept for this look's owners after its maker unpublished it
   * (premium 0103), or undefined while it is in the gallery: a scene out of
   * the gallery is put right from that copy instead.
   */
  keptVersionOf?: (lookId: string) => number | undefined;
  logger?: { info(message: string): void; warn(message: string): void };
}

const CHANNEL = 'member-scenes-recover';

export const registerSceneRecoveryIpc = ({
  access,
  store,
  ownProjectFolders,
  announce,
  keptVersionOf,
  logger,
}: ISceneRecoveryIpcDeps) => {
  const recovery = createSceneRecovery({
    store,
    accountId: access.accountId,
    ownProjectFolders,
    announce,
    fetchGalleryCopy: async (authorId, sceneId) => {
      const auth = await access.auth();
      if (!auth) {
        return undefined;
      }
      const published = await fetchEnvelope(auth, authorId, sceneId);
      if (published) {
        return published;
      }
      const kept = keptVersionOf?.(memberLookId(authorId, sceneId));
      return kept === undefined
        ? undefined
        : fetchKeptEnvelope(auth, authorId, sceneId, kept);
    },
    ...(logger ? { logger } : {}),
  });

  const mayRecover = (lookId: string) => {
    const ref = parseMemberLookId(lookId);
    return (
      ref !== undefined &&
      !store.isBlocked(ref.authorId, ref.packId) &&
      (ref.authorId === access.accountId() || access.owns(lookId))
    );
  };

  /** The window's ask and main's own (a desktop background) go through here. */
  const recover = async (lookId: unknown): Promise<TSceneRecovery> =>
    typeof lookId === 'string' && mayRecover(lookId)
      ? recovery.recover(lookId)
      : { recovered: false };

  ipcMain.handle(CHANNEL, (_event, lookId: unknown) => recover(lookId));

  return {
    recover,
    dispose: () => ipcMain.removeHandler(CHANNEL),
  };
};
