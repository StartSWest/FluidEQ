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
import {
  findFolderArt,
  readLibraryTags,
} from '../../../main/library/libraryMetadata';
// Imported from the renderer on purpose: this asserts the real percentage
// calculation the strip shows, not a hand-copied formula that could quietly
// drift from it. See `libraryScanPercent`'s own doc for why `parsed > 0` is
// the gate.
import { libraryScanPercent } from '../../../renderer/library/LibraryScanProgress';

jest.mock('../../../main/library/libraryMetadata', () => ({
  readLibraryTags: jest.fn(() => Promise.resolve({ title: 'Tagged' })),
  findFolderArt: jest.fn(() => undefined),
}));

const mockedReadLibraryTags = readLibraryTags as jest.Mock;
const mockedFindFolderArt = findFolderArt as jest.Mock;

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

  it('reads a cloud placeholder, which Windows reports as a symlink', async () => {
    // Files On-Demand leaves an online-only file as a reparse point, and
    // `readdir` reports every reparse point as a symbolic link — `Dirent`
    // carries no tag to tell the two apart. Skipping them all meant a library
    // kept in OneDrive scanned to nothing on a machine that had not
    // downloaded it, which is what "I added the folder and nothing happened"
    // was. `stat` follows the point and says what it really is.
    const dir = folder({ 'cloud.mp3': 'x', 'real/b.mp3': 'x' });
    const actualReaddir = fs.promises.readdir;
    const readdir = jest.spyOn(fs.promises, 'readdir');
    readdir.mockImplementation((async (target: never, options: never) => {
      const entries = (await actualReaddir(
        target,
        options,
      )) as unknown as fs.Dirent[];
      return entries.map((entry) =>
        entry.name === 'cloud.mp3'
          ? ({
              name: entry.name,
              isFile: () => false,
              isDirectory: () => false,
              isSymbolicLink: () => true,
            } as fs.Dirent)
          : entry,
      );
    }) as unknown as typeof fs.promises.readdir);

    try {
      const result = await scan(dir);
      expect(
        result.tracks.map((entry) => path.basename(entry.path)).sort(),
      ).toEqual(['b.mp3', 'cloud.mp3']);
    } finally {
      readdir.mockRestore();
    }
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
    // a full tree walk before Stop does anything."
    //
    // What survives is every file discovery actually found, as a provisional
    // row. That is not a partial answer dressed up as a whole one: the walk
    // genuinely established those files exist, and discarding that would
    // throw away the one fact the run did prove. Nothing here claims to have
    // read a tag -- every surviving row is `isPending`.
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
    // Stopped early, so not the whole folder — and nothing it kept pretends
    // to have been read.
    expect(result.tracks.length).toBeLessThan(3);
    expect(result.tracks.every((track) => track.isPending === true)).toBe(true);
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
    // Every file discovery found survives the cancel, but only the ones
    // parsing actually reached claim to have been read. The rest stay
    // provisional and the next scan finishes them — a cancelled scan is a
    // partial library, never a lost one, and never a lying one either.
    expect(result.tracks).toHaveLength(3);
    const parsed = result.tracks.filter((track) => track.isPending !== true);
    const stillPending = result.tracks.filter(
      (track) => track.isPending === true,
    );
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length + stillPending.length).toBe(3);
  });

  it('carries forward every known track a cancelled rescan never got back around to', async () => {
    // Reproduces the data loss directly: six known, unchanged tracks across
    // two directories, cancelled after only two have been reached. Before
    // this fix the result held only the two actually confirmed, and
    // `scanOneRoot` (src/main/ipc/library.ts) replaces a root's tracks with
    // this result wholesale -- so the other four, which had not changed at
    // all, would simply vanish from the library the moment Stop was pressed.
    const dir = folder({
      'Album A/a.mp3': 'x',
      'Album A/b.mp3': 'x',
      'Album A/c.mp3': 'x',
      'Album B/d.mp3': 'x',
      'Album B/e.mp3': 'x',
      'Album B/f.mp3': 'x',
    });
    const fileNames = ['a', 'b', 'c', 'd', 'e', 'f'];
    const known: ILibraryTrack[] = fileNames.map((name) => {
      const filePath = path.join(
        dir,
        name <= 'c' ? 'Album A' : 'Album B',
        `${name}.mp3`,
      );
      const stats = fs.statSync(filePath);
      return {
        id: trackIdForPath(filePath),
        rootId: 'r1',
        path: filePath,
        kind: 'audio',
        isPlayable: true,
        title: name.toUpperCase(),
        sizeBytes: stats.size,
        mtimeMs: stats.mtimeMs,
        addedAt: 1,
      };
    });

    let parseEventsSeen = 0;
    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known,
      onProgress: (progress) => {
        if (progress.parsed > 0) {
          parseEventsSeen += 1;
        }
      },
      // Cancels after the second file is confirmed -- two of six reached,
      // four not yet revisited.
      isCancelled: () => parseEventsSeen >= 2,
    });

    expect(result.wasCancelled).toBe(true);
    // The count assertion the bug would have failed: the array was non-empty
    // (2 of 6) even when broken, so "some tracks survived" was never enough.
    expect(result.tracks).toHaveLength(6);
    expect(result.tracks.map((track) => track.path).sort()).toEqual(
      known.map((track) => track.path).sort(),
    );
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

  it('hands embedded artwork to the supplied host cache before publishing the track', async () => {
    const picture = new Uint8Array([1, 2, 3, 4]);
    mockedReadLibraryTags.mockResolvedValueOnce({
      title: 'Covered',
      artist: 'Tagged artist',
      picture: { data: picture, format: 'image/png' },
    });
    const storeArtwork = jest.fn<Promise<string | undefined>, [Uint8Array]>(
      () => Promise.resolve('abc123'),
    );
    const dir = folder({ 'covered.mp3': 'x' });

    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      storeArtwork,
      onProgress: () => undefined,
      isCancelled: () => false,
    });

    expect(storeArtwork).toHaveBeenCalledWith(picture);
    expect(result.tracks[0]).toMatchObject({
      title: 'Covered',
      artist: 'Tagged artist',
      artId: 'abc123',
      artworkChecked: true,
    });
  });

  it('hands folder artwork to the same host cache when tags have no picture', async () => {
    mockedFindFolderArt.mockReturnValueOnce('cover.jpg');
    const storeArtwork = jest.fn<Promise<string | undefined>, [Uint8Array]>(
      () => Promise.resolve('def456'),
    );
    const dir = folder({ 'plain.mp3': 'x', 'cover.jpg': 'folder-cover' });

    const result = await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      storeArtwork,
      onProgress: () => undefined,
      isCancelled: () => false,
    });

    expect(storeArtwork).toHaveBeenCalledTimes(1);
    expect(Buffer.from(storeArtwork.mock.calls[0][0]).toString('utf8')).toBe(
      'folder-cover',
    );
    expect(result.tracks[0]).toMatchObject({
      artId: 'def456',
      artworkChecked: true,
    });
  });

  it('publishes parsed tracks in batches before the scan finishes, growing across batches', async () => {
    // Enough files to cross the batch-size threshold at least once, so this
    // proves batching (more than one onTracks call) rather than "everything
    // published in one shot at the end" happening to satisfy a looser
    // assertion.
    const files: Record<string, string> = {};
    for (let index = 0; index < 30; index += 1) {
      files[`track-${String(index).padStart(2, '0')}.mp3`] = 'x';
    }
    const dir = folder(files);

    let terminalEventSeen = false;
    let aTrackWasPublishedBeforeTheTerminalEvent = false;
    const batchSizes: number[] = [];

    await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: (progress) => {
        if (progress.isDone) {
          terminalEventSeen = true;
        }
      },
      onTracks: (tracks) => {
        if (!terminalEventSeen) {
          aTrackWasPublishedBeforeTheTerminalEvent = true;
        }
        // Every file is published twice over a whole scan — once by discovery
        // as a provisional row so the library is populated before any tag is
        // read, then again by parsing with its real metadata. Counting only
        // the parsed half is what makes "nothing lost or double-counted"
        // still mean something now that the provisional half exists.
        if (tracks.every((track) => track.isPending !== true)) {
          batchSizes.push(tracks.length);
        }
      },
      isCancelled: () => false,
    });

    expect(aTrackWasPublishedBeforeTheTerminalEvent).toBe(true);
    // More than one batch: the count published keeps growing rather than
    // arriving as a single dump at the end.
    expect(batchSizes.length).toBeGreaterThan(1);
    // Nothing lost or double-counted across the parsed batches.
    expect(batchSizes.reduce((sum, size) => sum + size, 0)).toBe(30);
  });

  it('publishes every file as a provisional row before it parses any of them', async () => {
    // The whole point of the two-phase walk from the user's side: a folder
    // added to the library shows its files immediately, and the scan then
    // fills their details in. A row that only appears once its tags are read
    // leaves a large folder blank for minutes.
    const dir = folder({
      'Album/one.mp3': 'x',
      'Album/two.mp3': 'x',
      'Album/three.mp3': 'x',
    });
    const published: { pending: boolean; title: string; album?: string }[] = [];
    await scanLibraryRoot({
      rootId: 'r1',
      rootPath: dir,
      userDataDir: dir,
      known: [],
      onProgress: () => undefined,
      onTracks: (tracks) => {
        tracks.forEach((track) =>
          published.push({
            pending: track.isPending === true,
            title: track.title,
            album: track.album,
          }),
        );
      },
      isCancelled: () => false,
    });

    const firstParsedAt = published.findIndex((entry) => !entry.pending);
    const provisional = published.filter((entry) => entry.pending);
    expect(provisional).toHaveLength(3);
    // All three provisional rows land before the first parsed one.
    expect(firstParsedAt).toBe(3);
    // Grouped by the folder they sit in, so they form a real album rather
    // than collapsing into one untitled heap while the scan runs.
    expect(provisional.every((entry) => entry.album === 'Album')).toBe(true);
  });

  it('skips a file that vanishes between discovery and parsing, keeping the rest of the root (blocker 3)', async () => {
    // Discovery finishes the whole tree before parsing reads a single file
    // (the two-phase design this module documents), so a file can be gone by
    // the time its candidate reaches `fs.promises.stat` -- a download folder
    // tidying itself, a share dropping, a permissions change. Before the fix
    // this was the one unguarded await in the whole scan chain: it rejected
    // `scanLibraryRoot` outright and the other two files below vanished from
    // the result along with it, not just the one that was actually gone.
    const dir = folder({ 'a.mp3': 'x', 'gone.mp3': 'x', 'b.mp3': 'x' });
    const missingPath = path.join(dir, 'gone.mp3');
    const realStat = fs.promises.stat.bind(fs.promises);
    const statSpy = jest
      .spyOn(fs.promises, 'stat')
      .mockImplementation((target: Parameters<typeof fs.promises.stat>[0]) => {
        if (target === missingPath) {
          return Promise.reject(new Error('ENOENT: no such file or directory'));
        }
        return realStat(target);
      });
    try {
      const result = await scan(dir);
      expect(
        result.tracks.map((entry) => path.basename(entry.path)).sort(),
      ).toEqual(['a.mp3', 'b.mp3']);
    } finally {
      statSpy.mockRestore();
    }
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
    artworkChecked: true,
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

  it('repairs an unchanged legacy track once when no artwork result was recorded', () => {
    expect(
      shouldReparse(
        { ...known, artId: undefined, artworkChecked: undefined },
        { size: 100, mtimeMs: 200 },
      ),
    ).toBe(true);
    // A real cached id proves the old scan completed artwork even before the
    // explicit marker existed, so those tracks do not need the migration pass.
    expect(
      shouldReparse(
        { ...known, artId: 'abc123', artworkChecked: undefined },
        { size: 100, mtimeMs: 200 },
      ),
    ).toBe(false);
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
