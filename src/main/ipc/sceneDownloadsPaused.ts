import type { BrowserWindow } from 'electron';
import { onSceneDownloadsPaused } from '../plus/sceneMediaApi';

/**
 * Tells the window when the server stops handing out scene downloads for the
 * day (`plus/sceneMediaApi.ts`): the window says so in words, once, wherever
 * the download was asked from — a gallery tile, a scene added, an update in
 * the background (`SceneDownloadsPausedNotice`). Sent on every refusal; the
 * window shows each pause once.
 */
const registerSceneDownloadsPausedNotice = ({
  getMainWindow,
}: {
  getMainWindow: () => BrowserWindow | null;
}): (() => void) =>
  onSceneDownloadsPaused((paused) => {
    getMainWindow()?.webContents.send('scene-downloads-paused', paused);
  });

export default registerSceneDownloadsPausedNotice;
