/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { MAX_VERSION_NOTE } from '../../common/sceneVersionNote';
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
 * the gallery: a first version needs no line.
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
export const VERSION_NOTE_ASK = `FLUIDEQ, NOT THE MEMBER: the scene has changed since the version the Gallery has, and the "whatsNew" line in studio-notes.json does not say so yet. Write it now, as THE UPDATE NOTE in your brief says: one line of at most ${MAX_VERSION_NOTE} characters, in the language you speak with the member, saying what changed as a listener would notice it, covering everything since the Gallery's version - fold in any line already there. Change nothing else in that file or in the scene. Then answer with that line alone.`;
