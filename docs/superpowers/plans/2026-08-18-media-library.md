# Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Library tab that scans folders of music and video, reads their tags and cover art into an index, browses them as a list, a grid or a Cover Flow across album, artist and song, and plays them from a player that survives a tab change.

**Architecture:** The main process owns the index — it scans, parses tags, caches thumbnails and writes one JSON file in `userData`. The renderer holds a snapshot of that index and derives albums, artists, sorting and search from it with pure functions in `src/common/library/`, which is where nearly all the testable logic lives. Files reach the renderer only through a privileged `fluideq-media://` scheme resolved by id, never by path.

**Tech Stack:** Electron 43, React 19, TypeScript (strict), Sass, Jest + ts-jest + Testing Library, `music-metadata` (version decided in Task 1).

**Spec:** [`docs/superpowers/specs/2026-08-18-media-library-design.md`](../specs/2026-08-18-media-library-design.md)

## Global Constraints

Copied from the project rules in `CLAUDE.md`; every task's requirements implicitly include these.

- **Strict TypeScript.** No `any` (use `unknown` plus a type guard), no `!` non-null assertion, no `@ts-ignore`, no `==`, no `var`, no empty `catch`, no dead code. No `console.log` in source — a context-rich `console.error` immediately before an error is flattened for the user is the one exception.
- **No `eslint-disable` without an inline justification comment.**
- **Files stay under 500 lines** unless there is genuinely no seam.
- **Comments state what the code cannot** — constraints, measured numbers, the failure being prevented. Never a restatement of the next line.
- **No flag-driven components.** A component needing a mode flag to behave two ways is two components.
- **Every user-facing string goes through i18n, and all ten locales land in the same commit.** Locale codes: `en`, `zh`, `hi`, `es`, `fr`, `pt`, `ru`, `ja`, `de`, `it`. `src/__tests__/unit_tests/common/i18n.test.ts` asserts 100% coverage for every one of them, so a partial dictionary fails the suite.
- **Reuse existing classes, never invent a style.** `button small` is the filled accent, `button small subtle` the quiet outline. Emphasis follows recommendation.
- **Commit subjects are sentences in the imperative, not Conventional Commits.** Match the log: "Take the window full screen when the video player asks for it". Never `feat:` or `fix:`.
- **Every source file starts with the GPL header** used by its neighbours — copy it verbatim from an adjacent file in the same directory.
- **Jest will not start without a build.** If `pnpm test` complains about a missing bundle, run `pnpm build` once.
- **A pre-commit hook runs ESLint and Prettier on staged files.** A commit that fails lint does not land.
- **Null tests need a positive control beside them.** "Filtered exactly the karaoke files" and "filtered every file" produce identical passing output otherwise. This is not hypothetical here: it is how the separation packing bug survived.

Run a single test file with:

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryFiles.test.ts
```

---

### Task 1: Pin `music-metadata` to a version that loads in both loaders

The spec's one real risk. `music-metadata` v10+ is ESM-only; this project is `"type": "commonjs"` and loads main two different ways — bundled by webpack for a build, and through `ts-node` on `dev-main.cjs` in development. Answer this before any library code is written on top of it.

**Files:**

- Modify: `package.json` (dependencies)
- Create: `scripts/probe-music-metadata.ts` (throwaway; deleted in the final step)

**Interfaces:**

- Consumes: nothing.
- Produces: a `music-metadata` version that both loaders accept, and the knowledge of which import form to use in Task 7.

- [ ] **Step 1: Install the current release**

```bash
pnpm add -w music-metadata
```

`-w` is required at this workspace root; without it pnpm refuses.

- [ ] **Step 2: Write the probe**

Create `scripts/probe-music-metadata.ts`. Use the Write tool, not a shell heredoc — this file contains `$` and backslashes and a shell-quoted script corrupts both silently.

```ts
import { parseBuffer } from 'music-metadata';

/**
 * Throwaway. Answers one question: does this package load in the loader that
 * is running this file? Deleted once the version is pinned.
 */
const main = async () => {
  // A minimal ID3v2.3 tag with one TIT2 frame, then nothing. Enough to prove
  // the parser is reachable and running; not enough to be a real MP3.
  const title = 'Probe';
  const frame = Buffer.concat([
    Buffer.from('TIT2'),
    Buffer.from([0, 0, 0, title.length + 1, 0, 0, 0]),
    Buffer.from(title, 'latin1'),
  ]);
  const header = Buffer.from([
    0x49,
    0x44,
    0x33,
    3,
    0,
    0,
    0,
    0,
    0,
    frame.length,
  ]);
  const parsed = await parseBuffer(Buffer.concat([header, frame]), {
    mimeType: 'audio/mpeg',
  });
  process.stdout.write(`loaded, title=${parsed.common.title ?? '(none)'}\n`);
};

main().catch((error: unknown) => {
  process.stdout.write(`FAILED: ${String(error)}\n`);
  process.exitCode = 1;
});
```

- [ ] **Step 3: Run the probe under the development loader**

```bash
pnpm exec cross-env TS_NODE_TRANSPILE_ONLY=true ts-node scripts/probe-music-metadata.ts
```

Expected on success: `loaded, title=Probe`.
Expected on failure: `ERR_REQUIRE_ESM`, or `Cannot use import statement outside a module`. **This is the failure mode being hunted.**

- [ ] **Step 4: Run the probe under the bundler**

```bash
pnpm build:main
```

Expected: the build completes. A failure naming `music-metadata`, `strtok3`, `token-types` or an `.mjs` extension is the bundler refusing the package.

- [ ] **Step 5: If either failed, pin the CommonJS release**

```bash
pnpm add -w music-metadata@7.14.0
```

Then repeat Steps 3 and 4. 7.14.0 is the last CommonJS release, same MIT licence, same parsers for MP3, MP4, FLAC and Vorbis. Its import form is `import { parseBuffer } from 'music-metadata'` as well, so nothing downstream changes.

If 7.14.0 also fails the bundler, stop and report — do not work around it with a dynamic `import()` in main, which webpack will resolve differently in the two builds and produce a feature that works in development and not in a package.

- [ ] **Step 6: Record which version won, then delete the probe**

```bash
rm scripts/probe-music-metadata.ts
```

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add the tag reader the library scan will need"
```

---

### Task 2: Library file classification and karaoke exclusion

**Files:**

- Create: `src/common/library/types.ts`
- Create: `src/common/library/files.ts`
- Test: `src/__tests__/unit_tests/common/libraryFiles.test.ts`

**Interfaces:**

- Consumes: `KARAOKE_TEXT_ADAPTERS` from `src/common/karaoke/files.ts`.
- Produces:
  - `ILibraryIndex`, `ILibraryRoot`, `ILibraryTrack`, `ILibraryScanProgress`, `TLibraryBrowseMode`, `TLibraryViewMode`, `TLibrarySort`
  - `libraryFileExtension(name: string): string`
  - `libraryFileKind(name: string): 'audio' | 'video' | undefined`
  - `isLibraryPlayable(name: string): boolean`
  - `libraryTitleFromFileName(name: string): string`
  - `libraryBaseName(name: string): string`
  - `karaokeLyricCandidates(fileName: string, siblings: readonly string[]): { certain: string[]; needsContentCheck: string[] }`
  - `isUltraStarText(contents: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/libraryFiles.test.ts` with the GPL header copied from `src/__tests__/unit_tests/common/karaokeFiles.test.ts`, then:

```ts
import {
  isLibraryPlayable,
  isUltraStarText,
  karaokeLyricCandidates,
  libraryFileKind,
  libraryTitleFromFileName,
} from '../../../common/library/files';

describe('classifying a file the scanner has found', () => {
  it('sorts audio from video and knows what Chromium can decode', () => {
    expect(libraryFileKind('song.flac')).toBe('audio');
    expect(libraryFileKind('clip.MP4')).toBe('video');
    expect(libraryFileKind('notes.txt')).toBeUndefined();
    expect(libraryFileKind('no-extension')).toBeUndefined();
  });

  it('lists formats it cannot play rather than hiding them', () => {
    // A recognised-but-unplayable file has to reach the UI, or the library
    // silently loses half of somebody's collection and never says why.
    expect(libraryFileKind('movie.mkv')).toBe('video');
    expect(isLibraryPlayable('movie.mkv')).toBe(false);
    expect(isLibraryPlayable('track.wma')).toBe(false);
    expect(isLibraryPlayable('track.mp3')).toBe(true);
    expect(isLibraryPlayable('clip.webm')).toBe(true);
  });

  it('makes a readable title out of a filename', () => {
    expect(
      libraryTitleFromFileName('04 - Regi_Should Have Been There.mp3'),
    ).toBe('Regi Should Have Been There');
    expect(libraryTitleFromFileName('01.Song.mp3')).toBe('Song');
  });
});

describe('keeping karaoke songs out of the library', () => {
  it('pairs a song with its lyric file by base name', () => {
    const found = karaokeLyricCandidates('Song.mp3', [
      'Song.mp3',
      'Song.lrc',
      'Other.lrc',
    ]);
    expect(found.certain).toEqual(['Song.lrc']);
    expect(found.needsContentCheck).toEqual([]);
  });

  it('defers a .txt sibling to a content check', () => {
    // A .txt beside an MP3 is as often a tracklist as an UltraStar chart, so
    // the extension alone must not exclude the song.
    const found = karaokeLyricCandidates('Song.mp3', ['Song.mp3', 'Song.txt']);
    expect(found.certain).toEqual([]);
    expect(found.needsContentCheck).toEqual(['Song.txt']);
  });

  it('finds no pairing for an ordinary album folder', () => {
    // The positive control. Without it, a function that returns nothing for
    // every input passes the two tests above and destroys the library.
    const found = karaokeLyricCandidates('Song.mp3', [
      'Song.mp3',
      'cover.jpg',
      'Another Song.mp3',
    ]);
    expect(found.certain).toEqual([]);
    expect(found.needsContentCheck).toEqual([]);
  });

  it('recognises an UltraStar chart by its contents', () => {
    expect(isUltraStarText('#TITLE:Song\n#BPM:200\n: 0 4 0 Hel~\n')).toBe(true);
    expect(isUltraStarText('1. Intro\n2. Verse\n')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryFiles.test.ts
```

Expected: FAIL — `Cannot find module '../../../common/library/files'`.

- [ ] **Step 3: Write `src/common/library/types.ts`**

GPL header, then exactly the interfaces from §5 of the spec, plus:

```ts
export type TLibraryBrowseMode = 'album' | 'artist' | 'song';
export type TLibraryViewMode = 'list' | 'grid' | 'coverflow';
export type TLibrarySort = 'title' | 'artist' | 'album' | 'year' | 'added';

export interface ILibraryScanProgress {
  rootId: string;
  /** Files walked so far. Not a total — the walk and the parse interleave. */
  seen: number;
  parsed: number;
  karaokeSkipped: number;
  /** The file being read, for the progress line. Base name only. */
  current?: string;
  isDone: boolean;
}
```

- [ ] **Step 4: Write `src/common/library/files.ts`**

GPL header, then:

```ts
import { KARAOKE_TEXT_ADAPTERS } from '../karaoke/files';

/**
 * Every audio container a music folder is likely to hold.
 *
 * Deliberately longer than the Karaoke tab's list, which is what that feature
 * supports rather than what a library should show. See
 * `LIBRARY_UNPLAYABLE_EXTENSIONS` for the half Chromium refuses.
 */
export const LIBRARY_AUDIO_EXTENSIONS = [
  'mp3',
  'wav',
  'ogg',
  'flac',
  'm4a',
  'opus',
  'aac',
  'aiff',
  'alac',
  'm4b',
  'wma',
] as const;

export const LIBRARY_VIDEO_EXTENSIONS = [
  'mp4',
  'webm',
  'm4v',
  'mov',
  'ogv',
  'avi',
  'flv',
  'mkv',
  'wmv',
  'mpg',
  'mpeg',
  'divx',
] as const;

/**
 * Recognised, and refused by Chromium's media stack.
 *
 * Electron ships Chromium's decoders and nothing else. A `<video>` or
 * `<audio>` pointed at one of these fires `error` and shows nothing, which
 * reads as a broken player. Listing them and saying so reads as an honest one.
 */
export const LIBRARY_UNPLAYABLE_EXTENSIONS = [
  'wma',
  'alac',
  'aiff',
  'avi',
  'flv',
  'mkv',
  'wmv',
  'mpg',
  'mpeg',
  'divx',
] as const;

const LYRIC_EXTENSIONS = ['lrc', 'elrc'] as const;

export const libraryFileExtension = (name: string): string => {
  const lastDot = name.lastIndexOf('.');
  return lastDot >= 0 ? name.slice(lastDot + 1).toLowerCase() : '';
};

export const libraryFileKind = (
  name: string,
): 'audio' | 'video' | undefined => {
  const extension = libraryFileExtension(name);
  if (LIBRARY_AUDIO_EXTENSIONS.some((entry) => entry === extension)) {
    return 'audio';
  }
  if (LIBRARY_VIDEO_EXTENSIONS.some((entry) => entry === extension)) {
    return 'video';
  }
  return undefined;
};

export const isLibraryPlayable = (name: string): boolean => {
  const extension = libraryFileExtension(name);
  return (
    libraryFileKind(name) !== undefined &&
    !LIBRARY_UNPLAYABLE_EXTENSIONS.some((entry) => entry === extension)
  );
};

export const libraryBaseName = (name: string): string => {
  const extension = libraryFileExtension(name);
  const withoutExtension = extension
    ? name.slice(0, -(extension.length + 1))
    : name;
  return withoutExtension.toLowerCase();
};

/** Strips the track number and separators a filename uses instead of tags. */
export const libraryTitleFromFileName = (name: string): string => {
  const extension = libraryFileExtension(name);
  const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
  return stem
    .replace(/^\s*\d{1,3}\s*[-._)]\s*/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const ULTRASTAR_ADAPTER = KARAOKE_TEXT_ADAPTERS.find(
  (adapter) => adapter.id === 'ultrastar',
);

/**
 * One definition, two readers: this must agree with what the Karaoke tab will
 * actually open, or a song is excluded from the library and rejected there too.
 */
export const isUltraStarText = (contents: string): boolean =>
  ULTRASTAR_ADAPTER?.canParse(contents) ?? false;

export const karaokeLyricCandidates = (
  fileName: string,
  siblings: readonly string[],
): { certain: string[]; needsContentCheck: string[] } => {
  const base = libraryBaseName(fileName);
  const certain: string[] = [];
  const needsContentCheck: string[] = [];
  siblings.forEach((sibling) => {
    if (libraryBaseName(sibling) !== base) {
      return;
    }
    const extension = libraryFileExtension(sibling);
    if (LYRIC_EXTENSIONS.some((entry) => entry === extension)) {
      certain.push(sibling);
    } else if (extension === 'txt') {
      needsContentCheck.push(sibling);
    }
  });
  return { certain, needsContentCheck };
};
```

- [ ] **Step 5: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryFiles.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/common/library src/__tests__/unit_tests/common/libraryFiles.test.ts
git commit -m "Tell library files apart, and leave karaoke songs to Karaoke"
```

---

### Task 3: Grouping tracks into albums and artists

**Files:**

- Create: `src/common/library/grouping.ts`
- Test: `src/__tests__/unit_tests/common/libraryGrouping.test.ts`

**Interfaces:**

- Consumes: `ILibraryTrack`, `TLibrarySort` from Task 2.
- Produces:
  - `ILibraryAlbum { id, title, artist, year?, artId?, trackIds, durationMs }`
  - `ILibraryArtist { id, name, albumCount, trackCount, artId? }`
  - `albumKey(track: ILibraryTrack): string`
  - `groupIntoAlbums(tracks: readonly ILibraryTrack[]): ILibraryAlbum[]`
  - `groupIntoArtists(tracks: readonly ILibraryTrack[]): ILibraryArtist[]`
  - `searchTracks(tracks: readonly ILibraryTrack[], query: string): ILibraryTrack[]`
  - `sortTracks(tracks: readonly ILibraryTrack[], sort: TLibrarySort): ILibraryTrack[]`
  - `normalizeForSearch(value: string): string`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/libraryGrouping.test.ts` with the GPL header, then:

```ts
import { ILibraryTrack } from '../../../common/library/types';
import {
  groupIntoAlbums,
  groupIntoArtists,
  normalizeForSearch,
  searchTracks,
  sortTracks,
} from '../../../common/library/grouping';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'root',
  path: `C:\\Music\\${over.title ?? 'id'}.mp3`,
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

describe('grouping a flat track list', () => {
  it('collects an album and keeps its tracks in disc and track order', () => {
    const albums = groupIntoAlbums([
      track({ title: 'B', album: 'Kind of Blue', artist: 'Miles', trackNo: 2 }),
      track({ title: 'A', album: 'Kind of Blue', artist: 'Miles', trackNo: 1 }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].title).toBe('Kind of Blue');
    expect(albums[0].trackIds).toEqual(['A', 'B']);
  });

  it('keeps two albums of the same name by different artists apart', () => {
    // "Greatest Hits" is the case that breaks a title-only key, and there is
    // one in almost every real library.
    const albums = groupIntoAlbums([
      track({ title: 'X', album: 'Greatest Hits', artist: 'Queen' }),
      track({ title: 'Y', album: 'Greatest Hits', artist: 'ABBA' }),
    ]);
    expect(albums).toHaveLength(2);
  });

  it('holds a compilation together under its album artist', () => {
    // Every track has a different artist; without albumArtist winning, this
    // shatters into one album per song.
    const albums = groupIntoAlbums([
      track({
        title: 'X',
        album: 'Now 42',
        artist: 'A',
        albumArtist: 'Various',
      }),
      track({
        title: 'Y',
        album: 'Now 42',
        artist: 'B',
        albumArtist: 'Various',
      }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].artist).toBe('Various');
  });

  it('files untagged tracks under one unknown album rather than many', () => {
    const albums = groupIntoAlbums([
      track({ title: 'X' }),
      track({ title: 'Y' }),
    ]);
    expect(albums).toHaveLength(1);
    expect(albums[0].trackIds).toEqual(['X', 'Y']);
  });

  it('counts an artist by albums and tracks', () => {
    const artists = groupIntoArtists([
      track({ title: 'X', album: 'One', artist: 'Miles' }),
      track({ title: 'Y', album: 'One', artist: 'Miles' }),
      track({ title: 'Z', album: 'Two', artist: 'Miles' }),
    ]);
    expect(artists).toHaveLength(1);
    expect(artists[0]).toMatchObject({
      name: 'Miles',
      albumCount: 2,
      trackCount: 3,
    });
  });
});

describe('searching', () => {
  it('ignores case and accents', () => {
    const tracks = [track({ title: 'Café del Mar', artist: 'Energy 52' })];
    expect(searchTracks(tracks, 'cafe')).toHaveLength(1);
    expect(searchTracks(tracks, 'CAFÉ')).toHaveLength(1);
  });

  it('matches on artist and album as well as title', () => {
    const tracks = [
      track({ title: 'X', artist: 'Miles', album: 'Kind of Blue' }),
    ];
    expect(searchTracks(tracks, 'miles')).toHaveLength(1);
    expect(searchTracks(tracks, 'blue')).toHaveLength(1);
  });

  it('returns everything for an empty query', () => {
    // The positive control for the two above: a filter that matched nothing
    // would pass a "finds no rubbish" test and empty the library.
    const tracks = [track({ title: 'X' }), track({ title: 'Y' })];
    expect(searchTracks(tracks, '')).toHaveLength(2);
    expect(searchTracks(tracks, '   ')).toHaveLength(2);
    expect(searchTracks(tracks, 'zzzz')).toHaveLength(0);
  });

  it('normalises for comparison without destroying the display string', () => {
    expect(normalizeForSearch('Björk')).toBe('bjork');
  });
});

describe('sorting', () => {
  it('sorts by title, then artist, then year', () => {
    const tracks = [
      track({ title: 'B', artist: 'Z', year: 1999 }),
      track({ title: 'A', artist: 'Y', year: 2001 }),
    ];
    expect(sortTracks(tracks, 'title').map((entry) => entry.title)).toEqual([
      'A',
      'B',
    ]);
    expect(sortTracks(tracks, 'artist').map((entry) => entry.title)).toEqual([
      'A',
      'B',
    ]);
    expect(sortTracks(tracks, 'year').map((entry) => entry.title)).toEqual([
      'B',
      'A',
    ]);
  });

  it('does not mutate its input', () => {
    const tracks = [track({ title: 'B' }), track({ title: 'A' })];
    sortTracks(tracks, 'title');
    expect(tracks.map((entry) => entry.title)).toEqual(['B', 'A']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryGrouping.test.ts
```

Expected: FAIL — `Cannot find module '../../../common/library/grouping'`.

- [ ] **Step 3: Write `src/common/library/grouping.ts`**

GPL header, then:

```ts
import { ILibraryTrack, TLibrarySort } from './types';

export interface ILibraryAlbum {
  id: string;
  title: string;
  artist: string;
  year?: number;
  artId?: string;
  /** In disc, then track, then title order. */
  trackIds: string[];
  durationMs: number;
}

export interface ILibraryArtist {
  id: string;
  name: string;
  albumCount: number;
  trackCount: number;
  artId?: string;
}

/** Accent-folded and lowercased, for comparison only — never for display. */
export const normalizeForSearch = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * The album an artist made, not the album with that name.
 *
 * `albumArtist` wins where it exists, which is what holds a compilation
 * together: every track on it has a different `artist`, and keying on that
 * shatters one album into fifteen.
 */
export const albumKey = (track: ILibraryTrack): string => {
  const artist = track.albumArtist ?? track.artist ?? '';
  return `${normalizeForSearch(album(track))}\u0000${normalizeForSearch(artist)}`;
};

const album = (track: ILibraryTrack): string => track.album ?? '';

const compareTracksInAlbum = (
  left: ILibraryTrack,
  right: ILibraryTrack,
): number =>
  (left.discNo ?? 1) - (right.discNo ?? 1) ||
  (left.trackNo ?? 0) - (right.trackNo ?? 0) ||
  left.title.localeCompare(right.title);

export const groupIntoAlbums = (
  tracks: readonly ILibraryTrack[],
): ILibraryAlbum[] => {
  const grouped = new Map<string, ILibraryTrack[]>();
  tracks.forEach((track) => {
    const key = albumKey(track);
    const existing = grouped.get(key);
    if (existing) {
      existing.push(track);
    } else {
      grouped.set(key, [track]);
    }
  });
  return Array.from(grouped.entries()).map(([id, members]) => {
    const ordered = [...members].sort(compareTracksInAlbum);
    const first = ordered[0];
    return {
      id,
      title: first.album ?? '',
      artist: first.albumArtist ?? first.artist ?? '',
      year: ordered.find((entry) => entry.year !== undefined)?.year,
      artId: ordered.find((entry) => entry.artId !== undefined)?.artId,
      trackIds: ordered.map((entry) => entry.id),
      durationMs: ordered.reduce(
        (total, entry) => total + (entry.durationMs ?? 0),
        0,
      ),
    };
  });
};

export const groupIntoArtists = (
  tracks: readonly ILibraryTrack[],
): ILibraryArtist[] => {
  const grouped = new Map<
    string,
    { name: string; albums: Set<string>; tracks: number; artId?: string }
  >();
  tracks.forEach((track) => {
    const name = track.albumArtist ?? track.artist ?? '';
    const id = normalizeForSearch(name);
    const existing = grouped.get(id);
    if (existing) {
      existing.albums.add(normalizeForSearch(album(track)));
      existing.tracks += 1;
      existing.artId = existing.artId ?? track.artId;
    } else {
      grouped.set(id, {
        name,
        albums: new Set([normalizeForSearch(album(track))]),
        tracks: 1,
        artId: track.artId,
      });
    }
  });
  return Array.from(grouped.entries()).map(([id, entry]) => ({
    id,
    name: entry.name,
    albumCount: entry.albums.size,
    trackCount: entry.tracks,
    artId: entry.artId,
  }));
};

export const searchTracks = (
  tracks: readonly ILibraryTrack[],
  query: string,
): ILibraryTrack[] => {
  const needle = normalizeForSearch(query);
  if (!needle) {
    return [...tracks];
  }
  return tracks.filter((track) =>
    normalizeForSearch(
      [track.title, track.artist, track.albumArtist, track.album]
        .filter((part): part is string => Boolean(part))
        .join(' '),
    ).includes(needle),
  );
};

export const sortTracks = (
  tracks: readonly ILibraryTrack[],
  sort: TLibrarySort,
): ILibraryTrack[] => {
  const compare = (left: ILibraryTrack, right: ILibraryTrack): number => {
    if (sort === 'artist') {
      return (
        (left.artist ?? '').localeCompare(right.artist ?? '') ||
        left.title.localeCompare(right.title)
      );
    }
    if (sort === 'album') {
      return (
        (left.album ?? '').localeCompare(right.album ?? '') ||
        compareTracksInAlbum(left, right)
      );
    }
    if (sort === 'year') {
      return (left.year ?? 0) - (right.year ?? 0);
    }
    if (sort === 'added') {
      return right.addedAt - left.addedAt;
    }
    return left.title.localeCompare(right.title);
  };
  return [...tracks].sort(compare);
};
```

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryGrouping.test.ts
```

Expected: PASS, 11 tests. If the artist sort fails, note that its tie-break is title — the test's fixture relies on it.

- [ ] **Step 5: Commit**

```bash
git add src/common/library/grouping.ts src/__tests__/unit_tests/common/libraryGrouping.test.ts
git commit -m "Turn a flat track list into albums and artists"
```

---

### Task 4: The generated cover tile

**Files:**

- Create: `src/common/library/artwork.ts`
- Test: `src/__tests__/unit_tests/common/libraryArtwork.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `libraryTileInitials(label: string): string`
  - `libraryTileHue(label: string): number`

- [ ] **Step 1: Write the failing test**

```ts
import {
  libraryTileHue,
  libraryTileInitials,
} from '../../../common/library/artwork';

describe('the tile drawn when a track has no cover', () => {
  it('takes initials from the first two words', () => {
    expect(libraryTileInitials('Kind of Blue')).toBe('KB');
    expect(libraryTileInitials('Nevermind')).toBe('NE');
  });

  it('always returns something, for any label at all', () => {
    // A grid of empty squares is what this exists to prevent, so an empty
    // answer is a bug rather than an edge case.
    expect(libraryTileInitials('')).toBe('?');
    expect(libraryTileInitials('   ')).toBe('?');
    expect(libraryTileInitials('日本語')).toHaveLength(1);
  });

  it('gives the same label the same hue every launch', () => {
    // The colour is derived, not stored. If it were random the library would
    // reshuffle its own colours on every start.
    expect(libraryTileHue('Kind of Blue')).toBe(libraryTileHue('Kind of Blue'));
    expect(libraryTileHue('Kind of Blue')).not.toBe(
      libraryTileHue('Nevermind'),
    );
  });

  it('stays inside the colour wheel', () => {
    ['', 'a', 'Kind of Blue', '日本語', 'x'.repeat(400)].forEach((label) => {
      const hue = libraryTileHue(label);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryArtwork.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/common/library/artwork.ts`**

```ts
/**
 * Initials for the tile drawn in place of a missing cover.
 *
 * Two characters where there are two words, two of one word, and a question
 * mark when there is nothing at all — a blank square in a grid reads as a
 * failed load rather than as an album with no art.
 */
export const libraryTileInitials = (label: string): string => {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].slice(0, 2).toLocaleUpperCase();
  }
  return `${words[0][0]}${words[1][0]}`.toLocaleUpperCase();
};

/**
 * A hue derived from the label, so it is the same on every launch.
 *
 * FNV-1a over the code points. Any stable hash would do; what matters is that
 * nothing here is random — a library that recolours itself between starts
 * looks broken in a way that is hard to describe and impossible to miss.
 */
export const libraryTileHue = (label: string): number => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 360;
};
```

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryArtwork.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/common/library/artwork.ts src/__tests__/unit_tests/common/libraryArtwork.test.ts
git commit -m "Draw a deliberate tile where an album has no cover"
```

---

### Task 5: The whole feature's dictionary, in all ten locales

Every string the Library needs, added once so no later task has to touch ten files. `i18n.test.ts` asserts 100% coverage per locale, so a partial dictionary fails the suite — all ten land here together.

**Files:**

- Create: `src/common/i18n/en/library.ts` and the same file under `zh/`, `hi/`, `es/`, `fr/`, `pt/`, `ru/`, `ja/`, `de/`, `it/`
- Modify: `src/common/i18n/en/index.ts` and each locale's `index.ts` (import and spread `library`)
- Test: `src/__tests__/unit_tests/common/i18n.test.ts` (already exists; it must keep passing)

**Interfaces:**

- Consumes: nothing.
- Produces: the keys below. Later tasks use these names exactly.

- [ ] **Step 1: Write `src/common/i18n/en/library.ts`**

GPL header copied from `src/common/i18n/en/video.ts`, then:

```ts
const library = {
  'tabs.library': 'Library',

  'library.empty.title': 'No music yet',
  'library.empty.body':
    'Add a folder and FluidEQ will read the songs and videos inside it.',
  'library.empty.add': 'Add folder',
  'library.empty.drop': 'or drop a folder here',
  'library.karaokeSkipped':
    '{count} karaoke songs skipped — open them on the Karaoke tab',

  'library.add': 'Add folder',
  'library.rescan': 'Rescan',
  'library.search': 'Search the library',
  'library.searchPlaceholder': 'Search songs, artists, albums',

  'library.browse.album': 'Albums',
  'library.browse.artist': 'Artists',
  'library.browse.song': 'Songs',
  'library.view.list': 'List',
  'library.view.grid': 'Grid',
  'library.view.coverflow': 'Cover Flow',
  'library.view.aria': 'How the library is shown',
  'library.browse.aria': 'What the library is showing',

  'library.sort': 'Sort',
  'library.sort.title': 'Title',
  'library.sort.artist': 'Artist',
  'library.sort.album': 'Album',
  'library.sort.year': 'Year',
  'library.sort.added': 'Recently added',

  'library.column.title': 'Title',
  'library.column.artist': 'Artist',
  'library.column.album': 'Album',
  'library.column.year': 'Year',
  'library.column.length': 'Length',

  'library.unknownAlbum': 'Unknown album',
  'library.unknownArtist': 'Unknown artist',
  'library.trackCount': '{count} songs',
  'library.albumCount': '{count} albums',

  'library.videos': 'Videos',
  'library.videos.empty': 'No videos in the folders you have added.',

  'library.scan.running': 'Reading {name}',
  'library.scan.counted': '{parsed} of {seen} files',
  'library.scan.cancel': 'Stop',
  'library.scan.background': 'Continue in the background',
  'library.scan.done': 'Added {count} songs',

  'library.roots': 'Folders',
  'library.root.remove': 'Remove this folder',
  'library.root.offline': 'This folder is not available right now',
  'library.reveal': 'Show in Explorer',

  'library.unplayable': 'FluidEQ cannot play this format',
  'library.indexReset':
    'The library index could not be read and has been rebuilt.',

  'library.play': 'Play',
  'library.pause': 'Pause',
  'library.previous': 'Previous',
  'library.next': 'Next',
  'library.shuffle': 'Shuffle',
  'library.repeat': 'Repeat',
  'library.repeat.all': 'Repeat everything',
  'library.repeat.one': 'Repeat this song',
  'library.repeat.off': 'Do not repeat',
  'library.volume': 'Volume',
  'library.position': 'Position',
  'library.queue': 'Queue',
  'library.queue.remove': 'Remove from the queue',
  'library.nowPlaying': 'Now playing',
  'library.fullScreen': 'Full screen',
};

export default library;
```

- [ ] **Step 2: Merge it into the English dictionary**

In `src/common/i18n/en/index.ts`, add `import library from './library';` beside the other feature imports and `...library,` into the `en` object.

- [ ] **Step 3: Translate all nine other locales**

Create `library.ts` in each of `zh/`, `hi/`, `es/`, `fr/`, `pt/`, `ru/`, `ja/`, `de/`, `it/` with the same key set and that language's strings, typed the way its neighbours are, and add the import and spread to each locale's `index.ts`. Keep the `{count}`, `{name}`, `{parsed}` and `{seen}` placeholders verbatim — they are substituted by name.

- [ ] **Step 4: Run the i18n suite**

```bash
pnpm exec jest src/__tests__/unit_tests/common/i18n.test.ts
```

Expected: PASS. A failure reading `Italiano: 0.97` means a key is missing from that locale — the number is the coverage fraction.

- [ ] **Step 5: Commit**

```bash
git add src/common/i18n
git commit -m "Give the library its words, in every language the app speaks"
```

---

### Task 6: The index file

**Files:**

- Create: `src/main/library/libraryIndex.ts`
- Test: `src/__tests__/unit_tests/main/libraryIndex.test.ts`

**Interfaces:**

- Consumes: `ILibraryIndex`, `ILibraryRoot`, `ILibraryTrack` from Task 2.
- Produces:
  - `emptyLibraryIndex(): ILibraryIndex`
  - `parseLibraryIndex(raw: unknown): ILibraryIndex | undefined`
  - `libraryIndexPath(userDataDir: string): string`
  - `loadLibraryIndex(userDataDir: string): { index: ILibraryIndex; wasReset: boolean }`
  - `saveLibraryIndex(userDataDir: string, index: ILibraryIndex): void`
  - `trackPathById(index: ILibraryIndex, id: string): string | undefined`

- [ ] **Step 1: Write the failing test**

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  emptyLibraryIndex,
  loadLibraryIndex,
  parseLibraryIndex,
  saveLibraryIndex,
  trackPathById,
} from '../../../main/library/libraryIndex';

const tempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-library-'));

describe('the library index on disk', () => {
  it('round-trips what it was given', () => {
    const dir = tempDir();
    const index = emptyLibraryIndex();
    index.roots.push({
      id: 'r1',
      path: 'C:\\Music',
      addedAt: 1,
      trackCount: 1,
      karaokeSkipped: 0,
    });
    index.tracks.push({
      id: 't1',
      rootId: 'r1',
      path: 'C:\\Music\\a.mp3',
      kind: 'audio',
      isPlayable: true,
      title: 'A',
      sizeBytes: 10,
      mtimeMs: 20,
      addedAt: 30,
    });
    saveLibraryIndex(dir, index);
    expect(loadLibraryIndex(dir)).toEqual({ index, wasReset: false });
  });

  it('starts empty when nothing has been saved', () => {
    // The positive control for the recovery test below: "empty" must mean
    // "nothing yet", not "something went wrong and I hid it".
    expect(loadLibraryIndex(tempDir())).toEqual({
      index: emptyLibraryIndex(),
      wasReset: false,
    });
  });

  it('rebuilds from scratch and says so when the file is corrupt', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'library-index.json'), '{ not json');
    const loaded = loadLibraryIndex(dir);
    expect(loaded.index).toEqual(emptyLibraryIndex());
    expect(loaded.wasReset).toBe(true);
    // Kept, not deleted — a corrupt index is still the only record of which
    // folders somebody added.
    expect(fs.existsSync(path.join(dir, 'library-index.json.bak'))).toBe(true);
  });

  it('refuses a payload that is the wrong shape', () => {
    expect(parseLibraryIndex(undefined)).toBeUndefined();
    expect(
      parseLibraryIndex({ version: 99, roots: [], tracks: [] }),
    ).toBeUndefined();
    expect(parseLibraryIndex({ version: 1, roots: [], tracks: [] })).toEqual({
      version: 1,
      roots: [],
      tracks: [],
    });
  });

  it('resolves a track id to its path and nothing else to anything', () => {
    const index = emptyLibraryIndex();
    index.tracks.push({
      id: 't1',
      rootId: 'r1',
      path: 'C:\\Music\\a.mp3',
      kind: 'audio',
      isPlayable: true,
      title: 'A',
      sizeBytes: 1,
      mtimeMs: 1,
      addedAt: 1,
    });
    expect(trackPathById(index, 't1')).toBe('C:\\Music\\a.mp3');
    expect(trackPathById(index, '../../etc/passwd')).toBeUndefined();
    expect(trackPathById(index, 'constructor')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryIndex.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/library/libraryIndex.ts`**

GPL header, then a module built around these rules:

- `libraryIndexPath` is `path.join(userDataDir, 'library-index.json')`.
- `parseLibraryIndex` narrows `unknown` with explicit checks — `version === 1`, both `roots` and `tracks` arrays — and returns `undefined` otherwise. No casts.
- `loadLibraryIndex` reads, parses, and on any failure renames the file to `.bak` (overwriting a previous `.bak`) and returns `{ index: emptyLibraryIndex(), wasReset: true }`. The rename is in a `try`/`catch` whose `catch` body writes a `console.error` naming the path — an empty `catch` is forbidden, and this is a failure worth seeing in a bug report.
- `saveLibraryIndex` writes to `library-index.json.tmp` and renames over the target, so a crash mid-write cannot leave a half-written index.
- `trackPathById` searches `index.tracks` by `id`. It must not use an object keyed by id — an inherited member would answer `'constructor'` with a function, which is exactly what the last test asserts against. `Array.prototype.find` has no prototype chain to fall through.

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryIndex.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/library/libraryIndex.ts src/__tests__/unit_tests/main/libraryIndex.test.ts
git commit -m "Keep the library index where a crash cannot half-write it"
```

---

### Task 7: Reading tags, and finding folder art

**Files:**

- Create: `src/main/library/libraryMetadata.ts`
- Test: `src/__tests__/unit_tests/main/libraryMetadata.test.ts`

**Interfaces:**

- Consumes: `music-metadata` at the version pinned in Task 1; `libraryTitleFromFileName` from Task 2.
- Produces:
  - `ILibraryFileFacts` — every optional tag field of `ILibraryTrack` plus `picture?: { data: Uint8Array; format: string }`
  - `readLibraryTags(filePath: string): Promise<ILibraryFileFacts>`
  - `FOLDER_ART_NAMES: readonly string[]`
  - `findFolderArt(entries: readonly string[]): string | undefined`

- [ ] **Step 1: Write the failing test**

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  findFolderArt,
  readLibraryTags,
} from '../../../main/library/libraryMetadata';

/** A real ID3v2.3 tag with three text frames, and no audio behind it. */
const taggedMp3 = (fields: Record<string, string>): Buffer => {
  const frames = Object.entries(fields).map(([id, value]) => {
    const body = Buffer.concat([
      Buffer.from([0]),
      Buffer.from(value, 'latin1'),
    ]);
    const size = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    return Buffer.concat([Buffer.from(id), size, Buffer.from([0, 0]), body]);
  });
  const payload = Buffer.concat(frames);
  // ID3v2 sizes are syncsafe: seven bits per byte. Small payloads fit the
  // last byte, which is why this test keeps its strings short.
  const header = Buffer.from([
    0x49,
    0x44,
    0x33,
    3,
    0,
    0,
    0,
    0,
    0,
    payload.length,
  ]);
  return Buffer.concat([header, payload]);
};

describe('reading tags off a file', () => {
  it('returns the title, artist and album it was given', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'song.mp3');
    fs.writeFileSync(
      file,
      taggedMp3({ TIT2: 'Blue', TPE1: 'Miles', TALB: 'Kind' }),
    );
    await expect(readLibraryTags(file)).resolves.toMatchObject({
      title: 'Blue',
      artist: 'Miles',
      album: 'Kind',
    });
  });

  it('answers with an empty set of facts rather than throwing', async () => {
    // One unreadable file must not end a scan of four thousand.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-tags-'));
    const file = path.join(dir, 'broken.mp3');
    fs.writeFileSync(file, Buffer.from('not audio at all'));
    await expect(readLibraryTags(file)).resolves.toEqual({});
  });
});

describe('finding a cover beside the music', () => {
  it('prefers the conventional names, in order', () => {
    expect(findFolderArt(['back.jpg', 'folder.jpg', 'cover.jpg'])).toBe(
      'cover.jpg',
    );
    expect(findFolderArt(['scan.png', 'front.png'])).toBe('front.png');
  });

  it('ignores case, as Windows does', () => {
    expect(findFolderArt(['Cover.JPG'])).toBe('Cover.JPG');
  });

  it('finds nothing in a folder that has nothing', () => {
    // Positive control: the two tests above pass equally well for a function
    // that returns the first entry it sees.
    expect(findFolderArt(['song.mp3', 'notes.txt'])).toBeUndefined();
    expect(findFolderArt([])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryMetadata.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/library/libraryMetadata.ts`**

GPL header, then:

- `FOLDER_ART_NAMES = ['cover', 'folder', 'front', 'album', 'artwork']` and `FOLDER_ART_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']`.
- `findFolderArt(entries)` walks `FOLDER_ART_NAMES` in order and returns the first entry whose lowercased stem matches and whose extension is in the list. Order of the _names_ decides, not order of the directory listing — a directory listing's order is the filesystem's business and differs between machines.
- `readLibraryTags(filePath)` reads the file with `fs.promises.readFile`, calls `parseBuffer` from `music-metadata`, and maps `common` and `format` onto `ILibraryFileFacts`: `title`, `artist`, `albumArtist`, `album`, `trackNo` (`common.track.no`), `discNo` (`common.disk.no`), `year`, `genre` (first entry), `durationMs` (`format.duration * 1000`, rounded), `bitrate`, `sampleRate`, `channels` (`format.numberOfChannels`), `codec`, and `picture` from `common.picture?.[0]`.
- The whole body sits in a `try`/`catch` returning `{}`; the `catch` writes a `console.error` naming the path first, because a file that will not parse is the single most useful line in a bug report about a missing album.

Do not stream the read. `fetch` plus `pipeline` crashes in Node's HTTP parser when the disk is slower than the source, and nothing here is big enough for streaming to pay for itself.

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryMetadata.test.ts
```

Expected: PASS, 5 tests. If the first test reports `title: undefined`, the syncsafe size byte in the fixture is wrong — keep the field values under 128 bytes.

- [ ] **Step 5: Commit**

```bash
git add src/main/library/libraryMetadata.ts src/__tests__/unit_tests/main/libraryMetadata.test.ts
git commit -m "Read what a music file says about itself"
```

---

### Task 8: The artwork cache

**Files:**

- Create: `src/main/library/libraryArtwork.ts`
- Test: `src/__tests__/unit_tests/main/libraryArtwork.test.ts`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces:
  - `ARTWORK_EDGE_PIXELS: number`
  - `artworkCacheDir(userDataDir: string): string`
  - `artworkId(bytes: Uint8Array): string`
  - `artworkPath(userDataDir: string, id: string): string | undefined`
  - `storeArtwork(userDataDir: string, bytes: Uint8Array): Promise<string | undefined>`

- [ ] **Step 1: Write the failing test**

`storeArtwork` calls Electron's `nativeImage`, which does not exist under jsdom, so the test mocks it — the same shape `safeExternal.test.ts` uses.

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';

const resize = jest.fn(() => ({ toJPEG: () => Buffer.from('jpeg-bytes') }));
jest.mock('electron', () => ({
  nativeImage: { createFromBuffer: () => ({ isEmpty: () => false, resize }) },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import {
  artworkId,
  artworkPath,
  storeArtwork,
} from '../../../main/library/libraryArtwork';

const tempDir = (): string =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-art-'));

describe('caching a cover', () => {
  it('gives identical images the same id', () => {
    // Two hundred tracks from one album carry the same picture. Hashing the
    // bytes is what makes that one file on disk instead of two hundred.
    expect(artworkId(new Uint8Array([1, 2, 3]))).toBe(
      artworkId(new Uint8Array([1, 2, 3])),
    );
    expect(artworkId(new Uint8Array([1, 2, 3]))).not.toBe(
      artworkId(new Uint8Array([3, 2, 1])),
    );
  });

  it('writes the resized image once and returns its id', async () => {
    const dir = tempDir();
    const id = await storeArtwork(dir, new Uint8Array([1, 2, 3]));
    expect(id).toBeDefined();
    expect(
      fs.readFileSync(path.join(dir, 'library-art', `${id}.jpg`), 'utf8'),
    ).toBe('jpeg-bytes');
  });

  it('does not resize an image it has already cached', async () => {
    const dir = tempDir();
    await storeArtwork(dir, new Uint8Array([9]));
    resize.mockClear();
    await storeArtwork(dir, new Uint8Array([9]));
    expect(resize).not.toHaveBeenCalled();
  });

  it('refuses an id that is not one it wrote', () => {
    // The path the media protocol will hand it comes from a URL. It resolves
    // ids, and an id is hex — never a traversal.
    const dir = tempDir();
    expect(artworkPath(dir, '../../secrets')).toBeUndefined();
    expect(artworkPath(dir, 'a1b2c3')).toBe(
      path.join(dir, 'library-art', 'a1b2c3.jpg'),
    );
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryArtwork.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/library/libraryArtwork.ts`**

- `ARTWORK_EDGE_PIXELS = 320`. Stated as a constant with a comment: a grid tile is at most 160 CSS pixels, so 320 covers a 2× display and nothing more. Full-resolution covers in a grid of 500 are what makes a library scroll badly.
- `artworkId` is `crypto.createHash('sha1').update(bytes).digest('hex')`.
- `artworkPath` returns `undefined` unless the id matches `/^[0-9a-f]{6,64}$/`. That single test is what makes the protocol handler safe; it is not defence in depth, it is the defence.
- `storeArtwork` computes the id, returns it immediately if the file already exists, otherwise `nativeImage.createFromBuffer`, `.resize({ height: ARTWORK_EDGE_PIXELS })`, `.toJPEG(82)` and writes it. Returns `undefined` when the image is empty or the write fails, so the caller falls through to the generated tile — with a `console.error` naming the id, never an empty `catch`.

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryArtwork.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/library/libraryArtwork.ts src/__tests__/unit_tests/main/libraryArtwork.test.ts
git commit -m "Cache one thumbnail per cover, not one per track"
```

---

### Task 9: The scanner

**Files:**

- Create: `src/main/library/libraryScanner.ts`
- Test: `src/__tests__/unit_tests/main/libraryScanner.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 2, 7 and 8.
- Produces:
  - `shouldReparse(existing: ILibraryTrack | undefined, stat: { size: number; mtimeMs: number }): boolean`
  - `trackIdForPath(filePath: string): string`
  - `scanLibraryRoot(options: IScanOptions): Promise<IScanResult>` where
    `IScanOptions = { rootId, rootPath, userDataDir, known: readonly ILibraryTrack[], onProgress: (progress: ILibraryScanProgress) => void, isCancelled: () => boolean }`
    and `IScanResult = { tracks: ILibraryTrack[]; karaokeSkipped: number; wasCancelled: boolean }`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryScanner.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/library/libraryScanner.ts`**

Structure it as a directory-at-a-time walk, because the karaoke pairing needs the sibling list anyway:

1. Read the directory with `fs.promises.readdir(dir, { withFileTypes: true })`.
2. Split into subdirectories and file names. Skip any directory beginning with `.` and skip `node_modules`.
3. For each file with a `libraryFileKind`, call `karaokeLyricCandidates(name, fileNames)`. If `certain` is non-empty, count a skip. If `needsContentCheck` is non-empty, read the first candidate with `fs.promises.readFile(..., 'utf8')` and call `isUltraStarText`; skip only if it says yes.
4. For a surviving file, `stat` it and call `shouldReparse` against `known`. If false, carry the known track forward unchanged and count it as parsed — this is what makes a rescan of an unchanged folder cost one `stat` per file.
5. Otherwise `readLibraryTags`, then `storeArtwork` for an embedded picture, else `findFolderArt` on the same directory listing and `storeArtwork` on its bytes. Title falls back to `libraryTitleFromFileName`.
6. Call `onProgress` after each file, and check `isCancelled()` before each — returning `{ tracks, karaokeSkipped, wasCancelled: true }` with everything gathered so far.
7. `trackIdForPath` is a sha1 of the lowercased absolute path, truncated to 16 hex characters.

Read one directory's `.txt` file at most once per song; a folder of 300 UltraStar charts must not read the same file 300 times.

Keep this under 500 lines. If it grows past that, the walk and the per-file parse are the seam.

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryScanner.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/main/library/libraryScanner.ts src/__tests__/unit_tests/main/libraryScanner.test.ts
git commit -m "Walk a music folder, and say what it skipped"
```

---

### Task 10: The media scheme, and the policy that lets it through

**Files:**

- Create: `src/main/library/libraryProtocol.ts`
- Modify: `src/main/contentSecurityPolicy.ts`
- Test: `src/__tests__/unit_tests/main/libraryProtocol.test.ts`
- Test: `src/__tests__/unit_tests/main/contentSecurityPolicy.test.ts` (add cases)

**Interfaces:**

- Consumes: `trackPathById` (Task 6), `artworkPath` (Task 8).
- Produces:
  - `LIBRARY_MEDIA_SCHEME = 'fluideq-media'`
  - `libraryMediaUrl(kind: 'track' | 'art', id: string): string`
  - `parseLibraryMediaUrl(url: string): { kind: 'track' | 'art'; id: string } | undefined`
  - `registerLibraryMediaScheme(): void`
  - `handleLibraryMedia(deps: { userDataDir: string; getIndex: () => ILibraryIndex }): void`

- [ ] **Step 1: Write the failing tests**

`src/__tests__/unit_tests/main/libraryProtocol.test.ts`:

```ts
import {
  libraryMediaUrl,
  parseLibraryMediaUrl,
} from '../../../main/library/libraryProtocol';

describe('the media URL the renderer is handed', () => {
  it('round-trips a track and a cover', () => {
    expect(parseLibraryMediaUrl(libraryMediaUrl('track', 'abc123'))).toEqual({
      kind: 'track',
      id: 'abc123',
    });
    expect(parseLibraryMediaUrl(libraryMediaUrl('art', 'def456'))).toEqual({
      kind: 'art',
      id: 'def456',
    });
  });

  it('refuses anything that is not one of those two shapes', () => {
    // Everything this scheme will ever serve is addressed by an id. A URL
    // carrying a path is not a request it can answer.
    expect(
      parseLibraryMediaUrl('fluideq-media://track/../../secret'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://other/abc')).toBeUndefined();
    expect(
      parseLibraryMediaUrl('file:///C:/Windows/notepad.exe'),
    ).toBeUndefined();
    expect(parseLibraryMediaUrl('fluideq-media://track/')).toBeUndefined();
    expect(parseLibraryMediaUrl('')).toBeUndefined();
  });
});
```

Add to `src/__tests__/unit_tests/main/contentSecurityPolicy.test.ts`, inside the existing `describe`:

```ts
it('lets the library serve its own media and covers', () => {
  // Without this on img-src every cover in the library is silently blank
  // while the rest of the app looks perfectly fine — the exact failure a
  // policy change is most likely to cause and least likely to be blamed for.
  expect(directives(false)['img-src']).toContain('fluideq-media:');
  expect(directives(false)['media-src']).toContain('fluideq-media:');
  expect(directives(true)['img-src']).toContain('fluideq-media:');
});
```

- [ ] **Step 2: Run both and watch them fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryProtocol.test.ts src/__tests__/unit_tests/main/contentSecurityPolicy.test.ts
```

Expected: the first FAILs on the missing module, the second FAILs on the two `toContain` assertions.

- [ ] **Step 3: Widen the policy**

In `src/main/contentSecurityPolicy.ts`, add `fluideq-media:` to `img-src` and `media-src`, and extend the file's existing "what it allows, and why" comment block with a line saying that the library serves local audio, video and cached covers over its own scheme, resolved by id against the index — never by path.

- [ ] **Step 4: Write `src/main/library/libraryProtocol.ts`**

```ts
export const LIBRARY_MEDIA_SCHEME = 'fluideq-media';

export const libraryMediaUrl = (kind: 'track' | 'art', id: string): string =>
  `${LIBRARY_MEDIA_SCHEME}://${kind}/${id}`;

/**
 * Ids only, and never a path.
 *
 * The host carries the kind and the single path segment carries the id, which
 * has to survive a strict character test. A URL is the one input to this
 * process that arrives from a document, so it gets the narrowest possible
 * grammar rather than a sanitiser.
 */
export const parseLibraryMediaUrl = (
  url: string,
): { kind: 'track' | 'art'; id: string } | undefined => {
  const match = /^fluideq-media:\/\/(track|art)\/([0-9a-f]{6,64})$/.exec(url);
  if (!match) {
    return undefined;
  }
  return { kind: match[1] === 'art' ? 'art' : 'track', id: match[2] };
};
```

Then, below those:

- `registerLibraryMediaScheme()` calls `protocol.registerSchemesAsPrivileged([{ scheme: LIBRARY_MEDIA_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: false } }])`. `stream: true` is what makes Range requests work; without it seeking a large video re-downloads from the start every time.
- `handleLibraryMedia(deps)` calls `protocol.handle(LIBRARY_MEDIA_SCHEME, ...)`. It parses the URL, resolves `track` ids through `trackPathById(deps.getIndex(), id)` and `art` ids through `artworkPath(deps.userDataDir, id)`, and answers with `net.fetch(pathToFileURL(resolved).toString())`. Anything unresolved answers `new Response(undefined, { status: 404 })` — nothing is guessed from a request.

- [ ] **Step 5: Run both tests**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryProtocol.test.ts src/__tests__/unit_tests/main/contentSecurityPolicy.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/main/library/libraryProtocol.ts src/main/contentSecurityPolicy.ts src/__tests__/unit_tests/main
git commit -m "Serve library files by id, and let the policy through"
```

---

### Task 11: Wiring the main process together

**Files:**

- Create: `src/main/ipc/library.ts`
- Modify: `src/main/main.ts` (registration beside `registerKaraokeIpc`, and `registerLibraryMediaScheme` before `app.whenReady`)
- Modify: `src/main/api.ts`
- Modify: `src/renderer/preload.d.ts`
- Test: `src/__tests__/unit_tests/main/libraryIpc.test.ts`

**Interfaces:**

- Consumes: Tasks 6, 8, 9, 10.
- Produces, on `window.electron.ipcRenderer`:
  - `getLibraryIndex(): Promise<{ index: ILibraryIndex; wasReset: boolean }>` — `wasReset` is `loadLibraryIndex`'s answer, carried through so the renderer can say the library was rebuilt
  - `addLibraryRoot(): Promise<ILibraryIndex>`
  - `addLibraryRootPaths(paths: string[]): Promise<ILibraryIndex>`
  - `removeLibraryRoot(rootId: string): Promise<ILibraryIndex>`
  - `rescanLibrary(): Promise<void>`
  - `cancelLibraryScan(): void`
  - `onLibraryScanProgress(fn: (progress: ILibraryScanProgress) => void): () => void`
  - `onLibraryIndexChanged(fn: (index: ILibraryIndex) => void): () => void`
  - `revealLibraryTrack(trackId: string): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
const handlers = new Map<string, (...args: unknown[]) => unknown>();
const showOpenDialog = jest.fn(() =>
  Promise.resolve({ canceled: false, filePaths: ['C:\\Music'] }),
);
jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
    on: (channel: string, fn: (...args: unknown[]) => unknown) =>
      handlers.set(channel, fn),
  },
  dialog: { showOpenDialog: (...args: unknown[]) => showOpenDialog(...args) },
  shell: { showItemInFolder: jest.fn() },
}));

// eslint-disable-next-line import/first -- the mock must be installed first
import { registerLibraryIpc } from '../../../main/ipc/library';

describe('the library channels', () => {
  it('registers every channel the renderer will call', () => {
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    [
      'library-index-get',
      'library-root-add',
      'library-root-add-paths',
      'library-root-remove',
      'library-scan-start',
      'library-scan-cancel',
      'library-reveal',
    ].forEach((channel) => expect(handlers.has(channel)).toBe(true));
  });

  it('refuses a dropped path that is not a directory', async () => {
    // The one channel that takes a path inwards. It may add a root and
    // nothing else, so a file — or a path that does not exist — is refused
    // rather than added and scanned.
    registerLibraryIpc({ userDataDir: 'C:\\Data', getMainWindow: () => null });
    const handler = handlers.get('library-root-add-paths');
    const index = await handler?.({}, ['C:\\Windows\\notepad.exe']);
    expect(index).toMatchObject({ roots: [] });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryIpc.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/main/ipc/library.ts`**

Follow `registerKaraokeIpc` exactly: a documented `ILibraryIpcDeps` naming only `userDataDir` and `getMainWindow`, and `getMainWindow` as a function because the window is replaced over the life of the process.

- The module holds the loaded index and a `AbortController`-style cancel flag for the running scan. One scan at a time; a second `library-scan-start` while one runs is ignored rather than queued.
- `library-root-add` opens `dialog.showOpenDialog` with `properties: ['openDirectory', 'multiSelections']`, adds each result as a root and scans it.
- `library-root-add-paths` validates each path with `fs.statSync(...).isDirectory()` inside a `try`/`catch` before accepting it, and ignores the rest.
- `library-root-remove` drops the root and every track with that `rootId`, then saves.
- Progress is sent to the window with `getMainWindow()?.webContents.send('library-scan-progress', progress)`; a completed scan sends `library-index-changed` with the new snapshot.
- A root whose path no longer exists at rescan is marked `isOffline: true` and **its tracks are kept**. Deleting them would mean a library that empties itself when a USB drive is out.
- `library-reveal` resolves the id through `trackPathById` and calls `shell.showItemInFolder`. An unknown id does nothing.
- `registerLibraryIpc` also starts one incremental rescan of every root by itself, **after** the window has been shown rather than at registration. The launch path is already crowded; a scan competing with the first paint is a slow start nobody can attribute. Guard it so it runs once per process.

- [ ] **Step 4: Expose it in the preload bridge**

In `src/main/api.ts`, add the functions listed under Interfaces beside the karaoke ones, following the same style — `ipcRenderer.invoke(...) as Promise<T>` for the request channels, and the wrapped-listener-plus-unsubscribe shape already used by `karaoke-pitch-progress` for the two event channels. Add the matching declarations to `src/renderer/preload.d.ts`.

- [ ] **Step 5: Register it in `main.ts`**

Call `registerLibraryMediaScheme()` at module scope, before `app.whenReady()` — a privileged scheme registered after ready has no effect and fails silently. Call `registerLibraryIpc({ userDataDir, getMainWindow: () => mainWindow })` beside `registerKaraokeIpc`, and `handleLibraryMedia(...)` inside the `whenReady` block next to `setUpVideoBrowser()`.

- [ ] **Step 6: Run the test and the type checker**

```bash
pnpm exec jest src/__tests__/unit_tests/main/libraryIpc.test.ts
pnpm typecheck
```

Expected: PASS and no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/main src/renderer/preload.d.ts src/__tests__/unit_tests/main/libraryIpc.test.ts
git commit -m "Give the renderer a way to ask for the library"
```

---

### Task 12: The tab, its provider, and the empty state

The first task with something visible. It ends with a Library tab that says it is empty and offers to fix that.

**Files:**

- Create: `src/renderer/library/LibraryContext.tsx`
- Create: `src/renderer/library/LibraryWorkspace.tsx`
- Create: `src/renderer/library/LibraryEmptyState.tsx`
- Create: `src/renderer/styles/Library.scss`
- Modify: `src/renderer/App.tsx` (`TWorkspaceTab`, `WORKSPACE_TABS`, the tab button, the panel, the graph default)
- Test: `src/__tests__/unit_tests/LibraryWorkspace.test.tsx`

**Interfaces:**

- Consumes: the preload API from Task 11, the dictionary from Task 5.
- Produces:
  - `LibraryProvider` and `useLibrary(): { index, isScanning, progress, addFolder, addFolderPaths, rescan, cancelScan, removeRoot }`
  - `LibraryWorkspace` taking `{ isHidden: boolean }`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryWorkspace from '../../renderer/library/LibraryWorkspace';
import { LibraryProvider } from '../../renderer/library/LibraryContext';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const addLibraryRoot = jest.fn(() =>
  Promise.resolve({ version: 1, roots: [], tracks: [] }),
);

beforeEach(() => {
  addLibraryRoot.mockClear();
  window.electron = {
    ipcRenderer: {
      getLibraryIndex: () =>
        Promise.resolve({
          index: { version: 1, roots: [], tracks: [] },
          wasReset: false,
        }),
      addLibraryRoot,
      onLibraryScanProgress: () => () => undefined,
      onLibraryIndexChanged: () => () => undefined,
    },
  } as unknown as typeof window.electron;
});

const renderWorkspace = () =>
  render(
    <I18nProvider>
      <LibraryProvider>
        <LibraryWorkspace isHidden={false} />
      </LibraryProvider>
    </I18nProvider>,
  );

describe('the library with nothing in it', () => {
  it('offers the one action that fixes an empty library', async () => {
    renderWorkspace();
    expect(await screen.findByText('No music yet')).toBeInTheDocument();
    const add = screen.getAllByRole('button', { name: 'Add folder' })[0];
    await userEvent.click(add);
    expect(addLibraryRoot).toHaveBeenCalled();
  });

  it('gives the suggested action the loud style and nothing else', async () => {
    // Emphasis follows recommendation. An empty library has exactly one
    // useful next step and it must be the one that looks clickable.
    renderWorkspace();
    const add = (
      await screen.findAllByRole('button', { name: 'Add folder' })
    )[0];
    expect(add.className).toContain('button');
    expect(add.className).not.toContain('subtle');
  });
});
```

Check the exact provider names against `src/__tests__/unit_tests/KaraokeWorkspace.test.tsx` before writing this — reuse whatever wrapper that file uses rather than inventing one.

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryWorkspace.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `LibraryContext.tsx`**

A provider holding `index`, `isScanning` and `progress`; it fetches the index once on mount, subscribes to both event channels and unsubscribes on unmount. Two contexts, as `LiveAudioContext.tsx` does, if progress turns out to re-render the tree at frame rate — start with one and split only if a measurement says to.

- [ ] **Step 4: Write `LibraryEmptyState.tsx` and `LibraryWorkspace.tsx`**

The empty state is a centred card: the title, the body line, an **Add folder** button with `className="button small"`, the "or drop a folder here" hint, and — when `index.roots` reports skips — the karaoke line. The workspace renders the empty state when there are no tracks and nothing else yet.

`LibraryWorkspace` takes `isHidden` and applies the same hidden-not-unmounted treatment `KaraokeWorkspace` uses; read that component's props for the exact class.

Two more things belong on the workspace, both of them promised elsewhere and homeless otherwise:

- **The folder drop.** `onDragOver`/`onDrop` on the workspace root, resolving each dropped entry with `window.electron.ipcRenderer.getPathForFile(file)` — the bridge already in `api.ts:140`, used the same way `KaraokeWorkspace.tsx:702` uses it — and passing the paths to `addFolderPaths`. Main decides what is a directory; the renderer does not test the filesystem. Give the root a drag-over class so the drop target is visible, since the empty state advertises it.
- **The index-reset notice.** `loadLibraryIndex` reports `wasReset`, and Task 5 has `library.indexReset` for it. Surface it once, as a dismissible line above the toolbar. A library that silently empties itself after a bad shutdown is the worst version of this failure.

Carry `wasReset` through the `library-index-get` reply so the renderer can see it — extend that channel's payload to `{ index, wasReset }` and update the Task 11 interface note in this file if you change the name.

- [ ] **Step 5: Add the tab in `App.tsx`**

- `TWorkspaceTab` gains `'library'`.
- `WORKSPACE_TABS` gains `'library'` between `'video'` and `'karaoke'`.
- A tab button copying the Media one exactly, labelled `t('tabs.library')`.
- The panel is rendered outside the tab switch, like `VideoBrowser`, guarded by a `hasOpenedLibrary` flag so it mounts on first visit and is hidden thereafter.
- The graph defaults to hidden on this tab: extend the existing `activeWorkspaceTab === 'karaoke' ? false : isGraphViewOn` expression to cover `'library'` too. Read the comment above it first — it explains why the default is per-tab.

- [ ] **Step 6: Write `src/renderer/styles/Library.scss`**

Import the shared partials the way `Karaoke.scss` does. Layout only for now: the workspace fills its panel, the empty state centres. Use the existing spacing and colour variables — no new literals.

- [ ] **Step 7: Run the test, the type checker and the style checker**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryWorkspace.test.tsx
pnpm typecheck
pnpm typecheck:styles
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/LibraryWorkspace.test.tsx
git commit -m "Put a Library tab in the strip, and say what it needs"
```

---

### Task 13: The toolbar, and the scan running in front of you

**Files:**

- Create: `src/renderer/library/LibraryToolbar.tsx`
- Create: `src/renderer/library/LibraryScanProgress.tsx`
- Modify: `src/renderer/library/LibraryWorkspace.tsx`
- Modify: `src/renderer/styles/Library.scss`
- Test: `src/__tests__/unit_tests/LibraryToolbar.test.tsx`

**Interfaces:**

- Consumes: `useLibrary` (Task 12), `TLibraryBrowseMode`, `TLibraryViewMode`, `TLibrarySort` (Task 2).
- Produces: `LibraryToolbar` with props `{ browseMode, viewMode, sort, query, onBrowseMode, onViewMode, onSort, onQuery }`, and `LibraryScanProgress` with `{ progress, onCancel }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryScanProgress from '../../renderer/library/LibraryScanProgress';
import LibraryToolbar from '../../renderer/library/LibraryToolbar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const wrap = (node: React.ReactNode) =>
  render(<I18nProvider>{node}</I18nProvider>);

describe('the library toolbar', () => {
  it('reports which browse mode is current', async () => {
    const onBrowseMode = jest.fn();
    wrap(
      <LibraryToolbar
        browseMode="album"
        viewMode="grid"
        sort="title"
        query=""
        onBrowseMode={onBrowseMode}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onQuery={jest.fn()}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Albums' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Artists' }));
    expect(onBrowseMode).toHaveBeenCalledWith('artist');
  });

  it('passes what was typed straight through', async () => {
    const onQuery = jest.fn();
    wrap(
      <LibraryToolbar
        browseMode="song"
        viewMode="list"
        sort="title"
        query=""
        onBrowseMode={jest.fn()}
        onViewMode={jest.fn()}
        onSort={jest.fn()}
        onQuery={onQuery}
      />,
    );
    await userEvent.type(screen.getByRole('searchbox'), 'blue');
    expect(onQuery).toHaveBeenCalled();
  });
});

describe('a scan in progress', () => {
  it('shows what it is doing and offers to stop from the first second', async () => {
    // A long action that shows nothing is a bug regardless of what runs
    // underneath it.
    const onCancel = jest.fn();
    wrap(
      <LibraryScanProgress
        progress={{
          rootId: 'r',
          seen: 3,
          parsed: 1,
          karaokeSkipped: 0,
          current: 'a.mp3',
          isDone: false,
        }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Reading a.mp3')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 files')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryToolbar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write both components**

`LibraryToolbar`: a `role="tablist"` of three browse buttons on the left (`aria-selected` on the current one, classes copied from `workspace-tab` in `App.tsx`), then a view-mode segmented control of three, a `Dropdown` for sort, an `<input type="search">`, and **Add folder** / **Rescan** on the right. Add folder is `button small`, Rescan is `button small subtle` — adding music is the recommendation, rescanning is the fallback.

`LibraryScanProgress`: a strip pinned under the toolbar with the current file, the count, a determinate bar when `seen > 0`, and a **Stop** button. It stays out of the way rather than covering the library — the scan is backgroundable by simply leaving the tab, which is why it does not use a modal.

The **Folders** control also lives here, and is the only place the roots are manageable: an `AnchoredMenu` behind a `button small subtle` labelled `t('library.roots')`, listing each root's path with a remove control (`t('library.root.remove')`) and, for a root whose `isOffline` is set, the `t('library.root.offline')` line in the muted style. Read `AnchoredMenu`'s props and its portalling behaviour before wiring it — `MainContent.tsx` shows the pattern, including why the menu is asked about separately on an outside click.

- [ ] **Step 4: Hold the modes in `LibraryWorkspace`**

`browseMode`, `viewMode`, `sort` and `query` are state there, and the first three persist to `localStorage` under `fluideq.library.browseMode`, `fluideq.library.viewMode` and `fluideq.library.sort`. Follow the read/write pattern `App.tsx` uses for `WORKSPACE_TAB_KEY`, including its refusal to trust what it reads back.

- [ ] **Step 5: Run the tests**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryToolbar.test.tsx
pnpm typecheck && pnpm typecheck:styles
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/LibraryToolbar.test.tsx
git commit -m "Steer the library, and watch the scan while it runs"
```

---

### Task 14: The list view

**Files:**

- Create: `src/renderer/library/LibraryListView.tsx`
- Create: `src/renderer/library/LibraryCoverArt.tsx`
- Modify: `src/renderer/library/LibraryWorkspace.tsx`
- Modify: `src/renderer/styles/Library.scss`
- Test: `src/__tests__/unit_tests/LibraryListView.test.tsx`

**Interfaces:**

- Consumes: `groupIntoAlbums`, `groupIntoArtists`, `searchTracks`, `sortTracks` (Task 3); `libraryTileInitials`, `libraryTileHue` (Task 4); `libraryMediaUrl` (Task 10).
- Produces:
  - `LibraryCoverArt` with `{ artId?: string; label: string; size: 'row' | 'tile' | 'cover' }`
  - `LibraryListView` with `{ tracks, browseMode, onOpenAlbum, onOpenArtist, onPlayTrack }`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import LibraryListView from '../../renderer/library/LibraryListView';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

const wrap = (node: React.ReactNode) =>
  render(<I18nProvider>{node}</I18nProvider>);

describe('the library as a list', () => {
  it('shows a row per song with what the row is for', () => {
    wrap(
      <LibraryListView
        tracks={[
          track({
            title: 'Blue',
            artist: 'Miles',
            album: 'Kind',
            durationMs: 92000,
          }),
        ]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles')).toBeInTheDocument();
    expect(screen.getByText('1:32')).toBeInTheDocument();
  });

  it('starts the song on a double click', async () => {
    const onPlayTrack = jest.fn();
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Blue' })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={onPlayTrack}
      />,
    );
    await userEvent.dblClick(screen.getByText('Blue'));
    expect(onPlayTrack).toHaveBeenCalledWith('Blue');
  });

  it('marks a format it cannot play instead of pretending it can', async () => {
    wrap(
      <LibraryListView
        tracks={[track({ title: 'Old', isPlayable: false })]}
        browseMode="song"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(
      screen.getByTitle('FluidEQ cannot play this format'),
    ).toBeInTheDocument();
  });

  it('lists albums when that is what is being browsed', () => {
    wrap(
      <LibraryListView
        tracks={[
          track({ title: 'A', album: 'Kind', artist: 'Miles' }),
          track({ title: 'B', album: 'Kind', artist: 'Miles' }),
        ]}
        browseMode="album"
        onOpenAlbum={jest.fn()}
        onOpenArtist={jest.fn()}
        onPlayTrack={jest.fn()}
      />,
    );
    expect(screen.getByText('Kind')).toBeInTheDocument();
    expect(screen.getByText('2 songs')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryListView.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `LibraryCoverArt.tsx`**

One component, three sizes. With an `artId` it renders `<img src={libraryMediaUrl('art', artId)} alt="" loading="lazy" />`; without one it renders a `<span>` carrying `libraryTileInitials(label)` over an inline `background` built from `libraryTileHue(label)` — an inline style is the right tool here because the value is per-item data, and React style props are already why the policy permits inline styles. `alt=""` because the label is always beside it in text; a screen reader reading the album name twice is worse than not reading the image.

- [ ] **Step 4: Write `LibraryListView.tsx`**

A `role="table"` with a header row, and one row per entry. For `browseMode === 'song'` the rows are tracks; for `'album'` and `'artist'` the rows come from `groupIntoAlbums`/`groupIntoArtists` and a single click opens the drill-in. Duration is formatted `m:ss` by a small local helper — check `src/renderer/utils/utils.ts` first, as a time formatter may already exist there.

Rows are keyboard-reachable: `tabIndex={0}` and Enter doing what a double click does.

A right click on a track row opens an `AnchoredMenu` with one entry, `t('library.reveal')`, calling `revealLibraryTrack(track.id)`. That is the whole of the context menu for now — it exists because a library that can see a file and cannot tell you where it is is annoying in a way that costs one line to fix.

- [ ] **Step 5: Run the tests**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryListView.test.tsx
pnpm typecheck && pnpm typecheck:styles
```

Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/LibraryListView.test.tsx
git commit -m "Show the library as a list you can read a whole album from"
```

---

### Task 15: The grid, and opening an album

**Files:**

- Create: `src/renderer/library/LibraryGridView.tsx`
- Create: `src/renderer/library/LibraryDetail.tsx`
- Modify: `src/renderer/library/LibraryWorkspace.tsx`
- Modify: `src/renderer/styles/Library.scss`
- Test: `src/__tests__/unit_tests/LibraryGridView.test.tsx`

**Interfaces:**

- Consumes: Tasks 3, 4, 14.
- Produces:
  - `LibraryGridView` with `{ tracks, browseMode, onOpenAlbum, onOpenArtist, onPlayTrack }`
  - `LibraryDetail` with `{ tracks, albumId?, artistId?, onBack, onPlayTrack }`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import LibraryGridView from '../../renderer/library/LibraryGridView';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track = (over: Partial<ILibraryTrack>): ILibraryTrack => ({
  id: over.title ?? 'id',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Untitled',
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
  ...over,
});

describe('the library as a grid', () => {
  it('draws a tile per album and opens the one that was clicked', async () => {
    const onOpenAlbum = jest.fn();
    render(
      <I18nProvider>
        <LibraryGridView
          tracks={[
            track({ title: 'A', album: 'Kind', artist: 'Miles' }),
            track({ title: 'B', album: 'Bitches', artist: 'Miles' }),
          ]}
          browseMode="album"
          onOpenAlbum={onOpenAlbum}
          onOpenArtist={jest.fn()}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
    await userEvent.click(screen.getByText('Kind'));
    expect(onOpenAlbum).toHaveBeenCalled();
  });

  it('gives an untagged album a tile rather than a blank square', () => {
    // Nothing here has an artId, so every tile is generated. A grid of empty
    // squares reads as a failed load.
    render(
      <I18nProvider>
        <LibraryGridView
          tracks={[track({ title: 'A' })]}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
          onPlayTrack={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getByText('UN')).toBeInTheDocument();
  });
});
```

The `'UN'` expectation follows from `libraryTileInitials('Unknown album')` — the grid labels an untitled album with `t('library.unknownAlbum')`.

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryGridView.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write both components**

`LibraryGridView` is a CSS grid of `<button>` tiles, each a `LibraryCoverArt size="tile"` with the title and a secondary line beneath. `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))` so it reflows with the window instead of picking a column count.

`LibraryDetail` is the drill-in: a header with the large cover, the album or artist name, the counts, a **Play** button (`button small`), a **Back** control, and the track list — reusing `LibraryListView` with `browseMode="song"` rather than a second table.

- [ ] **Step 4: Hold the drill-in state in `LibraryWorkspace`**

One `openAlbumId | openArtistId | undefined`. Opening one sets it, Back clears it. Changing browse mode clears it too — an album id means nothing while artists are listed.

- [ ] **Step 5: Run the tests**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryGridView.test.tsx
pnpm typecheck && pnpm typecheck:styles
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/LibraryGridView.test.tsx
git commit -m "Show the covers, and let one open into its songs"
```

---

### Task 16: Cover Flow

**Files:**

- Create: `src/renderer/library/LibraryCoverFlow.tsx`
- Create: `src/renderer/styles/LibraryCoverFlow.scss`
- Modify: `src/renderer/library/LibraryWorkspace.tsx`
- Test: `src/__tests__/unit_tests/LibraryCoverFlow.test.tsx`

**Interfaces:**

- Consumes: Tasks 3, 4, 14.
- Produces:
  - `COVER_FLOW_NEIGHBOURS: number`
  - `coverFlowTransform(offset: number): string`
  - `LibraryCoverFlow` with `{ tracks, browseMode, onOpenAlbum, onOpenArtist }`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import LibraryCoverFlow, {
  COVER_FLOW_NEIGHBOURS,
  coverFlowTransform,
} from '../../renderer/library/LibraryCoverFlow';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const albumTracks = (count: number): ILibraryTrack[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `t${index}`,
    rootId: 'r',
    path: `C:\\Music\\${index}.mp3`,
    kind: 'audio' as const,
    isPlayable: true,
    title: `Song ${index}`,
    album: `Album ${index}`,
    artist: 'Artist',
    sizeBytes: 1,
    mtimeMs: 1,
    addedAt: 1,
  }));

describe('the cover flow geometry', () => {
  it('leaves the centre cover facing the viewer', () => {
    expect(coverFlowTransform(0)).toContain('rotateY(0deg)');
  });

  it('turns the two sides towards the middle, not the same way', () => {
    expect(coverFlowTransform(-1)).toContain('rotateY(60deg)');
    expect(coverFlowTransform(1)).toContain('rotateY(-60deg)');
  });

  it('pushes distant covers back rather than only sideways', () => {
    // Without translateZ the row is a flat fan. The depth is the effect.
    expect(coverFlowTransform(2)).toMatch(/translateZ\(-\d/);
  });
});

describe('cover flow', () => {
  it('mounts a window of covers, not the whole library', async () => {
    // 400 albums must animate like 20. Everything past the window is not
    // rendered at all.
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(400)}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(
      COVER_FLOW_NEIGHBOURS * 2 + 1,
    );
  });

  it('moves with the arrow keys', async () => {
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(5)}
          browseMode="album"
          onOpenAlbum={jest.fn()}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    const stage = screen.getByRole('listbox');
    stage.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('option', { selected: true })).toHaveTextContent(
      'Album 1',
    );
  });

  it('opens the centre cover on Enter', async () => {
    const onOpenAlbum = jest.fn();
    render(
      <I18nProvider>
        <LibraryCoverFlow
          tracks={albumTracks(5)}
          browseMode="album"
          onOpenAlbum={onOpenAlbum}
          onOpenArtist={jest.fn()}
        />
      </I18nProvider>,
    );
    screen.getByRole('listbox').focus();
    await userEvent.keyboard('{Enter}');
    expect(onOpenAlbum).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryCoverFlow.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `LibraryCoverFlow.tsx`**

Constants at the top, each with its number stated rather than implied:

```ts
/** Covers kept mounted either side of the centre. Past this, nothing renders. */
export const COVER_FLOW_NEIGHBOURS = 6;
/** Degrees a side cover is turned towards the middle. */
const COVER_FLOW_ANGLE = 60;
/** Horizontal step, in cover widths, between neighbours. */
const COVER_FLOW_STEP = 0.42;
/** How far back each step pushes a cover, in pixels. */
const COVER_FLOW_DEPTH = 60;

export const coverFlowTransform = (offset: number): string => {
  if (offset === 0) {
    return 'translateX(0) translateZ(0) rotateY(0deg)';
  }
  const direction = offset > 0 ? 1 : -1;
  const distance = Math.abs(offset);
  return [
    `translateX(${offset * COVER_FLOW_STEP * 100}%)`,
    `translateZ(-${distance * COVER_FLOW_DEPTH}px)`,
    `rotateY(${-direction * COVER_FLOW_ANGLE}deg)`,
  ].join(' ');
};
```

The stage is `role="listbox"` with `tabIndex={0}`; each cover is `role="option"` with `aria-selected` on the centre one, so keyboard and screen-reader users get a position rather than a wall of images. Wheel and drag both move the centre index; Home and End jump to the ends. Only indices within `COVER_FLOW_NEIGHBOURS` of the centre are rendered.

- [ ] **Step 4: Write `LibraryCoverFlow.scss`**

`perspective` on the stage, `transform-style: preserve-3d` on the track, a `transition` on each cover's transform using the app's existing motion variables from `_motion.scss` — read that file rather than inventing a duration. The reflection is a second copy with `transform: scaleY(-1)` under a `mask-image: linear-gradient(...)`.

- [ ] **Step 5: Run the tests**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryCoverFlow.test.tsx
pnpm typecheck && pnpm typecheck:styles
```

Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/LibraryCoverFlow.test.tsx
git commit -m "Sweep through the covers in three dimensions"
```

---

### Task 17: The video section

**Files:**

- Create: `src/renderer/library/LibraryVideoSection.tsx`
- Modify: `src/renderer/library/LibraryWorkspace.tsx`
- Modify: `src/renderer/styles/Library.scss`
- Test: `src/__tests__/unit_tests/LibraryVideoSection.test.tsx`

**Interfaces:**

- Consumes: Tasks 3, 14.
- Produces: `LibraryVideoSection` with `{ tracks, onPlayTrack }`, and `videoFolderGroups(tracks): { folder: string; tracks: ILibraryTrack[] }[]` exported from the same file.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { ILibraryTrack } from '../../common/library/types';
import LibraryVideoSection, {
  videoFolderGroups,
} from '../../renderer/library/LibraryVideoSection';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const video = (path: string, title: string): ILibraryTrack => ({
  id: title,
  rootId: 'r',
  path,
  kind: 'video',
  isPlayable: true,
  title,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
});

describe('videos in the library', () => {
  it('groups by the folder they live in, since they have no album', () => {
    const groups = videoFolderGroups([
      video('C:\\V\\Live\\a.mp4', 'A'),
      video('C:\\V\\Live\\b.mp4', 'B'),
      video('C:\\V\\Clips\\c.mp4', 'C'),
    ]);
    expect(groups.map((entry) => entry.folder).sort()).toEqual([
      'Clips',
      'Live',
    ]);
  });

  it('says so plainly when there are none', () => {
    render(
      <I18nProvider>
        <LibraryVideoSection tracks={[]} onPlayTrack={jest.fn()} />
      </I18nProvider>,
    );
    expect(
      screen.getByText('No videos in the folders you have added.'),
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryVideoSection.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

`videoFolderGroups` splits on both separators — a path arrives as Windows text and the tests use it, but a normaliser that only handles `\` breaks the moment anything is written with `/`. The section renders each folder as a heading with a grid of video tiles beneath, reusing `LibraryCoverArt`.

- [ ] **Step 4: Show it in the workspace**

The video section is reachable from the browse control — extend the toolbar's tablist with the `library.videos` entry, so browse mode becomes album / artist / song / videos. Add `'video'` to `TLibraryBrowseMode` in `src/common/library/types.ts` and handle it in the workspace's switch.

- [ ] **Step 5: Run the tests**

```bash
pnpm exec jest src/__tests__/unit_tests/LibraryVideoSection.test.tsx src/__tests__/unit_tests/LibraryToolbar.test.tsx
pnpm typecheck && pnpm typecheck:styles
```

Expected: PASS. If the toolbar test fails on the tab count, update its expectation — the fourth entry is intended.

- [ ] **Step 6: Commit**

```bash
git add src/renderer src/common/library/types.ts src/__tests__/unit_tests
git commit -m "Give videos a shelf of their own"
```

---

### Task 18: The queue

Pure logic first, with no React anywhere near it.

**Files:**

- Create: `src/common/library/queue.ts`
- Test: `src/__tests__/unit_tests/common/libraryQueue.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `ILibraryQueue { trackIds: readonly string[]; order: readonly number[]; position: number; repeat: TLibraryRepeat; isShuffled: boolean }`
  - `TLibraryRepeat = 'off' | 'all' | 'one'`
  - `buildQueue(trackIds, startTrackId, isShuffled): ILibraryQueue`
  - `currentTrackId(queue): string | undefined`
  - `advanceQueue(queue, direction: 1 | -1): ILibraryQueue`
  - `queueAtEnd(queue): boolean`
  - `setShuffle(queue, isShuffled): ILibraryQueue`
  - `removeFromQueue(queue, trackId): ILibraryQueue`

- [ ] **Step 1: Write the failing test**

```ts
import {
  advanceQueue,
  buildQueue,
  currentTrackId,
  queueAtEnd,
  removeFromQueue,
  setShuffle,
} from '../../../common/library/queue';

const ids = ['a', 'b', 'c', 'd'];

describe('the play queue', () => {
  it('starts on the track that was double-clicked, not the first one', () => {
    expect(currentTrackId(buildQueue(ids, 'c', false))).toBe('c');
  });

  it('walks forward and back', () => {
    let queue = buildQueue(ids, 'a', false);
    queue = advanceQueue(queue, 1);
    expect(currentTrackId(queue)).toBe('b');
    queue = advanceQueue(queue, -1);
    expect(currentTrackId(queue)).toBe('a');
  });

  it('stops at the end with repeat off, and wraps with repeat all', () => {
    const last = { ...buildQueue(ids, 'd', false), repeat: 'off' as const };
    expect(queueAtEnd(last)).toBe(true);
    expect(currentTrackId(advanceQueue(last, 1))).toBe('d');
    const looping = { ...last, repeat: 'all' as const };
    expect(currentTrackId(advanceQueue(looping, 1))).toBe('a');
  });

  it('stays put on repeat one', () => {
    const queue = { ...buildQueue(ids, 'b', false), repeat: 'one' as const };
    expect(currentTrackId(advanceQueue(queue, 1))).toBe('b');
  });

  it('keeps playing the same track when shuffle is switched on', () => {
    // Shuffle reorders what comes next. Interrupting the song somebody is
    // listening to is not what the button says it does.
    const queue = buildQueue(ids, 'c', false);
    const shuffled = setShuffle(queue, true);
    expect(currentTrackId(shuffled)).toBe('c');
    expect(shuffled.order).toHaveLength(ids.length);
    expect([...shuffled.order].sort()).toEqual([0, 1, 2, 3]);
  });

  it('drops a removed track without losing its place', () => {
    const queue = buildQueue(ids, 'c', false);
    const shorter = removeFromQueue(queue, 'a');
    expect(currentTrackId(shorter)).toBe('c');
    expect(shorter.trackIds).toEqual(['b', 'c', 'd']);
  });

  it('survives the queue emptying under it', () => {
    let queue = buildQueue(['a'], 'a', false);
    queue = removeFromQueue(queue, 'a');
    expect(currentTrackId(queue)).toBeUndefined();
    expect(currentTrackId(advanceQueue(queue, 1))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryQueue.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `src/common/library/queue.ts`**

`order` is an array of indices into `trackIds`, and `position` is an index into `order`. That indirection is the whole design: shuffling permutes `order` and leaves `trackIds` alone, so switching shuffle off restores the original run without a second copy of the list. Every function returns a new object; none mutates.

- [ ] **Step 4: Run the test**

```bash
pnpm exec jest src/__tests__/unit_tests/common/libraryQueue.test.ts
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/common/library/queue.ts src/__tests__/unit_tests/common/libraryQueue.test.ts
git commit -m "Decide what plays next before anything can play at all"
```

---

### Task 19: The player and the now-playing bar

**Files:**

- Create: `src/renderer/library/player/LibraryPlayerContext.tsx`
- Create: `src/renderer/library/player/NowPlayingBar.tsx`
- Create: `src/renderer/library/player/LibraryVideoStage.tsx`
- Create: `src/renderer/styles/NowPlayingBar.scss`
- Modify: `src/renderer/App.tsx` (mount the provider and the bar)
- Modify: `src/renderer/library/LibraryWorkspace.tsx` (call `playTracks`)
- Test: `src/__tests__/unit_tests/NowPlayingBar.test.tsx`

**Interfaces:**

- Consumes: Task 18, `libraryMediaUrl` (Task 10), `LibraryCoverArt` (Task 14).
- Produces: `LibraryPlayerProvider`, and `useLibraryPlayer(): { queue, track, isPlaying, positionMs, durationMs, playTracks(trackIds, startId), toggle(), skip(direction), seek(ms), setShuffle(on), cycleRepeat(), setVolume(value) }`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ILibraryTrack } from '../../common/library/types';
import NowPlayingBar from '../../renderer/library/player/NowPlayingBar';
import { I18nProvider } from '../../renderer/utils/I18nContext';

const track: ILibraryTrack = {
  id: 't1',
  rootId: 'r',
  path: 'C:\\Music\\a.mp3',
  kind: 'audio',
  isPlayable: true,
  title: 'Blue',
  artist: 'Miles',
  durationMs: 92000,
  sizeBytes: 1,
  mtimeMs: 1,
  addedAt: 1,
};

const bar = (over: Partial<React.ComponentProps<typeof NowPlayingBar>> = {}) =>
  render(
    <I18nProvider>
      <NowPlayingBar
        track={track}
        isPlaying
        positionMs={0}
        durationMs={92000}
        repeat="off"
        isShuffled={false}
        onToggle={jest.fn()}
        onSkip={jest.fn()}
        onSeek={jest.fn()}
        onShuffle={jest.fn()}
        onRepeat={jest.fn()}
        onVolume={jest.fn()}
        {...over}
      />
    </I18nProvider>,
  );

describe('the now playing bar', () => {
  it('names what is playing', () => {
    bar();
    expect(screen.getByText('Blue')).toBeInTheDocument();
    expect(screen.getByText('Miles')).toBeInTheDocument();
  });

  it('offers pause while playing and play while paused', async () => {
    const onToggle = jest.fn();
    bar({ onToggle });
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(onToggle).toHaveBeenCalled();
    bar({ isPlaying: false });
    expect(
      screen.getAllByRole('button', { name: 'Play' }).length,
    ).toBeGreaterThan(0);
  });

  it('skips in both directions', async () => {
    const onSkip = jest.fn();
    bar({ onSkip });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSkip).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onSkip).toHaveBeenCalledWith(-1);
  });

  it('renders nothing at all when nothing is loaded', () => {
    const { container } = render(
      <I18nProvider>
        <NowPlayingBar
          track={undefined}
          isPlaying={false}
          positionMs={0}
          durationMs={0}
          repeat="off"
          isShuffled={false}
          onToggle={jest.fn()}
          onSkip={jest.fn()}
          onSeek={jest.fn()}
          onShuffle={jest.fn()}
          onRepeat={jest.fn()}
          onVolume={jest.fn()}
        />
      </I18nProvider>,
    );
    // A permanent empty strip across every tab is a worse tax than the bar is
    // a benefit. It appears with the music and leaves with it.
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
pnpm exec jest src/__tests__/unit_tests/NowPlayingBar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write `LibraryPlayerContext.tsx`**

Holds the queue from Task 18 and one `HTMLAudioElement` created with `new Audio()` in a ref — not a rendered `<audio>` element, because the provider lives above the tab switch and must not be re-created by anything the tab does. Position updates come from `timeupdate`, which fires about four times a second; do not add a `requestAnimationFrame` loop for a number that changes once a second on screen.

On `ended` it calls `advanceQueue(queue, 1)` and loads the next id; when `queueAtEnd` and repeat is `off`, it stops. Video tracks set a `videoTrackId` the stage reads instead of feeding the audio element, so the two never play at once.

`playTracks(trackIds, startId)` is what every view calls — the queue is whatever list the user was looking at.

- [ ] **Step 4: Write `NowPlayingBar.tsx` and `LibraryVideoStage.tsx`**

The bar: cover, title and artist, previous / play-pause / next, a seek slider, shuffle and repeat toggles, volume. Returns `null` when there is no track. Reuse `Slider` from `src/renderer/widgets/` rather than a bare range input — read its props first.

The stage: a `<video>` filling the Library tab's body when a video is loaded, with a fullscreen control that goes through the same window-fullscreen path Karaoke and the graph share. Read how `App.tsx` applies `applyKaraokeFullScreen` before writing a second mechanism.

- [ ] **Step 5: Mount them in `App.tsx`**

`LibraryPlayerProvider` wraps the workspace region; `NowPlayingBar` renders below the tab panels so it is visible on every tab. Follow the comment block above `hasOpenedVideo` — it explains the hidden-not-unmounted rule this depends on.

Leave `mediaKeys.ts` and the titlebar transport alone. That transport fires Windows virtual keys at whatever is playing system-wide and gets no answer back; routing this player into it as well would make one click do two things. Write that reason into a comment where somebody would otherwise think to connect them.

- [ ] **Step 6: Run the tests and the whole suite**

```bash
pnpm exec jest src/__tests__/unit_tests/NowPlayingBar.test.tsx
pnpm test
pnpm typecheck && pnpm typecheck:styles && pnpm lint
```

Expected: everything passes. This is the first point where the whole suite is worth running — earlier tasks touch too little to justify it.

- [ ] **Step 7: Commit**

```bash
git add src/renderer src/__tests__/unit_tests/NowPlayingBar.test.tsx
git commit -m "Keep the music playing wherever you go in the app"
```

---

### Task 20: Look at it in a real window

Nothing above proves how any of it looks. Every UI defect that has shipped in this project passed the whole suite first.

**Files:**

- Modify: whatever this task finds. Expect `Library.scss`, `LibraryCoverFlow.scss` and `NowPlayingBar.scss`.

**Interfaces:**

- Consumes: everything.
- Produces: a verdict, and the fixes it earns.

- [ ] **Step 1: Ask Ivan to launch the app**

Do not launch it. Ask, and say what to open: the Library tab, with a real music folder added.

- [ ] **Step 2: Probe the running window**

DevTools is on `127.0.0.1:9222` in development. Check, with `getComputedStyle` and element boxes rather than by reasoning about the cascade:

- Grid tiles are square and the row reflows with the window at 900px, 1400px and full screen.
- The Cover Flow stage has real perspective, the centre cover is upright and readable, and the reflection is under the covers rather than over them.
- The now-playing bar's height, contrast and control sizes match the app's other bars — compare against the titlebar transport's computed values, do not guess.
- **Add folder** is the filled `button small`; **Rescan** is `button small subtle`.
- The empty state is centred in the panel, not pinned to the top-left.
- The scan strip appears within a second of adding a folder and its Stop button works.

- [ ] **Step 3: Screenshot each of the three view modes and both browse modes**

Save them beside the existing `design-qa-*.png` files at the repository root, named `design-qa-library-list.png`, `design-qa-library-grid.png`, `design-qa-library-coverflow.png`.

- [ ] **Step 4: Fix what the probe found, then re-probe**

Each fix is its own commit with a subject naming what was wrong.

- [ ] **Step 5: Report honestly**

Say what was verified in a real window and what was not. Passing tests are not a UI verdict, and neither is a screenshot of one window size.

- [ ] **Step 6: Commit the screenshots**

```bash
git add design-qa-library-*.png
git commit -m "Record how the library looks in a real window"
```

---

## Notes for whoever executes this

- Tasks 2–4 and 18 are pure functions with no Electron and no React. They are the fastest to get right and everything else leans on them; do not reorder them behind the UI.
- Task 1 is a gate, not a formality. If `music-metadata` will not load in both loaders, Tasks 7 and 9 are built on sand.
- If a task's file passes 500 lines, stop and split it at the seam the task names rather than carrying on.
- The full suite is `pnpm test`, and it needs `dist` to exist. Run `pnpm build` once if Jest refuses to start.
