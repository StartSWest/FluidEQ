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

/**
 * `resourcesPath` is Electron's addition to `process`, and this file is one of
 * the few in main that is also loaded by plain Node: the playback host's
 * supervisor asks it where the heads are, and `smoke-supervisor.ts` runs that
 * through ts-node with its type checking on. Electron's own types are not in
 * scope there, so naming the property directly compiled everywhere except the
 * one place the code already said it had to work — `pnpm test` failed on it
 * while `pnpm typecheck` was clean. Said as what it is instead: a property
 * Electron adds and Node does not have.
 */
type TProcessWithResources = NodeJS.Process & { resourcesPath?: string };

/**
 * Where the shipped heads are: beside the packaged app's resources, or the
 * checkout's own assets under `pnpm dev` and the tests. Under plain Node there
 * is no `resourcesPath`, and the checkout's own assets are the answer.
 */
export const roomHeadsDir = (): string => {
  const { resourcesPath: resources } = process as TProcessWithResources;
  const packaged =
    resources === undefined
      ? undefined
      : path.join(resources, 'assets', 'room', 'heads');
  const development = path.join(__dirname, '../../assets/room/heads');
  return packaged !== undefined && fs.existsSync(packaged)
    ? packaged
    : development;
};

const assetPath = (head: TRoomHead): string =>
  path.join(roomHeadsDir(), `${head}.txt`);

/** The shipped head's text, for the window's own listening test. */
export const readRoomHeadText = (head: TRoomHead): Promise<string> =>
  fs.promises.readFile(assetPath(head), 'utf8');

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
