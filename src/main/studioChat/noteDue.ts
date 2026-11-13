/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import {
  MAX_VERSION_NOTE,
  readVersionNote,
  VERSION_NOTE_LOCALES,
  type TVersionNoteLocale,
} from '../../common/sceneVersionNote';
import { STUDIO_NOTES_CONTRACT } from '../../common/studioNotes';
import { clearNoteOlderThan, versionNoteOf } from '../ipc/studioNotes';
import { sceneFingerprint } from './chatVersions';

/**
 * Whether a chat's turn owes the scene its update note, judged at the turn's
 * end rather than left to the AI (Ivan, 2026-11-12: "see agent still not
 * able to write notes on updates", "when the scene completes it needs to
 * sets the notes automatically"). The brief asked the AI to write the line
 * and nothing checked: an update of Balloon Dawn reached the publish
 * dialog with the box empty and the red "say what is new" under it.
 *
 * The mark is taken when the first turn since the note was last settled
 * begins; at a turn's end the scene's own files are compared with it. A
 * scene that changed while its note did not owes one - but only a scene in
 * the gallery, which has a version to be new against. A first version's
 * line, what the scene is, is asked for by the publish dialog
 * (`FIRST_VERSION_NOTE_ASK`).
 */
export interface INoteMark {
  /** The scene's own files (`sceneFingerprint`), undefined when unread. */
  scene: string | undefined;
  /** The update note then. */
  line: string | undefined;
}

/** The scene id the folder's pack.json gives, or undefined. */
export const sceneIdOf = (folder: string): string | undefined => {
  try {
    const { id } = JSON.parse(
      fs.readFileSync(path.join(folder, 'pack.json'), 'utf8'),
    ) as { id?: unknown };
    return typeof id === 'string' ? id : undefined;
  } catch {
    return undefined;
  }
};

/**
 * An update note older than the gallery's version taken out before anything
 * reads or folds into it (`clearNoteOlderThan`). `galleryAt` is when the
 * scene's version in the gallery went out, as the gallery last said.
 */
export const clearOldNote = (
  folder: string,
  galleryAt: (sceneId: string) => number | undefined,
): boolean => {
  const sceneId = sceneIdOf(folder);
  const at = sceneId === undefined ? undefined : galleryAt(sceneId);
  return at !== undefined && clearNoteOlderThan(folder, at);
};

export const noteMarkOf = (folder: string): INoteMark => ({
  scene: sceneFingerprint(folder),
  line: versionNoteOf(folder),
});

/**
 * True when the scene changed since `before` and its note did not. A mark is
 * only taken of a scene in the gallery (`chatTurns.ts`). A scene that could
 * not be read either time is judged unchanged: a turn is never followed by a
 * request for a note about a change nobody could see.
 */
export const noteDue = (before: INoteMark, after: INoteMark): boolean =>
  before.scene !== undefined &&
  after.scene !== undefined &&
  before.scene !== after.scene &&
  before.line === after.line;

/**
 * What FluidEQ hands the chat when a turn changed a published scene and
 * left its note as it was, or when the publish dialog finds none. Not in the
 * member's name: the chat shows no message of theirs for it, only the short
 * reply. English, like the brief: it is read by a model.
 */
export const VERSION_NOTE_ASK = `FLUIDEQ, NOT THE MEMBER: the scene has changed since the version the Gallery has, and its publish line does not say so yet. Write it now with write_whats_new: one line of at most ${MAX_VERSION_NOTE} characters saying what changed as a listener would notice it, covering everything since the Gallery's version - fold in any line already there - in ${VERSION_NOTE_LOCALES.join(', ')} (every listener reads their own). Change nothing in the scene. ${STUDIO_NOTES_CONTRACT} Then answer with the English line alone.`;

/**
 * The same ask for a scene's FIRST publication (Ivan, 2026-11-13: notes are
 * required "even on first version"): there is no earlier version to be new
 * against, so the line says what the scene is, as a listener would see and
 * hear it — the first entry on its versions page.
 */
export const FIRST_VERSION_NOTE_ASK = `FLUIDEQ, NOT THE MEMBER: the scene is about to be published to the Gallery for the first time, and its publish line is empty. A first version needs one too. Write it now with write_whats_new: one line of at most ${MAX_VERSION_NOTE} characters saying what the scene is, as a listener would see and hear it - not how it was made - in ${VERSION_NOTE_LOCALES.join(', ')} (every listener reads their own). Change nothing in the scene. ${STUDIO_NOTES_CONTRACT} Then answer with the English line alone.`;

/** Whether the window's ask is for a first publication's line. */
export const readNoteFirst = (raw: unknown): boolean =>
  isRecord(raw) && raw.first === true;

/**
 * A line the member changed in the publish dialog, to be written in every
 * language before it goes out (Ivan, 2026-11-12): the words as the member
 * left them and the language they are in.
 */
export interface INoteTranslation {
  line: string;
  from: TVersionNoteLocale;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * The translation the window's ask carries (its `translate`), or undefined
 * when it carries none or not one that can be asked for.
 */
export const readNoteTranslation = (
  raw: unknown,
): INoteTranslation | undefined => {
  const asked = isRecord(raw) ? raw.translate : undefined;
  if (!isRecord(asked)) {
    return undefined;
  }
  const { line, from } = asked;
  const cleaned = readVersionNote(line);
  const locale = VERSION_NOTE_LOCALES.find((known) => known === from);
  return typeof cleaned === 'string' && locale
    ? { line: cleaned, from: locale }
    : undefined;
};

/**
 * What FluidEQ hands the chat to write that line in every language, the
 * member's own words kept exactly in theirs. The line is quoted as JSON, so
 * nothing in it can end the ask early.
 */
export const noteTranslationAsk = ({ line, from }: INoteTranslation): string =>
  `FLUIDEQ, NOT THE MEMBER: the member set this version's "What's new" line, in ${from}: ${JSON.stringify(line)}. Write it with write_whats_new in every language: ${VERSION_NOTE_LOCALES.join(', ')}, each one line of at most ${MAX_VERSION_NOTE} characters saying the same as a listener would, and "${from}" exactly the member's words. Change nothing in the scene. ${STUDIO_NOTES_CONTRACT} Then answer with the English line alone.`;
