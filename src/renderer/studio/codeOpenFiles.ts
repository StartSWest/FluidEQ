import { readStored, writeStored } from '../utils/graphStorage';

/**
 * Which files each project has open in the Studio's Code tab.
 *
 * Kept, because the tab is taken down whenever another is chosen and a
 * member who works in one file would otherwise open it again on every
 * visit. A project nobody has opened or folded a file of has no entry,
 * which the tab reads as "show it the way a first visit does".
 */

// Not `fluideq.studio.codeOpen`: that was the old pane's one fold, and a
// profile may still hold its 'true' or 'false'.
const KEY = 'fluideq.studio.codeOpenFiles';
/** The newest projects kept; an older one starts over, which costs a click. */
const MAX_PROJECTS = 24;
const MAX_FILES = 80;

type TMemory = Record<string, string[]>;

const recall = (): TMemory => {
  try {
    const raw: unknown = JSON.parse(readStored(KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(raw).flatMap(([id, list]) =>
        Array.isArray(list)
          ? [[id, list.filter((name) => typeof name === 'string')]]
          : [],
      ),
    );
  } catch {
    // Something else wrote the key: start over, as a first visit does.
    return {};
  }
};

export const openFilesOf = (
  projectId: string | undefined,
): ReadonlySet<string> | undefined => {
  const list = projectId === undefined ? undefined : recall()[projectId];
  return list ? new Set(list) : undefined;
};

export const rememberOpenFiles = (
  projectId: string | undefined,
  open: ReadonlySet<string>,
) => {
  if (projectId === undefined) {
    return;
  }
  const { [projectId]: was, ...others } = recall();
  // Written last, so the newest project is the last one dropped.
  const all: TMemory = {
    ...others,
    [projectId]: [...open].slice(0, MAX_FILES),
  };
  const ids = Object.keys(all);
  ids.slice(0, Math.max(0, ids.length - MAX_PROJECTS)).forEach((id) => {
    delete all[id];
  });
  writeStored(KEY, JSON.stringify(all));
};
