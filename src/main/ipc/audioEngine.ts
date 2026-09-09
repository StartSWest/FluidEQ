/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Which engine processes the audio, and everything that follows from
 * changing the answer.
 *
 * Six channels, and the two that matter are `SET_AUDIO_ENGINE` — where the
 * order of four steps is the whole correctness of the feature — and
 * `SET_SYSTEM_DSP_CHAIN`, which is the only path by which a renderer-built
 * array of doubles reaches a file the audio driver reads.
 *
 * Everything this needs is injected. Not for testability alone: the engine
 * setup helper self-elevates, so the module that decides when it runs must
 * not also be the module that knows how to spawn it.
 */

import { ipcMain } from 'electron';
import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  IAudioEngineStatus,
  TAudioEngine,
  TSystemDspChainResult,
  isAudioEngine,
} from '../../common/audioEngine';
import { isChainWirePayload } from '../../common/dsp/chainWire';
import { TError, TSuccess } from '../../renderer/utils/equalizerApi';
import { saveAudioEnginePreference } from '../audioEngineStore';
import { IEngineSetupResult, TEngineSetupCommand } from '../engineSetup';

/**
 * An audio endpoint GUID as Windows spells it: braces, and nothing inside
 * them but hex and dashes.
 *
 * Checked here rather than trusted, because the value goes to a helper that
 * relaunches itself elevated. `execFile` already means no shell can
 * interpret it, so this is not about quoting — it is about never asking an
 * administrator process to act on a string the window made up.
 */
const ENDPOINT_GUID = /^\{[0-9A-Fa-f-]{36}\}$/;

/**
 * What the update path answered, for a caller that ran it with no request in
 * flight.
 *
 * `error` is the reply the update path would have sent to a window, carried
 * across unchanged so the handler that asked for the reflush can send exactly
 * that instead of inventing a second wording for the same failure.
 */
export type TReflushResult = { ok: true } | { ok: false; error: TError };

export interface IAudioEngineIpcDeps {
  /** `%APPDATA%\FluidEQ` — where `audio-engine.json` is kept. */
  userDataDir: string;
  /**
   * Read per call, never captured.
   *
   * The engine lives on main's `session` object and changes underneath this
   * module — `SET_AUDIO_ENGINE` is what changes it. A value read at
   * registration would answer with whatever the app started up as, forever.
   */
  getEngine: () => TAudioEngine | null;
  /**
   * Records the new engine AND clears the cached config directory, so the
   * next flush resolves the other engine's path instead of writing the new
   * engine's chain into the old engine's folder.
   */
  setEngine: (engine: TAudioEngine) => void;
  /**
   * Raised for the length of the switch, so an EQ edit that arrives while it
   * runs does not flush into the directory being left.
   *
   * Between neutralising the old engine and reflushing into the new one the
   * session still names the old engine's directory, and the update path would
   * happily write the live chain back over the neutral root that was just put
   * there — leaving both engines processing the same audio.
   */
  setSwitching: (isSwitching: boolean) => void;
  getConfigPath: (engine: TAudioEngine) => Promise<string>;
  /** Whether the engine's driver is on this machine at all. */
  isEngineInstalled: (engine: TAudioEngine) => Promise<boolean>;
  /** Re-runs the update path for the current state, and says whether it landed. */
  reflush: () => Promise<TReflushResult>;
  runEngineSetup: (
    command: TEngineSetupCommand,
    args: string[],
  ) => Promise<IEngineSetupResult>;
  readAudioEngineStatus: (
    userDataDir: string,
    engine: TAudioEngine | null,
  ) => Promise<IAudioEngineStatus>;
  /** Writes the neutral root into the engine being left. */
  neutraliseEngine: (
    other: TAudioEngine,
  ) => Promise<'written' | 'not-installed'>;
  writeSystemDspChain: (
    configDirPath: string,
    values: number[],
  ) => Promise<void>;
}

export const registerAudioEngineIpc = ({
  userDataDir,
  getEngine,
  setEngine,
  setSwitching,
  getConfigPath,
  isEngineInstalled,
  reflush,
  runEngineSetup,
  readAudioEngineStatus,
  neutraliseEngine,
  writeSystemDspChain,
}: IAudioEngineIpcDeps) => {
  /**
   * The same reply shape main.ts's `handleError` builds, rebuilt here because
   * that one is not exported. Kept to one place in this file so the two
   * cannot drift apart line by line.
   */
  const replyError = (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    reply: TError,
  ) => {
    log.info(channel);
    event.reply(channel, reply);
  };

  const refuse = (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    errorCode: ErrorCode,
  ) => replyError(event, channel, { errorCode });

  const succeed = <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    result: T,
  ) => {
    const reply: TSuccess<T> = { result };
    event.reply(channel, reply);
  };

  ipcMain.on(ChannelEnum.GET_AUDIO_ENGINE_STATUS, async (event) => {
    const channel = ChannelEnum.GET_AUDIO_ENGINE_STATUS;
    try {
      succeed(
        event,
        channel,
        await readAudioEngineStatus(userDataDir, getEngine()),
      );
    } catch (error) {
      log.error('Could not read the audio engine status', error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  });

  /**
   * Switch engines, in an order that is not negotiable.
   *
   * Neutralise the old engine, save the preference, point the session at the
   * new engine, reflush. Any other order leaves a window in which both
   * engines hold a chain and every output is processed twice — and doing it
   * after the reflush would mean the moment of correction is the moment the
   * user is most likely to be listening for the change.
   *
   * The preference is saved before the reflush rather than after it, so a
   * flush that fails still leaves the app restarting into the engine the user
   * asked for instead of silently reverting. The reply, though, is the
   * reflush's own answer: the choice is kept AND the failure is reported,
   * because replying success on a chain that never reached an engine is how
   * "I switched and nothing happened" becomes a silent bug rather than the
   * banner that says which engine is missing.
   */
  ipcMain.on(ChannelEnum.SET_AUDIO_ENGINE, async (event, arg) => {
    const channel = ChannelEnum.SET_AUDIO_ENGINE;
    const next: unknown = Array.isArray(arg) ? arg[0] : undefined;
    if (!isAudioEngine(next)) {
      refuse(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    const current = getEngine();
    if (next === current) {
      succeed(event, channel, undefined);
      return;
    }

    try {
      // Cleared in `finally` and not after `setEngine`: a neutralise that
      // throws must not leave the flag raised, or every EQ edit for the rest
      // of the session would be silently swallowed by the update path.
      setSwitching(true);
      try {
        if (current !== null) {
          await neutraliseEngine(current);
        }
        saveAudioEnginePreference(userDataDir, next);
        setEngine(next);
      } finally {
        setSwitching(false);
      }
      const outcome = await reflush();
      if (outcome.ok) {
        succeed(event, channel, undefined);
      } else {
        replyError(event, channel, outcome.error);
      }
    } catch (error) {
      log.error(`Could not switch the audio engine to ${next}`, error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  });

  /**
   * One command, one reply, one reflush if it worked.
   *
   * A declined elevation prompt is not a failure to report as one: the user
   * said no, the result says so, and the dialog shows that rather than an
   * error. Reflushing after a decline would write into a directory the
   * engine still is not reading.
   *
   * The reflush's own answer is deliberately not the reply here, unlike the
   * switch: what was asked was "install this", and whether that worked is
   * `result`. A flush that failed afterwards is logged where it happens and
   * shows up as the banner, not as an install that is reported to have
   * failed when it did not.
   */
  const runAndReflush = async (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    command: TEngineSetupCommand,
    args: string[],
  ) => {
    try {
      const result = await runEngineSetup(command, args);
      if (result.ok) {
        await reflush();
      }
      succeed(event, channel, result);
    } catch (error) {
      log.error(`FluidEQ Engine setup (${command}) failed`, error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  };

  ipcMain.on(ChannelEnum.INSTALL_FLUID_ENGINE, async (event) => {
    // Attach every endpoint and restart the audio service: an install that
    // attaches nothing looks exactly like an install that did not work.
    await runAndReflush(event, ChannelEnum.INSTALL_FLUID_ENGINE, 'install', [
      '--attach-all',
      '--restart-audio',
    ]);
  });

  const endpointCommand = async (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    command: TEngineSetupCommand,
    arg: unknown,
  ) => {
    const guid: unknown = Array.isArray(arg) ? arg[0] : undefined;
    if (typeof guid !== 'string' || !ENDPOINT_GUID.test(guid)) {
      refuse(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    await runAndReflush(event, channel, command, [guid, '--restart-audio']);
  };

  ipcMain.on(ChannelEnum.ATTACH_FLUID_ENGINE, async (event, arg) => {
    await endpointCommand(
      event,
      ChannelEnum.ATTACH_FLUID_ENGINE,
      'attach',
      arg,
    );
  });

  ipcMain.on(ChannelEnum.DETACH_FLUID_ENGINE, async (event, arg) => {
    await endpointCommand(
      event,
      ChannelEnum.DETACH_FLUID_ENGINE,
      'detach',
      arg,
    );
  });

  /**
   * The rack, system-wide — and the three ways it can decline are named
   * rather than collapsed into one `false`.
   *
   * Under Equalizer APO the rack is Library-only and there is nothing wrong
   * with that: the DSP page says so and offers the engine dialog. Replying
   * with a blocking error every time a slider moves would turn a supported
   * configuration into a wall — but a single boolean made "your engine is not
   * the one that can do this", "the engine is chosen and missing" and "that
   * payload was malformed" the same answer, and only the first of those is
   * something the page can explain to anybody.
   *
   * The installed check is not optional and not merely informative:
   * `getConfigPath('fluid')` CREATES the engine's directory under
   * `%ProgramData%`, so asking it first would leave a config folder on a
   * machine with no engine to read it.
   *
   * `isChainWirePayload` is the gate on the values, and it already rejects
   * `NaN` and `Infinity` (it requires every entry to be `Number.isFinite`) as
   * well as any array whose length disagrees with the band count it carries.
   */
  ipcMain.on(ChannelEnum.SET_SYSTEM_DSP_CHAIN, async (event, arg) => {
    const channel = ChannelEnum.SET_SYSTEM_DSP_CHAIN;
    const values: unknown = Array.isArray(arg) ? arg[0] : undefined;
    if (!isChainWirePayload(values)) {
      succeed<TSystemDspChainResult>(event, channel, 'rejected');
      return;
    }
    if (getEngine() !== 'fluid') {
      succeed<TSystemDspChainResult>(event, channel, 'not-fluid');
      return;
    }

    try {
      if (!(await isEngineInstalled('fluid'))) {
        succeed<TSystemDspChainResult>(event, channel, 'not-installed');
        return;
      }
      // Resolved here rather than read off the session, because the session's
      // cached path is empty until the first flush of the launch and the rack
      // can be edited before that ever happens.
      const configDirPath = await getConfigPath('fluid');
      await writeSystemDspChain(configDirPath, values);
      succeed<TSystemDspChainResult>(event, channel, 'written');
    } catch (error) {
      // A disk that would not take the file is a fault, not one of the three
      // supported refusals above, and is the one case here worth raising.
      log.error('Could not write the system-wide DSP chain', error);
      refuse(event, channel, ErrorCode.FAILURE);
    }
  });
};
