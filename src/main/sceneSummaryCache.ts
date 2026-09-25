/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';

/**
 * What a scene store's list says about each file, kept while the file is
 * unchanged.
 *
 * Listing used to read every scene afresh: decrypt it (`sceneCacheFile.ts`),
 * verify its signature or run every member rule again, then stringify and
 * hash the whole pack for its revision — up to 9 MB a pack. It is asked on
 * every focus of the window (`comeBackSignals.ts`: the gallery wants the
 * makers of the installed scenes, the official packs their versions), and
 * once per synced scene inside that, so coming back to FluidEQ held main for
 * as long as all of that took, with a slider's replies waiting behind it.
 *
 * A file is told apart from the one a summary was read from by its inode,
 * size and time together: `writeSceneCache` renames a new file over the old,
 * which changes the inode however the other two turn out, and a file edited
 * in place changes its time or its size. So a scene changed by anything —
 * this store, another copy of it, somebody's editor — is read and checked
 * again on the next list, exactly as before; one that did not change costs a
 * `stat`. Loading a pack to draw it never goes through here: that is still
 * checked on every read.
 */

const stampOf = (file: string): string | undefined => {
  try {
    const stat = fs.statSync(file);
    return `${stat.ino}:${stat.size}:${stat.mtimeMs}`;
  } catch {
    return undefined;
  }
};

export interface ISceneSummaryCache<T> {
  /**
   * The summary of `file`: the one kept, while the file is the one it was
   * read from, else whatever `read` makes of it now. Only a summary read from
   * a file that stayed the same throughout is kept — a read that migrates or
   * removes the file, or one that fails, is asked again next time.
   */
  get(file: string, read: () => T | undefined): T | undefined;
  /** Drop what is kept for `file`, which the store has just written or removed. */
  forget(file: string): void;
}

export const createSceneSummaryCache = <T>(): ISceneSummaryCache<T> => {
  const kept = new Map<string, { stamp: string; summary: T }>();
  return {
    get: (file, read) => {
      const before = stampOf(file);
      const known = kept.get(file);
      if (known && before !== undefined && known.stamp === before) {
        return known.summary;
      }
      const summary = read();
      const after = stampOf(file);
      if (summary !== undefined && after !== undefined && after === before) {
        kept.set(file, { stamp: after, summary });
      } else {
        kept.delete(file);
      }
      return summary;
    },
    forget: (file) => {
      kept.delete(file);
    },
  };
};
