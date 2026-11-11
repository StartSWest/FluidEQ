import type {
  IWorldEditHistory,
  TWorldEditFailure,
  TWorldEditOp,
  TWorldEditOutcome,
} from '../../common/sceneEdit';
import { applyWorldEdits, sameShape } from '../../common/worldEdit';
import { readProject } from './project';
import {
  isRecord,
  MANIFEST_FILE,
  MAX_MANIFEST_BYTES,
  readBounded,
  readManifest,
  resolveInside,
  writeInside,
} from './projectFiles';
import { MAX_WORLD_FILE_BYTES } from './projectWorld';
import { queueSettingsWrite } from './settingsWrites';

/**
 * What a hand does on the Studio's stage in Edit mode, written into the
 * scene's own world so it stays: a thing moved, turned, resized, renamed,
 * hidden, copied, added or deleted.
 *
 * Written where the world already is — inline in `pack.json`, or in the file
 * `worldFile` names — through the folder's own confined writer, and in the
 * same queue as the settings' saves, which write `pack.json` too.
 *
 * Never a world that will not build: the file is read back as the project is
 * read, and what was there before is put back if the edit left the scene
 * without its world or with a thing gone missing.
 *
 * Undo is this session's, kept per folder as the worlds the edits replaced.
 * It steps back only over a file that still holds what the last edit wrote:
 * once the member's AI or an editor has written the world, the steps before
 * that are about a world that is gone, and undoing one would take the newer
 * work away with it.
 */

const MAX_STEPS = 50;

interface IHistory {
  past: string[];
  future: string[];
  /** The world the last edit here left in the file, as text. */
  current: string;
}

const histories = new Map<string, IHistory>();

interface IWorldPlace {
  manifest: Record<string, unknown>;
  /** The file the world is written in beside `pack.json`, when it is. */
  file?: string;
  raw: Record<string, unknown>;
}

class EditRefused extends Error {
  constructor(readonly reason: TWorldEditFailure) {
    super(reason);
  }
}

const locate = async (folder: string): Promise<IWorldPlace> => {
  const manifest = await readManifest(folder);
  const { world, worldFile } = manifest;
  if (worldFile === undefined) {
    if (!isRecord(world)) {
      throw new EditRefused('no-world');
    }
    return { manifest, raw: world };
  }
  if (
    world !== undefined ||
    typeof worldFile !== 'string' ||
    !/\.json$/i.test(worldFile)
  ) {
    throw new EditRefused('no-world');
  }
  const real = await resolveInside(folder, worldFile, 'world');
  const bytes = await readBounded(real, MAX_WORLD_FILE_BYTES, 'world');
  const raw: unknown = JSON.parse(bytes.toString('utf8'));
  if (!isRecord(raw)) {
    throw new EditRefused('no-world');
  }
  return { manifest, file: worldFile, raw };
};

const put = async (
  folder: string,
  place: IWorldPlace,
  world: Record<string, unknown>,
): Promise<void> => {
  if (place.file !== undefined) {
    await writeInside(
      folder,
      place.file,
      'world',
      `${JSON.stringify(world, null, 2)}\n`,
    );
    return;
  }
  const text = `${JSON.stringify({ ...place.manifest, world }, null, 2)}\n`;
  if (Buffer.byteLength(text) > MAX_MANIFEST_BYTES) {
    throw new EditRefused('refused');
  }
  await writeInside(folder, MANIFEST_FILE, 'pack.json', text);
};

/** Whether the project builds with every thing of `raw` in its place. */
const builds = async (
  folder: string,
  raw: Record<string, unknown>,
): Promise<boolean> => {
  const build = await readProject(folder);
  return (
    build.ok &&
    build.pack.world !== undefined &&
    sameShape(raw.nodes, build.pack.world.nodes)
  );
};

const flags = (history: IHistory | undefined): IWorldEditHistory => ({
  canUndo: (history?.past.length ?? 0) > 0,
  canRedo: (history?.future.length ?? 0) > 0,
});

/** The folder's steps, forgotten when the file is no longer what they left. */
const stepsFor = (folder: string, now: string): IHistory => {
  const known = histories.get(folder);
  if (known && known.current === now) {
    return known;
  }
  const fresh: IHistory = { past: [], future: [], current: now };
  histories.set(folder, fresh);
  return fresh;
};

/** `work` in the folder's write queue, with its outcome brought back. */
const queued = async (
  folder: string,
  work: () => Promise<TWorldEditOutcome>,
): Promise<TWorldEditOutcome> => {
  let outcome: TWorldEditOutcome = {
    ok: false,
    reason: 'failed',
    history: flags(histories.get(folder)),
  };
  await queueSettingsWrite(folder, async () => {
    try {
      outcome = await work();
    } catch (error) {
      outcome = {
        ok: false,
        reason: error instanceof EditRefused ? error.reason : 'failed',
        history: flags(histories.get(folder)),
      };
    }
    return outcome.ok ? 'written' : 'failed';
  });
  return outcome;
};

/** Writes `next` in place of the world there, or puts the old one back. */
const replace = async (
  folder: string,
  place: IWorldPlace,
  next: Record<string, unknown>,
): Promise<void> => {
  await put(folder, place, next);
  if (!(await builds(folder, next))) {
    await put(folder, place, place.raw);
    throw new EditRefused('refused');
  }
};

export const editProjectWorld = (
  folder: string,
  ops: readonly TWorldEditOp[],
): Promise<TWorldEditOutcome> =>
  queued(folder, async () => {
    const place = await locate(folder);
    // Paths are counted on the world as drawn: every thing the file writes
    // has to be one the reader kept, or they name different things.
    if (!(await builds(folder, place.raw))) {
      throw new EditRefused('mismatch');
    }
    const edited = applyWorldEdits(place.raw, ops);
    if (!edited.ok) {
      throw new EditRefused(edited.reason);
    }
    const before = JSON.stringify(place.raw);
    const after = JSON.stringify(edited.world);
    const history = stepsFor(folder, before);
    if (after === before) {
      return { ok: true, changed: false, history: flags(history) };
    }
    await replace(folder, place, edited.world);
    history.past = [...history.past, before].slice(-MAX_STEPS);
    history.future = [];
    history.current = after;
    return { ok: true, changed: true, history: flags(history) };
  });

export const stepProjectWorld = (
  folder: string,
  direction: 'undo' | 'redo',
): Promise<TWorldEditOutcome> =>
  queued(folder, async () => {
    const place = await locate(folder);
    const now = JSON.stringify(place.raw);
    const history = stepsFor(folder, now);
    const from = direction === 'undo' ? history.past : history.future;
    const target = from[from.length - 1];
    if (target === undefined) {
      throw new EditRefused('missing');
    }
    await replace(folder, place, JSON.parse(target) as Record<string, unknown>);
    if (direction === 'undo') {
      history.past = history.past.slice(0, -1);
      history.future = [...history.future, now];
    } else {
      history.future = history.future.slice(0, -1);
      history.past = [...history.past, now];
    }
    history.current = target;
    return { ok: true, changed: true, history: flags(history) };
  });

/** What may be undone and redone, against the world in the file now. */
export const projectWorldHistory = async (
  folder: string,
): Promise<IWorldEditHistory> => {
  try {
    const place = await locate(folder);
    return flags(stepsFor(folder, JSON.stringify(place.raw)));
  } catch {
    return { canUndo: false, canRedo: false };
  }
};
