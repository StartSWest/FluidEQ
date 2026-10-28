/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import path from 'path';
import { ACCOUNT_CONFIG } from '../common/accountConfig';
import { startMainAddons } from './addons';
import { appVersion } from './appVersion';
import { registerAccountIpc } from './ipc/account';
import { registerCreatorIpc } from './ipc/creator';
import { registerMemberScenesIpc } from './ipc/memberScenes';
import { registerMemberSharingIpc } from './ipc/memberSharing';
import { registerPlusGalleryIpc } from './ipc/plusGallery';
import { registerPlusProfileIpc } from './ipc/plusProfile';
import { registerPlusPublishingIpc } from './ipc/plusPublishing';
import { registerPlusReviewIpc } from './ipc/plusReview';
import { registerPlusTermsNoticeIpc } from './ipc/plusTermsNotice';
import { registerSceneAnnouncementsIpc } from './ipc/sceneAnnouncements';
import { registerSceneStoreIpc } from './ipc/sceneStore';
import forgetListening from './usage/forgetListening';
import { registerSceneVersionsIpc } from './ipc/sceneVersions';
import { createVersionPins } from './keptVersions';
import { registerScenePacksIpc } from './ipc/scenePacks';
import { registerStudioInspectIpc } from './ipc/studioInspect';
import { createEncryptedJsonStore } from './encryptedJsonStore';
import { createGalleryAccess } from './plus/galleryAccess';
import {
  createSceneOwnership,
  isSceneStoreRecord,
} from './plus/sceneOwnership';
import openExternalIfSafe from './safeExternal';
import { createStudioAgentDoor } from './studioAgent/studioAgentDoor';
import { createStudioChat } from './studioChat/studioChat';
import { createArrangementStore } from './wallpaper/arrangement';
import registerWallpaperIpc from './wallpaper/register';
import { createWallpaperScenes } from './wallpaper/scenes';

export interface IMemberServicesDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
}

/**
 * The account and everything that rides on it: the Plus membership, its
 * terms, the looks, the members' scenes and the Studio, the gallery and its
 * review and the desktop backgrounds.
 *
 * Registers the channels and reads whatever session is already on disk; it
 * contacts nothing. A build with no backend configured resolves to a store
 * that reports signed out forever, so this costs an unconfigured checkout one
 * file read that finds nothing.
 */
const registerMemberServices = ({
  getMainWindow,
  userDataDir,
}: IMemberServicesDeps) => {
  // DEVELOPMENT ONLY, and compiled to nothing in a packaged build:
  // `isPackaged` is decided by the binary's name, which nothing here can
  // change. Two environment variables let the premium path be looked at
  // before a backend exists — a pretend subscription, and a directory of
  // signed packs from the publishing tool. Neither loosens anything: the
  // server still serves only paying accounts, and a pack still has to verify
  // against the compiled-in key.
  const developmentEntitlement =
    !app.isPackaged && process.env.FLUIDEQ_DEV_ENTITLED === '1'
      ? { state: 'active' as const, plan: 'plus (development)', renewing: true }
      : undefined;

  const accountIpc = registerAccountIpc({
    getMainWindow,
    userDataDir,
    logger: log,
    developmentEntitlement,
  });

  // The leaderboard's listening tally and computer id, gone with the board.
  forgetListening(userDataDir, log);

  // The Plus terms promise that a member is told when they change. Asks the
  // server which version this account agreed to on the same events as the
  // membership, and only until it knows.
  const plusTermsNoticeIpc = registerPlusTermsNoticeIpc({
    getMainWindow,
    userDataDir,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    logger: log,
  });

  // Which scenes this account may play: the ones it bought, and every one
  // while Plus lasts. Every gate below asks it, so a scene is one answer on
  // the graph, the desktop and the lamps (premium 0055).
  const sceneOwnership = createSceneOwnership({
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    onIdentityChange: accountIpc.onIdentityChange,
    store: createEncryptedJsonStore(
      userDataDir,
      'scene-store.json',
      isSceneStoreRecord,
    ),
    logger: log,
  });
  // Credits, a buy and a pack paid for in the browser, for the window.
  const sceneStoreIpc = registerSceneStoreIpc({
    getMainWindow,
    config: ACCOUNT_CONFIG,
    ownership: sceneOwnership,
    openExternal: openExternalIfSafe,
  });
  // Creators paid for their scenes: their figures, and signing up on Stripe's
  // own pages (premium 0064).
  const creatorIpc = registerCreatorIpc({
    getMainWindow,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    openExternal: openExternalIfSafe,
  });

  // The premium looks ride on the account: they are listed only while the
  // subscription is live, and fetched on the same "somebody is back at the
  // machine" events. Registering reads the cache; it contacts nothing.
  // Which earlier version of a scene plays, for both kinds of scene: the
  // versions themselves are kept by the stores (`keptVersions.ts`).
  const versionPins = createVersionPins(userDataDir);
  const scenePacksIpc = registerScenePacksIpc({
    getMainWindow,
    userDataDir,
    pins: versionPins,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    ownership: sceneOwnership,
    logger: log,
    // Late-bound: the gallery is registered further down, and this is only
    // called once the looks are opened.
    refreshGalleryScenes: () => plusGalleryIpc.refreshIfDue(),
  });

  // Scenes members make in the Studio. Registering watches nothing: the open
  // project's folder is watched only while the Studio is open.
  const memberScenesIpc = registerMemberScenesIpc({
    getMainWindow,
    userDataDir,
    documentsDir: app.getPath('documents'),
    session: accountIpc.session,
    ownership: sceneOwnership,
    pins: versionPins,
    logger: log,
  });
  const disposeSceneVersions = registerSceneVersionsIpc({
    pins: versionPins,
    officialStore: scenePacksIpc.store,
    memberStore: memberScenesIpc.store,
    ownership: sceneOwnership,
    announceOfficial: scenePacksIpc.announce,
    announceMember: memberScenesIpc.announce,
  });

  const wallpaperIpc = registerWallpaperIpc({
    getMainWindow,
    ownership: sceneOwnership,
    arrangement: createArrangementStore(userDataDir, log),
    ...createWallpaperScenes(scenePacksIpc, memberScenesIpc),
  });

  // Sharing them between members: export signed by the server, import
  // verified against the member key, likes, and the block list.
  const memberSharingIpc = registerMemberSharingIpc({
    getMainWindow,
    userDataDir,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    ownership: sceneOwnership,
    store: memberScenesIpc.store,
    activeFolder: memberScenesIpc.activeFolder,
    activeIsInspection: memberScenesIpc.activeIsInspection,
    restoreOwnProject: memberScenesIpc.restoreOwnProject,
    announce: memberScenesIpc.announce,
    onTermsAgreed: plusTermsNoticeIpc.agreed,
    logger: log,
  });

  // The Plus gallery: members' published scenes, found, added and reported;
  // and the member's own side of it — the Studio's Publish, their published
  // scenes, taking one down.
  const galleryAccess = createGalleryAccess({
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    ownership: sceneOwnership,
  });
  const plusGalleryIpc = registerPlusGalleryIpc({
    access: galleryAccess,
    store: memberScenesIpc.store,
    refreshBlocked: memberSharingIpc.refreshBlocked,
    announce: memberScenesIpc.announce,
    officialStore: scenePacksIpc.store,
    announceOfficial: scenePacksIpc.announce,
    logger: log,
    // Gallery pictures kept between sessions, so a card seen before is not
    // downloaded again (`plus/pictureDiskCache.ts`).
    pictureDir: path.join(userDataDir, 'gallery-pictures'),
  });
  // Scenes under review (premium migration 0037): a maker's list of what
  // they sent, and the corner notice telling them an answer came. Signing
  // out must take the notice away too, which the membership alone never says
  // (`onIdentityChange`).
  const plusReviewIpc = registerPlusReviewIpc({
    getMainWindow,
    userDataDir,
    access: galleryAccess,
    onAccountChange: (listener) => {
      const offMembership = accountIpc.entitlement.subscribe(listener);
      const offIdentity = accountIpc.onIdentityChange(listener);
      return () => {
        offMembership();
        offIdentity();
      };
    },
    logger: log,
  });
  // The member's own AI looking at the scene it is writing, over MCP on this
  // computer only — shut until the member opens it on the Studio's card.
  const studioAgentDoor = createStudioAgentDoor({
    userDataDir,
    getMainWindow,
    agentProject: memberScenesIpc.agentProject,
    appVersion: appVersion(),
    logger: log,
  });
  // The Studio's chat: the member's own Claude Code, working in the open
  // project, looking and hearing as the door above does, and making
  // pictures with the member's ChatGPT when they say so.
  const studioChat = createStudioChat({
    userDataDir,
    getMainWindow,
    agentProject: () => memberScenesIpc.agentProject(),
    door: { look: studioAgentDoor.look, hear: studioAgentDoor.hear },
    version: appVersion(),
    logger: log,
  });
  const plusPublishingIpc = registerPlusPublishingIpc({
    access: galleryAccess,
    userDataDir,
    activeFolder: memberScenesIpc.activeFolder,
    activeIsInspection: memberScenesIpc.activeIsInspection,
    mayPublishActive: memberScenesIpc.mayUseActive,
    onTermsAgreed: plusTermsNoticeIpc.agreed,
    onPublished: (author, pack) => {
      memberScenesIpc.keepPublished(author, pack);
      // The scene is the author's to play now: the store says so, the
      // Studio's draft mark goes and the graph may show it.
      sceneOwnership
        .refreshNow()
        .catch((error) =>
          log.warn('Scene store refresh after publication failed', error),
        );
      plusGalleryIpc
        .refreshIfDue(true)
        .catch((error) =>
          log.warn('Gallery refresh after publication failed', error),
        );
      // A member's publication waits for review now: their list says so.
      plusReviewIpc.refreshNow().catch(() => undefined);
    },
  });

  // "Open in Studio" for FluidEQ's own scenes: a project to look inside and
  // take ideas from, never one to add, export or publish.
  const disposeStudioInspect = registerStudioInspectIpc({
    access: galleryAccess,
    officialStore: scenePacksIpc.store,
    openInspection: memberScenesIpc.openInspection,
    logger: log,
  });

  // The big card announcing new scenes (premium migrations 0047, 0050).
  const sceneAnnouncementsIpc = registerSceneAnnouncementsIpc({
    getMainWindow,
    userDataDir,
    access: galleryAccess,
    onAccountChange: (listener) => {
      const offMembership = accountIpc.entitlement.subscribe(listener);
      const offIdentity = accountIpc.onIdentityChange(listener);
      return () => {
        offMembership();
        offIdentity();
      };
    },
    logger: log,
  });
  // The member's name in the gallery. Registering contacts
  // nothing; the Plus tab asks for it when it opens.
  const plusProfileIpc = registerPlusProfileIpc({
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
  });

  // Add-ons kept in this checkout's own `addons/` folder, loaded by
  // development alone (`addons.ts`); none in any build that ships.
  const addons = startMainAddons({
    getMainWindow,
    userDataDir,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    access: galleryAccess,
    onAccountChange: (listener) => {
      const offMembership = accountIpc.entitlement.subscribe(listener);
      const offIdentity = accountIpc.onIdentityChange(listener);
      return () => {
        offMembership();
        offIdentity();
      };
    },
    openExternal: openExternalIfSafe,
    refresh: {
      store: () => sceneOwnership.refreshNow(),
      blockList: () => memberSharingIpc.refreshBlocked(),
      gallery: async () => {
        await plusGalleryIpc.refreshIfDue(true);
      },
      reviewNews: () => plusReviewIpc.refreshNow(),
      announcements: (reason) => sceneAnnouncementsIpc.refreshIfDue(reason),
    },
    logger: log,
  });

  /** Everything above let go of, at quit. */
  const dispose = () => {
    // Aborts a sign-in that is still waiting on the browser. Without it the
    // loopback socket outlives the quit, and the next launch cannot bind while
    // the old listener is still holding a port nobody is going to answer on.
    accountIpc.dispose();
    plusTermsNoticeIpc.dispose();
    sceneStoreIpc.dispose();
    creatorIpc.dispose();
    sceneOwnership.dispose();
    scenePacksIpc.dispose();
    plusReviewIpc.dispose();
    disposeStudioInspect();
    disposeSceneVersions();
    plusPublishingIpc.dispose();
    plusGalleryIpc.dispose();
    memberSharingIpc.dispose();
    memberScenesIpc.dispose();
    // Its listening socket, like the forum's, must not outlive the app.
    studioAgentDoor.dispose().catch(() => undefined);
    // Claude Code ends with the app: nothing works in the member's project
    // once FluidEQ is gone.
    studioChat.dispose();
    plusProfileIpc.dispose();
    sceneAnnouncementsIpc.dispose();
    addons.dispose();
  };

  return {
    accountIpc,
    sceneOwnership,
    // What the lamps ask: the account's own scenes in its looks count, as
    // they play on the graph, approved or not.
    ownsAnyScene: () =>
      sceneOwnership.ownsAnything(memberScenesIpc.heldLookIds()),
    plusTermsNoticeIpc,
    scenePacksIpc,
    memberSharingIpc,
    plusGalleryIpc,
    plusReviewIpc,
    sceneAnnouncementsIpc,
    wallpaperIpc,
    addons,
    dispose,
  };
};

export default registerMemberServices;
