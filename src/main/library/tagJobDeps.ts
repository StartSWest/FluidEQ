/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a tag job is given from outside — the Library, the player's hold on
 * its files, where lyrics and undo live, who is told — and the two small
 * rules every step of one shares (`tagJobs.ts`).
 */

import type {
  ITagJobState,
  ITagTrackMove,
} from '../../common/library/tagFields';
import type { ILibraryStore } from './libraryStore';
import type { IValidatedEdit } from './tagApply';
import type { TStoreArtwork } from './tagReindex';

export interface ITagJobDeps {
  store: ILibraryStore;
  undoRoot: string;
  storeArtwork: TStoreArtwork;
  /** The Library changed: the window asks again for what it shows. */
  announce: () => void;
  send: (state: ITagJobState) => void;
  /**
   * Lets go of a file FluidEQ's own player holds open but is not playing —
   * the next track, readied for a gapless start — so its tags can be
   * written, and answers what puts it back afterwards. Without it the file
   * read as "open in another program" (Ivan, 2026-11-16).
   */
  releaseFile?: (filePath: string) => Promise<() => Promise<void>>;
  /** FluidEQ's own lyrics folder, whose copies follow a renamed song. */
  lyricsStoreDir: string;
  /** Songs renamed, or named back by Undo: known by new ids from now. */
  onMoved: (moves: readonly ITagTrackMove[]) => void;
}

/** True when an edit changes anything inside the file, not only its name. */
export const changesTags = (edit: IValidatedEdit): boolean =>
  Object.keys(edit.fields).length > 0 ||
  edit.extras.length > 0 ||
  edit.cover !== undefined ||
  edit.id3v2Version !== undefined ||
  edit.keepId3v1 !== undefined;

/** The player's hold let go around one write, and given back after it. */
export const withReleased = async <T>(
  deps: ITagJobDeps,
  filePath: string,
  write: () => Promise<T>,
): Promise<T> => {
  const putBack = deps.releaseFile
    ? await deps.releaseFile(filePath).catch(() => undefined)
    : undefined;
  try {
    return await write();
  } finally {
    await putBack?.().catch(() => undefined);
  }
};
