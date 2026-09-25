/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Main following a change of output that nobody in the window asked about.
 *
 * The switch to a new output's profile lived inside the window's
 * GET_AUDIO_DEVICES handler, so main learned of a headset only when the
 * window polled — every three seconds on screen, never while it was hidden
 * or in the tray. The output watcher's reading now goes through the same
 * following (`followOutputs`), and the answer is pushed to the window in the
 * reply's own shape. These drive the real handlers against a temporary
 * profile store.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from '../../../common/channels';
import { ErrorCode } from '../../../common/errors';
import {
  IAudioDevice,
  IDeviceProfileSettings,
  getDefaultState,
} from '../../../common/constants';
import type { IProfilesIpcDeps } from '../../../main/ipc/profiles';
import { flushPendingWrites } from '../../../main/asyncWriter';

type THandler = (
  event: { reply: jest.Mock },
  arg: unknown,
) => void | Promise<void>;

const handlers = new Map<string, THandler>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: (channel: string, handler: THandler) => {
      handlers.set(channel, handler);
    },
  },
  app: { getPath: () => '' },
}));

jest.mock('../../../main/registry', () => ({
  getConfigPath: async () => '',
  isEqualizerAPOInstalled: async () => true,
}));

const mockDiscover = jest.fn();
jest.mock('../../../main/audioDevices', () => ({
  ...jest.requireActual('../../../main/audioDevices'),
  discoverAudioDevices: () => mockDiscover(),
}));

// eslint-disable-next-line import/first
import { registerProfilesIpc } from '../../../main/ipc/profiles';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{speakers}',
  isDefault: true,
  isActive: true,
};
const headset: IAudioDevice = {
  id: 'headset',
  name: 'Headset',
  guid: '{headset}',
  isDefault: true,
  isActive: true,
};
const idleSpeakers = { ...speakers, isDefault: false };

describe('following the outputs Windows reported', () => {
  let root: string;
  let session: IProfilesIpcDeps['session'];
  let applyDeviceState: jest.Mock;
  let notifyOutputStateChanged: jest.Mock;
  let guardAgainstApo: jest.Mock;
  let adoptExistingApoConfig: jest.Mock;
  let profiles: ReturnType<typeof registerProfilesIpc>;

  beforeEach(() => {
    handlers.clear();
    mockDiscover.mockReset();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-follow-outputs-'));
    const settings: IDeviceProfileSettings = { version: 1, assignments: {} };
    session = {
      configPath: root,
      activeAudioDeviceId: speakers.id,
      activeAudioDevice: speakers,
      hasActiveSessionOverride: true,
      audioEngine: 'fluid',
    };
    applyDeviceState = jest.fn();
    notifyOutputStateChanged = jest.fn();
    guardAgainstApo = jest.fn(async () => undefined);
    adoptExistingApoConfig = jest.fn(() => undefined);
    profiles = registerProfilesIpc({
      state: getDefaultState(),
      userDataDir: root,
      presetDirForDevice: (deviceId) => path.join(root, 'presets', deviceId),
      activePresetDir: () =>
        path.join(root, 'presets', session.activeAudioDeviceId),
      activeBaselineDir: () => path.join(root, 'baselines'),
      deviceProfileSettings: settings,
      session,
      handleUpdate: async () => undefined,
      handleUpdateHelper: async () => undefined,
      // As main's own: the failure goes back through whatever asked.
      handleError: (event, channel, errorCode, detail) => {
        event.reply(channel, { errorCode, ...(detail ? { detail } : {}) });
      },
      runProfileMutation: async (work) => work(),
      attachPresetToActiveDevice: () => undefined,
      clearCurrentLayoutSettings: () => undefined,
      createEmptyProfileForActiveDevice: () => undefined,
      getCurrentPreset: () => ({ preAmp: 0, filters: {} }),
      hydrateActiveConvolution: () => undefined,
      isAutomaticPresetName: (name) => name.startsWith('.fluideq-auto-'),
      availableProfileNameForActiveDevice: (name) => name,
      resetStateToDefaults: () => undefined,
      adoptExistingApoConfig,
      applyDeviceState,
      captureCurrentLayout: () => undefined,
      notifyOutputStateChanged,
      guardAgainstApo,
    });
  });

  afterEach(async () => {
    // A switch saves the state file in the background. Deleting the folder
    // under that write made its rename fail after the file's tests had
    // finished, and Jest fails a run that logs then, every test green.
    await flushPendingWrites();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('moves to a new default output with nobody asking, and tells the window', async () => {
    const send = jest.fn();
    const devices = [headset, idleSpeakers];

    await profiles.followOutputs(devices, send);

    expect(session.activeAudioDeviceId).toBe(headset.id);
    expect(session.hasActiveSessionOverride).toBe(false);
    expect(applyDeviceState).toHaveBeenCalledTimes(1);
    expect(notifyOutputStateChanged).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(ChannelEnum.AUDIO_DEVICES_CHANGED, {
      result: devices,
    });
    expect(guardAgainstApo).toHaveBeenCalledWith(devices);
  });

  it('only passes the list on when the default has not moved', async () => {
    const send = jest.fn();
    const devices = [speakers];

    await profiles.followOutputs(devices, send);

    expect(applyDeviceState).not.toHaveBeenCalled();
    expect(notifyOutputStateChanged).not.toHaveBeenCalled();
    expect(session.hasActiveSessionOverride).toBe(true);
    expect(send).toHaveBeenCalledWith(ChannelEnum.AUDIO_DEVICES_CHANGED, {
      result: devices,
    });
  });

  it('pushes the refusal a request would have been answered with', async () => {
    adoptExistingApoConfig.mockReturnValue(false);
    const send = jest.fn();

    await profiles.followOutputs([headset], send);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      ChannelEnum.AUDIO_DEVICES_CHANGED,
      expect.objectContaining({ errorCode: ErrorCode.FAILURE }),
    );
    // The switch is as real as on the window's own request.
    expect(session.activeAudioDeviceId).toBe(headset.id);
  });

  it('pushes a failure instead of throwing into the watcher', async () => {
    applyDeviceState.mockImplementation(() => {
      throw new Error('broken profile');
    });
    const send = jest.fn();

    await expect(profiles.followOutputs([headset], send)).resolves.toBe(
      undefined,
    );
    expect(send).toHaveBeenCalledWith(ChannelEnum.AUDIO_DEVICES_CHANGED, {
      errorCode: ErrorCode.FAILURE,
    });
  });

  it("follows the window's own request the same way, and a later push does not switch again", async () => {
    mockDiscover.mockResolvedValue([headset, idleSpeakers]);
    const reply = jest.fn();

    await handlers.get(ChannelEnum.GET_AUDIO_DEVICES)?.({ reply }, []);

    expect(reply).toHaveBeenCalledWith(ChannelEnum.GET_AUDIO_DEVICES, {
      result: [headset, idleSpeakers],
    });
    expect(applyDeviceState).toHaveBeenCalledTimes(1);

    const send = jest.fn();
    await profiles.followOutputs([headset, idleSpeakers], send);
    expect(applyDeviceState).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
