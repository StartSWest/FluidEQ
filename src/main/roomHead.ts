/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The room's head, written where the engine reads it.
 *
 * The engine renders the room through a measured head — a ring of ear
 * responses — that ships with the app under `assets/room/heads/` and is
 * copied beside the rack file as `fluideq-room-head.txt` (`room_head.h` on
 * the engine side reads it). Written only when the head changes: the file is
 * half a megabyte and the engine reloads on every write it sees in that
 * folder, so rewriting it with every rack change would rebuild every
 * output's chain on every slider frame.
 */

import fs from 'fs';
import path from 'path';
import { TRoomHead } from '../common/dsp/chain';
import { scheduleWrite } from './asyncWriter';

export const ROOM_HEAD_FILENAME = 'fluideq-room-head.txt';

const assetPath = (head: TRoomHead): string => {
  // `resourcesPath` is Electron's; under plain Node (the tests) there is
  // none, and the checkout's own assets are the ones to read.
  const resources: string | undefined = process.resourcesPath;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'room', 'heads', `${head}.txt`);
  const development = path.join(
    __dirname,
    '../../assets/room/heads',
    `${head}.txt`,
  );
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : development;
};

/** Per config folder, which head its file carries — after the write. */
const written = new Map<string, TRoomHead>();

/**
 * Ask for `head` to be the head file in `configDirPath`. Nothing when it
 * already is; the write itself goes through the coalescing writer like the
 * rack's. Rejects when the shipped head cannot be read, which is an install
 * missing its assets and worth a line in the log from the caller.
 */
export const writeRoomHead = async (
  configDirPath: string,
  head: TRoomHead,
): Promise<void> => {
  if (written.get(configDirPath) === head) {
    return;
  }
  const text = await fs.promises.readFile(assetPath(head), 'utf8');
  written.set(configDirPath, head);
  try {
    await scheduleWrite(path.join(configDirPath, ROOM_HEAD_FILENAME), text);
  } catch (error) {
    // Not written after all: the next rack must try again.
    written.delete(configDirPath);
    throw error;
  }
};

/** For tests and for a switch that empties the folder: forget what is there. */
export const forgetRoomHead = (configDirPath?: string): void => {
  if (configDirPath === undefined) {
    written.clear();
  } else {
    written.delete(configDirPath);
  }
};
