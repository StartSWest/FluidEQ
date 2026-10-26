import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TSceneAnnouncementState } from './ipc/sceneAnnouncements';

/**
 * The renderer's side of the announcement card. Its own module, like
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
};
