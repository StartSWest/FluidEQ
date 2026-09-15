import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import writeFileAtomically from '../atomicWrite';

/**
 * The Studio's projects: every folder a member has worked on here, and which
 * one is open.
 *
 * The page names a project by an id made here, never by its folder, so the
 * rule that no path comes from the page holds with many folders as it did
 * with one. Only the open project is watched and only it plays; the others
 * are a line in a list until somebody picks them.
 *
 * The file used to hold one linked folder, `{ folder }`. That reads as a list
 * of one, open.
 */

export interface IStoredProject {
  id: string;
  folder: string;
  /** When it was last opened, so the list leads with the recent ones. */
  openedAt: number;
  /**
   * The FluidEQ scene this project was opened from, to look inside and take
   * ideas from. Such a project is never added to looks, exported or
   * published. Kept here, in the app's own data, and not in the folder,
   * where anyone could delete it.
   */
  official?: string;
}

export interface IProjectList {
  projects: IStoredProject[];
  active?: string;
  /** Where "New project" makes its folders, once the member has chosen. */
  root?: string;
}

/** More than anyone keeps going at once; the least recent fall off. */
export const MAX_STUDIO_PROJECTS = 40;

const PROJECT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PACK_ID = /^[a-z][a-z0-9-]{1,47}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One folder written two ways is still one project. */
export const sameFolder = (a: string, b: string) =>
  path.relative(path.resolve(a), path.resolve(b)) === '';

const readEntry = (value: unknown): IStoredProject | undefined => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !PROJECT_ID.test(value.id) ||
    typeof value.folder !== 'string' ||
    !path.isAbsolute(value.folder) ||
    typeof value.openedAt !== 'number' ||
    !Number.isFinite(value.openedAt)
  ) {
    return undefined;
  }
  const entry = {
    id: value.id,
    folder: value.folder,
    openedAt: value.openedAt,
  };
  // A mark that cannot be read still marks the project: dropping it would
  // turn a FluidEQ scene into one that can be published.
  if (value.official === undefined) {
    return entry;
  }
  return {
    ...entry,
    official:
      typeof value.official === 'string' && PACK_ID.test(value.official)
        ? value.official
        : 'unknown',
  };
};

export const readProjectList = (file: string): IProjectList => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { projects: [] };
  }
  if (!isRecord(parsed)) {
    return { projects: [] };
  }
  if (typeof parsed.folder === 'string' && path.isAbsolute(parsed.folder)) {
    const id = randomUUID();
    return {
      projects: [{ id, folder: parsed.folder, openedAt: 0 }],
      active: id,
    };
  }
  const projects: IStoredProject[] = [];
  (Array.isArray(parsed.projects) ? parsed.projects : []).forEach((raw) => {
    const entry = readEntry(raw);
    if (
      entry &&
      !projects.some(
        (kept) => kept.id === entry.id || sameFolder(kept.folder, entry.folder),
      )
    ) {
      projects.push(entry);
    }
  });
  const active =
    typeof parsed.active === 'string' &&
    projects.some((project) => project.id === parsed.active)
      ? parsed.active
      : undefined;
  const root =
    typeof parsed.root === 'string' && path.isAbsolute(parsed.root)
      ? parsed.root
      : undefined;
  return {
    projects,
    ...(active ? { active } : {}),
    ...(root ? { root } : {}),
  };
};

export const writeProjectList = (file: string, list: IProjectList) =>
  writeFileAtomically(file, JSON.stringify(list));

/** Most recently opened first. */
export const byRecent = (list: IProjectList): IStoredProject[] =>
  [...list.projects].sort((a, b) => b.openedAt - a.openedAt);

/**
 * The list with `folder` in it and open: a folder already there is reopened
 * rather than listed twice. `official` marks it as a FluidEQ scene opened to
 * look inside; a mark once given is never taken away here.
 */
export const withFolder = (
  list: IProjectList,
  folder: string,
  now: number,
  official?: string,
): IProjectList => {
  const known = list.projects.find((project) =>
    sameFolder(project.folder, folder),
  );
  if (known) {
    const marked: IProjectList =
      official && !known.official
        ? {
            ...list,
            projects: list.projects.map((project) =>
              project.id === known.id ? { ...project, official } : project,
            ),
          }
        : list;
    return withActive(marked, known.id, now);
  }
  const id = randomUUID();
  const projects = byRecent({
    projects: [
      ...list.projects,
      { id, folder, openedAt: now, ...(official ? { official } : {}) },
    ],
  }).slice(0, MAX_STUDIO_PROJECTS);
  return { ...list, projects, active: id };
};

/**
 * The list with every one of `folders` in it and the first of them open. A
 * folder already there is reopened rather than listed twice, and keeps its
 * mark. Each is dated a millisecond behind the one before it, so the list
 * leads with the one that opened and the rest follow in the order given; past
 * `MAX_STUDIO_PROJECTS` the least recent fall off, as they always have.
 */
export const withFolders = (
  list: IProjectList,
  folders: readonly string[],
  now: number,
): IProjectList => {
  const [first] = folders;
  if (first === undefined) {
    return list;
  }
  const projects = folders.reduce<IStoredProject[]>((kept, folder, index) => {
    const openedAt = now - index;
    const known = kept.find((project) => sameFolder(project.folder, folder));
    return known
      ? kept.map((project) =>
          project.id === known.id ? { ...project, openedAt } : project,
        )
      : [...kept, { id: randomUUID(), folder, openedAt }];
  }, list.projects);
  const opened = projects.find((project) => sameFolder(project.folder, first));
  return {
    ...list,
    projects: byRecent({ projects }).slice(0, MAX_STUDIO_PROJECTS),
    ...(opened ? { active: opened.id } : {}),
  };
};

/** The list with `id` open, or unchanged when there is no such project. */
export const withActive = (
  list: IProjectList,
  id: string,
  now: number,
): IProjectList =>
  list.projects.some((project) => project.id === id)
    ? {
        ...list,
        projects: list.projects.map((project) =>
          project.id === id ? { ...project, openedAt: now } : project,
        ),
        active: id,
      }
    : list;

/**
 * The list without `id`. Its folder is left exactly as it is on disk. When it
 * was the open one, the most recent of the rest opens in its place, so the
 * Studio never shows an empty bench while there is work to show.
 */
export const without = (list: IProjectList, id: string): IProjectList => {
  const projects = list.projects.filter((project) => project.id !== id);
  if (list.active !== id) {
    return { ...list, projects };
  }
  const [next] = byRecent({ projects });
  const kept: IProjectList = {
    projects,
    ...(list.root ? { root: list.root } : {}),
  };
  return next ? { ...kept, active: next.id } : kept;
};

/**
 * The list with project `id` in `folder`: the same project, its folder renamed
 * on disk, keeping its id, its place in the list, its mark and whether it is
 * the open one.
 */
export const withProjectFolder = (
  list: IProjectList,
  id: string,
  folder: string,
): IProjectList => ({
  ...list,
  projects: list.projects.map((project) =>
    project.id === id ? { ...project, folder } : project,
  ),
});

/** The list with its projects folder set to `root`. */
export const withRoot = (list: IProjectList, root: string): IProjectList => ({
  ...list,
  root,
});
