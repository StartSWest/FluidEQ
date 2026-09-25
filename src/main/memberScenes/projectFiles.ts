import fs from 'fs';
import path from 'path';
import type {
  TMemberProblemCode,
  TMemberSceneFile,
} from '../../common/memberScenes';

/**
 * Every file a project folder hands the Studio, found and bounded before a
 * byte of it is read.
 *
 * The folder is the member's, but the files in it came from wherever their AI
 * or a forum post put them, so it is read as a stranger's. Only `pack.json`
 * and the names it declares are ever opened, and each name must be a plain
 * file name that resolves, links followed, to a file inside the folder.
 */

export const MANIFEST_FILE = 'pack.json';
export const MAX_MANIFEST_BYTES = 64 * 1024;
const PLAIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export class ProjectProblem extends Error {
  constructor(
    readonly code: TMemberProblemCode,
    readonly file: TMemberSceneFile,
  ) {
    super(code);
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What each file `pack.json` names must be called. The Studio writes over
 * the source from its code pane and over the artwork from its Pictures card,
 * so a name is also a promise about what may be overwritten: a folder from
 * anywhere once named `thesis.docx` as its artwork, and the next picture
 * saved replaced that file with a WebP.
 */
const FILE_KINDS: Record<TMemberSceneFile, RegExp> = {
  'pack.json': /^pack\.json$/,
  source: /\.(?:frag|glsl)$/i,
  artwork: /\.webp$/i,
  world: /\.(?:frag|vert|glsl|glb|json)$/i,
};

/** A name `pack.json` may give a file: plain, in this folder, never a path. */
export const isPlainFileName = (name: string, file: TMemberSceneFile) =>
  PLAIN_NAME.test(name) && !name.includes('..') && FILE_KINDS[file].test(name);

/**
 * The real path of a file the manifest names, or a problem.
 *
 * `..` and separators are refused by the name pattern before the filesystem
 * is asked anything; the real-path comparison then catches the one route the
 * pattern cannot see — a plain name that is itself a link out of the folder.
 */
export const resolveInside = async (
  folder: string,
  name: string,
  file: TMemberSceneFile,
): Promise<string> => {
  if (!isPlainFileName(name, file)) {
    throw new ProjectProblem('unsafe-path', file);
  }
  let real: string;
  try {
    real = await fs.promises.realpath(path.join(folder, name));
  } catch {
    throw new ProjectProblem('missing-file', file);
  }
  const home = await fs.promises.realpath(folder);
  const relative = path.relative(home, real);
  if (
    relative === '' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
  ) {
    throw new ProjectProblem('unsafe-path', file);
  }
  const stats = await fs.promises.stat(real);
  if (!stats.isFile() || path.dirname(real) !== home) {
    throw new ProjectProblem('unsafe-path', file);
  }
  return real;
};

/**
 * Writes a file in the project folder through one handle proven to be the
 * file that was checked: created fresh when nothing has the name (so nothing
 * can be followed), otherwise opened only when it is still the plain file
 * `resolveInside` found and has no second name. Written by path after a
 * check instead, a link swapped in between them, or a hard link to a file
 * outside the folder, carried the write out of the folder.
 */
export const writeInside = async (
  folder: string,
  name: string,
  file: TMemberSceneFile,
  data: string | Uint8Array,
): Promise<void> => {
  let handle: fs.promises.FileHandle;
  try {
    handle = await fs.promises.open(path.join(folder, name), 'wx');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
    const real = await resolveInside(folder, name, file);
    const checked = await fs.promises.lstat(real, { bigint: true });
    handle = await fs.promises.open(real, 'r+');
    const opened = await handle.stat({ bigint: true });
    if (
      !checked.isFile() ||
      opened.ino !== checked.ino ||
      opened.dev !== checked.dev ||
      opened.nlink !== BigInt(1)
    ) {
      await handle.close();
      throw new ProjectProblem('unsafe-path', file);
    }
    await handle.truncate(0);
  }
  try {
    await handle.writeFile(data);
  } finally {
    await handle.close();
  }
};

export const readBounded = async (
  real: string,
  limit: number,
  file: TMemberSceneFile,
): Promise<Buffer> => {
  const stats = await fs.promises.stat(real);
  if (stats.size > limit) {
    throw new ProjectProblem('file-too-large', file);
  }
  return fs.promises.readFile(real);
};

export const readManifest = async (
  folder: string,
): Promise<Record<string, unknown>> => {
  let real: string;
  try {
    real = await fs.promises.realpath(path.join(folder, MANIFEST_FILE));
  } catch {
    throw new ProjectProblem('missing-file', 'pack.json');
  }
  if (path.dirname(real) !== (await fs.promises.realpath(folder))) {
    throw new ProjectProblem('unsafe-path', 'pack.json');
  }
  const bytes = await readBounded(real, MAX_MANIFEST_BYTES, 'pack.json');
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ProjectProblem('bad-json', 'pack.json');
  }
  if (!isRecord(parsed)) {
    throw new ProjectProblem('bad-json', 'pack.json');
  }
  return parsed;
};
