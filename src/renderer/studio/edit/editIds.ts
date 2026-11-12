/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  copyOf,
  pathKey,
  type TNodePath,
  type TWorldEditOp,
} from 'common/sceneEdit';

/**
 * A name for each thing of the scene that stays its own while the draft is
 * changed, undone and redone: what Edit mode's locks and its working Hide
 * are kept by.
 *
 * A path names a place, not a thing. Kept by path, a lock moved to the next
 * thing along the moment one before it was deleted, copied or grouped — and
 * with everything locked by default, that is an unlock handed to a thing the
 * member never unlocked. So the scene's things are given names: the file's
 * by where they stood when the files were read (`b:` and the path), the
 * draft's own by the change that made them, which keeps its number through
 * undo and redo, so a thing an undo takes away and a redo brings back is the
 * same thing with the same lock.
 */

export interface IIdNode {
  id: string;
  children: IIdNode[];
}

interface ITreeSource {
  children: readonly ITreeSource[];
}

/** The file's things, each named by where it stands. */
export const idTree = (
  nodes: readonly ITreeSource[] | undefined,
  above: readonly number[] = [],
): IIdNode[] =>
  (nodes ?? []).map((node, index) => {
    const path = [...above, index];
    return { id: `b:${pathKey(path)}`, children: idTree(node.children, path) };
  });

const cloneTree = (tree: readonly IIdNode[]): IIdNode[] =>
  tree.map((node) => ({ id: node.id, children: cloneTree(node.children) }));

/** The list a path's thing stands in, and its place there. */
const slotOf = (tree: IIdNode[], path: TNodePath) => {
  let list = tree;
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const holder = list[path[depth]] as IIdNode | undefined;
    if (!holder) {
      return undefined;
    }
    list = holder.children;
  }
  const index = path[path.length - 1];
  return index >= 0 && index < list.length ? { list, index } : undefined;
};

/** A copied thing and everything in it, named after the change that made it. */
const renamed = (node: IIdNode, id: string): IIdNode => ({
  id,
  children: node.children.map((child, index) =>
    renamed(child, `${id}.${String(index)}`),
  ),
});

/**
 * `tree` after `ops`, made in one change numbered `serial`, as the world's
 * own edits make them (`common/worldEdit.ts`): a delete takes the thing out,
 * a copy stands after its thing, a group gathers siblings where the first of
 * them stood, an add stands last.
 */
export const replayIds = (
  tree: readonly IIdNode[],
  ops: readonly TWorldEditOp[],
  serial: number,
): IIdNode[] => {
  const next = cloneTree(tree);
  ops.forEach((op, opIndex) => {
    const made = `n${String(serial)}.${String(opIndex)}`;
    if (op.kind === 'delete') {
      const slot = slotOf(next, op.path);
      slot?.list.splice(slot.index, 1);
    } else if (op.kind === 'copy') {
      const slot = slotOf(next, op.path);
      if (slot) {
        slot.list.splice(
          slot.index + 1,
          0,
          renamed(slot.list[slot.index], made),
        );
      }
    } else if (op.kind === 'group') {
      const slots = op.paths.flatMap((path) => {
        const slot = slotOf(next, path);
        return slot ? [slot] : [];
      });
      const [first] = slots;
      if (!first || slots.some((slot) => slot.list !== first.list)) {
        return;
      }
      const members = [...slots].sort((a, b) => a.index - b.index);
      const gathered = members.map((slot) => slot.list[slot.index]);
      [...members]
        .reverse()
        .forEach((slot) => first.list.splice(slot.index, 1));
      first.list.splice(members[0].index, 0, { id: made, children: gathered });
    } else if (op.kind === 'add') {
      next.push({ id: made, children: [] });
    }
  });
  return next;
};

/** The name of the thing at `path`; a single copy of many goes by its node's. */
export const idAt = (
  tree: readonly IIdNode[],
  path: TNodePath,
): string | undefined => {
  const one = copyOf(path);
  const steps = one ? one.node : path;
  const found = steps.reduce<IIdNode | undefined>(
    (holder, step, depth) =>
      (depth === 0 ? tree : (holder?.children ?? []))[step] as
        IIdNode | undefined,
    undefined,
  );
  return steps.length > 0 ? found?.id : undefined;
};

/** Every thing's place, by its name. */
export const pathsById = (
  tree: readonly IIdNode[],
  above: readonly number[] = [],
  into = new Map<string, number[]>(),
): Map<string, number[]> => {
  tree.forEach((node, index) => {
    const path = [...above, index];
    into.set(node.id, path);
    pathsById(node.children, path, into);
  });
  return into;
};

/** The names of everything inside the thing named `id`, not its own. */
export const idsInside = (tree: readonly IIdNode[], id: string): string[] => {
  const walk = (list: readonly IIdNode[], inside: boolean): string[] =>
    list.flatMap((node) => [
      ...(inside ? [node.id] : []),
      ...walk(node.children, inside || node.id === id),
    ]);
  return walk(tree, false);
};
