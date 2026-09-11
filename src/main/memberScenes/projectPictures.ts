import fs from 'fs';
import path from 'path';
import {
  MAX_MEMBER_NAME_LENGTH,
  sanitizeDisplayText,
} from '../../common/memberScenes';
import {
  MAX_SCENE_ARTWORK_BYTES,
  MAX_SCENE_ARTWORK_EDGE,
  MAX_SCENE_ARTWORK_PIXELS,
  normalizeSceneArtwork,
} from '../../common/sceneArtwork';
import type { TLocalizedName } from '../../common/scenePacks';
import {
  DEFAULT_FRAMING,
  readFraming,
  type IPictureFraming,
} from '../../common/pictureFraming';
import {
  isPlainFileName,
  readBounded,
  readManifest,
  resolveInside,
} from './project';

/**
 * The pictures a member's scene asks for, as the Studio shows and fills them.
 *
 * A scene has one picture on the GPU, `artwork.webp`, at the exact size
 * `pack.json` gives. It may be one photo, or several side by side — a pet and
 * a background, say — each a named region the scene samples on its own.
 * `pack.json` names them in `pictures`:
 *
 *   "pictures": [{ "id": "pet", "names": { "en": "Your pet" },
 *                  "x": 0, "y": 0, "width": 1280, "height": 1280 }, ...]
 *
 * in pixels of the picture from its top-left corner, as any image editor
 * counts them. Without `pictures` the whole image is one picture. The member
 * never lays anything out: the Studio shows each region by name with what is
 * in it now, and puts a chosen photo into exactly its region.
 *
 * A picture may also say how a photo sits in its place — `"fit"`, cover or
 * contain, and `"focus"`, the point of the photo kept at the centre (see
 * `pictureFraming.ts`) — which is where the Studio's framing editor starts.
 * The member's own framing, and the photo it frames, are kept beside the
 * scene in `photos/`, so a picture can be framed again later from the photo
 * itself rather than from the cropped copy in the image.
 *
 * Only the Studio reads `pictures`; the pack the build makes, and everything
 * published from it, carries the finished image and nothing about regions.
 */

/** Several photos in one scene is plenty; a row of them fits the Studio. */
const MAX_PICTURES = 8;
const PICTURE_ID = /^[a-z][a-z0-9_-]{0,23}$/;

/** Where the photos behind the scene's pictures are kept, in the project. */
const PHOTOS_DIR = 'photos';
const FRAMING_FILE = 'framing.json';
/** A kept photo is re-encoded at most 4096 px on its longer side. */
const MAX_SOURCE_BYTES = 16 * 1024 * 1024;
const MAX_FRAMING_BYTES = 64 * 1024;

export interface IPictureSlot {
  id: string;
  /** What the scene calls it, cleaned; absent when `pack.json` names it not. */
  names?: TLocalizedName;
  x: number;
  y: number;
  width: number;
  height: number;
  /** How the scene would have a photo sit here, before the member frames it. */
  framing: IPictureFraming;
}

export interface IPictureAtlas {
  /** The image's file name in the folder, as `pack.json` gives it. */
  file: string;
  width: number;
  height: number;
  pictures: IPictureSlot[];
}

/**
 * `none` when the scene uses no picture (or `pack.json` cannot be read),
 * `impossible` when it asks for one no image could be — a name that is not a
 * plain file here, a size past what a scene may carry, or regions that do
 * not fit inside it — and otherwise what to fill.
 */
export type TPicturesRead =
  | { kind: 'none' }
  | { kind: 'impossible' }
  | { kind: 'atlas'; atlas: IPictureAtlas };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEdge = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_SCENE_ARTWORK_EDGE;

const isOffset = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/** Cleaned as every name on screen is; nothing without an English one. */
const cleanNames = (value: unknown): TLocalizedName | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const cleaned: Record<string, string> = {};
  Object.entries(value).forEach(([locale, raw]) => {
    const name = sanitizeDisplayText(raw);
    if (/^[a-z]{2}$/.test(locale) && name) {
      cleaned[locale] = name.slice(0, MAX_MEMBER_NAME_LENGTH);
    }
  });
  return cleaned.en ? (cleaned as TLocalizedName) : undefined;
};

/** The regions `pictures` names, or undefined when any of them cannot be. */
const readSlots = (
  raw: unknown,
  width: number,
  height: number,
): IPictureSlot[] | undefined => {
  if (raw === undefined) {
    return [
      { id: 'picture', x: 0, y: 0, width, height, framing: DEFAULT_FRAMING },
    ];
  }
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_PICTURES) {
    return undefined;
  }
  const slots = raw.map((entry): IPictureSlot | undefined => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      !PICTURE_ID.test(entry.id) ||
      !isOffset(entry.x) ||
      !isOffset(entry.y) ||
      !isEdge(entry.width) ||
      !isEdge(entry.height) ||
      entry.x + entry.width > width ||
      entry.y + entry.height > height
    ) {
      return undefined;
    }
    const names = cleanNames(entry.names);
    return {
      id: entry.id,
      ...(names ? { names } : {}),
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      // Zoom is the member's alone: a scene says how a photo fits, not how
      // far in to go on a photo it has never seen.
      framing: {
        ...readFraming({ fit: entry.fit, focus: entry.focus }),
        zoom: 1,
      },
    };
  });
  const ids = new Set(slots.map((slot) => slot?.id));
  return slots.every((slot) => slot !== undefined) && ids.size === slots.length
    ? (slots as IPictureSlot[])
    : undefined;
};

export const readPictureAtlas = async (
  folder: string,
): Promise<TPicturesRead> => {
  let manifest: Record<string, unknown>;
  try {
    manifest = await readManifest(folder);
  } catch {
    return { kind: 'none' };
  }
  const { artworkFile, artworkWidth, artworkHeight } = manifest;
  if (artworkFile === undefined) {
    return { kind: 'none' };
  }
  if (
    typeof artworkFile !== 'string' ||
    !isPlainFileName(artworkFile) ||
    !isEdge(artworkWidth) ||
    !isEdge(artworkHeight) ||
    artworkWidth * artworkHeight > MAX_SCENE_ARTWORK_PIXELS
  ) {
    return { kind: 'impossible' };
  }
  const pictures = readSlots(manifest.pictures, artworkWidth, artworkHeight);
  return pictures
    ? {
        kind: 'atlas',
        atlas: {
          file: artworkFile,
          width: artworkWidth,
          height: artworkHeight,
          pictures,
        },
      }
    : { kind: 'impossible' };
};

/** Whether `bytes` are a still WebP of exactly `width` x `height`. */
const isAtlasImage = (bytes: Uint8Array, width: number, height: number) =>
  normalizeSceneArtwork({
    mime: 'image/webp',
    width,
    height,
    data: Buffer.from(bytes).toString('base64'),
  }) !== null;

/**
 * The scene's image as it is in the folder now, for the Studio's previews
 * and for the pictures a new one is laid over: only one that is inside the
 * folder and exactly what `pack.json` asks for. Anything else — missing, the
 * wrong size, not a WebP — reads as nothing yet, so every region is offered
 * as empty rather than composed onto a picture the build refuses.
 */
export const readPictureImage = async (
  folder: string,
  atlas: IPictureAtlas,
): Promise<Uint8Array | undefined> => {
  try {
    const real = await resolveInside(folder, atlas.file, 'artwork');
    const bytes = new Uint8Array(
      await readBounded(real, MAX_SCENE_ARTWORK_BYTES, 'artwork'),
    );
    return isAtlasImage(bytes, atlas.width, atlas.height) ? bytes : undefined;
  } catch {
    return undefined;
  }
};

export type TArtworkWrite =
  'written' | 'no-slot' | 'bad-slot' | 'bad-picture' | 'failed';

const exists = async (target: string) => {
  try {
    await fs.promises.lstat(target);
    return true;
  } catch {
    return false;
  }
};

/**
 * Saves the scene's image, with a picture the member chose laid into its
 * region, as the file `pack.json` names: never a path the page names, and
 * only a WebP of exactly the size `pack.json` gives — the build refuses
 * anything else, so it is refused here before the file exists. A file of
 * that name already there is replaced, unless it is a link out of the
 * folder, which would carry the write somewhere else entirely.
 */
export const writePictureImage = async (
  folder: string,
  bytes: Uint8Array,
): Promise<TArtworkWrite> => {
  const read = await readPictureAtlas(folder);
  if (read.kind !== 'atlas') {
    return read.kind === 'none' ? 'no-slot' : 'bad-slot';
  }
  const { atlas } = read;
  if (!isAtlasImage(bytes, atlas.width, atlas.height)) {
    return 'bad-picture';
  }
  const target = path.join(folder, atlas.file);
  try {
    if (await exists(target)) {
      await resolveInside(folder, atlas.file, 'artwork');
    }
    await fs.promises.writeFile(target, bytes);
    return 'written';
  } catch {
    return 'failed';
  }
};

// ------------------------------------------------------------ kept photos

/** What the Studio knows of one picture beyond `pack.json`. */
export interface IPictureKeep {
  /** The member's framing where they framed it, else the scene's. */
  framed: IPictureFraming;
  /** Whether the photo behind it is kept, so it can be framed again. */
  hasPhoto: boolean;
}

const isWebp = (bytes: Uint8Array) =>
  bytes.length > 12 &&
  Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' &&
  Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP';

/**
 * The project's photos folder — made when asked to — and only when it is a
 * real folder directly inside the project: a link there would carry every
 * write somewhere the member never chose.
 */
const photosDir = async (
  folder: string,
  create: boolean,
): Promise<string | undefined> => {
  try {
    const home = await fs.promises.realpath(folder);
    const target = path.join(home, PHOTOS_DIR);
    if (create) {
      await fs.promises.mkdir(target, { recursive: true });
    }
    const stats = await fs.promises.lstat(target);
    return stats.isDirectory() ? target : undefined;
  } catch {
    return undefined;
  }
};

/** A plain file of ours under that name: not a link, not a folder, bounded. */
const isKeptFile = async (file: string, limit: number) => {
  try {
    const stats = await fs.promises.lstat(file);
    return stats.isFile() && stats.size <= limit;
  } catch {
    return false;
  }
};

const readFramings = async (dir: string): Promise<Record<string, unknown>> => {
  const file = path.join(dir, FRAMING_FILE);
  if (!(await isKeptFile(file, MAX_FRAMING_BYTES))) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(
      await fs.promises.readFile(file, 'utf8'),
    );
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const photoFile = (dir: string, id: string) => path.join(dir, `${id}.webp`);

export const readPictureKeeps = async (
  folder: string,
  atlas: IPictureAtlas,
): Promise<Record<string, IPictureKeep>> => {
  const dir = await photosDir(folder, false);
  const framings = dir ? await readFramings(dir) : {};
  const keeps: Record<string, IPictureKeep> = {};
  await Promise.all(
    atlas.pictures.map(async (slot) => {
      keeps[slot.id] = {
        framed: readFraming(framings[slot.id], slot.framing),
        hasPhoto: dir
          ? await isKeptFile(photoFile(dir, slot.id), MAX_SOURCE_BYTES)
          : false,
      };
    }),
  );
  return keeps;
};

/** The kept photo behind one picture, when there is one. */
export const readPicturePhoto = async (
  folder: string,
  atlas: IPictureAtlas,
  id: string,
): Promise<Uint8Array | undefined> => {
  const dir = atlas.pictures.some((slot) => slot.id === id)
    ? await photosDir(folder, false)
    : undefined;
  if (!dir || !(await isKeptFile(photoFile(dir, id), MAX_SOURCE_BYTES))) {
    return undefined;
  }
  const bytes = new Uint8Array(await fs.promises.readFile(photoFile(dir, id)));
  return isWebp(bytes) ? bytes : undefined;
};

/**
 * Keeps the photo behind one picture and how the member framed it, beside
 * the scene. Only for a picture `pack.json` names, only a WebP, and never
 * over anything under those names that is not a plain file of ours.
 */
export const keepPicturePhoto = async (
  folder: string,
  atlas: IPictureAtlas,
  id: string,
  photo: Uint8Array,
  framing: unknown,
): Promise<boolean> => {
  const slot = atlas.pictures.find((entry) => entry.id === id);
  if (!slot || photo.byteLength > MAX_SOURCE_BYTES || !isWebp(photo)) {
    return false;
  }
  const dir = await photosDir(folder, true);
  if (!dir) {
    return false;
  }
  const file = photoFile(dir, id);
  const framingFile = path.join(dir, FRAMING_FILE);
  if (
    ((await exists(file)) && !(await isKeptFile(file, MAX_SOURCE_BYTES))) ||
    ((await exists(framingFile)) &&
      !(await isKeptFile(framingFile, MAX_FRAMING_BYTES)))
  ) {
    return false;
  }
  try {
    await fs.promises.writeFile(file, photo);
    const framings = await readFramings(dir);
    framings[id] = readFraming(framing, slot.framing);
    await fs.promises.writeFile(
      framingFile,
      `${JSON.stringify(framings, null, 2)}\n`,
    );
    return true;
  } catch {
    return false;
  }
};
