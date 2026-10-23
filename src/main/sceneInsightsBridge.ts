import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IAnnouncementDraft } from '../common/sceneAnnouncements';
import type { IListeningStatus, TListeningOutcome } from '../common/listening';
import type { TFavouritePeriod } from '../common/sceneTaste';
import type {
  TAccountScenesOutcome,
  TAdminAnnouncementsOutcome,
  TAdminListeningOutcome,
  TAdminOutcome,
  TFavouriteScenesOutcome,
  TRequestUsageOutcome,
  TServerUsageOutcome,
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

  /** Seconds of music; main keeps them only for an account that said yes. */
  listeningAccrue: (seconds: number): Promise<void> =>
    ipcRenderer.invoke('listening-accrue', seconds),
  listeningStatus: (): Promise<IListeningStatus> =>
    ipcRenderer.invoke('listening-status'),
  /** The account's answer; no also deletes what it sent. */
  setListeningSharing: (sharing: boolean): Promise<TListeningOutcome> =>
    ipcRenderer.invoke('listening-set-sharing', sharing),
  onListeningStatus: (listener: (status: IListeningStatus) => void) => {
    const receive = (_event: IpcRendererEvent, status: IListeningStatus) =>
      listener(status);
    ipcRenderer.on('listening-status-changed', receive);
    return () => {
      ipcRenderer.removeListener('listening-status-changed', receive);
    };
  },

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
  adminListening: (days: TFavouritePeriod): Promise<TAdminListeningOutcome> =>
    ipcRenderer.invoke('admin-listening', days),
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
