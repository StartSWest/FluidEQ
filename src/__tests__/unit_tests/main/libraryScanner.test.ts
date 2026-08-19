import fs from 'fs';
import os from 'os';
import path from 'path';
import { ILibraryTrack } from '../../../common/library/types';
import {
  scanLibraryRoot,
  shouldReparse,
  trackIdForPath,
} from '../../../main/library/libraryScanner';

jest.mock('../../../main/library/libraryMetadata', () => ({
  readLibraryTags: jest.fn(() => Promise.resolve({ title: 'Tagged' })),
  findFolderArt: () => undefined,
}));
jest.mock('../../../main/library/libraryArtwork', () => ({
  storeArtwork: () => Promise.resolve(undefined),
}));

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
