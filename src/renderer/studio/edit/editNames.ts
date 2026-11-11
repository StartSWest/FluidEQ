/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { TranslationKey } from 'common/i18n';
import { copyOf, type TNodePath } from 'common/sceneEdit';
import type { TWorldNode } from 'common/sceneWorld';

/** What each kind of thing is called, where it has no name of its own. */
export const KIND_NAMES: Record<TWorldNode['type'], TranslationKey> = {
  mesh: 'studio.edit.kind.mesh',
  instances: 'studio.edit.kind.instances',
  points: 'studio.edit.kind.points',
  ribbon: 'studio.edit.kind.ribbon',
  terrain: 'studio.edit.kind.terrain',
  model: 'studio.edit.kind.model',
  light: 'studio.edit.kind.light',
  group: 'studio.edit.kind.group',
};

/** The node a path names; of one copy of many, the node that makes it. */
export const nodeAt = (
  nodes: readonly TWorldNode[],
  path: TNodePath,
): TWorldNode | undefined =>
  (copyOf(path)?.node ?? path).reduce<TWorldNode | undefined>(
    (found, step, depth) => (depth === 0 ? nodes[step] : found?.children[step]),
    undefined,
  );

type TTranslate = (
  key: TranslationKey,
  values?: Record<string, string | number>,
) => string;

/**
 * A thing's name: its own, or its kind and its place among its siblings;
 * of one copy of many, its node's name and which copy: "reef fish 12".
 */
export const thingName = (
  node: TWorldNode,
  path: TNodePath,
  t: TTranslate,
): string => {
  const one = copyOf(path);
  const of = one ? one.node : path;
  const name =
    node.name ??
    t('studio.edit.unnamed', {
      kind: t(KIND_NAMES[node.type]),
      number: of[of.length - 1] + 1,
    });
  return one ? `${name} ${String(one.copy + 1)}` : name;
};

/** How many copies of this are listed under it, at most. */
export const LISTED_COPIES = 400;

/**
 * How many copies a node draws, for the list: a grid's three counts
 * multiplied, any other layout's first. Zero for a node that draws one.
 */
export const copiesIn = (node: TWorldNode): number => {
  if (node.type !== 'instances') {
    return 0;
  }
  const [x, y, z] = node.layout.count;
  const count = node.layout.kind === 'grid' ? x * y * z : x;
  return Math.max(0, Math.min(LISTED_COPIES, Math.floor(count)));
};

/** The drawing each kind of thing wears in the list, on a 16 by 16 square. */
export const KIND_ICONS: Record<TWorldNode['type'], string> = {
  // A cube.
  mesh: 'M8 1.8l5.4 3v6.4L8 14.2l-5.4-3V4.8zM2.6 4.8L8 7.9l5.4-3.1M8 7.9v6.3',
  // Three of a thing.
  instances: 'M2 9.5h4.5V14H2zM9.5 9.5H14V14H9.5zM5.75 2h4.5v4.5h-4.5z',
  // Scattered dots.
  points:
    'M3.5 4h.1M8 3h.1M12.5 5h.1M5 8.5h.1M10 8h.1M3.5 12.5h.1M8 12h.1M12.5 12.5h.1',
  // A ribbon's wave.
  ribbon: 'M1.5 9c2.2-5 4.3-5 6.5 0s4.3 5 6.5 0',
  // Hills.
  terrain: 'M1.5 13l4-7 3 4.5 2-3 4 5.5z',
  // A solid with a face cut: a made model.
  model:
    'M8 1.8l5.4 3v6.4L8 14.2l-5.4-3V4.8zM8 7.9l5.4-3.1M8 7.9v6.3M5.3 3.3l5.4 3.1',
  // A bulb.
  light:
    'M5.6 9.6a4 4 0 1 1 4.8 0c-.5.4-.8.9-.8 1.5v.4H6.4v-.4c0-.6-.3-1.1-.8-1.5zM6.6 13.8h2.8',
  // A folder.
  group: 'M1.8 4.2h4l1.4 1.6h7v7H1.8z',
};
