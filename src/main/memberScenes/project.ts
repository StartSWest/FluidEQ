import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  checkMemberScene,
  type IMemberSceneProblem,
  type TMemberProblemCode,
  type TMemberSceneFile,
} from '../../common/memberScenes';
import { MAX_MEMBER_SOURCE_BYTES } from '../../common/memberSceneRules';
import { MAX_SCENE_ARTWORK_BYTES } from '../../common/sceneArtwork';
import { SCENE_PACK_SCHEMA, type IScenePack } from '../../common/scenePacks';
import { STARTER_MANIFEST, STARTER_SOURCE } from './starterScene';

/**
 * A member's project folder, turned into a scene pack — the job
 * `tools/publish.mjs` does for official packs, done by the app on the
 * member's own machine, with nothing prepended: members do not get the
 * private helper file the official scenes are built with.
 *
 * The folder is the member's, but the files in it came from wherever their AI
 * or a forum post put them, so it is read as a stranger's. Only three files
 * are ever opened — `pack.json` and the two names it declares — and each
 * name must be a plain file name that resolves, links followed, to a file
 * inside the folder. Sizes are checked before a byte is read.
 */

export const MANIFEST_FILE = 'pack.json';
export const MAX_MANIFEST_BYTES = 64 * 1024;
const DEFAULT_SOURCE_FILE = 'scene.frag';
const PLAIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export type TProjectBuild =
  | {
      ok: true;
      pack: IScenePack;
      /** SHA-256 of the artwork bytes, so an unchanged picture is not decoded twice. */
      artworkHash?: string;
    }
  | { ok: false; problems: IMemberSceneProblem[] };

class ProjectProblem extends Error {
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
 * The real path of a file the manifest names, or a problem.
 *
 * `..` and separators are refused by the name pattern before the filesystem
 * is asked anything; the real-path comparison then catches the one route the
 * pattern cannot see — a plain name that is itself a link out of the folder.
 */
const resolveInside = async (
  folder: string,
  name: string,
  file: TMemberSceneFile,
): Promise<string> => {
  if (!PLAIN_NAME.test(name) || name.includes('..')) {
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

const readBounded = async (
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

const readManifest = async (
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

const buildRawPack = async (folder: string) => {
  const manifest = await readManifest(folder);
  const sourceName =
    typeof manifest.sourceFile === 'string'
      ? manifest.sourceFile
      : DEFAULT_SOURCE_FILE;
  const sourcePath = await resolveInside(folder, sourceName, 'source');
  const source = (
    await readBounded(sourcePath, MAX_MEMBER_SOURCE_BYTES, 'source')
  ).toString('utf8');

  let artwork: Record<string, unknown> | undefined;
  let artworkHash: string | undefined;
  if (manifest.artworkFile !== undefined) {
    if (typeof manifest.artworkFile !== 'string') {
      throw new ProjectProblem('unsafe-path', 'artwork');
    }
    const artworkPath = await resolveInside(
      folder,
      manifest.artworkFile,
      'artwork',
    );
    const bytes = await readBounded(
      artworkPath,
      MAX_SCENE_ARTWORK_BYTES,
      'artwork',
    );
    artwork = {
      mime: 'image/webp',
      width: manifest.artworkWidth,
      height: manifest.artworkHeight,
      data: bytes.toString('base64'),
    };
    artworkHash = createHash('sha256').update(bytes).digest('hex');
  }

  return {
    raw: {
      schema: SCENE_PACK_SCHEMA,
      id: manifest.id,
      version: manifest.version,
      contract: manifest.contract,
      names: manifest.names,
      fallbackStyle: manifest.fallbackStyle,
      swatch: manifest.swatch,
      source,
      params: manifest.params ?? [],
      ...(artwork ? { artwork } : {}),
      ...(manifest.spectrumRange === undefined
        ? {}
        : { spectrumRange: manifest.spectrumRange }),
    },
    artworkHash,
  };
};

/** The folder as a pack, or every reason it is not one yet. Never throws. */
export const readProject = async (folder: string): Promise<TProjectBuild> => {
  try {
    const { raw, artworkHash } = await buildRawPack(folder);
    const checked = checkMemberScene(raw);
    if (!checked.ok) {
      return checked;
    }
    return artworkHash
      ? { ok: true, pack: checked.pack, artworkHash }
      : { ok: true, pack: checked.pack };
  } catch (error) {
    if (error instanceof ProjectProblem) {
      return { ok: false, problems: [{ code: error.code, file: error.file }] };
    }
    // A folder that vanished or a file locked mid-save reads as missing: the
    // next save rebuilds it, and there is nothing more specific to say.
    return {
      ok: false,
      problems: [{ code: 'missing-file', file: 'pack.json' }],
    };
  }
};

const exists = async (target: string) => {
  try {
    await fs.promises.access(target);
    return true;
  } catch {
    return false;
  }
};

/**
 * Writes the starter project into `folder`, or reports that one is there.
 *
 * Both files are created exclusively (`wx`), so even a file that appears
 * between the check and the write is never overwritten: somebody's work is
 * worth more than a starter.
 */
export const writeStarterProject = async (
  folder: string,
): Promise<'written' | 'exists'> => {
  const manifestPath = path.join(folder, MANIFEST_FILE);
  const sourcePath = path.join(folder, DEFAULT_SOURCE_FILE);
  if ((await exists(manifestPath)) || (await exists(sourcePath))) {
    return 'exists';
  }
  try {
    await fs.promises.writeFile(sourcePath, STARTER_SOURCE, { flag: 'wx' });
    await fs.promises.writeFile(manifestPath, STARTER_MANIFEST, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return 'exists';
    }
    throw error;
  }
  return 'written';
};
