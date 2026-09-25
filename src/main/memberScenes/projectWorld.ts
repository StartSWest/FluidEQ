import { WORLD_LIMITS } from '../../common/sceneWorld';
import isSelfContainedModel from '../../common/worldModelCheck';
import { ProjectProblem, readBounded, resolveInside } from './projectFiles';

/**
 * A project's 3D world, read the way the rest of the folder is.
 *
 * `pack.json` holds it inline as `world`, or names a JSON file beside it as
 * `worldFile`. The file is what a scene written out by the Studio carries: a
 * manifest is bounded at 64 KB, and a world of a few hundred nodes, or one
 * with a model inside it, is past that before it is interesting. Naming both
 * is refused rather than one picked, since either choice would build a scene
 * the author was not looking at.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * A world written whole: every model inline as base64 (4 bytes for 3), both
 * hooks of every material, and a megabyte for the nodes around them.
 */
const MAX_WORLD_FILE_BYTES =
  Math.ceil((WORLD_LIMITS.modelBytes * 4) / 3) +
  WORLD_LIMITS.materials * 2 * WORLD_LIMITS.hookBytes +
  1024 * 1024;

/**
 * The world with the files it names read in: a material's `vertexFile` and
 * `fragmentFile` become its GLSL, a model's `file` its bytes. Each is found
 * the way the source is — a plain name, in this folder — and bounded before
 * it is read, so a world is as safe to build from a stranger's folder as the
 * rest of the project.
 *
 * Bounded as a whole too, by the reader's own limits, BEFORE anything is
 * read: each file alone was, but a world naming ten thousand materials, or
 * a hundred models of eight megabytes, was read into memory in full and
 * only then cut down to what the reader keeps. Only as many materials and
 * models are opened as the reader could keep, their GLSL and models count
 * against the world's totals, and a model is refused as soon as it is not
 * one the app draws — written inline or in a file alike.
 */
const readWorldFiles = async (
  folder: string,
  world: unknown,
): Promise<unknown> => {
  if (!isRecord(world)) {
    return world;
  }
  const materials: Record<string, unknown> = {};
  const models: Record<string, unknown> = {};
  const read = async (name: unknown, limit: number) => {
    if (typeof name !== 'string') {
      throw new ProjectProblem('unsafe-path', 'world');
    }
    const real = await resolveInside(folder, name, 'world');
    return readBounded(real, limit, 'world');
  };
  let hookBytes: number = WORLD_LIMITS.hookTotalBytes;
  const readHook = async (name: unknown) => {
    const bytes = await read(name, Math.min(WORLD_LIMITS.hookBytes, hookBytes));
    hookBytes -= bytes.byteLength;
    return bytes.toString('utf8');
  };
  const materialEntries = isRecord(world.materials)
    ? Object.entries(world.materials).slice(0, WORLD_LIMITS.materials)
    : [];
  for (let i = 0; i < materialEntries.length; i += 1) {
    const [id, material] = materialEntries[i];
    if (isRecord(material)) {
      const { vertexFile, fragmentFile, ...rest } = material;
      materials[id] = {
        ...rest,
        ...(vertexFile === undefined
          ? {}
          : { vertex: await readHook(vertexFile) }),
        ...(fragmentFile === undefined
          ? {}
          : { fragment: await readHook(fragmentFile) }),
      };
    } else {
      materials[id] = material;
    }
  }
  const modelEntries = isRecord(world.models)
    ? Object.entries(world.models).slice(0, WORLD_LIMITS.models)
    : [];
  let { modelBytes } = WORLD_LIMITS;
  for (let i = 0; i < modelEntries.length; i += 1) {
    const [id, model] = modelEntries[i];
    if (isRecord(model) && model.file !== undefined) {
      const bytes = await read(model.file, modelBytes);
      modelBytes -= bytes.byteLength;
      if (!isSelfContainedModel(bytes)) {
        throw new ProjectProblem('bad-model', 'world');
      }
      models[id] = { data: bytes.toString('base64') };
    } else {
      // Written inline: held to the same test, or the Studio built a scene
      // the server then refuses to publish.
      const data =
        isRecord(model) && typeof model.data === 'string' ? model.data : '';
      if (!isSelfContainedModel(Buffer.from(data, 'base64'))) {
        throw new ProjectProblem('bad-model', 'world');
      }
      models[id] = model;
    }
  }
  return { ...world, materials, models };
};

/** The world `manifest` gives, its files read in; undefined when it has none. */
const readProjectWorld = async (
  folder: string,
  manifest: Record<string, unknown>,
): Promise<unknown> => {
  const { world, worldFile } = manifest;
  if (worldFile === undefined) {
    return world === undefined ? undefined : readWorldFiles(folder, world);
  }
  if (world !== undefined) {
    throw new ProjectProblem('bad-world', 'world');
  }
  if (typeof worldFile !== 'string' || !/\.json$/i.test(worldFile)) {
    throw new ProjectProblem('unsafe-path', 'world');
  }
  const real = await resolveInside(folder, worldFile, 'world');
  const bytes = await readBounded(real, MAX_WORLD_FILE_BYTES, 'world');
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ProjectProblem('bad-world', 'world');
  }
  return readWorldFiles(folder, parsed);
};

export default readProjectWorld;
