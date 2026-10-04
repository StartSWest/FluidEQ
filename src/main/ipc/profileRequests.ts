/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import type { IProfilesIpcDeps } from './profiles';
import onWindowMessage from './windowMessages';

const MAX_DEVICE_ID_LENGTH = 256;

export const profileRequestDeviceId = (
  request: unknown,
): string | undefined => {
  if (request === undefined) {
    return undefined;
  }
  if (
    request === null ||
    typeof request !== 'object' ||
    Array.isArray(request) ||
    !('deviceId' in request) ||
    typeof request.deviceId !== 'string' ||
    !request.deviceId.trim() ||
    // A Windows endpoint id is about sixty printable characters; anything
    // longer, or with a control character in it, names no output.
    request.deviceId.length > MAX_DEVICE_ID_LENGTH ||
    [...request.deviceId].some((character) => character < ' ')
  ) {
    throw new Error('Invalid output profile request.');
  }
  return request.deviceId;
};

export interface IProfileRequestOwner {
  deviceId: string;
  generation: number;
  presetDir: string;
  baselineDir: string;
  isCurrent: () => boolean;
  checkCurrent: () => boolean;
}

/**
 * A profile action belongs to the editor that received it. Queued work used
 * to read whichever editor happened to be open later, so an action on main
 * could save or attach a secondary output's sound instead.
 */
export const createProfileMutationListener = (deps: IProfilesIpcDeps) => {
  const { session, handleError, runProfileMutation } = deps;
  return (
    channel: ChannelEnum,
    nameCount: 1 | 2,
    work: (
      event: Electron.IpcMainEvent,
      names: string[],
      owner: IProfileRequestOwner,
    ) => Promise<void>,
  ): void => {
    onWindowMessage(channel, async (event, arg) => {
      const invalid = () =>
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      const values: unknown[] = Array.isArray(arg) ? arg : [];
      const names = values.slice(0, nameCount);
      if (
        names.length !== nameCount ||
        !names.every((name): name is string => typeof name === 'string')
      ) {
        invalid();
        return;
      }
      let expectedDeviceId: string | undefined;
      try {
        expectedDeviceId = profileRequestDeviceId(values[nameCount]);
      } catch {
        invalid();
        return;
      }
      if (
        expectedDeviceId !== undefined &&
        expectedDeviceId !== session.activeAudioDeviceId
      ) {
        invalid();
        return;
      }
      let presetDir: string;
      let baselineDir: string;
      try {
        presetDir = deps.activePresetDir();
        baselineDir = deps.activeBaselineDir();
      } catch {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
        return;
      }
      // Rename/delete address captured files, not the sound currently open.
      // Deleting an attached profile creates a replacement and changes its sound
      // generation; that must not cancel another queued file action on this output.
      const targetsNamedFiles =
        channel === ChannelEnum.DELETE_PRESET ||
        channel === ChannelEnum.RENAME_PRESET;
      const owner: IProfileRequestOwner = {
        deviceId: session.activeAudioDeviceId,
        generation: session.outputEditGeneration ?? 0,
        presetDir,
        baselineDir,
        isCurrent: () =>
          owner.deviceId === session.activeAudioDeviceId &&
          (targetsNamedFiles ||
            owner.generation === (session.outputEditGeneration ?? 0)),
        checkCurrent: () => {
          if (owner.isCurrent()) {
            return true;
          }
          invalid();
          return false;
        },
      };
      await runProfileMutation(async () => {
        if (owner.checkCurrent()) {
          await work(event, names, owner);
        }
      });
    });
  };
};
