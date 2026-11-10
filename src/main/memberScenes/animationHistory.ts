/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { isDecodablePicture, SHEET_BOUNDS } from '../../common/pictureBounds';
import {
  ANIMATION_GROUNDS,
  ANIMATION_NAME,
  ANIMATIONS_DIR,
  MAX_ANIMATION_FILE_BYTES,
  MAX_ANIMATION_FRAMES,
  type TAnimationGround,
} from '../../common/studioAnimation';
import writeFileAtomically from '../atomicWrite';
import { insideFolder } from '../studioChat/projectPath';
import { MAX_SHEET_BYTES, readProjectAnimation } from './projectAnimations';

/**
 * Every animation's history (Ivan, 2026-11-10: "we keep original imported
 * and any other changes are saved ... a history no more than 20 or so ...
 * but we need to keep original and the current modification at least").
 *
 * In the project at `animation-history/<name>/`:
 * - `original/` - the sheet as it was first made or imported, with the
 *   member's files exactly as they came (a GIF, an Aseprite file, an atlas
 *   and its picture), kept for good;
 * - `v<n>/` - up to MAX_VERSIONS later sheets, the oldest let go first,
 *   never the original;
 * - `state.json` - which one is current, and the order.
 *
 * The current one is also the live pair the scene and the Animations tab
 * read, `art/<name>.png` and `animations/<name>.json`, so that path never
 * moves. Every change - the agent's tools, the member's import, rescale or
 * background removal - goes through `recordSheet`, and undo, redo and the
 * original only rewrite the live pair. A live pair changed some other way
 * (the agent editing the JSON by hand) is kept as a version before anything
 * moves, so nothing is ever lost to an undo.
 *
 * Publishing never reads it (a scene's files are the ones pack.json names),
 * and the Animations tab's watcher looks at `animations/` alone. Read and
 * written like the sheet tools' files: real paths inside the project, plain
 * folders that are not links, plain one-name files within bounds, written
 * through a temporary file and a rename. Calls on one animation run one
 * after another (`serial`): an undo arriving while a record writes would
 * otherwise read the state the record is about to replace.
 */

export const HISTORY_DIR = 'animation-history';
export const MAX_VERSIONS = 20;
const ORIGINAL = 'original';
const STATE_FILE = 'state.json';
const SHEET_FILE = 'sheet.png';
const ANIMATION_FILE = 'animation.json';
const MAX_STATE_BYTES = 64 * 1024;
const MAX_LABEL = 80;
/** The member's own files kept with the original: as many and as large. */
export const MAX_ORIGINAL_FILES = 8;
export const MAX_ORIGINAL_BYTES = 48 * 1024 * 1024;
const ORIGINAL_FILE_NAME =
  /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,63}\.(?:png|gif|webp|jpe?g|aseprite|ase|json)$/i;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export type TVersionId = 'original' | number;

/** How an animation plays: its file's fields beside the sheet. */
export interface IAnimationPlay {
  count: number;
  columns: number;
  fps: number;
  loop: boolean;
  ground: TAnimationGround;
}

export interface IOriginalFile {
  name: string;
  bytes: Uint8Array;
}

export interface IRecordHow {
  /** A few words for the member: "Import", "Removed the background". */
  label: string;
  /** The member's files as they came, kept with a first record. */
  original?: readonly IOriginalFile[];
}

interface IVersionEntry {
  id: number;
  label: string;
  at: number;
}

interface IHistoryState {
  original: { label: string; at: number; files: string[] };
  versions: IVersionEntry[];
  current: TVersionId;
  next: number;
  /** The member deleted the animation: the history stays, the live pair goes. */
  deleted: boolean;
}

export interface IHistoryList {
  current: TVersionId;
  versions: Array<{ id: TVersionId; label: string; at: number }>;
  canUndo: boolean;
  canRedo: boolean;
  originalFiles: string[];
  deleted: boolean;
}

/** Why a call did nothing, for the window to say: the words are for logs. */
export type THistoryFailure = 'invalid' | 'taken' | 'missing' | 'failed';

export type THistoryOutcome<T> =
  { ok: true; value: T } | { ok: false; reason: string; code: THistoryFailure };

const fail = (
  reason: string,
  code: THistoryFailure = 'failed',
): { ok: false; reason: string; code: THistoryFailure } => ({
  ok: false,
  reason,
  code,
});

const sha = (bytes: Uint8Array | string) =>
  createHash('sha256').update(bytes).digest('hex');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cleanLabel = (label: unknown) =>
  typeof label === 'string' && label.trim()
    ? label.trim().slice(0, MAX_LABEL)
    : 'Change';

/** `folder/<relative>` when it is a plain folder inside the project, made if asked. */
const plainFolder = (
  folder: string,
  relative: string,
  make: boolean,
): string | undefined => {
  const target = path.join(folder, relative);
  // Where it would be, links on the way followed, before anything is made:
  // a parent that is a junction out of the project would otherwise take
  // the new folder with it.
  if (!insideFolder(folder, relative)) {
    return undefined;
  }
  try {
    const stats = fs.lstatSync(target);
    if (!stats.isDirectory() || stats.isSymbolicLink()) {
      return undefined;
    }
  } catch {
    if (!make) {
      return undefined;
    }
    try {
      fs.mkdirSync(target, { recursive: true });
    } catch {
      return undefined;
    }
  }
  // Made or found, it must still be where it says.
  return insideFolder(folder, relative) ? target : undefined;
};

/** A plain one-name file's bytes within `limit`, or undefined. */
const readPlain = (file: string, limit: number): Buffer | undefined => {
  try {
    const stats = fs.lstatSync(file);
    return stats.isFile() && stats.nlink === 1 && stats.size <= limit
      ? fs.readFileSync(file)
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * A folder of ours emptied and taken away, never following a link out: a
 * link or junction planted inside is unlinked as a link, never walked.
 */
const removeOwnFolder = (dir: string) => {
  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(dir);
  } catch {
    return;
  }
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    try {
      fs.unlinkSync(dir);
    } catch {
      // A directory link Windows will only remove as a directory.
      fs.rmdirSync(dir);
    }
    return;
  }
  fs.readdirSync(dir).forEach((name) => removeOwnFolder(path.join(dir, name)));
  fs.rmdirSync(dir);
};

/** Each animation's calls, one after another. */
const queues = new Map<string, Promise<unknown>>();

const serial = <T>(
  folder: string,
  name: string,
  work: () => Promise<T>,
): Promise<T> => {
  const key = `${path.resolve(folder).toLowerCase()}\n${name}`;
  const before = queues.get(key) ?? Promise.resolve();
  const run = before.then(work, work);
  // The queue holds a promise that always settles, cleaned up once it is
  // the last one, so a failed call never blocks the next.
  const settledRun: Promise<void> = run.then(
    () => undefined,
    () => undefined,
  );
  queues.set(key, settledRun);
  settledRun
    .then(() => {
      if (queues.get(key) === settledRun) {
        queues.delete(key);
      }
      return undefined;
    })
    .catch(() => undefined);
  return run;
};

const isPng = (bytes: Uint8Array) =>
  bytes.byteLength <= MAX_SHEET_BYTES &&
  PNG_SIGNATURE.every((byte, at) => bytes[at] === byte) &&
  isDecodablePicture(bytes, SHEET_BOUNDS);

const isWhole = (
  value: unknown,
  least: number,
  most: number,
): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= least &&
  value <= most;

/** The play fields as given, when every one is what an animation may be. */
export const readPlay = (raw: unknown): IAnimationPlay | undefined => {
  if (!isRecord(raw)) {
    return undefined;
  }
  const { count, columns, fps, loop, ground } = raw;
  const where = ANIMATION_GROUNDS.find((each) => each === ground);
  return isWhole(count, 1, MAX_ANIMATION_FRAMES) &&
    isWhole(columns, 1, count) &&
    typeof fps === 'number' &&
    Number.isFinite(fps) &&
    fps >= 1 &&
    fps <= 60 &&
    typeof loop === 'boolean' &&
    where
    ? { count, columns, fps, loop, ground: where }
    : undefined;
};

/** The animation file as the live pair holds it: its sheet always art/<name>.png. */
const animationText = (name: string, play: IAnimationPlay) =>
  `${JSON.stringify({ sheet: `art/${name}.png`, ...play }, null, 2)}\n`;

interface ISnapshot {
  png: Buffer;
  play: IAnimationPlay;
}

/** The live pair as the scene reads it, or undefined when there is none. */
const readLive = async (
  folder: string,
  name: string,
): Promise<ISnapshot | undefined> => {
  const found = await readProjectAnimation(folder, name);
  if (!found) {
    return undefined;
  }
  const { count, columns, fps, loop, ground } = found.animation;
  return {
    png: Buffer.from(found.sheet),
    play: { count, columns, fps, loop, ground },
  };
};

/** Writes the live pair; both folders checked before either file. */
const writeLive = (folder: string, name: string, snapshot: ISnapshot) => {
  const art = plainFolder(folder, 'art', true);
  const animations = plainFolder(folder, ANIMATIONS_DIR, true);
  if (!art || !animations) {
    throw new Error(
      'The art or animations folder is not a plain folder inside the project.',
    );
  }
  writeFileAtomically(path.join(art, `${name}.png`), snapshot.png);
  writeFileAtomically(
    path.join(animations, `${name}.json`),
    animationText(name, snapshot.play),
  );
};

const unlinkInside = (folder: string, relative: string) => {
  const file = insideFolder(folder, relative);
  if (!file) {
    return;
  }
  try {
    if (fs.lstatSync(file).isFile()) {
      fs.unlinkSync(file);
    }
  } catch {
    // Not there: nothing to take away.
  }
};

/**
 * Takes the live pair away. The picture goes only when it is the
 * animation's own sheet: a file written by hand can name another picture
 * (`art/whale-dive-sheet.png`), and `art/<name>.png` is then somebody's
 * picture that only shares the name.
 */
const removeLive = async (folder: string, name: string) => {
  const found = await readProjectAnimation(folder, name);
  if (!found || found.animation.sheet === `art/${name}.png`) {
    unlinkInside(folder, `art/${name}.png`);
  }
  unlinkInside(folder, `${ANIMATIONS_DIR}/${name}.json`);
};

/** Whether any of `relatives` stands in the project (or would land outside it). */
const anyStands = (folder: string, relatives: readonly string[]) =>
  relatives.some((relative) => {
    const target = insideFolder(folder, relative);
    return target === undefined || fs.existsSync(target);
  });

/** Whether a live pair stands under `name`: its picture or its file. */
const liveTaken = (folder: string, name: string) =>
  anyStands(folder, [`art/${name}.png`, `${ANIMATIONS_DIR}/${name}.json`]);

/** Whether anything stands under `name`: its picture, file or history. */
const nameTaken = (folder: string, name: string) =>
  liveTaken(folder, name) || anyStands(folder, [`${HISTORY_DIR}/${name}`]);

const dirOf = (id: TVersionId) => (id === ORIGINAL ? ORIGINAL : `v${id}`);

const writeVersion = (
  root: string,
  id: TVersionId,
  snapshot: ISnapshot,
  files: readonly IOriginalFile[] = [],
) => {
  const dir = path.join(root, dirOf(id));
  removeOwnFolder(dir);
  fs.mkdirSync(dir);
  writeFileAtomically(path.join(dir, SHEET_FILE), snapshot.png);
  writeFileAtomically(
    path.join(dir, ANIMATION_FILE),
    JSON.stringify(snapshot.play),
  );
  if (files.length > 0) {
    const kept = path.join(dir, 'files');
    fs.mkdirSync(kept);
    files.forEach((file) =>
      writeFileAtomically(path.join(kept, file.name), file.bytes),
    );
  }
};

const readVersionAt = (root: string, id: TVersionId): ISnapshot | undefined => {
  const dir = path.join(root, dirOf(id));
  const png = readPlain(path.join(dir, SHEET_FILE), MAX_SHEET_BYTES);
  const json = readPlain(
    path.join(dir, ANIMATION_FILE),
    MAX_ANIMATION_FILE_BYTES,
  );
  if (!png || !json || !isPng(png)) {
    return undefined;
  }
  let play: IAnimationPlay | undefined;
  try {
    play = readPlay(JSON.parse(json.toString('utf8')));
  } catch {
    play = undefined;
  }
  return play ? { png, play } : undefined;
};

const sameSnapshot = (a: ISnapshot, b: ISnapshot) =>
  sha(a.png) === sha(b.png) &&
  JSON.stringify(a.play) === JSON.stringify(b.play);

/** The state as written, when it is one; never trusted past its shape. */
const readState = (root: string): IHistoryState | undefined => {
  const bytes = readPlain(path.join(root, STATE_FILE), MAX_STATE_BYTES);
  if (!bytes) {
    return undefined;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch {
    return undefined;
  }
  if (
    !isRecord(raw) ||
    !isRecord(raw.original) ||
    !Array.isArray(raw.versions)
  ) {
    return undefined;
  }
  const versions = raw.versions
    .filter(
      (entry): entry is IVersionEntry =>
        isRecord(entry) &&
        isWhole(entry.id, 1, Number.MAX_SAFE_INTEGER) &&
        typeof entry.label === 'string' &&
        typeof entry.at === 'number',
    )
    .slice(-MAX_VERSIONS);
  const current: TVersionId =
    raw.current === ORIGINAL ||
    !versions.some((entry) => entry.id === raw.current)
      ? ORIGINAL
      : (raw.current as number);
  const files = Array.isArray(raw.original.files)
    ? raw.original.files.filter(
        (file): file is string =>
          typeof file === 'string' && ORIGINAL_FILE_NAME.test(file),
      )
    : [];
  return {
    original: {
      label: cleanLabel(raw.original.label),
      at: typeof raw.original.at === 'number' ? raw.original.at : 0,
      files,
    },
    versions,
    current,
    next: Math.max(
      isWhole(raw.next, 1, Number.MAX_SAFE_INTEGER) ? raw.next : 1,
      ...versions.map((entry) => entry.id + 1),
    ),
    deleted: raw.deleted === true,
  };
};

const writeState = (root: string, state: IHistoryState) =>
  writeFileAtomically(path.join(root, STATE_FILE), JSON.stringify(state));

const order = (state: IHistoryState): TVersionId[] => [
  ORIGINAL,
  ...state.versions.map((entry) => entry.id),
];

export const listOf = (state: IHistoryState): IHistoryList => {
  const ids = order(state);
  const at = ids.indexOf(state.current);
  return {
    current: state.current,
    versions: [
      { id: ORIGINAL, label: state.original.label, at: state.original.at },
      ...state.versions.map(({ id, label, at: when }) => ({
        id,
        label,
        at: when,
      })),
    ],
    canUndo: !state.deleted && at > 0,
    canRedo: !state.deleted && at < ids.length - 1,
    originalFiles: state.original.files,
    deleted: state.deleted,
  };
};

/** The animation's history folder, when its name may have one. */
const historyRoot = (folder: string, name: string, make: boolean) =>
  ANIMATION_NAME.test(name)
    ? plainFolder(folder, `${HISTORY_DIR}/${name}`, make)
    : undefined;

/** Adds `snapshot` as the newest version after the current one. */
const pushVersion = (
  root: string,
  state: IHistoryState,
  snapshot: ISnapshot,
  label: string,
): IHistoryState => {
  // A record after an undo lets go of what the undo stepped back from.
  const ids = order(state);
  const kept = state.versions.filter(
    (entry) => ids.indexOf(entry.id) <= ids.indexOf(state.current),
  );
  state.versions
    .filter((entry) => !kept.includes(entry))
    .forEach((entry) => removeOwnFolder(path.join(root, dirOf(entry.id))));
  const id = state.next;
  writeVersion(root, id, snapshot);
  const versions = [...kept, { id, label: cleanLabel(label), at: Date.now() }];
  // The oldest go first, never the original.
  while (versions.length > MAX_VERSIONS) {
    const [oldest] = versions.splice(0, 1);
    removeOwnFolder(path.join(root, dirOf(oldest.id)));
  }
  return { ...state, versions, current: id, next: id + 1, deleted: false };
};

/**
 * The state to act from: the live pair kept first as a version when it is
 * not what the history says is current, so a change made around the
 * history is never lost.
 */
const settled = async (
  folder: string,
  name: string,
  root: string,
  state: IHistoryState,
): Promise<IHistoryState> => {
  if (state.deleted) {
    return state;
  }
  const live = await readLive(folder, name);
  const current = readVersionAt(root, state.current);
  if (!live || (current && sameSnapshot(live, current))) {
    return state;
  }
  return pushVersion(root, state, live, 'Changed outside the history');
};

const checkOriginalFiles = (
  files: readonly IOriginalFile[],
): string | undefined => {
  if (files.length > MAX_ORIGINAL_FILES) {
    return `At most ${MAX_ORIGINAL_FILES} original files are kept.`;
  }
  const total = files.reduce((sum, file) => sum + file.bytes.byteLength, 0);
  if (total > MAX_ORIGINAL_BYTES) {
    return `The original files come to more than ${MAX_ORIGINAL_BYTES / 1024 / 1024} MB.`;
  }
  const names = new Set(files.map((file) => file.name.toLowerCase()));
  if (
    names.size !== files.length ||
    files.some(
      (file) =>
        !ORIGINAL_FILE_NAME.test(file.name) ||
        !(file.bytes instanceof Uint8Array),
    )
  ) {
    return 'Each original file is a plain picture, Aseprite or JSON name, once.';
  }
  return undefined;
};

/**
 * A new sheet for the animation, made current: the live pair rewritten and
 * the sheet kept in the history. The first record of an animation with no
 * history becomes its original - after the live pair it replaces, when
 * there is one, which then is the original instead.
 */
const recordNow = async (
  folder: string,
  name: string,
  png: Uint8Array,
  play: IAnimationPlay,
  how: IRecordHow,
): Promise<THistoryOutcome<IHistoryList>> => {
  if (!ANIMATION_NAME.test(name)) {
    return fail(
      'The name is lowercase letters, digits and hyphens, starting with a letter.',
    );
  }
  if (!isPng(png) || !readPlay(play)) {
    return fail(
      'The sheet is not a PNG within the bounds, or how it plays is not one an animation can.',
    );
  }
  const files = how.original ?? [];
  const filesProblem = checkOriginalFiles(files);
  if (filesProblem) {
    return fail(filesProblem);
  }
  const root = historyRoot(folder, name, true);
  if (!root) {
    return fail(
      "The project's animation-history folder is not a plain folder inside it.",
    );
  }
  const snapshot: ISnapshot = { png: Buffer.from(png), play };
  try {
    let state = readState(root);
    if (state && files.length > 0) {
      return fail(`${name} already has its original.`);
    }
    if (!state) {
      const before = await readLive(folder, name);
      const first = before ?? snapshot;
      writeVersion(root, ORIGINAL, first, before ? [] : files);
      state = {
        original: {
          label: before ? 'Before the history' : cleanLabel(how.label),
          at: Date.now(),
          files: before ? [] : files.map((file) => file.name),
        },
        versions: [],
        current: ORIGINAL,
        next: 1,
        deleted: false,
      };
      if (before) {
        state = pushVersion(root, state, snapshot, how.label);
      }
    } else {
      state = pushVersion(
        root,
        await settled(folder, name, root, state),
        snapshot,
        how.label,
      );
    }
    writeLive(folder, name, snapshot);
    writeState(root, state);
    return { ok: true, value: listOf(state) };
  } catch (error) {
    return fail(`The history could not be written: ${String(error)}`);
  }
};

export const recordSheet = (
  folder: string,
  name: string,
  png: Uint8Array,
  play: IAnimationPlay,
  how: IRecordHow,
): Promise<THistoryOutcome<IHistoryList>> =>
  serial(folder, name, () => recordNow(folder, name, png, play, how));

export type THistoryMove =
  'undo' | 'redo' | 'original' | 'delete' | 'bring-back';

const moveNow = async (
  folder: string,
  name: string,
  move: THistoryMove,
): Promise<THistoryOutcome<IHistoryList>> => {
  if (!ANIMATION_NAME.test(name)) {
    return fail('Not an animation name.', 'invalid');
  }
  let root = historyRoot(folder, name, false);
  let state = root ? readState(root) : undefined;
  if (!root || !state) {
    // An animation made before the history is deleted undoably all the
    // same: what it is now is kept as its original first.
    const live = move === 'delete' ? await readLive(folder, name) : undefined;
    root = live ? historyRoot(folder, name, true) : undefined;
    if (!live || !root) {
      return fail(`${name} has no history.`, 'missing');
    }
    try {
      writeVersion(root, ORIGINAL, live);
    } catch (error) {
      return fail(`The history could not be written: ${String(error)}`);
    }
    state = {
      original: { label: 'Before the history', at: Date.now(), files: [] },
      versions: [],
      current: ORIGINAL,
      next: 1,
      deleted: false,
    };
  }
  try {
    state = await settled(folder, name, root, state);
    if (move === 'delete') {
      await removeLive(folder, name);
      state = { ...state, deleted: true };
      writeState(root, state);
      return { ok: true, value: listOf(state) };
    }
    const ids = order(state);
    const at = ids.indexOf(state.current);
    let target: TVersionId | undefined;
    if (move === 'bring-back') {
      if (!state.deleted) {
        return fail(`${name} is not deleted.`, 'invalid');
      }
      // The name used again since the delete is somebody else's now.
      if (liveTaken(folder, name)) {
        return fail(
          `${name} has been used again since it was deleted.`,
          'taken',
        );
      }
      target = state.current;
    } else if (state.deleted) {
      return fail(`${name} was deleted; bring it back first.`, 'invalid');
    } else if (move === 'original') {
      target = ORIGINAL;
    } else {
      target = ids[move === 'undo' ? at - 1 : at + 1];
    }
    if (target === undefined) {
      return fail(
        move === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.',
        'invalid',
      );
    }
    const version = readVersionAt(root, target);
    if (!version) {
      return fail('That version cannot be read any more.');
    }
    writeLive(folder, name, version);
    state = { ...state, current: target, deleted: false };
    writeState(root, state);
    return { ok: true, value: listOf(state) };
  } catch (error) {
    return fail(`The history could not be moved: ${String(error)}`);
  }
};

/**
 * Moves the live pair through the history - undo, redo, the original, a
 * delete that keeps the history, and bringing a deleted one back - and
 * answers the list after the move.
 */
export const moveHistory = (
  folder: string,
  name: string,
  move: THistoryMove,
): Promise<THistoryOutcome<IHistoryList>> =>
  serial(folder, name, () => moveNow(folder, name, move));

const renameNow = async (
  folder: string,
  name: string,
  to: string,
): Promise<THistoryOutcome<IHistoryList | undefined>> => {
  if (!ANIMATION_NAME.test(name) || !ANIMATION_NAME.test(to) || name === to) {
    return fail('Rename takes two different animation names.', 'invalid');
  }
  if (nameTaken(folder, to)) {
    return fail(`${to} is already used.`, 'taken');
  }
  const root = historyRoot(folder, name, false);
  let state = root ? readState(root) : undefined;
  const live = await readLive(folder, name);
  if (!live && !state) {
    return fail(`There is no animation ${name}.`, 'missing');
  }
  try {
    if (root && state) {
      state = await settled(folder, name, root, state);
      writeState(root, state);
      const moved = insideFolder(folder, `${HISTORY_DIR}/${to}`);
      if (!moved) {
        return fail(
          'The animation-history folder is not a plain folder inside the project.',
        );
      }
      fs.renameSync(root, moved);
    }
    if (live && !state?.deleted) {
      writeLive(folder, to, live);
      await removeLive(folder, name);
    }
    return { ok: true, value: readHistory(folder, to) };
  } catch (error) {
    return fail(`The animation could not be renamed: ${String(error)}`);
  }
};

/**
 * Renames an animation: its picture, its file (the sheet named anew) and
 * its history move together. Refused as taken when anything stands under
 * the new name. Both names wait their turn, always in the same order, so
 * two renames crossing each other can never wait on each other for good.
 */
export const renameAnimation = (
  folder: string,
  name: string,
  to: string,
): Promise<THistoryOutcome<IHistoryList | undefined>> => {
  // One name twice would wait on itself.
  if (name === to) {
    return Promise.resolve(
      fail('Rename takes two different animation names.', 'invalid'),
    );
  }
  const [first, second] = [name, to].sort();
  return serial(folder, first, () =>
    serial(folder, second, () => renameNow(folder, name, to)),
  );
};

/** The animation's history as the member sees it; undefined when it has none. */
export const readHistory = (
  folder: string,
  name: string,
): IHistoryList | undefined => {
  const root = historyRoot(folder, name, false);
  const state = root ? readState(root) : undefined;
  return state ? listOf(state) : undefined;
};

/** One version's sheet and how it plays, the original included. */
export const readHistoryVersion = (
  folder: string,
  name: string,
  id: TVersionId,
): (ISnapshot & { files: string[] }) | undefined => {
  const root = historyRoot(folder, name, false);
  const state = root ? readState(root) : undefined;
  if (!root || !state || !order(state).includes(id)) {
    return undefined;
  }
  const version = readVersionAt(root, id);
  return version
    ? { ...version, files: id === ORIGINAL ? state.original.files : [] }
    : undefined;
};

/** One of the member's original files, as they brought it. */
export const readOriginalFile = (
  folder: string,
  name: string,
  file: string,
): Buffer | undefined => {
  const root = historyRoot(folder, name, false);
  const state = root ? readState(root) : undefined;
  if (!root || !state || !state.original.files.includes(file)) {
    return undefined;
  }
  return readPlain(
    path.join(root, ORIGINAL, 'files', file),
    MAX_ORIGINAL_BYTES,
  );
};
