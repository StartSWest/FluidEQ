/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { copyOf, pathKey, type TNodePath } from 'common/sceneEdit';
import type { IIdNode } from './editIds';

/**
 * What Edit mode marks on the scene's things for the member's own working,
 * never written into the scene: which may be moved, and which are hidden
 * while editing.
 *
 * EVERYTHING STARTS LOCKED (Ivan, 2026-11-11: "all objects need to be locked
 * by default so the user cannot accidentally move them"). A locked thing is
 * picked, framed, looked at alone and asked about like any other; only its
 * handles, its typed numbers and Delete leave it alone. A setting stands for
 * the thing and everything inside it, and the nearest one wins: a group
 * unlocked unlocks its parts, and a part set on its own after that keeps its
 * own. Setting a thing clears what its parts had of their own, so a group
 * locked is locked through, whatever was unlocked inside it before.
 *
 * HIDE IS A WORKING TOOL, like Solo (Ivan, 2026-11-11, through the
 * coordinator: Hide and Solo "never change what the scene looks like for
 * listeners, are never written by Save, and are cleared on leaving Edit
 * mode"). A thing the scene's own file switches off is a different matter,
 * shown in the list as off in the scene, and turned back on as a change.
 */

export interface IEditMarks {
  /** Each thing's own setting, by name (`editIds.ts`): true is unlocked. */
  unlocks: ReadonlyMap<string, boolean>;
  /** Hidden while editing, by name. */
  hidden: ReadonlySet<string>;
}

export interface IEditMarkView {
  /** Every thing that may be moved now, by path. */
  unlocked: readonly string[];
  /** The things with a lock setting of their own, by path. */
  ownLock: readonly string[];
  /** The things hidden while editing, by path. */
  hidden: readonly string[];
}

/** The marks as the panel, the stage and the handles read them: by path. */
export const viewOf = (
  tree: readonly IIdNode[],
  marks: IEditMarks,
): IEditMarkView => {
  const unlocked: string[] = [];
  const ownLock: string[] = [];
  const hidden: string[] = [];
  const walk = (
    list: readonly IIdNode[],
    above: readonly number[],
    inherited: boolean,
  ) => {
    list.forEach((node, index) => {
      const path = [...above, index];
      const key = pathKey(path);
      const own = marks.unlocks.get(node.id);
      const free = own ?? inherited;
      if (own !== undefined) {
        ownLock.push(key);
      }
      if (free) {
        unlocked.push(key);
      }
      if (marks.hidden.has(node.id)) {
        hidden.push(key);
      }
      walk(node.children, path, free);
    });
  };
  walk(tree, [], false);
  return { unlocked, ownLock, hidden };
};

/**
 * Whether the thing at `path` may not be moved. A single copy of many goes
 * with its node; anything the view does not know of — not drawn yet, or
 * gone — is locked, which is the side to be wrong on.
 */
export const lockedIn = (unlocked: readonly string[], path: TNodePath) =>
  !unlocked.includes(pathKey(copyOf(path)?.node ?? path));
