/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  copyOf,
  pathKey,
  samePath,
  type ISceneEdit,
  type ISceneEditCamera,
  type ISceneEditMove,
  type ISceneEditReport,
  type ISceneEditThing,
  type TNodePath,
  type TWorldEditFailure,
  type TWorldEditOp,
  type TWorldEditOutcome,
} from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import type { ISceneFrame } from '../../graph/sceneGl';
import {
  combined,
  drafted,
  emptyMove,
  heardNow,
  isStill,
  moveOp,
  NO_MOVE,
  reshapes,
} from './editDraft';
import { idAt, idTree, replayIds, type IIdNode } from './editIds';
import { createMarkBook } from './editMarkBook';
import { lockedIn, type IEditMarkView } from './editMarks';
import {
  dolly,
  lookAt,
  lookFrom,
  orbit,
  slide,
  type TEditSide,
} from './editMath';

/**
 * Edit mode on the Studio's stage: what is picked, what a hand is moving,
 * and the changes made so far.
 *
 * NOTHING IS WRITTEN UNTIL THE MEMBER SAVES (Ivan, 2026-11-10: "cannot auto
 * save like that", "make sure I don't shit the scene"). Every change is kept
 * here, in order, and the stage plays the scene with them applied — a draft
 * built in the window, the project's files untouched. Undo and redo step
 * through that list at once, with no file and no wait in the way. Save
 * writes the whole list into the scene in one go; Discard forgets it, and
 * the scene is exactly what it was. The first version wrote each drag into
 * the file as it was let go.
 *
 * A MOVE IS SHOWN FROM THE HAND TO THE DRAFT WITHOUT A GAP: while dragged, a
 * thing is moved in the picture alone; let go, the move stays in the picture
 * until the draft's world is the one on screen — the renderer tells them
 * apart by the world's key — so nothing jumps back while it builds.
 */

export { emptyMove };

export type TEditTool = 'move' | 'turn' | 'size';

export type TEditMark =
  | { kind: 'pin'; x: number; y: number }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number };

/**
 * Which things may be moved and which are hidden while editing, by path
 * (`editMarks.ts`): everything not unlocked is locked.
 */
export interface IStageEditState extends IEditMarkView {
  on: boolean;
  tool: TEditTool;
  snap: boolean;
  frozen: boolean;
  freeView: boolean;
  selected: readonly TNodePath[];
  /** Changes made and not saved yet. */
  changes: number;
  canUndo: boolean;
  canRedo: boolean;
  /** Counts every change to the draft: the stage builds it again. */
  version: number;
  failure?: TWorldEditFailure;
  /** The picked things as the last frame drew them. */
  things: readonly ISceneEditThing[];
  /** What a click would pick, under the pointer now. */
  hovered?: ISceneEditThing;
  /** A painted scene's marks, numbered in order. */
  marks: readonly TEditMark[];
  markTool: 'pin' | 'box';
  /** Save was pressed and the file is being written. */
  saving: boolean;
  /** The list of the scene's things is open down the stage's side. */
  listOpen: boolean;
  /** A handle is in the hand: the panels stand back from the scene. */
  dragging: boolean;
  /** Only the picked things are drawn: a look at them alone. */
  solo: boolean;
}

interface IShown {
  moves: ISceneEditMove[];
  /** The world the moves were made on. */
  key: string | undefined;
  /** A build ended since: if this world is still up, it stays. */
  settled: boolean;
}

/** One change of the member's, and its number for the things it makes. */
interface IChange {
  ops: TWorldEditOp[];
  serial: number;
}

export interface IStageEditBridge {
  save(ops: TWorldEditOp[]): Promise<TWorldEditOutcome>;
}

export interface IStageEditStore {
  subscribe(listener: () => void): () => void;
  state(): IStageEditState;
  /** The pack on the bench, as the project's files have it now. */
  setPack(pack: IScenePack): void;
  /** The scene as the stage plays it: the pack with the unsaved changes. */
  draft(pack: IScenePack): IScenePack;
  /** The frame as Edit mode sends it; the frame itself when Edit is off. */
  shape(frame: ISceneFrame): ISceneFrame;
  /** The renderer's answer to the last frame, if it gave one. */
  heard(report: ISceneEditReport | undefined): void;
  /** A build of the scene ended, well or badly. */
  buildEnded(): void;
  setOn(on: boolean): void;
  setTool(tool: TEditTool): void;
  setSnap(snap: boolean): void;
  setFrozen(frozen: boolean): void;
  setFreeView(free: boolean): void;
  select(path: TNodePath, add: boolean): void;
  /** The thing the last picked one stands in. */
  selectParent(): void;
  clearSelection(): void;
  /** Locked if it may be moved, unlocked if not, with all that is in it. */
  toggleLock(path: TNodePath): void;
  /** Hidden while editing, or shown again: never written by Save. */
  toggleHidden(path: TNodePath): void;
  /** What stands at this point of the canvas? Picked when answered. */
  pickAt(x: number, y: number, add: boolean): void;
  /** The pointer rests here, or has left: what would a click pick? */
  hoverAt(point: readonly [number, number] | undefined): void;
  /** The pointer rests on this thing in the list, or has left it. */
  hoverOn(path: TNodePath | undefined): void;
  /** Only the picked things drawn, or everything again. */
  setSolo(solo: boolean): void;
  /** A hand moving a thing: shown at once, kept when let go. */
  drag(move: ISceneEditMove | undefined): void;
  drop(): void;
  /** One number typed in: the difference from what stood there. */
  nudge(move: ISceneEditMove): void;
  /** These and no others picked: a run of the list. */
  selectMany(paths: readonly TNodePath[]): void;
  /**
   * Every picked thing switched on, or off, in the scene itself: a change
   * like any other, which Save writes.
   */
  showPicked(shown: boolean): void;
  /** Every picked thing hidden while editing, or shown again. */
  hidePicked(hidden: boolean): void;
  /** Every picked thing locked, or let go. */
  lockPicked(locked: boolean): void;
  /** One change of the member's, made of these edits. */
  send(ops: TWorldEditOp[]): void;
  /** The picked things that are in the file: not single copies. */
  nodesPicked(): readonly TNodePath[];
  remove(): void;
  copy(): void;
  group(name: string): void;
  add(shape: 'box' | 'ball' | 'light' | 'group', name: string): void;
  undo(): void;
  redo(): void;
  /** Every change so far written into the scene. */
  save(): void;
  /** Every change so far forgotten: the scene as it was. */
  discard(): void;
  clearFailure(): void;
  /** The Studio's camera, turned, slid, brought nearer or stood somewhere. */
  turnView(yaw: number, pitch: number): void;
  slideView(right: number, up: number): void;
  zoomView(factor: number): void;
  viewFrom(side: TEditSide): void;
  viewThing(): void;
  /** The Studio's view as the scene's own camera: a change like any other. */
  keepView(): void;
  addMark(mark: TEditMark): void;
  clearMarks(): void;
  setMarkTool(tool: 'pin' | 'box'): void;
  setListOpen(open: boolean): void;
}

/**
 * The things the stage frames and gives handles to: what the scene last
 * measured, of what is picked now.
 *
 * The two are not always the same. What the scene measures arrives a frame
 * behind what was picked, and after a change that rebuilds the world - a
 * thing added, grouped, copied or deleted - a good deal later: until then
 * the last measurements are of what was picked before, and drawn as they
 * stood the stage put the old thing's frame and handles under the new
 * thing's name.
 */
export const thingsPicked = (
  state: Pick<IStageEditState, 'things' | 'selected'>,
): readonly ISceneEditThing[] =>
  state.things.filter((thing) =>
    state.selected.some((path) => samePath(path, thing.path)),
  );

const START: IStageEditState = {
  on: false,
  tool: 'move',
  snap: false,
  frozen: true,
  freeView: false,
  selected: [],
  unlocked: [],
  ownLock: [],
  hidden: [],
  changes: 0,
  canUndo: false,
  canRedo: false,
  version: 0,
  things: [],
  marks: [],
  markTool: 'pin',
  saving: false,
  listOpen: true,
  dragging: false,
  solo: false,
};

const DEFAULT_VIEW: ISceneEditCamera = {
  position: [0, 3, 10],
  target: [0, 0, 0],
};

export const createStageEdit = (bridge: IStageEditBridge): IStageEditStore => {
  let state = START;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<IStageEditState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  /** The pack on the bench, as the project's files have it. */
  let base: IScenePack | undefined;
  /** The member's changes in order, each one or more edits. */
  let made: IChange[] = [];
  let unmade: IChange[] = [];
  /** Numbers each change, for the names of the things it makes. */
  let serial = 0;
  /** The files' things by name (`editIds.ts`). */
  let baseTree: IIdNode[] = [];
  /** The draft's things by name, the last time it was asked. */
  let treeOf: { made: IChange[]; base: IIdNode[]; tree: IIdNode[] } | undefined;
  /** The locks and the working Hide (`editMarkBook.ts`). */
  const book = createMarkBook();
  /** What is hidden, as the renderer is told it every frame. */
  let hiddenPaths: TNodePath[] = [];
  /** The draft's things when Save was pressed: where the marks go after it. */
  let savedTree: IIdNode[] | undefined;
  let draftOf:
    { base: IScenePack; version: number; pack: IScenePack } | undefined;
  /**
   * The pack a save in flight was made on. A pack that is not this one
   * already holds the saved changes — it can arrive before the save's own
   * answer or after it — and must not be given them again.
   */
  let saveBase: IScenePack | undefined;
  /** The save's answer came, well: the list goes with the files' pack. */
  let saveLanded = false;
  let heardFrozen: Partial<ISceneFrame> | undefined;
  let view: ISceneEditCamera | undefined;
  let sceneView: ISceneEditCamera | undefined;
  let pickId = 0;
  let pick: { id: number; x: number; y: number; add: boolean } | undefined;
  let hover: readonly [number, number] | undefined;
  let hoverThing: TNodePath | undefined;
  let worldKey: string | undefined;
  let thingsText = '[]';
  let hoveredText = '';
  let shown: IShown | undefined;
  /** What the hand is moving now: one move per thing it carries. */
  let live: ISceneEditMove[] = [];

  const isLocked = (path: TNodePath) => lockedIn(state.unlocked, path);
  const opsOf = (changes: readonly IChange[]) =>
    changes.flatMap((change) => change.ops);

  const treeNow = (): IIdNode[] => {
    if (treeOf?.made !== made || treeOf.base !== baseTree) {
      treeOf = {
        made,
        base: baseTree,
        tree: made.reduce(
          (tree, change) => replayIds(tree, change.ops, change.serial),
          baseTree,
        ),
      };
    }
    return treeOf.tree;
  };

  /** The marks as paths, for the panel, the handles and the renderer. */
  const marked = (): IEditMarkView => {
    const view = book.view(treeNow());
    hiddenPaths = view.hidden.map((key) => key.split('.').map(Number));
    return view;
  };

  const stacks = () => ({
    changes: made.length,
    canUndo: made.length > 0,
    canRedo: unmade.length > 0,
    version: state.version + 1,
    ...marked(),
  });

  /** One change: kept if the scene still builds with it, refused if not. */
  const act = (
    ops: TWorldEditOp[],
    moves: ISceneEditMove[] = [],
    /** What the change's own new things start as: told the change's number. */
    madeThings: (number: number) => void = () => undefined,
  ): boolean => {
    if (ops.length === 0 || !base || state.saving) {
      return false;
    }
    const tried = drafted(base, [...opsOf(made), ...ops]);
    if (!tried.ok) {
      set({ failure: tried.reason });
      return false;
    }
    serial += 1;
    madeThings(serial);
    made = [...made, { ops, serial }];
    unmade = [];
    // Shown by the hand's own move until the draft's world is drawn.
    shown = {
      moves: [...(shown?.moves ?? []), ...moves],
      key: shown ? shown.key : worldKey,
      settled: false,
    };
    set({ ...stacks(), failure: undefined });
    return true;
  };

  /**
   * The move made to every picked thing when the one it names is picked —
   * several things carried as one — and to that thing alone otherwise. A
   * thing inside another picked thing goes with it, and is not moved twice.
   */
  const carried = (move: ISceneEditMove): ISceneEditMove[] => {
    const picked = state.selected.some((path) => samePath(path, move.path))
      ? state.selected
      : [move.path];
    return picked
      .filter(
        (path) =>
          // One copy of many is its node's rule's to place, not a hand's.
          !copyOf(path) &&
          !isLocked(path) &&
          !picked.some(
            (other) =>
              other.length < path.length &&
              samePath(other, path.slice(0, other.length)),
          ),
      )
      .map((path) => ({ ...move, path }));
  };

  /** One change, however many things it moved. */
  const commit = (moves: ISceneEditMove[]) => {
    const real = moves.filter((move) => !isStill(move));
    if (real.length > 0) {
      act(real.map(moveOp), real);
    }
  };

  const step = (from: 'made' | 'unmade') => {
    const source = from === 'made' ? made : unmade;
    const change = source[source.length - 1];
    if (!change || state.saving) {
      return;
    }
    if (from === 'made') {
      made = made.slice(0, -1);
      unmade = [...unmade, change];
    } else {
      unmade = unmade.slice(0, -1);
      made = [...made, change];
    }
    shown = undefined;
    // Over a change of structure, the paths picked name other things.
    set({ ...stacks(), ...(reshapes(change.ops) ? { selected: [] } : {}) });
  };

  /** Saved and in the files' own pack: nothing is left to apply. */
  const finishSave = () => {
    if (savedTree) {
      book.afterSave(savedTree);
      savedTree = undefined;
    }
    saveBase = undefined;
    saveLanded = false;
    made = [];
    unmade = [];
    baseTree = idTree(base?.world?.nodes);
    shown = undefined;
    set({ ...stacks(), saving: false });
  };

  const moveView = (change: (now: ISceneEditCamera) => ISceneEditCamera) => {
    view = change(view ?? sceneView ?? DEFAULT_VIEW);
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    state: () => state,
    setPack: (pack) => {
      if (base === pack) {
        return;
      }
      base = pack;
      if (saveBase) {
        // The files' own pack with the save in it; if the save's answer is
        // still to come, it finishes there. Its things are named then too:
        // named now, the changes still in the draft would be made to them
        // a second time.
        if (saveLanded) {
          finishSave();
        }
        return;
      }
      baseTree = idTree(pack.world?.nodes);
      if (made.length > 0 && !drafted(pack, opsOf(made)).ok) {
        // The scene was written by someone else — the member's AI, an
        // editor — and the changes no longer fit it.
        made = [];
        unmade = [];
        set({ ...stacks(), selected: [], failure: 'missing' });
      } else {
        set(marked());
      }
    },
    draft: (pack) => {
      // A pack newer than the one the changes were saved from already has
      // them: applied again they would be made twice.
      const fresh = saveBase !== undefined && pack !== saveBase;
      if (
        draftOf?.base === pack &&
        draftOf.version === state.version &&
        !fresh
      ) {
        return draftOf.pack;
      }
      const tried = fresh ? undefined : drafted(pack, opsOf(made));
      const result = tried?.ok ? tried.pack : pack;
      if (!fresh) {
        draftOf = { base: pack, version: state.version, pack: result };
      }
      return result;
    },
    shape: (frame) => {
      if (!state.on) {
        heardFrozen = undefined;
        return frame;
      }
      if (!state.frozen) {
        heardFrozen = undefined;
      } else {
        heardFrozen ??= heardNow(frame);
      }
      const edit: ISceneEdit = {
        frozen: state.frozen,
        selected: state.selected,
        world: shown ? shown.key : worldKey,
        moves: combined([...(shown?.moves ?? []), ...live]),
        ...(state.freeView && view ? { camera: view } : {}),
        ...(pick ? { pick: { id: pick.id, x: pick.x, y: pick.y } } : {}),
        ...(hover && live.length === 0 ? { hover } : {}),
        ...(hoverThing ? { hoverThing } : {}),
        ...(state.solo ? { solo: true } : {}),
        ...(hiddenPaths.length > 0 ? { hidden: hiddenPaths } : {}),
      };
      return { ...frame, ...(heardFrozen ?? {}), edit };
    },
    heard: (report) => {
      if (!report || !state.on) {
        return;
      }
      if (!state.freeView) {
        sceneView = report.camera;
      }
      worldKey = report.world;
      if (shown && (shown.key !== worldKey || shown.settled)) {
        shown = undefined;
      }
      if (pick && report.picked?.id === pick.id) {
        const { add } = pick;
        pick = undefined;
        const hit = report.picked.path;
        if (!hit) {
          if (!add) {
            set({ selected: [] });
          }
        } else {
          // A locked thing is picked like any other: looked at, framed and
          // asked about. Its lock keeps the hand off it, not the eye.
          const has = state.selected.some((path) => samePath(path, hit));
          let selected: readonly TNodePath[] = [hit];
          if (add) {
            selected = has
              ? state.selected.filter((path) => !samePath(path, hit))
              : [...state.selected, hit];
          }
          set({ selected });
        }
      }
      const text = JSON.stringify(report.things);
      if (text !== thingsText) {
        thingsText = text;
        set({ things: report.things });
      }
      const over = hover || hoverThing ? report.hovered : undefined;
      const overText = over ? JSON.stringify(over) : '';
      if (overText !== hoveredText) {
        hoveredText = overText;
        set({ hovered: over });
      }
    },
    buildEnded: () => {
      if (shown) {
        shown.settled = true;
      }
    },
    setOn: (on) => {
      live = [];
      pick = undefined;
      hover = undefined;
      if (!on) {
        // Hide and Solo are for working: leaving Edit mode, the scene is
        // seen whole again, as listeners see it.
        book.clearHidden();
      }
      set({
        on,
        failure: undefined,
        ...(on ? {} : { freeView: false, solo: false, ...marked() }),
      });
    },
    setTool: (tool) => set({ tool }),
    setSnap: (snap) => set({ snap }),
    setFrozen: (frozen) => set({ frozen }),
    setFreeView: (freeView) => {
      if (freeView) {
        view = sceneView ?? view ?? DEFAULT_VIEW;
      }
      set({ freeView });
    },
    select: (path, add) => {
      const has = state.selected.some((known) => samePath(known, path));
      if (!add) {
        set({ selected: [path] });
      } else {
        set({
          selected: has
            ? state.selected.filter((known) => !samePath(known, path))
            : [...state.selected, path],
        });
      }
    },
    selectParent: () => {
      const last = state.selected[state.selected.length - 1];
      if (last && last.length > 1) {
        set({ selected: [last.slice(0, -1)] });
      }
    },
    clearSelection: () => set({ selected: [] }),
    toggleLock: (path) => {
      book.setLock(treeNow(), path, isLocked(path));
      set(marked());
    },
    toggleHidden: (path) => {
      book.toggleHidden(treeNow(), path);
      set(marked());
    },
    pickAt: (x, y, add) => {
      pickId += 1;
      pick = { id: pickId, x, y, add };
    },
    hoverAt: (point) => {
      hover = point;
    },
    hoverOn: (path) => {
      hoverThing = path;
    },
    setSolo: (isSolo) => set({ solo: isSolo }),
    drag: (move) => {
      live = move ? carried(move) : [];
      if (!state.dragging && live.length > 0) {
        set({ dragging: true });
      }
    },
    drop: () => {
      const moves = live;
      live = [];
      if (state.dragging) {
        set({ dragging: false });
      }
      commit(moves);
    },
    nudge: (move) => commit(carried(move)),
    selectMany: (paths) => set({ selected: paths }),
    showPicked: (isShown) => {
      act(
        state.selected
          .filter((path) => !copyOf(path))
          .map((path) => ({
            kind: 'show',
            path: [...path],
            shown: isShown,
          })),
      );
    },
    hidePicked: (isHiding) => {
      book.setHidden(treeNow(), state.selected, isHiding);
      set(marked());
    },
    lockPicked: (isLocking) => {
      // The outermost first: a thing set after what holds it keeps its own.
      [...state.selected]
        .sort((a, b) => a.length - b.length)
        .forEach((path) => book.setLock(treeNow(), path, !isLocking));
      set(marked());
    },
    send: (ops) => {
      act(ops);
    },
    nodesPicked: () => state.selected.filter((path) => !copyOf(path)),
    remove: () => {
      // Deepest and last first, so no path is moved by the one before it.
      const doomed = [...state.selected]
        .filter((path) => !isLocked(path) && !copyOf(path))
        .sort((a, b) =>
          pathKey(b).localeCompare(pathKey(a), 'en', { numeric: true }),
        );
      if (act(doomed.map((path) => ({ kind: 'delete', path: [...path] })))) {
        set({ selected: [] });
      }
    },
    copy: () => {
      // Last first: a copy lands after its thing and moves what follows.
      const picked = [...state.selected]
        .filter((path) => !copyOf(path))
        .sort((a, b) =>
          pathKey(b).localeCompare(pathKey(a), 'en', { numeric: true }),
        );
      const [first] = picked;
      if (
        first &&
        act(
          picked.map((path) => ({ kind: 'copy', path: [...path] })),
          [],
          // A copy the member made is theirs to place: it starts unlocked.
          (number) =>
            picked.forEach((_path, index) =>
              book.setOwn(`n${String(number)}.${String(index)}`, true),
            ),
        )
      ) {
        // One copy is picked in its thing's place; several leave nothing
        // picked, their places having moved each other.
        set({
          selected:
            picked.length === 1
              ? [[...first.slice(0, -1), first[first.length - 1] + 1]]
              : [],
        });
      }
    },
    group: (name) => {
      if (state.selected.length === 0) {
        return;
      }
      const paths = state.selected
        .filter((path) => !copyOf(path))
        .map((path) => [...path]);
      if (paths.length === 0) {
        return;
      }
      const first = paths.reduce((lowest, path) =>
        path[path.length - 1] < lowest[lowest.length - 1] ? path : lowest,
      );
      // The new group may be moved only if all it gathers could be; each
      // part keeps what it was, whatever the group says round it.
      const free = paths.map((path) => !isLocked(path));
      const all = free.every(Boolean);
      const tree = treeNow();
      const ids = paths.map((path) => idAt(tree, path));
      if (
        act([{ kind: 'group', paths, name }], [], (number) => {
          if (all) {
            book.setOwn(`n${String(number)}.0`, true);
          }
          ids.forEach((id, index) => {
            if (id && free[index] !== all) {
              book.setOwn(id, free[index]);
            } else if (id && book.own(id) === all) {
              book.setOwn(id, undefined);
            }
          });
        })
      ) {
        set({ selected: [first] });
      }
    },
    add: (shape, name) => {
      if (!base) {
        return;
      }
      const now = drafted(base, opsOf(made));
      const { world } = now.ok ? now.pack : base;
      const count = world?.nodes.length ?? 0;
      // Where the camera on screen is looking, so the new thing is seen. At
      // the world's middle it stood wherever the scene happened to have put
      // something: a ball added to a lake scene came up inside the boat.
      //
      // Looked around with, that is what the Studio's camera turns about.
      // Otherwise what the scene's own camera is aimed at, which is its
      // subject and at the subject's distance - when the file says it in
      // plain numbers. Where it is a formula, the point the scene last
      // reported ahead of its camera, which is on the line of sight and ten
      // units along it whatever the scene's size.
      const aimed = world?.camera.target;
      const subject =
        aimed && aimed.every((part) => typeof part === 'number')
          ? (aimed as readonly number[])
          : undefined;
      const at =
        (state.freeView ? view?.target : (subject ?? sceneView?.target)) ??
        NO_MOVE;
      if (
        act(
          [
            {
              kind: 'add',
              shape,
              name,
              at: [...at] as [number, number, number],
            },
          ],
          [],
          // A thing the member just added is there to be placed: unlocked.
          (number) => book.setOwn(`n${String(number)}.0`, true),
        )
      ) {
        set({ selected: [[count]] });
      }
    },
    undo: () => step('made'),
    redo: () => step('unmade'),
    save: () => {
      if (made.length === 0 || state.saving) {
        return;
      }
      const from = base;
      saveBase = from;
      saveLanded = false;
      savedTree = treeNow();
      set({ saving: true });
      const failed = (reason: TWorldEditFailure) => {
        saveBase = undefined;
        savedTree = undefined;
        // A pack that came in meanwhile is the one the draft now stands on.
        baseTree = idTree(base?.world?.nodes);
        set({ ...marked(), saving: false, failure: reason });
      };
      bridge
        .save(opsOf(made))
        .then((outcome) => {
          if (!outcome.ok) {
            failed(outcome.reason);
          } else if (!outcome.changed || base !== from) {
            // Nothing to wait for, or the files' pack is here already.
            finishSave();
          } else {
            // Kept in the draft until the files' pack arrives with them in,
            // or the stage would show the old scene in between.
            saveLanded = true;
          }
          return undefined;
        })
        .catch(() => failed('failed'));
    },
    discard: () => {
      if (state.saving) {
        return;
      }
      made = [];
      unmade = [];
      shown = undefined;
      set({ ...stacks(), selected: [], failure: undefined });
    },
    clearFailure: () => set({ failure: undefined }),
    turnView: (yaw, pitch) => moveView((now) => orbit(now, yaw, pitch)),
    slideView: (right, up) => moveView((now) => slide(now, right, up)),
    zoomView: (factor) => moveView((now) => dolly(now, factor)),
    viewFrom: (side) => moveView((now) => lookFrom(now, side)),
    viewThing: () => {
      const thing = state.things[state.things.length - 1];
      if (thing) {
        // Going to a thing is the Studio's camera's to do, never the scene's.
        if (!state.freeView) {
          view = sceneView ?? view ?? DEFAULT_VIEW;
          set({ freeView: true });
        }
        moveView((now) => lookAt(now, thing.centre));
      }
    },
    keepView: () => {
      if (
        view &&
        act([
          {
            kind: 'camera',
            position: [...view.position] as [number, number, number],
            target: [...view.target] as [number, number, number],
          },
        ])
      ) {
        set({ freeView: false });
      }
    },
    addMark: (mark) => set({ marks: [...state.marks, mark].slice(-9) }),
    clearMarks: () => set({ marks: [] }),
    setMarkTool: (markTool) => set({ markTool }),
    setListOpen: (listOpen) => set({ listOpen }),
  };
};
