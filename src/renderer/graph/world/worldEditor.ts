/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  Box3,
  Euler,
  Matrix4,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type InstancedMesh,
  type Object3D,
  type PerspectiveCamera,
} from 'three';
import {
  copyOf,
  pathKey,
  type ISceneEdit,
  type ISceneEditReport,
  type ISceneEditThing,
  type TNodePath,
  type TTriple,
} from 'common/sceneEdit';
import { WORLD_NODE_TAG, type IWorldNodeTag } from './worldNodes';

/**
 * The Studio's Edit mode inside a 3D world: what stands under a point, the
 * picked things moved as a hand is moving them, the Studio's own camera,
 * everything but the picked things put out of sight while they are looked at
 * alone, and where the picked things are on the canvas for the handles drawn
 * over them.
 *
 * A thing is a node, or one copy of a node that draws many (`copyOf`): the
 * ninety fish of a reef are one node, and a hand reaches for one fish.
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

const copiesOf = (object: Object3D): InstancedMesh | undefined =>
  (object as Partial<InstancedMesh>).isInstancedMesh
    ? (object as InstancedMesh)
    : undefined;

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
  const tagged: Object3D[] = [];
  root.traverse((object) => {
    const tag = tagOf(object);
    if (tag) {
      byPath.set(pathKey(tag.path), object);
      tagged.push(object);
    }
  });

  let edit: ISceneEdit | undefined;
  let answer: ISceneEditReport | undefined;
  /** The fixed things a hand moved or Solo hid last frame, to be put back. */
  let touched: Object3D[] = [];
  /** Copies Solo put out of sight last frame, with where they stood. */
  let shrunk: { mesh: InstancedMesh; kept: Float32Array }[] = [];
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
  const whole = new Matrix4();
  const own = new Matrix4();
  const nothing = new Matrix4().makeScale(0, 0, 0);
  const turn = new Quaternion();
  const angles = new Euler();
  const stood = new Vector3();
  const sized = new Vector3();

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
    frame: Matrix4 | undefined,
    at: [number, number],
    unit: boolean,
  ): ISceneEditThing['axes'] => {
    const axes: [number, number][] = [];
    for (let axis = 0; axis < 3; axis += 1) {
      tip.set(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      if (frame) {
        origin.setFromMatrixPosition(frame);
        tip.applyMatrix4(frame).sub(origin);
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

  /**
   * One thing as the frame drew it: `bounds` in the space `placed` puts in
   * the world, `frame` the space its place is written in.
   */
  const measured = (
    path: TNodePath,
    placed: Matrix4,
    frame: Matrix4 | undefined,
    bounds: Box3,
    values: Pick<ISceneEditThing, 'position' | 'rotation' | 'scale'>,
  ): ISceneEditThing => {
    pivot.setFromMatrixPosition(placed);
    const at = onCanvas(pivot);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    if (!bounds.isEmpty()) {
      for (let i = 0; i < 8; i += 1) {
        tip.set(
          i % 2 === 0 ? bounds.min.x : bounds.max.x,
          Math.floor(i / 2) % 2 === 0 ? bounds.min.y : bounds.max.y,
          i < 4 ? bounds.min.z : bounds.max.z,
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
      if (frame) {
        tip.transformDirection(frame);
      }
      toward.push(tip.dot(eye) >= 0 ? 1 : -1);
    }
    return {
      path,
      inView,
      box: inView ? [minX, minY, maxX, maxY] : [0, 0, 0, 0],
      pivot: where,
      axes: axesOn(frame, where, false),
      ownAxes: axesOn(placed, where, true),
      toward: toward as unknown as TTriple,
      centre: triple(pivot),
      ...values,
    };
  };

  const measureThing = (path: TNodePath): ISceneEditThing | undefined => {
    const one = copyOf(path);
    const object = byPath.get(pathKey(one ? one.node : path));
    if (!object) {
      return undefined;
    }
    const mesh = copiesOf(object);
    if (one) {
      // One copy: its own place among the copies, inside the node's.
      if (!mesh || one.copy >= mesh.count) {
        return undefined;
      }
      mesh.getMatrixAt(one.copy, own);
      whole.multiplyMatrices(mesh.matrixWorld, own);
      mesh.geometry.computeBoundingBox();
      box.copy(mesh.geometry.boundingBox ?? box.makeEmpty());
      // The corners are taken in the world: the box is turned with the copy.
      const corners = new Box3();
      for (let i = 0; i < 8 && !box.isEmpty(); i += 1) {
        corners.expandByPoint(
          tip
            .set(
              i % 2 === 0 ? box.min.x : box.max.x,
              Math.floor(i / 2) % 2 === 0 ? box.min.y : box.max.y,
              i < 4 ? box.min.z : box.max.z,
            )
            .applyMatrix4(whole),
        );
      }
      own.decompose(stood, turn, sized);
      angles.setFromQuaternion(turn);
      return measured(path, whole, mesh.matrixWorld, corners, {
        position: triple(stood),
        rotation: triple(angles),
        scale: triple(sized),
      });
    }
    if (mesh && mesh.count <= BOXED_COPIES) {
      mesh.computeBoundingBox();
    }
    box.setFromObject(object);
    return measured(path, object.matrixWorld, object.parent?.matrixWorld, box, {
      position: triple(object.position),
      rotation: triple(object.rotation),
      scale: triple(object.scale),
    });
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
        // Which copy, when the thing hit is one of many: a step below zero.
        return at === hit?.object &&
          copiesOf(at) &&
          hit.instanceId !== undefined
          ? [...tag.path, -(hit.instanceId + 1)]
          : [...tag.path];
      }
    }
    return null;
  };

  /** Whether one path is the other, or stands inside it. */
  const within = (inner: TNodePath, outer: TNodePath) =>
    outer.length <= inner.length &&
    outer.every((step, depth) => step === inner[depth]);

  /**
   * Everything but the picked things out of sight, for this frame: a thing
   * stays when it is picked, holds something picked or stands inside it, or
   * is a light — a thing alone in the dark is not seen alone.
   */
  const solo = (picks: readonly TNodePath[]) => {
    const kept = picks.map((path) => copyOf(path)?.node ?? path);
    tagged.forEach((object) => {
      const tag = tagOf(object);
      if (
        !tag ||
        (object as { isLight?: boolean }).isLight ||
        kept.some((path) => within(tag.path, path) || within(path, tag.path))
      ) {
        return;
      }
      Object.assign(object, { visible: false });
      touched.push(object);
    });
    // Of a node whose copies are picked one by one, only those copies.
    const byNode = new Map<string, number[]>();
    picks.forEach((path) => {
      const one = copyOf(path);
      if (one && !picks.some((other) => pathKey(other) === pathKey(one.node))) {
        byNode.set(pathKey(one.node), [
          ...(byNode.get(pathKey(one.node)) ?? []),
          one.copy,
        ]);
      }
    });
    byNode.forEach((copies, node) => {
      const object = byPath.get(node);
      const mesh = object && copiesOf(object);
      if (!mesh) {
        return;
      }
      const all = mesh.instanceMatrix.array as Float32Array;
      shrunk.push({ mesh, kept: all.slice() });
      for (let copy = 0; copy < mesh.count; copy += 1) {
        if (!copies.includes(copy)) {
          mesh.setMatrixAt(copy, nothing);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
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
      // What last frame moved or hid is put back first. A fixed thing is
      // placed once, at the build, and a live one has just been placed.
      touched.forEach((object) => {
        const tag = tagOf(object);
        if (tag && !tag.live) {
          tag.place();
        }
      });
      touched = [];
      shrunk.forEach(({ mesh, kept }) => {
        (mesh.instanceMatrix.array as Float32Array).set(kept);
        mesh.instanceMatrix.needsUpdate = true;
      });
      shrunk = [];
      if (!edit) {
        return;
      }
      // Moves made on another world were written into this one's draft.
      if (edit.world === key) {
        edit.moves.forEach((move) => {
          const object = byPath.get(pathKey(move.path));
          if (!object) {
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
          touched.push(object);
        });
      }
      if (edit.solo && edit.selected.length > 0) {
        solo(edit.selected);
      }
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
        const thing = measureThing(path);
        return thing ? [thing] : [];
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
        hovered = hoverPath ? measureThing(hoverPath) : undefined;
      } else {
        hoverAt = undefined;
        // Rested on in the list instead: the same frame round it here.
        hovered = edit.hoverThing ? measureThing(edit.hoverThing) : undefined;
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
