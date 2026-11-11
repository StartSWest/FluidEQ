/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  pathKey,
  pickFrom,
  samePath,
  type ISceneEdit,
  type ISceneEditCamera,
  type ISceneEditMove,
  type ISceneEditReport,
  type ISceneEditThing,
  type IWorldEditHistory,
  type TNodePath,
  type TTriple,
  type TWorldEditFailure,
  type TWorldEditOp,
  type TWorldEditOutcome,
} from 'common/sceneEdit';
import type { TWorldNode } from 'common/sceneWorld';
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
 * what has been sent to be written and has not come back as a new world yet.
 *
 * A MOVE IS SHOWN FROM THE HAND TO THE FILE WITHOUT A GAP. While dragged, a
 * thing is moved in the picture alone. Let go, the move is written into the
 * scene's file and stays in the picture until the world built from that file
 * is the one on screen — the renderer tells them apart by the world's key —
 * so the thing never jumps back while its new world builds. Edits made in
 * that wait are held and sent once it ends, in order.
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
  history: IWorldEditHistory;
  failure?: TWorldEditFailure;
  /** The picked things as the last frame drew them. */
  things: readonly ISceneEditThing[];
  /** A painted scene's marks, numbered in order. */
  marks: readonly TEditMark[];
  markTool: 'pin' | 'box';
  /** Something is on its way into the file. */
  saving: boolean;
  /** The list of the scene's things is open down the stage's side. */
  listOpen: boolean;
  /** A handle is in the hand: the panels stand back from the scene. */
  dragging: boolean;
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

interface IPending {
  moves: ISceneEditMove[];
  /** The world the moves were made on. */
  key: string | undefined;
  /** The file has them; the world built from it is still to come. */
  landed: boolean;
  /** A build ended after they landed: if this world is still up, it stays. */
  settled: boolean;
  /** Lets the moves go and sends whatever was held behind them. */
  finish?: () => void;
}

export interface IStageEditBridge {
  edit(ops: TWorldEditOp[]): Promise<TWorldEditOutcome>;
  step(direction: 'undo' | 'redo'): Promise<TWorldEditOutcome>;
  history(): Promise<IWorldEditHistory>;
}

export interface IStageEditStore {
  subscribe(listener: () => void): () => void;
  state(): IStageEditState;
  /** The frame as Edit mode sends it; the frame itself when Edit is off. */
  shape(frame: ISceneFrame): ISceneFrame;
  /** The renderer's answer to the last frame, if it gave one. */
  heard(report: ISceneEditReport | undefined): void;
  /** The scene's things as the pack on the bench has them. */
  setNodes(nodes: readonly TWorldNode[] | undefined): void;
  /** A build of the scene ended, well or badly. */
  buildEnded(): void;
  setOn(on: boolean): void;
  setTool(tool: TEditTool): void;
  setSnap(snap: boolean): void;
  setFrozen(frozen: boolean): void;
  setFreeView(free: boolean): void;
  select(path: TNodePath, add: boolean): void;
  clearSelection(): void;
  toggleLock(path: TNodePath): void;
  /** What stands at this point of the canvas? Picked when answered. */
  pickAt(x: number, y: number, add: boolean): void;
  /** A hand moving a thing: shown at once, written when let go. */
  drag(move: ISceneEditMove | undefined): void;
  drop(): void;
  /** One number typed in: the difference from what stood there. */
  nudge(move: ISceneEditMove): void;
  send(ops: TWorldEditOp[]): void;
  remove(): void;
  copy(): void;
  group(name: string): void;
  add(shape: 'box' | 'ball' | 'light' | 'group', name: string): void;
  step(direction: 'undo' | 'redo'): void;
  clearFailure(): void;
  /** The Studio's camera, turned, slid, brought nearer or stood somewhere. */
  turnView(yaw: number, pitch: number): void;
  slideView(right: number, up: number): void;
  zoomView(factor: number): void;
  viewFrom(side: TEditSide): void;
  viewThing(): void;
  /** The Studio's view written as the scene's own camera. */
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
  history: { canUndo: false, canRedo: false },
  things: [],
  marks: [],
  markTool: 'pin',
  saving: false,
  listOpen: true,
  dragging: false,
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

  let nodes: readonly TWorldNode[] = [];
  let heardFrozen: Partial<ISceneFrame> | undefined;
  let view: ISceneEditCamera | undefined;
  let sceneView: ISceneEditCamera | undefined;
  let pickId = 0;
  let pick: { id: number; x: number; y: number; add: boolean } | undefined;
  let worldKey: string | undefined;
  let thingsText = '[]';
  let pending: IPending | undefined;
  let held: { ops: TWorldEditOp[]; moves: ISceneEditMove[] } = {
    ops: [],
    moves: [],
  };
  let live: ISceneEditMove | undefined;

  const isLocked = (path: TNodePath) =>
    path.some((_step, depth) =>
      state.locked.includes(pathKey(path.slice(0, depth + 1))),
    );

  const start = (ops: TWorldEditOp[], moves: ISceneEditMove[]) => {
    const mine: IPending = {
      moves,
      key: worldKey,
      landed: false,
      settled: false,
    };
    pending = mine;
    set({ saving: true });
    const finish = () => {
      if (pending !== mine) {
        return;
      }
      pending = undefined;
      if (held.ops.length > 0) {
        const next = held;
        held = { ops: [], moves: [] };
        start(next.ops, next.moves);
      } else {
        set({ saving: false });
      }
    };
    mine.finish = finish;
    bridge
      .edit(ops)
      .then((outcome) => {
        set({ history: outcome.history });
        if (!outcome.ok) {
          set({ failure: outcome.reason });
          finish();
        } else if (!outcome.changed || worldKey !== mine.key) {
          // Nothing to wait for, or the world built from it is already up.
          finish();
        } else {
          mine.landed = true;
        }
        return undefined;
      })
      .catch(() => {
        set({ failure: 'failed' });
        finish();
      });
  };

  const send = (ops: TWorldEditOp[], moves: ISceneEditMove[] = []) => {
    if (ops.length === 0) {
      return;
    }
    if (pending) {
      held = { ops: [...held.ops, ...ops], moves: [...held.moves, ...moves] };
    } else {
      start(ops, moves);
    }
  };

  const commit = (move: ISceneEditMove) => {
    if (!isStill(move)) {
      send([moveOp(move)], [move]);
    }
  };

  const refreshHistory = () => {
    bridge
      .history()
      .then((history) => {
        set({ history });
        return undefined;
      })
      .catch(() => undefined);
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
        world: pending ? pending.key : worldKey,
        moves: combined([
          ...(pending?.moves ?? []),
          ...held.moves,
          ...(live ? [live] : []),
        ]),
        ...(state.freeView && view ? { camera: view } : {}),
        ...(pick ? { pick: { id: pick.id, x: pick.x, y: pick.y } } : {}),
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
      if (report.world !== worldKey) {
        worldKey = report.world;
        refreshHistory();
      }
      if (pending?.landed && (pending.key !== worldKey || pending.settled)) {
        pending.finish?.();
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
          const chosen = pickFrom(hit, state.selected);
          if (!isLocked(chosen)) {
            const has = state.selected.some((path) => samePath(path, chosen));
            let selected: readonly TNodePath[] = [chosen];
            if (add) {
              selected = has
                ? state.selected.filter((path) => !samePath(path, chosen))
                : [...state.selected, chosen];
            }
            set({ selected });
          }
        }
      }
      const text = JSON.stringify(report.things);
      if (text !== thingsText) {
        thingsText = text;
        set({ things: report.things });
      }
    },
    setNodes: (next) => {
      nodes = next ?? [];
    },
    buildEnded: () => {
      if (pending?.landed) {
        pending.settled = true;
      }
    },
    setOn: (on) => {
      live = undefined;
      pick = undefined;
      if (on) {
        refreshHistory();
      }
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
    drag: (move) => {
      live = move && !isLocked(move.path) ? move : undefined;
      if (!state.dragging && live) {
        set({ dragging: true });
      }
    },
    drop: () => {
      const move = live;
      live = undefined;
      if (state.dragging) {
        set({ dragging: false });
      }
      if (move) {
        commit(move);
      }
    },
    nudge: (move) => {
      if (!isLocked(move.path)) {
        commit(move);
      }
    },
    send: (ops) => send(ops),
    remove: () => {
      // Deepest and last first, so no path is moved by the one before it.
      const doomed = [...state.selected]
        .filter((path) => !isLocked(path))
        .sort((a, b) =>
          pathKey(b).localeCompare(pathKey(a), 'en', {
            numeric: true,
          }),
        );
      send(doomed.map((path) => ({ kind: 'delete', path: [...path] })));
      set({ selected: [] });
    },
    copy: () => {
      const [first] = state.selected;
      if (!first) {
        return;
      }
      send([{ kind: 'copy', path: [...first] }]);
      set({
        selected: [[...first.slice(0, -1), first[first.length - 1] + 1]],
      });
    },
    group: (name) => {
      if (state.selected.length === 0) {
        return;
      }
      const paths = state.selected.map((path) => [...path]);
      send([{ kind: 'group', paths, name }]);
      const first = paths.reduce((lowest, path) =>
        path[path.length - 1] < lowest[lowest.length - 1] ? path : lowest,
      );
      set({ selected: [first] });
    },
    add: (shape, name) => {
      // In front of the Studio's camera when it has one, or at the middle.
      const at = state.freeView && view ? view.target : NO_MOVE;
      send([
        { kind: 'add', shape, name, at: [...at] as [number, number, number] },
      ]);
      set({ selected: [[nodes.length]] });
    },
    step: (direction) => {
      set({ saving: true });
      bridge
        .step(direction)
        .then((outcome) => {
          set({
            history: outcome.history,
            saving: pending !== undefined,
            // A step over a structure change leaves paths naming other things.
            selected: [],
            ...(outcome.ok ? {} : { failure: outcome.reason }),
          });
          return undefined;
        })
        .catch(() => set({ saving: pending !== undefined, failure: 'failed' }));
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
      if (!view) {
        return;
      }
      send([
        {
          kind: 'camera',
          position: [...view.position] as [number, number, number],
          target: [...view.target] as [number, number, number],
        },
      ]);
      set({ freeView: false });
    },
    addMark: (mark) => set({ marks: [...state.marks, mark].slice(-9) }),
    clearMarks: () => set({ marks: [] }),
    setMarkTool: (markTool) => set({ markTool }),
    setListOpen: (listOpen) => set({ listOpen }),
  };
};
