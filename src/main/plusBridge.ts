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

import { ipcRenderer } from 'electron';
import type {
  TGalleryAddOutcome,
  TGalleryListOutcome,
  TGalleryPreviewOutcome,
  TGalleryVersionsOutcome,
} from './ipc/plusGallery';
import type {
  TMineOutcome,
  TPublishedSettingsOutcome,
  TUnpublishOutcome,
} from './ipc/plusPublishing';
import type { IGalleryQuery, TReportReason } from '../common/plusGallery';
import type {
  TModerationActOutcome,
  TModerationListOutcome,
  TModerationStatusOutcome,
} from './ipc/plusModeration';
import type {
  TPlusGiftActOutcome,
  TPlusGiftsListOutcome,
} from './ipc/plusGifts';
import type {
  TAccountListOutcome,
  TDeleteAccountOutcome,
  TFindAccountsOutcome,
} from './ipc/accountDeletion';
import type { IAccountListRequest } from '../common/adminAccounts';
import type {
  TModerationAction,
  TModerationList,
} from '../common/plusModeration';
import type { TPlusProfileResult } from './ipc/plusProfile';
import type { IPlusProfile } from '../common/plusProfile';

/**
 * The Plus gallery, the admin's queue, gifts and accounts, and a member's
 * profile. The server decides who may do what.
 */

// The Plus gallery. Scenes are named by author and scene id, never by a path.
const listGallery = (query: IGalleryQuery) =>
  ipcRenderer.invoke(
    'plus-gallery-list',
    query,
  ) as Promise<TGalleryListOutcome>;

const galleryPicture = (
  authorId: string,
  sceneId: string,
  version: number,
  revision?: string,
) =>
  ipcRenderer.invoke(
    'plus-gallery-picture',
    authorId,
    sceneId,
    version,
    revision,
  ) as Promise<string | undefined>;

/** The official scenes an account without Plus can taste live. */
const listGalleryTasteSamples = () =>
  ipcRenderer.invoke('plus-gallery-samples') as Promise<string[]>;

const previewGalleryScene = (
  authorId: string,
  sceneId: string,
  version: number,
  revision?: string,
) =>
  ipcRenderer.invoke(
    'plus-gallery-preview',
    authorId,
    sceneId,
    version,
    revision,
  ) as Promise<TGalleryPreviewOutcome>;

const addGalleryScene = (
  authorId: string,
  sceneId: string,
  version: number,
  revision?: string,
) =>
  ipcRenderer.invoke(
    'plus-gallery-add',
    authorId,
    sceneId,
    version,
    revision,
  ) as Promise<TGalleryAddOutcome>;

const reportGalleryScene = (
  authorId: string,
  sceneId: string,
  reason: TReportReason,
) =>
  ipcRenderer.invoke(
    'plus-gallery-report',
    authorId,
    sceneId,
    reason,
  ) as Promise<boolean>;

/** A scene's earlier versions, newest first, with what changed in each. */
const galleryVersions = (authorId: string, sceneId: string) =>
  ipcRenderer.invoke(
    'plus-gallery-versions',
    authorId,
    sceneId,
  ) as Promise<TGalleryVersionsOutcome>;

const myPublishedScenes = () =>
  ipcRenderer.invoke('plus-gallery-mine') as Promise<TMineOutcome>;

/** Where the open Studio project's settings stood when it was last published. */
const publishedStudioSettings = () =>
  ipcRenderer.invoke(
    'studio-published-settings',
  ) as Promise<TPublishedSettingsOutcome>;

const unpublishScene = (sceneId: string) =>
  ipcRenderer.invoke(
    'plus-gallery-unpublish',
    sceneId,
  ) as Promise<TUnpublishOutcome>;

// The admin's queue of reported scenes. The server decides who the admin is.
const moderationStatus = () =>
  ipcRenderer.invoke(
    'plus-moderation-status',
  ) as Promise<TModerationStatusOutcome>;

const listReportedScenes = (list: TModerationList) =>
  ipcRenderer.invoke(
    'plus-moderation-list',
    list,
  ) as Promise<TModerationListOutcome>;

const moderateScene = (
  action: TModerationAction,
  authorId: string,
  sceneId: string,
) =>
  ipcRenderer.invoke(
    'plus-moderation-act',
    action,
    authorId,
    sceneId,
  ) as Promise<TModerationActOutcome>;

// The admin's Plus gifts. The server decides who the admin is.
const listPlusGifts = () =>
  ipcRenderer.invoke('plus-gifts-list') as Promise<TPlusGiftsListOutcome>;

const givePlus = (gift: { email: string; note?: string; until?: number }) =>
  ipcRenderer.invoke('plus-gifts-give', gift) as Promise<TPlusGiftActOutcome>;

const takeBackPlus = (email: string) =>
  ipcRenderer.invoke(
    'plus-gifts-take-back',
    email,
  ) as Promise<TPlusGiftActOutcome>;

// The admin's accounts: every one a page at a time, the account behind an
// address, then deleting it for good. The server decides who the admin is.
const listAccounts = (request: IAccountListRequest) =>
  ipcRenderer.invoke('account-list', request) as Promise<TAccountListOutcome>;

const findAccountsToDelete = (email: string) =>
  ipcRenderer.invoke(
    'account-deletion-find',
    email,
  ) as Promise<TFindAccountsOutcome>;

const deleteAccount = (email: string) =>
  ipcRenderer.invoke(
    'account-deletion-delete',
    email,
  ) as Promise<TDeleteAccountOutcome>;

// The member's name on the board and in the gallery: read it, choose it, or
// change it. A result rather than a throw, so "that handle is taken" survives
// the bridge.
const plusProfile = () =>
  ipcRenderer.invoke('plus-profile') as Promise<
    TPlusProfileResult<IPlusProfile | null>
  >;
const plusCreateProfile = (handle: string, displayName: string) =>
  ipcRenderer.invoke('plus-create-profile', handle, displayName) as Promise<
    TPlusProfileResult<IPlusProfile>
  >;
const plusUpdateProfile = (handle: string, displayName: string) =>
  ipcRenderer.invoke('plus-update-profile', handle, displayName) as Promise<
    TPlusProfileResult<IPlusProfile>
  >;

const plusBridge = {
  listGallery,
  galleryPicture,
  listGalleryTasteSamples,
  previewGalleryScene,
  addGalleryScene,
  reportGalleryScene,
  galleryVersions,
  myPublishedScenes,
  publishedStudioSettings,
  unpublishScene,
  moderationStatus,
  listReportedScenes,
  moderateScene,
  listPlusGifts,
  givePlus,
  takeBackPlus,
  listAccounts,
  findAccountsToDelete,
  deleteAccount,
  plusProfile,
  plusCreateProfile,
  plusUpdateProfile,
};

export default plusBridge;
