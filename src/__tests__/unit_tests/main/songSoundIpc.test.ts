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
import {
  buildSongIdentity,
  libraryTrackIdentity,
  remoteSongIdentity,
  type ISongIdentity,
} from '../../../common/songIdentity';
import type { ISongSound } from '../../../common/songSound';
import { flushPendingWrites } from '../../../main/asyncWriter';
import { fetchPreset, savePreset } from '../../../main/flush';
import createMainSession from '../../../main/mainSession';
import { createProfileStore } from '../../../main/profileStore';
import { createUpdatePath } from '../../../main/updatePath';
import { putSongSoundOn } from '../../../main/songSoundLoan';
import { createSongSoundHolder } from '../../../main/songSoundHolder';
import registerSongSoundIpc from '../../../main/ipc/songSound';
import registerSongSoundLibraryIpc from '../../../main/ipc/songSoundLibrary';

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
  const notify = jest.fn();
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
    mockFlush.mockClear();
    notify.mockClear();
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
      diskSync: {
        configInclude: { ensure, forget: () => undefined },
        startApoConfigWatcher: () => undefined,
        whileAppWrites: async (work) => work(),
        stop: () => undefined,
      },
    });
    const holder = createSongSoundHolder(root, notify);
    await holder.launchRead;
    registerSongSoundLibraryIpc(holder);
    registerSongSoundIpc({
      state,
      holder,
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

  const lookup = async (identity: ISongIdentity | undefined) => {
    const reply = await fire(ChannelEnum.LOOKUP_SONG_SOUND, [identity]);
    return reply.mock.calls[0]?.[1] as unknown;
  };
  const mustBe = (identity: ISongIdentity | undefined): ISongIdentity => {
    if (!identity) {
      throw new Error('test fixture produced no identity');
    }
    return identity;
  };
  const storedEntries = () =>
    Object.values(
      (
        JSON.parse(
          fs.readFileSync(path.join(root, 'song-sound.json'), 'utf8'),
        ) as { songs: { entries: Record<string, unknown> } }
      ).songs.entries,
    );
  const blueInGreen = mustBe(
    libraryTrackIdentity({
      id: 'track-1',
      title: 'Blue in Green',
      artist: 'Miles',
      album: 'Kind of Blue',
      albumArtist: 'Miles',
      kind: 'audio',
    }),
  );
  const onSpotify = mustBe(
    buildSongIdentity('system', 'Spotify.exe', 'Blue in Green', 'Miles'),
  );
  const albumMatch = {
    sound: { presetId: 'vocal' },
    title: 'Kind of Blue',
  };

  it('keeps no name of another program’s song in its file, and still finds it', async () => {
    const identity = buildSongIdentity(
      'system',
      'chrome.exe',
      'A private title',
      'A private channel',
    );
    const saved = await fire(ChannelEnum.SAVE_SONG_SOUND, [identity, song]);
    expect(saved).toHaveBeenCalledWith(ChannelEnum.SAVE_SONG_SOUND, {
      result: undefined,
    });
    // Every change is told to the window, so the Library and Manage follow.
    expect(notify).toHaveBeenCalledTimes(1);
    await flushPendingWrites();

    const text = fs.readFileSync(path.join(root, 'song-sound.json'), 'utf8');
    expect(text).not.toMatch(/private|chrome/i);
    expect(storedEntries()).toEqual([
      expect.objectContaining({ scope: 'other', title: '', plays: 0 }),
    ]);
    // The control: what was filed is still found by the song playing.
    expect(await lookup(identity)).toEqual({ result: { song } });
  });

  it('answers a Library song with its own sound and its album’s, and the same song on another player with neither', async () => {
    const albumKey = blueInGreen.albumKey ?? '';
    expect(albumKey).not.toBe('');
    await fire(ChannelEnum.SET_ALBUM_SOUND, [
      albumKey,
      'Kind of Blue',
      'Miles',
      { presetId: 'vocal' },
    ]);
    expect(await lookup(blueInGreen)).toEqual({
      result: { album: albumMatch },
    });

    await fire(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, [
      [blueInGreen],
      { presetId: 'cinema' },
    ]);
    expect(await lookup(blueInGreen)).toEqual({
      result: { song: { presetId: 'cinema' }, album: albumMatch },
    });
    // The same title and artist from Spotify: the Library's pick never plays
    // there, and albums are the Library's alone.
    expect(await lookup(onSpotify)).toEqual({ result: {} });
  });

  describe('a song arriving from a linked computer (Share Audio)', () => {
    /** Blue in Green from the other computer's Library, as it arrives. */
    const fromTheirLibrary = mustBe(
      remoteSongIdentity('OFFICE-PC', {
        title: 'Blue in Green',
        artist: 'Miles',
        library: { album: 'Kind of Blue', albumArtist: 'Miles' },
      }),
    );
    /** The same song from a player over there that is not its Library. */
    const fromTheirSpotify = mustBe(
      remoteSongIdentity('OFFICE-PC', {
        title: 'Blue in Green',
        artist: 'Miles',
      }),
    );
    const setKindOfBlue = (presetId: string) =>
      fire(ChannelEnum.SET_ALBUM_SOUND, [
        blueInGreen.albumKey,
        'Kind of Blue',
        'Miles',
        { presetId },
      ]);

    it('plays the album sound kept here, preset and all', async () => {
      await setKindOfBlue('vocal');
      expect(await lookup(fromTheirLibrary)).toEqual({
        result: { album: albumMatch },
      });
      // Control: the same song from a player over there that is not its
      // Library takes no album's sound, as Spotify here takes none.
      expect(await lookup(fromTheirSpotify)).toEqual({ result: {} });
    });

    it('plays this Library’s song sound for the same song, found by name', async () => {
      await setKindOfBlue('vocal');
      await fire(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, [
        [blueInGreen],
        { presetId: 'cinema' },
      ]);
      expect(await lookup(fromTheirLibrary)).toEqual({
        result: { song: { presetId: 'cinema' }, album: albumMatch },
      });
      expect(await lookup(fromTheirSpotify)).toEqual({ result: {} });
    });

    it('plays a sound saved while it played here before this Library’s, and files no name or album for it', async () => {
      await fire(ChannelEnum.PICK_LIBRARY_SONG_SOUNDS, [
        [blueInGreen],
        { presetId: 'cinema' },
      ]);
      const saved = await fire(ChannelEnum.SAVE_SONG_SOUND, [
        fromTheirLibrary,
        song,
      ]);
      expect(saved).toHaveBeenCalledWith(ChannelEnum.SAVE_SONG_SOUND, {
        result: undefined,
      });
      expect(await lookup(fromTheirLibrary)).toEqual({ result: { song } });
      await flushPendingWrites();
      const text = fs.readFileSync(path.join(root, 'song-sound.json'), 'utf8');
      expect(text).not.toMatch(/office|kind of blue/i);
      // The Library's own pick is untouched by it.
      expect(await lookup(blueInGreen)).toEqual({
        result: { song: { presetId: 'cinema' } },
      });
    });

    it('refuses a word that is not a yes or a no', async () => {
      expect(
        await lookup({
          ...fromTheirLibrary,
          fromLinkedLibrary: 'yes',
        } as unknown as ISongIdentity),
      ).toEqual({ errorCode: ErrorCode.INVALID_PARAMETER });
    });

    it('takes nothing from this Library for a song without the word', async () => {
      await setKindOfBlue('vocal');
      // A FluidEQ from before 2.6 sends no Library tags, and an identity
      // that carries an album key without the word is not trusted with one.
      expect(
        await lookup({ ...fromTheirSpotify, albumKey: blueInGreen.albumKey }),
      ).toEqual({ result: {} });
    });
  });

  it('files a Library song with its track id, so the Library can label its row', async () => {
    await fire(ChannelEnum.SAVE_SONG_SOUND, [blueInGreen, song]);
    const index = await fire(ChannelEnum.GET_SONG_SOUND_INDEX, []);
    expect(index).toHaveBeenCalledWith(ChannelEnum.GET_SONG_SOUND_INDEX, {
      result: expect.objectContaining({
        songs: [
          expect.objectContaining({
            trackId: 'track-1',
            title: 'Blue in Green',
            presetId: 'none',
            isWhole: true,
          }),
        ],
        otherCount: 0,
        hasUnnamed: false,
      }),
    });
  });

  it('forgets a song in its own world and leaves the other world’s copy', async () => {
    await fire(ChannelEnum.SAVE_SONG_SOUND, [blueInGreen, song]);
    await fire(ChannelEnum.SAVE_SONG_SOUND, [onSpotify, song]);
    await fire(ChannelEnum.FORGET_SONG_SOUND, [onSpotify]);
    expect(await lookup(onSpotify)).toEqual({ result: {} });
    expect(await lookup(blueInGreen)).toEqual({ result: { song } });
  });

  it('never keeps a sound for a film', async () => {
    const film = mustBe(
      libraryTrackIdentity({
        id: 'film-1',
        title: 'A Film',
        artist: 'Studio',
        kind: 'video',
      }),
    );
    const saved = await fire(ChannelEnum.SAVE_SONG_SOUND, [film, song]);
    expect(saved).toHaveBeenCalledWith(ChannelEnum.SAVE_SONG_SOUND, {
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
    expect(await lookup(film)).toEqual({ result: {} });
    expect(notify).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(root, 'song-sound.json'))).toBe(false);
  });

  it('refuses a lookup or a save that names no song', async () => {
    expect(await lookup(undefined)).toEqual({
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
    const saved = await fire(ChannelEnum.SAVE_SONG_SOUND, [
      onSpotify,
      { presetId: 'none', filters: {} },
    ]);
    expect(saved).toHaveBeenCalledWith(ChannelEnum.SAVE_SONG_SOUND, {
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
  });

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
      expect.anything(),
    );
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
  });

  it('never writes the listener’s profile when a song’s sound goes on or comes off', async () => {
    // A mark only a write of the profile would remove.
    await savePreset(
      'Shared',
      { ...own(1), preAmp: -9 },
      profiles.presetDirForDevice('main'),
    );
    await flushPendingWrites();
    await apply();
    await fire(ChannelEnum.RETURN_SONG_SOUND, [expectedEditor()]);
    await flushPendingWrites();
    expect(state.filters).toEqual(own(1).filters);
    expect(read('main').preAmp).toBe(-9);
    // The control: a sound put on as the listener's own is theirs, and saved.
    await fire(ChannelEnum.APPLY_SONG_SOUND, [
      song,
      false,
      null,
      expectedEditor(),
    ]);
    await flushPendingWrites();
    expect(read('main').filters).toEqual(song.filters);
    expect(read('main').preAmp).toBe(-3);
  });

  it('lends the listener’s own exactly as they left it to a song whose sound is theirs', async () => {
    await apply();
    const theirs = { ...song, filters: own(1).filters };
    const reply = await fire(ChannelEnum.APPLY_SONG_SOUND, [
      theirs,
      true,
      undefined,
      expectedEditor(),
      true,
    ]);
    expect(reply).toHaveBeenCalledWith(ChannelEnum.APPLY_SONG_SOUND, {
      result: expect.objectContaining({ filters: own(1).filters }),
    });
    // Their own, the imported curve and the preset's layer included, and
    // lent: what is changed while the song plays stays the song's.
    expect(state.eqFormat).toBe(AutoEqFormat.GRAPHIC);
    expect(state.graphicEq).toEqual(own(1).graphicEq);
    expect(state.voicing).toEqual(own(1).voicing);
    expect(state.tone).toBeUndefined();
    expect(state.songSoundLoan?.filters).toEqual(own(1).filters);
    state.filters = song.filters;
    await fire(ChannelEnum.RETURN_SONG_SOUND, [expectedEditor()]);
    await flushPendingWrites();
    expect(state.filters).toEqual(own(1).filters);
    expect(read('main').filters).toEqual(own(1).filters);
    // Lending as their own is only ever a loan.
    const refused = await fire(ChannelEnum.APPLY_SONG_SOUND, [
      theirs,
      false,
      undefined,
      expectedEditor(),
      true,
    ]);
    expect(refused).toHaveBeenCalledWith(ChannelEnum.APPLY_SONG_SOUND, {
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
  });

  it('persists the lent sound only after an explicit Keep from its current editor', async () => {
    await apply();
    await fire(ChannelEnum.KEEP_SONG_SOUND, [expectedEditor()]);
    await flushPendingWrites();
    expect(state.songSoundLoan).toBeUndefined();
    expect(read('main').filters).toEqual(song.filters);
    expect(read('main').tone).toEqual(song.tone);
    expect(read('second').filters).toEqual(own(2).filters);
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
  });
});
