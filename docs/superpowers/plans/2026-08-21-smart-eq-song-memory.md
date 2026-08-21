# Smart EQ Song Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tick beside the Smart EQ button that records the measured correction while a track plays, files it under that track's identity once two minutes have actually been listened to, and re-applies it with a notice the next time the same thing plays — from the library, the Media tab, or another program through the system mixer.

**Architecture:** Two pure modules carry everything worth testing — `common/songIdentity.ts` (what makes a song the same song) and `common/songEq.ts` (the store's shape) — plus a third pure piece, the recorder's reducer, which turns playback events into state and effects under an injected clock. The impure shells around them do nothing but filesystem, IPC and React. Identity reaches the recorder through one new optional field on the existing `ITransportSource`, which all four players already publish through.

**Tech Stack:** TypeScript (strict), Electron (main + renderer over `ipcRenderer.sendMessage` + `ipcMain.on`), React 18 with `useSyncExternalStore` module stores, Jest + Testing Library, SCSS, i18next-style dictionary in `src/common/i18n`.

**Spec:** `docs/superpowers/specs/2026-08-21-smart-eq-song-memory-design.md` — read it before Task 1. Every task argues from a numbered section of it.

## Global Constraints

Copied verbatim from the spec and from `CLAUDE.md`. Every task's requirements implicitly include this section.

- **Strict TS.** No `any` (use `unknown` + guards), no `!` non-null assertion, no `@ts-ignore`, no `==`, no `var`, no empty `catch`, no dead code, no `console.log` in source.
- **No `eslint-disable` without an inline justification** on the same line or the line above.
- **Files stay under 500 lines** unless there is genuinely no seam.
- **Comments state what the code cannot** — constraints, measured numbers, the failure the code prevents. Never what the next line does.
- **Never flag-driven.** A function or component that needs a mode flag to behave two ways is two functions or two components. This is why the store has `checkpointSongEq` and `commitSongEq` rather than one function with a boolean.
- **Every user-facing string goes through i18n, all ten locales in the same commit.** `src/__tests__/unit_tests/common/i18n.test.ts` asserts `getCoverage(code) === 1` for every locale, so an English-only key is a red suite, not a warning.
- **Jest will not start without a build.** `setupFiles` runs `check-build-exists.ts`, which throws unless `dist` holds both bundles. If `pnpm test` fails immediately with a build complaint, run `pnpm build` once and retry.
- **Imports inside `src/` use the path aliases** `common/...`, `main/...`, `renderer/...` — see any file in `src/__tests__/unit_tests/common/`.
- **Every file gets the GPL header** that every other file in `src/` carries. Copy it verbatim from a neighbour, e.g. `src/common/smartEq.ts:1-17`.
- **Exact constants** — `SONG_EQ_SETTLE_MS = 2_000`, `SONG_EQ_MIN_LISTENED_MS = 120_000`, `SONG_EQ_SUSPEND_GRACE_MS = 60_000`, `SONG_EQ_MAX_ENTRIES = 2000`, store `version: 1`, file name `song-eq.json`.
- **Do not run the app.** Ivan runs it. Say plainly what has and has not been verified.
- **Null tests need a positive control beside them,** in the same file, driven by the same helper. A test asserting a 90-second play saves nothing is worthless next to a reducer that saves nothing ever.

---

## File Structure

**Create (8 source + 10 i18n = 18)**

| File                                       | Responsibility                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/common/songIdentity.ts`               | `ISongIdentity`, per-source key construction, conservative alias normalisation        |
| `src/common/songEq.ts`                     | Store shape and every pure operation on it: lookup, checkpoint, commit, forget, evict |
| `src/common/songEqRecorder.ts`             | The lifecycle reducer — states, events, effects, the three timing constants           |
| `src/main/songEqStore.ts`                  | `song-eq.json` read/write, atomic                                                     |
| `src/main/ipc/songEq.ts`                   | The four channel handlers                                                             |
| `src/renderer/audio/nowPlayingIdentity.ts` | The playing subject (spec §4), as a module store                                      |
| `src/renderer/audio/songEqSession.ts`      | The reducer's impure shell: subscriptions, timer, effect performance, notice state    |
| `src/renderer/components/SongEqNotice.tsx` | "Using saved EQ for this song", Undo, Forget                                          |
| `src/renderer/styles/SongEqNotice.scss`    | Its styles                                                                            |
| `src/common/i18n/<locale>/songEq.ts` × 10  | Every string this feature needs                                                       |

The reducer lives in `common/` rather than `renderer/` because it is pure and its test should not need jsdom. The shell that owns the timer and the subscriptions is the renderer half, and it is a separate file so the reducer stays testable in isolation.

**Modify (22)** — `src/renderer/audio/transportSource.ts`; its four publishers `LibraryPlayerContext.tsx`, `KaraokeWorkspace.tsx`, `VideoBrowser.tsx`, `useSystemMediaSource.ts`; `src/common/channels.ts`; `src/main/ipc/index` registration point and `src/main/main.ts`; `src/renderer/utils/equalizerApi.ts`; `src/renderer/MainContent.tsx`; `src/renderer/App.tsx`; `src/renderer/library/player/NowPlayingBar.tsx`; `src/renderer/library/player/SourceTransportBar.tsx`; and ten `src/common/i18n/<locale>/index.ts`.

**Note for the executor:** `LibraryPlayerContext.tsx` is 1015 lines and `NowPlayingBar.tsx` is 796, both already over the 500-line rule. This plan adds a handful of lines to each and does **not** split them — splitting is separate work with its own risk. Do not take the additions as licence to grow them further; if a change here would add more than ~20 lines to either, stop and raise it.

---

## Task 1: Song identity

Spec §6 and §6.1. Pure module, no I/O, no React.

**Files:**

- Create: `src/common/songIdentity.ts`
- Test: `src/__tests__/unit_tests/common/songIdentity.test.ts`

**Interfaces:**

- Consumes: `TPlaybackOwner` from `renderer/audio/playbackOwner` — **do not import it**, see Step 3. This module declares its own source union to stay free of a renderer import.
- Produces:
  - `interface ISongIdentity { key: string; alias?: string; title: string; artist?: string; source: TSongSource; }`
  - `type TSongSource = 'library' | 'karaoke' | 'media' | 'system'`
  - `normalizeSongAlias(title: string, artist?: string): string | undefined`
  - `buildSongIdentity(source: TSongSource, exact: string, title: string, artist?: string): ISongIdentity | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/songIdentity.test.ts` with the GPL header, then:

```ts
import { buildSongIdentity, normalizeSongAlias } from 'common/songIdentity';

describe('normalizeSongAlias', () => {
  it('collapses platform noise onto the same alias', () => {
    // Every one of these is the same recording wearing a different hat on a
    // different service, and they must land on one key or a curve learned in
    // the browser is invisible to the library.
    const expected = normalizeSongAlias('Black Dog', 'Led Zeppelin');
    expect(expected).toBeDefined();
    [
      'Black Dog (Official Video)',
      'Black Dog [4K]',
      'Black Dog (Official Audio)',
      'Black Dog (Lyrics)',
      '  Black   Dog  ',
      'Black Dog (feat. Nobody)',
    ].forEach((title) => {
      expect(normalizeSongAlias(title, 'Led Zeppelin')).toBe(expected);
    });
  });

  it('keeps different recordings apart', () => {
    // THE POSITIVE CONTROL FOR THE TEST ABOVE. A normaliser that returned a
    // constant would pass the collapse test perfectly, so this is what proves
    // it is doing work rather than flattening everything.
    const original = normalizeSongAlias('Black Dog', 'Led Zeppelin');
    [
      'Black Dog (Remastered 2011)',
      'Black Dog (Live at Wembley)',
      'Black Dog (Acoustic)',
      'Black Dog (Radio Edit)',
    ].forEach((title) => {
      expect(normalizeSongAlias(title, 'Led Zeppelin')).not.toBe(original);
    });
    expect(normalizeSongAlias('Black Dog', 'Someone Else')).not.toBe(original);
  });

  it('refuses an alias for what is only a page title', () => {
    // No artist, and nothing about the title that reads as a track. Giving
    // this an alias would let two unrelated browser tabs share a curve.
    expect(normalizeSongAlias('How CPUs Work - An Explainer')).toBeUndefined();
    expect(normalizeSongAlias('')).toBeUndefined();
  });

  it('still aliases a bare title that carried platform noise', () => {
    // Positive control for the refusal above: no artist, but the noise proves
    // it came off a media page describing a track.
    expect(normalizeSongAlias('Black Dog (Official Video)')).toBeDefined();
  });
});

describe('buildSongIdentity', () => {
  it('keys each source in its own namespace', () => {
    expect(buildSongIdentity('library', 'abc123', 'Song')?.key).toBe(
      'library:abc123',
    );
    expect(buildSongIdentity('karaoke', 'proj-7', 'Song')?.key).toBe(
      'karaoke:proj-7',
    );
  });

  it('cuts tracking off a media url but keeps the path', () => {
    const identity = buildSongIdentity(
      'media',
      'https://www.youtube.com/watch?v=abc&t=42s&si=track',
      'Song',
    );
    expect(identity?.key).toBe('media:https://www.youtube.com/watch');
  });

  it('puts title and artist in a system key, because the app alone is not a song', () => {
    const identity = buildSongIdentity(
      'system',
      'Spotify.exe',
      'Black Dog',
      'Led Zeppelin',
    );
    expect(identity?.key).toBe('system:Spotify.exe:black dog:led zeppelin');
  });

  it('never gives karaoke an alias', () => {
    // Its mix has the vocals pulled out. A curve learned there is not a curve
    // for the record, and an alias would quietly apply one to the other.
    const identity = buildSongIdentity(
      'karaoke',
      'proj-7',
      'Black Dog',
      'Led Zeppelin',
    );
    expect(identity?.alias).toBeUndefined();
  });

  it('gives the other three an alias when there is one to give', () => {
    // Positive control: proves the karaoke case above is a rule and not the
    // whole function returning undefined.
    (['library', 'media', 'system'] as const).forEach((source) => {
      expect(
        buildSongIdentity(source, 'x', 'Black Dog', 'Led Zeppelin')?.alias,
      ).toBeDefined();
    });
  });

  it('is nothing at all without a title', () => {
    expect(buildSongIdentity('library', 'abc123', '')).toBeUndefined();
    expect(buildSongIdentity('library', 'abc123', '   ')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- songIdentity
```

Expected: FAIL — `Cannot find module 'common/songIdentity'`.

- [ ] **Step 3: Write the implementation**

Create `src/common/songIdentity.ts` with the GPL header, then:

```ts
/**
 * What makes a song the same song when it comes back.
 *
 * The bar carries four different kinds of thing and none of them shared an id:
 * a library file has a path, a page in the Media tab has a URL, and another
 * program has only what Windows publishes about it. This gives each an exact
 * key in its own namespace, plus — for three of the four — a normalised alias
 * so that your own file and the same song on Spotify can find each other.
 *
 * Its own source union rather than `TPlaybackOwner`, deliberately. That type
 * lives in the renderer, and the main process reads identities out of the
 * store; importing across that line to save four words would put a renderer
 * module in main's bundle.
 */
export type TSongSource = 'library' | 'karaoke' | 'media' | 'system';

export interface ISongIdentity {
  /** Exact, source-scoped. Never collides across sources. */
  key: string;
  /** Normalised `title|artist`. Absent where an alias would be a lie. */
  alias?: string;
  title: string;
  artist?: string;
  source: TSongSource;
}

/**
 * The closed list of platform noise, and the reason it is closed.
 *
 * A general "strip anything in brackets" would merge `(Remastered 2011)` with
 * the original and `(Live at Wembley)` with the studio cut — two pairs that
 * measure differently in exactly the range the correction cares about, and the
 * merge would be silent. So only phrases that describe a *delivery* are
 * removed, never ones that describe a *recording*.
 */
const PLATFORM_NOISE = [
  'official music video',
  'official lyric video',
  'official video',
  'official audio',
  'lyric video',
  'lyrics',
  'visualizer',
  'visualiser',
  'full song',
  'audio',
  '4k',
  'hd',
  'hq',
  'mv',
];

/** `(...)` and `[...]` groups whose whole contents are one noise phrase. */
const NOISE_GROUP = new RegExp(
  `[([]\\s*(${PLATFORM_NOISE.join('|')})\\s*[)\\]]`,
  'gi',
);

/** A trailing `feat.` clause, bracketed or not — it names a guest, not a mix. */
const FEATURE_CLAUSE = /\s*[([]?\s*(feat\.|ft\.|featuring)\s[^)\]]*[)\]]?\s*$/i;

const collapse = (value: string) =>
  value
    .toLowerCase()
    // Punctuation carries no meaning between two spellings of one title, but
    // the characters that separate words have to become spaces rather than
    // vanish, or `rock-n-roll` and `rock n roll` stop matching.
    .replace(/[_\-–—/]+/g, ' ')
    .replace(/["'’“”.,!?:;]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeSongAlias = (
  title: string,
  artist?: string,
): string | undefined => {
  const rawTitle = title.trim();
  if (!rawTitle) {
    return undefined;
  }

  const stripped = rawTitle
    .replace(NOISE_GROUP, ' ')
    .replace(FEATURE_CLAUSE, '');
  const cleanTitle = collapse(stripped);
  if (!cleanTitle) {
    return undefined;
  }

  const cleanArtist = collapse(artist ?? '');

  // NO ARTIST AND NOTHING STRIPPED IS A PAGE, NOT A SONG.
  //
  // A podcast, a livestream, a video essay: each publishes a title and no
  // artist, and giving those an alias would let two unrelated tabs share a
  // curve. Noise that was actually removed is the evidence that the title came
  // off a media page describing a track, so that case still gets one.
  if (!cleanArtist && collapse(rawTitle) === cleanTitle) {
    return undefined;
  }

  return `${cleanTitle}|${cleanArtist}`;
};

/** A media URL with its tracking cut off. The path identifies the page; the
 * query is a session, a timestamp and a referrer, and none of those are the
 * song. */
const trimMediaUrl = (url: string) => url.split('#')[0].split('?')[0];

export const buildSongIdentity = (
  source: TSongSource,
  exact: string,
  title: string,
  artist?: string,
): ISongIdentity | undefined => {
  const cleanTitle = title.trim();
  if (!cleanTitle) {
    // A session with no title is a player that registered and has nothing
    // loaded — the same rule `parseSystemMediaLine` already applies.
    return undefined;
  }

  const cleanArtist = artist?.trim() || undefined;

  const key = (() => {
    if (source === 'media') {
      return `media:${trimMediaUrl(exact)}`;
    }
    if (source === 'system') {
      // The app alone is not a song: Spotify is one session playing a
      // different track every three minutes. Collapsed rather than raw so a
      // republished title with different spacing is still the same key.
      return `system:${exact}:${collapse(cleanTitle)}:${collapse(cleanArtist ?? '')}`;
    }
    return `${source}:${exact}`;
  })();

  return {
    key,
    // Karaoke never gets one — see the module comment on the spec's §6.
    alias:
      source === 'karaoke'
        ? undefined
        : normalizeSongAlias(cleanTitle, cleanArtist),
    title: cleanTitle,
    artist: cleanArtist,
    source,
  };
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- songIdentity
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm typecheck && pnpm lint
```

Expected: both clean. Fix anything reported before committing.

- [ ] **Step 6: Commit**

```bash
git add src/common/songIdentity.ts src/__tests__/unit_tests/common/songIdentity.test.ts && git commit -m "A song is the same song, whoever happens to be playing it"
```

---

## Task 2: The store's shape

Spec §7. Pure module, no filesystem — every operation takes a settings object and returns a new one.

**Files:**

- Create: `src/common/songEq.ts`
- Test: `src/__tests__/unit_tests/common/songEq.test.ts`

**Interfaces:**

- Consumes: `ISongIdentity` from `common/songIdentity` (Task 1); `ISmartEqSettings` from `common/constants`.
- Produces:
  - `interface ISongEqEntry { settings: ISmartEqSettings; title: string; artist?: string; alias?: string; plays: number; updatedAt: number; }`
  - `interface ISongEqOutput { entries: Record<string, ISongEqEntry>; aliases: Record<string, string>; }`
  - `interface ISongEqSettings { version: 1; outputs: Record<string, ISongEqOutput>; }`
  - `const SONG_EQ_MAX_ENTRIES = 2000`
  - `getDefaultSongEqSettings(): ISongEqSettings`
  - `lookupSongEq(settings, deviceId: string, identity: ISongIdentity): ISongEqEntry | undefined`
  - `checkpointSongEq(settings, deviceId, identity, layer: ISmartEqSettings, now: number): ISongEqSettings`
  - `commitSongEq(settings, deviceId, identity, layer: ISmartEqSettings, now: number): ISongEqSettings`
  - `forgetSongEq(settings, deviceId: string, key: string): ISongEqSettings`
  - `stripSongEqLayer(layer: ISmartEqSettings): ISmartEqSettings`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/songEq.test.ts` with the GPL header, then:

```ts
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_MAX_ENTRIES,
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  getDefaultSongEqSettings,
  lookupSongEq,
  stripSongEqLayer,
} from 'common/songEq';

const DEVICE = 'device-a';

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const identityOf = (title: string, artist?: string): ISongIdentity => {
  const identity = buildSongIdentity('library', title, title, artist);
  if (!identity) {
    throw new Error('test fixture produced no identity');
  }
  return identity;
};

describe('songEq store', () => {
  it('finds nothing in an empty store', () => {
    expect(
      lookupSongEq(getDefaultSongEqSettings(), DEVICE, identityOf('Song')),
    ).toBeUndefined();
  });

  it('finds by exact key what commit put there', () => {
    // The positive control for the empty-store test above.
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(saved, DEVICE, identity)?.plays).toBe(1);
  });

  it('finds by alias what a different source saved', () => {
    const fromLibrary = identityOf('Black Dog', 'Led Zeppelin');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      fromLibrary,
      layerOf(3),
      1000,
    );
    const fromSpotify = buildSongIdentity(
      'system',
      'Spotify.exe',
      'Black Dog (Official Video)',
      'Led Zeppelin',
    );
    expect(fromSpotify).toBeDefined();
    expect(lookupSongEq(saved, DEVICE, fromSpotify!)?.title).toBe('Black Dog');
  });

  it('keeps outputs apart', () => {
    // A correction measured on headphones says nothing about speakers.
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(saved, 'device-b', identity)).toBeUndefined();
  });

  it('counts a play on commit and not on checkpoint', () => {
    const identity = identityOf('Song', 'Artist');
    let store = checkpointSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(0);
    store = commitSongEq(store, DEVICE, identity, layerOf(4), 2000);
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(1);
    store = checkpointSongEq(store, DEVICE, identity, layerOf(5), 3000);
    expect(lookupSongEq(store, DEVICE, identity)?.plays).toBe(1);
    expect(lookupSongEq(store, DEVICE, identity)?.updatedAt).toBe(3000);
  });

  it('strips apoOverride before storing', () => {
    // That field is a config file somebody hand-edited through Equalizer APO.
    // It belongs to that moment on that output, and replaying it onto another
    // song would write a manual edit into a track that never had one.
    const identity = identityOf('Song', 'Artist');
    const withOverride: ISmartEqSettings = {
      ...layerOf(3),
      apoOverride: { text: 'Preamp: -3 dB' },
    };
    const store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      withOverride,
      1000,
    );
    expect(
      lookupSongEq(store, DEVICE, identity)?.settings.apoOverride,
    ).toBeUndefined();
    expect(stripSongEqLayer(withOverride).apoOverride).toBeUndefined();
    // Positive control: the rest of the layer survived the strip.
    expect(stripSongEqLayer(withOverride).filters['smart-1000'].gain).toBe(3);
  });

  it('evicts the least recently saved at the cap', () => {
    let store = getDefaultSongEqSettings();
    for (let index = 0; index < SONG_EQ_MAX_ENTRIES; index += 1) {
      store = commitSongEq(
        store,
        DEVICE,
        identityOf(`Song ${index}`, 'Artist'),
        layerOf(1),
        1000 + index,
      );
    }
    expect(Object.keys(store.outputs[DEVICE].entries)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
    const oldest = identityOf('Song 0', 'Artist');
    store = commitSongEq(
      store,
      DEVICE,
      identityOf('One more', 'Artist'),
      layerOf(1),
      999_999,
    );
    expect(Object.keys(store.outputs[DEVICE].entries)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
    expect(lookupSongEq(store, DEVICE, oldest)).toBeUndefined();
    // Positive control: the newest survived, so eviction removed one entry
    // rather than emptying the output.
    expect(
      lookupSongEq(store, DEVICE, identityOf('One more', 'Artist')),
    ).toBeDefined();
  });

  it('drops an evicted entry alias with it', () => {
    let store = getDefaultSongEqSettings();
    for (let index = 0; index < SONG_EQ_MAX_ENTRIES + 1; index += 1) {
      store = commitSongEq(
        store,
        DEVICE,
        identityOf(`Song ${index}`, 'Artist'),
        layerOf(1),
        1000 + index,
      );
    }
    expect(Object.keys(store.outputs[DEVICE].aliases)).toHaveLength(
      SONG_EQ_MAX_ENTRIES,
    );
  });

  it('forgets an entry and the alias that points at it', () => {
    const identity = identityOf('Song', 'Artist');
    const saved = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      identity,
      layerOf(3),
      1000,
    );
    const forgotten = forgetSongEq(saved, DEVICE, identity.key);
    expect(lookupSongEq(forgotten, DEVICE, identity)).toBeUndefined();
    expect(Object.keys(forgotten.outputs[DEVICE].aliases)).toHaveLength(0);
  });

  it('leaves an alias alone when it has moved on to another key', () => {
    // Last save wins the alias. Forgetting the key that no longer owns it must
    // not take the live entry's alias away with it.
    const first = identityOf('Black Dog', 'Led Zeppelin');
    const second = buildSongIdentity(
      'media',
      'https://example.test/watch',
      'Black Dog',
      'Led Zeppelin',
    );
    expect(second).toBeDefined();
    let store = commitSongEq(
      getDefaultSongEqSettings(),
      DEVICE,
      first,
      layerOf(3),
      1000,
    );
    store = commitSongEq(store, DEVICE, second!, layerOf(4), 2000);
    store = forgetSongEq(store, DEVICE, first.key);
    expect(lookupSongEq(store, DEVICE, second!)).toBeDefined();
  });

  it('does not mutate the store it was given', () => {
    const before = getDefaultSongEqSettings();
    commitSongEq(
      before,
      DEVICE,
      identityOf('Song', 'Artist'),
      layerOf(3),
      1000,
    );
    expect(before.outputs[DEVICE]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- songEq
```

Expected: FAIL — `Cannot find module 'common/songEq'`.

- [ ] **Step 3: Write the implementation**

Create `src/common/songEq.ts` with the GPL header, then:

```ts
import { ISmartEqSettings } from './constants';
import { ISongIdentity } from './songIdentity';

/**
 * What the app remembers about a song, per output.
 *
 * Pure on purpose: every function here takes the whole settings object and
 * returns a new one. The eviction and the alias bookkeeping are where the bugs
 * in this feature will be, and they should be reachable from a unit test with
 * no filesystem in the way — `main/songEqStore.ts` is the half that touches
 * disk and it holds no rules.
 */
export interface ISongEqEntry {
  /** The saved layer. Never carries `apoOverride` — see `stripSongEqLayer`. */
  settings: ISmartEqSettings;
  title: string;
  artist?: string;
  alias?: string;
  /** Completed recordings of this song. Provenance, and all of it. */
  plays: number;
  /** Epoch ms of the last save. Also the eviction order. */
  updatedAt: number;
}

export interface ISongEqOutput {
  entries: Record<string, ISongEqEntry>;
  /** alias → entry key. One key per alias; the most recent save wins. */
  aliases: Record<string, string>;
}

export interface ISongEqSettings {
  version: 1;
  outputs: Record<string, ISongEqOutput>;
}

/**
 * The ceiling, per output, and the reason there is one.
 *
 * The file is rewritten on every song that reaches two minutes, so without a
 * cap a year of listening is a file that grows forever and is read at every
 * launch. At roughly a kilobyte an entry this is a couple of megabytes.
 */
export const SONG_EQ_MAX_ENTRIES = 2000;

export const getDefaultSongEqSettings = (): ISongEqSettings => ({
  version: 1,
  outputs: {},
});

/**
 * The layer as it may be stored.
 *
 * `apoOverride` is the exact contents of a config file the user hand-edited
 * through Equalizer APO. It belongs to that moment on that output; replaying it
 * onto another song would write somebody's manual edit into a track that never
 * had one.
 */
export const stripSongEqLayer = (layer: ISmartEqSettings): ISmartEqSettings => {
  const { apoOverride, ...rest } = layer;
  return rest;
};

const outputOf = (settings: ISongEqSettings, deviceId: string): ISongEqOutput =>
  settings.outputs[deviceId] ?? { entries: {}, aliases: {} };

export const lookupSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
): ISongEqEntry | undefined => {
  const output = settings.outputs[deviceId];
  if (!output) {
    return undefined;
  }
  // Exact first and always: your own file beats an alias that has drifted to a
  // rip of the same song.
  const exact = output.entries[identity.key];
  if (exact) {
    return exact;
  }
  if (!identity.alias) {
    return undefined;
  }
  const aliased = output.aliases[identity.alias];
  return aliased ? output.entries[aliased] : undefined;
};

/** Drop the lowest `updatedAt` entries until the output is inside the cap,
 * taking each one's alias with it. */
const evict = (output: ISongEqOutput): ISongEqOutput => {
  const keys = Object.keys(output.entries);
  if (keys.length <= SONG_EQ_MAX_ENTRIES) {
    return output;
  }
  const doomed = new Set(
    keys
      .sort((a, b) => output.entries[a].updatedAt - output.entries[b].updatedAt)
      .slice(0, keys.length - SONG_EQ_MAX_ENTRIES),
  );
  const entries: Record<string, ISongEqEntry> = {};
  keys.forEach((key) => {
    if (!doomed.has(key)) {
      entries[key] = output.entries[key];
    }
  });
  const aliases: Record<string, string> = {};
  Object.entries(output.aliases).forEach(([alias, key]) => {
    if (!doomed.has(key)) {
      aliases[alias] = key;
    }
  });
  return { entries, aliases };
};

const put = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
  playsDelta: number,
): ISongEqSettings => {
  const output = outputOf(settings, deviceId);
  const existing = output.entries[identity.key];
  const entry: ISongEqEntry = {
    settings: stripSongEqLayer(layer),
    title: identity.title,
    artist: identity.artist,
    alias: identity.alias,
    plays: (existing?.plays ?? 0) + playsDelta,
    updatedAt: now,
  };
  const next: ISongEqOutput = {
    entries: { ...output.entries, [identity.key]: entry },
    aliases: identity.alias
      ? { ...output.aliases, [identity.alias]: identity.key }
      : { ...output.aliases },
  };
  return {
    ...settings,
    outputs: { ...settings.outputs, [deviceId]: evict(next) },
  };
};

/**
 * Write what has been learned so far without counting it as a play.
 *
 * Sent the moment two minutes have been listened to, so the song survives the
 * app being killed, the machine sleeping or the window closing mid-track. The
 * commit that follows at the end of the song is what counts the play.
 */
export const checkpointSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
): ISongEqSettings => put(settings, deviceId, identity, layer, now, 0);

/** Write the finished curve and count the play. */
export const commitSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
  now: number,
): ISongEqSettings => put(settings, deviceId, identity, layer, now, 1);

export const forgetSongEq = (
  settings: ISongEqSettings,
  deviceId: string,
  key: string,
): ISongEqSettings => {
  const output = settings.outputs[deviceId];
  if (!output?.entries[key]) {
    return settings;
  }
  const entries = { ...output.entries };
  delete entries[key];
  const aliases: Record<string, string> = {};
  Object.entries(output.aliases).forEach(([alias, target]) => {
    // Only where it still points here. The alias moves to whichever key saved
    // last, and taking it from the live entry would be forgetting two songs.
    if (target !== key) {
      aliases[alias] = target;
    }
  });
  return {
    ...settings,
    outputs: { ...settings.outputs, [deviceId]: { entries, aliases } },
  };
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- songEq
```

Expected: PASS, 11 tests. If `ISmartEqSettings.apoOverride`'s type rejects `{ text: 'Preamp: -3 dB' }`, read `IApoLayerOverride` in `src/common/constants.ts` and fix the fixture to match — do not widen the type.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 6: Commit**

```bash
git add src/common/songEq.ts src/__tests__/unit_tests/common/songEq.test.ts && git commit -m "A shelf per output, and the oldest curve leaves when it is full"
```

---

## Task 3: The lifecycle reducer

Spec §8.1 and §8.2 and §9. Pure, clock-injected, no React and no IPC. This is the heart of the feature and the task most worth getting right.

**Files:**

- Create: `src/common/songEqRecorder.ts`
- Test: `src/__tests__/unit_tests/common/songEqRecorder.test.ts`

**Interfaces:**

- Consumes: `ISongIdentity` (Task 1), `ISongEqEntry` (Task 2), `ISmartEqSettings` from `common/constants`.
- Produces:
  - `const SONG_EQ_SETTLE_MS = 2_000`, `SONG_EQ_MIN_LISTENED_MS = 120_000`, `SONG_EQ_SUSPEND_GRACE_MS = 60_000`
  - `type TSongEqPhase = 'settling' | 'recording' | 'suspended'`
  - `interface ISongEqRecorderState`
  - `type TSongEqEvent`, `type TSongEqEffect`
  - `getInitialRecorderState(): ISongEqRecorderState`
  - `reduceSongEq(state, event, now): [ISongEqRecorderState, TSongEqEffect[]]`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/songEqRecorder.test.ts` with the GPL header, then:

```ts
import { FilterTypeEnum, ISmartEqSettings } from 'common/constants';
import { buildSongIdentity, ISongIdentity } from 'common/songIdentity';
import {
  SONG_EQ_MIN_LISTENED_MS,
  SONG_EQ_SETTLE_MS,
  SONG_EQ_SUSPEND_GRACE_MS,
  ISongEqRecorderState,
  TSongEqEffect,
  TSongEqEvent,
  getInitialRecorderState,
  reduceSongEq,
} from 'common/songEqRecorder';

const layerOf = (gain: number): ISmartEqSettings => ({
  filters: {
    'smart-1000': {
      id: 'smart-1000',
      frequency: 1000,
      gain,
      quality: 1.4,
      type: FilterTypeEnum.PK,
    },
  },
});

const songA = buildSongIdentity('library', 'a', 'Song A', 'Artist');
const songB = buildSongIdentity('library', 'b', 'Song B', 'Artist');
if (!songA || !songB) {
  throw new Error('test fixtures produced no identity');
}

/** Drive a list of events through the reducer, collecting every effect. */
const run = (
  start: ISongEqRecorderState,
  steps: Array<[number, TSongEqEvent]>,
): { state: ISongEqRecorderState; effects: TSongEqEffect[] } => {
  let state = start;
  const effects: TSongEqEffect[] = [];
  steps.forEach(([now, event]) => {
    const [next, produced] = reduceSongEq(state, event, now);
    state = next;
    effects.push(...produced);
  });
  return { state, effects };
};

const armed = (): ISongEqRecorderState => ({
  ...getInitialRecorderState(),
  deviceId: 'device-a',
  isSaveOn: true,
  liveLayer: layerOf(2),
});

/** Play `identity` for `ms`, ticking once a second, then stop. */
const play = (
  identity: ISongIdentity,
  ms: number,
  from = 0,
): Array<[number, TSongEqEvent]> => {
  const steps: Array<[number, TSongEqEvent]> = [
    [from, { kind: 'nowPlaying', identity, isPlaying: true }],
  ];
  for (let at = 1000; at <= ms; at += 1000) {
    steps.push([from + at, { kind: 'tick' }]);
  }
  return steps;
};

describe('songEqRecorder', () => {
  it('saves nothing for a song skipped after ninety seconds', () => {
    const { effects } = run(armed(), [
      ...play(songA, 90_000),
      [90_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
    expect(
      effects.filter((effect) => effect.kind === 'checkpoint'),
    ).toHaveLength(0);
  });

  it('saves a song played for over two minutes', () => {
    // THE POSITIVE CONTROL. Without it the test above passes against a reducer
    // that never saves anything, which is precisely how the separation packing
    // bug got through a perfect-looking null test.
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    const commits = effects.filter((effect) => effect.kind === 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ deviceId: 'device-a' });
  });

  it('checkpoints the moment two minutes are reached, before the song ends', () => {
    const { effects } = run(armed(), play(songA, 125_000));
    const checkpoints = effects.filter(
      (effect) => effect.kind === 'checkpoint',
    );
    expect(checkpoints).toHaveLength(1);
  });

  it('ignores a track that never settles', () => {
    // Clicking through a queue. Nothing is recorded and, more importantly,
    // nothing is applied — every match is a config write and a reload.
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [500, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
      [1000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      0,
    );
  });

  it('looks a song up once it has settled', () => {
    // Positive control for the test above.
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      1,
    );
  });

  it('does not count time while playback is stopped', () => {
    const steps: Array<[number, TSongEqEvent]> = [
      ...play(songA, 60_000),
      [60_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      // Half an hour paused.
      [1_860_000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [1_860_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ];
    const { effects } = run(armed(), steps);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
  });

  it('resumes a suspended session that comes back inside the grace', () => {
    const { state } = run(armed(), [
      ...play(songA, 60_000),
      [60_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [70_000, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
    ]);
    expect(state.session?.phase).toBe('recording');
    expect(state.session?.listenedMs).toBeGreaterThanOrEqual(60_000);
  });

  it('closes a session suspended past the grace', () => {
    const { state } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songA, isPlaying: false }],
      [130_002 + SONG_EQ_SUSPEND_GRACE_MS, { kind: 'tick' }],
    ]);
    expect(state.session).toBeUndefined();
  });

  it('applies a match and restores the previous layer at the end', () => {
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', entry }],
      [
        SONG_EQ_SETTLE_MS + 3,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
    ]);
    const applied = effects.filter((effect) => effect.kind === 'applyLayer');
    // Once to lend the saved curve, once to hand back what was there before.
    expect(applied).toHaveLength(2);
    expect(applied[0]).toMatchObject({ settings: entry.settings });
    expect(applied[1]).toMatchObject({ settings: layerOf(2) });
  });

  it('raises the notice on a match', () => {
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', entry }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'notice')).toHaveLength(
      1,
    );
  });

  it('drops the loan when something else writes the layer', () => {
    // A manual Smart EQ run, a preset load, a profile switch. Each is a
    // decision the user made, and this feature does not undo decisions.
    const entry = {
      settings: layerOf(9),
      title: 'Song A',
      plays: 1,
      updatedAt: 1,
    };
    const { effects } = run(armed(), [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
      [SONG_EQ_SETTLE_MS + 2, { kind: 'matched', entry }],
      [SONG_EQ_SETTLE_MS + 3, { kind: 'layerChanged', layer: layerOf(-4) }],
      [
        SONG_EQ_SETTLE_MS + 4,
        { kind: 'nowPlaying', identity: songB, isPlaying: true },
      ],
    ]);
    const applied = effects.filter((effect) => effect.kind === 'applyLayer');
    // Only the lend. Nothing was handed back.
    expect(applied).toHaveLength(1);
  });

  it('still saves a session whose loan was dropped', () => {
    // Dropping the loan stops the restore, not the save. A curve measured by
    // hand over a playing track is a better answer for that song.
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'layerChanged', layer: layerOf(-4) }],
      [130_002, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      1,
    );
  });

  it('records nothing while the tick is off', () => {
    const { effects } = run({ ...armed(), isSaveOn: false }, [
      ...play(songA, 130_000),
      [130_001, { kind: 'nowPlaying', identity: songB, isPlaying: true }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      0,
    );
  });

  it('still matches and applies while the tick is off', () => {
    // The tick governs recording only. Untick it and the app stops learning
    // new songs; it does not stop using the ones it knows.
    const { effects } = run({ ...armed(), isSaveOn: false }, [
      [0, { kind: 'nowPlaying', identity: songA, isPlaying: true }],
      [SONG_EQ_SETTLE_MS + 1, { kind: 'tick' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'lookup')).toHaveLength(
      1,
    );
  });

  it('commits under the output it was learned on when the device changes', () => {
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'deviceChanged', deviceId: 'device-b' }],
    ]);
    const commits = effects.filter((effect) => effect.kind === 'commit');
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({ deviceId: 'device-a' });
  });

  it('commits on the way out', () => {
    const { effects } = run(armed(), [
      ...play(songA, 130_000),
      [130_001, { kind: 'closing' }],
    ]);
    expect(effects.filter((effect) => effect.kind === 'commit')).toHaveLength(
      1,
    );
  });

  it('reaches exactly the threshold without saving, and one tick past it with', () => {
    const under = run(armed(), [
      ...play(songA, SONG_EQ_MIN_LISTENED_MS - 1000),
      [SONG_EQ_MIN_LISTENED_MS, { kind: 'closing' }],
    ]);
    expect(
      under.effects.filter((effect) => effect.kind === 'commit'),
    ).toHaveLength(0);

    const over = run(armed(), [
      ...play(songA, SONG_EQ_MIN_LISTENED_MS + 1000),
      [SONG_EQ_MIN_LISTENED_MS + 2000, { kind: 'closing' }],
    ]);
    expect(
      over.effects.filter((effect) => effect.kind === 'commit'),
    ).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- songEqRecorder
```

Expected: FAIL — `Cannot find module 'common/songEqRecorder'`.

- [ ] **Step 3: Write the implementation**

Create `src/common/songEqRecorder.ts` with the GPL header, then:

```ts
import { ISmartEqSettings } from './constants';
import { ISongEqEntry } from './songEq';
import { ISongIdentity } from './songIdentity';

/**
 * When a song starts being recorded, when it stops, and what happens in between.
 *
 * A pure reducer with the clock passed in, and that is the whole reason this
 * file exists apart from its shell. The two-minute floor, the settle, the
 * suspend grace and the loan are the four rules that decide whether this
 * feature is trustworthy, and none of them can be tested through a window, an
 * audio element or a real timer without the test becoming slower than the
 * behaviour it checks.
 *
 * `songEqSession.ts` in the renderer owns the subscriptions, the interval and
 * the performing of effects. It holds no rules.
 */

/**
 * How long an identity must hold still before anything happens.
 *
 * It gates the recording AND the match. Clicking through a queue would
 * otherwise open and close a session several times a second and — far more
 * expensively — rewrite the Equalizer APO config once per skipped track,
 * because every match is a write and a reload. Two seconds into a three-minute
 * song is nothing; two seconds of skipping is six config rewrites avoided.
 */
export const SONG_EQ_SETTLE_MS = 2_000;

/** How much has to have been *listened to* before a song is worth keeping.
 * Below this the user was browsing, and browsing should leave no trace. */
export const SONG_EQ_MIN_LISTENED_MS = 120_000;

/**
 * How long a stopped session waits before it is really over.
 *
 * Playback stopping is usually a pause. Closing on it would file a
 * half-learned curve and then raise a fresh notice on resume, so the same
 * identity returning inside this window picks the session back up with its
 * listened total and its loan intact.
 */
export const SONG_EQ_SUSPEND_GRACE_MS = 60_000;

export type TSongEqPhase = 'settling' | 'recording' | 'suspended';

export interface ISongEqSession {
  phase: TSongEqPhase;
  identity: ISongIdentity;
  /** Wall-clock ms accumulated while playing. Never derived from a reported
   * position: players republish those erratically and a seek would inflate it. */
  listenedMs: number;
  /** When the current playing run began; absent while not playing. */
  playingSince?: number;
  /** When `settling` began. */
  settlingSince: number;
  /** When `suspended` began. */
  suspendedSince?: number;
  /** Whether the two-minute checkpoint has already been written. */
  hasCheckpointed: boolean;
  /**
   * What the layer held before a match was applied, and whether there is one.
   *
   * `hasLoan` is separate from `loanLayer` because "there was no layer" is a
   * value worth restoring and is indistinguishable from "no loan" otherwise.
   */
  hasLoan: boolean;
  loanLayer?: ISmartEqSettings;
  /** The exact layer this recorder last put into the chain, so a write from
   * anywhere else is recognisable. */
  written?: ISmartEqSettings;
}

export interface ISongEqRecorderState {
  session?: ISongEqSession;
  deviceId: string;
  isSaveOn: boolean;
  /** The Smart EQ layer as it currently stands. */
  liveLayer?: ISmartEqSettings;
}

export type TSongEqEvent =
  | { kind: 'nowPlaying'; identity?: ISongIdentity; isPlaying: boolean }
  | { kind: 'tick' }
  | { kind: 'layerChanged'; layer?: ISmartEqSettings }
  | { kind: 'deviceChanged'; deviceId: string }
  | { kind: 'saveToggled'; isSaveOn: boolean }
  | { kind: 'matched'; entry?: ISongEqEntry }
  | { kind: 'undo' }
  | { kind: 'closing' };

export type TSongEqEffect =
  | { kind: 'lookup'; identity: ISongIdentity; deviceId: string }
  | { kind: 'applyLayer'; settings?: ISmartEqSettings }
  | {
      kind: 'checkpoint';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | {
      kind: 'commit';
      identity: ISongIdentity;
      deviceId: string;
      layer: ISmartEqSettings;
    }
  | { kind: 'notice'; identity: ISongIdentity; entry: ISongEqEntry };

export const getInitialRecorderState = (): ISongEqRecorderState => ({
  deviceId: '',
  isSaveOn: false,
});

/** Listened time including the run in progress. */
const listenedAt = (session: ISongEqSession, now: number) =>
  session.listenedMs +
  (session.playingSince === undefined ? 0 : now - session.playingSince);

/**
 * End a session: save it if it earned that, hand back the loan if it is still
 * ours, and produce the effects for both.
 *
 * The order is deliberate and load-bearing. Reversed, the refinement would be
 * read off a layer already put back to what preceded the song, and every
 * remembered curve would decay towards whatever was in the chain before it.
 */
const close = (
  state: ISongEqRecorderState,
  session: ISongEqSession,
  now: number,
  deviceId: string,
): TSongEqEffect[] => {
  const effects: TSongEqEffect[] = [];
  const listened = listenedAt(session, now);
  if (
    state.isSaveOn &&
    listened >= SONG_EQ_MIN_LISTENED_MS &&
    state.liveLayer
  ) {
    effects.push({
      kind: 'commit',
      identity: session.identity,
      deviceId,
      layer: state.liveLayer,
    });
  }
  if (session.hasLoan) {
    effects.push({ kind: 'applyLayer', settings: session.loanLayer });
  }
  return effects;
};

const open = (identity: ISongIdentity, now: number): ISongEqSession => ({
  phase: 'settling',
  identity,
  listenedMs: 0,
  playingSince: now,
  settlingSince: now,
  hasCheckpointed: false,
  hasLoan: false,
});

/** Settle, checkpoint and grace, all of which are time passing rather than
 * anything happening. Shared by `tick` and by every event, because an event
 * arriving is also a moment at which time has passed. */
const advance = (
  state: ISongEqRecorderState,
  now: number,
): [ISongEqRecorderState, TSongEqEffect[]] => {
  const session = state.session;
  if (!session) {
    return [state, []];
  }

  if (
    session.phase === 'settling' &&
    now - session.settlingSince >= SONG_EQ_SETTLE_MS
  ) {
    return [
      { ...state, session: { ...session, phase: 'recording' } },
      // The lookup happens whether or not the tick is on: the tick governs
      // recording, never using what is already known.
      [
        {
          kind: 'lookup',
          identity: session.identity,
          deviceId: state.deviceId,
        },
      ],
    ];
  }

  if (
    session.phase === 'suspended' &&
    session.suspendedSince !== undefined &&
    now - session.suspendedSince >= SONG_EQ_SUSPEND_GRACE_MS
  ) {
    return [
      { ...state, session: undefined },
      close(state, session, now, state.deviceId),
    ];
  }

  if (
    session.phase === 'recording' &&
    !session.hasCheckpointed &&
    state.isSaveOn &&
    state.liveLayer &&
    listenedAt(session, now) >= SONG_EQ_MIN_LISTENED_MS
  ) {
    return [
      { ...state, session: { ...session, hasCheckpointed: true } },
      [
        {
          kind: 'checkpoint',
          identity: session.identity,
          deviceId: state.deviceId,
          layer: state.liveLayer,
        },
      ],
    ];
  }

  return [state, []];
};

export const reduceSongEq = (
  input: ISongEqRecorderState,
  event: TSongEqEvent,
  now: number,
): [ISongEqRecorderState, TSongEqEffect[]] => {
  const [state, timed] = advance(input, now);
  const session = state.session;

  switch (event.kind) {
    case 'tick':
      return [state, timed];

    case 'saveToggled':
      return [{ ...state, isSaveOn: event.isSaveOn }, timed];

    case 'layerChanged': {
      const next = { ...state, liveLayer: event.layer };
      if (!session?.hasLoan) {
        return [next, timed];
      }
      // Ours if it is exactly what we last wrote. Anything else is a manual
      // run, a preset load or a profile switch, and the loan is off.
      const isOurs =
        session.written !== undefined &&
        JSON.stringify(session.written) === JSON.stringify(event.layer);
      if (isOurs) {
        return [next, timed];
      }
      return [
        {
          ...next,
          session: { ...session, hasLoan: false, loanLayer: undefined },
        },
        timed,
      ];
    }

    case 'matched': {
      if (!session || session.phase !== 'recording' || !event.entry) {
        return [state, timed];
      }
      return [
        {
          ...state,
          liveLayer: event.entry.settings,
          session: {
            ...session,
            hasLoan: true,
            loanLayer: state.liveLayer,
            written: event.entry.settings,
          },
        },
        [
          ...timed,
          { kind: 'applyLayer', settings: event.entry.settings },
          { kind: 'notice', identity: session.identity, entry: event.entry },
        ],
      ];
    }

    case 'undo': {
      if (!session?.hasLoan) {
        return [state, timed];
      }
      return [
        {
          ...state,
          liveLayer: session.loanLayer,
          session: { ...session, hasLoan: false, loanLayer: undefined },
        },
        [...timed, { kind: 'applyLayer', settings: session.loanLayer }],
      ];
    }

    case 'deviceChanged': {
      if (!session) {
        return [{ ...state, deviceId: event.deviceId }, timed];
      }
      // Committed under the OLD device: the curve was learned on that
      // transducer and belongs to it.
      return [
        { ...state, deviceId: event.deviceId, session: undefined },
        [...timed, ...close(state, session, now, state.deviceId)],
      ];
    }

    case 'closing': {
      if (!session) {
        return [state, timed];
      }
      return [
        { ...state, session: undefined },
        [...timed, ...close(state, session, now, state.deviceId)],
      ];
    }

    case 'nowPlaying': {
      const { identity, isPlaying } = event;

      if (!identity) {
        if (!session) {
          return [state, timed];
        }
        if (session.phase === 'settling') {
          return [{ ...state, session: undefined }, timed];
        }
        return [
          { ...state, session: undefined },
          [...timed, ...close(state, session, now, state.deviceId)],
        ];
      }

      if (session && session.identity.key === identity.key) {
        if (isPlaying) {
          return [
            {
              ...state,
              session: {
                ...session,
                phase: session.phase === 'settling' ? 'settling' : 'recording',
                playingSince: session.playingSince ?? now,
                suspendedSince: undefined,
              },
            },
            timed,
          ];
        }
        if (session.phase === 'settling') {
          return [{ ...state, session: undefined }, timed];
        }
        return [
          {
            ...state,
            session: {
              ...session,
              phase: 'suspended',
              listenedMs: listenedAt(session, now),
              playingSince: undefined,
              suspendedSince: session.suspendedSince ?? now,
            },
          },
          timed,
        ];
      }

      // A different song. Close the old one — unless it never settled, which
      // is somebody clicking through a queue and is worth nothing.
      const closing =
        session && session.phase !== 'settling'
          ? close(state, session, now, state.deviceId)
          : [];
      return [
        {
          ...state,
          session: isPlaying ? open(identity, now) : undefined,
          // The loan has been handed back by `close`, so what is live now is
          // whatever it restored.
          liveLayer:
            session?.hasLoan === true ? session.loanLayer : state.liveLayer,
        },
        [...timed, ...closing],
      ];
    }

    default:
      return [state, timed];
  }
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- songEqRecorder
```

Expected: PASS, 17 tests. If a timing test is off by one tick, fix the reducer's comparison rather than the test's numbers — the constants are fixed by the spec.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm typecheck && pnpm lint
```

The `JSON.stringify` comparison in `layerChanged` will draw an eslint complaint in some configs. If it does, do not silence it — extract a small `isSameLayer(a, b)` helper with a comment saying why a deep compare is the honest test here, and use that.

- [ ] **Step 6: Check the file length**

```bash
wc -l src/common/songEqRecorder.ts
```

Expected: under 500. If it is over, the seam is `advance` plus the three timing constants moving to `src/common/songEqTiming.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/common/songEqRecorder.ts src/__tests__/unit_tests/common/songEqRecorder.test.ts && git commit -m "Two minutes of listening, and a loan that is handed back"
```

---

## Task 4: Store on disk, and the four channels

Spec §7. The impure half — filesystem and IPC, no rules.

**Files:**

- Create: `src/main/songEqStore.ts`, `src/main/ipc/songEq.ts`
- Modify: `src/common/channels.ts` (add four members to `ChannelEnum`), `src/main/main.ts` (register the handlers where the other `ipc/*` registrars are called), `src/renderer/utils/equalizerApi.ts` (four wrappers)
- Test: `src/__tests__/unit_tests/main/songEqStore.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 1 and 2.
- Produces:
  - `loadSongEqSettings(userDataDir: string): ISongEqSettings`
  - `saveSongEqSettings(userDataDir: string, settings: ISongEqSettings): void`
  - `registerSongEqHandlers(userDataDir: string): void`
  - Renderer: `lookupSongEq(deviceId, identity): Promise<ISongEqEntry | undefined>`, `checkpointSongEq(deviceId, identity, layer): Promise<void>`, `commitSongEq(deviceId, identity, layer): Promise<void>`, `forgetSongEq(deviceId, key): Promise<void>` — all exported from `renderer/utils/equalizerApi`.
  - `ChannelEnum.LOOKUP_SONG_EQ = 'lookupSongEq'`, `CHECKPOINT_SONG_EQ = 'checkpointSongEq'`, `COMMIT_SONG_EQ = 'commitSongEq'`, `FORGET_SONG_EQ = 'forgetSongEq'`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/main/songEqStore.test.ts` with the GPL header. Model it on `src/__tests__/unit_tests/main/` neighbours — read one first to copy how they make a temp directory.

```ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import { getDefaultSongEqSettings } from 'common/songEq';
import { loadSongEqSettings, saveSongEqSettings } from 'main/songEqStore';

const tempDir = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-song-eq-'));

describe('songEqStore', () => {
  it('returns an empty store where there is no file', () => {
    expect(loadSongEqSettings(tempDir())).toEqual(getDefaultSongEqSettings());
  });

  it('reads back exactly what it wrote', () => {
    // Positive control for the test above: proves the empty result is a
    // missing file rather than a reader that always returns empty.
    const dir = tempDir();
    const settings = {
      ...getDefaultSongEqSettings(),
      outputs: {
        'device-a': {
          entries: {
            'library:x': {
              settings: { filters: {} },
              title: 'Song',
              plays: 2,
              updatedAt: 5,
            },
          },
          aliases: { 'song|artist': 'library:x' },
        },
      },
    };
    saveSongEqSettings(dir, settings);
    expect(loadSongEqSettings(dir)).toEqual(settings);
  });

  it('returns an empty store rather than throwing on a corrupt file', () => {
    // A half-written file after a power cut must not stop the app starting.
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'song-eq.json'), '{ not json', 'utf8');
    expect(loadSongEqSettings(dir)).toEqual(getDefaultSongEqSettings());
  });

  it('refuses a file from a future version', () => {
    const dir = tempDir();
    fs.writeFileSync(
      path.join(dir, 'song-eq.json'),
      JSON.stringify({ version: 99, outputs: {} }),
      'utf8',
    );
    expect(loadSongEqSettings(dir)).toEqual(getDefaultSongEqSettings());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- songEqStore
```

Expected: FAIL — `Cannot find module 'main/songEqStore'`.

- [ ] **Step 3: Write the store**

Create `src/main/songEqStore.ts` with the GPL header, then:

```ts
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { ISongEqSettings, getDefaultSongEqSettings } from '../common/songEq';

/**
 * Where remembered songs live. `device-profiles.json`'s neighbour, and read and
 * written the same way: one versioned JSON file in `userData`, no rules of its
 * own — everything that decides what goes in is in `common/songEq.ts`.
 */
const SETTINGS_FILENAME = 'song-eq.json';

export const loadSongEqSettings = (userDataDir: string): ISongEqSettings => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  try {
    const input: unknown = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (
      typeof input !== 'object' ||
      input === null ||
      (input as { version?: unknown }).version !== 1 ||
      typeof (input as { outputs?: unknown }).outputs !== 'object'
    ) {
      return getDefaultSongEqSettings();
    }
    return input as ISongEqSettings;
  } catch {
    // A missing file is the ordinary case at first launch, and a corrupt one
    // is a half-written file after a power cut. Neither is worth stopping the
    // app for: the worst it costs is a set of songs to learn again.
    return getDefaultSongEqSettings();
  }
};

export const saveSongEqSettings = (
  userDataDir: string,
  settings: ISongEqSettings,
): void => {
  const settingsPath = path.join(userDataDir, SETTINGS_FILENAME);
  const temporaryPath = `${settingsPath}.tmp`;
  try {
    // Written beside and renamed over, so a crash mid-write leaves the
    // previous file intact rather than a truncated one. This file is rewritten
    // on every song that reaches two minutes, so that window is not rare.
    fs.writeFileSync(temporaryPath, JSON.stringify(settings), 'utf8');
    fs.renameSync(temporaryPath, settingsPath);
  } catch (error) {
    log.error('Failed to save song EQ settings', error);
  }
};
```

- [ ] **Step 4: Run the store test to verify it passes**

```bash
pnpm test -- songEqStore
```

Expected: PASS, 4 tests.

- [ ] **Step 5: Add the four channels**

In `src/common/channels.ts`, after `SET_SMART_EQ`, add:

```ts
  // What this output remembers about a song. Read on every settled track, so
  // it is a lookup and not a snapshot of the whole store.
  LOOKUP_SONG_EQ = 'lookupSongEq',
  // Written the moment two minutes have been listened to, so the song survives
  // the app being killed mid-track. Does not count a play.
  CHECKPOINT_SONG_EQ = 'checkpointSongEq',
  // Written when the song ends. Counts the play.
  COMMIT_SONG_EQ = 'commitSongEq',
  FORGET_SONG_EQ = 'forgetSongEq',
```

- [ ] **Step 6: Write the handlers**

Create `src/main/ipc/songEq.ts` with the GPL header. Read `src/main/ipc/layers.ts` first to copy the exact `handleError` / response conventions this codebase uses — the shape below is right but the helper names must match what that file imports.

```ts
import { ipcMain } from 'electron';
import { ChannelEnum } from '../../common/channels';
import { ErrorCode } from '../../common/errors';
import {
  ISongEqSettings,
  checkpointSongEq,
  commitSongEq,
  forgetSongEq,
  lookupSongEq,
} from '../../common/songEq';
import { ISongIdentity } from '../../common/songIdentity';
import { loadSongEqSettings, saveSongEqSettings } from '../songEqStore';

/**
 * Held in memory between writes.
 *
 * The file is read once and rewritten whole. Re-reading it on every save would
 * be the safer-looking choice and is the wrong one here: nothing else on the
 * machine writes it, and a song ending is not a moment to spend on a disk read.
 */
let cached: ISongEqSettings | undefined;

const settingsOf = (userDataDir: string): ISongEqSettings => {
  if (!cached) {
    cached = loadSongEqSettings(userDataDir);
  }
  return cached;
};

const isIdentity = (value: unknown): value is ISongIdentity =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { key?: unknown }).key === 'string' &&
  typeof (value as { title?: unknown }).title === 'string';

export const registerSongEqHandlers = (userDataDir: string): void => {
  ipcMain.on(ChannelEnum.LOOKUP_SONG_EQ, (event, arg) => {
    const channel = ChannelEnum.LOOKUP_SONG_EQ;
    const deviceId = arg?.[0];
    const identity = arg?.[1];
    if (typeof deviceId !== 'string' || !isIdentity(identity)) {
      event.reply(channel, { errorCode: ErrorCode.INVALID_PARAMETER });
      return;
    }
    event.reply(channel, {
      result: lookupSongEq(settingsOf(userDataDir), deviceId, identity),
    });
  });

  const write = (
    channel: ChannelEnum,
    apply: typeof checkpointSongEq,
  ): void => {
    ipcMain.on(channel, (event, arg) => {
      const deviceId = arg?.[0];
      const identity = arg?.[1];
      const layer = arg?.[2];
      if (
        typeof deviceId !== 'string' ||
        !isIdentity(identity) ||
        typeof layer !== 'object' ||
        layer === null
      ) {
        event.reply(channel, { errorCode: ErrorCode.INVALID_PARAMETER });
        return;
      }
      cached = apply(
        settingsOf(userDataDir),
        deviceId,
        identity,
        layer,
        Date.now(),
      );
      saveSongEqSettings(userDataDir, cached);
      event.reply(channel, { result: 1 });
    });
  };

  write(ChannelEnum.CHECKPOINT_SONG_EQ, checkpointSongEq);
  write(ChannelEnum.COMMIT_SONG_EQ, commitSongEq);

  ipcMain.on(ChannelEnum.FORGET_SONG_EQ, (event, arg) => {
    const channel = ChannelEnum.FORGET_SONG_EQ;
    const deviceId = arg?.[0];
    const key = arg?.[1];
    if (typeof deviceId !== 'string' || typeof key !== 'string') {
      event.reply(channel, { errorCode: ErrorCode.INVALID_PARAMETER });
      return;
    }
    cached = forgetSongEq(settingsOf(userDataDir), deviceId, key);
    saveSongEqSettings(userDataDir, cached);
    event.reply(channel, { result: 1 });
  });
};
```

`write` takes a function rather than a flag on purpose — `checkpointSongEq` and `commitSongEq` have the same signature, so this shares the validation without a boolean deciding behaviour.

- [ ] **Step 7: Register the handlers**

In `src/main/main.ts`, find where the other `src/main/ipc/*` registrars are called (grep for a neighbouring `register` call from `./ipc/layers` or `./ipc/profiles`) and add `registerSongEqHandlers(userDataDir)` beside them. `userDataDir` is already in scope at `src/main/main.ts:808`.

- [ ] **Step 8: Add the renderer wrappers**

In `src/renderer/utils/equalizerApi.ts`, after `setSmartEq`, add — matching the surrounding JSDoc style exactly:

```ts
/**
 * What this output remembers about a song, if anything.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @returns { Promise<ISongEqEntry | undefined> } the saved curve, or nothing
 */
export const lookupSongEq = (
  deviceId: string,
  identity: ISongIdentity,
): Promise<ISongEqEntry | undefined> => {
  const channel = ChannelEnum.LOOKUP_SONG_EQ;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId, identity]);
  return promisifyResult(
    simpleResponseHandler<ISongEqEntry | undefined>(),
    channel,
  );
};

/**
 * Write what has been learned so far, without counting it as a play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what is playing
 * @param { ISmartEqSettings } layer - the correction as it stands
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const checkpointSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.CHECKPOINT_SONG_EQ;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId, identity, layer]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Write the finished curve and count the play.
 * @param { string } deviceId - the active output
 * @param { ISongIdentity } identity - what was playing
 * @param { ISmartEqSettings } layer - the correction as it ended
 * @returns { Promise<void> } exception if the payload is not a layer
 */
export const commitSongEq = (
  deviceId: string,
  identity: ISongIdentity,
  layer: ISmartEqSettings,
): Promise<void> => {
  const channel = ChannelEnum.COMMIT_SONG_EQ;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId, identity, layer]);
  return promisifyResult(setterResponseHandler, channel);
};

/**
 * Forget one song on one output.
 * @param { string } deviceId - the output to forget it on
 * @param { string } key - the identity key
 * @returns { Promise<void> } exception if the key is not a string
 */
export const forgetSongEq = (deviceId: string, key: string): Promise<void> => {
  const channel = ChannelEnum.FORGET_SONG_EQ;
  window.electron.ipcRenderer.sendMessage(channel, [deviceId, key]);
  return promisifyResult(setterResponseHandler, channel);
};
```

Add the imports for `ISongEqEntry` and `ISongIdentity` at the top of the file.

- [ ] **Step 9: Check the preload allowlist**

```bash
grep -n "validChannels\|ChannelEnum" src/main/preload.ts | head -20
```

If `preload.ts` keeps an explicit list of permitted channels, add the four. If it forwards every `ChannelEnum` member, nothing to do — confirm which and say so in the commit body.

- [ ] **Step 10: Verify the whole suite still passes**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green. A red suite here is a real regression, not a detour.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "The shelf gets a file, and four ways to reach it"
```

---

## Task 5: Identity on the transport, and the playing subject

Spec §4 and §6. No new behaviour — this makes identity available where the recorder can see it.

**Files:**

- Modify: `src/renderer/audio/transportSource.ts`, `src/renderer/library/player/LibraryPlayerContext.tsx:932`, `src/renderer/karaoke/KaraokeWorkspace.tsx:1469`, `src/renderer/video/VideoBrowser.tsx:531`, `src/renderer/audio/useSystemMediaSource.ts:127`
- Create: `src/renderer/audio/nowPlayingIdentity.ts`
- Test: `src/__tests__/unit_tests/renderer/nowPlayingIdentity.test.ts`

**Interfaces:**

- Consumes: `buildSongIdentity`, `ISongIdentity` (Task 1); the existing `ITransportSource` and `TPlaybackOwner`.
- Produces:
  - `ITransportSource.identity?: ISongIdentity`
  - `pickPlayingIdentity(sources, playingOwner): ISongIdentity | undefined` — exported for the test
  - `useNowPlayingIdentity(): ISongIdentity | undefined`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/renderer/nowPlayingIdentity.test.ts` with the GPL header, then:

```ts
import { buildSongIdentity } from 'common/songIdentity';
import type { ITransportSource } from 'renderer/audio/transportSource';
import { pickPlayingIdentity } from 'renderer/audio/nowPlayingIdentity';

const songA = buildSongIdentity('library', 'a', 'Song A', 'Artist');
const songB = buildSongIdentity('system', 'Spotify.exe', 'Song B', 'Artist');

const sourceOf = (
  owner: ITransportSource['owner'],
  isPlaying: boolean,
  identity = songA,
): ITransportSource => ({
  owner,
  title: 'Song',
  isPlaying,
  positionMs: 0,
  durationMs: 0,
  toggle: () => undefined,
  identity,
});

describe('pickPlayingIdentity', () => {
  it('is nothing when nothing is playing', () => {
    expect(
      pickPlayingIdentity({ library: sourceOf('library', false) }, undefined),
    ).toBeUndefined();
  });

  it('is the app player that holds playback', () => {
    // Positive control for the test above.
    expect(
      pickPlayingIdentity({ library: sourceOf('library', true) }, 'library'),
    ).toBe(songA);
  });

  it('is the machine's own player when nothing of ours holds playback', () => {
    expect(
      pickPlayingIdentity(
        { system: sourceOf('system', true, songB) },
        undefined,
      ),
    ).toBe(songB);
  });

  it('ignores the machine's player while one of ours is playing', () => {
    expect(
      pickPlayingIdentity(
        {
          library: sourceOf('library', true),
          system: sourceOf('system', true, songB),
        },
        'library',
      ),
    ).toBe(songA);
  });

  it('does not follow the tab, unlike the bar', () => {
    // The bar shows the last paused thing on a tab that is not a player. A
    // paused song is not being equalised, so this must not.
    expect(
      pickPlayingIdentity({ library: sourceOf('library', false) }, undefined),
    ).toBeUndefined();
  });

  it('is nothing for a source that published no identity', () => {
    const anonymous = { ...sourceOf('library', true), identity: undefined };
    expect(pickPlayingIdentity({ library: anonymous }, 'library')).toBeUndefined();
  });
});
```

Note: escape the apostrophes in the two `it(` titles — use double quotes for those strings.

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- nowPlayingIdentity
```

Expected: FAIL — module not found.

- [ ] **Step 3: Add the field to `ITransportSource`**

In `src/renderer/audio/transportSource.ts`, inside the interface, after `artworkUrl`:

```ts
  /**
   * What this is, for the app to remember it by.
   *
   * Optional because a source can honestly have none — a page with no title,
   * a player that registered and loaded nothing. Absent means this is not a
   * thing worth filing a correction under, and the recorder skips it.
   */
  identity?: ISongIdentity;
```

Add `import type { ISongIdentity } from '../../common/songIdentity';` at the top.

- [ ] **Step 4: Write the playing subject**

Create `src/renderer/audio/nowPlayingIdentity.ts` with the GPL header, then:

```ts
import { useSyncExternalStore } from 'react';
import type { ISongIdentity } from '../../common/songIdentity';
import { usePlaybackOwner } from './playbackOwner';
import type { TPlaybackOwner } from './playbackOwner';
import { useTransportSources } from './transportSource';
import type { ITransportSource } from './transportSource';

/**
 * What is ACTUALLY being equalised, which is not what the bar is showing.
 *
 * `pickTransportOwner` takes the current tab as an input, so with nothing
 * playing the bar shows the last paused thing and its subject changes as you
 * switch tabs. That is right for a bar — the resume button should follow you —
 * and wrong for a recorder: a paused song is not being equalised, and a song
 * would otherwise start being recorded because somebody opened the EQ page.
 *
 * So this is the first two clauses of that function and none of the rest: a
 * player of ours that holds playback, else the machine's own while it says it
 * is playing. One place rather than derived at each call site, so the recorder
 * and the badge on the bar cannot disagree about what is being recorded.
 */
export const pickPlayingIdentity = (
  sources: Partial<Record<TPlaybackOwner, ITransportSource>>,
  playingOwner: TPlaybackOwner | undefined,
): ISongIdentity | undefined => {
  if (playingOwner !== undefined) {
    return sources[playingOwner]?.identity;
  }
  if (sources.system?.isPlaying === true) {
    return sources.system.identity;
  }
  return undefined;
};

export const useNowPlayingIdentity = (): ISongIdentity | undefined => {
  const sources = useTransportSources();
  const playingOwner = usePlaybackOwner();
  return pickPlayingIdentity(sources, playingOwner);
};
```

Remove the unused `useSyncExternalStore` import if the hooks above cover it — they do, so delete that line.

- [ ] **Step 5: Publish an identity from each of the four sources**

Each publisher gains one field on the object it already passes to `setTransportSource`.

`src/renderer/library/player/LibraryPlayerContext.tsx:932` — the track is in scope:

```ts
      identity: buildSongIdentity(
        'library',
        track.id,
        track.title,
        track.artist,
      ),
```

`src/renderer/karaoke/KaraokeWorkspace.tsx:1469` — use whatever stable project or song id that scope already has; if there is only a file path, use it:

```ts
      identity: buildSongIdentity('karaoke', projectId, songTitle, songArtist),
```

`src/renderer/video/VideoBrowser.tsx:531` — the page URL and its title:

```ts
      identity: buildSongIdentity('media', pageUrl, pageTitle),
```

`src/renderer/audio/useSystemMediaSource.ts:127` — the snapshot has all three:

```ts
      identity: buildSongIdentity(
        'system',
        snapshot.app,
        snapshot.title,
        snapshot.artist,
      ),
```

Add `import { buildSongIdentity } from 'common/songIdentity';` (or the correct relative path for that file) to each. If a variable named above does not exist in that scope under that name, use the one that does — do not invent state to hold it.

- [ ] **Step 6: Run the test to verify it passes**

```bash
pnpm test -- nowPlayingIdentity
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Verify nothing else broke**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: green. `NowPlayingBar.test.tsx` and `LibraryPlayerContext.test.tsx` exercise these publishers, so a failure there is a real signal about the field being added wrongly.

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "Every player says what it is playing, not only that it is"
```

---

## Task 6: The recorder's shell

Spec §8 and §9. Subscriptions, the one-second timer, and performing the reducer's effects. No rules live here.

**Files:**

- Create: `src/renderer/audio/songEqSession.ts`
- Modify: `src/renderer/App.tsx` (mount the host hook)
- Test: `src/__tests__/unit_tests/renderer/songEqSession.test.tsx`

**Interfaces:**

- Consumes: Task 3's reducer and constants; Task 4's `lookupSongEq` / `checkpointSongEq` / `commitSongEq` / `forgetSongEq` from `renderer/utils/equalizerApi`; Task 5's `useNowPlayingIdentity`; `setSmartEq` from `renderer/utils/equalizerApi`; `smartEq` and `activeDeviceId` from `FluidEqContext`.
- Produces:
  - `useSongEqSessionHost(): void` — called once, from `App`
  - `useSongEqNotice(): { identity: ISongIdentity; entry: ISongEqEntry } | undefined`
  - `dismissSongEqNotice(): void`
  - `undoSongEqLoan(): void`
  - `forgetCurrentSongEq(): void`
  - `useSongEqRecording(): { isSaveOn: boolean; listenedMs: number; title?: string; willSave: boolean }` — what the tick and the badge draw
  - `setSongEqSaveOn(isSaveOn: boolean): void`, `getSongEqSaveOn(): boolean`, `useSongEqSaveOn(): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/renderer/songEqSession.test.tsx` with the GPL header. Read `src/__tests__/utils/mockFluidEqProvider.ts` first — it is how this codebase supplies `FluidEqContext` to a test.

```tsx
import { act, renderHook } from '@testing-library/react';
import { FilterTypeEnum } from 'common/constants';
import { SONG_EQ_SETTLE_MS } from 'common/songEqRecorder';
import * as api from 'renderer/utils/equalizerApi';
import {
  getSongEqSaveOn,
  setSongEqSaveOn,
  useSongEqNotice,
  useSongEqSessionHost,
} from 'renderer/audio/songEqSession';

jest.mock('renderer/utils/equalizerApi');

describe('songEqSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setSongEqSaveOn(false);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('remembers the tick across a remount', () => {
    setSongEqSaveOn(true);
    expect(getSongEqSaveOn()).toBe(true);
    setSongEqSaveOn(false);
    expect(getSongEqSaveOn()).toBe(false);
  });

  it('raises no notice for a song nothing is remembered about', async () => {
    (api.lookupSongEq as jest.Mock).mockResolvedValue(undefined);
    const { result } = renderHook(() => {
      useSongEqSessionHost();
      return useSongEqNotice();
    });
    await act(async () => {
      jest.advanceTimersByTime(SONG_EQ_SETTLE_MS + 1000);
    });
    expect(result.current).toBeUndefined();
  });
});
```

This test is deliberately thin: the shell's job is wiring, and the behaviour it wires is already covered by Task 3's seventeen reducer tests. Do not grow it into a second copy of those — if you find yourself wanting to, the logic has leaked out of the reducer and belongs back in it.

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- songEqSession
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the shell**

Create `src/renderer/audio/songEqSession.ts` with the GPL header. It holds: module-level `state` driven through `reduceSongEq`; a `Set` of listeners; a 1000 ms interval that dispatches `{ kind: 'tick' }`; a `useEffect` in `useSongEqSessionHost` that dispatches `nowPlaying`, `layerChanged`, `deviceChanged` as those inputs change; a `performEffects` function that maps each `TSongEqEffect` to its call:

| Effect       | Call                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `lookup`     | `lookupSongEq(deviceId, identity)` then dispatch `{ kind: 'matched', entry }` |
| `applyLayer` | `setSmartEq(settings)`                                                        |
| `checkpoint` | `checkpointSongEq(deviceId, identity, layer)`                                 |
| `commit`     | `commitSongEq(deviceId, identity, layer)`                                     |
| `notice`     | set the notice state and start the ~6 s fade timer                            |

The tick's own persistence mirrors `smartEqMode.ts` exactly — `localStorage` key `fluideq.songEq.save`, a `try`/`catch` around both reads and writes with a comment saying storage can be unavailable, and a `useSyncExternalStore` hook. Copy that file's shape rather than inventing one.

Two rules the shell must honour:

- **`window.addEventListener('beforeunload', …)` dispatches `{ kind: 'closing' }` — and nothing depends on it completing.** The two-minute checkpoint is the guarantee. Put that sentence in a comment above the listener, because the next person to read it will assume the opposite.
- **Ticking the save on starts the last continuous mode where none is running.** `setSongEqSaveOn(true)` calls `setSmartEqMode(getSmartEqMode())` when `isContinuousMode(getSmartEqMode())` is false, choosing `'detail'` — the mode `smartEqMode.ts` already migrates the old `'continuous'` setting to. Unticking leaves the mode running.

- [ ] **Step 4: Mount the host**

In `src/renderer/App.tsx`, call `useSongEqSessionHost()` in the same component that hosts the other always-on machinery. Grep for `useSystemMediaSource(` and put it beside that call — same lifetime, same reason.

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm test -- songEqSession
```

Expected: PASS, 2 tests.

- [ ] **Step 6: Verify and commit**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

```bash
git add -A && git commit -m "Something above the tabs that keeps listening while you look elsewhere"
```

---

## Task 7: Every string, in ten languages

Spec §11. Nothing renders yet — this exists so Tasks 8, 9 and 10 have keys to use and each locale file is touched once instead of three times.

**Files:**

- Create: `src/common/i18n/en/songEq.ts` and the same file under `de`, `es`, `fr`, `hi`, `it`, `ja`, `pt`, `ru`, `zh`
- Modify: all ten `src/common/i18n/<locale>/index.ts`

**Interfaces:**

- Produces the keys below. Later tasks use these exact names.

- [ ] **Step 1: Write the English dictionary**

Create `src/common/i18n/en/songEq.ts` with the GPL header, then:

```ts
/** Smart EQ song memory — the tick, its progress, and the notice. */
export default {
  'songEq.save': 'Save for this song',
  'songEq.saveAria': 'Remember the Smart EQ correction for whatever is playing',
  'songEq.waiting': 'Waiting for something to play',
  'songEq.listening': 'Learning — {remaining} to go',
  'songEq.willSave': 'Will save — {title}',
  'songEq.noticeTitle': 'Using saved EQ for this song',
  'songEq.noticeBody': '{title} — learned over {plays} plays',
  'songEq.noticeBodyOnce': '{title} — learned once',
  'songEq.undo': 'Undo',
  'songEq.forget': 'Forget this song',
  'songEq.badgeAria': 'Smart EQ is learning this song',
};
```

`{remaining}` is a duration; format it with whatever helper `NowPlayingBar.tsx` already exports for the transport's clock (`formatDuration`), so a locale never sees a raw millisecond count.

- [ ] **Step 2: Register it in the English index**

In `src/common/i18n/en/index.ts`, add `import songEq from './songEq';` beside the other imports and `...songEq,` inside the `en` object.

- [ ] **Step 3: Verify the coverage test now fails**

```bash
pnpm test -- i18n
```

Expected: FAIL — `getCoverage` for the nine other locales drops below 1. **This failure is the point of this step:** it proves the coverage test is actually watching, which is the positive control for the nine translations about to be added.

- [ ] **Step 4: Translate into the nine other locales**

Create `src/common/i18n/<locale>/songEq.ts` for `de`, `es`, `fr`, `hi`, `it`, `ja`, `pt`, `ru`, `zh` with the same eleven keys, and add the import and spread to each `src/common/i18n/<locale>/index.ts` exactly as Step 2 did. Keep `{remaining}`, `{title}` and `{plays}` intact in every one — a dropped placeholder renders as literal text.

- [ ] **Step 5: Verify coverage is back to 1**

```bash
pnpm test -- i18n
```

Expected: PASS. Every locale reports coverage 1.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Eleven things to say about a remembered song, in every language"
```

---

## Task 8: The tick

Spec §10.1.

**Files:**

- Modify: `src/renderer/MainContent.tsx` (after the `eq-mode` span, around line 830), `src/renderer/styles/` — the stylesheet that already holds `.eq-mode`
- Test: `src/__tests__/unit_tests/SongEqTick.test.tsx`

**Interfaces:**

- Consumes: `useSongEqSaveOn`, `setSongEqSaveOn`, `useSongEqRecording` (Task 6); the `songEq.*` keys (Task 7).

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/SongEqTick.test.tsx`. Read `src/__tests__/unit_tests/SmartEqModeSwitch.test.tsx` first — it renders this same toolbar and shows how the providers are supplied.

```tsx
import { fireEvent, screen } from '@testing-library/react';

describe('the save-for-this-song tick', () => {
  it('is off by default and turns on when pressed', () => {
    // Render MainContent the way SmartEqModeSwitch.test.tsx does.
    const tick = screen.getByRole('checkbox', {
      name: /remember the smart eq correction/i,
    });
    expect(tick).not.toBeChecked();
    fireEvent.click(tick);
    expect(tick).toBeChecked();
  });

  it('starts a continuous mode when it is ticked with none running', () => {
    // A chosen-but-idle state looks exactly like the thing being broken, which
    // is why smartEqMode.ts already works this way.
    // Assert via the mode button's label, as SmartEqModeSwitch.test.tsx does.
  });

  it('says what it is waiting for when nothing is playing', () => {
    expect(screen.getByText(/waiting for something to play/i)).toBeVisible();
  });
});
```

Fill in the render calls and the second test's assertion from the neighbouring test file — do not invent a provider helper that does not exist.

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- SongEqTick
```

Expected: FAIL — no matching checkbox.

- [ ] **Step 3: Add the tick**

In `src/renderer/MainContent.tsx`, immediately after the closing `</span>` of the `eq-mode` holder, add a checkbox row. Use the app's existing classes — **do not invent a style.** Read `getComputedStyle` in the live window if one misbehaves rather than reasoning about the cascade.

The label is the progress: `songEq.waiting` when there is no session, `songEq.listening` with the remaining time while under the threshold, `songEq.willSave` with the title once past it. That is what makes the two-minute floor a visible fact rather than a mystery about why nothing was saved.

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm test -- SongEqTick
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm typecheck && pnpm typecheck:styles && pnpm lint && pnpm test
```

```bash
git add -A && git commit -m "A tick that says how long it has been listening"
```

---

## Task 9: The notice

Spec §10.2.

**Files:**

- Create: `src/renderer/components/SongEqNotice.tsx`, `src/renderer/styles/SongEqNotice.scss`
- Modify: `src/renderer/App.tsx:1895` area (mount it beside `SpeechMemoryNotice`)
- Test: `src/__tests__/unit_tests/SongEqNotice.test.tsx`

**Interfaces:**

- Consumes: `useSongEqNotice`, `undoSongEqLoan`, `forgetCurrentSongEq`, `dismissSongEqNotice` (Task 6); the `songEq.notice*`, `songEq.undo`, `songEq.forget` keys (Task 7).

- [ ] **Step 1: Write the failing test**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import SongEqNotice from 'renderer/components/SongEqNotice';
import * as session from 'renderer/audio/songEqSession';

jest.mock('renderer/audio/songEqSession');

describe('SongEqNotice', () => {
  it('draws nothing when no song was matched', () => {
    (session.useSongEqNotice as jest.Mock).mockReturnValue(undefined);
    const { container } = render(<SongEqNotice />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the song it is using a saved curve for', () => {
    // Positive control for the test above.
    (session.useSongEqNotice as jest.Mock).mockReturnValue({
      identity: { key: 'library:a', title: 'Black Dog', source: 'library' },
      entry: {
        settings: { filters: {} },
        title: 'Black Dog',
        plays: 3,
        updatedAt: 1,
      },
    });
    render(<SongEqNotice />);
    expect(screen.getByText(/using saved eq for this song/i)).toBeVisible();
    expect(screen.getByText(/black dog/i)).toBeVisible();
  });

  it('offers undo and forget, both quiet', () => {
    // Emphasis follows recommendation, and the recommendation here is to do
    // nothing — which is what the auto-fade expresses. So neither button wears
    // the loud style.
    (session.useSongEqNotice as jest.Mock).mockReturnValue({
      identity: { key: 'library:a', title: 'Black Dog', source: 'library' },
      entry: {
        settings: { filters: {} },
        title: 'Black Dog',
        plays: 1,
        updatedAt: 1,
      },
    });
    render(<SongEqNotice />);
    const undo = screen.getByRole('button', { name: /undo/i });
    const forget = screen.getByRole('button', { name: /forget this song/i });
    expect(undo.className).toContain('subtle');
    expect(forget.className).toContain('subtle');
    fireEvent.click(undo);
    expect(session.undoSongEqLoan).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- SongEqNotice
```

- [ ] **Step 3: Write the component**

Model it on `src/renderer/components/SpeechMemoryNotice.tsx` — same `role="dialog"`, same `aria-labelledby` / `aria-describedby` pairing, same structure. Both buttons get `className="button small subtle"`. Use `songEq.noticeBodyOnce` when `entry.plays <= 1` and `songEq.noticeBody` otherwise, so no locale has to render "learned over 1 plays".

- [ ] **Step 4: Write the stylesheet**

Copy the shape of `SpeechMemoryNotice`'s styles. Do not invent colours — use the existing variables. Remember the project rule: **stylesheets go through the Write and Edit tools, never a shell-quoted script**, because `$primary-lighter` is silently corrupted by shell interpolation.

- [ ] **Step 5: Mount it**

In `src/renderer/App.tsx`, add `<SongEqNotice />` beside `<SpeechMemoryNotice />` at line ~1895, and its import beside line 105.

- [ ] **Step 6: Run the test and the suite**

```bash
pnpm test -- SongEqNotice
```

```bash
pnpm typecheck && pnpm typecheck:styles && pnpm lint && pnpm test
```

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "It says which song it recognised, and offers to stop"
```

---

## Task 10: The badge on the bar

Spec §10.1, last paragraph.

**Files:**

- Modify: `src/renderer/library/player/NowPlayingBar.tsx`, `src/renderer/library/player/SourceTransportBar.tsx`
- Test: extend `src/__tests__/unit_tests/NowPlayingBar.test.tsx`

**Interfaces:**

- Consumes: `useSongEqRecording` (Task 6); `songEq.badgeAria` (Task 7).

- [ ] **Step 1: Write the failing test**

Add to `src/__tests__/unit_tests/NowPlayingBar.test.tsx`:

```tsx
it('shows no learning badge while the tick is off', () => {
  // Render the bar with useSongEqRecording mocked to { isSaveOn: false }.
  expect(screen.queryByLabelText(/smart eq is learning this song/i)).toBeNull();
});

it('shows the learning badge while a song is being recorded', () => {
  // Positive control. Render with { isSaveOn: true, listenedMs: 30_000 }.
  expect(
    screen.getByLabelText(/smart eq is learning this song/i),
  ).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm test -- NowPlayingBar
```

- [ ] **Step 3: Add the badge to both bars**

A compact element carrying `aria-label={t('songEq.badgeAria')}` and the same three states the tick shows. **`IdleTransportBar` does not get one** — it is the bar for having nothing loaded, and there is nothing to record.

Keep each addition small. If either file would grow by more than ~20 lines, stop and raise it rather than pushing an already-oversized file further.

- [ ] **Step 4: Run the test and the full suite**

```bash
pnpm test -- NowPlayingBar
```

```bash
pnpm typecheck && pnpm typecheck:styles && pnpm lint && pnpm test
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "The bar says it is listening, on whichever tab you are on"
```

---

## Task 11: Visual verification

**CLAUDE.md's rule, and the reason this task exists:** every UI defect that shipped this project passed the whole suite. Tests query by role; they cannot see size, colour, placement or taste. "Compiles and tests pass" is not a UI verdict.

**This task is Ivan's, not the executor's.** Do not run the app. Prepare the list, hand it over, and say plainly what has and has not been verified.

- [ ] **Step 1: Run everything once more**

```bash
pnpm build && pnpm typecheck && pnpm typecheck:styles && pnpm lint && pnpm test
```

- [ ] **Step 2: Write the handover**

State explicitly: the reducer's seventeen cases, the store's eleven, identity's nine and the store file's four are covered by tests; **nothing about how any of it looks, and nothing about real SMTC titles, has been verified.** Then list what needs a real launch, from spec §14:

1. **The tick's placement and emphasis** in the EQ toolbar — is it legible as a Smart EQ setting rather than a fourth mode?
2. **The notice** — does it read as informational, are both buttons quiet, does the ~6 s fade feel right?
3. **The badge** on both bars at both sizes, and confirmed absent on `IdleTransportBar`.
4. **Real SMTC titles.** Play the same song from Spotify, a YouTube tab in Chrome, and the library, and check that all three land on one alias. This is the judgement call the closed noise list in §6.1 cannot make for itself.
5. **A gapless album** — do two tracks that change with no stop between them each get their own session?
6. **The two-minute floor** — skip through five tracks, confirm `song-eq.json` gains nothing; then play one through and confirm it gains exactly one entry.

- [ ] **Step 3: Do not commit anything here.** This task produces a message, not a change.

---

## Self-Review

**Spec coverage.** §4 → Task 5. §5 → the whole plan. §6, §6.1 → Task 1. §7 → Tasks 2 and 4. §8, §8.1, §8.2 → Task 3 (rules) and Task 6 (shell). §9 → Task 3's loan tests and Task 6's effect table. §10.1 → Tasks 8 and 10. §10.2 → Task 9. §11 → Task 7. §12 → the File Structure section. §13 → the tests inside each task. §14 → Task 11. §15 is explicitly out of scope and has no task, correctly.

**One gap found and closed:** §7's "Forget removes the entry, and removes the alias entry only where it still points at that key" had a store function in Task 2 but no path from the notice to it. Task 6's `forgetCurrentSongEq` and Task 9's Forget button now carry it end to end.

**Type consistency.** `ISongIdentity`, `ISongEqEntry`, `ISongEqSettings`, `ISongEqOutput`, `TSongEqEvent`, `TSongEqEffect`, `ISongEqRecorderState` are each defined once and referenced by the same name everywhere after. `checkpointSongEq` and `commitSongEq` keep the same names in `common/songEq.ts`, in the IPC handlers and in the renderer wrappers — the renderer's are thin wrappers around channels of the same name, which is deliberate and worth noticing when reading Task 4.

**Known soft spots, flagged rather than hidden.** Task 5 Step 5 names variables (`projectId`, `songTitle`, `pageUrl`, `pageTitle`) that may not exist under those names in `KaraokeWorkspace.tsx` and `VideoBrowser.tsx`; the step says to use whatever that scope actually has. Task 8's test and Task 10's test are sketched against neighbouring test files rather than written out in full, because the provider setup in this codebase is non-obvious and copying the real one beats inventing a plausible one.
