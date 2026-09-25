import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  ILibraryScanProgress,
  ILibraryTrack,
} from '../../../common/library/types';
import {
  IScanOptions,
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

type TScanEvent =
  | { type: 'progress'; progress: ILibraryScanProgress }
  | { type: 'tracks'; tracks: readonly ILibraryTrack[]; confirmed: boolean }
  | { type: 'unchanged'; ids: readonly string[] };

interface IWalkHooks {
  lookupKnown: IScanOptions['lookupKnown'];
  onProgress: IScanOptions['onProgress'];
  onTracks: NonNullable<IScanOptions['onTracks']>;
  onUnchanged: NonNullable<IScanOptions['onUnchanged']>;
}

/**
 * Everything a walk said, in order, and the library it leaves behind.
 *
 * The scanner answers with counts alone: its songs go out through `onTracks`
 * and `onUnchanged` as it walks. This stands in for the store the way the
 * runner wires it (`libraryScanRunner.ts`): a batch replaces rows by id, and
 * `lookupKnown` answers from what has landed so far — so the pending row
 * discovery wrote for a file is what parsing finds for it, as in the app.
 */
const recordWalk = (known: readonly ILibraryTrack[] = []) => {
  const library = new Map<string, ILibraryTrack>(
    known.map((track) => [track.id, track]),
  );
  const events: TScanEvent[] = [];
  const hooks: IWalkHooks = {
    lookupKnown: (filePath) =>
      [...library.values()].find((track) => track.path === filePath),
    onProgress: (progress) => {
      events.push({ type: 'progress', progress });
    },
    onTracks: (tracks, confirmed) => {
      events.push({ type: 'tracks', tracks, confirmed });
      tracks.forEach((track) => library.set(track.id, track));
    },
    onUnchanged: (ids) => {
      events.push({ type: 'unchanged', ids });
    },
  };
  return {
    events,
    hooks,
    songs: (): ILibraryTrack[] => [...library.values()],
    progress: (): ILibraryScanProgress[] =>
      events.flatMap((event) =>
        event.type === 'progress' ? [event.progress] : [],
      ),
    /** Ids the walk vouched for: read, or found unchanged. */
    confirmedIds: (): string[] =>
      events.flatMap((event) => {
        if (event.type === 'unchanged') {
          return [...event.ids];
        }
        return event.type === 'tracks' && event.confirmed
          ? event.tracks.map((track) => track.id)
          : [];
      }),
  };
};

type TWalkRecord = ReturnType<typeof recordWalk>;

const scan = (
  rootPath: string,
  walk: TWalkRecord,
  extra: Partial<IScanOptions> = {},
) =>
  scanLibraryRoot({
    rootId: 'r1',
    rootPath,
    userDataDir: rootPath,
    force: false,
    isCancelled: () => false,
    ...walk.hooks,
    ...extra,
  });

const baseNames = (tracks: readonly ILibraryTrack[]): string[] =>
  tracks.map((track) => path.basename(track.path)).sort();

/** A song the store already holds for `filePath`, as it stands on disk now. */
const knownSong = (
  filePath: string,
  over: Partial<ILibraryTrack> = {},
): ILibraryTrack => {
  const stats = fs.statSync(filePath);
  return {
    id: trackIdForPath(filePath),
    rootId: 'r1',
    path: filePath,
    kind: 'audio',
    isPlayable: true,
    title: path.basename(filePath, '.mp3').toUpperCase(),
    artworkChecked: true,
    sizeBytes: stats.size,
    mtimeMs: stats.mtimeMs,
    addedAt: 1,
    ...over,
  };
};

describe('scanning a folder', () => {
  it('finds music at any depth and ignores everything else', async () => {
    const dir = folder({
      'a.mp3': 'x',
      'notes.txt': 'x',
      'Album/b.flac': 'x',
      'Album/cover.jpg': 'x',
      'Album/Live/c.m4a': 'x',
    });
    const walk = recordWalk();
    const result = await scan(dir, walk);
    expect(baseNames(walk.songs())).toEqual(['a.mp3', 'b.flac', 'c.m4a']);
    expect(result.found).toBe(3);
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
      const walk = recordWalk();
      await scan(dir, walk);
      expect(baseNames(walk.songs())).toEqual(['b.mp3', 'cloud.mp3']);
    } finally {
      readdir.mockRestore();
    }
  });

  it('excludes a song that has a lyric file beside it, and counts it', async () => {
    const dir = folder({ 'Song.mp3': 'x', 'Song.lrc': '[00:01.00]hi' });
    const walk = recordWalk();
    const result = await scan(dir, walk);
    expect(walk.songs()).toHaveLength(0);
    expect(result.karaokeSkipped).toBe(1);
  });

  it('keeps a song whose .txt sibling is not an UltraStar chart', async () => {
    // The positive control the spec insists on. A scanner that excluded every
    // .txt-adjacent song would pass the test above and quietly lose albums
    // that ship a tracklist.
    const dir = folder({ 'Song.mp3': 'x', 'Song.txt': '1. Intro\n2. Verse\n' });
    const walk = recordWalk();
    const result = await scan(dir, walk);
    expect(walk.songs()).toHaveLength(1);
    expect(result.karaokeSkipped).toBe(0);
  });

  it('excludes a song whose .txt sibling really is a chart', async () => {
    const dir = folder({
      'Song.mp3': 'x',
      'Song.txt': '#TITLE:Song\n#BPM:200\n: 0 4 0 Hel~\n',
    });
    const walk = recordWalk();
    const result = await scan(dir, walk);
    expect(walk.songs()).toHaveLength(0);
    expect(result.karaokeSkipped).toBe(1);
  });

  it('lists a video it cannot play, marked', async () => {
    const dir = folder({ 'clip.mkv': 'x' });
    const walk = recordWalk();
    await scan(dir, walk);
    expect(walk.songs()[0]).toMatchObject({
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
    // read a tag -- every surviving row is `isPending`, and none of them is
    // vouched for, so nothing in the store is marked as read by this walk.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    const walk = recordWalk();
    const result = await scan(dir, walk, {
      isCancelled: () => walk.progress().length > 0,
    });
    expect(result.wasCancelled).toBe(true);
    // Stopped early, so not the whole folder — but what it found is kept.
    expect(walk.songs().length).toBeGreaterThan(0);
    expect(walk.songs().length).toBeLessThan(3);
    expect(walk.songs().every((track) => track.isPending === true)).toBe(true);
    expect(walk.confirmedIds()).toEqual([]);
  });

  it('keeps whatever parsing had already produced when cancelled mid-parse', async () => {
    // A cancel that lands after parsing has started -- `progress.parsed > 0`
    // -- is the case the module's own "never a lost one" promise is about:
    // whatever was already built survives, even though the rest of the walk
    // is abandoned.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    const walk = recordWalk();
    const result = await scan(dir, walk, {
      isCancelled: () => walk.progress().some((event) => event.parsed > 0),
    });
    expect(result.wasCancelled).toBe(true);
    // Every file discovery found survives the cancel, but only the ones
    // parsing actually reached claim to have been read. The rest stay
    // provisional and the next scan finishes them — a cancelled scan is a
    // partial library, never a lost one, and never a lying one either.
    const songs = walk.songs();
    expect(songs).toHaveLength(3);
    const parsed = songs.filter((track) => track.isPending !== true);
    const stillPending = songs.filter((track) => track.isPending === true);
    expect(parsed.length).toBeGreaterThan(0);
    expect(parsed.length + stillPending.length).toBe(3);
    expect(walk.confirmedIds().sort()).toEqual(
      parsed.map((track) => track.id).sort(),
    );
  });

  it('leaves every known track a cancelled rescan never got back around to exactly as it was', async () => {
    // The data loss this guards: six known, unchanged tracks across two
    // directories, cancelled after only two have been reached. The runner
    // sweeps a root's unvouched songs only when a walk says it finished
    // (`libraryScanRunner.ts`), so the four never reached survive only if
    // the walk reports the cancel -- and only unharmed if it writes nothing
    // over them, not even a provisional row that would dim them back to
    // pending on every Stop.
    const dir = folder({
      'Album A/a.mp3': 'x',
      'Album A/b.mp3': 'x',
      'Album A/c.mp3': 'x',
      'Album B/d.mp3': 'x',
      'Album B/e.mp3': 'x',
      'Album B/f.mp3': 'x',
    });
    const known = ['a', 'b', 'c', 'd', 'e', 'f'].map((name) =>
      knownSong(
        path.join(dir, name <= 'c' ? 'Album A' : 'Album B', `${name}.mp3`),
      ),
    );
    const walk = recordWalk(known);
    const result = await scan(dir, walk, {
      // Cancels after the second file is confirmed -- two of six reached,
      // four not yet revisited.
      isCancelled: () =>
        walk.progress().filter((event) => event.parsed > 0).length >= 2,
    });

    expect(result.wasCancelled).toBe(true);
    // The two it reached are vouched for, unchanged, and nothing else is.
    expect(walk.confirmedIds()).toHaveLength(2);
    // The count the old bug would have failed: two of six survived it.
    expect(walk.songs()).toHaveLength(6);
    expect(walk.songs()).toEqual(known);
    expect(walk.events.filter((event) => event.type === 'tracks')).toHaveLength(
      0,
    );
  });

  it('reports seen ahead of parsed while a directory is still being worked through', async () => {
    // The regression this guards: `seen` and `parsed` used to be incremented
    // together for the same file, so every live progress event had
    // `seen === parsed` and a determinate bar read 100% for the whole scan.
    const dir = folder({ 'a.mp3': 'x', 'b.mp3': 'x', 'c.mp3': 'x' });
    const walk = recordWalk();
    await scan(dir, walk);
    expect(walk.progress().some((event) => event.seen > event.parsed)).toBe(
      true,
    );
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
    const walk = recordWalk();
    await scan(dir, walk);
    const events = walk.progress();

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
    const knownAddedAt = 12345;
    const stale = knownSong(knownPath, { title: 'Old title' });
    // A mismatched size is what makes shouldReparse ask for a rebuild.
    const walk = recordWalk([
      { ...stale, sizeBytes: stale.sizeBytes + 1, addedAt: knownAddedAt },
    ]);
    const before = Date.now();
    await scan(dir, walk);
    const reparsed = walk.songs().find((entry) => entry.path === knownPath);
    const fresh = walk
      .songs()
      .find((entry) => path.basename(entry.path) === 'new.mp3');
    expect(reparsed?.title).toBe('Tagged');
    expect(reparsed?.addedAt).toBe(knownAddedAt);
    expect(fresh?.addedAt).toBeGreaterThanOrEqual(before);
  });

  it('re-reads an unchanged file only when forced, keeping the day it joined', async () => {
    // Forcing is the escape hatch for a tagger that preserves the modified
    // time, and for covers cleared from the artwork cache behind the app's
    // back: an ordinary walk trusts an unchanged file and never reads it
    // again. The known row is still looked up on a forced walk — it used to
    // be handed nothing, and every song lost the day it was added.
    const dir = folder({ 'kept.mp3': 'x' });
    const joined = knownSong(path.join(dir, 'kept.mp3'), {
      title: 'Old title',
      addedAt: 12345,
    });

    // The positive control: the same song, not forced, is confirmed as it is.
    const ordinary = recordWalk([joined]);
    await scan(dir, ordinary);
    expect(ordinary.songs()).toEqual([joined]);
    expect(ordinary.confirmedIds()).toEqual([joined.id]);

    const forced = recordWalk([joined]);
    await scan(dir, forced, { force: true });
    expect(forced.songs()).toEqual([
      expect.objectContaining({
        id: joined.id,
        title: 'Tagged',
        addedAt: 12345,
      }),
    ]);
    expect(forced.confirmedIds()).toEqual([joined.id]);
  });

  it('sets hasMetadataError only when the tag read itself failed', async () => {
    mockedReadLibraryTags.mockResolvedValueOnce({ readFailed: true });
    const dir = folder({ 'broken.mp3': 'x' });
    const walk = recordWalk();
    await scan(dir, walk);
    expect(walk.songs()[0]).toMatchObject({ hasMetadataError: true });
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

    const walk = recordWalk();
    await scan(dir, walk, { storeArtwork });

    expect(storeArtwork).toHaveBeenCalledWith(picture);
    expect(walk.songs()[0]).toMatchObject({
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

    const walk = recordWalk();
    await scan(dir, walk, { storeArtwork });

    expect(storeArtwork).toHaveBeenCalledTimes(1);
    expect(Buffer.from(storeArtwork.mock.calls[0][0]).toString('utf8')).toBe(
      'folder-cover',
    );
    expect(walk.songs()[0]).toMatchObject({
      artId: 'def456',
      artworkChecked: true,
    });
  });

  it('publishes parsed tracks in batches before the scan finishes, growing across batches', async () => {
    // Enough files to cross the batch-size threshold at least once, so this
    // proves batching (more than one read batch) rather than "everything
    // published in one shot at the end" happening to satisfy a looser
    // assertion.
    const files: Record<string, string> = {};
    for (let index = 0; index < 30; index += 1) {
      files[`track-${String(index).padStart(2, '0')}.mp3`] = 'x';
    }
    const dir = folder(files);

    const walk = recordWalk();
    await scan(dir, walk);

    const doneAt = walk.events.findIndex(
      (event) => event.type === 'progress' && event.progress.isDone,
    );
    // Every file is published twice over a whole scan — once by discovery
    // as a provisional row so the library is populated before any tag is
    // read, then again by parsing with its real metadata. Counting only
    // the read half is what makes "nothing lost or double-counted" still
    // mean something now that the provisional half exists.
    const readBatches = walk.events.flatMap((event, at) =>
      event.type === 'tracks' && event.confirmed
        ? [{ at, size: event.tracks.length }]
        : [],
    );
    expect(readBatches.length).toBeGreaterThan(0);
    expect(readBatches[0].at).toBeLessThan(doneAt);
    // More than one batch: the count published keeps growing rather than
    // arriving as a single dump at the end.
    expect(readBatches.length).toBeGreaterThan(1);
    // Nothing lost or double-counted across the read batches.
    expect(readBatches.reduce((sum, batch) => sum + batch.size, 0)).toBe(30);
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
    const walk = recordWalk();
    await scan(dir, walk);

    const published = walk.events.flatMap((event) =>
      event.type === 'tracks'
        ? event.tracks.map((track) => ({
            pending: track.isPending === true,
            confirmed: event.confirmed,
            album: track.album,
          }))
        : [],
    );
    const firstParsedAt = published.findIndex((entry) => !entry.pending);
    const provisional = published.filter((entry) => entry.pending);
    expect(provisional).toHaveLength(3);
    // A listed file is not a read one: none of them is vouched for yet.
    expect(provisional.every((entry) => !entry.confirmed)).toBe(true);
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
    // `scanLibraryRoot` outright and the other two files went with it, not
    // just the one that was actually gone. The file is deleted for real, in
    // the gap between the phases: once discovery has counted all three, and
    // before parsing has read the first -- whatever order the disk lists them.
    const dir = folder({ 'a.mp3': 'x', 'gone.mp3': 'x', 'b.mp3': 'x' });
    const gonePath = path.join(dir, 'gone.mp3');
    // The skip is logged, like every other one in the walk; kept off the
    // run's output so it is not mistaken for a failure of the test itself.
    const logged = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const walk = recordWalk();
      const result = await scan(dir, walk, {
        onProgress: (progress) => {
          walk.hooks.onProgress(progress);
          if (
            progress.seen === 3 &&
            progress.parsed === 0 &&
            fs.existsSync(gonePath)
          ) {
            fs.rmSync(gonePath);
          }
        },
      });

      // Finished, not cancelled, and nothing vouches for the vanished file:
      // the runner's sweep takes away any row the library had for it.
      expect(result.wasCancelled).toBe(false);
      expect(result.found).toBe(2);
      expect(walk.confirmedIds().sort()).toEqual(
        [path.join(dir, 'a.mp3'), path.join(dir, 'b.mp3')]
          .map(trackIdForPath)
          .sort(),
      );
      expect(
        baseNames(walk.songs().filter((track) => track.isPending !== true)),
      ).toEqual(['a.mp3', 'b.mp3']);
      // Matched by its code rather than `expect.any(Error)`: Node builds its
      // own errors in its own realm, which is not the jsdom one this runs in.
      expect(logged).toHaveBeenCalledWith(
        `Could not stat ${gonePath}`,
        expect.objectContaining({ code: 'ENOENT' }),
      );
    } finally {
      logged.mockRestore();
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

  it('reads a file that was only ever listed, whatever its size and time say', () => {
    // Parsing asks the live store, where discovery's own pending row for the
    // file landed moments earlier with the file's real size and time: trusted
    // as unchanged, it would never be read at all.
    expect(
      shouldReparse({ ...known, isPending: true }, { size: 100, mtimeMs: 200 }),
    ).toBe(true);
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
