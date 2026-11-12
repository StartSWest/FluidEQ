import { useSyncExternalStore } from 'react';
import type { IScenePack } from 'common/scenePacks';

/**
 * The scene as a Code tab file's unsaved text makes it, for the stage to play
 * before it is saved (the mockup Ivan approved on 2026-11-11: "while it
 * builds, the stage plays your draft, before you save").
 *
 * One at a time: the file being edited last. It is the scene main built with
 * that draft standing in for the file (`projectCodeDraft.ts`), so it passed
 * the rules a save would; the stage then compiles it like any version, and a
 * draft that does not compile leaves the one before it playing. Dropped when
 * the file is saved, discarded, typed back to what is on disk, or left.
 */

interface ICodeDraft {
  projectId: string;
  file: string;
  pack: IScenePack;
  /** Counts every draft shown, so each is a version of its own to the stage. */
  serial: number;
}

let current: ICodeDraft | undefined;
let shown = 0;
const listeners = new Set<() => void>();

const tell = () => listeners.forEach((listener) => listener());

/** The draft of `file` becomes what the stage plays. */
export const showCodeDraft = (
  projectId: string,
  file: string,
  pack: IScenePack,
) => {
  shown += 1;
  current = { projectId, file, pack, serial: shown };
  tell();
};

/** The draft of `file` stops playing; the scene as saved comes back. */
export const dropCodeDraft = (projectId: string, file: string) => {
  if (current?.projectId === projectId && current.file === file) {
    current = undefined;
    tell();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The draft the stage plays for `projectId`, when one is being edited. */
export const useCodeDraft = (
  projectId: string | undefined,
): ICodeDraft | undefined => {
  const draft = useSyncExternalStore(subscribe, () => current);
  return draft && draft.projectId === projectId ? draft : undefined;
};
