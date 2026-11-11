import { ipcMain } from 'electron';
import {
  readProjectCode,
  type IProjectCodeFile,
} from '../memberScenes/projectCode';

/**
 * The Studio's Code tab, as the renderer asks for the open project's files
 * (`memberScenes/projectCode.ts`).
 *
 * Always the project on the bench, and only while it may be used; the page
 * names no folder and no file, so there is nothing of the member's disk it
 * can ask for by name.
 */

const CHANNEL = 'studio-project-code';

export interface IStudioProjectCodeDeps {
  mayRead: () => boolean;
  activeFolder: () => string | undefined;
}

/** Registers the handler; the returned function takes it away. */
export const registerStudioProjectCode = ({
  mayRead,
  activeFolder,
}: IStudioProjectCodeDeps): (() => void) => {
  ipcMain.handle(CHANNEL, async (): Promise<IProjectCodeFile[]> => {
    const folder = mayRead() ? activeFolder() : undefined;
    return folder ? readProjectCode(folder) : [];
  });
  return () => ipcMain.removeHandler(CHANNEL);
};
