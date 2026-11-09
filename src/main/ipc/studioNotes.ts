import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';
import {
  notesHoldBrief,
  parseStudioNotes,
  type IStudioNotes,
} from '../../common/studioNotes';

const FILE = 'studio-notes.json';
const MAX_BYTES = 280000;

/** The notes as written, or nothing for a file that is not a plain one. */
const readRawNotes = (folder: string): unknown => {
  try {
    const file = path.join(folder, FILE);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) {
      return undefined;
    }
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
};

/** A bounded, plain-text sidecar, outside the shader/package trust path. */
export const readStudioNotes = (folder: string): IStudioNotes | undefined =>
  parseStudioNotes(readRawNotes(folder));

/** The notes written beside and renamed over, so no reader sees half. */
const writeStudioNotes = (folder: string, notes: IStudioNotes): boolean => {
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
};

/**
 * Takes a brief an earlier FluidEQ kept in a project's notes back out
 * (`studioNotes.ts`), keeping the member's description, their AI's line and
 * any idea the brief carried that the description does not say. Notes that
 * cannot be read as notes are left as they are: nothing in them is lost to
 * a brief being taken out. True when the file was rewritten.
 */
export const stripStoredBrief = (folder: string): boolean => {
  const raw = readRawNotes(folder);
  if (!notesHoldBrief(raw)) {
    return false;
  }
  const notes = parseStudioNotes(raw);
  return notes ? writeStudioNotes(folder, notes) : false;
};

export const registerStudioNotesIpc = ({
  folderFor,
}: {
  /**
   * The folder of the project the page names, or nothing when there is no
   * such project or the member may not use it. The one decision, made where
   * the projects are known: a yes-or-no asked here about some other project
   * — the open one — answered for the wrong folder.
   */
  folderFor: (id: string) => string | undefined;
}) => {
  ipcMain.handle('studio-notes-read', (_event, id: unknown) => {
    const folder = typeof id === 'string' ? folderFor(id) : undefined;
    if (!folder) {
      return undefined;
    }
    stripStoredBrief(folder);
    return readStudioNotes(folder);
  });
  ipcMain.handle('studio-notes-save', (_event, id: unknown, raw: unknown) => {
    const folder = typeof id === 'string' ? folderFor(id) : undefined;
    const notes = parseStudioNotes(raw);
    if (!folder || !notes) {
      return false;
    }
    // The earlier idea is the folder's, never the page's to drop: a save
    // that does not name it keeps the one the file holds.
    const earlierIdea =
      notes.earlierIdea ?? readStudioNotes(folder)?.earlierIdea;
    return writeStudioNotes(folder, {
      ...notes,
      ...(earlierIdea ? { earlierIdea } : {}),
    });
  });
  return () => {
    ipcMain.removeHandler('studio-notes-read');
    ipcMain.removeHandler('studio-notes-save');
  };
};
