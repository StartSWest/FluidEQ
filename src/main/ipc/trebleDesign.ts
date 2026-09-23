/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ mode menu's Treble choice, kept where the FluidEQ Engine reads it.
 *
 * One file per group beside the phase files (`TREBLE_DESIGN_FILENAMES`): the
 * engine reloads when its folder changes, so a choice reaches the sound
 * without a layer file being rewritten, and fades in like any other change.
 * Whether the engine playing reads the files at all is the window's to judge,
 * from the engine status it already holds; this only reads and writes them,
 * which costs two small files where an engine status costs a run of the
 * setup helper.
 */

import log from 'electron-log';
import fs from 'fs/promises';
import path from 'path';
import ChannelEnum from '../../common/channels';
import { TAudioEngine } from '../../common/audioEngine';
import {
  DEFAULT_TREBLE_DESIGN,
  DEFAULT_TREBLE_DESIGNS,
  isTrebleDesign,
  isTrebleScope,
  ITrebleDesigns,
  TREBLE_DESIGN_FILENAMES,
  TTrebleDesign,
} from '../../common/filterDesign';
import { ErrorCode } from '../../common/errors';
import { scheduleWrite } from '../asyncWriter';
import onWindowMessage from './windowMessages';

export interface ITrebleDesignDeps {
  getConfigPath: () => Promise<string>;
  getEngine: () => TAudioEngine | null;
}

/** The engine's own rule: only the exact word is Classic. */
const readChoice = async (filePath: string): Promise<TTrebleDesign> => {
  try {
    const value = (await fs.readFile(filePath, 'utf8')).trim();
    return value === 'classic' ? 'classic' : DEFAULT_TREBLE_DESIGN;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_TREBLE_DESIGN;
    }
    throw error;
  }
};

export const registerTrebleDesignIpc = ({
  getConfigPath,
  getEngine,
}: ITrebleDesignDeps) => {
  // Asking for the engine's folder creates it, so it is asked for only while
  // the FluidEQ Engine is the one chosen: under Equalizer APO the answer is
  // the default, and no folder is made for an engine that is not there.
  const readChoices = async (): Promise<ITrebleDesigns> => {
    if (getEngine() !== 'fluid') {
      return { ...DEFAULT_TREBLE_DESIGNS };
    }
    const folder = await getConfigPath();
    const [eq, curves] = await Promise.all([
      readChoice(path.join(folder, TREBLE_DESIGN_FILENAMES.eq)),
      readChoice(path.join(folder, TREBLE_DESIGN_FILENAMES.curves)),
    ]);
    return { eq, curves };
  };

  onWindowMessage(ChannelEnum.GET_TREBLE_DESIGN, async (event) => {
    try {
      event.reply(ChannelEnum.GET_TREBLE_DESIGN, {
        result: await readChoices(),
      });
    } catch (error) {
      log.error('Could not read the treble choice', error);
      event.reply(ChannelEnum.GET_TREBLE_DESIGN, {
        errorCode: ErrorCode.FAILURE,
      });
    }
  });

  onWindowMessage(ChannelEnum.SET_TREBLE_DESIGN, async (event, args) => {
    const channel = ChannelEnum.SET_TREBLE_DESIGN;
    const choice: unknown = Array.isArray(args) ? args[0] : undefined;
    const scope: unknown = Array.isArray(args) ? args[1] : undefined;
    if (!isTrebleDesign(choice) || !isTrebleScope(scope)) {
      event.reply(channel, { errorCode: ErrorCode.INVALID_PARAMETER });
      return;
    }
    try {
      if (getEngine() === 'fluid') {
        await scheduleWrite(
          path.join(await getConfigPath(), TREBLE_DESIGN_FILENAMES[scope]),
          `${choice}\r\n`,
        );
      }
      // Read back once the write has landed, so the menu shows what the
      // engine will read — never a choice a sealed folder refused.
      event.reply(channel, { result: await readChoices() });
    } catch (error) {
      log.error('Could not apply the treble choice', error);
      event.reply(channel, { errorCode: ErrorCode.FAILURE });
    }
  });
};
