/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import {
  SCENE_FAILURE_CHANNEL,
  readSceneFailureEntry,
  sceneFailureKey,
  sceneFailureLine,
  type ISceneFailureEntry,
} from '../common/sceneFailureLog';
import onWindowMessage from './ipc/windowMessages';

/**
 * The app log's one line per way a scene ended up not playing
 * (`common/sceneFailureLog.ts`), written once per scene, version, surface and
 * cause in a session: the windows report what their scene loops saw, main
 * what it refused before a scene reached one.
 */

const written = new Set<string>();

export const logSceneFailure = (
  entry: ISceneFailureEntry,
  logger: { warn(message: string): void } = log,
) => {
  const key = sceneFailureKey(entry);
  if (written.has(key)) {
    return;
  }
  written.add(key);
  logger.warn(sceneFailureLine(entry));
};

/** The windows' side: anything that is not an entry is dropped unread. */
export const registerSceneFailureIpc = () => {
  const listener = (_event: unknown, raw: unknown) => {
    const entry = readSceneFailureEntry(raw);
    if (entry) {
      logSceneFailure(entry);
    }
  };
  return onWindowMessage(SCENE_FAILURE_CHANNEL, listener);
};

/** For tests: a new session. */
export const resetSceneFailuresForTesting = () => written.clear();
