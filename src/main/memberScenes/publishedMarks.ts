/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IProjectPublished } from './publishedRecords';

/**
 * What the project list says about each folder's publication, kept here and
 * read back at once whenever the Studio is told anything.
 *
 * Asking the folders themselves on every announcement is what this replaces:
 * each answer walks a whole scene folder, about 0.1 ms a file on OneDrive,
 * 330 ms for a list of 52 - on every save of the open scene, on the thread
 * that runs the window. Now the walks happen apart from any announcement, one
 * pass at a time, and the Studio is told again only when an answer moved.
 *
 * A pass goes over every folder, recognising first any that holds a scene
 * published before records were kept (`publishedAdoption.ts`), when the list
 * is opened or changes and when a chat's reply ends (an AI may have written
 * into a scene that is not the open one); over the open folder alone when
 * its scene was rebuilt. Asks made while a pass runs are gathered into the
 * next one, so a burst of saves costs one more walk, not one each.
 */

interface IPublishedMarksDeps {
  stateOf: (folder: string) => Promise<IProjectPublished | undefined>;
  /** Records the folders holding a held publication; true when one was. */
  adopt?: (folders: readonly string[]) => Promise<boolean>;
  /** The list's own projects, by folder: never one opened to look inside. */
  folders: () => readonly string[];
  /** Only while the list can be seen: never a scene read at launch. */
  isOpen: () => boolean;
  /** An answer moved: the Studio is told again. */
  changed: () => void;
  logger?: { warn(message: string): void };
}

const same = (
  a: IProjectPublished | undefined,
  b: IProjectPublished | undefined,
) =>
  a?.sceneId === b?.sceneId &&
  a?.version === b?.version &&
  a?.unchanged === b?.unchanged;

export const createPublishedMarks = ({
  stateOf,
  adopt,
  folders,
  isOpen,
  changed,
  logger,
}: IPublishedMarksDeps) => {
  const marks = new Map<string, IProjectPublished>();
  let running = false;
  let wantAll = false;
  const wanted = new Set<string>();

  const pass = async (all: boolean, some: readonly string[]) => {
    const asked = all ? folders() : some;
    if (all && adopt) {
      await adopt(asked);
    }
    const states = await Promise.all(asked.map((folder) => stateOf(folder)));
    let moved = false;
    asked.forEach((folder, at) => {
      const next = states[at];
      if (same(marks.get(folder), next)) {
        return;
      }
      moved = true;
      if (next) {
        marks.set(folder, next);
      } else {
        marks.delete(folder);
      }
    });
    if (moved) {
      changed();
    }
  };

  const next = (): void => {
    if (!isOpen() || (!wantAll && wanted.size === 0)) {
      running = false;
      return;
    }
    const all = wantAll;
    const some = [...wanted];
    wantAll = false;
    wanted.clear();
    pass(all, some)
      .catch((error: unknown) => {
        logger?.warn(
          `The Studio's published scenes could not be read: ${String(error)}`,
        );
      })
      .finally(next);
  };

  return {
    /** What is known of a folder's publication, at once. */
    of: (folder: string) => marks.get(folder),
    /** Reads every folder again, or the one named. */
    refresh: (folder?: string) => {
      if (folder === undefined) {
        wantAll = true;
      } else {
        wanted.add(folder);
      }
      if (!running && isOpen()) {
        running = true;
        next();
      }
    },
  };
};

export type TPublishedMarks = ReturnType<typeof createPublishedMarks>;
