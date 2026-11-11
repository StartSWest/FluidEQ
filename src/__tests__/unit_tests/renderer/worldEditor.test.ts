/**
 * @jest-environment node
 */
import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PointLight,
  SphereGeometry,
  type Object3D,
} from 'three';
import type { ISceneEdit } from '../../../common/sceneEdit';
import createWorldEditor from '../../../renderer/graph/world/worldEditor';
import { WORLD_NODE_TAG } from '../../../renderer/graph/world/worldNodes';

/**
 * Edit mode inside a 3D world (Ivan, 2026-11-10: "select each object", "a
 * single fish, not that group", "solo view", "see what I am doing"): what a
 * click picks, a hand's move while it is being made, Solo, the Studio's own
 * camera, and where the picked things are for the handles drawn over them.
 *
 * On a real three.js scene, with no drawing: everything here is geometry.
 */

const paint = new MeshBasicMaterial();

/** `object` as the world's builder leaves one: tagged with where it is in the file. */
const tagged = <T extends Object3D>(
  object: T,
  path: number[],
  at: [number, number, number],
  live = false,
): T => {
  object.position.set(...at);
  Object.assign(object.userData, {
    [WORLD_NODE_TAG]: {
      path,
      live,
      // Put back as its formulas say, as `placeNode` does: where it
      // started, and shown.
      place: () => {
        object.position.set(...at);
        object.rotation.set(0, 0, 0);
        object.scale.set(1, 1, 1);
        Object.assign(object, { visible: true });
      },
    },
  });
  return object;
};

/**
 * A box on the left, a boat on the right (a group, its hull inside it), a
 * shoal of three fish above, and a lamp. Seen from ten units back.
 */
const world = () => {
  const root = new Group();
  const box = tagged(
    new Mesh(new BoxGeometry(1, 1, 1), paint),
    [0],
    [-3, 0, 0],
  );
  const boat = tagged(new Group(), [1], [3, 0, 0]);
  const hull = tagged(
    new Mesh(new BoxGeometry(2, 0.5, 1), paint),
    [1, 0],
    [0, 0, 0],
  );
  boat.add(hull);
  const fish = tagged(
    new InstancedMesh(new SphereGeometry(0.3), paint, 3),
    [2],
    [0, 3, 0],
  );
  [-2, 0, 2].forEach((x, copy) => {
    fish.setMatrixAt(copy, new Matrix4().makeTranslation(x, 0, 0));
  });
  fish.instanceMatrix.needsUpdate = true;
  const lamp = tagged(new PointLight(), [3], [0, 5, 5]);
  root.add(box, boat, fish, lamp);
  const camera = new PerspectiveCamera(50, 2, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);
  root.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  const editor = createWorldEditor(root, camera, 'lake');
  /** One frame, in the order the world's drawing takes its steps. */
  const frame = (edit: ISceneEdit | undefined) => {
    editor.frame(edit);
    editor.aim();
    editor.place();
    root.updateMatrixWorld(true);
    editor.measure();
    return editor.report();
  };
  return { root, camera, box, boat, hull, fish, lamp, frame };
};

const ASK: ISceneEdit = { frozen: true, selected: [], moves: [] };

/** Where a world point lands on the canvas, 0..1 and y down. */
const onCanvas = (camera: PerspectiveCamera, at: [number, number, number]) => {
  const { x, y } = new Mesh().position.set(...at).project(camera);
  return { x: (x + 1) / 2, y: (1 - y) / 2 };
};

describe('what a click picks in a 3D world', () => {
  it('is the thing under it, by its place in the file', () => {
    const { camera, frame } = world();
    const report = frame({
      ...ASK,
      pick: { id: 1, ...onCanvas(camera, [-3, 0, 0]) },
    });
    expect(report?.picked).toEqual({ id: 1, path: [0] });
  });

  it('is the exact part, not the group it stands in', () => {
    const { camera, frame } = world();
    const report = frame({
      ...ASK,
      pick: { id: 2, ...onCanvas(camera, [3, 0, 0]) },
    });
    expect(report?.picked).toEqual({ id: 2, path: [1, 0] });
  });

  it('is one copy of many, by a last step below zero', () => {
    const { camera, frame } = world();
    // The third fish: two units right of the shoal's own place.
    const report = frame({
      ...ASK,
      pick: { id: 3, ...onCanvas(camera, [2, 3, 0]) },
    });
    expect(report?.picked).toEqual({ id: 3, path: [2, -3] });
  });

  it('is nothing over empty space, and says so', () => {
    const { frame } = world();
    const report = frame({ ...ASK, pick: { id: 4, x: 0.5, y: 0.95 } });
    expect(report?.picked).toEqual({ id: 4, path: null });
  });

  it('never picks what is hidden', () => {
    const { camera, box, frame } = world();
    box.visible = false;
    const report = frame({
      ...ASK,
      pick: { id: 5, ...onCanvas(camera, [-3, 0, 0]) },
    });
    expect(report?.picked).toEqual({ id: 5, path: null });
  });

  it('answers each ask once: the same id is not looked for again', () => {
    const { camera, box, frame } = world();
    const pick = { id: 6, ...onCanvas(camera, [-3, 0, 0]) };
    expect(frame({ ...ASK, pick })?.picked?.path).toEqual([0]);
    box.visible = false;
    // The same ask on a later frame keeps its answer.
    expect(frame({ ...ASK, pick })?.picked?.path).toEqual([0]);
    // The control: a new ask is looked for, and finds nothing there now.
    expect(
      frame({ ...ASK, pick: { ...pick, id: 7 } })?.picked?.path,
    ).toBeNull();
  });
});

describe('a move while the hand is making it', () => {
  const move = {
    path: [0],
    position: [1, 0, 0] as const,
    rotation: [0, 0, 0.5] as const,
    scale: [2, 1, 1] as const,
  };

  it('is shown on the thing, and taken off again the frame it ends', () => {
    const { box, frame } = world();
    frame({ ...ASK, world: 'lake', moves: [move] });
    expect(box.position.toArray()).toEqual([-2, 0, 0]);
    expect(box.rotation.z).toBeCloseTo(0.5);
    expect(box.scale.toArray()).toEqual([2, 1, 1]);
    // Still being made: applied once a frame, never piled on itself.
    frame({ ...ASK, world: 'lake', moves: [move] });
    expect(box.position.toArray()).toEqual([-2, 0, 0]);
    // Ended: the thing is back where the file has it.
    frame(ASK);
    expect(box.position.toArray()).toEqual([-3, 0, 0]);
    expect(box.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('is not given twice to a world already built with it', () => {
    const { box, frame } = world();
    // Made on the world before this one: this one's file has it already.
    frame({ ...ASK, world: 'the world before', moves: [move] });
    expect(box.position.toArray()).toEqual([-3, 0, 0]);
  });
});

describe('Solo', () => {
  it('shows the picked thing, what holds it and the lights, and nothing else', () => {
    const { box, boat, hull, fish, lamp, frame } = world();
    frame({ ...ASK, selected: [[1, 0]], solo: true });
    expect(hull.visible).toBe(true);
    expect(boat.visible).toBe(true);
    expect(lamp.visible).toBe(true);
    expect(box.visible).toBe(false);
    expect(fish.visible).toBe(false);
    // Off: everything is shown again.
    frame({ ...ASK, selected: [[1, 0]] });
    expect([box.visible, fish.visible, boat.visible, hull.visible]).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('shows one fish of the shoal alone, and gives the others back', () => {
    const { fish, frame } = world();
    const before = Array.from(fish.instanceMatrix.array);
    frame({ ...ASK, selected: [[2, -2]], solo: true });
    const copy = new Matrix4();
    const sizes = [0, 1, 2].map((index) => {
      fish.getMatrixAt(index, copy);
      return copy.getMaxScaleOnAxis();
    });
    expect(sizes).toEqual([0, 1, 0]);
    frame({ ...ASK, selected: [[2, -2]] });
    expect(Array.from(fish.instanceMatrix.array)).toEqual(before);
  });

  it('hides nothing while nothing is picked', () => {
    const { box, fish, frame } = world();
    frame({ ...ASK, solo: true });
    expect([box.visible, fish.visible]).toEqual([true, true]);
  });
});

describe("the Studio's own camera", () => {
  it('stands where it is put and looks where it is told', () => {
    const { camera, frame } = world();
    const report = frame({
      ...ASK,
      camera: { position: [0, 20, 0.001], target: [0, 0, 0] },
    });
    expect(camera.position.y).toBe(20);
    expect(report?.camera.position[1]).toBeCloseTo(20);
    // Looking straight down: the point ahead of it is ten units below.
    expect(report?.camera.target[1]).toBeCloseTo(10);
  });

  it("is the scene's own while none is asked for", () => {
    const { frame } = world();
    const report = frame(ASK);
    expect(report?.camera.position).toEqual([0, 0, 10]);
    expect(report?.camera.target[2]).toBeCloseTo(0);
  });
});

describe('where the picked things are, for the handles over them', () => {
  it('measures each one picked: its frame on the canvas and its place', () => {
    const { camera, frame } = world();
    const report = frame({ ...ASK, selected: [[0], [1, 0]] });
    expect(report?.things.map((thing) => thing.path)).toEqual([[0], [1, 0]]);
    const [box] = report?.things ?? [];
    const centre = onCanvas(camera, [-3, 0, 0]);
    expect(box.inView).toBe(true);
    expect(box.pivot[0]).toBeCloseTo(centre.x);
    expect(box.pivot[1]).toBeCloseTo(centre.y);
    // Its frame is round its middle, and on the canvas.
    expect(box.box[0]).toBeLessThan(centre.x);
    expect(box.box[2]).toBeGreaterThan(centre.x);
    expect(box.box[1]).toBeLessThan(centre.y);
    expect(box.box[3]).toBeGreaterThan(centre.y);
    expect(box.position).toEqual([-3, 0, 0]);
    // One unit along x goes right on the canvas, one along y goes up.
    expect(box.axes[0][0]).toBeGreaterThan(0);
    expect(box.axes[1][1]).toBeLessThan(0);
  });

  it('says a thing behind the camera is out of view', () => {
    const { box, frame } = world();
    box.position.set(0, 0, 30);
    const report = frame({ ...ASK, selected: [[0]] });
    expect(report?.things[0].inView).toBe(false);
  });

  it('leaves out a thing the world does not have', () => {
    const { frame } = world();
    expect(frame({ ...ASK, selected: [[9]] })?.things).toEqual([]);
  });

  it('measures a thing the pointer rests on, on the stage or in the list', () => {
    const { camera, frame } = world();
    const at = onCanvas(camera, [-3, 0, 0]);
    expect(frame({ ...ASK, hover: [at.x, at.y] })?.hovered?.path).toEqual([0]);
    expect(frame({ ...ASK, hoverThing: [1, 0] })?.hovered?.path).toEqual([
      1, 0,
    ]);
    expect(frame(ASK)?.hovered).toBeUndefined();
  });
});

describe('a world nobody is editing', () => {
  it('is asked nothing and answers nothing', () => {
    const { box, frame } = world();
    expect(frame(undefined)).toBeUndefined();
    expect(box.position.toArray()).toEqual([-3, 0, 0]);
  });

  it('stops answering when editing ends', () => {
    const { frame } = world();
    expect(frame(ASK)).toBeDefined();
    expect(frame(undefined)).toBeUndefined();
  });
});
