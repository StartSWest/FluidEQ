/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from '../../../common/channels';
import { ErrorCode } from '../../../common/errors';
import {
  FilterTypeEnum,
  getDefaultState,
  type IAudioDevice,
  type IDeviceProfileSettings,
  type IPresetV2,
  type IState,
} from '../../../common/constants';
import { clampDspSettings, DSP_DEFAULTS } from '../../../common/dsp/chain';
import { flushPendingWrites } from '../../../main/asyncWriter';
import * as files from '../../../main/flush';
import createMainSession from '../../../main/mainSession';
import {
  createProfileStore,
  isAutomaticPresetName,
} from '../../../main/profileStore';
import {
  registerProfilesIpc,
  type IProfilesIpcDeps,
} from '../../../main/ipc/profiles';

type Handler = (event: { reply: jest.Mock }, arg: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
const mockDiscover = jest.fn();
const mockSetDefault = jest.fn();
jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  app: { getPath: () => '' },
}));
jest.mock('../../../main/audioDevices', () => ({
  ...jest.requireActual('../../../main/audioDevices'),
  discoverAudioDevices: () => mockDiscover(),
  setDefaultAudioDevice: (...args: unknown[]) => mockSetDefault(...args),
}));
jest.mock('../../../main/registry', () => ({
  getConfigPath: async () => '',
  isEqualizerAPOInstalled: async () => true,
}));

const main: IAudioDevice = {
  id: 'main',
  name: 'Main',
  guid: '{main}',
  isDefault: true,
  isActive: true,
};
const second: IAudioDevice = {
  id: 'second',
  name: 'Second',
  guid: '{second}',
  isDefault: false,
  isActive: true,
};
const SHARED = 'Shared';
const preset = (gain: number): IPresetV2 => ({
  preAmp: 0,
  filters: {
    a: { id: 'a', frequency: 120, gain, quality: 1, type: FilterTypeEnum.PK },
  },
  isAutoPreAmpOn: gain === 1,
  dsp: clampDspSettings({
    ...DSP_DEFAULTS,
    enabled: gain === 1,
    normalizer: { ...DSP_DEFAULTS.normalizer, targetLufs: -12 - gain },
  }),
});
const deferred = <T>() => {
  let complete: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const mutations = [
  ChannelEnum.SAVE_PRESET,
  ChannelEnum.CREATE_PRESET,
  ChannelEnum.LOAD_PRESET,
  ChannelEnum.RESTORE_PRESET_BASELINE,
  ChannelEnum.RENAME_PRESET,
  ChannelEnum.DELETE_PRESET,
];
const namesFor = (channel: ChannelEnum) =>
  channel === ChannelEnum.RENAME_PRESET ? [SHARED, 'Renamed'] : [SHARED];

describe('profile request ownership', () => {
  let root: string;
  let state: IState;
  let session: ReturnType<typeof createMainSession>;
  let settings: IDeviceProfileSettings;
  let store: ReturnType<typeof createProfileStore>;
  let deps: IProfilesIpcDeps;
  let errors: ErrorCode[];
  const update = jest.fn(async () => undefined);
  const notify = jest.fn();
  const fire = async (channel: ChannelEnum, args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing handler: ${channel}`);
    }
    const reply = jest.fn();
    await handler({ reply }, args);
    return reply;
  };
  const read = (device: IAudioDevice, name = SHARED) =>
    files.fetchPreset(name, store.presetDirForDevice(device.id));
  const seed = async (device: IAudioDevice, name: string, value: IPresetV2) => {
    await files.savePreset(name, value, store.presetDirForDevice(device.id));
    await files.savePresetBaseline(
      name,
      value,
      store.activeBaselineDir(device.id),
    );
  };
  const holdQueue = () => {
    const release = deferred<void>();
    const held = store.runProfileMutation(() => release.promise);
    return { held, release: () => release.resolve() };
  };
  beforeEach(async () => {
    handlers.clear();
    errors = [];
    update.mockClear();
    notify.mockClear();
    mockSetDefault.mockReset();
    mockDiscover.mockReset().mockResolvedValue([main, second]);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-profile-owner-'));
    state = { ...getDefaultState(), ...preset(1) };
    session = {
      ...createMainSession(),
      activeAudioDeviceId: main.id,
      activeAudioDevice: main,
      playbackAudioDevice: main,
      outputEditGeneration: 7,
      secondOutputDevices: [second],
    };
    settings = {
      version: 1,
      assignments: Object.fromEntries(
        [main, second].map((device) => [
          device.id,
          {
            deviceId: device.id,
            deviceName: device.name,
            deviceGuid: device.guid,
            presetName: SHARED,
          },
        ]),
      ),
    };
    store = createProfileStore({
      state,
      session,
      deviceProfileSettings: settings,
      userDataDir: root,
    });
    await seed(main, SHARED, preset(1));
    await seed(second, SHARED, preset(2));
    deps = {
      ...store,
      state,
      session,
      userDataDir: root,
      deviceProfileSettings: settings,
      isAutomaticPresetName,
      handleUpdate: update,
      handleUpdateHelper: update,
      handleError: (_event, _channel, error) => {
        errors.push(error);
      },
      adoptExistingApoConfig: () => true,
      notifyOutputStateChanged: notify,
      guardAgainstApo: async () => undefined,
    };
    registerProfilesIpc(deps);
  });
  afterEach(async () => {
    await flushPendingWrites();
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each([
    ChannelEnum.GET_PRESET_FILE_LIST,
    ChannelEnum.GET_PRESET_BASELINE_NAMES,
  ])(
    '%s can read main while the editor and default catalogue belong to second',
    async (channel) => {
      await seed(main, 'Main only', preset(3));
      await seed(second, 'Second only', preset(4));
      session.activeAudioDeviceId = second.id;
      const explicit = await fire(channel, [{ deviceId: main.id }]);
      const active = await fire(channel, []);
      expect(explicit).toHaveBeenCalledWith(channel, {
        result: ['Main only', SHARED],
      });
      expect(active).toHaveBeenCalledWith(channel, {
        result: ['Second only', SHARED],
      });
      expect(session.activeAudioDeviceId).toBe(second.id);
      expect(errors).toEqual([]);
    },
  );

  it.each(mutations)(
    '%s accepts the active editor as an explicit target',
    async (channel) => {
      await fire(channel, [...namesFor(channel), { deviceId: main.id }]);
      expect(errors).toEqual([]);
      expect(read(second).filters.a.gain).toBe(2);
      expect(settings.assignments[second.id].presetName).toBe(SHARED);
      expect(update).toHaveBeenCalledTimes(1);
    },
  );

  it.each(mutations)(
    '%s refuses a different expected editor before queueing',
    async (channel) => {
      const queue = jest.spyOn(deps, 'runProfileMutation');
      registerProfilesIpc(deps);
      await fire(channel, [...namesFor(channel), { deviceId: second.id }]);
      expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
      expect(queue).not.toHaveBeenCalled();
      expect(read(main).filters.a.gain).toBe(1);
      expect(read(second).filters.a.gain).toBe(2);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    '%s rejects queued work after the editor changes output',
    async (channel) => {
      const queue = holdQueue();
      const pending = fire(channel, [
        ...namesFor(channel),
        { deviceId: main.id },
      ]);
      session.activeAudioDeviceId = second.id;
      queue.release();
      await Promise.all([queue.held, pending]);
      expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
      expect(read(main).filters.a.gain).toBe(1);
      expect(read(second).filters.a.gain).toBe(2);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each(mutations.slice(0, 4))(
    '%s rejects an obsolete sound generation on the same output',
    async (channel) => {
      const queue = holdQueue();
      const pending = fire(channel, [
        ...namesFor(channel),
        { deviceId: main.id },
      ]);
      session.outputEditGeneration = 8;
      queue.release();
      await Promise.all([queue.held, pending]);
      expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
      expect(read(main).filters.a.gain).toBe(1);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it.each([ChannelEnum.RENAME_PRESET, ChannelEnum.DELETE_PRESET])(
    '%s remains a name operation when the same output changes sound generation',
    async (channel) => {
      await seed(main, 'Spare', preset(4));
      const queue = holdQueue();
      const pending = fire(channel, [
        ...(channel === ChannelEnum.RENAME_PRESET
          ? ['Spare', 'Renamed']
          : ['Spare']),
        { deviceId: main.id },
      ]);
      session.outputEditGeneration = 8;
      queue.release();
      await Promise.all([queue.held, pending]);
      expect(errors).toEqual([]);
      expect(fs.existsSync(path.join(store.activePresetDir(), 'Spare'))).toBe(
        false,
      );
      const renamed =
        channel === ChannelEnum.RENAME_PRESET
          ? read(main, 'Renamed')
          : undefined;
      expect(renamed?.filters.a.gain).toBe(
        channel === ChannelEnum.RENAME_PRESET ? 4 : undefined,
      );
      expect(read(main).filters.a.gain).toBe(1);
      expect(read(second).filters.a.gain).toBe(2);
    },
  );

  it('captures profile and baseline directories before entering the queue', async () => {
    const queue = holdQueue();
    const original = store.activePresetDir();
    const originalBaseline = store.activeBaselineDir();
    const pending = fire(ChannelEnum.SAVE_PRESET, [
      'Captured',
      { deviceId: main.id },
    ]);
    deps.activePresetDir = () => path.join(root, 'later-profile-folder');
    deps.activeBaselineDir = () => path.join(root, 'later-baseline-folder');
    queue.release();
    await Promise.all([queue.held, pending]);
    expect(files.fetchPreset('Captured', original).filters.a.gain).toBe(1);
    expect(
      files.fetchPresetBaseline('Captured', originalBaseline)?.filters.a.gain,
    ).toBe(1);
    expect(fs.existsSync(deps.activePresetDir())).toBe(false);
    expect(fs.existsSync(deps.activeBaselineDir())).toBe(false);
    expect(errors).toEqual([]);
  });

  it.each([
    ChannelEnum.SAVE_PRESET,
    ChannelEnum.CREATE_PRESET,
    ChannelEnum.RESTORE_PRESET_BASELINE,
  ])(
    '%s keeps an in-flight write on its captured output and never attaches it to a changed editor',
    async (channel) => {
      const entered = deferred<void>();
      const release = deferred<void>();
      const { savePreset } = files;
      jest
        .spyOn(files, 'savePreset')
        .mockImplementationOnce(async (...args) => {
          entered.resolve();
          await release.promise;
          return savePreset(...args);
        });
      const name =
        channel === ChannelEnum.RESTORE_PRESET_BASELINE ? SHARED : 'Captured';
      const pending = fire(channel, [name, { deviceId: main.id }]);
      await entered.promise;
      session.activeAudioDeviceId = second.id;
      session.activeAudioDevice = second;
      if (channel !== ChannelEnum.RESTORE_PRESET_BASELINE) {
        state.filters.a.gain = 9;
      }
      Object.assign(state, preset(9));
      release.resolve();
      await pending;
      expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
      expect(read(main, name).filters.a.gain).toBe(1);
      expect(read(second).filters.a.gain).toBe(2);
      expect(settings.assignments[second.id].presetName).toBe(SHARED);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it('finishes queued name operations after deleting the attached profile changes the sound generation', async () => {
    await seed(main, 'Spare', preset(4));
    const queue = holdQueue();
    const deleting = fire(ChannelEnum.DELETE_PRESET, [
      SHARED,
      { deviceId: main.id },
    ]);
    const renaming = fire(ChannelEnum.RENAME_PRESET, [
      'Spare',
      'Kept',
      { deviceId: main.id },
    ]);
    queue.release();
    await Promise.all([queue.held, deleting, renaming]);
    expect(errors).toEqual([]);
    expect(read(main, 'Kept').filters.a.gain).toBe(4);
    expect(settings.assignments[main.id].presetName).toBe('Untitled profile 1');
    expect(session.outputEditGeneration).toBeGreaterThan(7);
    expect(read(second).filters.a.gain).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('finishes only the captured rename bookkeeping after an external editor change mid-write', async () => {
    const entered = deferred<void>();
    const release = deferred<void>();
    const rename = files.renamePreset;
    jest
      .spyOn(files, 'renamePreset')
      .mockImplementationOnce(async (...args) => {
        entered.resolve();
        await release.promise;
        return rename(...args);
      });
    const pending = fire(ChannelEnum.RENAME_PRESET, [
      SHARED,
      'Renamed',
      { deviceId: main.id },
    ]);
    await entered.promise;
    session.activeAudioDeviceId = second.id;
    release.resolve();
    await pending;
    expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
    expect(read(main, 'Renamed').filters.a.gain).toBe(1);
    expect(settings.assignments[main.id].presetName).toBe('Renamed');
    expect(
      files.fetchPresetBaseline('Renamed', store.activeBaselineDir(main.id))
        ?.filters.a.gain,
    ).toBe(1);
    expect(read(second).filters.a.gain).toBe(2);
    expect(settings.assignments[second.id].presetName).toBe(SHARED);
    expect(update).not.toHaveBeenCalled();
  });

  it('serializes editor activation with queued profile actions without changing playback', async () => {
    const queue = holdQueue();
    const activation = fire(ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE, [
      second.id,
    ]);
    const staleSave = fire(ChannelEnum.SAVE_PRESET, [
      'Too late',
      { deviceId: main.id },
    ]);
    expect(mockDiscover).not.toHaveBeenCalled();
    expect(session.activeAudioDeviceId).toBe(main.id);
    queue.release();
    const [, activated] = await Promise.all([
      queue.held,
      activation,
      staleSave,
    ]);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(session.activeAudioDeviceId).toBe(second.id);
    expect(session.playbackAudioDevice).toEqual(main);
    expect(session.secondOutputDevices).toEqual([second]);
    expect(state.filters.a.gain).toBe(2);
    expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
    expect(mockSetDefault).not.toHaveBeenCalled();
    expect(
      fs.existsSync(path.join(store.presetDirForDevice(main.id), 'Too late')),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(store.presetDirForDevice(second.id), 'Too late')),
    ).toBe(false);
  });

  it('rejects activation if Windows changes the editor while discovery is in flight', async () => {
    const discovered = deferred<IAudioDevice[]>();
    const entered = deferred<void>();
    mockDiscover.mockImplementationOnce(() => {
      entered.resolve();
      return discovered.promise;
    });
    const activation = fire(ChannelEnum.ACTIVATE_AUDIO_DEVICE_PROFILE, [
      second.id,
    ]);
    await entered.promise;
    session.activeAudioDeviceId = 'external';
    session.outputEditGeneration = 8;
    discovered.resolve([main, second]);
    const reply = await activation;
    expect(errors).toEqual([ErrorCode.INVALID_PARAMETER]);
    expect(reply).not.toHaveBeenCalled();
    expect(session.activeAudioDeviceId).toBe('external');
    expect(notify).not.toHaveBeenCalled();
    expect(mockSetDefault).not.toHaveBeenCalled();
  });

  it.each([ChannelEnum.LOAD_PRESET, ChannelEnum.RESTORE_PRESET_BASELINE])(
    '%s restores only the edited output rack and normalizer',
    async (channel) => {
      Object.assign(state, preset(9));
      await fire(channel, [SHARED, { deviceId: main.id }]);
      expect(state.dsp).toEqual(preset(1).dsp);
      expect(state.isAutoPreAmpOn).toBe(true);
      expect(read(second).dsp).toEqual(preset(2).dsp);
      expect(read(second).isAutoPreAmpOn).toBe(false);
      expect(session.playbackAudioDevice).toEqual(main);
      expect(session.secondOutputDevices).toEqual([second]);
      expect(mockSetDefault).not.toHaveBeenCalled();
      expect(errors).toEqual([]);
    },
  );
});
