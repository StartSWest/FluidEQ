import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';
import { parseStudioNotes, type IStudioNotes } from '../../common/studioNotes';

const FILE = 'studio-notes.json';
const MAX_BYTES = 280000;

/** A bounded, plain-text sidecar, outside the shader/package trust path. */
export const readStudioNotes = (folder: string): IStudioNotes | undefined => {
  try {
    const file = path.join(folder, FILE);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
      return undefined;
    }
    return parseStudioNotes(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch {
    return undefined;
  }
};

export const registerStudioNotesIpc = ({
  folderFor,
  entitled,
}: {
  folderFor: (id: string) => string | undefined;
  entitled: () => boolean;
}) => {
  ipcMain.handle('studio-notes-read', (_event, id: unknown) => {
    const folder =
      typeof id === 'string' && entitled() ? folderFor(id) : undefined;
    return folder ? readStudioNotes(folder) : undefined;
  });
  ipcMain.handle('studio-notes-save', (_event, id: unknown, raw: unknown) => {
    const folder =
      typeof id === 'string' && entitled() ? folderFor(id) : undefined;
    const notes = parseStudioNotes(raw);
    if (!folder || !notes) {
      return false;
    }
    const temporary = path.join(folder, `.studio-notes-${randomUUID()}.tmp`);
    try {
      fs.writeFileSync(
        temporary,
        JSON.stringify({ schema: 1, ...notes }, null, 2),
        { encoding: 'utf8', flag: 'wx' },
      );
      fs.renameSync(temporary, path.join(folder, FILE));
      return true;
    } catch {
      return false;
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  });
  return () => {
    ipcMain.removeHandler('studio-notes-read');
    ipcMain.removeHandler('studio-notes-save');
  };
};
