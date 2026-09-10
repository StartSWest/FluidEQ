# Plus Creator Studio — scenes made by members

Plus members build their own visualizers on the scene engine FluidEQ Plus
already runs, watch them live on their own music while their AI writes them,
keep them in their look picker, and share them with other members as files.
A community gallery and a store come later; this design leaves room for both
without building either.

Supersedes the 2026-09-07 "community visualizers" draft, which proposed a
second, formula-based engine. The shader engine already on the `plus` branch is
more capable than that proposal — Truss 3D, Road Trip 3D and the photographic
Alpine scene run on it — and two engines would be two things to secure,
document and maintain.

## 1. What already exists

Everything here builds on it; nothing here replaces it.

- **The scene engine.** A Plus look is a GLSL ES 3.00 body that defines
  `vec4 sceneColour(vec2 uv)`. The app owns the `#version` line, every uniform
  and `main()`; the pack supplies only that function. The uniform contract
  (version 6) is the listening layer: level, beat, bass/mid/treble, a fast and
  a slow spectrum, a qualified musical accent, the waveform, a music-paced
  clock, the theme accent, the live axis rectangle, up to eight tunable
  parameters, and an optional WebP colour atlas.
- **Trust by signature.** Official packs are signed with Ed25519 by a tool in
  the private `fluideq-premium` repository. The app verifies the signature on
  cache adoption and again on every load, then parses. The cache is a
  convenience, not a trust boundary.
- **Entitlement on the server.** `scene_packs` is readable only by a paying
  account under row-level security that re-derives "paying" on every read, so
  no copy of the app — including one rebuilt without its own gate — can list a
  pack its account is not entitled to. A public `scene_catalogue()` gives free
  users the names and swatches for locked rows, never the source.
- **Failure handling.** A pack that will not compile, or loses its GPU context,
  is quarantined on that machine and its free fallback form drawn instead. A
  cost ladder steps the resolution down (100 → 75 → 50 %) when frames run
  slow, and hands over to the fallback at the floor.
- **The GPL split is already right.** The public app carries the engine and a
  public key; the private repository carries the scenes, the signing key and
  the server. That is the pattern this design extends to members.
- **Free custom looks** export and import as `.fluideq-look.json` for everyone.
  That stays exactly as it is. Only member *scenes* are Plus.

## 2. Decisions

| Decision | Why |
|---|---|
| Member scenes use the existing engine and the existing pack format. | One engine. A member scene that is good enough can be adopted officially without rewriting it. |
| Building, running, importing and exporting member scenes needs an active Plus membership. | Ivan's rule. §8 explains which of these gates are enforceable and where. |
| Export is signed by the server. | The only way "only Plus members can export" holds against a modified build: without a Plus account there is no signature, and the official app imports only signed member files. |
| Member files are signed with a **separate key** from official packs. | A member scene can never be adopted as an official Plus look, whatever it claims about itself. The key is the trust class. |
| Stricter source rules for member scenes than for official ones. | Official scenes are reviewed by a person before publishing; member scenes are not. A survey of the 30 official scenes found nothing the stricter rules would refuse, and a test will hold that true (§6). |
| Artwork is allowed, WebP only, through the existing checks. | Masked photographs driven by separate channels — Alpine's boats, whale and birds, or somebody's cat — are the most compelling thing the engine does. |
| Imported scenes run, but cannot be edited or re-exported by anyone but their author. | Re-export would launder authorship; editing someone else's scene is making a derivative of their work. It is also the property the store will need. |
| When Plus lapses, member scenes are kept, shown locked, and never deleted. | Same behaviour as official scenes. The project folder was always on the member's own disk. |
| Comments are stripped from a scene when it is signed for export. | It removes the only free-text channel a shared scene has (§7.8). The author's folder keeps them. |
| The AI prompt is English; every Studio control is translated into all ten locales. | The prompt is read by a model, not by the member. The member reads the buttons. |

## 3. The Studio

A **Studio** tab in the Community panel, beside the channels and the
leaderboard. Opening it gives the Studio the whole Community view rather than
a column of it — a stage squeezed into a side rail cannot be judged. Plus only;
for anyone else the tab shows the Plus card.

The Studio is where the work happens, so the result lives there too: a large
live stage running the member's scene on their actual music, with everything
needed to judge it around it.

- **Start a project.** Two ways in:
  - **Copy AI prompt** — puts the prompt from Appendix A on the clipboard. The
    member pastes it into their AI, adds their idea at the end, and saves the
    files the AI returns into a folder.
  - **Create starter project** — writes a working `pack.json` and `scene.frag`
    into an empty folder the member picks, so there is something moving on the
    stage before the AI has been asked anything. Refuses a folder that already
    holds a `pack.json`; it never overwrites.
- **Link folder.** The member picks the project folder in the system dialog.
  FluidEQ watches it; every save of `pack.json`, the shader or the artwork
  rebuilds the scene and swaps it onto the stage in place. The folder is
  remembered for next time.
- **The stage.** The scene, running through the same engine and the same
  uniforms as the graph. A save that does not compile keeps the **last good
  version running** and shows the error beside it, line number pointing into
  `scene.frag` — the stage never goes black mid-edit.
- **Signal meters.** Level, beat, bass, mid, treble, the musical accent and the
  spectrum, exactly as the scene receives them, so a creator can see *why*
  something moved.
- **Test signals.** Live music, Silence, Bass, Mids, Treble, Beat, Accent.
  Synthetic values that drive only the stage's uniforms — never the audio — so
  every channel can be checked without hunting for the right song. Silence
  matters most: a scene that keeps flashing in silence is inventing music.
- **Sizes.** The graph's own size, Narrow, Wide and Fullscreen, because a scene
  that holds at one size and falls apart at another is the commonest defect.
- **Cost, in words.** "Runs smoothly", "Heavy — drawn at half resolution",
  "Too heavy for this computer".
- **Add to my looks.** Snapshots the project into the member's look picker, in
  a **Made by you** section.
- **Export.** Signs the scene through the server and saves a
  `.fluideq-scene.json` the member can send to other members (§9).

While the Studio is open the graph keeps its own look running. The stage is a
second GPU context and its cost ladder is its own.

## 4. The project folder

The same shape as an official pack in `fluideq-premium/packs/<id>/`, so the two
formats never drift apart:

```
my-cat/
  pack.json      what the scene is called, its colours, its parameters
  scene.frag     the GLSL body that defines sceneColour
  artwork.webp   optional: the picture and its masks, in one atlas
```

```json
{
  "id": "my-cat",
  "version": 1,
  "contract": 6,
  "names": { "en": "My Cat" },
  "fallbackStyle": "bars",
  "swatch": ["#101820", "#ff9f1c", "#2ec4b6"],
  "sourceFile": "scene.frag",
  "artworkFile": "artwork.webp",
  "artworkWidth": 2048,
  "artworkHeight": 1024,
  "params": [
    { "id": "glow", "names": { "en": "Glow" }, "min": 0, "max": 1, "value": 0.5 }
  ]
}
```

The app builds the pack payload from the folder itself — the job
`tools/publish.mjs` does for official packs — with one difference: nothing is
prepended. Official scenes get the private helper file `shared/scene.glsl`;
members do not, and the prompt gives their AI the few helpers it needs to
write its own.

## 5. What the engine offers a scene

The prompt in Appendix A is the authoritative, member-facing version. In short:

| Channel | What it is | Good for |
|---|---|---|
| `uLevel` | overall loudness, eased | breathing, overall glow |
| `uBeat` | 1 at a beat, falling to 0 | punches, ear twitches, flashes of a *part* |
| `uBands.x / .y / .z` | bass, mid, treble | three independent movements |
| `uSpectrum` | 16 Hz–25 kHz, log-spaced, fast | per-frequency detail, bars, contours |
| `uSpectrumSlow` | the same, eased 180 ms up / 420 ms down | calm light, glows that do not flicker |
| `uMusicAccent` | a rare, qualified accent: envelope and event number | lightning, a comet, one big moment every few seconds |
| `uWaveform` | the recent waveform envelope | strings, water surfaces, oscilloscopes |
| `uTime` | seconds, advancing only while music plays, wraps at 3600 | motion that stops when the music does |
| `uArtwork` | the atlas | photographs, sprites, masks |

**Masks** are how a photograph comes alive: the atlas carries the picture in
one region and hand-painted masks in another, one mask per moving part, and
each part is driven by a different channel. That is how Alpine's five boats
each answer their own frequency window, and it is how a cat's ears can twitch
on the beat while its tail sways with the bass and its eyes glow with the
treble.

## 6. Rules for member scenes

Checked by the app when a project builds, again by the server when a scene is
signed, and again by the app on every import and every load. Stricter than the
official rules. A survey of the 30 official scenes found none that would fail
them — no preprocessor line anywhere, `while` appearing only in comments, and
a largest loop bound of 72 — and the test suite asserts all 30 pass, so the
two sets of rules cannot quietly drift apart.

**Source**

- A GLSL ES 3.00 body defining `vec4 sceneColour(vec2 uv)`. No `main()`.
- **No preprocessor lines at all** — no `#` outside a comment. (§7.2 explains
  why this one matters.)
- Loops only as `for`, counting up or down from a constant to a constant by a
  constant step, at most 128 iterations. No `while`, no `do`. GLSL already
  forbids recursion.
- Outside comments, printable ASCII only, plus tab and newline. Comments may
  hold any text — they are stripped before a scene is shared (§7.8), and the
  official scenes use them for notes like "moiré".
- At most 64 KB, the existing engine cap.

**Artwork** — through the existing checks, unchanged: WebP only, not
animated, at most 4096 px on an edge and 4096 × 2048 in area, at most 6 MB,
dimensions read from the file's own header before any decoder allocates
memory, and required to match the size `pack.json` declares.

**Everything else** — the existing pack rules: an `id` matching
`[a-z][a-z0-9-]{1,47}`, an English name, a fallback form the app knows, two to
four swatch colours, up to eight parameters. Names are capped at 40 characters
per language and stripped of control, zero-width and bidirectional-override
characters.

A folder that breaks a rule gets a plain sentence in the Studio naming the rule
and the line, not a refusal with no reason.

## 7. Security

The requirement is that a member scene cannot execute anything, reach anything,
take over the app, harm the machine, hurt the person watching, or carry an
instruction to any reader — human or machine.

### 7.1 What a shader can and cannot do

A fragment shader is code, but it runs in the most constrained place a browser
has: it receives numbers and textures, and it returns one colour per pixel. It
has no file system, no network, no clipboard, no access to the page, the app,
or memory outside the textures it is handed. This is the same code every web
page may send the GPU through WebGL, and the same sandbox that has made public
shader galleries safe to browse for over a decade. The window's page itself
has no Node access, and Chromium runs the GPU work in its own sandboxed
process.

What a shader *can* do is waste the GPU, hang it, flash, or reach a bug in a
graphics driver. The first three are closed below; the fourth is reduced to
what every web page already carries (§7.10).

### 7.2 No preprocessor, so the app keeps its `main()`

The app wraps the scene: its own uniforms before it, and after it a `main()`
that clamps the colour and multiplies it by the app's fade. A preprocessor line
in the scene could `#define main` away and substitute its own, or redefine
`clamp` or the fade — taking the wrapper, and every guard written into it, out
of the app's hands. Refusing every `#` line closes that entirely, and costs
nothing: no official scene uses one.

### 7.3 Nothing can loop without end

Constant-bounded `for` loops only, at most 128 iterations each, and the loop
variable may not be assigned inside the body; no `while`, no `do`, no
recursion. A scene's work per pixel is therefore finite and known
before it ever reaches the GPU.

### 7.4 Nothing reaches the full screen untested

A member scene does not start at full resolution. It starts at one eighth of
the stage's size and climbs — an eighth, a quarter, half, three quarters, full
— only while its frames stay inside the frame budget, measured the way the
existing cost ladder measures them. Each step is at most four times the pixels
of the last, so the heaviest single frame a scene can ever submit is bounded by
what it already proved it could draw. A scene that cannot hold the budget at
the smallest step is refused with "Too heavy for this computer".

If a GPU still resets, Chromium reports the lost context, and the existing
quarantine takes the scene off that machine's picker. No timer is involved in
any of this: every step waits on a painted frame or a browser event.

### 7.5 Nobody can publish a strobe

Member scenes are drawn through one extra pass that measures brightness on the
GPU — the frame's relative luminance averaged over each cell of a 4 × 4 grid —
and limits how fast each cell may change: at most half of full scale per
second, with the correction blended smoothly between cells so no grid ever
shows. WCAG 2.3.1 counts a flash as a pair of opposing swings of at least 10 %
and allows at most three a second; three pairs need six swings, 0.6 of full
scale per second, which the limit stays below. Beats still read; a strobe over
any sixteenth of the frame or more cannot happen.

What it does not catch is a flash smaller than a cell, so the rules and the
prompt still tell authors never to flash, and the community stage adds
reporting. Official scenes are unaffected.

### 7.6 Files and folders

- The Studio reads only three files from a linked folder: `pack.json`, and the
  two file names it declares. Those must be plain names — no separators, no
  `..`, no absolute paths — and must resolve, after following links, to a file
  inside that folder. Size is checked before a byte is read.
- Every path comes from the system dialog in the main process. The page never
  supplies one, and no channel accepts one from it.
- Export and import go through the system dialog the same way.
- Watching stops when the Studio closes, the account loses Plus, or the app
  quits.

### 7.7 Two trust classes, two keys

The app trusts two public keys and keeps them in separate lists: the official
key signs Plus looks, the member key signs member scenes. A member envelope is
verified only against the member list and stored only in the member store, so
no member file can present itself as an official scene however it is crafted.
The author's name inside a signed member file is the name on their FluidEQ
profile, stamped by the server — never text the file supplied.

A member's own scenes, snapshotted from the Studio, are not signed — they are
their own work on their own machine — but they pass through every rule in §6
again on every load, exactly as imported ones do.

### 7.8 Prompt injection

This feature is built around members pasting a prompt into an AI, so the places
text could carry instructions are closed one by one:

- **No model is in any trusted path.** The app never passes a scene's source,
  name or author to a model. The server's signing step is mechanical
  validation. Nothing is approved because a model said so.
- **A shared scene has no free text.** Comments are stripped when a scene is
  signed, so an imported scene carries code, names and numbers — nothing a
  paragraph of instructions could hide in. The Studio does not display an
  imported scene's source at all.
- **Names are plain text.** Rendered as text, never as markup, never turned
  into links, never opened, copied or executed, and stripped of the invisible
  characters used to make one string display as another.
- **The prompt tells the AI to reply with files only.** And the app validates
  whatever comes back exactly as it validates a stranger's file — an AI's
  output is untrusted input, not a trusted author.
- **Where a person uses AI to review members' scenes** (community moderation,
  later), the scene goes to the model as quoted data, never as instructions,
  and the model is given no tools.

### 7.9 Abuse of the signing service

The signing function requires a signed-in Plus account, caps request size
before parsing, re-runs every rule in §6, and limits each account to 30
signatures an hour, counted from its own ledger rows.

### 7.10 What remains

A graphics driver can have bugs, and a shader is how a page reaches the driver.
That risk is not zero and this design does not pretend it is; it is the risk
every web page with WebGL already carries, reduced the same way. Chromium's
shader translator validates and rewrites every shader before any driver sees
it; the GPU work runs in Chromium's own sandboxed process; and the member rules
narrow what can reach the translator well below what the web allows. What
keeps it that way is keeping Electron current, which the weekly cold build
already watches.

## 8. Plus, the GPL, and what can actually be enforced

FluidEQ is GPL-3.0-or-later. Three facts from the licence and the FSF's own
FAQ decide what "only Plus members" can mean:

1. **A modified app may remove any check in the app.** Section 10 forbids
   imposing further restrictions on the rights the licence grants, and
   section 3 waives any power to forbid circumventing a technical measure in
   the covered work. So a lock inside the app is a courtesy the official build
   honours, not a lock — and building DRM into it would be legally toothless
   and trivially undone.
2. **The server and the signing key are not the program.** The GPL governs the
   software, not a service FluidEQ runs or a signature it chooses to issue.
   Row-level security and signatures are where the rules can actually hold, and
   the existing design already puts entitlement there.
3. **A member's scene is the member's work, not FluidEQ's.** The FSF's answer
   on program output is that the copyright follows the input, which here is the
   member's own writing and artwork.

What follows from that:

| Rule | Where it holds |
|---|---|
| Only Plus members can **export** | **Enforced by the server.** No Plus account, no signature; no signature, no import in the official app. A modified app cannot mint one. |
| Only Plus members can **import** and **run** member scenes | Enforced in the official app. A modified build could skip it — but that build can already run any shader its owner types, so nothing of anyone else's is exposed that was not already in the file. |
| Only Plus members can **see** member scenes in a gallery (later) | **Enforced by the server**, with the same row-level policy `scene_packs` uses today. |
| A file sent outside Plus cannot be read | **Not possible, and not attempted.** The shader is text and must be readable by the GPL app to run. Encrypting it would put the key in public source. The protection a creator has here is copyright, as with any file they share. |

**One licence question remains, and it is the one thing needed before the store
can exist.** The FSF's position is that a program merely interpreted by a GPL
interpreter is data and may carry any licence, but that a plug-in whose
functions are called by the GPL program is a "borderline case" of a combined
work. A member scene is exactly that borderline: the GPL app wraps it in its
own code and calls `sceneColour`. The clean answer — the same one the GCC
runtime exception gives compiled programs — is an **additional permission
under GPL section 7**, stating that a scene written against the FluidEQ scene
contract is not required to be licensed under the GPL. FluidEQ already uses
section 7 for its trademark term, and Ivan holds the copyright in the scene
contract, so the permission is his to grant. **Granted by Ivan on 2026-09-10**;
the wording in Appendix C lands in the README and the scene contract's header
with stage 2. Without it, member scenes would arguably be GPL, which would make
selling them in a store unworkable.

### 8.1 What FluidEQ needs from members

The same fact that keeps a member's scene out of the GPL — it is their work —
means FluidEQ has no right to handle it except what the member grants. Their
pictures and settings were never anybody's but theirs; the section 7
permission settles the code. What remains is **permission from the member**,
and it goes where every other promise between the maker and members already
lives: the Plus terms.

The model is an exchange, and no money moves in it: **members share what they
make with the other members, and get everything the others share — as part of
the subscription.** Selling is not enabled.

The Plus terms are versioned (`PLUS_TERMS_VERSION`, now 1) and the app already
tells a member before a new version applies to them. Stage 2 bumps it to 2,
in all ten languages; the full draft is Appendix D. It covers:

- **Ownership** — the member keeps it; the GPL does not cover it.
- **Opt-in** — nothing is shared until the member exports it.
- **A narrow permission** — check, sign with the author's name, deliver to
  Plus members. Explicitly not: selling, advertising, or turning it into an
  official Plus look without asking. It does not stop the member doing
  anything else with their work.
- **The exchange** — nobody is paid and nobody pays; the return is every other
  member's scenes, and leaderboard points from likes.
- **The promise** — only work the member has the right to share; community
  rules apply; the maker can block a scene that breaks them or someone's
  rights.
- **Other members' scenes** — personal use while a member; may be passed on
  unchanged to other Plus members; not altered, claimed, published elsewhere
  or sold.
- **Honesty about files** — a sent file cannot be recalled; the maker can block
  a scene on request.
- **Privacy** — new rows for exports and likes, likes never shown by name, the
  export record deleted with the account, and a contact for rights holders
  who are not members.

The first Export waits for the member to accept version 2, through the flow
that already shows the terms before paying. The terms page itself gains a
section, a paragraph in three others and two table rows, and is checked on
screen at its narrowest and in its longest translation like any other change.

If selling is ever enabled, it needs more than this — payouts, tax, refunds,
and who answers for what — as a separate creator agreement and a new terms
version.

Not legal advice. Before the store takes money for other people's work, a
lawyer should read the section 7 permission, the Plus terms' licence grant
from members, and the creator agreement.

## 9. Sharing by file

**Export** (the author only):

1. The app builds the payload from the Studio project and runs every rule.
2. The main process sends it to the server function `sign-member-scene` with
   the session token.
3. The server checks the account is paying, caps the size, re-runs every rule
   with the same validator the app uses, strips comments, stamps the author's
   profile id and name and the export time, signs the payload with the member
   key, records a ledger row (author, scene id, version, payload hash, time —
   not the source), and returns the envelope.
4. The app saves it as `<name>.fluideq-scene.json` where the author chose.

Offline, Export says so in a sentence; nothing else depends on the network.

**Import** (any Plus member): the file is size-checked, verified against the
member key only, parsed with the member rules, and stored in the member store.
It appears in a **Made by members** section of the look picker with its
author's name. A file whose author is the importing account is treated as that
member's own scene and may be exported again — which is how somebody moves
their work to a new computer.

The signing request can carry up to about 9 MB with artwork. The function
host's request-size limit is confirmed before this stage is built, not
assumed.

### 9.1 Likes, and credit on the leaderboard

The exchange only works if making something good is noticed. So a member can
**like a scene right where it plays**: while a scene from Made by members is
the graph's look, a small credit appears with the rest of the graph's controls
when the pointer asks for them — the scene's name, its author, and a heart with
the count. One press likes it; another takes it back. A member's own scenes
show the count without a heart.

On the server:

- **A `scene_likes` table** — liker, author, scene id, time — one row per
  member per scene, so a like counts once however many versions follow.
- **Liking goes through a function, never a raw insert.** The app sends the
  fingerprint of the signed payload it is playing; the function looks the
  scene up in the export ledger and takes the author and scene id **from the
  ledger**, never from the request — so nobody can send likes to an author for
  a scene that was never exported. It refuses an account that is not paying,
  refuses a like on the caller's own scene, and ignores a second like.
- **Nobody sees who liked what.** A member reads only their own likes (to draw
  their heart filled) and a scene's count. The author sees counts, not names.
- **On the board, likes are one more line in the score**: 5 points per like
  received in the period — the same as a message — shown as "{count} likes on
  your scenes" beside hours, messages and mentions. Likes from accounts that
  are banned or off the board do not count, and a blocked scene's likes stop
  counting. The existing rule against climbing with several accounts covers
  liking yourself from a second one, and each of those accounts costs a
  subscription.
- Offline, the heart says it needs a connection; nothing is queued behind a
  timer.

Five points is a starting value, in the same place as the rest of the scoring,
and easy to move once real numbers exist: a monthly board tops out around
5,400 points from listening, so a scene liked by a few hundred members is a
real climb without drowning everyone who only listens.

### 9.2 Blocking a scene

The terms promise that the maker can stop a scene from opening — for breaking
the rules, for using somebody else's work, or because its author asked. That
has to be true the day sharing starts, not when the gallery arrives:

- **A `blocked_scenes` table of payload fingerprints**, readable by paying
  accounts, written only by an admin. A blocked scene's likes stop counting.
- The app fetches it with the member store's refresh, on the same events and
  staleness rule the Plus looks already use — never on a timer.
- A blocked scene leaves the picker and will not import: "FluidEQ has blocked
  this scene. It can't be opened." The file stays on disk; nothing is deleted.
- Blocking keeps only the fingerprint, so it outlives the author's account
  without keeping their name (Appendix D).

**The validator lives once.** The rules are a dependency-free module in the
app's shared code. `fluideq-premium` already builds its tools against the app's
real parser; its function bundler vendors the same module into
`sign-member-scene`, and a test fails if the two copies differ.

## 10. Later, and what this leaves room for

**Community gallery.** A `member_scenes` table holding signed envelopes,
readable only by paying accounts under the `scene_packs` policy; sharing a
scene from the Studio posts it to the Looks channel with a live preview; the
existing reports and bans moderate it; the block list from §9.2 already
stops a removed scene on machines that imported it.

**Store.** Prices and purchases tables, ownership checked by the same
row-level rule, and the creator's licence carried in the signed payload. The
merchant is the open question: Buy Me a Coffee pays out to one creator account,
so paying other people their share needs a provider built for marketplaces.
The server already acknowledges Buy Me a Coffee's shop events and ignores them;
that is where one-off purchases were always going to land. Needs the section 7
permission and the lawyer's review before it opens.

## 11. Coordination with the parallel work

Another agent is building official Plus scenes in `fluideq-premium` and free
scenes in this repository. To stay out of each other's way:

- This work is built on its own branch, in its own worktree, from `plus`, and
  rebased onto whatever that work has committed before it merges. The files
  currently modified in the shared checkout are not touched.
- **New files, no collision:** the member rules and payload builder, the member
  store, the folder link and watcher, the member IPC, the signing client, the
  Studio and its stage, the warm-up ladder, the brightness limiter, the Studio
  styles and translations. In `fluideq-premium`: the next free migration
  number (0011 today — 0009 and 0010 are the leaderboard's) for the ledger and
  likes, and the `sign-member-scene` function.
- **The leaderboard's scoring function** was rewritten twice this week
  (0009, 0010). Adding likes to it replaces that function again, so it is done
  last and against the newest version, never from a copy of an older one.
- **Shared files, touched narrowly:** the signature verifier (a second key
  list), the scene canvas (accepting a member scene and the two member-only
  passes), the look picker (two sections), the Community panel (one tab), the
  main process (registering the IPC), and the function bundler.
- **One rule both sides keep:** the uniform contract is shared. A change to
  what a uniform means bumps `SCENE_CONTRACT_VERSION`, exactly as it already
  must for official scenes, and the member prompt in Appendix A is updated in
  the same commit.

## 12. What ships when

1. **The Studio, locally.** Copy AI prompt, starter project, folder link with
   live reload, the stage with meters, test signals, sizes and cost, the member
   rules, the warm-up ladder, the brightness limiter, Add to my looks, the Made
   by you section, and the Plus gate and lapse behaviour.
2. **Sharing by file.** The member key, the signing function, the ledger, rate
   limiting, Export, Import, the Made by members section, likes on the playing
   scene and their points on the leaderboard (§9.1), and the block list
   (§9.2). The section 7 permission
   and version 2 of the Plus terms (§8.1, Appendix D) land with this stage.
3. **Later:** the community gallery, then the store.

## 13. Testing

- **The rules.** A corpus of scenes that each break one rule — a `#define`, a
  `while`, a variable loop bound, a 129-iteration loop, a loop variable
  assigned in its body, non-ASCII outside a comment, a `main()`, an oversized file, a traversal in `sourceFile`, a link out of the
  folder, a lying artwork size, an animated WebP — each asserted refused with
  the right sentence, **each beside a positive control** that the same scene,
  repaired, is accepted. All 30 official scenes asserted to pass.
- **Trust classes.** An official envelope offered as a member file, and a
  member envelope offered as an official one, both refused; a member envelope
  with a tampered byte refused; a correct one accepted.
- **Export and import** round-trip against a test key, including the author
  check, comment stripping and the refusal to re-export someone else's scene.
- **The signing function**: unpaid account refused, oversize refused, rule
  breaches refused, rate limit reached, ledger row written.
- **Likes**: a like on an unknown fingerprint refused, on the caller's own
  scene refused, from an unpaid account refused; a second like changes
  nothing; taking it back removes it; a like from a banned account and a like
  on a blocked scene are not counted; `leaderboard_totals` adds 5 points per
  counted like — each beside a positive control that an ordinary like counts.
- **Live reload**: a burst of saves builds the latest version exactly once
  more after the build in progress, with no timer; a broken save keeps the last
  good scene on the stage.
- **The warm-up ladder and brightness limiter** have their decision logic
  tested as plain functions; the GPU side is verified on screen, as the engine
  already is.
- **On screen, before anything is called done:** the Studio at normal size, a
  narrow panel and fullscreen; the stage in every test signal; a scene
  deliberately heavy enough to be refused; a scene that strobes, before and
  after the limiter; the longest translation of every new control.

## 14. Deliberately not in this design

- No second engine, no scripting, no formula language.
- No private helper library for members, and no editing of imported scenes.
- No encryption or DRM on member files (§8).
- No in-app AI generation: the member's own AI costs nothing to run and nothing
  to secure.
- The gallery and the store are designed for (§10), not built.

---

## Appendix A — the AI prompt

What **Copy AI prompt** puts on the clipboard. The member pastes it and writes
their idea after the last line.

````text
You are writing a visualizer for FluidEQ Plus, a music app. The visualizer is a
GLSL ES 3.00 fragment-shader body that FluidEQ runs on the listener's GPU while
music plays. Reply with the complete contents of each file and nothing else:
first pack.json, then scene.frag. If my idea needs a picture, also describe
exactly how I should lay out artwork.webp (see ARTWORK). Do not explain unless
I ask.

FILES
  pack.json     metadata (format below)
  scene.frag    the shader body
  artwork.webp  optional picture atlas that I make myself

pack.json:
{
  "id": "lowercase-with-dashes",
  "version": 1,
  "contract": 6,
  "names": { "en": "Short Name" },
  "fallbackStyle": "bars",
  "swatch": ["#rrggbb", "#rrggbb", "#rrggbb"],
  "sourceFile": "scene.frag",
  "params": []
}
- id: 2-48 characters, a-z, 0-9 and dashes, starting with a letter.
- names: English required; add es, pt, fr, de, it, ru, zh, ja, hi if you can.
  At most 40 characters each.
- swatch: 2 to 4 colours that represent the scene.
- fallbackStyle: drawn when a computer cannot run the scene. Use one of: bars,
  line, area, dots, spikes, ridge, skyline, flames, bubbles, rain, starfield,
  canyon.
- params: up to 8 sliders the listener can adjust, each
  { "id": "glow", "names": { "en": "Glow" }, "min": 0, "max": 1, "value": 0.5 }.
  Each becomes "uniform float uParam_<id>;" automatically. Do not declare it.
- With artwork add: "artworkFile": "artwork.webp", "artworkWidth": W,
  "artworkHeight": H (the exact pixel size of the image).

scene.frag must define exactly this function and may define helpers above it:
  vec4 sceneColour(vec2 uv)
- uv runs 0..1 across the panel, origin at the bottom-left, y up.
- Return premultiplied colour: rgb already multiplied by alpha, all in 0..1.
  Return alpha 1.0 for an opaque background.
- FluidEQ already declares everything below and writes main(). Never write
  #version, main(), or any line starting with #. Use const instead of #define.

WHAT THE SCENE RECEIVES (already declared; just use them)
  float uTime        seconds; advances only while music plays; wraps at 3600.
                     Use periods that divide 3600 so nothing jumps.
  vec2  uResolution  the drawing size in pixels. Use it for aspect ratio and
                     for one-pixel line widths.
  float uLevel       overall loudness, 0..1, eased.
  float uBeat        1.0 at a detected beat, falling to 0.
  vec3  uBands       x = bass, y = mids, z = treble, each 0..1.
  sampler2D uSpectrum      frequency energy: texture(uSpectrum, vec2(f, 0.5)).r,
                           f = 0 is 16 Hz, f = 1 is 25 kHz, log-spaced. Fast.
  sampler2D uSpectrumSlow  the same, eased (180 ms up, 420 ms down). Use for
                           light and glow that must not flicker.
  vec2  uMusicAccent x = envelope 0..1 of a rare, strong musical moment (at
                     least ~5 s apart); y = its event number. Use y as a random
                     seed so each moment looks different (where lightning
                     strikes, which way a comet flies).
  sampler2D uWaveform  recent waveform envelope: texture(uWaveform, vec2(t, 0.5)).r
  vec3  uAccent      the app's theme colour, if you want to match it.
  vec4  uSpectrumRect  where the app's live frequency axis sits:
                       (left, right, floor, ceiling) in uv units.
  sampler2D uArtwork   the artwork atlas, if pack.json names one. Origin at the
                       bottom-left, premultiplied RGBA. Do not use it otherwise.

RULES (FluidEQ refuses the scene otherwise)
- Loops: only for (int i = 0; i < N; i++) with N a constant of at most 128
  (counting down is fine too). Never assign to i inside the loop. No while,
  no do, no recursion.
- Plain ASCII outside comments. At most 64 KB.
- Silence must look calm and still: drive motion from the music, not from
  uTime alone pretending to be music.
- Never flash the whole picture. Let a beat move or light a part of it.
- It runs for every pixel, every frame, on ordinary laptops. Keep loops short,
  sample textures sparingly, and prefer smooth maths to many layers.

HELPERS YOU MAY COPY
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float band(float f) { return texture(uSpectrumSlow, vec2(clamp(f, 0.0, 1.0), 0.5)).r; }

ARTWORK AND MASKS
A photo comes alive by masking its parts and giving each part its own channel.
Put the picture in one region of the atlas and paint masks beside it: white
where a part is, black elsewhere, one mask per moving part (for example red
channel = ears, green = tail, blue = eyes). In the shader, sample the mask at
the same place as the picture and use it to move, bend, brighten or tint only
that part — e.g. ears twitch with uBeat, the tail sways with uBands.x, the eyes
glow with uBands.z. Tell me the exact atlas layout: the image size, where the
picture goes, and what each mask must cover. WebP, not animated, at most 4096
pixels wide and 4096 x 2048 in total, at most 6 MB.

MY IDEA:
````

## Appendix B — ideas to append

Offered under the button as one-tap starters the member can edit:

1. *My cat's photo. Ears twitch on every beat, the tail sways with the bass,
   the eyes glow with the treble, and the background shimmers with the slow
   spectrum.* (Uses masks.)
2. *A neon city at night. Each building is a band of the spectrum, windows
   light with the mids, and a train crosses the skyline on each musical
   accent.*
3. *Deep sea. Jellyfish pulse with the bass, plankton sparkle with the treble,
   and light rays sway with the overall level.*
4. *A spinning vinyl record seen from above. The grooves glow from the
   waveform and the needle throws sparks on beats.*
5. *A campfire under stars. The flames are the spectrum, embers fly up on
   hi-hats, the stars twinkle with the treble.*
6. *Northern lights over a lake. The curtains follow the slow spectrum, their
   reflection ripples with the waveform, a shooting star crosses on each
   accent.*

## Appendix C — section 7 permission

For the README's licence section and the header of the scene contract. Granted
by Ivan on 2026-09-10 (§8); to be read by a lawyer before the store opens.

> **Additional permission under GNU GPL version 3 section 7 — scenes.**
> A *scene* is a program in the OpenGL ES Shading Language written to be run by
> FluidEQ through its scene contract: the declarations, entry point and
> wrapper FluidEQ supplies around a function named `sceneColour`, together with
> any artwork and metadata distributed with it. As a special exception, the
> combination of a scene with that contract, when run by FluidEQ, does not
> require the scene to be licensed under this License; you may license your
> scene under terms of your choice. This permission does not apply to FluidEQ
> itself or to any other part of it, and does not permit you to distribute
> FluidEQ, or a modified version of it, under any licence other than this one.

## Appendix D — Plus terms, version 2 (draft, English)

In the voice of the existing terms, and describing only what ships with stage
2 — sharing by file, and likes. Terms say what the app does today; the gallery
gets its own additions (below) when it ships, as version 3. Translated into
all ten locales in the same commit. No selling: nothing here pays anybody or
lets anybody charge.

**The deal, in one line.** You share what you make with the members, and you
get everything the members share — that is part of what Plus is.

### Changed: the short version

- *You choose what is shared* — "The leaderboard is off unless you join, and
  you decide what you post and which of your scenes you share."

### Changed: the membership

- *p1* — "Plus adds premium visualizers, the Studio for making your own and
  sharing them with other members, posting in the community and the
  leaderboard to FluidEQ. It costs {price} and renews every month until you
  cancel."

### New section: Scenes you make

1. A scene you make in the Studio is yours. FluidEQ does not own it, and the
   GPL that covers FluidEQ does not cover it.
2. It stays on your computer until you choose to export it. Nothing you make
   is shared unless you share it.
3. When you export a scene, you let FluidEQ check it and sign it with your
   name, so other Plus members can play it and see that you made it. That is
   the whole permission. The maker will not sell your scene, use it in
   advertising, or make it one of the Plus looks without asking you first, and
   it does not stop you doing anything else with your own work.
4. Sharing is part of Plus, not a job: nobody is paid for a scene and nobody
   pays for one. What you get back is every scene the other members share.
5. Members who like your scene give you points on the leaderboard, if you have
   joined it. Likes are counted by the server; see Fair play.
6. Only share work you have the right to share — your own photos and
   drawings, or ones whose owner allows it. The community rules apply to
   scenes as they do to messages. The maker can stop a scene from opening if
   it breaks these terms or someone else's rights.
7. A scene another member shares is their work, licensed to you for personal
   use while you are a member. You can play it, like it, and pass the file on
   unchanged to other Plus members. Please do not change it, present it as
   yours, publish it anywhere else, or sell it.
8. A file you have sent stays with whoever has it. If you want a scene to stop
   opening everywhere, ask the maker, who can block it the same way as a scene
   that breaks the rules.

### Changed: fair play on the leaderboard

- *New p3* — "Likes on your scenes earn {likePoints} points each. A like
  counts once per member per scene, only from Plus members, and never from
  your own account. Likes from a second account of your own count as climbing
  with more than one account."

### New rows: what the app sends, and when

| What | When | Who can see it |
|---|---|---|
| The scene you export, and your display name inside the file | When you press Export | Nothing of the scene is kept. The maker keeps a record that you exported it: which scene and version, when, and a fingerprint, so a blocked scene can be recognised. Whoever you send the file to sees your display name. |
| Your like on a member's scene | When you press the heart, and when you take it back | The author and the board see how many likes a scene has, never who gave them. |

### Changed: what never leaves your computer

- *New line* — "Scenes you make and your project folders, unless you export
  one."

### Changed: what is kept, and how to delete it

- *New p5* — "Scenes: the record of what you exported, and the likes you gave,
  are deleted with your account. A scene blocked for breaking these terms
  keeps only its fingerprint, without your name, so it stays blocked."

### Changed: contact

- *p1* — "Questions, refunds, deleting your account, or reporting a scene that
  uses your work: {contact}." Rights holders who are not members need a way in
  too; this is it.

### Ready for version 3, with the Community gallery

- "If you share a scene in Community, you also let FluidEQ keep it there and
  show it to Plus members until you remove it. You can remove it at any time,
  with or without Plus. Members who already have a copy keep it."
- A row for scenes shared in Community: "The scene and your display name —
  every Plus member."
