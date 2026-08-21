# Smart EQ song memory — design

A tick beside the Smart EQ button. While it is on, whatever is actually
playing gets its Smart EQ correction recorded, and when the track ends the
curve is filed under that track's identity. Play the same thing again — from
the library, from a page in the Media tab, or from Spotify through the system
mixer — and the curve comes back on its own, with a notice saying so.

Date: 2026-08-21. Branch: `claude/smart-eq-auto-save-9af3cd`.

## 1. Why this exists

Smart EQ's continuous modes spend a couple of minutes learning what is wrong
with the sound, and then throw the answer away. Every play of the same record
starts from nothing and re-learns the same correction, which is both a waste
of the two minutes and a reason not to leave the mode on: the thing it knows
is only ever as old as the current track.

The correction is genuinely about the record, though. The capture subtracts
the chain — the user's bands, the voicing, the driver — so what is left is a
claim about the material, and a claim about the material is worth keeping. A
song that needed 3 dB out of 200 Hz last week needs it again this week.

## 2. Scope

**In:** a save tick in the Smart EQ toolbar; an identity for whatever is
playing, across all four transport sources; an on-disk store keyed by output
device and song; a record lifecycle with a two-minute floor; automatic
re-application on a match, with a notice; Undo and Forget on that notice.

**Out, deliberately:** a browsable list of remembered songs (Forget on the
notice is the only removal in v1 — see §13); import/export of the store;
sharing a song curve between machines; per-album or per-artist memory;
remembering anything other than the Smart EQ layer.

## 3. Decisions already taken

| Question             | Decision                                                                          |
| -------------------- | --------------------------------------------------------------------------------- |
| Identity             | Exact source-scoped key, plus a conservative title+artist alias for cross-source  |
| The two-minute floor | Time actually listened, not the track's reported length                           |
| Scope                | Per output device, keyed by `deviceId` — the same key `device-profiles.json` uses |
| On a match           | Apply it, then show the notice                                                    |
| What is stored       | The Smart EQ layer only — never the bands, voicing, driver or preamp              |
| Tick with no engine  | Ticking it starts the last continuous mode, as `setSmartEqMode` already does      |
| End of song          | Restore whatever the layer held before the match, after saving the refinement     |
| A remembered song    | Keeps refining and overwrites; `plays` and `updatedAt` are its whole provenance   |

## 4. What the subject actually is

`pickTransportOwner` takes the current tab as an input, so with nothing playing
the bar shows the last paused thing and its subject changes as you switch tabs.
That is right for a bar — the resume button should follow you — and wrong for
this: a paused song is not being equalised.

The recorder's subject is narrower and tab-independent: **the source that is
actually playing.** That is `playingOwner` where one of this app's players
holds it, or `sources.system` while its own `isPlaying` is true — the first two
clauses of `pickTransportOwner` and none of the rest. It lives in
`nowPlayingIdentity.ts` rather than being derived at each call site, so the
recorder and the badge cannot disagree about what is being recorded.

## 5. Architecture

```
 four players ──setTransportSource({..., identity})──▶ transportSource
                                                            │
                                              nowPlayingIdentity (playing only)
                                                            │
                                                            ▼
                    ┌──────────────── songEqRecorder (module store) ────────────┐
                    │  pure reducer: (state, event, now) → [state, effects[]]   │
                    │  idle → settling → recording → suspended → closed         │
                    └───┬─────────────────────┬──────────────────────┬──────────┘
       lookup / save    │                     │ setSmartEq           │ notice
                        ▼                     ▼                      ▼
              IPC ─▶ songEqStore        equalizerApi          SongEqNotice
                     (main, fs)         (existing IPC)        (app root)
                        │
                   song-eq.json  ──▶  common/songEq.ts (pure: lookup, insert, evict)
```

Two pure modules carry the logic that is worth testing — `songEq.ts` for the
store's shape and `songEqRecorder`'s reducer for the lifecycle — and the
impure shells around them do nothing but fs, IPC and React.

## 6. Identity — `src/common/songIdentity.ts`

`ITransportSource` is already the one seam all four players publish through, so
identity is one optional field on it rather than a fifth mechanism:

```ts
export interface ISongIdentity {
  /** Exact, source-scoped. Never collides across sources. */
  key: string;
  /** Normalised `title|artist`. Absent where an alias would be a lie. */
  alias?: string;
  title: string;
  artist?: string;
  source: TPlaybackOwner;
}
```

| Source    | `key`                             | Alias?    | Why                                                |
| --------- | --------------------------------- | --------- | -------------------------------------------------- |
| `library` | `library:<track.id>`              | eligible  | `track.id` is already a stable hash of the path    |
| `media`   | `media:<url, query and hash cut>` | eligible  | A YouTube watch URL is stable; its tracking is not |
| `system`  | `system:<app>:<title>:<artist>`   | eligible  | All Windows publishes; the app keeps players apart |
| `karaoke` | `karaoke:<project id>`            | **never** | The mix has the vocals pulled out — see below      |

_Eligible_ rather than _yes_: the three eligible sources still produce no alias
where §6.1's rule says one would be a lie, which in practice will be most Media
tab pages.

**Karaoke gets no alias on purpose.** A karaoke session is the same song with
its vocals separated out, which is a different spectrum in the range the
correction cares most about. A curve learned there is not a curve for the
record, and letting the two share an alias would quietly apply one to the
other.

### 6.1 Alias normalisation is deliberately conservative

Lowercase, collapse whitespace, strip punctuation that carries no meaning, and
remove a **closed list** of platform noise only:

```
(official video) (official audio) (official music video) (official lyric video)
(lyrics) (lyric video) (audio) (visualizer) (visualiser) (mv) [4k] (4k)
(hd) (hq) (full song) — and a trailing  feat. / ft. / featuring  clause
```

It does **not** strip brackets in general, and that is the whole point of the
list existing. `(Remastered 2011)`, `(Live at Wembley)`, `(Acoustic)`,
`(Radio Edit)` are different recordings that want different corrections; a
blanket bracket strip would merge a remaster with its original and a live take
with the studio cut, and the merge would be silent.

**No alias is produced** when the artist is empty _and_ normalisation left the
title unchanged. That combination is a page title, not a song — it is what a
podcast, a livestream or a browser tab playing a video essay looks like, and
giving it an alias would let two unrelated pages share a curve.

## 7. Store — `song-eq.json`

Main-owned, in `userData`, versioned, read and written the way
`device-profiles.json` is. Shape:

```ts
export interface ISongEqEntry {
  /** The saved layer: filters, intensity, status, low/highFrequency. */
  settings: ISmartEqSettings;
  title: string;
  artist?: string;
  alias?: string;
  /** How many times this song has been recorded to completion. */
  plays: number;
  /** Epoch ms of the last save. Also the eviction order. */
  updatedAt: number;
}

export interface ISongEqSettings {
  version: 1;
  outputs: Record<
    string,
    {
      entries: Record<string, ISongEqEntry>; // by identity key
      aliases: Record<string, string>; // alias → identity key
    }
  >;
}
```

- **`apoOverride` is stripped before saving.** That field is the exact contents
  of a config file the user hand-edited through Equalizer APO. It belongs to
  that moment on that output, and replaying it onto another song would write
  somebody's manual edit into a track that never had one.
- **Per output at the top level**, keyed by `deviceId` — verified as the key
  `deviceProfiles.assignments` uses (`deviceProfiles.ts:113`), and the same id
  the renderer holds as `activeDeviceId`.
- **Capped at 2000 entries per output**, evicting the lowest `updatedAt` when a
  save would exceed it. At roughly 1 KB an entry that is a couple of megabytes
  per output, and the cap is what stops a file that is rewritten on every song
  from growing without a ceiling.
- **The alias index holds one key per alias**, most recent save wins. Lookup
  tries the exact key first and always, so your own file beats an alias that
  drifted to a YouTube rip of the same song.
- **Forget** removes the entry, and removes the alias entry only where it still
  points at that key.

Split as `src/common/songEq.ts` (pure — lookup, insert, evict, forget, alias
maintenance) and `src/main/songEqStore.ts` (fs, IPC, atomic write). Eviction
and alias maintenance are where the bugs will be, and they should be reachable
from a unit test with no filesystem in the way.

## 8. The recorder — `src/renderer/audio/songEqRecorder.ts`

A module store, not a component, for the reason `smartEqRun.ts` is one: a
recording must not end because somebody looked at another tab.

Its logic is a **pure reducer** — `(state, event, now) => [state, effects[]]`
— with the impure shell subscribing to `nowPlayingIdentity`, holding the timer,
and performing the effects. That is what makes the two-minute rule, the
settle, the suspend and the loan testable with a fake clock and no audio.

### 8.1 States

| From        | On                                     | To          |
| ----------- | -------------------------------------- | ----------- |
| `idle`      | an identity appears and is playing     | `settling`  |
| `settling`  | 2 s elapsed, still the same identity   | `recording` |
| `settling`  | identity changed or stopped            | `idle`      |
| `recording` | playback stopped                       | `suspended` |
| `recording` | identity changed, device changed, quit | `closed`    |
| `suspended` | the same identity returns within 60 s  | `recording` |
| `suspended` | 60 s elapsed, or identity changed      | `closed`    |
| `closed`    | (always, immediately)                  | `idle`      |

- **`settling` is a 2-second debounce**, and it gates _both_ the recording and
  the match. Clicking through a queue would otherwise open and close a session
  several times a second, and — more expensively — rewrite the APO config once
  per skipped track, because every match is a config write and a reload. Two
  seconds into a three-minute song is nothing; two seconds of skipping is six
  config rewrites avoided.
- **Listened time is wall-clock accumulated while `isPlaying` is true**, counted
  from the first playing observation of that identity — _not_ derived from
  `positionMs`. SMTC republishes position erratically and a seek would inflate a
  position-derived total; wall-clock also makes a pause-and-resume free.
- **`suspended` is not a close and does not write.** Playback stopping is
  usually a pause, and closing on it would file a half-learned curve and then
  raise a fresh notice on resume. The same identity returning within 60s resumes
  the session with its listened total and its loan intact.
- **A close writes only if listened ≥ 120 000 ms.** Below that the session is
  discarded in silence — no store write, no notice, nothing said. That is the
  browsing case and it should leave no trace.

### 8.2 When the curve is written

Twice per song, and not on a timer:

1. **The moment listened crosses 2:00**, the current layer is written. That is
   what makes the song remembered even if the app is killed, the machine sleeps
   or the window is closed mid-track.
2. **At close**, the refined layer overwrites it and `plays` is incremented.

A quit does attempt a close, and that close is best-effort by design: the
checkpoint above is the guarantee, so the worst a lost quit-time write costs is
the refinement between 2:00 and the moment the window went. Nothing in this
design may depend on a `beforeunload` completing, because that is a race this
process cannot win reliably and the failure would be silent.

An output device change closes the session and writes under the **old**
`deviceId`, then opens a new session against the new device's memory. The curve
was learned on the old transducer and belongs to it.

## 9. Match, loan, restore

**The tick does not gate this half.** Matching, applying and the notice happen
whenever a remembered song plays, tick on or off, and whether or not any Smart
EQ mode is running — applying a saved layer is a write to the chain and needs no
engine behind it. The tick governs only whether what is playing gets _recorded_.
Read the other way: unticking it stops the app learning new songs and does not
stop it using the ones it knows.

On a settled identity that is playing: exact `key` for the current output,
else `alias` for the current output, else nothing.

On a hit:

1. Snapshot the live Smart EQ layer into the loan — including the case where it
   is empty, which is a value and not an absence.
2. Apply the saved layer through the existing `setSmartEq`.
3. Raise the notice.

At close, **in this order**: save the refinement, then restore the snapshot.
Reversed, the refinement would be read back off a layer that had already been
put back to what preceded it, and every remembered song would slowly decay
towards whatever was in the chain before it.

**The loan is dropped — nothing restored — the moment the Smart EQ layer
changes to something the recorder did not write.** A manual Smart EQ run, a
preset load, a device profile switch: each of those is a decision the user
made, and this feature does not undo decisions. Continuous-mode writes that the
recorder itself caused are accounted for, so refinement never breaks the loan.

Dropping the loan stops the **restore**, not the **save**. A session whose loan
was dropped still files its curve at close if the tick is on and it passed 2:00
— including the manually-measured one, which is a better answer for that song
than the one it replaced, and is exactly what somebody who ran the measurement
by hand over a playing track was asking for.

## 10. UI

### 10.1 The tick

In the EQ toolbar beside the Smart EQ button, in the row the mode caret already
occupies (`MainContent.tsx:805`). Not a fourth entry in the mode menu — it is a
setting of the Smart EQ family, not another way of measuring. Persisted in
`localStorage` alongside the mode, because it is a way of working rather than a
moment's choice.

Ticking it starts the last continuous mode where none is running, by the rule
`setSmartEqMode` already lives by: a chosen-but-idle state looks exactly like
the thing being broken. Where no continuous mode has ever been chosen it starts
`detail`, which is the one that fits a curve to the record and is what
`smartEqMode.ts` already migrates the old single `continuous` setting to.
Unticking it leaves the mode running — stopping the engine because somebody
stopped saving would be taking away something they did not ask to lose.

**The tick is also the progress.** While a song is being recorded its line
counts toward 2:00, and past the threshold it reads _will save — «title»_. Two
reasons: any long-running action has to show progress from its first second,
and — more usefully — it makes the two-minute floor a visible fact rather than
a mystery about why nothing was saved.

A compact badge on the now-playing bar mirrors the same three states (armed,
recording with its count, will-save), so the state is legible from every tab
and not only from the EQ page. It goes on `NowPlayingBar` and
`SourceTransportBar` — the two bars that draw something that is playing — and
**not** on `IdleTransportBar`, which is the bar for having nothing loaded and
therefore nothing to record.

### 10.2 The notice — `SongEqNotice.tsx`

At the app root, beside `SpeechMemoryNotice` and for the same reason: it has to
follow the user off whichever tab they are on when the song starts.

Cover art, **Using saved EQ for this song**, the title, and two buttons:
`Undo` — drop the loan and restore now — and `Forget this song`. Both wear
`button small subtle`. Neither is the recommendation; doing nothing is, and
that is what the ~6-second auto-fade expresses. The loan itself outlives the
notice.

## 11. i18n

One new namespace, `src/common/i18n/<locale>/songEq.ts`, in all ten locales in
the same commit. Roughly a dozen strings: the tick label and its three states,
the notice title and its two buttons, and the count-up line. The count-up
interpolates a duration, which every locale already formats through the same
helper the transport bar uses.

## 12. Files

**New (8)**

| File                                       | Holds                                      |
| ------------------------------------------ | ------------------------------------------ |
| `src/common/songIdentity.ts`               | `ISongIdentity`, per-source keys, alias    |
| `src/common/songEq.ts`                     | Store shape; lookup, insert, evict, forget |
| `src/main/songEqStore.ts`                  | `song-eq.json` read/write                  |
| `src/main/ipc/songEq.ts`                   | Channels                                   |
| `src/renderer/audio/nowPlayingIdentity.ts` | The playing subject (§4)                   |
| `src/renderer/audio/songEqRecorder.ts`     | Reducer + shell                            |
| `src/renderer/components/SongEqNotice.tsx` | The notice                                 |
| `src/renderer/styles/SongEqNotice.scss`    | Its styles                                 |

Plus **ten new i18n namespace files**, `src/common/i18n/<locale>/songEq.ts` —
18 new files in total.

**Modified (22)** — `transportSource.ts` (one `identity` field) and its four
publishers: `LibraryPlayerContext.tsx`, `KaraokeWorkspace.tsx`,
`VideoBrowser.tsx`, `useSystemMediaSource.ts`; `MainContent.tsx` for the tick;
`App.tsx` to mount the notice and host the recorder; `channels.ts`, `api.ts`
and `preload.ts` for the IPC; `NowPlayingBar.tsx` and `SourceTransportBar.tsx`
for the badge; and ten `src/common/i18n/<locale>/index.ts` to register the
namespace.

`LibraryPlayerContext.tsx` is already 1015 lines and `NowPlayingBar.tsx` 796,
both against a 500-line rule. Neither is split by this branch — the change to
each is a handful of lines and splitting them is a separate piece of work with
its own risk — but the plan should note them rather than let the additions pass
unremarked.

## 13. Testing

The two pure modules carry the suite:

- **Alias normalisation** — a table of real dirty titles (`Song (Official Video)
[4K]`, `Song (Remastered 2011)`, `Song - Topic`, a bare page title) asserting
  which collapse together and, importantly, **which must not**: the remaster and
  the original are separate rows in that table.
- **Store** — insert, alias maintenance across a rename, eviction at the cap in
  `updatedAt` order, forget removing an alias only when it still points at the
  forgotten key.
- **Reducer** — the state machine under a fake clock: settle, listen, suspend,
  resume within 60s, resume after 60s, device change mid-song, close under and
  over the threshold.

**Every null test gets its positive control in the same file.** A 90-second
play that saves nothing is indistinguishable from a reducer that saves nothing
ever, so it sits directly beside a 130-second play that does save — and the two
are driven by the same reducer through the same helper. This is the shape the
separation packing bug used to pass a perfect-looking null test by returning
zero for every input.

UI tests query by role and can confirm the notice appears, its two buttons act,
and the tick starts a continuous mode. They cannot confirm placement, size or
emphasis; §14 says what that costs.

## 14. Risks, and what only a real launch can confirm

- **SMTC title quality varies per app.** The closed list in §6.1 is written from
  what Chrome, Spotify and VLC are known to publish. Whether it groups the right
  things can only be judged against real strings from the machine — a session
  with the watcher's output logged while several players run.
- **Gapless albums change identity with no stop between tracks.** The reducer
  handles it (identity change closes and opens), but whether the two-second
  settle swallows a genuinely short track on such an album is a listening
  question.
- **Two files with identical tags** — the same song at two bitrates — share an
  alias but not a key, so the exact key protects the library case. Two _system_
  plays of them are indistinguishable, and will share a curve. Accepted.
- **The tick's placement and the notice's emphasis** pass every test that can be
  written and are exactly the class of defect this project has shipped before.
  Both need a look in the running window before the branch is called done.
- **Provenance is thin.** `plays` and `updatedAt` are all the store keeps, so a
  curve learned over twenty listens looks identical to one learned over a single
  bad one. That is the cost of refine-and-overwrite, taken knowingly.

## 15. Follow-ups, not in this branch

A list of remembered songs in the EQ Presets panel — browse, audition, bulk
delete — is the obvious next thing and is deliberately not here. Forget on the
notice is the only removal in v1, which is enough to recover from a bad curve on
a song you are listening to, and not enough to tidy up a year of them.
