/**
 * @jest-environment node
 */

/**
 * Edit mode's locks and its working Hide (`editMarks.ts`, `editIds.ts`).
 *
 * Everything starts locked (Ivan, 2026-11-11: "all objects need to be locked
 * by default so the user cannot accidentally move them"), so a lock that
 * lands on the wrong thing is an unlock nobody asked for: each case that
 * moves things round — a delete, its undo, a save — checks which thing ends
 * up free, beside the thing that must stay locked. Hide is the member's
 * working tool and never the scene's: a Save after hiding writes nothing of
 * it, with a real switch-off in the same save as the control.
 */

import type {
  ISceneEditReport,
  TWorldEditOp,
  TWorldEditOutcome,
} from '../../../common/sceneEdit';
import type { IScenePack } from '../../../common/scenePacks';
import normalizeSceneWorld from '../../../common/sceneWorldRead';
import { applyWorldEdits } from '../../../common/worldEdit';
import type { ISceneFrame } from '../../../renderer/graph/sceneGl';
import { lockedIn } from '../../../renderer/studio/edit/editMarks';
import {
  createStageEdit,
  emptyMove,
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
      type: 'mesh',
      name: 'Rock',
      geometry: { kind: 'box' },
      material: 'paint',
    },
  ],
};

const packOf = (raw: unknown): IScenePack =>
  ({
    params: [],
    world: normalizeSceneWorld(raw, []),
  }) as unknown as IScenePack;

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

const moved = (path: number[]) => ({
  ...emptyMove(path),
  position: [2, 0, 0] as const,
});

/** Which things may be moved now, by name. */
const free = (store: ReturnType<typeof setUp>['store'], pack: IScenePack) => {
  const draft = store.draft(pack).world?.nodes ?? [];
  return store
    .state()
    .unlocked.map((key) => {
      const steps = key.split('.').map(Number);
      let node = draft[steps[0]];
      steps.slice(1).forEach((step) => {
        node = node.children[step];
      });
      return node.name;
    })
    .sort();
};

describe('a thing in Edit mode', () => {
  it('starts locked: picked, and not moved or deleted', () => {
    const { store, pack } = setUp();
    expect(store.state().unlocked).toEqual([]);
    // Picked on the stage like any other.
    store.pickAt(0.5, 0.5, false);
    const report: ISceneEditReport = {
      world: 'w',
      things: [],
      camera: { position: [0, 0, 10], target: [0, 0, 0] },
      picked: { id: 1, path: [0] },
    };
    store.heard(report);
    expect(store.state().selected).toEqual([[0]]);
    store.nudge(moved([0]));
    store.drag(moved([0]));
    store.drop();
    store.remove();
    expect(store.state().changes).toBe(0);
    expect(store.draft(pack)).toBe(pack);
    // The control: unlocked, the same hand moves it and Delete takes it.
    store.toggleLock([0]);
    store.nudge(moved([0]));
    expect(store.state().changes).toBe(1);
    store.remove();
    expect(store.draft(pack).world?.nodes).toHaveLength(2);
  });

  it('is unlocked with its group, and keeps a lock set on it after', () => {
    const { store, pack } = setUp();
    store.toggleLock([1]);
    expect(free(store, pack)).toEqual(['Boat', 'Hull']);
    store.toggleLock([1, 0]);
    expect(free(store, pack)).toEqual(['Boat']);
    expect(lockedIn(store.state().unlocked, [1, 0])).toBe(true);
    // Locking the group locks it through, and what was set inside is gone:
    // unlocked again, the whole of it is free.
    store.toggleLock([1]);
    expect(free(store, pack)).toEqual([]);
    store.toggleLock([1]);
    expect(free(store, pack)).toEqual(['Boat', 'Hull']);
  });

  it('keeps its own lock when a thing before it is deleted, and back on undo', () => {
    const { store, pack } = setUp();
    store.toggleLock([0]);
    store.toggleLock([2]);
    store.select([0], false);
    store.remove();
    // The rock now stands where the boat stood: it is the one still free.
    expect(free(store, pack)).toEqual(['Rock']);
    expect(lockedIn(store.state().unlocked, [0])).toBe(true);
    store.undo();
    expect(free(store, pack)).toEqual(['Moon', 'Rock']);
    store.redo();
    expect(free(store, pack)).toEqual(['Rock']);
  });

  it('that the member adds or copies starts unlocked, and the copied one stays as it was', () => {
    const { store, pack } = setUp();
    store.add('ball', 'Ball');
    expect(free(store, pack)).toEqual(['Ball']);
    store.select([2], false);
    store.copy();
    expect(free(store, pack)).toEqual(['Ball', 'Rock 2']);
  });

  it('keeps its lock through a save, on the thing and not its place', async () => {
    const { store, pack, saves, answer } = setUp();
    store.toggleLock([0]);
    store.toggleLock([2]);
    store.select([0], false);
    store.remove();
    store.save();
    const edited = applyWorldEdits(RAW, saves[0]);
    if (!edited.ok) {
      throw new Error(edited.reason);
    }
    const fromFiles = packOf(edited.world);
    answer({ ok: true, changed: true });
    await Promise.resolve();
    store.setPack(fromFiles);
    expect(store.state().changes).toBe(0);
    expect(free(store, fromFiles)).toEqual(['Rock']);
    expect(lockedIn(store.state().unlocked, [0])).toBe(true);
    expect(pack.world?.nodes).toHaveLength(3);
  });
});

describe("Edit mode's Hide", () => {
  const frame = { spectrum: [], waveform: [] } as unknown as ISceneFrame;

  it('hides a thing on the stage only: Save writes nothing of it', () => {
    const { store, pack, saves } = setUp();
    store.toggleHidden([2]);
    expect(store.shape(frame).edit?.hidden).toEqual([[2]]);
    expect(store.draft(pack)).toBe(pack);
    expect(store.state().changes).toBe(0);
    // A real change in the same save, as the control that Save writes.
    store.toggleLock([0]);
    store.nudge(moved([0]));
    store.select([1], false);
    store.showPicked(false);
    store.save();
    expect(saves[0]).toEqual([
      { kind: 'move', path: [0], position: [2, 0, 0] },
      { kind: 'show', path: [1], shown: false },
    ]);
  });

  it('and Solo end with Edit mode', () => {
    const { store } = setUp();
    store.toggleHidden([2]);
    store.select([0], false);
    store.setSolo(true);
    store.setOn(false);
    expect(store.state()).toMatchObject({ solo: false, hidden: [] });
    store.setOn(true);
    expect(store.shape(frame).edit?.hidden).toBeUndefined();
  });
});
