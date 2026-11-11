import fs from 'fs';
import path from 'path';
import {
  isRecord,
  MANIFEST_FILE,
  readManifest,
  resolveInside,
} from './projectFiles';

/**
 * Every file of a project that is code, for the Studio's Code tab: the
 * scene's shader, `pack.json`, the 3D world and the GLSL its materials
 * name, each animation, and the notes.
 *
 * The tab showed the shader alone (Ivan, 2026-11-11: "code only show scene
 * frag, it needs to show the full code, all files"), while a scene with a
 * world keeps most of what it is in `world.json` and a material's files,
 * and what the member's AI changed there could not be read anywhere in
 * FluidEQ.
 *
 * Read the way the rest of the folder is: plain names inside it, never a
 * link out, and bounded - a world with a model inside it is megabytes of
 * base64 that nobody reads, so a file past `MAX_SHOWN_BYTES` is listed by
 * its size and not sent.
 */

export type TProjectCodeRole =
  'scene' | 'pack' | 'world' | 'material' | 'animation' | 'notes';

export interface IProjectCodeFile {
  /** As the member would name it: `world.json`, `animations/bird.json`. */
  file: string;
  role: TProjectCodeRole;
  bytes: number;
  /** Absent for a file too large to show. */
  text?: string;
}

/** The most of one file the tab is sent. */
export const MAX_SHOWN_BYTES = 256 * 1024;
/** The most files listed: a folder of a thousand animations is not read. */
const MAX_FILES = 80;

const DEFAULT_SOURCE_FILE = 'scene.frag';
const NOTES_FILE = 'studio-notes.json';
const ANIMATIONS_DIR = 'animations';

/** One file at the folder's top, or undefined when it is not there or unsafe. */
const topFile = async (
  folder: string,
  name: unknown,
  role: TProjectCodeRole,
): Promise<IProjectCodeFile | undefined> => {
  if (typeof name !== 'string') {
    return undefined;
  }
  try {
    const real = await resolveInside(
      folder,
      name,
      role === 'pack' ? 'pack.json' : 'world',
    );
    const { size } = await fs.promises.stat(real);
    return {
      file: name,
      role,
      bytes: size,
      ...(size <= MAX_SHOWN_BYTES
        ? { text: await fs.promises.readFile(real, 'utf8') }
        : {}),
    };
  } catch {
    return undefined;
  }
};

/** The animations' own files: plain `.json` files of a plain folder inside. */
const animationFiles = async (folder: string): Promise<IProjectCodeFile[]> => {
  try {
    const home = await fs.promises.realpath(folder);
    const directory = path.join(home, ANIMATIONS_DIR);
    const stats = await fs.promises.lstat(directory);
    if (!stats.isDirectory()) {
      return [];
    }
    const names = (await fs.promises.readdir(directory))
      .filter((name) => /^[a-z][a-z0-9-]{0,39}\.json$/.test(name))
      .sort()
      .slice(0, MAX_FILES);
    const read = await Promise.all(
      names.map(async (name): Promise<IProjectCodeFile | undefined> => {
        const real = path.join(directory, name);
        const entry = await fs.promises.lstat(real);
        if (!entry.isFile() || entry.nlink !== 1) {
          return undefined;
        }
        return {
          file: `${ANIMATIONS_DIR}/${name}`,
          role: 'animation',
          bytes: entry.size,
          ...(entry.size <= MAX_SHOWN_BYTES
            ? { text: await fs.promises.readFile(real, 'utf8') }
            : {}),
        };
      }),
    );
    return read.flatMap((file) => (file ? [file] : []));
  } catch {
    return [];
  }
};

/** The GLSL files the world's materials name, each once, in their order. */
const materialNames = (world: unknown): string[] => {
  if (!isRecord(world) || !isRecord(world.materials)) {
    return [];
  }
  const names = Object.values(world.materials).flatMap((material) =>
    isRecord(material)
      ? [material.vertexFile, material.fragmentFile].filter(
          (name): name is string => typeof name === 'string',
        )
      : [],
  );
  return [...new Set(names)];
};

/**
 * The project's code, the shader first: what plays, what describes it, the
 * world, the world's own GLSL, the animations, the notes. A file that is
 * missing or unsafe is left out; a folder with no manifest answers nothing.
 */
export const readProjectCode = async (
  folder: string,
): Promise<IProjectCodeFile[]> => {
  let manifest: Record<string, unknown>;
  try {
    manifest = await readManifest(folder);
  } catch {
    return [];
  }
  const worldFile =
    typeof manifest.worldFile === 'string' ? manifest.worldFile : undefined;
  const world = worldFile
    ? await topFile(folder, worldFile, 'world')
    : undefined;
  let worldRaw: unknown = manifest.world;
  if (world?.text !== undefined) {
    try {
      worldRaw = JSON.parse(world.text);
    } catch {
      worldRaw = undefined;
    }
  }
  const files = await Promise.all([
    topFile(
      folder,
      typeof manifest.sourceFile === 'string'
        ? manifest.sourceFile
        : DEFAULT_SOURCE_FILE,
      'scene',
    ),
    topFile(folder, MANIFEST_FILE, 'pack'),
    Promise.resolve(world),
    ...materialNames(worldRaw).map((name) => topFile(folder, name, 'material')),
  ]);
  return [
    ...files.flatMap((file) => (file ? [file] : [])),
    ...(await animationFiles(folder)),
    ...[await topFile(folder, NOTES_FILE, 'notes')].flatMap((file) =>
      file ? [file] : [],
    ),
  ].slice(0, MAX_FILES);
};
