import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../../common/library/types';
import {
  scanLibraryRoot,
  shouldReparse,
  trackIdForPath,
} from '../../../main/library/libraryScanner';
import { readLibraryTags } from '../../../main/library/libraryMetadata';
// Imported from the renderer on purpose: this asserts the real percentage
// calculation the strip shows, not a hand-copied formula that could quietly
// drift from it. See `libraryScanPercent`'s own doc for why `parsed > 0` is
// the gate.
import { libraryScanPercent } from '../../../renderer/library/LibraryScanProgress';

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

  it('stops discovering as soon as it is asked, before any parsing begins', async () => {
    // The two-phase walk means a cancel can land entirely inside discovery,
    // before phase two has ever run -- exactly the case that matters for "a
    // user who starts a scan of the wrong drive should not have to wait for
    // a full tree walk before Stop does anything." Nothing has been
    // confirmed yet and nothing was known before this scan, so the honest
    // result is empty, not partial.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    let sawAnEvent = false;
    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: () => {
        sawAnEvent = true;
      },
      isCancelled: () => sawAnEvent,
    });
    expect(result.wasCancelled).toBe(true);
    expect(result.tracks).toHaveLength(0);
  });

  it('keeps whatever parsing had already produced when cancelled mid-parse', async () => {
    // A cancel that lands after parsing has started -- `progress.parsed > 0`
    // -- is the case the module's own "never a lost one" promise is about:
    // whatever was already built survives, even though the rest of the walk
    // is abandoned.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    let parseEventsSeen = 0;
    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: (progress) => {
        if (progress.parsed > 0) {
          parseEventsSeen += 1;
        }
      },
      isCancelled: () => parseEventsSeen >= 1,
    });
    expect(result.wasCancelled).toBe(true);
    expect(result.tracks.length).toBeGreaterThan(0);
    expect(result.tracks.length).toBeLessThan(3);
  });

  it('reports seen ahead of parsed while a directory is still being worked through', async () => {
    // The regression this guards: `seen` and `parsed` used to be incremented
    // together for the same file, so every live progress event had
    // `seen === parsed` and a determinate bar read 100% for the whole scan.
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

  it('makes seen a real total before parsed ever climbs, across more than one directory', async () => {
    // This is the shape that caught the previous fix's miss: incrementing
    // `seen` per directory (rather than once for the whole tree) still let
    // `parsed` catch up to `seen` at the end of *every* directory, not just
    // the end of the scan -- so a library organised one folder per album
    // hit 100% within the first few files and stayed there. Two directories
    // of different sizes, matching the trace the review posted: Album A
    // with 3 tracks, Album B with 5.
    const dir = folder({
      'Album A/a.mp3': 'x',
      'Album A/b.mp3': 'x',
      'Album A/c.mp3': 'x',
      'Album B/d.mp3': 'x',
      'Album B/e.mp3': 'x',
      'Album B/f.mp3': 'x',
      'Album B/g.mp3': 'x',
      'Album B/h.mp3': 'x',
    });
    const events: ILibraryScanProgress[] = [];
    await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: (progress) => events.push(progress),
      isCancelled: () => false,
    });

    const finalSeen = events[events.length - 1].seen;
    expect(finalSeen).toBe(8);

    // No event ever claims to have parsed more than it has seen.
    expect(events.every((event) => event.parsed <= event.seen)).toBe(true);

    // `seen` is already at its final value for every event from the moment
    // parsing starts -- it never moves again once `parsed` is above zero.
    const parseEvents = events.filter((event) => event.parsed > 0);
    expect(parseEvents.length).toBeGreaterThan(0);
    expect(parseEvents.every((event) => event.seen === finalSeen)).toBe(true);

    // The assertion that would have caught this round's miss: fed through
    // the real renderer calculation, the displayed percentage only ever
    // goes up, and it does not touch 100 until the file that actually
    // finishes the scan -- not partway through, and not once per directory.
    const percentages = events.map((event) => libraryScanPercent(event));
    const isMonotonicallyNonDecreasing = percentages.every(
      (percent, index) => index === 0 || percent >= percentages[index - 1],
    );
    expect(isMonotonicallyNonDecreasing).toBe(true);
    const firstHundredIndex = percentages.findIndex(
      (percent) => percent === 100,
    );
    expect(firstHundredIndex).toBeGreaterThan(-1);
    // The event where 100% first appears really is the one where every
    // discovered candidate has been parsed -- not an early plateau caused by
    // `seen` catching up to `parsed` at the end of a single directory.
    expect(events[firstHundredIndex].parsed).toBe(finalSeen);
    expect(
      percentages.slice(0, firstHundredIndex).every((percent) => percent < 100),
    ).toBe(true);
    // The closing summary event (`isDone: true`) reports the same final
    // counts as the last real parse tick, so the tail of the sequence may
    // repeat 100 -- that is not a second climb, and is not what this test
    // is guarding against.
    expect(
      percentages.slice(firstHundredIndex).every((percent) => percent === 100),
    ).toBe(true);
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
