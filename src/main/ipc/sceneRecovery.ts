/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import { parseMemberLookId } from '../../common/memberScenes';
import {
  createSceneRecovery,
  type ISceneRecoveryDeps,
  type TSceneRecovery,
} from '../memberScenes/sceneRecovery';
import type { IMemberSceneStore } from '../memberScenes/store';
import { fetchEnvelope } from '../plus/galleryApi';
import type { IGalleryAccess } from '../plus/galleryAccess';

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
  logger?: { info(message: string): void; warn(message: string): void };
}

const CHANNEL = 'member-scenes-recover';

export const registerSceneRecoveryIpc = ({
  access,
  store,
  ownProjectFolders,
  announce,
  logger,
}: ISceneRecoveryIpcDeps) => {
  const recovery = createSceneRecovery({
    store,
    accountId: access.accountId,
    ownProjectFolders,
    announce,
    fetchGalleryCopy: async (authorId, sceneId) => {
      const auth = await access.auth();
      return auth ? fetchEnvelope(auth, authorId, sceneId) : undefined;
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

  ipcMain.handle(
    CHANNEL,
    async (_event, lookId: unknown): Promise<TSceneRecovery> =>
      typeof lookId === 'string' && mayRecover(lookId)
        ? recovery.recover(lookId)
        : { recovered: false },
  );

  return () => ipcMain.removeHandler(CHANNEL);
};
