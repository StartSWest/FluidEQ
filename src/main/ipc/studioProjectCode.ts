import { ipcMain } from 'electron';
import {
  readProjectCode,
  type IProjectCodeFile,
} from '../memberScenes/projectCode';
import {
  checkCodeDraft,
  writeCodeFile,
  type TCodeCheck,
  type TCodeWrite,
} from '../memberScenes/projectCodeDraft';

/**
 * The Studio's Code tab, as the renderer asks for the open project's files
 * (`memberScenes/projectCode.ts`), and checks and saves the one being edited
 * (`memberScenes/projectCodeDraft.ts`).
 *
 * Always the project on the bench, and only while it may be used; a file is
 * named by the page only to say which of the tab's own files it means, and
 * main finds it again among them, so there is nothing of the member's disk
 * it can reach by name. Checking and saving also refuse a scene opened to
 * look inside - one of FluidEQ's own, or a copy of another member's.
 */

const CHANNEL = 'studio-project-code';
const CHECK_CHANNEL = 'studio-check-code';
const WRITE_CHANNEL = 'studio-write-code';

export interface IStudioProjectCodeDeps {
  mayRead: () => boolean;
  /** Whether the open project's files may be written from the tab. */
  mayWrite: () => boolean;
  activeFolder: () => string | undefined;
}

/** Text the tab could have typed: a string no larger than any file it edits. */
const MAX_DRAFT_CHARS = 32 * 1024 * 1024;

const isDraft = (file: unknown, text: unknown): file is string =>
  typeof file === 'string' &&
  file.length <= 200 &&
  typeof text === 'string' &&
  text.length <= MAX_DRAFT_CHARS;

/** Registers the handlers; the returned function takes them away. */
export const registerStudioProjectCode = ({
  mayRead,
  mayWrite,
  activeFolder,
}: IStudioProjectCodeDeps): (() => void) => {
  ipcMain.handle(CHANNEL, async (): Promise<IProjectCodeFile[]> => {
    const folder = mayRead() ? activeFolder() : undefined;
    return folder ? readProjectCode(folder) : [];
  });
  ipcMain.handle(
    CHECK_CHANNEL,
    async (_event, file: unknown, text: unknown): Promise<TCodeCheck> => {
      const folder = mayWrite() ? activeFolder() : undefined;
      return folder && isDraft(file, text)
        ? checkCodeDraft(folder, file, text as string)
        : { ok: false, refused: 'not-editable' };
    },
  );
  ipcMain.handle(
    WRITE_CHANNEL,
    async (_event, file: unknown, text: unknown): Promise<TCodeWrite> => {
      const folder = mayWrite() ? activeFolder() : undefined;
      return folder && isDraft(file, text)
        ? writeCodeFile(folder, file, text as string)
        : 'not-editable';
    },
  );
  return () => {
    ipcMain.removeHandler(CHANNEL);
    ipcMain.removeHandler(CHECK_CHANNEL);
    ipcMain.removeHandler(WRITE_CHANNEL);
  };
};
