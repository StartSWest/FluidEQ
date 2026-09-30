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

import { ipcRenderer, IpcRendererEvent } from 'electron';
import type { IStudioNotes } from '../common/studioNotes';
import type { IScenePacksListing } from './ipc/scenePacks';
import type {
  ILinkFolderResult,
  IMemberScenesListing,
  IStudioState,
  TAddOutcome,
  TNewProjectResult,
  TRenameProjectResult,
} from './ipc/memberScenes';
import type {
  IPictureKeepRequest,
  TArtworkWrite,
  TPictureChoice,
  TStudioPictures,
} from './ipc/studioPictures';
import type { IStudioSettingsOutcome } from './ipc/studioSettings';
import type { ISceneResponse } from '../common/sceneResponse';
import type { ISceneWave } from '../common/sceneWave';
import type { TExportOutcome, TImportOutcome } from './ipc/memberSharing';
import type { IProjectSource, TSourceWrite } from './memberScenes/project';
import type { TInspectOutcome } from './ipc/studioInspect';
import type { TPublishOutcome } from './ipc/plusPublishing';
import type { TPlusCategory } from '../common/plusGallery';
import type { ILikeStatus } from './memberScenes/social';
import type { TSceneFailure } from './scenePackStore';
import type { IScenePack } from '../common/scenePacks';

/**
 * Scenes and the Studio: the Plus packs, a member's own scenes, and the
 * Studio's projects, pictures, notes, source and publishing.
 */

/** Summaries only — no shader source crosses until a pack is about to draw. */
const listScenePacks = () =>
  ipcRenderer.invoke('scene-packs-list') as Promise<IScenePacksListing>;

const loadScenePack = (id: string) =>
  ipcRenderer.invoke('scene-packs-load', id) as Promise<IScenePack | undefined>;

const refreshScenePacks = () =>
  ipcRenderer.invoke('scene-packs-refresh') as Promise<IScenePacksListing>;

const removeScenePack = (id: string) =>
  ipcRenderer.invoke('scene-packs-remove', id) as Promise<boolean>;

const reportScenePackFailure = (id: string, reason: TSceneFailure) =>
  ipcRenderer.invoke('scene-packs-report-failure', id, reason) as Promise<void>;

const onScenePacksChanged = (
  listener: (listing: IScenePacksListing) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, listing: IScenePacksListing) =>
    listener(listing);
  ipcRenderer.on('scene-packs-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('scene-packs-changed', wrapped);
  };
};

// Member scenes and the Studio. No call takes a path: folders are chosen in
// the system dialog by the main process, which never accepts one from here.
const listMemberScenes = () =>
  ipcRenderer.invoke('member-scenes-list') as Promise<IMemberScenesListing>;

const loadMemberScene = (lookId: string) =>
  ipcRenderer.invoke('member-scenes-load', lookId) as Promise<
    IScenePack | undefined
  >;

const removeMemberScene = (lookId: string) =>
  ipcRenderer.invoke('member-scenes-remove', lookId) as Promise<boolean>;

const reportMemberSceneFailure = (lookId: string, reason: TSceneFailure) =>
  ipcRenderer.invoke(
    'member-scenes-report-failure',
    lookId,
    reason,
  ) as Promise<void>;

const onMemberScenesChanged = (
  listener: (listing: IMemberScenesListing) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, listing: IMemberScenesListing) =>
    listener(listing);
  ipcRenderer.on('member-scenes-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('member-scenes-changed', wrapped);
  };
};

const openStudio = () =>
  ipcRenderer.invoke('studio-open') as Promise<IStudioState>;

const closeStudio = () => ipcRenderer.invoke('studio-close') as Promise<void>;

const linkStudioFolder = () =>
  ipcRenderer.invoke('studio-link-folder') as Promise<ILinkFolderResult>;

const selectStudioProject = (id: string) =>
  ipcRenderer.invoke('studio-select-project', id) as Promise<IStudioState>;

const forgetStudioProject = (id: string) =>
  ipcRenderer.invoke('studio-forget-project', id) as Promise<IStudioState>;

/** The project by its id and the name wanted: the new folder is made in main. */
const renameStudioProject = (id: string, name: string) =>
  ipcRenderer.invoke(
    'studio-rename-project',
    id,
    name,
  ) as Promise<TRenameProjectResult>;

/** Only the name goes: the folder is made from it in the main process. */
const createStudioProject = (name: string) =>
  ipcRenderer.invoke(
    'studio-create-project',
    name,
  ) as Promise<TNewProjectResult>;

const chooseStudioProjectsRoot = () =>
  ipcRenderer.invoke('studio-choose-root') as Promise<IStudioState>;

const addStudioSceneToLooks = () =>
  ipcRenderer.invoke('studio-add-to-looks') as Promise<TAddOutcome>;

const showStudioFolder = () =>
  ipcRenderer.invoke('studio-show-folder') as Promise<void>;

/** The pictures the open project's scene asks for, and its image now. */
const copyStudioPicture = (bytes: Uint8Array, name: string) =>
  ipcRenderer.invoke('studio-picture-copy', bytes, name) as Promise<
    import('./ipc/studioPictureCopy').TPictureCopyOutcome
  >;

const readStudioPictures = () =>
  ipcRenderer.invoke('studio-pictures') as Promise<TStudioPictures>;

/** A photo chosen in the system dialog; `label` names picture files in it. */
const chooseStudioPicture = (label: string) =>
  ipcRenderer.invoke('studio-choose-picture', label) as Promise<TPictureChoice>;

/**
 * The open scene's settings — its controls' values and how it answers the
 * music — written into its pack.json, and into the member's look of it.
 */
const writeStudioSettings = (settings: {
  params?: Record<string, number>;
  ambient?: Record<string, number>;
  response?: ISceneResponse | null;
  /** Where the scene wants the wave; `null` takes it out (`sceneWave.ts`). */
  wave?: ISceneWave | null;
}) =>
  ipcRenderer.invoke(
    'studio-write-settings',
    settings,
  ) as Promise<IStudioSettingsOutcome>;

/** The kept photo behind one of the scene's pictures, to frame it again. */
const readStudioPicturePhoto = (id: string) =>
  ipcRenderer.invoke('studio-picture-photo', id) as Promise<
    Uint8Array | undefined
  >;

/**
 * The scene's image with a photo laid in, saved where its pack.json says,
 * and the photo and its framing kept beside the scene.
 */
const saveStudioPicture = (picture: Uint8Array, keep?: IPictureKeepRequest) =>
  ipcRenderer.invoke(
    'studio-save-picture',
    picture,
    keep,
  ) as Promise<TArtworkWrite>;

/** The terms version this computer last shared a scene under; 0 for never. */
const readStudioNotes = (id: string) =>
  ipcRenderer.invoke('studio-notes-read', id) as Promise<
    IStudioNotes | undefined
  >;
const saveStudioNotes = (id: string, notes: IStudioNotes) =>
  ipcRenderer.invoke('studio-notes-save', id, notes) as Promise<boolean>;

/** A picture of the scene beside its files, for the member's AI to look at. */
const writeStudioPreview = (id: string, bytes: Uint8Array) =>
  ipcRenderer.invoke('studio-write-preview', id, bytes) as Promise<boolean>;

const studioTermsAgreed = () =>
  ipcRenderer.invoke('studio-terms-agreed') as Promise<number>;

const exportStudioScene = (termsVersion: number) =>
  ipcRenderer.invoke('studio-export', termsVersion) as Promise<TExportOutcome>;

const importMemberScene = () =>
  ipcRenderer.invoke('member-scenes-import') as Promise<TImportOutcome>;

const memberSceneLikeStatus = (lookId: string) =>
  ipcRenderer.invoke('member-scenes-like-status', lookId) as Promise<
    ILikeStatus | undefined
  >;

const likeMemberScene = (lookId: string, liked: boolean) =>
  ipcRenderer.invoke('member-scenes-like', lookId, liked) as Promise<
    ILikeStatus | undefined
  >;

const onStudioChanged = (listener: (state: IStudioState) => void) => {
  const wrapped = (_event: IpcRendererEvent, state: IStudioState) =>
    listener(state);
  ipcRenderer.on('studio-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('studio-changed', wrapped);
  };
};

/** The open project's scene source, sent again every time it changes on disk. */
const onStudioSourceChanged = (
  listener: (source: IProjectSource | null) => void,
) => {
  const wrapped = (_event: IpcRendererEvent, source: IProjectSource | null) =>
    listener(source);
  ipcRenderer.on('studio-source-changed', wrapped);
  return () => {
    ipcRenderer.removeListener('studio-source-changed', wrapped);
  };
};

/** Text only: the main process writes it into the open project's own file. */
const writeStudioSource = (text: string) =>
  ipcRenderer.invoke('studio-write-source', text) as Promise<TSourceWrite>;

/**
 * One of FluidEQ's own scenes, opened in the Studio to look inside. Only the
 * scene's id crosses; the main process finds the scene and checks it is
 * FluidEQ's.
 */
const inspectOfficialScene = (sceneId: string) =>
  ipcRenderer.invoke(
    'studio-inspect-official',
    sceneId,
  ) as Promise<TInspectOutcome>;

/**
 * Publishes the Studio's open project, read from disk in the main process;
 * the picture is the only thing sent from here, and it must be a small WebP.
 */
const publishStudioScene = (
  termsVersion: number,
  category: TPlusCategory,
  picture: Uint8Array,
  category2?: TPlusCategory,
  note?: string,
) =>
  ipcRenderer.invoke(
    'studio-publish',
    termsVersion,
    category,
    picture,
    category2,
    note,
  ) as Promise<TPublishOutcome>;

const studioBridge = {
  listScenePacks,
  loadScenePack,
  refreshScenePacks,
  removeScenePack,
  reportScenePackFailure,
  onScenePacksChanged,
  listMemberScenes,
  loadMemberScene,
  removeMemberScene,
  reportMemberSceneFailure,
  onMemberScenesChanged,
  openStudio,
  closeStudio,
  linkStudioFolder,
  selectStudioProject,
  forgetStudioProject,
  renameStudioProject,
  createStudioProject,
  chooseStudioProjectsRoot,
  addStudioSceneToLooks,
  showStudioFolder,
  copyStudioPicture,
  readStudioPictures,
  chooseStudioPicture,
  writeStudioSettings,
  readStudioPicturePhoto,
  saveStudioPicture,
  readStudioNotes,
  saveStudioNotes,
  writeStudioPreview,
  studioTermsAgreed,
  exportStudioScene,
  importMemberScene,
  memberSceneLikeStatus,
  likeMemberScene,
  onStudioChanged,
  onStudioSourceChanged,
  writeStudioSource,
  inspectOfficialScene,
  publishStudioScene,
};

export default studioBridge;
