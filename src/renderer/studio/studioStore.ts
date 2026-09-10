import { useSyncExternalStore } from 'react';
import type { IScenePack } from 'common/scenePacks';
import type {
  IStudioState,
  TAddOutcome,
  TStarterOutcome,
} from 'main/ipc/memberScenes';
import type { TProjectBuild } from 'main/memberScenes/project';

/**
 * The Studio, as the renderer sees it: the linked folder, the latest build
 * of it, and the last build that worked.
 *
 * The last working pack is kept here because it is what the stage shows while
 * the member is between a broken save and a fixed one. It changes only when a
 * build succeeds — `serial` counts those — so a save that breaks a rule never
 * makes the stage recompile the version it is already playing.
 *
 * The session is opened when the Studio appears and closed when it leaves,
 * which is what starts and stops the folder watcher in the main process.
 */

export interface IStudioView {
  state: IStudioState;
  /** The newest build that became a pack. */
  pack?: IScenePack;
  /** Increments with every build that became a pack. */
  serial: number;
  /** The newest build, when it did not become a pack. */
  problems?: Extract<TProjectBuild, { ok: false }>['problems'];
}

const INITIAL: IStudioView = { state: { entitled: false }, serial: 0 };

let view: IStudioView = INITIAL;
const listeners = new Set<() => void>();

const bridge = () => window.electron?.ipcRenderer;

const publish = (next: IStudioView) => {
  view = next;
  listeners.forEach((listener) => listener());
};

const adopt = (state: IStudioState) => {
  const { build } = state;
  if (build?.ok) {
    // The main process never sends the same build twice, so each one that
    // arrives is a new version to put on the stage.
    publish({ state, pack: build.pack, serial: view.serial + 1 });
    return;
  }
  publish({
    state,
    // A folder unlinked or swapped leaves nothing worth keeping on stage.
    pack:
      state.folder?.path === view.state.folder?.path ? view.pack : undefined,
    serial: view.serial,
    ...(build && !build.ok ? { problems: build.problems } : {}),
  });
};

/** Opens the Studio session; the returned function closes it. */
export const openStudioSession = (): (() => void) => {
  const api = bridge();
  const stop = api?.onStudioChanged?.(adopt) ?? (() => {});
  api
    ?.openStudio?.()
    .then(adopt)
    .catch(() => {
      // No backend: the Studio shows its locked state, which is right.
    });
  return () => {
    stop();
    api?.closeStudio?.().catch(() => undefined);
  };
};

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

export const unlinkStudioFolder = async () => {
  const state = await bridge()?.unlinkStudioFolder?.();
  if (state) {
    adopt(state);
  }
};

export const createStudioStarter = async (): Promise<TStarterOutcome> =>
  (await bridge()?.createStudioStarter?.()) ?? 'refused';

export const addStudioSceneToLooks = async (): Promise<TAddOutcome> =>
  (await bridge()?.addStudioSceneToLooks?.()) ?? {
    ok: false,
    reason: 'not-entitled',
  };

export const showStudioFolder = async () => {
  await bridge()?.showStudioFolder?.();
};

/** For tests: a clean module between runs. */
export const resetStudioStore = () => {
  view = INITIAL;
  listeners.clear();
};

/** For tests: hand the store a state without an IPC bridge. */
export const adoptStudioStateForTesting = (state: IStudioState) => adopt(state);
