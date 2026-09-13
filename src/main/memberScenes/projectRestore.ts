import fs from 'fs';
import path from 'path';
import { MAX_MEMBER_NAME_LENGTH } from '../../common/memberScenes';
import type { IScenePack } from '../../common/scenePacks';
import { folderNameFor } from './projectFolders';
import { MANIFEST_FILE, readManifest } from './project';

/**
 * A member's own scene, from a file they exported, made a Studio project
 * again.
 *
 * Importing your own file used to stop at your looks: it played, but the
 * Studio only edits, publishes and exports a project folder, so on a new
 * computer the work could no longer be changed or shared. This writes the
 * scene back out as the folder a build of it reads the same pack from.
 *
 * What the file never carried stays lost: the comments the server strips from
 * the code, the project's notes, the original photos behind its picture and
 * where each one sits in it. The picture itself comes back whole.
 */

export const RESTORED_SOURCE_FILE = 'scene.frag';
export const RESTORED_ARTWORK_FILE = 'artwork.webp';

/** Folders tried after the plain name: "Alpine 2" up to "Alpine 99". */
const MAX_NAME_SUFFIX = 99;

export type TRestoreOutcome =
  { ok: true; folder: string } | { ok: false; reason: 'invalid' | 'taken' };

/** The `pack.json` a build of the folder turns back into `pack`. */
export const restoredManifest = (pack: IScenePack) =>
  `${JSON.stringify(
    {
      id: pack.id,
      version: pack.version,
      contract: pack.contract,
      names: pack.names,
      fallbackStyle: pack.fallbackStyle,
      swatch: pack.swatch,
      sourceFile: RESTORED_SOURCE_FILE,
      params: pack.params,
      ...(pack.artwork
        ? {
            artworkFile: RESTORED_ARTWORK_FILE,
            artworkWidth: pack.artwork.width,
            artworkHeight: pack.artwork.height,
          }
        : {}),
      ...(pack.spectrumRange ? { spectrumRange: pack.spectrumRange } : {}),
      ...(pack.response ? { response: pack.response } : {}),
    },
    null,
    2,
  )}\n`;

/**
 * Whichever of `folders` already holds the scene `packId`, by the id its own
 * `pack.json` gives. A folder that cannot be read holds nothing.
 */
export const folderHoldingScene = async (
  folders: readonly string[],
  packId: string,
): Promise<string | undefined> => {
  const ids = await Promise.all(
    folders.map((folder) =>
      readManifest(folder).then(
        (manifest) => manifest.id,
        () => undefined,
      ),
    ),
  );
  return folders[ids.indexOf(packId)];
};

/**
 * A new, empty folder in `root` named for the scene: the name itself, or the
 * first of "Name 2", "Name 3"… that nothing is using. An existing folder is
 * never written into, however it came to share the name.
 */
const freshFolder = async (
  root: string,
  name: string,
): Promise<TRestoreOutcome> => {
  const base = folderNameFor(name);
  if (!base) {
    return { ok: false, reason: 'invalid' };
  }
  await fs.promises.mkdir(root, { recursive: true });
  for (let suffix = 1; suffix <= MAX_NAME_SUFFIX; suffix += 1) {
    const tail = suffix === 1 ? '' : ` ${suffix}`;
    const folderName = `${base.slice(0, MAX_MEMBER_NAME_LENGTH - tail.length).trimEnd()}${tail}`;
    const folder = path.join(root, folderName);
    if (path.dirname(folder) !== path.normalize(root)) {
      return { ok: false, reason: 'invalid' };
    }
    try {
      // Not recursive: this is what refuses a folder that already exists.
      await fs.promises.mkdir(folder);
      return { ok: true, folder };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }
  return { ok: false, reason: 'taken' };
};

/**
 * Writes `pack` into a new folder in `root`, named `name`. Every file is
 * created exclusively, into a folder made for it a moment before. A disk that
 * refuses a write throws, for the caller to report.
 */
export const writeRestoredProject = async (
  root: string,
  name: string,
  pack: IScenePack,
): Promise<TRestoreOutcome> => {
  const made = await freshFolder(root, name);
  if (!made.ok) {
    return made;
  }
  const write = (file: string, data: string | Buffer) =>
    fs.promises.writeFile(path.join(made.folder, file), data, { flag: 'wx' });
  await write(RESTORED_SOURCE_FILE, pack.source);
  if (pack.artwork) {
    await write(
      RESTORED_ARTWORK_FILE,
      Buffer.from(pack.artwork.data, 'base64'),
    );
  }
  // The manifest last: a folder without one is not a project yet, so an
  // interrupted restore never passes for a finished one.
  await write(MANIFEST_FILE, restoredManifest(pack));
  return made;
};
