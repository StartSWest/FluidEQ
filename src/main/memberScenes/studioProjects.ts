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
}

export interface IProjectList {
  projects: IStoredProject[];
  active?: string;
}

/** More than anyone keeps going at once; the least recent fall off. */
export const MAX_STUDIO_PROJECTS = 40;

const PROJECT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** One folder written two ways is still one project. */
export const sameFolder = (a: string, b: string) =>
  path.relative(path.resolve(a), path.resolve(b)) === '';

const readEntry = (value: unknown): IStoredProject | undefined =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  PROJECT_ID.test(value.id) &&
  typeof value.folder === 'string' &&
  path.isAbsolute(value.folder) &&
  typeof value.openedAt === 'number' &&
  Number.isFinite(value.openedAt)
    ? { id: value.id, folder: value.folder, openedAt: value.openedAt }
    : undefined;

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
  return active ? { projects, active } : { projects };
};

export const writeProjectList = (file: string, list: IProjectList) =>
  writeFileAtomically(file, JSON.stringify(list));

/** Most recently opened first. */
export const byRecent = (list: IProjectList): IStoredProject[] =>
  [...list.projects].sort((a, b) => b.openedAt - a.openedAt);

/**
 * The list with `folder` in it and open: a folder already there is reopened
 * rather than listed twice.
 */
export const withFolder = (
  list: IProjectList,
  folder: string,
  now: number,
): IProjectList => {
  const known = list.projects.find((project) =>
    sameFolder(project.folder, folder),
  );
  if (known) {
    return withActive(list, known.id, now);
  }
  const id = randomUUID();
  const projects = byRecent({
    projects: [...list.projects, { id, folder, openedAt: now }],
  }).slice(0, MAX_STUDIO_PROJECTS);
  return { projects, active: id };
};

/** The list with `id` open, or unchanged when there is no such project. */
export const withActive = (
  list: IProjectList,
  id: string,
  now: number,
): IProjectList =>
  list.projects.some((project) => project.id === id)
    ? {
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
  return next ? { projects, active: next.id } : { projects };
};
