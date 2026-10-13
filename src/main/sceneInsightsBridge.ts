import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IAnnouncementDraft } from '../common/sceneAnnouncements';
import type { TFavouritePeriod } from '../common/sceneTaste';
import type {
  TAccountScenesOutcome,
  TAdminAnnouncementsOutcome,
  TAdminOutcome,
  TFavouriteScenesOutcome,
} from './ipc/adminInsights';
import type { TSceneAnnouncementState } from './ipc/sceneAnnouncements';

/**
 * The renderer's side of scene time, the announcement card, and the admin's
 * readings and composer behind both. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line.
 */
export const sceneInsightsBridge = {
  /** Seconds a look was drawn; main keeps them only once the member was told. */
  scenePlayAccrue: (lookId: string, seconds: number): Promise<void> =>
    ipcRenderer.invoke('scene-play-accrue', lookId, seconds),

  getSceneAnnouncement: (): Promise<TSceneAnnouncementState> =>
    ipcRenderer.invoke('scene-announcement'),
  sceneAnnouncementSeen: (id: number): Promise<TSceneAnnouncementState> =>
    ipcRenderer.invoke('scene-announcement-seen', id),
  onSceneAnnouncement: (
    listener: (announcement: TSceneAnnouncementState) => void,
  ) => {
    const receive = (
      _event: IpcRendererEvent,
      announcement: TSceneAnnouncementState,
    ) => listener(announcement);
    ipcRenderer.on('scene-announcement-changed', receive);
    return () => {
      ipcRenderer.removeListener('scene-announcement-changed', receive);
    };
  },

  // The admin's. The server decides who the admin is.
  adminAccountScenes: (userId: string): Promise<TAccountScenesOutcome> =>
    ipcRenderer.invoke('admin-account-scenes', userId),
  adminSceneFavourites: (
    days: TFavouritePeriod,
  ): Promise<TFavouriteScenesOutcome> =>
    ipcRenderer.invoke('admin-scene-favourites', days),
  adminAnnouncements: (): Promise<TAdminAnnouncementsOutcome> =>
    ipcRenderer.invoke('admin-announcements'),
  adminSaveAnnouncement: (
    draft: IAnnouncementDraft,
  ): Promise<TAdminOutcome<number>> =>
    ipcRenderer.invoke('admin-announcement-save', draft),
  adminCancelAnnouncement: (id: number): Promise<TAdminOutcome<true>> =>
    ipcRenderer.invoke('admin-announcement-cancel', id),
  adminTrialEnds: (): Promise<TAdminOutcome<number[]>> =>
    ipcRenderer.invoke('admin-trial-ends'),
};
