import fs from 'fs';
import path from 'path';
import type {
  IProjectList,
  IStoredProject,
} from '../memberScenes/studioProjects';

/**
 * Which Studio project the member's AI means, from the folder it names.
 *
 * The door reaches only what the Studio's own list holds: a project the
 * member made there or opened there, that they may use now. A folder that is
 * anywhere else — however much it looks like a scene — is not one, because
 * the member never put it in front of FluidEQ, and drawing whatever a caller
 * points at is not what the door is for. FluidEQ's own scenes, opened to
 * look inside, are left out as well: they are not the member's work.
 */

export type TAgentProject =
  | { ok: true; id: string; folder: string }
  | { ok: false; reason: 'none-open' | 'not-a-project' | 'locked' };

/**
 * The same folder, however it was spelled: resolved, links followed where the
 * folder exists, and compared without case on Windows, whose file system does.
 */
export const sameFolder = (
  a: string,
  b: string,
  platform: NodeJS.Platform = process.platform,
) => {
  const real = (folder: string) => {
    const resolved = path.resolve(folder);
    try {
      return fs.realpathSync.native(resolved);
    } catch {
      return resolved;
    }
  };
  const [left, right] = [real(a), real(b)].map((folder) =>
    platform === 'win32' ? folder.toLowerCase() : folder,
  );
  return left === right;
};

export const findAgentProject = (
  list: IProjectList,
  folder: string | undefined,
  usable: (project: IStoredProject) => boolean,
): TAgentProject => {
  const found =
    folder === undefined
      ? list.projects.find((project) => project.id === list.active)
      : list.projects.find((project) => sameFolder(project.folder, folder));
  if (!found) {
    return {
      ok: false,
      reason: folder === undefined ? 'none-open' : 'not-a-project',
    };
  }
  if (found.official !== undefined) {
    return { ok: false, reason: 'not-a-project' };
  }
  if (!usable(found)) {
    return { ok: false, reason: 'locked' };
  }
  return { ok: true, id: found.id, folder: found.folder };
};
