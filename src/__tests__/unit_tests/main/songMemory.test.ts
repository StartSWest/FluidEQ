/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The song memory in the app's core: a remembered song's sound lent once it
 * has settled — its EQ through the state's loan, its rack as the rack that
 * plays — while the profile and the restart state keep the listener's own;
 * handed back at its end, kept by a profile save, given up before a profile
 * load; and its clock the output itself, heard only while a song waits.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultState,
  type IDeviceProfileSettings,
  type IPresetV2,
} from '../../../common/constants';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import { dspPresetSettings } from '../../../common/dsp/presets';
import { buildSongIdentity } from '../../../common/songIdentity';
import type { ISongSound } from '../../../common/songSound';
import type { ISongMemoryStatus } from '../../../common/songMemoryStatus';
import createHeardClock from '../../../core/systemSound/heardClock';
import type {
  ISystemSound,
  ISystemSoundListener,
} from '../../../core/systemSound/systemSound';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { fetchPreset, savePreset } from '../../../main/flush';
import createMainSession from '../../../main/mainSession';
import { createProfileStore } from '../../../main/profileStore';
import { createUpdatePath, isErrorReply } from '../../../main/updatePath';
import { createSongMemory } from '../../../main/songMemory';
import { createSongSoundMemory } from '../../../main/songSoundMemory';

const mockFlush = jest.fn<Promise<void>, unknown[]>(async () => undefined);
jest.mock('electron', () => ({
  ipcMain: { on: jest.fn() },
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
  eqFormat: AutoEqFormat.PARAMETRIC,
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
const identityOf = (title: string) => {
  // The second part is the song's own key: its file.
  const identity = buildSongIdentity(
    'library',
    `C:\\Music\\${title}.flac`,
    title,
    'Artist',
  );
  if (!identity) {
    throw new Error('no identity');
  }
  return identity;
};
const FIRST = identityOf('First');
const SECOND = identityOf('Second');

const device = (id: string) => ({
  id,
  name: id,
  guid: `{${id}}`,
  isActive: true,
  isDefault: id === 'main',
});

/** Let the queue, the lookups and the writes run. */
const settle = async () => {
  for (let at = 0; at < 12; at += 1) {
    // eslint-disable-next-line no-await-in-loop -- each turn lets the next queued step run
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
  }
};

describe('the song memory in the core', () => {
  let root: string;
  let state: ReturnType<typeof getDefaultState>;
  let session: ReturnType<typeof createMainSession>;
  let profiles: ReturnType<typeof createProfileStore>;
  let listeners: { listener: ISystemSoundListener; stop: jest.Mock }[];
  let canHear: boolean;
  let statuses: ISongMemoryStatus[];
  let switchKept: boolean | undefined;
  let now: number;
  const ensure = jest.fn(async (_configPath: string) => undefined);
  const tellWindowSound = jest.fn();
  const read = (id: string) =>
    fetchPreset('Shared', profiles.presetDirForDevice(id));

  const systemSound: ISystemSound = {
    listen: (listener) => {
      if (!canHear) {
        listener.lost();
        return () => undefined;
      }
      const stop = jest.fn();
      listeners.push({ listener, stop });
      return stop;
    },
  };
  /** A quarter of a second heard, which is one step of the clock. */
  const hear = () =>
    listeners
      .filter(({ stop }) => stop.mock.calls.length === 0)
      .forEach(({ listener }) =>
        listener.audio({
          sampleRate: 48000,
          channels: 2,
          frames: 12000,
          sequence: 0,
          pcm: new Float32Array(24000).buffer,
        }),
      );
  const lastStatus = () => statuses[statuses.length - 1];
  const isListening = () =>
    listeners.some(({ stop }) => stop.mock.calls.length === 0);

  let memory: ReturnType<typeof createSongSoundMemory>;
  let songs: ReturnType<typeof createSongMemory>;

  const make = () => {
    memory = createSongSoundMemory(root);
    const update = createUpdatePath({
      ...profiles,
      state,
      session,
      deviceProfileSettings: {
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
      },
      userDataDir: root,
      diskSync: {
        configInclude: { ensure, forget: () => undefined },
        startApoConfigWatcher: () => undefined,
        whileAppWrites: async (work) => work(),
        stop: () => undefined,
      },
    });
    songs = createSongMemory({
      state,
      session,
      memory,
      savedChains: () => [],
      isOn: {
        read: () => switchKept,
        keep: (next) => {
          switchKept = next;
          return true;
        },
        onChange: () => () => undefined,
      },
      update: async (label) => {
        let landed = false;
        await update.handleUpdate(
          {
            reply: (_channel, payload) => {
              landed = !isErrorReply(payload);
            },
          },
          label,
          false,
          true,
        );
        return landed;
      },
      tellWindowSound,
      tellWindowStatus: (status) => statuses.push(status),
      createClock: (options) => createHeardClock({ systemSound, ...options }),
    });
  };

  /** A song plays, settles on the clock, and is looked up. */
  const play = async (identity = FIRST) => {
    songs.soundMayHaveChanged();
    songs.nowPlaying(identity, true);
    now += 2100;
    hear();
    await settle();
  };

  beforeEach(async () => {
    mockFlush.mockClear();
    ensure.mockReset().mockResolvedValue(undefined);
    tellWindowSound.mockClear();
    listeners = [];
    canHear = true;
    statuses = [];
    switchKept = true;
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-memory-'));
    state = { ...getDefaultState(), ...own(1) };
    session = {
      ...createMainSession(),
      activeAudioDeviceId: 'main',
      activeAudioDevice: device('main'),
      playbackAudioDevice: device('main'),
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
    make();
    memory.save('main', FIRST, song);
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await flushPendingWrites();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('lends a remembered song’s sound once it has settled, keeping the listener’s own in the profile and the restart state', async () => {
    await play();
    await flushPendingWrites();
    expect(state.filters).toEqual(song.filters);
    expect(state.tone).toEqual(song.tone);
    expect(state.songSoundLoan?.filters).toEqual(own(1).filters);
    expect(read('main')).toEqual(expect.objectContaining(own(1)));
    expect(read('main').tone).toBeUndefined();
    expect(read('second')).toEqual(expect.objectContaining(own(2)));
    const restart = JSON.parse(
      fs.readFileSync(path.join(root, 'state.txt'), 'utf8'),
    );
    expect(restart.filters).toEqual(own(1).filters);
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
      expect.anything(),
    );
    // The window reads it back, and is shown the card.
    expect(tellWindowSound).toHaveBeenCalled();
    expect(lastStatus()?.notice).toEqual(
      expect.objectContaining({ kind: 'lent', identity: FIRST }),
    );
  });

  it('lends nothing over bands that are not the EQ — an imported GraphicEQ', async () => {
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [{ frequency: 120, gain: 1 }];
    await play();
    expect(state.songSoundLoan).toBeUndefined();
    expect(state.graphicEq).toEqual([{ frequency: 120, gain: 1 }]);
  });

  it('waits for the song to settle, on the clock it hears', async () => {
    songs.soundMayHaveChanged();
    songs.nowPlaying(FIRST, true);
    expect(isListening()).toBe(true);
    // A quarter of a second in: still settling, nothing lent.
    now += 250;
    hear();
    await settle();
    expect(state.songSoundLoan).toBeUndefined();
    // Two seconds in, the next step of the clock settles it, and the
    // listening ends with the wait.
    now += 1900;
    hear();
    await settle();
    expect(state.songSoundLoan).toBeDefined();
    expect(isListening()).toBe(false);
  });

  it('keeps the first owned sound across consecutive songs and hands it back when nothing follows', async () => {
    const next: ISongSound = {
      ...song,
      filters: { next: { ...song.filters.song, id: 'next', gain: -4 } },
    };
    memory.save('main', SECOND, next);
    await play(FIRST);
    await play(SECOND);
    expect(state.filters).toEqual(next.filters);
    expect(state.songSoundLoan?.filters).toEqual(own(1).filters);

    songs.nowPlaying(undefined, false);
    await settle();
    await flushPendingWrites();
    expect(state.filters).toEqual(own(1).filters);
    expect(state.voicing).toEqual(own(1).voicing);
    expect(state.tone).toBeUndefined();
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(own(1).filters);
  });

  it('lends a song’s rack while the output keeps its own, and puts its own back', async () => {
    const ownRack = { ...DSP_DEFAULTS, enabled: true, presetId: 'music' };
    state.dsp = ownRack;
    memory.save('main', FIRST, { ...song, presetId: 'gaming' });
    await play();
    expect(session.outputDspOverrides?.get('main')).toMatchObject({
      presetId: 'gaming',
      enabled: true,
    });
    expect(state.dsp).toBe(ownRack);

    songs.nowPlaying(undefined, false);
    await settle();
    expect(session.outputDspOverrides?.get('main')).toBe(ownRack);
  });

  it('keeps the lent sound as the listener’s own when a profile is saved, its rack too', async () => {
    memory.save('main', FIRST, { ...song, presetId: 'gaming' });
    await play();
    await songs.keepSound();
    await flushPendingWrites();
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(song.filters);
    expect(read('main').tone).toEqual(song.tone);
    expect(read('second').filters).toEqual(own(2).filters);
    expect(state.dsp).toMatchObject({ presetId: 'gaming', enabled: true });
    expect(read('main').dsp).toMatchObject({ presetId: 'gaming' });
  });

  it('gives the song’s sound up before a profile is loaded', async () => {
    await play();
    await songs.yieldSound();
    expect(state.songSoundLoan).toBeUndefined();
    expect(state.filters).toEqual(own(1).filters);
  });

  it('does not save a newly opened output as an earlier apply while the engine is being prepared', async () => {
    let entered: () => void = () => undefined;
    let release: () => void = () => undefined;
    const isEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    ensure.mockImplementationOnce(async () => {
      entered();
      await released;
    });
    songs.soundMayHaveChanged();
    songs.nowPlaying(FIRST, true);
    now += 2100;
    hear();
    await isEntered;
    session.activeAudioDeviceId = 'second';
    session.activeAudioDevice = device('second');
    session.outputEditGeneration = 8;
    profiles.applyDeviceState({ ...getDefaultState(), ...own(2) });
    release();
    await settle();
    await flushPendingWrites();
    expect(read('main').filters).toEqual(own(1).filters);
    expect(read('second').filters).toEqual(own(2).filters);
    expect(mockFlush).not.toHaveBeenCalled();
  });

  it('files a song the listener changed while it played, and says it will', async () => {
    memory.forget('main', FIRST);
    // The rack off, so the preset playing is the one the curve names.
    state.dsp = { ...DSP_DEFAULTS, enabled: false };
    songs.soundMayHaveChanged();
    songs.nowPlaying(FIRST, true);
    now += 2100;
    hear();
    await settle();
    // Another preset put on by hand while it plays.
    state.voicing = { profileId: 'dsp:metal', intensity: 1 };
    songs.soundMayHaveChanged();
    expect(lastStatus()?.notice).toEqual(
      expect.objectContaining({ kind: 'willSave', presetId: 'metal' }),
    );
    songs.nowPlaying(SECOND, true);
    await settle();
    expect(memory.lookup('main', FIRST)?.sound.presetId).toBe('metal');
    // POSITIVE CONTROL: a song nobody touched files nothing.
    expect(memory.lookup('main', SECOND)).toBeUndefined();
  });

  it('asks the window’s players for the clock where it cannot hear the output', async () => {
    canHear = false;
    songs.soundMayHaveChanged();
    songs.nowPlaying(FIRST, true);
    expect(lastStatus()?.needsClock).toBe(true);
    now += 2100;
    songs.tick();
    await settle();
    expect(state.songSoundLoan).toBeDefined();
    expect(lastStatus()?.needsClock).toBe(false);
  });

  it('lends nothing while switched off, or while a game holds it off', async () => {
    songs.setOn(false);
    expect(switchKept).toBe(false);
    await play();
    expect(state.songSoundLoan).toBeUndefined();

    songs.setOn(true);
    songs.hold(true);
    await play(SECOND);
    await play(FIRST);
    expect(state.songSoundLoan).toBeUndefined();

    // POSITIVE CONTROL: let go, the next song's sound goes on.
    songs.hold(false);
    memory.save('main', SECOND, song);
    await play(SECOND);
    expect(state.songSoundLoan).toBeDefined();
  });

  it('takes a window’s old switch only where it never had one', () => {
    switchKept = undefined;
    make();
    songs.handOver(true);
    expect(songs.status().isOn).toBe(true);
    songs.handOver(false);
    expect(songs.status().isOn).toBe(true);
    expect(switchKept).toBe(true);
  });

  it('puts back a loan left over from before it ran, once the editor is known', async () => {
    state.songSoundLoan = {
      filters: own(1).filters,
      isFlat: false,
      eqFormat: own(1).eqFormat,
      graphicEq: undefined,
      eqImport: undefined,
      tone: undefined,
      voicing: own(1).voicing,
    };
    state.filters = song.filters;
    make();
    songs.soundMayHaveChanged();
    await settle();
    expect(state.songSoundLoan).toBeUndefined();
    expect(state.filters).toEqual(own(1).filters);
    // Written to the engine, and the window told: not only put back here.
    expect(mockFlush).toHaveBeenCalledTimes(1);
    expect(tellWindowSound).toHaveBeenCalled();
  });

  it('undoes this play from the card: the listener’s own sound back, the memory kept', async () => {
    await play();
    songs.undo();
    await settle();
    expect(state.songSoundLoan).toBeUndefined();
    expect(state.filters).toEqual(own(1).filters);
    expect(memory.lookup('main', FIRST)).toBeDefined();
    expect(lastStatus()?.notice).toBeUndefined();
  });

  it('forgets the song the card names, and takes its sound off', async () => {
    await play();
    songs.forgetNoticed();
    await settle();
    expect(memory.lookup('main', FIRST)).toBeUndefined();
    expect(state.filters).toEqual(own(1).filters);
  });

  it('counts a pause on the clock too: a minute of it ends the play and hands the sound back', async () => {
    await play();
    songs.nowPlaying(FIRST, false);
    expect(isListening()).toBe(true);
    // Half a minute paused is the same play.
    now += 30_000;
    hear();
    await settle();
    expect(state.songSoundLoan).toBeDefined();
    now += 31_000;
    hear();
    await settle();
    expect(state.songSoundLoan).toBeUndefined();
    expect(state.filters).toEqual(own(1).filters);
    expect(isListening()).toBe(false);
  });

  it('listens again once the output changes, after it could not', async () => {
    canHear = false;
    songs.soundMayHaveChanged();
    songs.nowPlaying(FIRST, true);
    expect(isListening()).toBe(false);
    canHear = true;
    songs.outputChanged();
    expect(isListening()).toBe(true);
    expect(lastStatus()?.needsClock).toBe(false);
  });

  it('keeps a song’s rack off under Equalizer APO, which has no rack', async () => {
    session.audioEngine = 'apo';
    memory.save('main', FIRST, { ...song, presetId: 'gaming' });
    await play();
    expect(session.outputDspOverrides?.get('main')).toMatchObject({
      presetId: 'gaming',
      enabled: false,
      gameMode: false,
    });
  });

  it('lends only the Tone and bands of a song whose saved chain is gone, keeping the rack', async () => {
    const ownRack = {
      ...(dspPresetSettings('music', DSP_DEFAULTS) as IDspSettings),
      enabled: true,
    };
    state.dsp = ownRack;
    memory.save('main', FIRST, { ...song, presetId: 'user-chain:gone' });
    await play();
    expect(state.filters).toEqual(song.filters);
    // The rack the output played, the chain it had: not one nobody can name.
    expect(session.outputDspOverrides?.get('main')).toEqual(ownRack);
  });

  it('drops the hand-back a profile reload replaced, keeping the profile loaded', async () => {
    await play();
    // A profile loaded over the song, as LOAD_PRESET puts one on: its own
    // sound, no loan, and a new generation of the same editor.
    session.outputDspOverrides?.delete('main');
    session.outputStateOverrides?.delete('main');
    Object.assign(state, own(3));
    state.songSoundLoan = undefined;
    session.outputEditGeneration = 8;
    songs.soundMayHaveChanged();
    songs.nowPlaying(undefined, false);
    await settle();
    expect(state.filters).toEqual(own(3).filters);
  });

  it('names the listener’s own preset while a song’s is lent, for a game to put back', async () => {
    state.dsp = { ...DSP_DEFAULTS, enabled: false };
    memory.save('main', FIRST, { ...song, presetId: 'gaming' });
    await play();
    expect(songs.ownPresetId('gaming')).toBe('owned');
    // POSITIVE CONTROL: with nothing lent, what plays is the listener's.
    songs.nowPlaying(undefined, false);
    await settle();
    expect(songs.ownPresetId('movie')).toBe('movie');
  });

  it('keeps the card it has for the same news again', async () => {
    memory.forget('main', FIRST);
    state.dsp = { ...DSP_DEFAULTS, enabled: false };
    await play();
    state.voicing = { profileId: 'dsp:metal', intensity: 1 };
    songs.soundMayHaveChanged();
    const first = lastStatus()?.notice?.id;
    expect(first).toBeDefined();
    // Back to the preset the song began with, which is no news, and then
    // to Metal again: the same news, and the same card.
    state.voicing = own(1).voicing;
    songs.soundMayHaveChanged();
    state.voicing = { profileId: 'dsp:metal', intensity: 1 };
    songs.soundMayHaveChanged();
    expect(lastStatus()?.notice?.id).toBe(first);
    // POSITIVE CONTROL: another preset is new news.
    state.voicing = { profileId: 'dsp:pop', intensity: 1 };
    songs.soundMayHaveChanged();
    expect(lastStatus()?.notice?.id).not.toBe(first);
  });

  it('files an edited song as the app closes', async () => {
    memory.forget('main', FIRST);
    state.dsp = { ...DSP_DEFAULTS, enabled: false };
    await play();
    state.voicing = { profileId: 'dsp:metal', intensity: 1 };
    songs.soundMayHaveChanged();
    await songs.close();
    expect(memory.lookup('main', FIRST)?.sound.presetId).toBe('metal');
  });
});
