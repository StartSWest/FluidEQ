import fs from 'fs';
import path from 'path';
import { MAX_MEMBER_NAME_LENGTH } from '../../common/memberScenes';
import { writeStarterProject } from './project';

/**
 * New Studio projects, made where the member keeps them.
 *
 * A member chooses one projects folder, once; "New project" then asks only
 * for a name and makes a folder of that name inside it, with a scene that
 * already moves. The page sends the name and nothing else: it becomes one
 * path segment here, cleaned until no operating system could read it as
 * anything but a folder name, and the folder is checked to sit directly in
 * the projects folder before a byte is written.
 */

/** Where projects go until the member chooses somewhere else. */
export const defaultProjectsRoot = (documentsDir: string) =>
  path.join(documentsDir, 'FluidEQ Studio');

// Names Windows keeps for devices, with or without an extension: a folder
// called "con" cannot be made, and "con.txt" is no better.
const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

// Characters no folder name may hold on Windows, plus the ASCII controls.
// Written as a class of escapes: the controls are invisible, and a visible
// backslash here is one people "tidy".
// eslint-disable-next-line no-control-regex -- the controls are what it removes
const FORBIDDEN = /[\u0000-\u001f<>:"/\\|?*\u007f]/g;

/**
 * `name` as a folder name every system accepts, or undefined when nothing of
 * it is left: separators, reserved names and the dots that mean "here" and
 * "up" can never come through.
 */
export const folderNameFor = (name: string): string | undefined => {
  const cleaned = name
    .normalize('NFC')
    .replace(FORBIDDEN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // Leading dots hide a folder on macOS and Linux, and are what was left
    // of a "../" once its slashes went.
    .replace(/^[. ]+/, '')
    .slice(0, MAX_MEMBER_NAME_LENGTH)
    // Windows drops a trailing dot or space, and the folder it made would
    // not be the one asked for.
    .replace(/[. ]+$/, '');
  if (!cleaned || RESERVED.test(cleaned)) {
    return undefined;
  }
  return cleaned;
};

/**
 * A pack id for a scene called `name`: lowercase letters, digits and dashes,
 * starting with a letter. A name with none of those (one written in Japanese,
 * say) still gets a working id.
 */
export const sceneIdFor = (name: string): string => {
  const slug = name
    .normalize('NFD')
    // The combining marks an accented letter decomposes into.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[^a-z]+/, '')
    .slice(0, 48)
    .replace(/-+$/, '');
  return slug.length >= 2 ? slug : 'my-scene';
};

export type TNewProjectOutcome =
  | { ok: true; folder: string }
  | { ok: false; reason: 'invalid' | 'exists' | 'failed' };

/**
 * Makes `root/<name>` with the starter scene in it, named `name`. The
 * projects folder itself is made if it is not there yet; a folder of that
 * name already in it is never touched.
 */
export const createProjectFolder = async (
  root: string,
  name: string,
): Promise<TNewProjectOutcome> => {
  const folderName = folderNameFor(name);
  if (!folderName) {
    return { ok: false, reason: 'invalid' };
  }
  const folder = path.join(root, folderName);
  if (path.dirname(folder) !== path.normalize(root)) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    await fs.promises.mkdir(root, { recursive: true });
    // Not recursive: this is what refuses a folder that already exists.
    await fs.promises.mkdir(folder);
  } catch (error) {
    return {
      ok: false,
      reason:
        (error as NodeJS.ErrnoException).code === 'EEXIST'
          ? 'exists'
          : 'failed',
    };
  }
  const written = await writeStarterProject(folder, {
    name: folderName,
    id: sceneIdFor(folderName),
  });
  return written === 'written'
    ? { ok: true, folder }
    : { ok: false, reason: 'exists' };
};
