/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import path from 'path';
import { ANIMATIONS_DIR } from '../../common/studioAnimation';
import { ARTWORK_SOURCES_FILE } from './artworkSources';
import {
  STARTER_ANIMATION,
  STARTER_ANIMATION_NAME,
  STARTER_ART_FILES,
  STARTER_ARTWORK_SOURCES,
} from './starterScene';

/** `resourcesPath` is Electron's addition to `process` (see `roomHead.ts`). */
type TProcessWithResources = NodeJS.Process & { resourcesPath?: string };

/**
 * The starter's art as FluidEQ ships it, beside the packaged app's resources
 * or in the checkout's own assets, as the Studio's skills are found
 * (`studioSkills.ts`).
 */
export const starterArtDir = (): string => {
  const { resourcesPath: resources } = process as TProcessWithResources;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'studio', 'starter');
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : path.join(__dirname, '../../../assets/studio/starter');
};

/** A new file, never one written over: `false` when one was already there. */
const writeNew = async (target: string, contents: Buffer | string) => {
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  try {
    await fs.promises.writeFile(target, contents, { flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
};

/**
 * The starter's picture, its swallow's sheet and the swallow's animation
 * file, written into a new project before its `pack.json` names them. Each
 * is created exclusively: a file of the same name already in the folder is
 * somebody's, and is kept as it is.
 *
 * The art is read from the shipped folder and is part of the app: a build
 * without it is broken, and says so here rather than writing a starter whose
 * `pack.json` names an image that is not there.
 */
export const writeStarterArt = async (
  folder: string,
  artDir: string = starterArtDir(),
): Promise<void> => {
  const art = await Promise.all(
    STARTER_ART_FILES.map(async (relative) => ({
      relative,
      bytes: await fs.promises.readFile(path.join(artDir, relative)),
    })),
  );
  await Promise.all(
    art.map(({ relative, bytes }) =>
      writeNew(path.join(folder, relative), bytes),
    ),
  );
  await writeNew(
    path.join(folder, ANIMATIONS_DIR, `${STARTER_ANIMATION_NAME}.json`),
    `${JSON.stringify(STARTER_ANIMATION, null, 2)}\n`,
  );
  // Which picture the artwork's swallow was packed from, as pack_artwork
  // records it, so the Animations tab knows the scene plays the swallow.
  await writeNew(
    path.join(folder, ARTWORK_SOURCES_FILE),
    `${JSON.stringify(STARTER_ARTWORK_SOURCES, null, 2)}\n`,
  );
};
