import fs from 'fs';
import path from 'path';
import { MANIFEST_FILE, readManifest, writeInside } from './project';
import { folderNameFor } from './projectFolders';
import type { TSettingsWrite } from './projectSettings';
import { queueSettingsWrite, waitForSettingsWrites } from './settingsWrites';
import { sameFolder } from './studioProjects';

/**
 * A Studio project renamed: its folder, where it already is, and the name its
 * scene goes by in `pack.json`, both from one name the member typed.
 *
 * The caller lets go of the folder first — closes its watcher and waits for
 * the build in progress — so nothing reads the scene under its old path while
 * it moves: a watcher reads the move as the folder being gone, and the stage
 * said the scene's files were missing until it opened again. The watcher
 * alone does not stop Windows renaming the folder (measured); a program
 * holding one of its files does, and that is the failure the member is told
 * about. Saves of the project's settings are waited for here, so none lands
 * in a folder that has just moved.
 *
 * The scene's id is never touched: the copy in the member's looks, and
 * anything they published from it, are still this scene afterwards.
 */

export type TProjectRename =
  | { ok: true; folder: string }
  | { ok: false; reason: 'invalid' | 'exists' | 'failed' };

const exists = (target: string) =>
  fs.promises.lstat(target).then(
    () => true,
    () => false,
  );

/** The scene's names, all of them, replaced by `name`. */
const renameScene = (folder: string, name: string): Promise<TSettingsWrite> =>
  queueSettingsWrite(folder, async () => {
    let manifest: Record<string, unknown>;
    try {
      manifest = await readManifest(folder);
    } catch {
      // A manifest that does not read keeps what it has; the folder is renamed
      // all the same, and the Studio names the project by its folder.
      return 'failed';
    }
    // Every language at once: a name left behind in one would still show the
    // old name to anyone using FluidEQ in it.
    manifest.names = { en: name };
    try {
      await writeInside(
        folder,
        MANIFEST_FILE,
        'pack.json',
        `${JSON.stringify(manifest, null, 2)}\n`,
      );
      return 'written';
    } catch {
      return 'failed';
    }
  });

export const renameProjectFolder = async (
  folder: string,
  name: string,
): Promise<TProjectRename> => {
  const folderName = folderNameFor(name);
  if (!folderName) {
    return { ok: false, reason: 'invalid' };
  }
  const parent = path.dirname(folder);
  const target = path.join(parent, folderName);
  if (path.dirname(target) !== parent) {
    return { ok: false, reason: 'invalid' };
  }
  await waitForSettingsWrites(folder);
  if (target !== folder) {
    // Only the case of a letter changed is the same folder on Windows and
    // macOS, and is renamed all the same; any other folder there is refused.
    if (!sameFolder(target, folder) && (await exists(target))) {
      return { ok: false, reason: 'exists' };
    }
    try {
      await fs.promises.rename(folder, target);
    } catch {
      return { ok: false, reason: 'failed' };
    }
  }
  await renameScene(target, folderName);
  return { ok: true, folder: target };
};
