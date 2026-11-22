/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Each microphone's sound, between the Mic tab and main (`ipc/micSound.ts`). */

import ChannelEnum from 'common/channels';
import type {
  IMicSoundEntry,
  IMicSoundFile,
  TMicEffects,
  TMicSoundResult,
} from 'common/micSound';
import { buildResponseHandler, sendRequest } from './ipcRequest';

export const getMicSound = (): Promise<IMicSoundFile> =>
  sendRequest<IMicSoundFile>(
    ChannelEnum.GET_MIC_SOUND,
    [],
    buildResponseHandler<IMicSoundFile>((result, resolve) => resolve(result)),
  );

/**
 * One mic's sound. `save` false while a control is moving: the rack is
 * written to the engine every step, the file only when the control is let go.
 */
export const setMicSound = (
  guid: string,
  entry: IMicSoundEntry,
  save: boolean,
): Promise<TMicSoundResult> =>
  sendRequest<TMicSoundResult>(
    ChannelEnum.SET_MIC_SOUND,
    [guid, entry, save],
    buildResponseHandler<TMicSoundResult>((result, resolve) => resolve(result)),
  );

/** Windows' "Audio enhancements" switch for one mic. */
export const getMicEffects = (guid: string): Promise<TMicEffects> =>
  sendRequest<TMicEffects>(
    ChannelEnum.GET_MIC_EFFECTS,
    [guid],
    buildResponseHandler<TMicEffects>((result, resolve) => resolve(result)),
  );

export const selectMic = (guid: string): Promise<boolean> =>
  sendRequest<boolean>(
    ChannelEnum.SELECT_MIC,
    [guid],
    buildResponseHandler<boolean>((result, resolve) => resolve(result)),
  );
