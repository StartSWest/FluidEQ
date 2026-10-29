import { ipcRenderer, type IpcRendererEvent } from 'electron';
import type { TSceneAnnouncementState } from './ipc/sceneAnnouncements';
import type { IAppNewsState } from '../common/appNews';

/**
 * The renderer's side of the announcement card. Its own module, like
 * `plusTermsNoticeBridge`, so `api.ts` gains one line.
 */
export const sceneInsightsBridge = {
  getAppNews: (refresh = false): Promise<IAppNewsState> =>
    ipcRenderer.invoke('app-news', refresh),
  appNewsSeen: (id: number): Promise<IAppNewsState> =>
    ipcRenderer.invoke('app-news-seen', id),
  onAppNews: (listener: (state: IAppNewsState) => void) => {
    const receive = (_event: IpcRendererEvent, state: IAppNewsState) =>
      listener(state);
    ipcRenderer.on('app-news-changed', receive);
    return () => ipcRenderer.removeListener('app-news-changed', receive);
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
};
