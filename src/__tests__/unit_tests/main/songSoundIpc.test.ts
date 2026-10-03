/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from '../../../common/channels';
import { ErrorCode } from '../../../common/errors';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  type IDeviceProfileSettings,
  type IPresetV2,
} from '../../../common/constants';
import type { ISongSound } from '../../../common/songSound';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { fetchPreset, savePreset } from '../../../main/flush';
import createMainSession from '../../../main/mainSession';
import { createProfileStore } from '../../../main/profileStore';
import { createUpdatePath } from '../../../main/updatePath';
import { putSongSoundOn } from '../../../main/songSoundLoan';
import registerSongSoundIpc from '../../../main/ipc/songSound';

type Handler = (
  event: { reply: jest.Mock },
  arg: unknown,
) => void | Promise<void>;
const handlers = new Map<string, Handler>();
const mockFlush = jest.fn<Promise<void>, unknown[]>(async () => undefined);
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  app: { getPath: () => '' },
}));
jest.mock('../../../main/registry', () => ({
  isEngineInstalled: async () => true,
}));
jest.mock('../../../main/deviceProfileFlush', () => ({
  flushDeviceProfiles: (...args: unknown[]) => mockFlush(...args),
}));

const own = (gain: number): IPresetV2 => ({
  preAmp: -3,
  filters: {
    own: {
      id: 'own',
      frequency: 120,
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    },
  },
  eqFormat: AutoEqFormat.GRAPHIC,
  graphicEq: [{ frequency: 120, gain }],
  voicing: { profileId: 'dsp:owned', intensity: 0.8 },
});
const song: ISongSound = {
  presetId: 'none',
  filters: {
    song: {
      id: 'song',
      frequency: 800,
      gain: 8,
      quality: 1.2,
      type: FilterTypeEnum.PK,
    },
  },
  tone: { bass: 4, mid: -1, treble: 2 },
};
const channels = [
  ChannelEnum.APPLY_SONG_SOUND,
  ChannelEnum.KEEP_SONG_SOUND,
  ChannelEnum.RETURN_SONG_SOUND,
];
const deferred = () => {
  let complete: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};

describe('SongSound IPC ownership and profile persistence', () => {
  let root: string;
  let state: ReturnType<typeof getDefaultState>;
  let session: ReturnType<typeof createMainSession>;
  let profiles: ReturnType<typeof createProfileStore>;
  let editorAvailable: boolean;
  const capture = jest.fn();
  const ensure = jest.fn(async (_configPath: string) => undefined);
  const expectedEditor = () => ({
    deviceId: session.activeAudioDeviceId,
    generation: session.outputEditGeneration,
  });
  const read = (id: string) =>
    fetchPreset('Shared', profiles.presetDirForDevice(id));
  const fire = async (channel: ChannelEnum, args: unknown[]) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`Missing ${channel}`);
    }
    const reply = jest.fn();
    await handler({ reply }, args);
    return reply;
  };
  const apply = () =>
    fire(ChannelEnum.APPLY_SONG_SOUND, [song, true, null, expectedEditor()]);
  beforeEach(async () => {
    handlers.clear();
    capture.mockReset();
    mockFlush.mockClear();
    ensure.mockReset().mockResolvedValue(undefined);
    editorAvailable = true;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-loan-'));
    state = { ...getDefaultState(), ...own(1) };
    session = {
      ...createMainSession(),
      activeAudioDeviceId: 'main',
      outputEditGeneration: 7,
      audioEngine: 'fluid',
      configPath: root,
    };
    const settings: IDeviceProfileSettings = {
      version: 1,
      assignments: Object.fromEntries(
        ['main', 'second'].map((id) => [
          id,
          {
            deviceId: id,
            deviceName: id,
            deviceGuid: `{${id}}`,
            presetName: 'Shared',
          },
        ]),
      ),
    };
    profiles = createProfileStore({
      state,
      session,
      deviceProfileSettings: settings,
      userDataDir: root,
    });
    await Promise.all(
      ['main', 'second'].map((id, index) =>
        savePreset('Shared', own(index + 1), profiles.presetDirForDevice(id)),
      ),
    );
    const update = createUpdatePath({
      ...profiles,
      state,
      session,
      deviceProfileSettings: settings,
      userDataDir: root,
      captureCurrentLayout: capture,
      diskSync: {
        configInclude: { ensure, forget: () => undefined },
        startApoConfigWatcher: () => undefined,
        whileAppWrites: async (work) => work(),
        stop: () => undefined,
      },
    });
    registerSongSoundIpc({
      state,
      userDataDir: root,
      handleUpdateHelper: update.handleUpdateHelper,
      getOutputEditor: () =>
        editorAvailable
          ? {
              device: {
                id: session.activeAudioDeviceId,
                name: 'Editor',
                guid: '{editor}',
                isActive: true,
                isDefault: false,
              },
              generation: session.outputEditGeneration ?? 0,
            }
          : undefined,
    });
  });
  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it.each(
    channels.flatMap(
      (channel) =>
        [
          [channel, { deviceId: 'second', generation: 7 }],
          [channel, { deviceId: 'main', generation: 6 }],
          [channel, { deviceId: 'main', generation: 7.5 }],
          [channel, undefined],
        ] as const,
    ),
  )(
    '%s rejects stale or missing editor ownership %j',
    async (channel, editor) => {
      putSongSoundOn(state, song, true, null);
      const before = structuredClone(state);
      const args =
        channel === ChannelEnum.APPLY_SONG_SOUND
          ? [song, true, null, editor]
          : [editor];
      const reply = await fire(channel, args);
      expect(reply).toHaveBeenCalledWith(channel, {
        errorCode: ErrorCode.INVALID_PARAMETER,
      });
      expect(state).toEqual(before);
      expect(ensure).not.toHaveBeenCalled();
      expect(mockFlush).not.toHaveBeenCalled();
      expect(read('main').filters).toEqual(own(1).filters);
      expect(read('second').filters).toEqual(own(2).filters);
    },
  );

  it.each(channels)(
    '%s refuses an otherwise matching request while no editor is available',
    async (channel) => {
      editorAvailable = false;
      const editor = expectedEditor();
      const reply = await fire(
        channel,
        channel === ChannelEnum.APPLY_SONG_SOUND
          ? [song, true, null, editor]
          : [editor],
      );
      expect(reply).toHaveBeenCalledWith(channel, {
        errorCode: ErrorCode.INVALID_PARAMETER,
      });
      expect(ensure).not.toHaveBeenCalled();
      expect(state.songSoundLoan).toBeUndefined();
    },
  );

  it('plays a lent song through a live override while saving only owned sound to both profile and restart state', async () => {
    const reply = await apply();
    await flushPendingWrites();
    expect(reply).toHaveBeenCalledWith(ChannelEnum.APPLY_SONG_SOUND, {
      result: expect.objectContaining({
        filters: song.filters,
        tone: song.tone,
      }),
    });
    expect(state.filters).toEqual(song.filters);
    expect(state.songSoundLoan?.filters).toEqual(own(1).filters);
    expect(read('main')).toEqual(expect.objectContaining(own(1)));
    expect(read('main').tone).toBeUndefined();
    expect(read('second')).toEqual(expect.objectContaining(own(2)));
    const restart = JSON.parse(
      fs.readFileSync(path.join(root, 'state.txt'), 'utf8'),
    );
    expect(restart.filters).toEqual(own(1).filters);
    expect(restart.tone).toBeUndefined();
    expect(restart.songSoundLoan).toBeUndefined();
    expect(mockFlush).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      root,
      expect.objectContaining({
        deviceId: 'main',
        state: expect.objectContaining({ filters: song.filters }),
      }),
      expect.anything(),
      expect.anything(),
      undefined,
      undefined,
      undefined,
      expect.anything(),
    );
    expect(capture).not.toHaveBeenCalled();
  });

  it('keeps the first owned sound across consecutive song loans and restores it when returned', async () => {
    await apply();
    const nextSong = {
      ...song,
      filters: { next: { ...song.filters.song, id: 'next', gain: -4 } },
    };
    await fire(ChannelEnum.APPLY_SONG_SOUND, [
      nextSong,
      true,
      null,
      expectedEditor(),
    ]);
    expect(state.filters).toEqual(nextSong.filters);
    expect(state.songSoundLoan?.filters).toEqual(own(1).filters);
    await fire(ChannelEnum.RETURN_SONG_SOUND, [expectedEditor()]);
    await flushPendingWrites();
    expect(state.filters).toEqual(own(1).filters);
    expect(state.eqFormat).toBe(AutoEqFormat.GRAPHIC);
    expect(state.graphicEq).toEqual(own(1).graphicEq);
    expect(state.voicing).toEqual(own(1).voicing);
    expect(state.tone).toBeUndefined();
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(own(1).filters);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('persists the lent sound only after an explicit Keep from its current editor', async () => {
    await apply();
    await fire(ChannelEnum.KEEP_SONG_SOUND, [expectedEditor()]);
    await flushPendingWrites();
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(song.filters);
    expect(read('main').tone).toEqual(song.tone);
    expect(read('second').filters).toEqual(own(2).filters);
    expect(capture).toHaveBeenCalledTimes(1);
  });

  it('does not save a newly opened output as an earlier apply while engine preparation is pending', async () => {
    const entered = deferred();
    const release = deferred();
    ensure.mockImplementationOnce(async () => {
      entered.resolve();
      await release.promise;
    });
    const applying = apply();
    await entered.promise;
    session.activeAudioDeviceId = 'second';
    session.outputEditGeneration = 8;
    profiles.applyDeviceState({ ...getDefaultState(), ...own(2) });
    release.resolve();
    await applying;
    await flushPendingWrites();
    expect(state.filters).toEqual(own(2).filters);
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(own(1).filters);
    expect(read('second').filters).toEqual(own(2).filters);
    expect(mockFlush).not.toHaveBeenCalled();
    expect(capture).not.toHaveBeenCalled();
  });
});
