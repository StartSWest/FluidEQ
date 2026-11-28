/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow } from 'electron';
import {
  isAccountConfigured,
  type IAccountConfig,
} from '../common/accountConfig';
import { parseMemberLookId } from '../common/memberScenes';
import { isPremiumLookId, packIdOfLook } from '../common/scenePacks';
import type { ILapsedScene } from '../common/subscription';
import type { IEntitlement } from './account/entitlement';
import type { IAccountSession } from './account/session';
import { createSubscriptionAccount } from './account/subscriptionAccount';
import { createSubscriptionAdds } from './account/subscriptionAdds';
import { createSubscriptionLapse } from './account/subscriptionLapse';
import {
  createSubscriptionRecords,
  isSubscriptionRecordFile,
  SUBSCRIPTION_FILE,
} from './account/subscriptionRecord';
import { createSubscriptionService } from './account/subscriptionService';
import { createEncryptedJsonStore } from './encryptedJsonStore';
import registerPlusSubscriptionIpc from './ipc/plusSubscription';
import type { IMemberSceneStore } from './memberScenes/store';
import { createAccountPush } from './plus/accountPush';
import { creditsTopic } from './plus/creditsPush';
import type { IGalleryAccess } from './plus/galleryAccess';
import type { ISceneOwnership } from './plus/sceneOwnership';
import type { IScenePackStore } from './scenePackStore';

/**
 * Plus, the scene subscription, put together: what the account's Plus is
 * doing (`subscriptionAccount.ts`), what this computer keeps of it
 * (`subscriptionRecord.ts`), the window's checkout and portal
 * (`subscriptionService.ts`), what an add from Scenes means to it
 * (`subscriptionAdds.ts`), and what happens here when it ends
 * (`subscriptionLapse.ts`). Plus covers scenes only: nothing here touches a
 * preset, a dial, the Room or the EQ.
 */

export interface IPlusSubscriptionDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  config: IAccountConfig;
  session: IAccountSession;
  entitlement: IEntitlement;
  onIdentityChange: (listener: () => void) => () => void;
  ownership: ISceneOwnership;
  galleryAccess: Pick<IGalleryAccess, 'auth'>;
  /** FluidEQ's own scenes held here, and their listing's announcement. */
  official: { store: IScenePackStore; announce: () => void };
  /** Members' scenes held here, and their listing's announcement. */
  members: { store: IMemberSceneStore; announce: () => void };
  /** A member's scene removed takes its last build with it (`sceneBuilds.ts`). */
  forgetBuild: (lookId: string) => void;
  openExternal: (url: string) => boolean;
  logger: { info(message: string): void; warn(message: string): void };
}

export const registerPlusSubscription = ({
  getMainWindow,
  userDataDir,
  config,
  session,
  entitlement,
  onIdentityChange,
  ownership,
  galleryAccess,
  official,
  members,
  forgetBuild,
  openExternal,
  logger,
}: IPlusSubscriptionDeps) => {
  const accountId = () => session.state().identity?.id;
  const configured = isAccountConfigured(config);
  const records = createSubscriptionRecords({
    store: createEncryptedJsonStore(
      userDataDir,
      SUBSCRIPTION_FILE,
      isSubscriptionRecordFile,
    ),
    logger,
  });
  const account = createSubscriptionAccount({
    entitlement,
    ownership,
    watch: records,
    accountId,
    onIdentityChange,
    // The server's word that the account's Plus row moved (0122), heard
    // while a checkout or a portal visit is owed an answer.
    ...(configured
      ? {
          createPush: (onEvent: () => void) =>
            createAccountPush({
              config,
              session,
              topicOf: creditsTopic,
              event: 'entitlement',
              name: 'Plus',
              onEvent,
              logger,
            }),
        }
      : {}),
    now: Date.now,
    logger,
  });
  const service = createSubscriptionService({
    configured: () => configured,
    accountId,
    subscription: account,
    ownership,
    records,
    auth: () => galleryAccess.auth(),
    openExternal,
    logger,
  });
  const adds = createSubscriptionAdds({
    accountId,
    subscription: account,
    ownership,
    records,
    auth: () => galleryAccess.auth(),
    logger,
  });

  /** Deletes Plus's downloads as removing them by hand does, naming each. */
  const remove = (lookIds: readonly string[]): ILapsedScene[] => {
    const deleted: ILapsedScene[] = [];
    let officialChanged = false;
    let membersChanged = false;
    lookIds.forEach((lookId) => {
      try {
        if (isPremiumLookId(lookId)) {
          const id = packIdOfLook(lookId);
          const held = official.store.list().find((pack) => pack.id === id);
          if (held && official.store.remove(id)) {
            officialChanged = true;
            deleted.push({ lookId, names: held.names });
          }
          return;
        }
        const ref = parseMemberLookId(lookId);
        const held = members.store
          .list()
          .find((scene) => scene.lookId === lookId);
        if (ref && held && members.store.remove(ref.authorId, ref.packId)) {
          membersChanged = true;
          forgetBuild(lookId);
          deleted.push({ lookId, names: held.names });
        }
      } catch (error) {
        logger.warn(
          `Plus ended; ${lookId} could not be deleted: ${String(error)}`,
        );
      }
    });
    if (officialChanged) {
      official.announce();
    }
    if (membersChanged) {
      members.announce();
    }
    return deleted;
  };

  const lapse = createSubscriptionLapse({
    accountId,
    ownership,
    subscription: account,
    remove,
    records,
    logger,
  });

  const ipc = registerPlusSubscriptionIpc({
    getMainWindow,
    subscription: service,
    readAgain: () => {
      if (!configured) {
        return;
      }
      entitlement.checkNow().catch(() => undefined);
      ownership.refreshNow().catch(() => undefined);
    },
  });

  return {
    /** A scene the member chose to add is in their looks now. */
    added: (lookId: string) => {
      adds.added(lookId).catch(() => undefined);
    },
    dispose: () => {
      ipc.dispose();
      lapse.dispose();
      service.dispose();
      account.dispose();
    },
  };
};
