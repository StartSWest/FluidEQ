# Media Library — design

A Library tab that scans folders of music and video, reads their tags and
cover art, and browses them three ways in three shapes, with a player that
keeps playing when you look at something else.

Date: 2026-08-18. Branch: `claude/music-video-player-library-a08698`.

## 1. Why this exists

FluidEQ already plays other people's media — the Media tab embeds a browser,
the Karaoke tab opens a folder of songs — but it cannot see the music on the
machine it is equalising. A library closes that: the app becomes somewhere you
choose what to listen to, not only somewhere you shape it afterwards.

## 2. Scope

**In:** folder scanning, tag and artwork extraction, an on-disk index, three
view modes (list, grid, Cover Flow), three browse modes (album, artist, song),
a separate section for video files, a persistent player with a queue, shuffle
and repeat, and a now-playing bar visible on every tab.

**Out, deliberately:** saved playlists (the queue covers v1; Karaoke already
owns a playlist of its own), online metadata or artwork lookup, tag editing,
ratings and play counts, library sync, and any transcoding.

## 3. Decisions already taken

| Question        | Decision                                                          |
| --------------- | ----------------------------------------------------------------- |
| Tag reading     | `music-metadata` (MIT), in the main process — see the risk in §12 |
| Contents        | Music and video in one scan, video in its own section             |
| Karaoke files   | Excluded from the library, counted and explained                  |
| Player lifetime | Persistent, mounted above the tab switch                          |
| Index           | JSON in `userData`, incremental rescan by size and mtime          |
| 3D mode         | Cover Flow, CSS 3D transforms, no new dependency                  |
| Folders         | OS picker plus folder drop; auto incremental rescan at launch     |
| Missing art     | Folder art, then a generated colour-initial tile; fully offline   |
| Organisation    | Play queue with shuffle and repeat; no saved playlists            |

## 4. Architecture

```
folders → [main] scanner → metadata → JSON index + thumbnail cache
                                            ↓  IPC snapshot + progress events
                                    [renderer] LibraryProvider
                                            ↓
                       grouping (pure) → albums / artists / songs
                                            ↓
                        List | Grid | Cover Flow  ───┐
                                                     ↓
                    LibraryPlayer (above the tab switch) → now-playing bar
```

The index lives in main and is the only source of truth. The renderer holds
one snapshot and derives albums, artists, sort orders and search results from
it with pure functions. That split is what makes the interesting logic
testable: grouping a thousand tracks into albums needs no Electron, no
filesystem and no window.

### 4.1 Serving local files

A new privileged scheme, `fluideq-media://<id>`, registered before app ready
and handled with `net.fetch(pathToFileURL(realPath))`. Electron's `net` module
answers Range requests, which is what makes seeking inside a large video work;
a handler that returns a whole buffer does not.

Ids are opaque and are resolved against the index. **No protocol request and no
read channel ever accepts a filesystem path from the caller** — the same rule
`karaokeSession.ts` follows with its token map. Paths travel outwards for
display, and "show in Explorer" takes an id.

The single exception is `library-root-add-paths`, which is how a dropped folder
becomes a root. It is a path inwards, so it is worth being explicit about why
it is safe: it only ever _adds a root_, main verifies the path exists and is a
directory before doing so, and it reads nothing that the user did not drop on
the window. It cannot be used to read a file — that still goes through an id.

Cover art is served by the same scheme out of the thumbnail cache.

### 4.2 Content-Security-Policy

`contentSecurityPolicy.ts` needs two additions:

- `media-src` gains `fluideq-media:`
- `img-src` gains `fluideq-media:` — today it is `'self' data: blob:`, so
  without this every cover is silently blank while nothing else looks wrong.

Both are narrower than the `file:` already permitted on `media-src`, because
the scheme only ever resolves ids that are in the index.

## 5. Data model — `src/common/library/types.ts`

```ts
interface ILibraryIndex {
  version: 1;
  roots: ILibraryRoot[];
  tracks: ILibraryTrack[];
}

interface ILibraryRoot {
  id: string;
  path: string;
  addedAt: number;
  lastScanAt?: number;
  /** Set when the folder was missing at the last scan — an unplugged drive. */
  isOffline?: boolean;
  trackCount: number;
  /** Karaoke songs skipped here, so the UI can say where they went. */
  karaokeSkipped: number;
}

interface ILibraryTrack {
  id: string; // stable hash of the absolute path
  rootId: string;
  path: string; // outwards only; never accepted back
  kind: 'audio' | 'video';
  /** False for containers Chromium has no demuxer for — mkv, avi, wmv. */
  isPlayable: boolean;
  title: string; // tag, else a cleaned filename
  artist?: string;
  albumArtist?: string;
  album?: string;
  trackNo?: number;
  discNo?: number;
  year?: number;
  genre?: string;
  durationMs?: number;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  codec?: string;
  /** Thumbnail id in the art cache; absent means draw a generated tile. */
  artId?: string;
  sizeBytes: number;
  mtimeMs: number;
  addedAt: number;
  /** Tags could not be read; the row still exists and still plays. */
  hasMetadataError?: boolean;
}
```

Albums and artists are **not** stored. They are derived, because storing them
means two representations of the same truth and a migration every time
grouping changes.

## 6. Main process — `src/main/library/`

| File                 | Responsibility                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| `libraryScanner.ts`  | Walk roots, filter by extension, skip unchanged files by size and mtime, emit progress, honour cancellation |
| `libraryMetadata.ts` | `music-metadata` wrapper: tags, duration, embedded picture; folder-art fallback; filename fallback          |
| `libraryArtwork.ts`  | Hash image bytes, resize once with `nativeImage`, write `userData/library-art/<hash>.jpg`                   |
| `libraryIndex.ts`    | Load, migrate, save; own the roots list and the id→path map                                                 |
| `libraryProtocol.ts` | Register and handle `fluideq-media`                                                                         |
| `ipc/library.ts`     | The channels below                                                                                          |

Channels, following the `registerKaraokeIpc` shape — a deps object naming
exactly what the handlers touch, and `getMainWindow` as a function because the
window outlives none of them:

- `library-index-get` → the snapshot
- `library-root-add` → OS folder picker, then scan
- `library-root-add-paths` → for a folder drop. The renderer resolves the
  dropped entry to a path with the `getPathForFile` bridge that already exists
  in `api.ts:140`; main verifies it is an existing directory before accepting
  it
- `library-root-remove`
- `library-scan-start` / `library-scan-cancel`
- `library-scan-progress` (event: root, files seen, files done, current name)
- `library-index-changed` (event: a fresh snapshot)
- `library-reveal` → `shell.showItemInFolder` for one id

### 6.1 Extensions

`src/common/library/files.ts` declares its own lists rather than moving
Karaoke's. The two are genuinely different sets — Karaoke's audio list is what
that feature supports, not what a library should show — and moving them would
be an unrelated refactor of working code.

What it does reuse is `KARAOKE_TEXT_ADAPTERS`, imported from
`common/karaoke/files.ts`, because the exclusion rule in §6.2 must agree with
what the Karaoke tab will actually open. One definition, two readers.

The recognised-versus-playable split those files already document applies here
for the same reason it does there: an `.avi` shown as a black rectangle looks
like a broken player, and shown as "this format cannot be played here" looks
like an honest one.

Audio: `mp3`, `wav`, `ogg`, `flac`, `m4a`, `opus`, `aac`, `aiff`, `alac`,
`m4b`, `wma`. Of those, `wma`, `alac` and `aiff` are recognised and not
playable in Chromium's media stack.

### 6.2 Karaoke exclusion

A track is skipped when a sibling file shares its base name and is either a
`.lrc`/`.elrc`, or a `.txt` that `KARAOKE_TEXT_ADAPTERS` recognises by content
— content, not extension, because a `.txt` beside an MP3 is as often a
tracklist as an UltraStar chart.

Skips are counted per root and surfaced: _"12 karaoke songs skipped — open them
on the Karaoke tab"_. A folder that half-vanishes with no explanation is the
failure this prevents.

### 6.3 Incremental rescan

A file whose path, size and mtime all match the index is not re-parsed. A
rescan of an unchanged folder therefore costs one `stat` per file and no tag
reads. Roots are rescanned on launch, after the window is showing, at low
priority; a manual **Rescan** button forces a full re-read.

## 7. Renderer — `src/renderer/library/`

```
LibraryWorkspace.tsx      tab shell: toolbar + body + empty state
LibraryToolbar.tsx        browse mode, view mode, sort, search, Add folder
LibraryListView.tsx       dense sortable table
LibraryGridView.tsx       album/artist/song tiles
LibraryCoverFlow.tsx      the 3D mode
LibraryCoverArt.tsx       thumbnail or generated tile, one component
LibraryDetail.tsx         drill-in: an album's tracks, an artist's albums
LibraryVideoSection.tsx   video, browsed by folder and title
LibraryScanProgress.tsx   progress, cancel, send to background
LibraryEmptyState.tsx     Add folder, and the karaoke-skipped note
useLibraryIndex.ts        snapshot subscription
useLibraryScan.ts         scan status
player/LibraryPlayerProvider.tsx   queue, elements, shuffle/repeat, position
player/NowPlayingBar.tsx           the strip visible on every tab
player/LibraryVideoStage.tsx       video surface, fullscreen
player/useLibraryQueue.ts          queue operations, pure where possible
```

Styles: `Library.scss`, `LibraryCoverFlow.scss`, `NowPlayingBar.scss`. Controls
reuse `button small` and `button small subtle`, `Dropdown`, `AnchoredMenu`,
`PaneResizer`, `Slider`. No new button styles.

### 7.1 The two axes

Browse mode chooses _what_ is listed; view mode chooses _how_. They are
independent, and both are persisted under `fluideq.library.browseMode` and
`fluideq.library.viewMode`.

|            | List                       | Grid                                | Cover Flow               |
| ---------- | -------------------------- | ----------------------------------- | ------------------------ |
| **Album**  | rows of albums, expandable | cover tiles                         | covers, album name below |
| **Artist** | rows of artists            | artist tiles, art from newest album | one cover per artist     |
| **Song**   | the dense track table      | song tiles                          | per-track art            |

One grid component fed three different lists, not three components. Anything
else is the flag-driven duplication the coding standards forbid.

### 7.2 Cover Flow

Pure CSS 3D. The centre cover faces the viewer; each neighbour is translated
outward and rotated about Y by a fixed angle, with `translateZ` falling away
so depth is real rather than painted. A reflection is the same image mirrored
under a gradient mask.

Constants live at the top of the file with measured values, not guesses:
angle, spacing, depth falloff, and how many covers either side stay mounted —
the rest are not rendered, so a 5,000-album library animates the same as a
20-album one.

Input: wheel, drag, arrow keys, Home/End. Enter or click opens the album.
Focus follows the centre cover so keyboard and screen-reader users get a
sensible reading order rather than a wall of images.

### 7.3 The tab

`'library'` joins `TWorkspaceTab` and `WORKSPACE_TABS` in `App.tsx`, between
`'video'` and `'karaoke'` — the media half of the strip. The response graph
defaults to hidden on it, as it does on Karaoke: this is a surface for looking
at album art, not at a spectrum.

## 8. The player

Mounted beside `VideoBrowser` and `KaraokeWorkspace`, outside the tab switch,
hidden rather than unmounted — the pattern those two already prove.

- One `<audio>` and one `<video>`, both fed `fluideq-media://<id>`.
- The queue is whatever you were looking at when you started: double-click a
  song in an album and the album is the queue; do it in a filtered search and
  the filtered list is the queue.
- Shuffle, repeat-all, repeat-one. Reorder and remove within the queue.
- The now-playing bar shows art, title, artist, position, transport, volume,
  and it is visible on **every** tab while something is loaded. Music you
  cannot pause without hunting for a tab is a bug.
- Video plays in the Library tab's own stage with a fullscreen control that
  reuses the window-fullscreen path Karaoke and the graph already share.

It deliberately does **not** hook `mediaKeys.ts`. That transport fires Windows
virtual keys at whatever is playing system-wide; routing our player into it too
would make one click do two things.

In-app playback needs no special audio routing: Equalizer APO is system-wide,
so the app's own output is already downstream of every FluidEQ layer.

## 9. Artwork

1. Embedded picture from the tags.
2. Otherwise the first of `cover|folder|front|album|artwork.(jpg|jpeg|png|webp)`
   in the file's own folder.
3. Otherwise a generated tile: initials from the album or title, on a colour
   derived by hashing that same string, so it is stable across launches and a
   grid of untagged albums looks deliberate.

Images 1 and 2 are hashed by content, resized once and cached as
`userData/library-art/<hash>.jpg`. Two hundred tracks from one album share a
single cached file. Step 3 costs nothing on disk — it is drawn in the renderer.

## 10. Error handling

| Failure                | Behaviour                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tags unreadable        | Track kept, title from the filename, `hasMetadataError` set; scan continues                                        |
| Root missing at rescan | Root marked offline, its tracks kept and dimmed — **never deleted**. An unplugged drive must not destroy a library |
| Unplayable container   | Listed, marked, and refused with a reason instead of a black rectangle                                             |
| Index JSON corrupt     | Moved aside to `.bak`, a fresh index started, and said so in the UI                                                |
| Artwork write fails    | Falls through to the generated tile                                                                                |
| Protocol id unknown    | 404; nothing is guessed from the request                                                                           |
| Scan cancelled         | Everything parsed so far is kept — a cancelled scan is a partial library, not a lost one                           |

## 11. Testing

Unit tests, all against pure functions in `src/common/library/`:

- grouping tracks into albums and artists, including compilations where
  `albumArtist` disagrees with `artist`, and albums of the same name by
  different artists
- sort orders and search filtering, including accents and case
- karaoke-pair detection — **with a positive control beside every null test**.
  A folder that should yield tracks is asserted to yield them in the same test
  file. Without it, "filtered exactly the karaoke files" and "filtered
  everything" produce identical passing output, which is precisely how the
  separation packing bug survived
- incremental-rescan decisions: changed size, changed mtime, unchanged, moved
- index load, migration and corrupt-file recovery
- generated-tile colour and initials derivation

Component tests: view and browse switching keeps the selection, queue
operations, and the now-playing bar surviving a tab change.

Visual verification before anything is called done, over DevTools on
`127.0.0.1:9222` in a real launch: Cover Flow geometry at several window
sizes, grid density, the now-playing bar's height and contrast, and the empty
state. Cover Flow in particular is exactly the kind of thing that passes every
test while looking wrong.

## 12. Risks

**`music-metadata` is ESM-only from v10.** This project is `"type":
"commonjs"`, and main is loaded two different ways: bundled by webpack for a
build, and through `ts-node` on `dev-main.cjs` in development. Those two can
disagree about an ESM dependency, and the development path is the more likely
to fail.

The first task of the implementation plan is a probe of both loaders, before
any library code is written on top of it. If either chokes, pin
`music-metadata@7.14.0` — the last CommonJS release, same MIT licence, same
parsers for the formats that matter here. This is not left to be discovered
halfway through.

**Index size.** JSON is comfortable to roughly 20,000 tracks. Beyond that the
parse cost at launch becomes visible and the answer is SQLite, which is a
native module and a packaging change. Out of scope here, and the schema
version field is what makes that migration possible later.

**Scan on a cold, large folder is slow.** Mitigated by showing progress from
the first second, cancellation, and backgrounding — and by the incremental
rescan, which makes every scan after the first nearly free.

## 13. i18n

A new `src/common/i18n/en/library.ts`, merged in `en/index.ts`, with every
string the tab uses. All ten locales in the same commit, as the project rules
require.

## 14. Build sequence

1. Probe `music-metadata` under both loaders; pin the version that works.
2. `src/common/library/` — types, extensions, karaoke-pair detection,
   grouping, tile derivation, with their tests.
3. Main: index, scanner, metadata, artwork, protocol, IPC.
4. CSP additions, and the preload API surface.
5. Renderer: provider, toolbar, empty state, list view.
6. Grid view, then detail drill-in.
7. Cover Flow.
8. Video section.
9. Player, queue, now-playing bar, video stage.
10. i18n across all ten locales.
11. Visual verification in a real launch, then the fixes it finds.
