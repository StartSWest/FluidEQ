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
  boundedDraft,
  MANIFEST_FILE,
  ProjectProblem,
  readBounded,
  readManifest,
  resolveInside,
  type TProjectDrafts,
} from './projectFiles';
import readProjectWorld from './projectWorld';
import { writeStarterArt } from './starterArt';
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

const NO_DRAFTS: TProjectDrafts = new Map();

const buildRawPack = async (folder: string, drafts = NO_DRAFTS) => {
  const manifest = await readManifest(folder);
  const { name: sourceName, real: sourcePath } = await locateSource(
    folder,
    manifest,
  );
  const drafted = drafts.get(sourceName);
  const source =
    drafted === undefined
      ? (
          await readBounded(sourcePath, MAX_MEMBER_SOURCE_BYTES, 'source')
        ).toString('utf8')
      : boundedDraft(drafted, MAX_MEMBER_SOURCE_BYTES, 'source').toString(
          'utf8',
        );
  const world = await readProjectWorld(folder, manifest, drafts);

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
      ...(manifest.framing === undefined ? {} : { framing: manifest.framing }),
      ...(manifest.pointer === undefined ? {} : { pointer: manifest.pointer }),
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

/**
 * The folder as a pack, read at once, for a caller that is itself one of the
 * folder's queued saves (`settingsWrites.ts`).
 *
 * `readProject` waits for every save queued for the folder, so that it
 * never reads a manifest a save is about to change. A save that reads the
 * project back to check its own work is one of those saves: waiting for
 * the queue there is waiting for itself. Edit mode's Save did exactly that
 * (`worldEdits.ts`), never answered, and held the folder's queue for good -
 * no later save of the scene's sliders ran, and no read of the project came
 * back. Inside the queue nothing else is writing, which is all the wait is
 * for.
 */
export const readProjectInsideSave = async (
  folder: string,
  drafts = NO_DRAFTS,
): Promise<TProjectBuild> => {
  try {
    const { raw, artworkHash } = await buildRawPack(folder, drafts);
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

/**
 * The folder as a pack, or every reason it is not one yet. Never throws.
 * With `drafts`, the folder as it would be with that unsaved text saved.
 */
export const readProject = async (
  folder: string,
  drafts = NO_DRAFTS,
): Promise<TProjectBuild> => {
  await waitForSettingsWrites(folder);
  return readProjectInsideSave(folder, drafts);
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
      if (/^(?:[a-z]{2}|zh-Hant)$/.test(locale) && name) {
        cleaned[locale] = name.slice(0, MAX_MEMBER_NAME_LENGTH);
      }
    });
    return cleaned.en ? (cleaned as TLocalizedName) : undefined;
  } catch {
    return undefined;
  }
};

/** A scene id as the gallery and the review know it (`parseSubmissionRow`). */
const SCENE_ID = /^[a-z][a-z0-9-]{1,47}$/;

/**
 * The scene id its `pack.json` names, for where the review stands with it
 * (`sceneReviewStanding.ts`): known on every computer the folder is on,
 * where a publication's record is only known on the one that published.
 */
export const readProjectSceneId = async (
  folder: string,
): Promise<string | undefined> => {
  try {
    const { id } = await readManifest(folder);
    return typeof id === 'string' && SCENE_ID.test(id) ? id : undefined;
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
 * Every file is created exclusively (`wx`), so even a file that appears
 * between the check and the write is never overwritten: somebody's work is
 * worth more than a starter. That includes the starter's picture, sheet and
 * animation file (`starterArt.ts`).
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
  // The picture and the animation first, so the scene that names them never
  // plays without them.
  await writeStarterArt(folder);
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
