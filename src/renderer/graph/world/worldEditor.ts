/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Box3,
  Raycaster,
  Vector2,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import {
  pathKey,
  type ISceneEdit,
  type ISceneEditReport,
  type ISceneEditThing,
  type TTriple,
} from 'common/sceneEdit';
import { WORLD_NODE_TAG, type IWorldNodeTag } from './worldNodes';

/**
 * The Studio's Edit mode inside a 3D world: what stands under a point, the
 * picked things moved as a hand is moving them, the Studio's own camera,
 * and where the picked things are on the canvas for the handles drawn over
 * them.
 *
 * A world nobody is editing pays nothing for this: with no `edit` on the
 * frame every step here returns at once.
 */

export interface IWorldEditor {
  /** First in a frame: what the page asks of this one. */
  frame(edit: ISceneEdit | undefined): void;
  /** After the scene's own camera is aimed: the Studio's, if it has one. */
  aim(): void;
  /** After the world's formulas have placed everything: the hand's moves. */
  place(): void;
  /** After the world is drawn, its matrices fresh: the answer. */
  measure(): void;
  report(): ISceneEditReport | undefined;
}

/** Copies past this are boxed as one copy: their bounds cost a pass each. */
const BOXED_COPIES = 4000;

const tagOf = (object: Object3D): IWorldNodeTag | undefined =>
  object.userData[WORLD_NODE_TAG] as IWorldNodeTag | undefined;

/** djb2 over the world's nodes and camera: one world, one key. */
export const worldKeyOf = (world: unknown): string => {
  const text = JSON.stringify(world);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) {
    hash = (Math.imul(hash, 33) + text.charCodeAt(i)) | 0; // eslint-disable-line no-bitwise -- a 32-bit hash is made of bit arithmetic
  }
  return `${String(text.length)}:${String(hash)}`;
};

const triple = (v: { x: number; y: number; z: number }): TTriple => [
  v.x,
  v.y,
  v.z,
];

const createWorldEditor = (
  root: Object3D,
  camera: PerspectiveCamera,
  key: string,
): IWorldEditor => {
  const byPath = new Map<string, Object3D>();
  root.traverse((object) => {
    const tag = tagOf(object);
    if (tag) {
      byPath.set(pathKey(tag.path), object);
    }
  });

  let edit: ISceneEdit | undefined;
  let answer: ISceneEditReport | undefined;
  /** The fixed things a hand moved last frame, to be put back. */
  let moved: Object3D[] = [];
  let pickedId: number | undefined;
  let picked: ISceneEditReport['picked'];
  let hoverAt: string | undefined;
  let hoverPath: number[] | null = null;

  const raycaster = new Raycaster();
  const point = new Vector2();
  const box = new Box3();
  const corner = new Vector3();
  const pivot = new Vector3();
  const tip = new Vector3();
  const origin = new Vector3();
  const eye = new Vector3();
  const look = new Vector3();
  const up = new Vector3(0, 1, 0);

  /** A world point on the canvas, 0..1 and y down; null behind the camera. */
  const onCanvas = (world: Vector3): [number, number] | null => {
    corner.copy(world).applyMatrix4(camera.matrixWorldInverse);
    if (corner.z > -camera.near) {
      return null;
    }
    corner.applyMatrix4(camera.projectionMatrix);
    return [(corner.x + 1) / 2, (1 - corner.y) / 2];
  };

  /** Where one unit along each column of `frame` lands, from the pivot. */
  const axesOn = (
    frame: Object3D | null,
    at: [number, number],
    unit: boolean,
  ): ISceneEditThing['axes'] => {
    const axes: [number, number][] = [];
    for (let axis = 0; axis < 3; axis += 1) {
      tip.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      if (frame) {
        origin.setFromMatrixPosition(frame.matrixWorld);
        tip.applyMatrix4(frame.matrixWorld).sub(origin);
      }
      if (unit) {
        tip.normalize();
      }
      tip.add(pivot);
      const landed = onCanvas(tip);
      axes.push(landed ? [landed[0] - at[0], landed[1] - at[1]] : [0, 0]);
    }
    return axes as unknown as ISceneEditThing['axes'];
  };

  const measureThing = (
    path: readonly number[],
    object: Object3D,
  ): ISceneEditThing => {
    pivot.setFromMatrixPosition(object.matrixWorld);
    const at = onCanvas(pivot);
    const copies = object as Partial<InstancedMesh>;
    if (copies.isInstancedMesh && (copies.count ?? 0) <= BOXED_COPIES) {
      copies.computeBoundingBox?.();
    }
    box.setFromObject(object);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    if (!box.isEmpty()) {
      for (let i = 0; i < 8; i += 1) {
        tip.set(
          i % 2 === 0 ? box.min.x : box.max.x,
          Math.floor(i / 2) % 2 === 0 ? box.min.y : box.max.y,
          i < 4 ? box.min.z : box.max.z,
        );
        const landed = onCanvas(tip);
        if (landed) {
          minX = Math.min(minX, landed[0]);
          minY = Math.min(minY, landed[1]);
          maxX = Math.max(maxX, landed[0]);
          maxY = Math.max(maxY, landed[1]);
        }
      }
    }
    // A light, an empty group: nothing to box, so a mark where it stands.
    if (minX > maxX && at) {
      [minX, minY] = at;
      [maxX, maxY] = at;
    }
    const inView = at !== null && minX <= maxX;
    const where: [number, number] = at ?? [0.5, 0.5];
    eye.setFromMatrixPosition(camera.matrixWorld).sub(pivot);
    const toward: number[] = [];
    for (let axis = 0; axis < 3; axis += 1) {
      tip.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      if (object.parent) {
        tip.transformDirection(object.parent.matrixWorld);
      }
      toward.push(tip.dot(eye) >= 0 ? 1 : -1);
    }
    return {
      path,
      inView,
      box: inView ? [minX, minY, maxX, maxY] : [0, 0, 0, 0],
      pivot: where,
      axes: axesOn(object.parent, where, false),
      ownAxes: axesOn(object, where, true),
      toward: toward as unknown as TTriple,
      centre: triple(pivot),
      position: triple(object.position),
      rotation: triple(object.rotation),
      scale: triple(object.scale),
    };
  };

  /** Whether `object` and everything it stands in is shown. */
  const shown = (object: Object3D): boolean => {
    for (let at: Object3D | null = object; at; at = at.parent) {
      if (!at.visible) {
        return false;
      }
    }
    return true;
  };

  const pickAt = (x: number, y: number): number[] | null => {
    point.set(x * 2 - 1, 1 - y * 2);
    raycaster.setFromCamera(point, camera);
    const hit = raycaster
      .intersectObject(root, true)
      .find((found) => shown(found.object));
    for (let at: Object3D | null = hit?.object ?? null; at; at = at.parent) {
      const tag = tagOf(at);
      if (tag) {
        return [...tag.path];
      }
    }
    return null;
  };

  return {
    frame: (next) => {
      edit = next;
      if (!next) {
        answer = undefined;
      }
    },
    aim: () => {
      const view = edit?.camera;
      if (!view) {
        return;
      }
      camera.position.set(...view.position);
      camera.up.copy(up);
      camera.lookAt(look.set(...view.target));
      camera.updateMatrixWorld();
    },
    place: () => {
      if (moved.length === 0 && (!edit || edit.moves.length === 0)) {
        return;
      }
      // A fixed thing is placed once, at the build: put back first, or last
      // frame's move would be added to again.
      moved.forEach((object) => tagOf(object)?.place());
      moved = [];
      // Moves made on another world were written into this one's file.
      if (!edit || edit.world !== key) {
        return;
      }
      edit.moves.forEach((move) => {
        const object = byPath.get(pathKey(move.path));
        const tag = object && tagOf(object);
        if (!object || !tag) {
          return;
        }
        object.position.x += move.position[0];
        object.position.y += move.position[1];
        object.position.z += move.position[2];
        object.rotation.set(
          object.rotation.x + move.rotation[0],
          object.rotation.y + move.rotation[1],
          object.rotation.z + move.rotation[2],
        );
        object.scale.x *= move.scale[0];
        object.scale.y *= move.scale[1];
        object.scale.z *= move.scale[2];
        if (!tag.live) {
          moved.push(object);
        }
      });
    },
    measure: () => {
      if (!edit) {
        return;
      }
      if (edit.pick && edit.pick.id !== pickedId) {
        pickedId = edit.pick.id;
        picked = { id: pickedId, path: pickAt(edit.pick.x, edit.pick.y) };
      }
      // Measured first: measuring a thing borrows the vectors the camera's
      // own place is read into below.
      const things = edit.selected.flatMap((path) => {
        const object = byPath.get(pathKey(path));
        return object ? [measureThing(path, object)] : [];
      });
      // What a click would pick, looked for again only when the pointer has
      // moved or the scene has: a ray through every copy of every thing is
      // not a thing to send sixty times a second for a pointer at rest.
      let hovered: ISceneEditThing | undefined;
      if (edit.hover) {
        const at = `${String(edit.hover[0])},${String(edit.hover[1])}`;
        if (at !== hoverAt || !edit.frozen || edit.moves.length > 0) {
          hoverAt = at;
          hoverPath = pickAt(edit.hover[0], edit.hover[1]);
        }
        const object = hoverPath && byPath.get(pathKey(hoverPath));
        hovered =
          hoverPath && object ? measureThing(hoverPath, object) : undefined;
      } else {
        hoverAt = undefined;
      }
      eye.setFromMatrixPosition(camera.matrixWorld);
      camera.getWorldDirection(look);
      answer = {
        world: key,
        ...(picked ? { picked } : {}),
        things,
        ...(hovered ? { hovered } : {}),
        camera: {
          position: triple(eye),
          // A point ahead to turn about: where the Studio's camera starts.
          target: triple(look.multiplyScalar(10).add(eye)),
        },
      };
    },
    report: () => answer,
  };
};

export default createWorldEditor;
