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
import { setKnownMaker } from './account/knownMakers';
import { appVersion } from './appVersion';
import { registerAccountIpc } from './ipc/account';
import { registerAccountDeletionIpc } from './ipc/accountDeletion';
import { registerLeaderboardIpc } from './ipc/leaderboard';
import { registerMakerMonthIpc } from './ipc/makerMonth';
import { registerMemberScenesIpc } from './ipc/memberScenes';
import { registerMemberSharingIpc } from './ipc/memberSharing';
import { registerPlusGalleryIpc } from './ipc/plusGallery';
import { registerPlusGiftsIpc } from './ipc/plusGifts';
import { registerPlusModerationIpc } from './ipc/plusModeration';
import { registerPlusProfileIpc } from './ipc/plusProfile';
import { registerPlusPublishingIpc } from './ipc/plusPublishing';
import { registerPlusReviewIpc } from './ipc/plusReview';
import { registerPlusTermsNoticeIpc } from './ipc/plusTermsNotice';
import { registerPlusTrialIpc } from './ipc/plusTrial';
import { registerPlusWelcomeIpc } from './ipc/plusWelcome';
import { registerScenePacksIpc } from './ipc/scenePacks';
import { registerStudioInspectIpc } from './ipc/studioInspect';
import { createGalleryAccess } from './plus/galleryAccess';
import { createStudioAgentDoor } from './studioAgent/studioAgentDoor';
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
 * review, the desktop backgrounds and the leaderboard.
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
  // The merchant has no test mode, so in development the Account panel can
  // ask the server to send the merchant's own signed events for this account
  // and watch the subscription switch on and off. Nothing to configure: the
  // server holds the secret and admits admins only. See
  // `membershipSimulator.ts`.
  const developmentSimulator = !app.isPackaged;
  // The leaderboard had a cast of twelve sample people ranked into it in
  // development, for a board with nobody in it. There are real people on it
  // now, and a made-up cast over them hides what is actually happening (Ivan,
  // 2026-09-20): the board is the server's answer, in every build.

  const accountIpc = registerAccountIpc({
    getMainWindow,
    userDataDir,
    logger: log,
    developmentEntitlement,
    developmentSimulator,
  });

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

  // Paying happens in a browser, so the membership turning on is the only
  // news the app gets of it. This marks that moment once per account.
  const plusWelcomeIpc = registerPlusWelcomeIpc({
    getMainWindow,
    userDataDir,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    logger: log,
  });

  const plusTrialIpc = registerPlusTrialIpc({
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    onTermsAgreed: plusTermsNoticeIpc.agreed,
  });

  // The premium looks ride on the account: they are listed only while the
  // subscription is live, and fetched on the same "somebody is back at the
  // machine" events. Registering reads the cache; it contacts nothing.
  const scenePacksIpc = registerScenePacksIpc({
    getMainWindow,
    userDataDir,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
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
    entitlement: accountIpc.entitlement,
    logger: log,
  });

  const wallpaperIpc = registerWallpaperIpc({
    getMainWindow,
    entitlement: accountIpc.entitlement,
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
    entitlement: accountIpc.entitlement,
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
  });
  const plusGalleryIpc = registerPlusGalleryIpc({
    access: galleryAccess,
    store: memberScenesIpc.store,
    refreshBlocked: memberSharingIpc.refreshBlocked,
    announce: memberScenesIpc.announce,
    onEntitlementChange: (listener) =>
      accountIpc.entitlement.subscribe(listener),
    officialStore: scenePacksIpc.store,
    announceOfficial: scenePacksIpc.announce,
    logger: log,
    // Gallery pictures kept between sessions, so a card seen before is not
    // downloaded again (`plus/pictureDiskCache.ts`).
    pictureDir: path.join(userDataDir, 'gallery-pictures'),
  });
  // Scenes under review (premium migration 0037): the admin's queue and
  // answers, a maker's list of what they sent, and the corner notice telling
  // either of them there is news. An approval puts a scene in the gallery.
  // Signing out must take the notice away too, which the membership alone
  // never says (`onIdentityChange`).
  const plusReviewIpc = registerPlusReviewIpc({
    getMainWindow,
    userDataDir,
    access: galleryAccess,
    onGalleryChanged: async () => {
      await plusGalleryIpc.refreshIfDue(true);
    },
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
  // What a maker earned by publishing, for the account panel to count down —
  // and, when the server says this account is one, the note that keeps their
  // single Studio project open after the earned month runs out.
  const makerMonthIpc = registerMakerMonthIpc({
    access: galleryAccess,
    onMaker: (id, maker) => {
      if (setKnownMaker(userDataDir, id, maker)) {
        // The Studio is drawn from what it was last told; an answer that
        // changed has to reach it, or a first approval leaves the page locked
        // until the window is opened again.
        memberScenesIpc.makerChanged();
      }
    },
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
  const plusPublishingIpc = registerPlusPublishingIpc({
    access: galleryAccess,
    userDataDir,
    activeFolder: memberScenesIpc.activeFolder,
    activeIsInspection: memberScenesIpc.activeIsInspection,
    mayPublishActive: memberScenesIpc.mayUseActive,
    onTermsAgreed: plusTermsNoticeIpc.agreed,
    onPublished: () => {
      plusGalleryIpc
        .refreshIfDue(true)
        .catch((error) =>
          log.warn('Gallery refresh after publication failed', error),
        );
      // A member's publication waits for review now: their list says so, and
      // the admin's queue grew.
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

  // The admin's queue of reported scenes. A takedown or a restore changes the
  // block list, which this computer holds a copy of and the gallery reads; a
  // deletion also takes away whatever the scene had waiting for review.
  const plusModerationIpc = registerPlusModerationIpc({
    access: galleryAccess,
    onBlockListChanged: async () => {
      await memberSharingIpc.refreshBlocked();
      await plusGalleryIpc.refreshIfDue(true);
      await plusReviewIpc.refreshNow();
    },
    logger: log,
  });

  // The admin's Plus gifts: addresses that count as paying without paying.
  // The server decides who the admin is (premium migration 0021).
  const plusGiftsIpc = registerPlusGiftsIpc({ access: galleryAccess });

  // The admin's account deletion, as the Plus terms promise it: the account
  // and everything tied to it, published files included (premium migration
  // 0031).
  const accountDeletionIpc = registerAccountDeletionIpc({
    access: galleryAccess,
  });

  // The member's name on the board and in the gallery. Registering contacts
  // nothing; the Plus tab asks for it when it opens.
  const plusProfileIpc = registerPlusProfileIpc({
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
  });

  // Listening minutes. Counted always, kept on this machine, and uploaded only
  // for an account that opted in — on the same events as everything else.
  const leaderboardIpc = registerLeaderboardIpc({
    getMainWindow,
    userDataDir,
    config: ACCOUNT_CONFIG,
    session: accountIpc.session,
    entitlement: accountIpc.entitlement,
    logger: log,
  });

  /** Everything above let go of, at quit. */
  const dispose = () => {
    // Aborts a sign-in that is still waiting on the browser. Without it the
    // loopback socket outlives the quit, and the next launch cannot bind while
    // the old listener is still holding a port nobody is going to answer on.
    accountIpc.dispose();
    plusTermsNoticeIpc.dispose();
    plusWelcomeIpc.dispose();
    plusTrialIpc.dispose();
    scenePacksIpc.dispose();
    plusModerationIpc.dispose();
    plusReviewIpc.dispose();
    plusGiftsIpc.dispose();
    accountDeletionIpc.dispose();
    disposeStudioInspect();
    plusPublishingIpc.dispose();
    plusGalleryIpc.dispose();
    memberSharingIpc.dispose();
    memberScenesIpc.dispose();
    makerMonthIpc.dispose();
    // Its listening socket, like the forum's, must not outlive the app.
    studioAgentDoor.dispose().catch(() => undefined);
    plusProfileIpc.dispose();
    leaderboardIpc.dispose();
  };

  return {
    accountIpc,
    plusTermsNoticeIpc,
    scenePacksIpc,
    memberSharingIpc,
    plusGalleryIpc,
    plusReviewIpc,
    leaderboardIpc,
    wallpaperIpc,
    dispose,
  };
};

export default registerMemberServices;
