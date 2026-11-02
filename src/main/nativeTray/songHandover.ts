/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import path from 'path';
import { FLUID_ENGINE_PROGRAMME_FILENAME } from '../../common/audioEngine';
import { OUTPUT_CONFIG_BASENAMES } from '../../common/outputConfigFiles';
import { SONG_LEVELS_FILENAME } from '../songLevels';
import type { ITraySongsHandover } from './trayHostWire';

export interface ISongHandoverDeps {
  /**
   * The FluidEQ Engine's config folder while it is the engine in use,
   * installed and not mid-switch — the song programme's own rule — or none.
   */
  resolveConfigDir: () => Promise<string | undefined>;
  /** `FluidEQ-Media.exe`, where this build has it. */
  mediaExecutable: string | undefined;
  /** The app's own id, the media helper's one argument (`systemMedia.ts`). */
  selfId: string;
  userDataDir: string;
  /** The output Windows plays through now, as main follows it. */
  mainEndpoint: string | undefined;
}

/**
 * What the tray needs to tell the FluidEQ Engine the playing song while main
 * is gone (`native/tray-host/src/song_watch.h`): only under that engine, as
 * main's own song programme writes only there, and only with the media
 * helper to read the song from. The statuses are the engine's root, the
 * config folder's parent, as main reads them.
 */
export const songHandover = async ({
  resolveConfigDir,
  mediaExecutable,
  selfId,
  userDataDir,
  mainEndpoint,
}: ISongHandoverDeps): Promise<ITraySongsHandover | undefined> => {
  if (!mediaExecutable) {
    return undefined;
  }
  const configDir = await resolveConfigDir();
  if (!configDir) {
    return undefined;
  }
  return {
    mediaExe: mediaExecutable,
    selfId,
    configDir,
    statusDir: path.dirname(configDir),
    levelsFile: path.join(userDataDir, SONG_LEVELS_FILENAME),
    rootName: FLUID_ENGINE_PROGRAMME_FILENAME,
    // `outputConfigFileName`'s own prefix: the GUID and `.txt` follow it.
    perOutputPrefix: `${OUTPUT_CONFIG_BASENAMES.programme.slice(0, -4)}-`,
    ...(mainEndpoint ? { mainEndpoint } : {}),
  };
};
