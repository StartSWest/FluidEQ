import { dialog, ipcMain, type BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

export type TPictureCopyOutcome = 'saved' | 'cancelled' | 'failed';

/** Only image bytes go to a path selected in the native save dialog. */
export const registerStudioPictureCopy = ({
  getMainWindow,
  entitled,
  activeFolder,
  dialogImpl = dialog,
}: {
  getMainWindow: () => BrowserWindow | null;
  entitled: () => boolean;
  activeFolder: () => string | undefined;
  dialogImpl?: Pick<typeof dialog, 'showSaveDialog'>;
}) => {
  ipcMain.handle(
    'studio-picture-copy',
    async (
      _event,
      raw: unknown,
      suggested: unknown,
    ): Promise<TPictureCopyOutcome> => {
      const folder = activeFolder();
      if (
        !folder ||
        !entitled() ||
        !(raw instanceof Uint8Array) ||
        raw.byteLength > 40 * 1024 * 1024
      ) {
        return 'failed';
      }
      const bytes = Buffer.from(raw);
      const png = bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
      if (!png && !webp) {
        return 'failed';
      }
      const extension = png ? 'png' : 'webp';
      const name =
        typeof suggested === 'string' &&
        /^[a-z][a-z0-9_-]{0,63}$/.test(suggested)
          ? suggested
          : 'scene-image';
      try {
        const options = {
          defaultPath: path.join(folder, `${name}-copy.${extension}`),
          filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
        };
        const window = getMainWindow();
        const chosen = window
          ? await dialogImpl.showSaveDialog(window, options)
          : await dialogImpl.showSaveDialog(options);
        if (chosen.canceled || !chosen.filePath) {
          return 'cancelled';
        }
        if (!entitled() || activeFolder() !== folder) {
          return 'failed';
        }
        await fs.promises.writeFile(chosen.filePath, bytes);
        return 'saved';
      } catch {
        return 'failed';
      }
    },
  );
  return () => ipcMain.removeHandler('studio-picture-copy');
};
