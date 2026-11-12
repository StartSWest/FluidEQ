/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  pathKey,
  type ISceneEditMove,
  type TNodePath,
  type TTriple,
  type TWorldEditFailure,
  type TWorldEditOp,
} from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import normalizeSceneWorld from 'common/sceneWorldRead';
import { applyWorldEdits, sameShape } from 'common/worldEdit';
import type { ISceneFrame } from '../../graph/sceneGl';

/**
 * Edit mode's draft, worked out: the moves and edits a change is made of,
 * and the scene with the changes made to it (`stageEditStore.ts`).
 */

export const NO_MOVE: TTriple = [0, 0, 0];
const NO_SCALE: TTriple = [1, 1, 1];

export const emptyMove = (path: TNodePath): ISceneEditMove => ({
  path,
  position: NO_MOVE,
  rotation: NO_MOVE,
  scale: NO_SCALE,
});

export const isStill = (move: ISceneEditMove) =>
  move.position.every((part) => Math.abs(part) < 1e-5) &&
  move.rotation.every((part) => Math.abs(part) < 1e-5) &&
  move.scale.every((part) => Math.abs(part - 1) < 1e-5);

/** Every move of one thing as one: places and turns summed, sizes multiplied. */
export const combined = (
  moves: readonly ISceneEditMove[],
): ISceneEditMove[] => {
  const byThing = new Map<string, ISceneEditMove>();
  moves.forEach((move) => {
    const key = pathKey(move.path);
    const known = byThing.get(key);
    byThing.set(
      key,
      known
        ? {
            path: move.path,
            position: known.position.map(
              (part, axis) => part + move.position[axis],
            ) as unknown as TTriple,
            rotation: known.rotation.map(
              (part, axis) => part + move.rotation[axis],
            ) as unknown as TTriple,
            scale: known.scale.map(
              (part, axis) => part * move.scale[axis],
            ) as unknown as TTriple,
          }
        : move,
    );
  });
  return [...byThing.values()];
};

/** The move as an edit, saying only what changed. */
export const moveOp = (move: ISceneEditMove): TWorldEditOp => ({
  kind: 'move',
  path: [...move.path],
  ...(move.position.some((part) => part !== 0)
    ? { position: [...move.position] as [number, number, number] }
    : {}),
  ...(move.rotation.some((part) => part !== 0)
    ? { rotation: [...move.rotation] as [number, number, number] }
    : {}),
  ...(move.scale.some((part) => part !== 1)
    ? { scale: [...move.scale] as [number, number, number] }
    : {}),
});

/** Whether an edit changes which thing a path names. */
export const reshapes = (ops: readonly TWorldEditOp[]) =>
  ops.some((op) => ['delete', 'copy', 'group', 'add'].includes(op.kind));

/**
 * What the scene hears, kept as it was when the music was frozen. The two
 * arrays are copied: the runner fills the same two every frame.
 */
export const heardNow = (frame: ISceneFrame): Partial<ISceneFrame> => ({
  level: frame.level,
  beat: frame.beat,
  bands: frame.bands,
  musicAccent: frame.musicAccent,
  musicRun: frame.musicRun,
  accent: frame.accent,
  playing: frame.playing,
  spectrum: frame.spectrum.slice(),
  waveform: frame.waveform.slice(),
  rhythm: frame.rhythm,
  stereo: frame.stereo,
  voice: frame.voice,
});

type TDrafted =
  { ok: true; pack: IScenePack } | { ok: false; reason: TWorldEditFailure };

/**
 * `pack` with `ops` made to its world, read again as a pack's world is, or
 * why not. The world as read is written the way a file writes one, so the
 * same edits that will be saved are the ones shown.
 */
export const drafted = (
  pack: IScenePack,
  ops: readonly TWorldEditOp[],
): TDrafted => {
  if (!pack.world) {
    return { ok: false, reason: 'no-world' };
  }
  if (ops.length === 0) {
    return { ok: true, pack };
  }
  const edited = applyWorldEdits(pack.world, ops);
  if (!edited.ok) {
    return edited;
  }
  const world = normalizeSceneWorld(
    edited.world,
    pack.params.map((param) => param.id),
    pack.artwork,
    (pack.palettes ?? []).map((palette) => palette.id),
  );
  // Read with a thing left out, the paths after it would name other things.
  if (!world || !sameShape(edited.world.nodes, world.nodes)) {
    return { ok: false, reason: 'refused' };
  }
  return { ok: true, pack: { ...pack, world } };
};
