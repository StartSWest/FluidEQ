import type {
  TWorldEditFailure,
  TWorldEditOp,
  TWorldEditOutcome,
} from '../../common/sceneEdit';
import { applyWorldEdits, sameShape } from '../../common/worldEdit';
import { readProjectInsideSave } from './project';
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
 * What the member did by hand on the Studio's stage in Edit mode, written
 * into the scene's own world when they press Save: things moved, turned,
 * resized, renamed, hidden, copied, added or deleted.
 *
 * One save is every change since the last, applied in order to the world as
 * its file has it and written once (Ivan, 2026-11-10: "cannot auto save like
 * that"). Until then the changes live in the window alone, where Undo and
 * Discard are (`renderer/studio/edit/stageEditStore.ts`).
 *
 * Written where the world already is — inline in `pack.json`, or in the file
 * `worldFile` names — through the folder's own confined writer, and in the
 * same queue as the settings' saves, which write `pack.json` too.
 *
 * Never a world that will not build: the file is read back as the project is
 * read, and what was there before is put back if the save left the scene
 * without its world or with a thing gone missing.
 */

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

/**
 * Whether the project builds with every thing of `raw` in its place.
 *
 * Read without waiting on the folder's queue: this runs inside it
 * (`editProjectWorld`), and `readProject` there waited for the save it was
 * part of.
 */
const builds = async (
  folder: string,
  raw: Record<string, unknown>,
): Promise<boolean> => {
  const build = await readProjectInsideSave(folder);
  return (
    build.ok &&
    build.pack.world !== undefined &&
    sameShape(raw.nodes, build.pack.world.nodes)
  );
};

const save = async (
  folder: string,
  ops: readonly TWorldEditOp[],
): Promise<TWorldEditOutcome> => {
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
  if (JSON.stringify(edited.world) === JSON.stringify(place.raw)) {
    return { ok: true, changed: false };
  }
  await put(folder, place, edited.world);
  if (!(await builds(folder, edited.world))) {
    await put(folder, place, place.raw);
    throw new EditRefused('refused');
  }
  return { ok: true, changed: true };
};

export const editProjectWorld = async (
  folder: string,
  ops: readonly TWorldEditOp[],
): Promise<TWorldEditOutcome> => {
  let outcome: TWorldEditOutcome = { ok: false, reason: 'failed' };
  await queueSettingsWrite(folder, async () => {
    try {
      outcome = await save(folder, ops);
    } catch (error) {
      outcome = {
        ok: false,
        reason: error instanceof EditRefused ? error.reason : 'failed',
      };
    }
    return outcome.ok ? 'written' : 'failed';
  });
  return outcome;
};
