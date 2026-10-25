import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IAnnouncementDraft } from '../common/sceneAnnouncements';
import type { TFavouritePeriod } from '../common/sceneTaste';
import type {
  TAccountScenesOutcome,
  TAdminAnnouncementsOutcome,
  TAdminOutcome,
  TFavouriteScenesOutcome,
  TRequestUsageOutcome,
  TServerUsageOutcome,
} from './ipc/adminInsights';
import type { TSceneAnnouncementState } from './ipc/sceneAnnouncements';

/**
 * The renderer's side of the announcement card, and the admin's readings and
 * composer behind it. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line.
 */
export const sceneInsightsBridge = {
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
  adminServerUsage: (): Promise<TServerUsageOutcome> =>
    ipcRenderer.invoke('admin-server-usage'),
  adminRequestUsage: (): Promise<TRequestUsageOutcome> =>
    ipcRenderer.invoke('admin-request-usage'),
};
