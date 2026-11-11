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
  type TTriple,
  type TWorldEditFailure,
  type TWorldEditOp,
  type TWorldEditOutcome,
} from 'common/sceneEdit';
import type { IScenePack } from 'common/scenePacks';
import normalizeSceneWorld from 'common/sceneWorldRead';
import { applyWorldEdits, sameShape } from 'common/worldEdit';
import type { ISceneFrame } from '../../graph/sceneGl';
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

export type TEditTool = 'move' | 'turn' | 'size';

export type TEditMark =
  | { kind: 'pin'; x: number; y: number }
  | { kind: 'box'; x0: number; y0: number; x1: number; y1: number };

export interface IStageEditState {
  on: boolean;
  tool: TEditTool;
  snap: boolean;
  frozen: boolean;
  freeView: boolean;
  selected: readonly TNodePath[];
  /** Things that may not be picked on the stage or moved, by `pathKey`. */
  locked: readonly string[];
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

const NO_MOVE: TTriple = [0, 0, 0];
const NO_SCALE: TTriple = [1, 1, 1];

export const emptyMove = (path: TNodePath): ISceneEditMove => ({
  path,
  position: NO_MOVE,
  rotation: NO_MOVE,
  scale: NO_SCALE,
});

const isStill = (move: ISceneEditMove) =>
  move.position.every((part) => Math.abs(part) < 1e-5) &&
  move.rotation.every((part) => Math.abs(part) < 1e-5) &&
  move.scale.every((part) => Math.abs(part - 1) < 1e-5);

/** Every move of one thing as one: places and turns summed, sizes multiplied. */
const combined = (moves: readonly ISceneEditMove[]): ISceneEditMove[] => {
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
const moveOp = (move: ISceneEditMove): TWorldEditOp => ({
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
const reshapes = (ops: readonly TWorldEditOp[]) =>
  ops.some((op) => ['delete', 'copy', 'group', 'add'].includes(op.kind));

/**
 * What the scene hears, kept as it was when the music was frozen. The two
 * arrays are copied: the runner fills the same two every frame.
 */
const heardNow = (frame: ISceneFrame): Partial<ISceneFrame> => ({
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
const drafted = (pack: IScenePack, ops: readonly TWorldEditOp[]): TDrafted => {
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

interface IShown {
  moves: ISceneEditMove[];
  /** The world the moves were made on. */
  key: string | undefined;
  /** A build ended since: if this world is still up, it stays. */
  settled: boolean;
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
  toggleLock(path: TNodePath): void;
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
  /** Every picked thing shown, or hidden. */
  showPicked(shown: boolean): void;
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

const START: IStageEditState = {
  on: false,
  tool: 'move',
  snap: false,
  frozen: true,
  freeView: false,
  selected: [],
  locked: [],
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
  let made: TWorldEditOp[][] = [];
  let unmade: TWorldEditOp[][] = [];
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

  const isLocked = (path: TNodePath) =>
    path.some((_step, depth) =>
      state.locked.includes(pathKey(path.slice(0, depth + 1))),
    );

  const stacks = () => ({
    changes: made.length,
    canUndo: made.length > 0,
    canRedo: unmade.length > 0,
    version: state.version + 1,
  });

  /** One change: kept if the scene still builds with it, refused if not. */
  const act = (ops: TWorldEditOp[], moves: ISceneEditMove[] = []): boolean => {
    if (ops.length === 0 || !base || state.saving) {
      return false;
    }
    const tried = drafted(base, [...made.flat(), ...ops]);
    if (!tried.ok) {
      set({ failure: tried.reason });
      return false;
    }
    made = [...made, ops];
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
    const ops = source[source.length - 1];
    if (!ops || state.saving) {
      return;
    }
    if (from === 'made') {
      made = made.slice(0, -1);
      unmade = [...unmade, ops];
    } else {
      unmade = unmade.slice(0, -1);
      made = [...made, ops];
    }
    shown = undefined;
    // Over a change of structure, the paths picked name other things.
    set({ ...stacks(), ...(reshapes(ops) ? { selected: [] } : {}) });
  };

  /** Saved and in the files' own pack: nothing is left to apply. */
  const finishSave = () => {
    saveBase = undefined;
    saveLanded = false;
    made = [];
    unmade = [];
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
        // still to come, it finishes there.
        if (saveLanded) {
          finishSave();
        }
      } else if (made.length > 0 && !drafted(pack, made.flat()).ok) {
        // The scene was written by someone else — the member's AI, an
        // editor — and the changes no longer fit it.
        made = [];
        unmade = [];
        set({ ...stacks(), selected: [], failure: 'missing' });
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
      const tried = fresh ? undefined : drafted(pack, made.flat());
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
        } else if (!isLocked(hit)) {
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
      set({ on, failure: undefined, ...(on ? {} : { freeView: false }) });
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
      const key = pathKey(path);
      set({
        locked: state.locked.includes(key)
          ? state.locked.filter((known) => known !== key)
          : [...state.locked, key],
      });
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
    lockPicked: (isLocking) => {
      const keys = state.selected.map(pathKey);
      set({
        locked: isLocking
          ? [...new Set([...state.locked, ...keys])]
          : state.locked.filter((key) => !keys.includes(key)),
      });
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
        act(picked.map((path) => ({ kind: 'copy', path: [...path] })))
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
      if (act([{ kind: 'group', paths, name }])) {
        set({ selected: [first] });
      }
    },
    add: (shape, name) => {
      if (!base) {
        return;
      }
      // In front of the Studio's camera when it has one, or at the middle.
      const at = state.freeView && view ? view.target : NO_MOVE;
      const now = drafted(base, made.flat());
      const count = (now.ok ? now.pack : base).world?.nodes.length ?? 0;
      if (
        act([
          { kind: 'add', shape, name, at: [...at] as [number, number, number] },
        ])
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
      set({ saving: true });
      bridge
        .save(made.flat())
        .then((outcome) => {
          if (!outcome.ok) {
            saveBase = undefined;
            set({ saving: false, failure: outcome.reason });
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
        .catch(() => {
          saveBase = undefined;
          set({ saving: false, failure: 'failed' });
        });
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
