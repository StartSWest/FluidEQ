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
 * Renaming and deleting a profile, driven through the IPC handlers themselves.
 *
 * The helpers underneath have their own tests, and they passed while the bug
 * was live: `renameAssignedPreset` did exactly what it was asked, and what it
 * was asked was wrong. What was untested was the handler — which output it
 * names, and whether the file it moves and the assignment it rewrites are the
 * same output's. So these fire the real channels against a real temporary
 * profile store and read the disk afterwards.
 *
 * The shape that made this worth doing: every output FluidEQ names for itself
 * gets "Untitled profile 1", so a machine with two outputs has two different
 * profiles under one name, in two folders. A rename must move one of them.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { ErrorCode } from '../../../common/errors';
import ChannelEnum from '../../../common/channels';
import {
  FilterTypeEnum,
  IDeviceProfileSettings,
  IPresetV2,
  IState,
  getDefaultState,
} from '../../../common/constants';

type THandler = (
  event: { reply: jest.Mock },
  arg: unknown,
) => void | Promise<void>;

const handlers = new Map<string, THandler>();

jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: THandler) => {
      handlers.set(channel, handler);
    },
  },
}));

jest.mock('../../../main/registry', () => ({
  getConfigPath: async () => '',
  isEqualizerAPOInstalled: async () => true,
}));

// eslint-disable-next-line import/first
import { registerProfilesIpc } from '../../../main/ipc/profiles';
// eslint-disable-next-line import/first
import { savePreset, savePresetBaseline } from '../../../main/flush';

const HEADPHONES = 'headphones';
const SPEAKERS = 'speakers';
/** The name both outputs give their first profile, which is the whole problem. */
const SHARED = 'Untitled profile 1';

const presetWith = (gain: number): IPresetV2 => ({
  preAmp: 0,
  filters: {
    a: { id: 'a', frequency: 120, gain, quality: 1.1, type: FilterTypeEnum.PK },
  },
});

const assignmentFor = (deviceId: string, presetName: string) => ({
  deviceId,
  deviceName: deviceId,
  deviceGuid: `{${deviceId}}`,
  presetName,
});

describe('renaming and deleting a profile through IPC', () => {
  let root: string;
  let state: IState;
  let settings: IDeviceProfileSettings;
  let activeDeviceId: string;
  let errors: ErrorCode[];
  let mutations: number;

  const presetDirFor = (deviceId: string) =>
    path.join(root, 'presets', deviceId);
  const baselineDirFor = (deviceId: string) =>
    path.join(root, 'preset-baselines', deviceId);

  const presetExists = (deviceId: string, name: string) =>
    fs.existsSync(path.join(presetDirFor(deviceId), name));
  const baselineExists = (deviceId: string, name: string) =>
    fs.existsSync(path.join(baselineDirFor(deviceId), name));

  /** Fire one channel and hand back the reply spy. */
  const fire = async (channel: ChannelEnum, arg: unknown) => {
    const reply = jest.fn();
    await handlers.get(channel)?.({ reply }, arg);
    return reply;
  };

  beforeEach(() => {
    handlers.clear();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-profile-ipc-'));
    state = getDefaultState();
    activeDeviceId = HEADPHONES;
    errors = [];
    mutations = 0;

    settings = {
      version: 1,
      assignments: {
        [HEADPHONES]: assignmentFor(HEADPHONES, SHARED),
        [SPEAKERS]: assignmentFor(SPEAKERS, SHARED),
      },
    };

    // Two outputs, two different profiles, one name.
    [HEADPHONES, SPEAKERS].forEach((deviceId, index) => {
      fs.mkdirSync(presetDirFor(deviceId), { recursive: true });
      savePreset(SHARED, presetWith(index + 1), presetDirFor(deviceId));
      savePresetBaseline(
        SHARED,
        presetWith(index + 1),
        baselineDirFor(deviceId),
      );
    });

    registerProfilesIpc({
      state,
      userDataDir: root,
      presetDirForDevice: presetDirFor,
      activePresetDir: () => presetDirFor(activeDeviceId),
      activeBaselineDir: () => baselineDirFor(activeDeviceId),
      deviceProfileSettings: settings,
      session: {
        configPath: '',
        get activeAudioDeviceId() {
          return activeDeviceId;
        },
        activeAudioDevice: undefined,
        hasActiveSessionOverride: false,
      },
      handleUpdate: async () => undefined,
      handleUpdateHelper: async () => undefined,
      handleError: (_event, _channel, errorCode) => {
        errors.push(errorCode);
      },
      runProfileMutation: async (work) => {
        mutations += 1;
        await work();
      },
      attachPresetToActiveDevice: () => undefined,
      clearCurrentLayoutSettings: () => undefined,
      createEmptyProfileForActiveDevice: () => undefined,
      getCurrentPreset: () => presetWith(0),
      hydrateActiveConvolution: () => undefined,
      isAutomaticPresetName: (name) => name.startsWith('.fluideq-auto-'),
      availableProfileNameForActiveDevice: (name) => name,
      resetStateToDefaults: () => undefined,
      adoptExistingApoConfig: () => undefined,
      applyDeviceState: () => undefined,
      captureCurrentLayout: () => undefined,
      notifyOutputStateChanged: () => undefined,
      retryHelper: async (_attempts, work) => work(),
    });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('renames the active output’s profile and nothing of the other’s', async () => {
    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Studio']);

    expect(errors).toEqual([]);
    // The positive control. Without it, a rename that did nothing at all would
    // satisfy every assertion below about the speakers being untouched.
    expect(presetExists(HEADPHONES, 'Studio')).toBe(true);
    expect(presetExists(HEADPHONES, SHARED)).toBe(false);
    expect(settings.assignments[HEADPHONES].presetName).toBe('Studio');

    // The bug. Both of these followed the headphones and left the speakers
    // naming a file that exists only in somebody else's folder.
    expect(presetExists(SPEAKERS, SHARED)).toBe(true);
    expect(settings.assignments[SPEAKERS].presetName).toBe(SHARED);
  });

  it('moves only the active output’s saved copy', async () => {
    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Studio']);

    expect(baselineExists(HEADPHONES, 'Studio')).toBe(true);
    expect(baselineExists(HEADPHONES, SHARED)).toBe(false);
    // The speakers' undo point is still there and still under its own name.
    expect(baselineExists(SPEAKERS, SHARED)).toBe(true);
  });

  it('writes the assignments back to disk', async () => {
    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Studio']);

    const written = JSON.parse(
      fs.readFileSync(path.join(root, 'device-profiles.json'), 'utf8'),
    );
    expect(written.assignments[HEADPHONES].presetName).toBe('Studio');
    expect(written.assignments[SPEAKERS].presetName).toBe(SHARED);
  });

  it('allows a name another output is already using', async () => {
    // The point of the per-output folders: "Bass boost" on the headphones and
    // "Bass boost" on the speakers are two profiles that share a word. The flat
    // store had to refuse this, and refusing it now would be the old bug worn
    // the other way round.
    savePreset('Bass boost', presetWith(9), presetDirFor(SPEAKERS));

    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Bass boost']);

    expect(errors).toEqual([]);
    expect(presetExists(HEADPHONES, 'Bass boost')).toBe(true);
    expect(presetExists(SPEAKERS, 'Bass boost')).toBe(true);
  });

  it('refuses a name this output already uses', async () => {
    savePreset('Bass boost', presetWith(9), presetDirFor(HEADPHONES));

    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Bass boost']);

    expect(errors).toEqual([ErrorCode.INVALID_PRESET_NAME]);
    expect(presetExists(HEADPHONES, SHARED)).toBe(true);
  });

  it('answers a rename to the same name once, without touching anything', async () => {
    const reply = await fire(ChannelEnum.RENAME_PRESET, [SHARED, SHARED]);

    // It used to reply and then run the whole mutation anyway, replying a
    // second time on a channel the renderer had already resolved.
    expect(reply).toHaveBeenCalledTimes(1);
    expect(mutations).toBe(0);
    expect(presetExists(HEADPHONES, SHARED)).toBe(true);
  });

  it('deletes the active output’s profile and detaches only it', async () => {
    await fire(ChannelEnum.DELETE_PRESET, [SHARED]);

    expect(presetExists(HEADPHONES, SHARED)).toBe(false);
    expect(baselineExists(HEADPHONES, SHARED)).toBe(false);
    expect(settings.assignments[HEADPHONES]).toBeUndefined();

    // The other output keeps both its profile and its attachment to it.
    expect(presetExists(SPEAKERS, SHARED)).toBe(true);
    expect(baselineExists(SPEAKERS, SHARED)).toBe(true);
    expect(settings.assignments[SPEAKERS].presetName).toBe(SHARED);
  });

  it('follows the output that is live now, not the one at registration', async () => {
    // The handlers read the active output per call. Captured once, every
    // mutation after a device switch would land in the previous output's
    // folder — which is the same class of bug from the other direction.
    activeDeviceId = SPEAKERS;

    await fire(ChannelEnum.RENAME_PRESET, [SHARED, 'Desk']);

    expect(presetExists(SPEAKERS, 'Desk')).toBe(true);
    expect(presetExists(HEADPHONES, SHARED)).toBe(true);
    expect(settings.assignments[SPEAKERS].presetName).toBe('Desk');
    expect(settings.assignments[HEADPHONES].presetName).toBe(SHARED);
  });

  it('lists saved copies for the active output only', async () => {
    savePreset('Desk', presetWith(5), presetDirFor(SPEAKERS));
    savePresetBaseline('Desk', presetWith(5), baselineDirFor(SPEAKERS));

    const onHeadphones = await fire(ChannelEnum.GET_PRESET_BASELINE_NAMES, []);
    activeDeviceId = SPEAKERS;
    const onSpeakers = await fire(ChannelEnum.GET_PRESET_BASELINE_NAMES, []);

    // "Desk" belongs to the speakers. Offering it as something the headphones
    // could restore would have handed back another output's tuning.
    expect(onHeadphones).toHaveBeenCalledWith(
      ChannelEnum.GET_PRESET_BASELINE_NAMES,
      { result: [SHARED] },
    );
    expect(onSpeakers).toHaveBeenCalledWith(
      ChannelEnum.GET_PRESET_BASELINE_NAMES,
      { result: ['Desk', SHARED] },
    );
  });
});
