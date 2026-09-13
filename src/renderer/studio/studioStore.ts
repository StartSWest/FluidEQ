import { useSyncExternalStore } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type {
  IStudioState,
  TAddOutcome,
  TNewProjectResult,
} from 'main/ipc/memberScenes';
import type { TExportOutcome, TImportOutcome } from 'main/ipc/memberSharing';
import type { TPublishOutcome } from 'main/ipc/plusPublishing';
import type { TPlusCategory } from 'common/plusGallery';
import type {
  IProjectSource,
  TProjectBuild,
  TSourceWrite,
} from 'main/memberScenes/project';

/**
 * The Studio, as the renderer sees it: the member's projects, the latest
 * build of the open one, and the last build of it that worked.
 *
 * The last working pack is kept here because it is what the stage shows while
 * the member is between a broken save and a fixed one. It changes only when a
 * build succeeds — `serial` counts those — so a save that breaks a rule never
 * makes the stage recompile the version it is already playing.
 *
 * The session is opened when the Studio appears and closed when it leaves,
 * which is what starts and stops the open project's watcher in the main
 * process.
 */

export interface IStudioView {
  /**
   * The main process has answered at least once. Until then nothing is known
   * — not even whether this account has Plus — and the Studio shows nothing
   * rather than a guess: guessing "no Plus" flashed the Plus offer at every
   * member who had it.
   */
  loaded: boolean;
  state: IStudioState;
  /** The newest build that became a pack. */
  pack?: IScenePack;
  /** Increments with every build that became a pack. */
  serial: number;
  /** The newest build, when it did not become a pack. */
  problems?: Extract<TProjectBuild, { ok: false }>['problems'];
  /**
   * The open project's scene source as it is on disk now, for the code pane:
   * sent on every save, whether or not that save changed the build.
   */
  source?: IProjectSource;
}

const INITIAL: IStudioView = {
  loaded: false,
  state: { entitled: false, projectsRoot: '', projects: [] },
  serial: 0,
};

let view: IStudioView = INITIAL;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: IStudioView) => {
  view = next;
  listeners.forEach((listener) => listener());
};

const adopt = (state: IStudioState) => {
  const { build } = state;
  const sameProject = state.activeId === view.state.activeId;
  // Another project's source is not this one's: the new project's arrives
  // from its own watcher.
  const source = sameProject ? view.source : undefined;
  if (build?.ok) {
    // The main process never sends the same build twice, so each one that
    // arrives is a new version to put on the stage.
    publish({
      loaded: true,
      state,
      pack: build.pack,
      serial: view.serial + 1,
      ...(source ? { source } : {}),
    });
    return;
  }
  publish({
    loaded: true,
    state,
    // Another project on the bench leaves nothing of this one worth keeping
    // on stage: the next build of the new one is what plays.
    pack: sameProject ? view.pack : undefined,
    serial: view.serial,
    ...(build && !build.ok ? { problems: build.problems } : {}),
    ...(source ? { source } : {}),
  });
};

const adoptSource = (source: IProjectSource | null) =>
  publish({ ...view, source: source ?? undefined });

/** Opens the Studio session; the returned function closes it. */
export const openStudioSession = (): (() => void) => {
  const api = bridge();
  const stop = api?.onStudioChanged?.(adopt) ?? (() => {});
  const stopSource = api?.onStudioSourceChanged?.(adoptSource) ?? (() => {});
  // No backend: the Studio shows its locked state, which is right.
  const locked = () => publish({ ...view, loaded: true });
  const opened = api?.openStudio?.();
  if (opened) {
    opened.then(adopt).catch(locked);
  } else {
    locked();
  }
  return () => {
    stop();
    stopSource();
    api?.closeStudio?.().catch(() => undefined);
  };
};

/** Saves the code pane's text into the open project's scene file. */
export const writeStudioSource = async (text: string): Promise<TSourceWrite> =>
  (await bridge()?.writeStudioSource?.(text)) ?? 'failed';

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useStudio = (): IStudioView =>
  useSyncExternalStore(
    subscribe,
    () => view,
    () => INITIAL,
  );

export const linkStudioFolder = async () => {
  const state = await bridge()?.linkStudioFolder?.();
  if (state) {
    adopt(state);
  }
};

/** Puts another project on the bench; the one there stops being watched. */
export const selectStudioProject = async (id: string) => {
  const state = await bridge()?.selectStudioProject?.(id);
  if (state) {
    adopt(state);
  }
};

/** Takes a project off the list. Its folder stays exactly as it is. */
export const forgetStudioProject = async (id: string) => {
  const state = await bridge()?.forgetStudioProject?.(id);
  if (state) {
    adopt(state);
  }
};

export const publishStudioScene = async (
  termsVersion: number,
  category: TPlusCategory,
  picture: Uint8Array,
): Promise<TPublishOutcome> =>
  (await bridge()?.publishStudioScene?.(termsVersion, category, picture)) ?? {
    ok: false,
    reason: 'offline',
  };

/**
 * Makes a project called `name` in the projects folder and opens it; the
 * new state arrives the way every change does, through the session.
 */
export const createStudioProject = async (
  name: string,
): Promise<TNewProjectResult> =>
  (await bridge()?.createStudioProject?.(name)) ?? 'refused';

/** Asks, in the system dialog, where new projects should go from now on. */
export const chooseStudioProjectsRoot = async () => {
  const state = await bridge()?.chooseStudioProjectsRoot?.();
  if (state) {
    adopt(state);
  }
};

export const addStudioSceneToLooks = async (): Promise<TAddOutcome> =>
  (await bridge()?.addStudioSceneToLooks?.()) ?? {
    ok: false,
    reason: 'not-entitled',
  };

export const showStudioFolder = async () => {
  await bridge()?.showStudioFolder?.();
};

/** The terms version this computer last shared a scene under; 0 for never. */
export const studioTermsAgreed = async (): Promise<number> =>
  (await bridge()?.studioTermsAgreed?.()) ?? 0;

export const exportStudioScene = async (
  termsVersion: number,
): Promise<TExportOutcome> =>
  (await bridge()?.exportStudioScene?.(termsVersion)) ?? {
    ok: false,
    reason: 'offline',
  };

export const importMemberScene = async (): Promise<TImportOutcome> =>
  (await bridge()?.importMemberScene?.()) ?? {
    ok: false,
    reason: 'cancelled',
  };

/** For tests: a clean module between runs. */
export const resetStudioStore = () => {
  view = INITIAL;
  listeners.clear();
};

/** For tests: hand the store a state without an IPC bridge. */
export const adoptStudioStateForTesting = (state: IStudioState) => adopt(state);
