import {
  sceneFailureKey,
  type ISceneFailureEntry,
} from 'common/sceneFailureLog';

/**
 * A way a scene did not play, to main's log (`main/sceneFailures.ts`). Asked
 * once per scene, version, surface and cause in this window, so a loop that
 * fails on every frame crosses the bridge once; main keeps the same rule for
 * the whole app.
 */

const sent = new Set<string>();

const throughMain = (entry: ISceneFailureEntry) =>
  window.electron?.ipcRenderer?.logSceneFailure?.(entry);

export const logSceneFailure = (
  entry: ISceneFailureEntry,
  /** The desktop page has a bridge of its own; every other window has main's. */
  send: (entry: ISceneFailureEntry) => void = throughMain,
) => {
  const key = sceneFailureKey(entry);
  if (sent.has(key)) {
    return;
  }
  sent.add(key);
  send(entry);
};

/** For tests: a new window. */
export const resetSceneFailureLogForTesting = () => sent.clear();
