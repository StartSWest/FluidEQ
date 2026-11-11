/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TWorldEditFailure, TWorldEditOp } from './sceneEdit';
import { WORLD_LIMITS } from './sceneWorld';
import { MAX_EXPRESSION_LENGTH } from './worldExpression';

/**
 * A hand's edits, written into a world as its author wrote it.
 *
 * Worked on the file's own JSON, never on the world as read: everything the
 * edit does not name — a formula, a field a newer FluidEQ added, the order of
 * the keys — goes back exactly as it came.
 *
 * A value that follows the music is a formula, and moving it by hand keeps
 * the formula: `sin(time) * 2` moved up by 1.5 becomes `(sin(time) * 2) +
 * 1.5`, so the boat still bobs, higher. Moved again, the number at the end
 * changes; the brackets do not pile up.
 */

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Four decimals: a tenth of a millimetre in a world measured in metres. */
const tidy = (value: number): number => {
  const rounded = Math.round(value * 10000) / 10000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

class EditProblem extends Error {
  constructor(readonly reason: TWorldEditFailure) {
    super(reason);
  }
}

/**
 * `(inner) <sign> <number>` as this file writes it, taken apart; undefined
 * for anything else. The opening bracket has to close right before the sign,
 * or `(a) + (b) + 1` would be read as `a) + (b` with 1 added.
 */
const takeApart = (
  formula: string,
  sign: '+' | '*',
): { inner: string; amount: number } | undefined => {
  const match = /^\((.*)\) ([+\-*]) (\d+(?:\.\d+)?)$/s.exec(formula);
  if (!match) {
    return undefined;
  }
  const [, inner, found, digits] = match;
  if (sign === '*' ? found !== '*' : found === '*') {
    return undefined;
  }
  let depth = 0;
  for (let i = 0; i < inner.length; i += 1) {
    if (inner[i] === '(') {
      depth += 1;
    } else if (inner[i] === ')') {
      depth -= 1;
      if (depth < 0) {
        return undefined;
      }
    }
  }
  if (depth !== 0) {
    return undefined;
  }
  const amount = Number(digits);
  return { inner, amount: found === '-' ? -amount : amount };
};

const fits = (formula: string): string => {
  if (formula.length > MAX_EXPRESSION_LENGTH) {
    throw new EditProblem('formula-full');
  }
  return formula;
};

/** `value` with `by` added: a number summed, a formula kept and nudged. */
export const nudged = (value: unknown, by: number, fallback: number) => {
  if (by === 0 && value !== undefined) {
    return value;
  }
  if (typeof value === 'string') {
    const known = takeApart(value, '+');
    const inner = known ? known.inner : value;
    const total = tidy((known ? known.amount : 0) + by);
    if (total === 0) {
      return known ? inner : value;
    }
    return fits(
      `(${inner}) ${total < 0 ? '-' : '+'} ${String(Math.abs(total))}`,
    );
  }
  return tidy((typeof value === 'number' ? value : fallback) + by);
};

/** `value` with `by` multiplied in, the same way. */
export const scaled = (value: unknown, by: number, fallback: number) => {
  if (by === 1 && value !== undefined) {
    return value;
  }
  if (typeof value === 'string') {
    const known = takeApart(value, '*');
    const inner = known ? known.inner : value;
    const total = tidy((known ? known.amount : 1) * by);
    if (total === 1) {
      return known ? inner : value;
    }
    return fits(`(${inner}) * ${String(total)}`);
  }
  return tidy((typeof value === 'number' ? value : fallback) * by);
};

/** A place, turn or size as three values, however the file wrote it. */
const triple = (value: unknown, fallback: number): unknown[] => {
  if (Array.isArray(value) && value.length === 3) {
    return [...value];
  }
  // A size may be one value for all three sides.
  if (typeof value === 'number' || typeof value === 'string') {
    return [value, value, value];
  }
  return [fallback, fallback, fallback];
};

/** A size written back as one value when all three sides agree. */
const asSize = (values: unknown[]): unknown =>
  values[0] === values[1] && values[1] === values[2] ? values[0] : values;

const childrenOf = (holder: TRecord, key: 'nodes' | 'children'): unknown[] => {
  const list = holder[key];
  return Array.isArray(list) ? list : [];
};

/** The list a thing stands in, and its place in it. */
const findSlot = (
  world: TRecord,
  path: readonly number[],
): { list: unknown[]; index: number; node: TRecord } => {
  if (path.length === 0 || path.length > WORLD_LIMITS.depth + 1) {
    throw new EditProblem('missing');
  }
  let list = childrenOf(world, 'nodes');
  for (let depth = 0; depth < path.length - 1; depth += 1) {
    const parent = list[path[depth]];
    if (!isRecord(parent)) {
      throw new EditProblem('missing');
    }
    list = childrenOf(parent, 'children');
  }
  const index = path[path.length - 1];
  const node = list[index];
  if (!Number.isInteger(index) || !isRecord(node)) {
    throw new EditProblem('missing');
  }
  return { list, index, node };
};

const countNodes = (list: unknown[]): number =>
  list.reduce<number>(
    (total, node) =>
      total +
      1 +
      (isRecord(node) ? countNodes(childrenOf(node, 'children')) : 0),
    0,
  );

const depthOf = (node: unknown): number =>
  isRecord(node)
    ? 1 +
      childrenOf(node, 'children').reduce<number>(
        (deepest, child) => Math.max(deepest, depthOf(child)),
        0,
      )
    : 1;

/** A name no thing beside it has: "Boat", then "Boat 2", "Boat 3". */
const freeName = (list: unknown[], wanted: string): string => {
  const taken = new Set(
    list.flatMap((node) =>
      isRecord(node) && typeof node.name === 'string' ? [node.name] : [],
    ),
  );
  const base = wanted.replace(/ \d+$/, '').slice(0, 58) || 'Thing';
  if (!taken.has(wanted) && wanted !== '') {
    return wanted.slice(0, 64);
  }
  let number = 2;
  while (taken.has(`${base} ${String(number)}`)) {
    number += 1;
  }
  return `${base} ${String(number)}`;
};

const EDIT_MATERIAL = 'studioEdit';

/** The plain grey a thing added by hand is made of, until it is given one. */
const withEditMaterial = (world: TRecord): void => {
  const materials = isRecord(world.materials) ? { ...world.materials } : {};
  if (!Object.prototype.hasOwnProperty.call(materials, EDIT_MATERIAL)) {
    if (Object.keys(materials).length >= WORLD_LIMITS.materials) {
      throw new EditProblem('refused');
    }
    materials[EDIT_MATERIAL] = {
      kind: 'standard',
      colour: '#c9d3d8',
      roughness: 0.6,
    };
  }
  Object.assign(world, { materials });
};

const applyOne = (world: TRecord, op: TWorldEditOp): void => {
  switch (op.kind) {
    case 'move': {
      const { node } = findSlot(world, op.path);
      if (op.position) {
        const by = op.position;
        node.position = triple(node.position, 0).map((value, axis) =>
          nudged(value, by[axis], 0),
        );
      }
      if (op.rotation) {
        const by = op.rotation;
        node.rotation = triple(node.rotation, 0).map((value, axis) =>
          nudged(value, by[axis], 0),
        );
      }
      if (op.scale) {
        const by = op.scale;
        node.scale = asSize(
          triple(node.scale, 1).map((value, axis) =>
            scaled(value, by[axis], 1),
          ),
        );
      }
      return;
    }
    case 'pin': {
      const { node } = findSlot(world, op.path);
      const values = op.values.map(tidy);
      node[op.field] = op.field === 'scale' ? asSize(values) : values;
      return;
    }
    case 'rename': {
      const { node } = findSlot(world, op.path);
      const name = op.name.trim().slice(0, 64);
      if (name === '') {
        delete node.name;
      } else {
        node.name = name;
      }
      return;
    }
    case 'show': {
      const { node } = findSlot(world, op.path);
      if (op.shown) {
        // Shown is what a thing is when nothing is said.
        delete node.visible;
      } else {
        node.visible = 0;
      }
      return;
    }
    case 'shadow': {
      const { node } = findSlot(world, op.path);
      node.castShadow = op.cast;
      return;
    }
    case 'delete': {
      const { list, index } = findSlot(world, op.path);
      list.splice(index, 1);
      return;
    }
    case 'copy': {
      const { list, index, node } = findSlot(world, op.path);
      const copy = JSON.parse(JSON.stringify(node)) as TRecord;
      copy.name = freeName(
        list,
        typeof node.name === 'string' ? node.name : '',
      );
      // Beside the first, a step along, or the copy hides inside it.
      copy.position = triple(copy.position, 0).map((value, axis) =>
        nudged(value, axis === 0 ? 1 : 0, 0),
      );
      list.splice(index + 1, 0, copy);
      return;
    }
    case 'group': {
      const slots = op.paths.map((path) => findSlot(world, path));
      const [first] = slots;
      if (!first || slots.some((slot) => slot.list !== first.list)) {
        throw new EditProblem('refused');
      }
      const members = [...slots].sort((a, b) => a.index - b.index);
      if (
        members.some(
          (slot) =>
            depthOf(slot.node) + op.paths[0].length > WORLD_LIMITS.depth,
        )
      ) {
        throw new EditProblem('refused');
      }
      const group: TRecord = {
        type: 'group',
        name: freeName(first.list, op.name),
        children: members.map((slot) => slot.node),
      };
      [...members]
        .reverse()
        .forEach((slot) => first.list.splice(slot.index, 1));
      first.list.splice(members[0].index, 0, group);
      return;
    }
    case 'add': {
      const nodes = childrenOf(world, 'nodes');
      const common = {
        name: freeName(nodes, op.name),
        position: op.at.map(tidy),
      };
      if (op.shape === 'group') {
        nodes.push({ type: 'group', ...common, children: [] });
      } else if (op.shape === 'light') {
        nodes.push({
          type: 'light',
          ...common,
          light: { kind: 'point', colour: '#fff2d6', intensity: 30 },
        });
      } else {
        withEditMaterial(world);
        nodes.push({
          type: 'mesh',
          ...common,
          geometry:
            op.shape === 'box'
              ? { kind: 'box', size: [1, 1, 1] }
              : { kind: 'sphere', radius: 0.5 },
          material: EDIT_MATERIAL,
          castShadow: true,
          receiveShadow: true,
        });
      }
      Object.assign(world, { nodes });
      return;
    }
    default: {
      const camera = isRecord(world.camera) ? { ...world.camera } : {};
      camera.position = op.position.map(tidy);
      camera.target = op.target.map(tidy);
      Object.assign(world, { camera });
    }
  }
};

export type TWorldEdited =
  | { ok: true; world: Record<string, unknown> }
  | { ok: false; reason: TWorldEditFailure };

/**
 * `raw` with `ops` applied, in order, or why not. All of them or none: an
 * edit that fails half way leaves nothing behind. `raw` itself is not
 * touched.
 */
export const applyWorldEdits = (
  raw: unknown,
  ops: readonly TWorldEditOp[],
): TWorldEdited => {
  if (!isRecord(raw)) {
    return { ok: false, reason: 'no-world' };
  }
  const world = JSON.parse(JSON.stringify(raw)) as TRecord;
  try {
    ops.forEach((op) => applyOne(world, op));
  } catch (error) {
    if (error instanceof EditProblem) {
      return { ok: false, reason: error.reason };
    }
    throw error;
  }
  if (countNodes(childrenOf(world, 'nodes')) > WORLD_LIMITS.nodes) {
    return { ok: false, reason: 'refused' };
  }
  return { ok: true, world };
};

/**
 * Whether the world as read kept every thing the file wrote, in its place:
 * the reader leaves out what it cannot draw, and a path counted on the one
 * would then name something else on the other.
 */
export const sameShape = (
  rawNodes: unknown,
  readNodes: readonly { children: readonly unknown[] }[],
): boolean => {
  const list = Array.isArray(rawNodes) ? rawNodes : [];
  return (
    list.length === readNodes.length &&
    list.every((node, index) =>
      sameShape(
        isRecord(node) ? node.children : undefined,
        readNodes[index].children as readonly {
          children: readonly unknown[];
        }[],
      ),
    )
  );
};
