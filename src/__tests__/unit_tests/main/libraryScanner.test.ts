import fs from 'fs';
import os from 'os';
import path from 'path';
import { ILibraryTrack } from '../../../common/library/types';
import {
  scanLibraryRoot,
  shouldReparse,
  trackIdForPath,
} from '../../../main/library/libraryScanner';
import { readLibraryTags } from '../../../main/library/libraryMetadata';

jest.mock('../../../main/library/libraryMetadata', () => ({
  readLibraryTags: jest.fn(() => Promise.resolve({ title: 'Tagged' })),
  findFolderArt: () => undefined,
}));
jest.mock('../../../main/library/libraryArtwork', () => ({
  storeArtwork: () => Promise.resolve(undefined),
}));

const mockedReadLibraryTags = readLibraryTags as jest.Mock;

const folder = (files: Record<string, string>): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-scan-'));
  Object.entries(files).forEach(([name, contents]) => {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), contents);
  });
  return dir;
};

const scan = (rootPath: string, known: ILibraryTrack[] = []) =>
  scanLibraryRoot({
    rootId: 'r1',
    rootPath,
    userDataDir: rootPath,
    known,
    onProgress: () => undefined,
    isCancelled: () => false,
  });

describe('scanning a folder', () => {
  it('finds music at any depth and ignores everything else', async () => {
    const dir = folder({
      'a.mp3': 'x',
      'notes.txt': 'x',
      'Album/b.flac': 'x',
      'Album/cover.jpg': 'x',
      'Album/Live/c.m4a': 'x',
    });
    const result = await scan(dir);
    expect(
      result.tracks.map((entry) => path.basename(entry.path)).sort(),
    ).toEqual(['a.mp3', 'b.flac', 'c.m4a']);
  });

  it('excludes a song that has a lyric file beside it, and counts it', async () => {
    const dir = folder({ 'Song.mp3': 'x', 'Song.lrc': '[00:01.00]hi' });
    const result = await scan(dir);
    expect(result.tracks).toHaveLength(0);
    expect(result.karaokeSkipped).toBe(1);
  });

  it('keeps a song whose .txt sibling is not an UltraStar chart', async () => {
    // The positive control the spec insists on. A scanner that excluded every
    // .txt-adjacent song would pass the test above and quietly lose albums
    // that ship a tracklist.
    const dir = folder({ 'Song.mp3': 'x', 'Song.txt': '1. Intro\n2. Verse\n' });
    const result = await scan(dir);
    expect(result.tracks).toHaveLength(1);
    expect(result.karaokeSkipped).toBe(0);
  });

  it('excludes a song whose .txt sibling really is a chart', async () => {
    const dir = folder({
      'Song.mp3': 'x',
      'Song.txt': '#TITLE:Song\n#BPM:200\n: 0 4 0 Hel~\n',
    });
    const result = await scan(dir);
    expect(result.tracks).toHaveLength(0);
    expect(result.karaokeSkipped).toBe(1);
  });

  it('lists a video it cannot play, marked', async () => {
    const dir = folder({ 'clip.mkv': 'x' });
    const result = await scan(dir);
    expect(result.tracks[0]).toMatchObject({
      kind: 'video',
      isPlayable: false,
    });
  });

  it('reports progress and stops when asked', async () => {
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    const seen: number[] = [];
    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: (progress) => seen.push(progress.parsed),
      isCancelled: () => seen.length >= 1,
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(result.wasCancelled).toBe(true);
    // A cancelled scan is a partial library, never a lost one.
    expect(result.tracks.length).toBeGreaterThan(0);
  });

  it('reports seen ahead of parsed while a directory is still being worked through', async () => {
    // The regression this guards: `seen` and `parsed` used to be incremented
    // together for the same file, so every live progress event had
    // `seen === parsed` and a determinate bar read 100% for the whole scan.
    // A directory of several files is what would have caught it -- `seen` is
    // counted for the whole directory before any of its files are read, so
    // every event but the last for that directory should be ahead of
    // `parsed`.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    const events: { seen: number; parsed: number }[] = [];
    await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: (progress) =>
        events.push({ seen: progress.seen, parsed: progress.parsed }),
      isCancelled: () => false,
    });
    expect(events.some((event) => event.seen > event.parsed)).toBe(true);
  });

  it('keeps a known addedAt through a re-parse, but stamps a new file fresh', async () => {
    // The Recently Added sort reads this field; getting it wrong is a silent,
    // wrong-direction bug rather than a crash -- an edited file would jump to
    // the top of the list as if it had just been added.
    const dir = folder({ 'known.mp3': 'x', 'new.mp3': 'y' });
    const knownPath = path.join(dir, 'known.mp3');
    const stats = fs.statSync(knownPath);
    const knownAddedAt = 12345;
    const known: ILibraryTrack[] = [
      {
        id: trackIdForPath(knownPath),
        rootId: 'r1',
        path: knownPath,
        kind: 'audio',
        isPlayable: true,
        title: 'Old title',
        // Mismatched size forces shouldReparse to trigger a rebuild.
        sizeBytes: stats.size + 1,
        mtimeMs: stats.mtimeMs,
        addedAt: knownAddedAt,
      },
    ];
    const before = Date.now();
    const result = await scan(dir, known);
    const reparsed = result.tracks.find((entry) => entry.path === knownPath);
    const fresh = result.tracks.find(
      (entry) => path.basename(entry.path) === 'new.mp3',
    );
    expect(reparsed?.addedAt).toBe(knownAddedAt);
    expect(fresh?.addedAt).toBeGreaterThanOrEqual(before);
  });

  it('sets hasMetadataError only when the tag read itself failed', async () => {
    mockedReadLibraryTags.mockResolvedValueOnce({ readFailed: true });
    const dir = folder({ 'broken.mp3': 'x' });
    const result = await scan(dir);
    expect(result.tracks[0]).toMatchObject({ hasMetadataError: true });
  });
});

describe('deciding whether a file needs re-reading', () => {
  const known: ILibraryTrack = {
    id: 't1',
    rootId: 'r1',
    path: 'C:\\Music\\a.mp3',
    kind: 'audio',
    isPlayable: true,
    title: 'A',
    sizeBytes: 100,
    mtimeMs: 200,
    addedAt: 1,
  };

  it('skips a file that has not changed', () => {
    expect(shouldReparse(known, { size: 100, mtimeMs: 200 })).toBe(false);
  });

  it('re-reads a file whose size or time moved, or that is new', () => {
    expect(shouldReparse(known, { size: 101, mtimeMs: 200 })).toBe(true);
    expect(shouldReparse(known, { size: 100, mtimeMs: 201 })).toBe(true);
    expect(shouldReparse(undefined, { size: 100, mtimeMs: 200 })).toBe(true);
  });

  it('gives a file the same id every scan', () => {
    expect(trackIdForPath('C:\\Music\\a.mp3')).toBe(
      trackIdForPath('C:\\Music\\a.mp3'),
    );
    expect(trackIdForPath('C:\\Music\\a.mp3')).not.toBe(
      trackIdForPath('C:\\Music\\b.mp3'),
    );
  });
});
