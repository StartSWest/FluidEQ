/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's Edit mode, as the scene's renderer and the page speak of it.
 *
 * A thing in a 3D world is one of its nodes, named by where it stands:
 * `[7]` is `world.nodes[7]`, `[4, 1]` is `world.nodes[4].children[1]`.
 *
 * What the page asks rides the frame it already sends (`ISceneFrame.edit`),
 * and what the renderer answers rides the reply to it, so nothing here needs
 * a message of its own, an order of its own or a wait: a pick is answered by
 * the frame that drew it.
 *
 * Every place is a share of the canvas, 0..1, y down.
 */

export type TNodePath = readonly number[];

export type TTriple = readonly [number, number, number];

/**
 * A thing moved by hand, shown before it is written: added to its place and
 * turn, multiplied into its size, on top of whatever its formulas give.
 */
export interface ISceneEditMove {
  path: TNodePath;
  position: TTriple;
  rotation: TTriple;
  scale: TTriple;
}

/** A camera of the Studio's own, to look round the world; never saved. */
export interface ISceneEditCamera {
  position: TTriple;
  target: TTriple;
}

export interface ISceneEdit {
  /** The scene's clock stands still, and with it everything it drives. */
  frozen: boolean;
  selected: readonly TNodePath[];
  /**
   * The world the moves were made on (`ISceneEditReport.world`). A world
   * built from the file those moves were written to already has them, and
   * must not be given them twice.
   */
  world?: string;
  moves: readonly ISceneEditMove[];
  camera?: ISceneEditCamera;
  /** What stands under this point? Asked once per `id`. */
  pick?: { id: number; x: number; y: number };
  /** Where the pointer rests: what would a click there pick? */
  hover?: readonly [number, number];
}

/** One picked thing as the last frame drew it. */
export interface ISceneEditThing {
  path: TNodePath;
  /** False when it is wholly behind the camera: nothing to draw round. */
  inView: boolean;
  box: readonly [number, number, number, number];
  pivot: readonly [number, number];
  /**
   * Where one unit along each axis of the space it is placed in lands on
   * the canvas, from the pivot: what a drag along a handle is measured by.
   */
  axes: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  /** The same for its own axes, turned as it is: what Resize pulls along. */
  ownAxes: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  /** Per axis, 1 when it points toward the viewer and -1 when away. */
  toward: TTriple;
  /** Where it stands in the world, for the Studio's camera to look at. */
  centre: TTriple;
  position: TTriple;
  rotation: TTriple;
  scale: TTriple;
}

export interface ISceneEditReport {
  /** Which world is on screen: changes with every world built. */
  world: string;
  picked?: { id: number; path: number[] | null };
  things: readonly ISceneEditThing[];
  /** The thing under `hover`, when there is one. */
  hovered?: ISceneEditThing;
  /** The camera the frame was drawn through. */
  camera: ISceneEditCamera;
}

export const samePath = (a: TNodePath, b: TNodePath): boolean =>
  a.length === b.length && a.every((step, index) => step === b[index]);

export const pathKey = (path: TNodePath): string => path.join('.');

/** `world.nodes[4].children[1]`, as the member's AI is told it. */
export const pathInWords = (path: TNodePath): string =>
  path
    .map((step, index) =>
      index === 0 ? `world.nodes[${step}]` : `children[${step}]`,
    )
    .join('.');

/** What the Studio writes into the scene's own world when a hand edits it. */
export type TWorldEditOp =
  /** Added to the place and the turn, multiplied into the size. */
  | {
      kind: 'move';
      path: number[];
      position?: [number, number, number];
      rotation?: [number, number, number];
      scale?: [number, number, number];
    }
  /** Plain numbers in place of whatever was there, formulas included. */
  | {
      kind: 'pin';
      path: number[];
      field: 'position' | 'rotation' | 'scale';
      values: [number, number, number];
    }
  | { kind: 'rename'; path: number[]; name: string }
  | { kind: 'show'; path: number[]; shown: boolean }
  | { kind: 'shadow'; path: number[]; cast: boolean }
  | { kind: 'delete'; path: number[] }
  | { kind: 'copy'; path: number[] }
  /** Siblings gathered under one new group, where the first of them stood. */
  | { kind: 'group'; paths: number[][]; name: string }
  | {
      kind: 'add';
      shape: 'box' | 'ball' | 'light' | 'group';
      name: string;
      at: [number, number, number];
    }
  | {
      kind: 'camera';
      position: [number, number, number];
      target: [number, number, number];
    };

export type TWorldEditFailure =
  /** No project open, or not one this member may change. */
  | 'closed'
  /** The scene has no 3D world to edit. */
  | 'no-world'
  /** Some of the file's things are not drawn, so places do not line up. */
  | 'mismatch'
  /** The thing is not there any more: the file changed under the edit. */
  | 'missing'
  /** A formula would grow past what a world may hold. */
  | 'formula-full'
  /** The world would hold more than it may, or would no longer build. */
  | 'refused'
  | 'failed';

export type TWorldEditOutcome =
  | {
      ok: true;
      /** False when the edits left the world exactly as it was. */
      changed: boolean;
    }
  | { ok: false; reason: TWorldEditFailure };
