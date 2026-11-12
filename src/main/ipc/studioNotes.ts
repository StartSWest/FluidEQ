import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { ipcMain } from 'electron';
import {
  isOldNote,
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

/** The update note the folder's notes carry now, if any. */
export const versionNoteOf = (folder: string): string | undefined =>
  readStudioNotes(folder)?.whatsNew;

/**
 * The update note taken out once the version it describes has gone out: it
 * is about everything since the gallery's version, so after a publication it
 * describes nothing still to come. Kept, it was offered again for the next
 * version and the member's AI folded its next change into a line about the
 * last one. The rest of the notes stay as they are. True when it was taken.
 */
export const clearVersionNote = (folder: string): boolean => {
  const notes = readStudioNotes(folder);
  if (!notes?.whatsNew) {
    return false;
  }
  return writeStudioNotes(folder, {
    description: notes.description,
    ...(notes.earlierIdea ? { earlierIdea: notes.earlierIdea } : {}),
    ...(notes.published === undefined ? {} : { published: notes.published }),
  });
};

/**
 * A version went out from this folder: its line taken out, and the notes
 * stamped with the moment, so a line found in them later is known to be
 * newer than every version gone out (`isOldNote`). Notes that do not exist
 * are left so: there is no line in them to mistake.
 */
export const markNotesPublished = (folder: string, at: number): boolean => {
  const notes = readStudioNotes(folder);
  if (!notes) {
    return false;
  }
  return writeStudioNotes(folder, {
    description: notes.description,
    ...(notes.earlierIdea ? { earlierIdea: notes.earlierIdea } : {}),
    published: at,
  });
};

/** When the folder's notes were last written, in ms, or undefined. */
export const notesWrittenAt = (folder: string): number | undefined => {
  try {
    return fs.statSync(path.join(folder, FILE)).mtimeMs;
  } catch {
    return undefined;
  }
};

/** The notes as the page reads them: with when the file was last written. */
export const readNotesWithTime = (folder: string): IStudioNotes | undefined => {
  const notes = readStudioNotes(folder);
  const writtenAt = notesWrittenAt(folder);
  return notes && writtenAt !== undefined ? { ...notes, writtenAt } : notes;
};

/**
 * The update note taken out when it is older than the gallery's version
 * (`isOldNote`, `time` when that version went out): it is about that
 * version or an earlier one, never about what is still to go out. Notes
 * kept their line through every publication until 2026-11-12 (all 40 of
 * Ivan's local scenes held one), and an AI told to fold its change into the
 * line there folded it into last version's. True when it was taken.
 */
export const clearNoteOlderThan = (folder: string, time: number): boolean =>
  isOldNote(readNotesWithTime(folder), time) && clearVersionNote(folder);

export const registerStudioNotesIpc = ({
  folderFor,
  writableFolderFor,
}: {
  /**
   * The folder of the project the page names, or nothing when there is no
   * such project or the member may not use it. The one decision, made where
   * the projects are known: a yes-or-no asked here about some other project
   * — the open one — answered for the wrong folder.
   */
  folderFor: (id: string) => string | undefined;
  /**
   * The same, for a write: never a scene opened only to look inside - one
   * of FluidEQ's own, or a copy of another member's - whose notes are read
   * and never changed.
   */
  writableFolderFor: (id: string) => string | undefined;
}) => {
  ipcMain.handle('studio-notes-read', (_event, id: unknown) => {
    const folder = typeof id === 'string' ? folderFor(id) : undefined;
    if (!folder) {
      return undefined;
    }
    stripStoredBrief(folder);
    return readNotesWithTime(folder);
  });
  ipcMain.handle('studio-notes-save', (_event, id: unknown, raw: unknown) => {
    const folder = typeof id === 'string' ? writableFolderFor(id) : undefined;
    const notes = parseStudioNotes(raw);
    if (!folder || !notes) {
      return false;
    }
    // The earlier idea is the folder's, never the page's to drop: a save
    // that does not name it keeps the one the file holds.
    const held = readStudioNotes(folder);
    const earlierIdea = notes.earlierIdea ?? held?.earlierIdea;
    // When a version last went out is FluidEQ's to stamp at publishing,
    // never the page's to set or drop: the file's is kept.
    return writeStudioNotes(folder, {
      description: notes.description,
      ...(notes.whatsNew ? { whatsNew: notes.whatsNew } : {}),
      ...(earlierIdea ? { earlierIdea } : {}),
      ...(held?.published === undefined ? {} : { published: held.published }),
    });
  });
  return () => {
    ipcMain.removeHandler('studio-notes-read');
    ipcMain.removeHandler('studio-notes-save');
  };
};
