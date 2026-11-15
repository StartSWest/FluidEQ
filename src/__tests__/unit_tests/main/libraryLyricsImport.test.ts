/*
Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node

Main-process file I/O against real temporary folders. A folder that refuses
a write is stood in for at the one writer every import goes through
(`atomicWrite`), so the fallback is tested without changing any permission
on the machine running the suite. Lines written for these tests.
*/

const refusedFolders = new Set<string>();
jest.mock('../../../main/atomicWrite', () => {
  const actual = jest.requireActual<typeof import('../../../main/atomicWrite')>(
    '../../../main/atomicWrite',
  );
  // eslint-disable-next-line global-require -- the factory runs before the imports below
  const nodePath = require('path') as typeof import('path');
  return {
    __esModule: true,
    default: (file: string, contents: string | Uint8Array) => {
      if (refusedFolders.has(nodePath.dirname(file))) {
        const error = new Error(
          `EPERM: operation not permitted, open '${file}'`,
        );
        Object.assign(error, { code: 'EPERM' });
        throw error;
      }
      actual.default(file, contents);
    },
  };
});

// eslint-disable-next-line import/first -- the mock must be installed first
import fs from 'fs';
// eslint-disable-next-line import/first
import os from 'os';
// eslint-disable-next-line import/first
import path from 'path';
// eslint-disable-next-line import/first
import { MAX_LYRICS_FILE_BYTES } from '../../../common/library/lyrics';
// eslint-disable-next-line import/first
import { readTrackLyrics } from '../../../main/library/libraryLyrics';
// eslint-disable-next-line import/first
import {
  importTrackLyrics,
  readPickedLyrics,
} from '../../../main/library/libraryLyricsImport';
// eslint-disable-next-line import/first
import { storedLyricsPath } from '../../../main/library/libraryLyricsPlaces';
// eslint-disable-next-line import/first
import { mpegFrames } from '../../utils/lyricsFixtures';

const TIMED = '[00:01.00]Lanterns on the quay\n[00:04.00]The tide comes slow';
const PLAIN = 'Lanterns on the quay\nThe tide comes slow';

describe('lyrics the listener imports, kept with the song', () => {
  let dir = '';
  let storeDir = '';
  let song = '';
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lyrics-import-'));
    storeDir = path.join(dir, 'user-data', 'library-lyrics');
    fs.mkdirSync(path.join(dir, 'music'));
    song = path.join(dir, 'music', '04 Copper Light.mp3');
    fs.writeFileSync(song, mpegFrames());
    refusedFolders.clear();
    // The fallback says why in the log, as it should; held here so the
    // console guard sees it expected.
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const besideFiles = () =>
    fs
      .readdirSync(path.join(dir, 'music'))
      .filter((name) => name !== '04 Copper Light.mp3');

  it('writes timed words beside the song as its own .lrc, through a rename', () => {
    const rename = jest.spyOn(fs, 'renameSync');
    try {
      expect(
        importTrackLyrics({
          trackPath: song,
          storeDir,
          text: TIMED,
          replace: false,
        }),
      ).toEqual({
        state: 'saved',
        place: 'beside',
        fileName: '04 Copper Light.lrc',
      });
      const target = path.join(dir, 'music', '04 Copper Light.lrc');
      expect(rename).toHaveBeenCalledTimes(1);
      const [from, to] = rename.mock.calls[0];
      expect(to).toBe(target);
      expect(path.dirname(String(from))).toBe(path.dirname(target));
      expect(String(from)).not.toBe(target);
    } finally {
      rename.mockRestore();
    }
    expect(
      fs.readFileSync(path.join(dir, 'music', '04 Copper Light.lrc'), 'utf8'),
    ).toBe(`${TIMED}\n`);
    // Nothing half-written left behind, and nothing in FluidEQ's folder.
    expect(besideFiles()).toEqual(['04 Copper Light.lrc']);
    expect(fs.existsSync(storeDir)).toBe(false);
  });

  it('writes plain words as a .txt, and the reader then finds them', async () => {
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: PLAIN,
        replace: false,
      }),
    ).toMatchObject({
      state: 'saved',
      place: 'beside',
      fileName: '04 Copper Light.txt',
    });
    expect((await readTrackLyrics(song, storeDir)).lyrics).toEqual({
      kind: 'plain',
      source: 'txt',
      fileName: '04 Copper Light.txt',
      text: PLAIN,
    });
  });

  it('never goes over a lyrics file already there unless told to', () => {
    const existing = path.join(dir, 'music', '04 Copper Light.lrc');
    fs.writeFileSync(existing, '[00:02.00]Somebody’s careful timing');
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: TIMED,
        replace: false,
      }),
    ).toEqual({
      state: 'exists',
      place: 'beside',
      fileName: '04 Copper Light.lrc',
    });
    expect(fs.readFileSync(existing, 'utf8')).toBe(
      '[00:02.00]Somebody’s careful timing',
    );

    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: TIMED,
        replace: true,
      }),
    ).toMatchObject({ state: 'saved', place: 'beside' });
    expect(fs.readFileSync(existing, 'utf8')).toBe(`${TIMED}\n`);
  });

  it('keeps them in FluidEQ’s own folder when the song’s folder refuses the write', async () => {
    refusedFolders.add(path.join(dir, 'music'));
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: TIMED,
        replace: false,
      }),
    ).toEqual({
      state: 'saved',
      place: 'store',
      fileName: '04 Copper Light.lrc',
    });
    expect(besideFiles()).toEqual([]);
    expect(
      fs.readFileSync(storedLyricsPath(storeDir, song, '.lrc'), 'utf8'),
    ).toBe(`${TIMED}\n`);
    const { lyrics } = await readTrackLyrics(song, storeDir);
    expect(lyrics).toMatchObject({ kind: 'synced', kept: true });
    expect(lyrics?.fileName).toBeUndefined();
  });

  it('keeps them in FluidEQ’s folder for a song whose folder is gone, creating none', () => {
    const lost = path.join(dir, 'gone', 'Lost Song.mp3');
    expect(
      importTrackLyrics({
        trackPath: lost,
        storeDir,
        text: PLAIN,
        replace: false,
      }),
    ).toMatchObject({ state: 'saved', place: 'store' });
    expect(fs.existsSync(path.join(dir, 'gone'))).toBe(false);
  });

  it('asks before replacing what FluidEQ already keeps for the song', () => {
    refusedFolders.add(path.join(dir, 'music'));
    importTrackLyrics({
      trackPath: song,
      storeDir,
      text: PLAIN,
      replace: false,
    });
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: 'Other words',
        replace: false,
      }),
    ).toEqual({
      state: 'exists',
      place: 'store',
      fileName: '04 Copper Light.txt',
    });
    expect(
      fs.readFileSync(storedLyricsPath(storeDir, song, '.txt'), 'utf8'),
    ).toBe(`${PLAIN}\n`);
  });

  it('says it failed when neither folder can be written', () => {
    refusedFolders.add(path.join(dir, 'music'));
    refusedFolders.add(storeDir);
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: PLAIN,
        replace: false,
      }),
    ).toEqual({ state: 'failed' });
  });

  it('drops FluidEQ’s copy once the words can live beside the song', async () => {
    refusedFolders.add(path.join(dir, 'music'));
    importTrackLyrics({
      trackPath: song,
      storeDir,
      text: TIMED,
      replace: false,
    });
    refusedFolders.clear();
    importTrackLyrics({
      trackPath: song,
      storeDir,
      text: PLAIN,
      replace: false,
    });
    expect(fs.existsSync(storedLyricsPath(storeDir, song, '.lrc'))).toBe(false);
    // The plain words beside the song are what plays, not the old timed copy.
    expect((await readTrackLyrics(song, storeDir)).lyrics).toMatchObject({
      kind: 'plain',
      fileName: '04 Copper Light.txt',
    });
  });

  it('refuses a binary or an oversized text before writing anything', () => {
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: `ID3${String.fromCharCode(0)}tags`,
        replace: false,
      }),
    ).toEqual({ state: 'refused', reason: 'notText' });
    expect(
      importTrackLyrics({
        trackPath: song,
        storeDir,
        text: 'x'.repeat(MAX_LYRICS_FILE_BYTES + 1),
        replace: false,
      }),
    ).toEqual({ state: 'refused', reason: 'tooBig' });
    expect(besideFiles()).toEqual([]);
    expect(fs.existsSync(storeDir)).toBe(false);
  });
});

describe('the lyrics reader and FluidEQ’s own folder', () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lyrics-kept-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reads the kept file after the song’s own, and only with the folder named', async () => {
    const song = path.join(dir, 'Harbour.mp3');
    fs.writeFileSync(song, mpegFrames());
    const storeDir = path.join(dir, 'kept');
    fs.mkdirSync(storeDir);
    fs.writeFileSync(storedLyricsPath(storeDir, song, '.txt'), PLAIN);

    expect((await readTrackLyrics(song)).lyrics).toBeUndefined();
    expect((await readTrackLyrics(song, storeDir)).lyrics).toEqual({
      kind: 'plain',
      source: 'txt',
      kept: true,
      text: PLAIN,
    });

    fs.writeFileSync(path.join(dir, 'Harbour.txt'), 'Words beside the song');
    expect((await readTrackLyrics(song, storeDir)).lyrics).toMatchObject({
      fileName: 'Harbour.txt',
      text: 'Words beside the song',
    });
  });

  it('names the kept file by the song’s path, without case on Windows', () => {
    const a = storedLyricsPath(dir, 'C:\\Music\\Song.mp3', '.lrc');
    expect(path.dirname(a)).toBe(dir);
    expect(path.basename(a)).toMatch(/^[0-9a-f]{64}\.lrc$/);
    expect(storedLyricsPath(dir, 'C:\\Music\\Other.mp3', '.lrc')).not.toBe(a);
    // The same file on Windows, which compares paths without case; another
    // file everywhere else, where `Song` and `song` are two songs.
    expect(storedLyricsPath(dir, 'c:\\MUSIC\\song.mp3', '.lrc') === a).toBe(
      process.platform === 'win32',
    );
  });
});

describe('a lyrics file picked in the dialog', () => {
  let dir = '';
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-lyrics-pick-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('comes back as text, from UTF-16 too', async () => {
    const file = path.join(dir, 'Harbour.lrc');
    fs.writeFileSync(
      file,
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(TIMED, 'utf16le')]),
    );
    await expect(readPickedLyrics(file)).resolves.toEqual({
      state: 'picked',
      text: TIMED,
    });
  });

  it('is refused by its size before it is read', async () => {
    const file = path.join(dir, 'Huge.txt');
    fs.writeFileSync(file, Buffer.alloc(MAX_LYRICS_FILE_BYTES + 1, 0x61));
    const read = jest.spyOn(fs.promises, 'readFile');
    try {
      await expect(readPickedLyrics(file)).resolves.toEqual({
        state: 'refused',
        reason: 'tooBig',
      });
      expect(read).not.toHaveBeenCalled();
    } finally {
      read.mockRestore();
    }
  });

  it('is refused when it is a binary renamed', async () => {
    const file = path.join(dir, 'Song.lrc');
    fs.writeFileSync(file, mpegFrames());
    await expect(readPickedLyrics(file)).resolves.toEqual({
      state: 'refused',
      reason: 'notText',
    });
  });
});
