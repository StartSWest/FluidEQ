/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Telling the engine which song is playing. The text is the one
 * `native/system-apo/tests/leveling_board_test.cpp` parses: a key spelled
 * differently on one side would level every song as though never heard.
 */

import path from 'path';
import type { IEngineHealth, IFinishedSong } from 'common/engineHealth';
import type { ISongLevel, ISongLevelStore } from 'main/songLevels';
import {
  createSongProgramme,
  formatSongProgramme,
  songIdentity,
} from 'main/songProgramme';
import type { ISystemMediaSnapshot } from 'main/systemMedia';
import { outputConfigFileName } from 'common/outputConfigFiles';

const snapshot = (
  title: string,
  fields: Partial<ISystemMediaSnapshot> = {},
): ISystemMediaSnapshot => ({
  app: 'Spotify.exe',
  title,
  artist: 'Band',
  isPlaying: true,
  positionMs: 0,
  durationMs: 200_000,
  canNext: true,
  canPrevious: true,
  canSeek: true,
  playing: ['Spotify.exe'],
  coverId: '',
  ...fields,
});

const CONFIG = path.join('C:', 'ProgramData', 'FluidEQ', 'engine', 'config');
const FILE = path.join(CONFIG, 'fluideq-programme.txt');
const MAIN = '{01234567-89ab-cdef-0123-456789abcdef}';
const SECOND = '{12345678-9abc-def0-1234-56789abcdef0}';
const MAIN_ID = MAIN.slice(1, -1);
const SECOND_ID = SECOND.slice(1, -1);

const setup = (known: Record<string, ISongLevel> = {}) => {
  const writes: { filePath: string; contents: string }[] = [];
  const recorded: { song: IFinishedSong; endpoint?: string }[] = [];
  let configDir: string | undefined = CONFIG;
  const store: ISongLevelStore = {
    lookup: (id) => known[id],
    record: (song, endpoint) => {
      recorded.push({ song, endpoint });
      return true;
    },
  };
  const watchEngine = jest.fn(async () => undefined);
  const programme = createSongProgramme({
    store,
    fileName: 'fluideq-programme.txt',
    resolveConfigDir: async () => configDir,
    write: async (filePath, contents) => {
      writes.push({ filePath, contents });
    },
    watchEngine,
  });
  return {
    programme,
    writes,
    recorded,
    watchEngine,
    setConfigDir: (dir: string | undefined) => {
      configDir = dir;
    },
  };
};

describe('songIdentity', () => {
  it('is sixteen hex digits, whatever the title holds', () => {
    expect(songIdentity(snapshot('Song é "quoted"\nline'))).toMatch(
      /^[0-9a-f]{16}$/,
    );
  });

  it('is the same song whatever the case or stray spaces', () => {
    expect(songIdentity(snapshot('  Song  ', { artist: 'BAND ' }))).toBe(
      songIdentity(snapshot('song', { artist: 'band' })),
    );
  });

  it('is a different song in a different player, or by a different artist', () => {
    const base = songIdentity(snapshot('Song'));
    expect(songIdentity(snapshot('Song', { app: 'Chrome' }))).not.toBe(base);
    expect(songIdentity(snapshot('Song', { artist: 'Other' }))).not.toBe(base);
    // Joined with a separator a title cannot fake.
    expect(songIdentity(snapshot('a', { artist: 'b c' }))).not.toBe(
      songIdentity(snapshot('a b', { artist: 'c' })),
    );
  });
});

describe('formatSongProgramme', () => {
  it('writes a remembered song in the text the engine parses', () => {
    expect(
      formatSongProgramme('00000000000a11ce', {
        levelLufs: -11.844,
        peakDb: -0.6249,
        seconds: 180,
        heardAt: 1,
      }),
    ).toBe(
      '# FluidEQ Engine programme v1\r\nsong=00000000000a11ce\r\n' +
        'level=-11.84\r\npeak=-0.62\r\n',
    );
  });

  it('writes a song heard for the first time without a level', () => {
    expect(formatSongProgramme('ffffffffffffffff', undefined)).toBe(
      '# FluidEQ Engine programme v1\r\nsong=ffffffffffffffff\r\n',
    );
  });

  it('writes no song when nothing is named', () => {
    expect(formatSongProgramme(undefined, undefined)).toBe(
      '# FluidEQ Engine programme v1\r\n',
    );
  });
});

describe('createSongProgramme', () => {
  it('tells the engine once per song, however often the player reports it', async () => {
    const { programme, writes, watchEngine } = setup();
    await programme.onMedia(snapshot('One'));
    await programme.onMedia(snapshot('One', { positionMs: 1000 }));
    await programme.onMedia(snapshot('One', { positionMs: 2000 }));
    expect(writes).toEqual([
      {
        filePath: FILE,
        contents: formatSongProgramme(songIdentity(snapshot('One')), undefined),
      },
    ]);
    // Media updates still ensure the watcher is active; only disk writes dedupe.
    expect(watchEngine).toHaveBeenCalledTimes(3);
    await programme.onMedia(snapshot('Two'));
    expect(writes).toHaveLength(2);
    expect(writes[1].contents).toContain(
      `song=${songIdentity(snapshot('Two'))}`,
    );
  });

  it('hands the engine the level a song was remembered at', async () => {
    const id = songIdentity(snapshot('Known'));
    const { programme, writes } = setup({
      [id]: { levelLufs: -9.5, peakDb: -0.3, seconds: 200, heardAt: 1 },
    });
    await programme.onMedia(snapshot('Known'));
    expect(writes[0].contents).toContain('level=-9.50\r\npeak=-0.30\r\n');
  });

  it('says so when nothing is named any more', async () => {
    const { programme, writes } = setup();
    await programme.onMedia(snapshot('One'));
    await programme.onMedia(undefined);
    expect(writes[1].contents).toBe(formatSongProgramme(undefined, undefined));
  });

  it('writes nothing while the engine is not the one in use, and catches up once it is', async () => {
    const { programme, writes, setConfigDir } = setup();
    setConfigDir(undefined);
    await programme.onMedia(snapshot('One'));
    expect(writes).toHaveLength(0);
    setConfigDir(CONFIG);
    await programme.onMedia(snapshot('One', { positionMs: 1000 }));
    expect(writes).toHaveLength(1);
  });

  it('never lands an older song after a newer one', async () => {
    const writes: string[] = [];
    let release: (() => void) | undefined;
    const slow = new Promise<void>((resolve) => {
      release = resolve;
    });
    let calls = 0;
    const programme = createSongProgramme({
      store: { lookup: () => undefined, record: () => true },
      fileName: 'fluideq-programme.txt',
      resolveConfigDir: async () => {
        calls += 1;
        if (calls === 1) {
          await slow;
        }
        return CONFIG;
      },
      write: async (_filePath, contents) => {
        writes.push(contents);
      },
      watchEngine: async () => undefined,
    });
    const first = programme.onMedia(snapshot('One'));
    const second = programme.onMedia(snapshot('Two'));
    release?.();
    await Promise.all([first, second]);
    expect(writes).toEqual([
      formatSongProgramme(songIdentity(snapshot('Two')), undefined),
    ]);
  });

  it('records each output’s finished song once, however many statuses repeat it', async () => {
    const { programme, recorded } = setup();
    const lastSong = {
      id: '00000000000a11ce',
      levelLufs: -12,
      peakDb: -1,
      seconds: 180,
    };
    const health: IEngineHealth = {
      outputs: [
        {
          endpoint: MAIN,
          locked: true,
          processing: true,
          owner: true,
          problems: [],
          lastSong,
        },
        {
          endpoint: SECOND,
          locked: true,
          processing: true,
          owner: true,
          problems: [],
          lastSong,
        },
        {
          endpoint: '{C}',
          locked: false,
          processing: false,
          owner: true,
          problems: [],
        },
      ],
    };
    programme.onHealth(health);
    programme.onHealth(health);
    expect(recorded).toEqual([
      { song: lastSong, endpoint: MAIN_ID },
      { song: lastSong, endpoint: SECOND_ID },
    ]);
    programme.onHealth({
      outputs: [
        { ...health.outputs[0], lastSong: { ...lastSong, seconds: 240 } },
      ],
    });
    expect(recorded).toHaveLength(3);
    expect(recorded[2]).toEqual({
      song: { ...lastSong, seconds: 240 },
      endpoint: MAIN_ID,
    });
    await programme.onMedia(undefined);
  });

  it('seeds every output from its own measured level and the legacy file from playback main', async () => {
    const levels: Record<string, ISongLevel> = {
      [MAIN_ID]: { levelLufs: -12, peakDb: -1, seconds: 180, heardAt: 1 },
      [SECOND_ID]: { levelLufs: -24, peakDb: -5, seconds: 180, heardAt: 1 },
    };
    const writes = new Map<string, string>();
    const programme = createSongProgramme({
      store: {
        lookup: (_id, endpoint) => levels[endpoint ?? ''],
        record: () => true,
      },
      fileName: 'fluideq-programme.txt',
      mainEndpoint: () => MAIN,
      resolveConfigDir: async () => CONFIG,
      write: async (file, contents) => {
        writes.set(file, contents);
      },
      watchEngine: async () => undefined,
    });
    programme.onHealth({
      outputs: [MAIN, SECOND].map((endpoint) => ({
        endpoint,
        locked: true,
        processing: true,
        owner: true,
        problems: [],
      })),
    });
    await programme.onMedia(snapshot('Same song'));
    const mainFile = outputConfigFileName('programme', MAIN);
    const secondFile = outputConfigFileName('programme', SECOND);
    if (!mainFile || !secondFile) {
      throw new Error('Valid endpoint filenames required');
    }
    expect(writes.get(FILE)).toContain('level=-12.00\r\npeak=-1.00');
    expect(writes.get(path.join(CONFIG, mainFile))).toContain(
      'level=-12.00\r\npeak=-1.00',
    );
    expect(writes.get(path.join(CONFIG, secondFile))).toContain(
      'level=-24.00\r\npeak=-5.00',
    );
  });
});
