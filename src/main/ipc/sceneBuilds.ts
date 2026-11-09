/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain } from 'electron';
import type { ISceneBuilds } from '../sceneBuilds';

const CHANNELS = ['scene-builds-built', 'scene-builds-last'] as const;

// A revision is a SHA-256 in hex, as the looks' listings carry it.
const isRevision = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);

/**
 * The window's side of `sceneBuilds.ts`: a look that built, and the last build
 * of one whose newest version will not. Look ids only, and only a revision the
 * stores already hand out is ever kept — nothing a page sends becomes a pack.
 */
const registerSceneBuildsIpc = (builds: ISceneBuilds) => {
  ipcMain.handle(
    'scene-builds-built',
    (_event, lookId: unknown, revision: unknown) => {
      if (typeof lookId === 'string' && isRevision(revision)) {
        builds.built(lookId, revision);
      }
    },
  );
  ipcMain.handle('scene-builds-last', (_event, lookId: unknown) =>
    typeof lookId === 'string' ? builds.lastBuilt(lookId) : undefined,
  );
  return () => {
    CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
  };
};

export default registerSceneBuildsIpc;
