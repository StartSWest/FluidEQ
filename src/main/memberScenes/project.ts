import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  checkMemberScene,
  checkProjectParams,
  MAX_MEMBER_NAME_LENGTH,
  sanitizeDisplayText,
  type IMemberSceneProblem,
} from '../../common/memberScenes';
import { MAX_MEMBER_SOURCE_BYTES } from '../../common/memberSceneRules';
import { isWholeSceneAmbient } from '../../common/sceneAmbient';
import { MAX_SCENE_ARTWORK_BYTES } from '../../common/sceneArtwork';
import {
  SCENE_PACK_SCHEMA,
  type IScenePack,
  type TLocalizedName,
} from '../../common/scenePacks';
import {
  MANIFEST_FILE,
  ProjectProblem,
  readBounded,
  readManifest,
  resolveInside,
  writeInside,
} from './projectFiles';
import readProjectWorld from './projectWorld';
import { STARTER_SOURCE, starterManifest } from './starterScene';
import { waitForSettingsWrites } from './settingsWrites';

/**
 * A member's project folder, turned into a scene pack — the job
 * `tools/publish.mjs` does for official packs, done by the app on the
 * member's own machine, with nothing prepended: members do not get the
 * private helper file the official scenes are built with.
 *
 * The folder is read as a stranger's (`projectFiles.ts`): only `pack.json`
 * and the files it names are ever opened — the source, the artwork, and a
 * world's own files (`projectWorld.ts`) — each a plain name inside the
 * folder, and bounded before a byte is read.
 */

const DEFAULT_SOURCE_FILE = 'scene.frag';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type TProjectBuild =
  | {
      ok: true;
      pack: IScenePack;
      /** SHA-256 of the artwork bytes, so an unchanged picture is not decoded twice. */
      artworkHash?: string;
    }
  | { ok: false; problems: IMemberSceneProblem[] };

/** The file the manifest names as the scene's source, and where it really is. */
const locateSource = async (
  folder: string,
  manifest: Record<string, unknown>,
) => {
  const name =
    typeof manifest.sourceFile === 'string'
      ? manifest.sourceFile
      : DEFAULT_SOURCE_FILE;
  return { name, real: await resolveInside(folder, name, 'source') };
};

const buildRawPack = async (folder: string) => {
  const manifest = await readManifest(folder);
  const { real: sourcePath } = await locateSource(folder, manifest);
  const source = (
    await readBounded(sourcePath, MAX_MEMBER_SOURCE_BYTES, 'source')
  ).toString('utf8');
  const world = await readProjectWorld(folder, manifest);

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
      ...(manifest.response === undefined
        ? {}
        : { response: manifest.response }),
      // The wave the author framed the scene in travels with it, like the
      // response: without this the Studio saved it into pack.json and read
      // back a pack that had never heard of it, and a published scene stood
      // in whatever room the listener's own wave made.
      ...(manifest.wave === undefined ? {} : { wave: manifest.wave }),
      ...(manifest.ambient === undefined ? {} : { ambient: manifest.ambient }),
      ...(world === undefined ? {} : { world }),
      // How far the viewer may turn a 3D scene; checked and kept in range by
      // the pack's own reader, like the wave above.
      ...(manifest.camera === undefined ? {} : { camera: manifest.camera }),
    },
    artworkHash,
  };
};

/**
 * The artwork's size as pack.json declares it. The pack check holds the
 * picture to it; the ambient check only needs to know what a pose can cut.
 */
const declaredSize = (artwork: Record<string, unknown> | undefined) =>
  artwork &&
  typeof artwork.width === 'number' &&
  typeof artwork.height === 'number'
    ? { width: artwork.width, height: artwork.height }
    : undefined;

/** The folder as a pack, or every reason it is not one yet. Never throws. */
export const readProject = async (folder: string): Promise<TProjectBuild> => {
  try {
    await waitForSettingsWrites(folder);
    const { raw, artworkHash } = await buildRawPack(folder);
    const checked = checkMemberScene(raw);
    const controls = [
      ...checkProjectParams(raw.params),
      ...(isWholeSceneAmbient(raw.ambient, declaredSize(raw.artwork))
        ? []
        : (['bad-ambient'] as const)),
    ].map((code): IMemberSceneProblem => ({ code, file: 'pack.json' }));
    if (!checked.ok || controls.length > 0) {
      return {
        ok: false,
        problems: [...controls, ...(checked.ok ? [] : checked.problems)],
      };
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

export interface IProjectSource {
  /** The source file's name inside the folder, for display. */
  file: string;
  text: string;
}

/**
 * The open project's scene source as text, for the Studio's code pane —
 * found and bounded exactly as a build finds it, so the pane can never show
 * a file the build would not read. Undefined when there is no such file yet.
 */
export const readProjectSource = async (
  folder: string,
): Promise<IProjectSource | undefined> => {
  try {
    const { name, real } = await locateSource(
      folder,
      await readManifest(folder),
    );
    const text = (
      await readBounded(real, MAX_MEMBER_SOURCE_BYTES, 'source')
    ).toString('utf8');
    return { file: name, text };
  } catch {
    return undefined;
  }
};

export type TSourceWrite = 'written' | 'too-large' | 'failed';

/**
 * Saves the code pane's text over the project's scene source: the same file
 * `readProjectSource` shows, never a path the page names. The watcher on the
 * folder then rebuilds the stage from it, as it does for any editor's save.
 */
export const writeProjectSource = async (
  folder: string,
  text: string,
): Promise<TSourceWrite> => {
  if (Buffer.byteLength(text, 'utf8') > MAX_MEMBER_SOURCE_BYTES) {
    return 'too-large';
  }
  try {
    const { name } = await locateSource(folder, await readManifest(folder));
    await writeInside(folder, name, 'source', text);
    return 'written';
  } catch {
    return 'failed';
  }
};

/**
 * What a project calls its scene, for the Studio's list of projects, read
 * from `pack.json` alone — the list names folders that are not open, and
 * building each one to learn its name would compile nothing for nobody.
 * Cleaned the way every name on screen is; nothing when there is no English
 * name to fall back on.
 */
export const readProjectNames = async (
  folder: string,
): Promise<TLocalizedName | undefined> => {
  try {
    const { names } = await readManifest(folder);
    if (!isRecord(names)) {
      return undefined;
    }
    const cleaned: Record<string, string> = {};
    Object.entries(names).forEach(([locale, raw]) => {
      const name = sanitizeDisplayText(raw);
      if (/^[a-z]{2}$/.test(locale) && name) {
        cleaned[locale] = name.slice(0, MAX_MEMBER_NAME_LENGTH);
      }
    });
    return cleaned.en ? (cleaned as TLocalizedName) : undefined;
  } catch {
    return undefined;
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
 * Writes the starter project into `folder`, its scene named for the project
 * (see `projectFolders.ts`), or reports that one is there.
 *
 * Both files are created exclusively (`wx`), so even a file that appears
 * between the check and the write is never overwritten: somebody's work is
 * worth more than a starter.
 */
export const writeStarterProject = async (
  folder: string,
  named: { name: string; id: string },
): Promise<'written' | 'exists'> => {
  const manifestPath = path.join(folder, MANIFEST_FILE);
  const sourcePath = path.join(folder, DEFAULT_SOURCE_FILE);
  if ((await exists(manifestPath)) || (await exists(sourcePath))) {
    return 'exists';
  }
  const manifest = starterManifest(named.name, named.id);
  try {
    await fs.promises.writeFile(sourcePath, STARTER_SOURCE, { flag: 'wx' });
    await fs.promises.writeFile(manifestPath, manifest, { flag: 'wx' });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return 'exists';
    }
    throw error;
  }
  return 'written';
};
