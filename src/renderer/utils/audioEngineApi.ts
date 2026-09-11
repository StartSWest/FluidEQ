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
 * The window's half of the engine channels.
 *
 * Its own file rather than more of `equalizerApi.ts`, which is already sixty
 * calls long: nothing here is about the EQ. These seven are about which piece
 * of software is processing the audio at all.
 */

import ChannelEnum from 'common/channels';
import type {
  IAudioEngineStatus,
  IAudioRestartOutcome,
  TAudioEngine,
  TSystemDspChainResult,
} from 'common/audioEngine';
import { ErrorCode } from 'common/errors';
import type { Translate } from 'common/i18n';
import type { IEngineSetupResult } from 'main/engineSetup';
import {
  buildResponseHandler,
  promisifyResult,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';

/**
 * Which engine is chosen, which are installed, and which outputs the FluidEQ
 * Engine is attached to.
 */
export const getAudioEngineStatus = (): Promise<IAudioEngineStatus> => {
  const channel = ChannelEnum.GET_AUDIO_ENGINE_STATUS;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult<IAudioEngineStatus>(
    buildResponseHandler<IAudioEngineStatus>((result, resolve) =>
      resolve(result),
    ),
    channel,
  );
};

/**
 * Switch engines.
 *
 * Resolves once the engine being left has been neutralised, the choice has
 * been recorded and the chain has been written into the new engine — so the
 * dialog can close on it, and the sound has already changed by the time it
 * does.
 */
export const setAudioEngine = (engine: TAudioEngine): Promise<void> => {
  const channel = ChannelEnum.SET_AUDIO_ENGINE;
  window.electron.ipcRenderer.sendMessage(channel, [engine]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * One call behind a Windows permission prompt, settled with what happened —
 * never rejected.
 *
 * Every one of these waits on a person first: the setup helper raises the
 * prompt, and main cannot answer until somebody does. The transport's
 * ten-second deadline used to reject the call while the prompt was still on
 * screen, and the rejection reached callers that — reasonably, for a call
 * that returns a result — did not catch it: the whole window was replaced by
 * the crash screen, over an engine install nobody had even answered yet.
 *
 * So no deadline (main replies to every one of these, and `runEngineSetup`
 * never rejects either), and anything the transport does throw comes back as
 * a failed result, which every caller already knows how to show. The engine
 * must never be able to take FluidEQ down; this is its door into the window.
 */
const promptedCall = <Type extends IEngineSetupResult | IAudioRestartOutcome>(
  channel: ChannelEnum,
  args: unknown[],
  failed: (reason: string) => Type,
): Promise<Type> => {
  window.electron.ipcRenderer.sendMessage(channel, args);
  return promisifyResult<Type>(
    buildResponseHandler<Type>((result, resolve) => resolve(result)),
    channel,
    null,
  ).catch((error: unknown) =>
    failed(error instanceof Error ? error.message : String(error)),
  );
};

const engineSetupCall = (
  channel: ChannelEnum,
  args: unknown[],
): Promise<IEngineSetupResult> =>
  promptedCall<IEngineSetupResult>(channel, args, (error) => ({
    ok: false,
    declined: false,
    error,
    endpoints: [],
  }));

/**
 * Install the FluidEQ Engine, attaching every output.
 *
 * One elevation prompt, raised by the setup helper itself. `declined` in the
 * result is the user having said no to it, which is an answer and not a
 * failure — the caller shows what it says rather than an error.
 */
export const installFluidEngine = (): Promise<IEngineSetupResult> =>
  engineSetupCall(ChannelEnum.INSTALL_FLUID_ENGINE, []);

/**
 * Put this app's engine in place of the one installed — the one an app update
 * leaves behind — and restart Windows audio onto it. `ok` only once the
 * engine installed is this app's; `declined` is the prompt answered no.
 */
export const updateFluidEngine = (): Promise<IAudioRestartOutcome> =>
  promptedCall<IAudioRestartOutcome>(
    ChannelEnum.UPDATE_FLUID_ENGINE,
    [],
    (detail) => ({ ok: false, declined: false, detail }),
  );

/** Put one output through the engine. Refused unless `guid` is one. */
export const attachFluidEngine = (guid: string): Promise<IEngineSetupResult> =>
  engineSetupCall(ChannelEnum.ATTACH_FLUID_ENGINE, [guid]);

/** Take one output back off the engine. */
export const detachFluidEngine = (guid: string): Promise<IEngineSetupResult> =>
  engineSetupCall(ChannelEnum.DETACH_FLUID_ENGINE, [guid]);

/**
 * Whether a failed switch is only Equalizer APO not being installed yet.
 *
 * Switching to Equalizer APO on a machine without it is supported: main
 * records the choice and takes the chain off the FluidEQ Engine, and then the
 * write into APO's folder fails, because the installer that makes that folder
 * runs after the switch. That failure used to end the whole apply before the
 * installer was ever started — the dialog said nothing had changed while the
 * engine had in fact been switched off.
 */
export const isAwaitingApoInstall = (
  error: unknown,
  needed: IEngineInstallsNeeded,
): boolean =>
  needed.apo &&
  typeof error === 'object' &&
  error !== null &&
  (error as { code?: unknown }).code === ErrorCode.EQUALIZER_APO_NOT_INSTALLED;

/**
 * Send the DSP rack to the engine, so it runs on every output rather than
 * inside the Library player alone.
 *
 * Resolves with what became of it rather than rejecting when it did not go
 * anywhere — under Equalizer APO it never does, and that is a supported
 * configuration the DSP page explains, not an error to raise on every slider
 * movement. Which of the three reasons it was is the whole point of the
 * answer: they need three different sentences on screen.
 */
export const setSystemDspChain = (
  values: number[],
): Promise<TSystemDspChainResult> => {
  const channel = ChannelEnum.SET_SYSTEM_DSP_CHAIN;
  window.electron.ipcRenderer.sendMessage(channel, [values]);
  return promisifyResult<TSystemDspChainResult>(
    simpleResponseHandler<TSystemDspChainResult>(),
    channel,
  );
};

/**
 * The name shown for an engine, wherever the app names one at all.
 *
 * One shared definition rather than the same two-armed comparison written out
 * at each call site — the dialog and the menu heading carried their own
 * copies of it, both as nested ternaries that needed their own lint waiver.
 */
export const engineDisplayName = (
  engine: TAudioEngine,
  t: Translate,
): string =>
  engine === 'fluid' ? t('engine.fluid.name') : t('engine.apo.name');

/**
 * Which engine variant the blocking prerequisite banner should show.
 *
 * `FLUID_ENGINE_NOT_INSTALLED` and `EQUALIZER_APO_NOT_INSTALLED` name their
 * own engine — the failure *is* that engine being absent, regardless of which
 * one is chosen. Every other blocking code (today, only `CONFIG_NOT_FOUND`) is
 * about the config file the chosen engine reads, so the banner has to ask the
 * engine status instead of the error code: reading the code alone showed
 * Equalizer APO's variant — its credit line, its installer — for a
 * `CONFIG_NOT_FOUND` on a machine running the FluidEQ Engine, which has
 * nothing to do with Equalizer APO.
 */
export const prereqBannerEngine = (
  code: ErrorCode,
  status: IAudioEngineStatus | undefined,
): TAudioEngine => {
  if (code === ErrorCode.FLUID_ENGINE_NOT_INSTALLED) {
    return 'fluid';
  }
  if (code === ErrorCode.EQUALIZER_APO_NOT_INSTALLED) {
    return 'apo';
  }
  return status?.engine === 'fluid' ? 'fluid' : 'apo';
};

/** What applying an engine choice has to install first, if anything. */
export interface IEngineInstallsNeeded {
  fluid: boolean;
  apo: boolean;
}

/**
 * Whether applying `engine` needs its installer run first.
 *
 * Pure, and fed a status read at the moment of the decision rather than the
 * one the window happened to be holding: the status the dialog was opened
 * with said Equalizer APO was not installed on every machine running the
 * FluidEQ Engine (the probe used to be skipped under `'fluid'`), so switching
 * back re-ran Equalizer APO's installer and asked for a reboot on a machine
 * that already had it.
 *
 * A status that could not be read at all is treated as "nothing to install":
 * running an installer on a guess is the expensive mistake, and the engine
 * that is genuinely missing reports itself again through the blocking banner.
 */
export const engineInstallsNeeded = (
  engine: TAudioEngine,
  status: IAudioEngineStatus | undefined,
): IEngineInstallsNeeded => ({
  fluid: engine === 'fluid' && status?.fluid.installed === false,
  apo: engine === 'apo' && status?.apo.installed === false,
});
