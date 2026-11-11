/**
 * @jest-environment node
 */
import type {
  ISceneEditReport,
  ISceneEditThing,
  TWorldEditOp,
  TWorldEditOutcome,
} from '../../../common/sceneEdit';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import { applyWorldEdits } from '../../../common/worldEdit';
import {
  createStageEdit,
  emptyMove,
  lockedIn,
  thingsPicked,
} from '../../../renderer/studio/edit/stageEditStore';

const RAW = {
  camera: { position: [0, 2, 10], target: [0, 0, 0] },
  materials: { paint: { kind: 'standard', colour: '#ff0000' } },
  nodes: [
    {
      type: 'mesh',
      name: 'Moon',
      position: [1, 2, 3],
      geometry: { kind: 'sphere' },
      material: 'paint',
    },
    {
      type: 'group',
      name: 'Boat',
      position: [0, 'sin(time)', 0],
      children: [
        {
          type: 'mesh',
          name: 'Hull',
          geometry: { kind: 'box' },
          material: 'paint',
        },
      ],
    },
    {
      type: 'instances',
      name: 'Fish',
      geometry: { kind: 'sphere' },
      material: 'paint',
      layout: { kind: 'line', count: [8, 1, 1] },
    },
  ],
};

/** A pack as the bench holds one, its world read as a project's is. */
const packOf = (raw: unknown): IScenePack =>
  ({
    params: [],
    world: normalizeSceneWorld(raw, []),
  }) as unknown as IScenePack;

const placeOf = (pack: IScenePack, index: number) =>
  pack.world?.nodes[index].position;

/** A store on `RAW`, with a save that waits to be answered. */
const setUp = () => {
  const saves: TWorldEditOp[][] = [];
  let answer: (outcome: TWorldEditOutcome) => void = () => undefined;
  const store = createStageEdit({
    save: (ops) => {
      saves.push(ops);
      return new Promise((resolve) => {
        answer = resolve;
      });
    },
  });
  const pack = packOf(RAW);
  store.setPack(pack);
  store.setOn(true);
  return {
    store,
    pack,
    saves,
    answer: (outcome: TWorldEditOutcome) => answer(outcome),
  };
};

const moved = (path: number[], x: number) => ({
  ...emptyMove(path),
  position: [x, 0, 0] as const,
});

describe("Edit mode's changes", () => {
  it('are a draft: shown on the stage, written nowhere, until saved', () => {
    const { store, pack, saves } = setUp();
    store.select([0], false);
    store.drag(moved([0], 2));
    store.drop();
    expect(store.state()).toMatchObject({ changes: 1, canUndo: true });
    // The stage plays the pack with the change made to it…
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
    // …the pack on the bench is as its files have it, and nothing was sent.
    expect(placeOf(pack, 0)).toEqual([1, 2, 3]);
    expect(saves).toHaveLength(0);
  });

  it('are undone and redone in the window, with no save', () => {
    const { store, pack, saves } = setUp();
    store.nudge(moved([0], 2));
    store.nudge(moved([0], 1));
    expect(placeOf(store.draft(pack), 0)).toEqual([4, 2, 3]);
    store.undo();
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
    expect(store.state()).toMatchObject({ changes: 1, canRedo: true });
    store.redo();
    expect(placeOf(store.draft(pack), 0)).toEqual([4, 2, 3]);
    expect(saves).toHaveLength(0);
  });

  it('are forgotten by Discard, and the scene is what it was', () => {
    const { store, pack, saves } = setUp();
    store.nudge(moved([0], 2));
    store.select([1], false);
    store.remove();
    expect(store.draft(pack).world?.nodes).toHaveLength(2);
    store.discard();
    expect(store.state()).toMatchObject({ changes: 0, canUndo: false });
    // The very pack: nothing of the draft is left on it.
    expect(store.draft(pack)).toBe(pack);
    expect(saves).toHaveLength(0);
  });

  it('keep a formula and shift it, as the saved file will', () => {
    const { store, pack } = setUp();
    store.nudge({ ...emptyMove([1]), position: [0, 1.5, 0] });
    expect(placeOf(store.draft(pack), 1)).toEqual([0, '(sin(time)) + 1.5', 0]);
  });

  it('move everything picked as one change, and a part with its whole', () => {
    const { store, pack } = setUp();
    // The moon, the boat and the boat's own hull: the hull goes with the
    // boat, and is not moved a second time.
    store.selectMany([[0], [1, 0], [1]]);
    store.drag(moved([1], 2));
    store.drop();
    expect(store.state().changes).toBe(1);
    const draft = store.draft(pack);
    expect(placeOf(draft, 0)).toEqual([3, 2, 3]);
    expect(placeOf(draft, 1)).toEqual([2, 'sin(time)', 0]);
    expect(draft.world?.nodes[1].children[0].position).toEqual([0, 0, 0]);
    store.undo();
    expect(store.draft(pack)).toBe(pack);
  });

  it('leave one copy of many where its rule puts it', () => {
    const { store, pack } = setUp();
    // The third fish of the shoal: picked, and nothing of it to write.
    store.select([2, -3], false);
    store.drag(moved([2, -3], 2));
    store.drop();
    store.remove();
    store.showPicked(false);
    expect(store.state().changes).toBe(0);
    expect(store.draft(pack)).toBe(pack);
    // The control: the shoal itself moves.
    store.nudge(moved([2], 2));
    expect(placeOf(store.draft(pack), 2)).toEqual([2, 0, 0]);
  });

  it('refuse a change the scene would not build with, and keep the rest', () => {
    const { store, pack } = setUp();
    store.nudge(moved([0], 2));
    store.send([{ kind: 'delete', path: [9] }]);
    expect(store.state()).toMatchObject({ changes: 1, failure: 'missing' });
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
  });
});

describe("Edit mode's Save", () => {
  const saved = (ops: TWorldEditOp[]) => {
    const edited = applyWorldEdits(RAW, ops);
    if (!edited.ok) {
      throw new Error(edited.reason);
    }
    return packOf(edited.world);
  };

  it('writes every change in one go, once', () => {
    const { store, saves } = setUp();
    store.nudge(moved([0], 2));
    store.nudge(moved([0], 1));
    store.save();
    store.save();
    expect(saves).toHaveLength(1);
    expect(saves[0]).toEqual([
      { kind: 'move', path: [0], position: [2, 0, 0] },
      { kind: 'move', path: [0], position: [1, 0, 0] },
    ]);
    expect(store.state().saving).toBe(true);
  });

  it('never makes a change twice when the saved scene arrives first', async () => {
    const { store, saves, answer } = setUp();
    store.nudge(moved([0], 2));
    store.save();
    // The files' own pack, with the change in it, before the save's answer.
    const fromFiles = saved(saves[0]);
    expect(placeOf(store.draft(fromFiles), 0)).toEqual([3, 2, 3]);
    store.setPack(fromFiles);
    expect(placeOf(store.draft(fromFiles), 0)).toEqual([3, 2, 3]);
    answer({ ok: true, changed: true });
    await Promise.resolve();
    expect(store.state()).toMatchObject({ changes: 0, saving: false });
    expect(store.draft(fromFiles)).toBe(fromFiles);
  });

  it('keeps showing the change until the saved scene arrives after', async () => {
    const { store, pack, saves, answer } = setUp();
    store.nudge(moved([0], 2));
    store.save();
    answer({ ok: true, changed: true });
    await Promise.resolve();
    // Answered, and the files' pack still to come: the stage must not fall
    // back to the scene as it was.
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
    expect(store.state().saving).toBe(true);
    const fromFiles = saved(saves[0]);
    store.setPack(fromFiles);
    expect(store.state()).toMatchObject({ changes: 0, saving: false });
    expect(placeOf(store.draft(fromFiles), 0)).toEqual([3, 2, 3]);
  });

  it('keeps the changes when the save fails', async () => {
    const { store, pack, answer } = setUp();
    store.nudge(moved([0], 2));
    store.save();
    answer({ ok: false, reason: 'failed' });
    await Promise.resolve();
    expect(store.state()).toMatchObject({
      changes: 1,
      saving: false,
      failure: 'failed',
    });
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
  });

  it('drops changes that no longer fit a scene someone else wrote', () => {
    const { store } = setUp();
    store.select([1, 0], false);
    store.nudge(moved([1, 0], 2));
    // The member's AI took the boat out: the hull's path names nothing.
    const rewritten = saved([{ kind: 'delete', path: [1] }]);
    store.setPack(rewritten);
    expect(store.state()).toMatchObject({ changes: 0, failure: 'missing' });
    expect(store.draft(rewritten)).toBe(rewritten);
  });
});

/** A thing as the scene measures one, standing where nothing depends on it. */
const measured = (path: number[]): ISceneEditThing => ({
  path,
  inView: true,
  box: [0, 0, 1, 1],
  pivot: [0, 0],
  axes: [
    [1, 0],
    [0, 1],
    [0, 0],
  ],
  ownAxes: [
    [1, 0],
    [0, 1],
    [0, 0],
  ],
  toward: [1, 1, 1],
  centre: [0, 0, 0],
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

/** What the scene says of a frame: what it measured, and its camera. */
const heard = (
  things: ISceneEditThing[],
  target: [number, number, number] = [0, 1.2, 0],
): ISceneEditReport => ({
  world: 'lake',
  things,
  camera: { position: [0, 2.6, 13], target },
});

// Found driving the buttons nobody had pressed, 2026-11-11.
describe('a new thing', () => {
  it('is added where the camera on screen is looking, so it can be seen', () => {
    const { store, pack } = setUp();
    store.heard(heard([]));
    store.add('ball', 'Ball');
    const nodes = store.draft(pack).world?.nodes ?? [];
    expect(nodes).toHaveLength(4);
    expect(nodes[3]).toMatchObject({ name: 'Ball', position: [0, 1.2, 0] });
    // And it is what is picked.
    expect(store.state().selected).toEqual([[3]]);
  });

  it('is added at the middle of the world before the scene has said where it looks', () => {
    const { store, pack } = setUp();
    store.add('ball', 'Ball');
    expect(placeOf(store.draft(pack), 3)).toEqual([0, 0, 0]);
  });
});

describe('what the stage frames', () => {
  it('is what the scene measured of what is picked now, and nothing older', () => {
    const { store } = setUp();
    store.select([1, 0], false);
    store.heard(heard([measured([1, 0])]));
    expect(thingsPicked(store.state()).map((thing) => thing.path)).toEqual([
      [1, 0],
    ]);
    // A ball is added: the world is being rebuilt, and the measurements the
    // store still holds are of the hull.
    store.add('ball', 'Ball');
    expect(store.state().things.map((thing) => thing.path)).toEqual([[1, 0]]);
    expect(thingsPicked(store.state())).toEqual([]);
    // Once the scene has measured the ball, it is framed.
    store.heard(heard([measured([3])]));
    expect(thingsPicked(store.state()).map((thing) => thing.path)).toEqual([
      [3],
    ]);
  });
});

describe('a locked thing', () => {
  it('is locked with everything that is a part of it, and nothing beside it', () => {
    expect(lockedIn(['1'], [1])).toBe(true);
    expect(lockedIn(['1'], [1, 0])).toBe(true);
    expect(lockedIn(['1.0'], [1])).toBe(false);
    expect(lockedIn(['1'], [0])).toBe(false);
    expect(lockedIn(['1'], [10])).toBe(false);
    expect(lockedIn([], [1, 0])).toBe(false);
  });

  it('is not carried by a move, alone or picked with others', () => {
    const { store, pack } = setUp();
    store.select([0], false);
    store.lockPicked(true);
    store.nudge(moved([0], 2));
    expect(store.state().changes).toBe(0);
    expect(placeOf(store.draft(pack), 0)).toEqual([1, 2, 3]);
    // The control: let go, the same move carries it.
    store.lockPicked(false);
    store.nudge(moved([0], 2));
    expect(placeOf(store.draft(pack), 0)).toEqual([3, 2, 3]);
  });
});
