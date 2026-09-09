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
 * calls long: nothing here is about the EQ. These six are about which piece
 * of software is processing the audio at all.
 */

import ChannelEnum from 'common/channels';
import type { IAudioEngineStatus, TAudioEngine } from 'common/audioEngine';
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
 * Install the FluidEQ Engine, attaching every output.
 *
 * One elevation prompt, raised by the setup helper itself. `declined` in the
 * result is the user having said no to it, which is an answer and not a
 * failure — the caller shows what it says rather than an error.
 */
export const installFluidEngine = (): Promise<IEngineSetupResult> => {
  const channel = ChannelEnum.INSTALL_FLUID_ENGINE;
  window.electron.ipcRenderer.sendMessage(channel, []);
  return promisifyResult<IEngineSetupResult>(
    buildResponseHandler<IEngineSetupResult>((result, resolve) =>
      resolve(result),
    ),
    channel,
  );
};

/** Put one output through the engine. Rejected unless `guid` is one. */
export const attachFluidEngine = (
  guid: string,
): Promise<IEngineSetupResult> => {
  const channel = ChannelEnum.ATTACH_FLUID_ENGINE;
  window.electron.ipcRenderer.sendMessage(channel, [guid]);
  return promisifyResult<IEngineSetupResult>(
    buildResponseHandler<IEngineSetupResult>((result, resolve) =>
      resolve(result),
    ),
    channel,
  );
};

/** Take one output back off the engine. */
export const detachFluidEngine = (
  guid: string,
): Promise<IEngineSetupResult> => {
  const channel = ChannelEnum.DETACH_FLUID_ENGINE;
  window.electron.ipcRenderer.sendMessage(channel, [guid]);
  return promisifyResult<IEngineSetupResult>(
    buildResponseHandler<IEngineSetupResult>((result, resolve) =>
      resolve(result),
    ),
    channel,
  );
};

/**
 * Send the DSP rack to the engine, so it runs on every output rather than
 * inside the Library player alone.
 *
 * Resolves `false` rather than rejecting when the rack did not go anywhere —
 * under Equalizer APO it never does, and that is a supported configuration
 * the DSP page explains, not an error to raise on every slider movement.
 */
export const setSystemDspChain = (values: number[]): Promise<boolean> => {
  const channel = ChannelEnum.SET_SYSTEM_DSP_CHAIN;
  window.electron.ipcRenderer.sendMessage(channel, [values]);
  return promisifyResult<boolean>(simpleResponseHandler<boolean>(), channel);
};
