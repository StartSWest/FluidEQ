/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { copyOf, pathKey, type TNodePath } from 'common/sceneEdit';
import { idAt, idsInside, pathsById, type IIdNode } from './editIds';
import { lockedIn, viewOf, type IEditMarkView } from './editMarks';

/**
 * Where Edit mode keeps its locks and its working Hide (`editMarks.ts`): by
 * the things' names (`editIds.ts`), each asked of the draft's things as they
 * stand when it is changed or read.
 */
export const createMarkBook = () => {
  /** Each thing's own lock setting, by name: true is unlocked. */
  let unlocks = new Map<string, boolean>();
  /** Hidden while editing, by name. */
  let hidden = new Set<string>();

  const view = (tree: readonly IIdNode[]): IEditMarkView =>
    viewOf(tree, { unlocks, hidden });

  /** The name of the thing at `path`, for anything but a single copy. */
  const nameAt = (tree: readonly IIdNode[], path: TNodePath) =>
    copyOf(path) ? undefined : idAt(tree, path);

  return {
    view,
    /**
     * One thing's own lock: nothing inside it keeps one of its own, and none
     * is kept where it says what the thing would have from round it anyway.
     */
    setLock: (tree: readonly IIdNode[], path: TNodePath, free: boolean) => {
      const id = nameAt(tree, path);
      if (!id) {
        return;
      }
      idsInside(tree, id).forEach((inner) => unlocks.delete(inner));
      unlocks.delete(id);
      const around =
        path.length > 1 && !lockedIn(view(tree).unlocked, path.slice(0, -1));
      if (free !== around) {
        unlocks.set(id, free);
      }
    },
    /** A thing's own setting, by name, or none to take its group's. */
    own: (id: string) => unlocks.get(id),
    setOwn: (id: string, free: boolean | undefined) => {
      if (free === undefined) {
        unlocks.delete(id);
      } else {
        unlocks.set(id, free);
      }
    },
    toggleHidden: (tree: readonly IIdNode[], path: TNodePath) => {
      const id = nameAt(tree, path);
      if (id && !hidden.delete(id)) {
        hidden.add(id);
      }
    },
    setHidden: (
      tree: readonly IIdNode[],
      paths: readonly TNodePath[],
      isHidden: boolean,
    ) => {
      paths.forEach((path) => {
        const id = nameAt(tree, path);
        if (id && isHidden) {
          hidden.add(id);
        } else if (id) {
          hidden.delete(id);
        }
      });
    },
    clearHidden: () => {
      hidden = new Set();
    },
    /**
     * The marks moved onto the names the files' pack gives its things: each
     * thing's place when Save was pressed is its place in the saved file.
     */
    afterSave: (savedTree: readonly IIdNode[]) => {
      const places = pathsById(savedTree);
      const renamed = (id: string) => {
        const path = places.get(id);
        return path ? `b:${pathKey(path)}` : undefined;
      };
      unlocks = new Map(
        [...unlocks].flatMap(([id, free]) => {
          const to = renamed(id);
          return to ? [[to, free] as const] : [];
        }),
      );
      hidden = new Set(
        [...hidden].flatMap((id) => {
          const to = renamed(id);
          return to ? [to] : [];
        }),
      );
    },
  };
};

export type TMarkBook = ReturnType<typeof createMarkBook>;
