/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each microphone's sound, from the window to the engine.
 *
 * A mic's rack is written to `fluideq-dsp-<mic guid>.txt` beside the outputs'
 * racks: the engine reads every endpoint's file by its id, whichever way the
 * endpoint flows, and the quit reset already deletes it with the others
 * (`isOutputConfigFileName`), so a mic passes through untouched once FluidEQ
 * is gone. Every rack is written again at launch, after a switch to the
 * FluidEQ Engine, and on every change.
 *
 * Under Equalizer APO a mic's rack is saved and not written: APO has no rack.
 */

import log from 'electron-log';
import type { TAudioEngine } from '../../common/audioEngine';
import ChannelEnum from '../../common/channels';
import { encodeChainSettings } from '../../common/dsp/chainWire';
import type { IEngineReads } from '../../common/dsp/engineLine';
import { ErrorCode } from '../../common/errors';
import {
  clampMicSoundEntry,
  IMicSoundEntry,
  IMicSoundFile,
  MIC_GUID,
  TMicSoundResult,
} from '../../common/micSound';
import type { TError, TSuccess } from '../../renderer/utils/equalizerApi';
import { readMicSound, writeMicSound } from '../micSoundStore';
import onWindowMessage from './windowMessages';

export interface IMicSoundIpcDeps {
  userDataDir: string;
  getEngine: () => TAudioEngine | null;
  isSwitching: () => boolean;
  isEngineInstalled: (engine: TAudioEngine) => Promise<boolean>;
  getConfigPath: (engine: TAudioEngine) => Promise<string>;
  /** Which of the rack's newer trailers the installed engine reads. */
  engineReads: () => Promise<IEngineReads>;
  writeSystemDspChain: (
    configDirPath: string,
    values: number[],
    endpoint?: string,
    designs?: undefined,
    engineReads?: () => Promise<IEngineReads>,
  ) => Promise<void>;
}

export const registerMicSoundIpc = ({
  userDataDir,
  getEngine,
  isSwitching,
  isEngineInstalled,
  getConfigPath,
  engineReads,
  writeSystemDspChain,
}: IMicSoundIpcDeps) => {
  let file: IMicSoundFile = readMicSound(userDataDir);

  const succeed = <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    result: T,
  ) => {
    const reply: TSuccess<T> = { result };
    event.reply(channel, reply);
  };
  const refuse = (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    errorCode: ErrorCode,
  ) => {
    const reply: TError = { errorCode };
    event.reply(channel, reply);
  };

  const save = () => {
    writeMicSound(userDataDir, file);
  };

  /**
   * One mic's rack into the FluidEQ Engine's folder. `getConfigPath` creates
   * that folder, so it is asked only once the engine is known installed.
   */
  const writeRack = async (
    guid: string,
    entry: IMicSoundEntry,
  ): Promise<TMicSoundResult> => {
    if (getEngine() !== 'fluid' || isSwitching()) {
      return 'not-fluid';
    }
    if (!(await isEngineInstalled('fluid'))) {
      return 'not-installed';
    }
    const configDirPath = await getConfigPath('fluid');
    await writeSystemDspChain(
      configDirPath,
      encodeChainSettings(entry.settings),
      guid,
      undefined,
      engineReads,
    );
    return 'written';
  };

  /** Every mic's rack again: at launch and after a switch to this engine. */
  const republish = async (): Promise<void> => {
    await Promise.all(
      Object.entries(file.mics).map(async ([guid, entry]) => {
        try {
          await writeRack(guid, entry);
        } catch (error) {
          log.error(`Could not write the rack of microphone ${guid}`, error);
        }
      }),
    );
  };

  onWindowMessage(ChannelEnum.GET_MIC_SOUND, (event) => {
    succeed(event, ChannelEnum.GET_MIC_SOUND, file);
  });

  onWindowMessage(ChannelEnum.SELECT_MIC, (event, arg) => {
    const channel = ChannelEnum.SELECT_MIC;
    const guid: unknown = Array.isArray(arg) ? arg[0] : undefined;
    if (typeof guid !== 'string' || !MIC_GUID.test(guid)) {
      refuse(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    file = { ...file, selected: guid.toUpperCase() };
    try {
      save();
      succeed(event, channel, true);
    } catch (error) {
      log.error('Could not remember the selected microphone', error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  });

  /**
   * Saved first, then written: an edit made under Equalizer APO or with the
   * engine missing is still the mic's sound the next time it can play. A
   * control still moving (`save` false) is written to the engine at every
   * step and saved only when it is let go, as the outputs' racks are.
   */
  onWindowMessage(ChannelEnum.SET_MIC_SOUND, async (event, arg) => {
    const channel = ChannelEnum.SET_MIC_SOUND;
    const guid: unknown = Array.isArray(arg) ? arg[0] : undefined;
    const raw: unknown = Array.isArray(arg) ? arg[1] : undefined;
    const persist = !Array.isArray(arg) || arg[2] !== false;
    if (typeof guid !== 'string' || !MIC_GUID.test(guid) || !raw) {
      succeed<TMicSoundResult>(event, channel, 'rejected');
      return;
    }
    const id = guid.toUpperCase();
    const entry = clampMicSoundEntry(raw);
    file = { ...file, mics: { ...file.mics, [id]: entry } };
    if (persist) {
      try {
        save();
      } catch (error) {
        log.error(`Could not save the sound of microphone ${id}`, error);
        refuse(event, channel, ErrorCode.FAILURE);
        return;
      }
    }
    try {
      const result = await writeRack(id, entry);
      succeed<TMicSoundResult>(event, channel, result);
    } catch (error) {
      log.error(`Could not write the rack of microphone ${id}`, error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  });

  return { republish };
};
