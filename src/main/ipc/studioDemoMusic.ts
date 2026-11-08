/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { ipcMain } from 'electron';

/**
 * The music the Publish dialog's Demo plays, so a scene can be caught moving
 * to a song when nothing is playing (Ivan, 2026-11-07: "instead of that ugly
 * sound do a nice suno instrumental for 20 secs that repeats").
 *
 * Eight bars of Ivan's own Suno track "Warm Tropical House" (4:28 to 4:45 of
 * the extended mix, 112.2 BPM, the song's phrase: ten bars to reach twenty
 * seconds joined measurably worse), cut where the sound after the end lines
 * up with the sound after the start and the last 40 ms faded into what plays
 * just before it, so the loop's join changes the sound no more than an
 * ordinary bar line inside it does. Levelled to -17 LUFS, AAC at 160 kbit/s:
 * Electron decodes it to the exact sample count of the source, where Opus in
 * MP4 lost its first 312 samples.
 *
 * Read here and handed over as bytes because the window never reads a file
 * itself: the packaged page is a `file:` page, which `fetch` cannot read.
 */

export const STUDIO_DEMO_MUSIC_CHANNEL = 'studio-demo-music';

const FILE = 'publish-demo-loop.m4a';
/** Far above the file's 350 KB; a file past it is not the one shipped. */
const MAX_BYTES = 2 * 1024 * 1024;

/** `resourcesPath` is Electron's addition to `process` (see `roomHead.ts`). */
type TProcessWithResources = NodeJS.Process & { resourcesPath?: string };

/** Beside the packaged app's resources, or the checkout's own assets. */
export const studioDemoMusicPath = (): string => {
  const { resourcesPath: resources } = process as TProcessWithResources;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'studio', FILE);
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../../assets/studio', FILE);
};

/** The loop's bytes, or nothing when the file is missing or not a file. */
export const readStudioDemoMusic = async (
  file = studioDemoMusicPath(),
): Promise<Uint8Array | undefined> => {
  try {
    const stat = await fs.promises.lstat(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) {
      return undefined;
    }
    return new Uint8Array(await fs.promises.readFile(file));
  } catch {
    return undefined;
  }
};

export const registerStudioDemoMusicIpc = () => {
  ipcMain.handle(STUDIO_DEMO_MUSIC_CHANNEL, () => readStudioDemoMusic());
  return () => ipcMain.removeHandler(STUDIO_DEMO_MUSIC_CHANNEL);
};
