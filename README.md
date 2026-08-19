# FluidEQ

> Your sound, finally worth watching.

**[fluideq.com](https://fluideq.com)** · [Download](https://github.com/StartSWest/FluidEQ/releases)
· [What's new](CHANGELOG.md) · [Report a bug](https://github.com/StartSWest/FluidEQ/issues)

FluidEQ is a free, open-source graphical interface for
[Equalizer APO](https://sourceforge.net/projects/equalizerapo/) — a system-wide
parametric equalizer for Windows 10 and 11. It puts a modern workflow on top of
the engine: tune once per output, and the right sound follows the right device
without you touching anything again.

![The FluidEQ EQ page: a ten-band quick layout above the response graph, and under it a row of chips naming everything else that is applied — a bio-cellulose driver correction at 60%, ten EQ bands, the Music voicing and Smart EQ — each with its own switch and strength slider. The live spectrum moves behind the layer curves in the graph below. Down the left are the preamp, auto-normalize and a stereo level meter; down the right, the output column with the device picker, the second output, the driver-type panel and the named profiles for this device. Media transport buttons sit in the title bar beside the level meter.](docs/screenshot.png)

## What it does

**Follows your output.** Every setting below belongs to the device you tuned it
on. Plug in your headphones and their tuning comes back; switch to speakers and
theirs does. FluidEQ maps the stable Windows endpoint ID, not the display name,
so it survives renames and re-plugs.

**Six layers, one chain.** Each is written as its own file in the Equalizer APO
config, included in this order:

| Layer                | What it is                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convolution          | A measured impulse response applied before anything else — from the AutoEq catalogue or a WAV of your own.                                                                                      |
| Driver type          | Twelve compensation profiles for the kind of transducer you are listening on: dynamic and planar headphones, dynamic, balanced-armature and hybrid IEMs, three diaphragm materials, four sizes. |
| Headphone correction | A published measurement for your exact model, applied as a layer beside your tuning rather than into it.                                                                                        |
| Parametric EQ        | Your own bands, up to 128 of them. Peak, low/high shelf, low/high pass, band pass and notch, each with frequency, gain and Q.                                                                   |
| Voicing              | Thirteen curated target curves — music, movies, games, speech and late night, plus eight by genre.                                                                                              |
| Smart EQ             | What a measurement of your own output asked for, one-shot or continuously maintained.                                                                                                           |

**Any layer can be switched off without being lost.** Every one of them has a
switch on its chip, and the four corrections — driver, headphone, voicing and
Smart EQ — have a strength from 0 to 100% beside it. Switching one off leaves its
file out of the chain and touches nothing it holds, so pressing the switch again
puts exactly the same settings back: which is how you find out whether a
correction is actually an improvement, the same passage both ways, a second
apart. It survives a restart, because a config with an include missing is a
truthful config.

Everything active is named on the EQ page, so a bump in the graph is never a
mystery — you can see what put it there and remove it in one click.

![The Voicing tab, one layer with a page of its own: thirteen target curves as cards, five by purpose across the top — Music, Movies, Games, Speech, Late night — and eight by genre below them, each with a line saying what it does to the sound. Music is selected. Underneath, a strength slider marked Off, 50% and Full sits at 100%, beside the three bands this curve actually adds — 105 Hz +3.5 dB, 300 Hz −1.5 dB, 10 kHz +2 dB — each with a sentence explaining it, and a note that the +3.5 dB is already reserved by auto-normalize.](docs/screenshot4.png)

**Start from a measurement.** 6,229 headphones and 12,594 published curves ship
offline from [OPRA](https://github.com/opra-project/OPRA), the community
directory of headphone EQ profiles, grouped by brand and credited to whoever
measured them. For anything not in it, the EQ Presets tab links to Squiglink so
you can export its EQ text and import it locally. Published corrections remain
their own layer; an external export becomes editable EQ bands with a visible
source and curve preview.

![The EQ Presets tab: at the top, the headphone-correction picker — a brand-grouped model list, a measurement and target beside it, and a line saying the OPRA library holds 6,229 models — with nothing applied to this output yet. Below it, the guided Squiglink import in three numbered steps: the EQ text exported from Squiglink pasted into the left pane as ParametricEQ filter lines with a preamp and per-filter frequency, gain and Q, and on the right the curve those ten bands produce, drawn before anything is applied and with a link to remove the import again.](docs/screenshot3.png)

**Smart EQ.** Measures what is actually coming out of your output and flattens
what it hears, rather than assuming a target. It subtracts the rest of the chain
as it measures, so it corrects the recording and the hardware rather than
undoing your own tuning. **Continuous EQ** is the same measurement as a mode
rather than a press: it moves a fraction of the way and measures again, for as
long as there is music, so only what every record agrees about survives —
which is your headphones and your room. Three of them: _Detail_ corrects peaks
and dips, _Balance_ also evens out a bright or warm recording, and _Target_
brings every record to the same tonal balance.

**One preamp, computed.** Every layer contributes to a single `Preamp:` line
derived from the real combined response, so adding a voicing or a convolution
cannot clip you — and removing one gives the headroom back.

**Import what you already have.** An Equalizer APO ParametricEQ or GraphicEQ
file, a FluidEQ profile, or any WAV impulse response.

**Send a chain to somebody.** A **Config** tab shows the config Equalizer APO has
actually got on disk, per output, as the include tree it really is — what each
file holds, which layers are on, and any include pointing at nothing. Every
output also gets one file FluidEQ never rewrites, for the APO commands that have
no interface here. From that tab a whole chain exports to a `.fluideq` file and
imports back onto the output you are listening to.

**Media buttons in the title bar.** Previous, play/pause and next, commanding
whatever is playing anywhere on the computer — a desktop player, a browser tab,
FluidEQ's own Media tab. They send the media keys a keyboard sends, so anything
already listening for those responds. Windows only.

**Plays in two places at once.** A second output mirrors what you are hearing to
any number of other devices, with a level for each, and nothing to install.
Mirrored sound arrives about a fifth of a second late — fine for music in another
room, unusable for video or anywhere you can hear both at once — it runs only
while FluidEQ is open, and every mirror carries the correction of the device you
are listening on, because that is already in the sound before FluidEQ sees it.

**Ten languages.** English, 简体中文, हिन्दी, Español, Français, Português,
Русский, 日本語, Deutsch, Italiano — the most-spoken left-to-right scripts.
The installer offers a language too, preselecting your Windows one, and the app
does the same on first run. Change it any time from the actions menu. Every
label, hint, error and tooltip is translated, and a test fails the build if a
locale falls behind English. Right-to-left languages are deliberately absent:
the layout has never been mirrored, and a broken Arabic is worse than none.

**Updates itself, from wherever it came from.** The build published here checks
GitHub for a new version, downloads it in the background and offers to restart.
A signed build checks its own address instead and never this repository, since
signed installers are not published here. Whichever it is was decided when the
build was made and is compiled into it, and each verifies what it downloaded —
so an installer that ended up on the wrong side is refused rather than run. A
build you made yourself does not update. Being offline is not an error and says
nothing. After updating, a **What's new** dialog shows what changed; it is in
the actions menu any time.

**Reopens where you left it.** Size, position and maximized state are
remembered. The position is only reused if a display still covers it, so
unplugging a second monitor cannot strand the window somewhere you cannot
reach it.

**Plays something to tune against.** A **Media** tab opens a small set of music
and video sites — YouTube, YouTube Music, Bandcamp, Twitch and Suno — in a window
inside the app, so a track can be playing while the spectrum moves underneath it
and a band is dragged. It is not a browser: it goes to those sites and nowhere
else, and it downloads nothing.

![The Media tab: Suno open inside the FluidEQ window and signed in, with the site's own page and player exactly as it comes, a track part-way through in the transport bar at the bottom of it, and the row of site chips — YouTube, YouTube Music, Bandcamp, Twitch, Suno — along the top beside a search box. FluidEQ's response graph and live spectrum carry on moving underneath the whole thing, and the layer curves are still drawn over it.](docs/screenshot6.png)

You can sign in, and it remembers you next time. Its cookies live in a store of
its own that no other part of FluidEQ reads, encrypted at rest by Windows the
same way any browser profile on the machine is, and one button in its toolbar
throws the whole lot away — every cookie, sign-in and cached page — in a single
press. Sign-in through a Google account may be refused; Google decides for itself
whether it will complete one inside an embedded view, and often will not.

FluidEQ is not affiliated with, endorsed by, or connected to any of those sites.
They are opened as they are, in an ordinary Chromium window; the app neither
hosts, stores, copies nor redistributes anything from them. Whoever uses it is
responsible for keeping to each site's own terms of service.

**Play what is already on the machine.** A **Library** tab reads the folders you
add — MP3, WAV, OGG, FLAC, M4A, Opus, AAC and more, plus video — and browses them
by album, artist, song or video, as a dense sortable list, a grid of covers, or a
Cover Flow you sweep through. Everything in a folder appears the moment you add
it, titled from the filename and grouped by the folder it sits in; the scan then
fills in the real tags, cover art and durations behind it, so a large library is
usable while it is still being read rather than blank until it finishes.

Cover art comes from the file's own tags, or a `cover.jpg` beside it, or a tile
drawn from the album's name — nothing is fetched from the internet, and no album
name leaves the machine. A track in a format Chromium cannot decode says so
rather than failing silently; a folder on a drive that is not plugged in keeps
its songs and dims them rather than losing them; and an album that does not
account for every file in its folder lists the rest underneath it instead of
hiding them.

Playback carries on while you look at any other tab, with a transport at the
foot of the window. Songs that come with their own lyrics are left out of the
library on purpose — they belong to the Karaoke tab below.

**Sing over what you already own.** A **Karaoke** tab turns your own files into
a stage. Open a song or add a folder — MP3, WAV, OGG, FLAC or M4A, with lyrics
from an `.lrc`, an enhanced `.lrc` for word timing, or an UltraStar `.txt` for
syllables and real target notes — and files sharing a name pair themselves into
a playlist. The words follow the audio's own clock rather than a timer, so a
long song cannot drift away from them. A microphone you pick and switch on
yourself draws your pitch live, named as a note and marked high, in tune or low,
against the song's target notes where the file genuinely carries them and
against nothing invented where it does not. It names the chord under the
playhead and the one coming next, collects the places you sang high, low or
missed so you can jump back to one and be counted in, and goes full screen with
the controls fading out of the way. Nothing is recorded, nothing is sent
anywhere, and no music ships with it — the songs are your own, and the
instrumental is either one you already have or one the Karaoke Maker splits out
of the song itself.

**And make the file when the song does not have one.** The **Karaoke Maker**
builds one out of a song and nothing else. It can split that song into two
tracks first, here on your machine with no service involved: the backing track
is the instrumental to sing over, and the isolated voice is what the transcriber
and the melody detector read instead of a full mix — reading the words off the
audio requires it. Both stems follow the same transport with a level each, save
as WAV or MP3, and are kept with the project. It is a model listening to a
finished mix rather than the studio's own multitrack, so it gives you a good
separation and not a clean one; it takes well under a minute on a machine with a
usable GPU, and about six without. The words can be transcribed from the
audio or pasted in and kept. The timing is recorded by ear — play the track, mark
each line as it begins and ends, then mark individual words where a line needs
that detail, nudging any mark earlier or later instead of doing it again. The
melody is read off the recording into notes you can hear, split, delete, retune
or add to by hand. There is a counted-in preview, undo and redo throughout, and
what comes out either goes straight to the player or saves as a project to
return to.

![The Karaoke tab mid-song: a playlist of twenty-four files down the left, the current line of the lyric large and lit in the middle of the stage with the lines before and after it dimmed above and below, and the estimated chord and the next one in the top right corner. Below the lyric, a pitch lane draws the song's target notes as blue blocks with their syllables labelled above them, the live microphone pitch running over the top in orange and green as it goes sharp or flat, and a performance-review strip marking every place that went high, low or missing. A transport bar with the playhead and a volume control sits at the bottom.](docs/screenshot8.png)

**Local and account-free.** No cloud, no telemetry, no proprietary driver, no
virtual audio device. Three downloads are worth naming, because being caught out
by one of them later is worse than the download itself: asking the Karaoke Maker
to transcribe lyrics fetches a speech-recognition model (about 570 MB where your
graphics card can run it, about 1.1 GB where it cannot), asking it to read a
melody fetches a 361 MB pitch model, and asking it to split a song into voice
and backing fetches a 700 MB separation model. Each comes down once, on your
press rather than at launch, and the Maker lists what is on disk and what is in
memory with a button to give the memory back. Your audio is not part of any of
those requests — the separation, the transcription, the timing and the melody
analysis all run on your machine. Pasting the words in skips the first, bringing
your own instrumental skips the last, and a song you time by ear fetches nothing
at all.

## The config is the source of truth

FluidEQ used to keep its own copy of the state and write the Equalizer APO
config from it. That is backwards whenever anything else touches that config — a
hand edit, another tool, an APO reinstall, a restore from backup — because the
file is what you are hearing and the app's copy is only what it last believed.
On startup the file wins.

This used to be hedged, and the hedge is most of why the config is split into
one file per layer. A voicing, a driver correction and a Smart EQ curve all
reached APO as ordinary `Filter N:` lines with nothing marking them as layers, so
reading a config back would have turned every one of them into hand-placed bands
— the pickers reading "none" while the sound was unchanged, and the next edit
writing the layers in again on top of their own flattened copies. The only safe
answer was to refuse to read anything at all whenever a layer was live.

An `Include:` naming a file answers the question the text never could. Startup
adopts the bands and leaves the layers alone, and it learns which layers you had
switched off from which includes are missing. The old refusal is kept exactly
where it still applies: a flat config — an older FluidEQ's, a hand-written one,
another tool's — attributes nothing, and there nothing is adopted.

| Owned by the APO config                                                                          | Owned by the profile                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Bands, preamp, GraphicEQ points, which impulse response is loaded, which layers are switched off | Which voicing, which driver profile, which headphone reference, the profile name |

Nothing in the second column is audible on its own. Everything in the first
column is.

## How device switching works

FluidEQ writes one `Device:` block per assigned output into its own config file,
which Equalizer APO includes. Because APO accumulates every block whose device
matches, the block for the output you are listening on is the one that applies.
Each block names a file of its own:

```text
# Neutral fallback for every output without an attached profile.
Device: all
Channel: all

# Headphones -> Sony XM5 · Music
Device: {HEADPHONE-ENDPOINT-GUID}
Channel: all
Include: fluideq-device-8f2a1c9b4d70.txt
```

The device's own file states the impulse response, includes one file per layer
in the order APO applies them, and ends with the single computed preamp — and
then your own file, which FluidEQ creates once and never writes again:

```text
# Headphones -> Sony XM5 · Music
Convolution: fluideq-convolution-8f2a1c9b4d70.wav
Include: fluideq-8f2a1c9b4d70-driver.txt
Include: fluideq-8f2a1c9b4d70-headphone.txt
Include: fluideq-8f2a1c9b4d70-eq.txt
Include: fluideq-8f2a1c9b4d70-voicing.txt
Include: fluideq-8f2a1c9b4d70-smart.txt
Preamp: -6.4 dB
Include: fluideq-8f2a1c9b4d70-custom.txt
```

A layer that is switched off is an `Include:` that is not written. The name in
the middle is a digest of the Windows endpoint id, so an output's files are
findable again rather than accumulating a fresh set every launch.

No virtual output device and no kernel driver.

## Getting started

FluidEQ is Windows-only, because Equalizer APO is the audio engine.

1. Download the installer from
   [Releases](https://github.com/StartSWest/FluidEQ/releases) and run it.
2. It carries Equalizer APO with it and offers to install it — nothing is
   downloaded and there is no second website to visit. APO's own setup opens so
   you can tick every output you want FluidEQ to manage; reboot when it asks.
   Already have Equalizer APO? It is left completely alone.
3. Pick your output at the top right, then tune.

That is the whole setup. Nothing needs saving — every edit attaches itself to
the current output automatically. Every output keeps at least one profile, and
you only need more if you want several tunings for the same device. Rename one
with the pencil on its row.

> Windows SmartScreen may hold the installer on first run, and again on an
> update. Choose **More info → Run anyway**, or build it yourself from source
> below.

## Known limitations

- **SmartScreen warns.** On install, and on updates.
- **Windows only.** Equalizer APO is the audio engine and there is no
  equivalent to target elsewhere. On other platforms FluidEQ starts with two
  demonstration endpoints so the UI can be developed, and touches nothing.
- **Traditional Chinese readers get Simplified.** Locale matching uses the
  primary subtag, so `zh-TW` resolves to `zh`.
- **No right-to-left languages.** See above — the layout has not been mirrored.

## Where things live

| Path            | What is in it                                                                                                                                                                                 |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/common/`   | Pure logic, no Electron: filter maths, the APO text reader and writer, voicing and driver profiles, translations, validation.                                                                 |
| `src/main/`     | Electron main. `flush.ts` renders the chain, `deviceProfiles.ts` lays it out as files and writes them, `apoConfigReader.ts` reads it back, `main.ts` owns the IPC surface and the live state. |
| `src/renderer/` | React. `FluidEqContext` holds the live EQ, `I18nContext` holds the language.                                                                                                                  |
| `CHANGELOG.md`  | The release notes. The newest section is what the app shows in **What's new**.                                                                                                                |
| `CLAUDE.md`     | The constraints that are not obvious from the code.                                                                                                                                           |

## Supporting the work

Nothing here is tracked. No telemetry, no analytics, no account.

**This is one person's work — mine, Ivan Carmenates Garcia — built with a lot of love
and an unreasonable amount of attention to detail.** Every panel was drawn by
hand and argued over: how the response curve reads at a glance, the way a menu
unfolds, what a knob does when you drag it slowly, which words go on a button,
whether a chip should truncate its label or its value. Nothing here is a stock
component with a theme painted on top. The parts you are not supposed to notice
are the parts that took the longest.

If it earned a place in your setup, a contribution funds the time that keeps it
maintained and the next ideas out of the same workshop.

<a href="https://buymeacoffee.com/startswest"><img src="assets/support-qr.png" alt="QR code for the FluidEQ Buy Me a Coffee page" width="200" align="left" hspace="20"></a>

**[buymeacoffee.com/startswest](https://buymeacoffee.com/startswest)**

A one-off tip, no account needed. Click the link, or scan the code with your
phone.

Prefer to contribute time? Issues and pull requests are just as welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md).

<br clear="left">

There is also a game hidden in that panel, for anyone who has contributed. Tap
the pet or press space on the beat of whatever you are playing — it reads the
real percussion out of your own audio, so it is your music you are playing
along to. Thirty-six consecutive perfect taps wins **Rainbow mode**, and the
whole interface goes rainbow with the sound:

![The support panel with Rainbow mode running: the pet lit up beside a score of 759 at ×2.5, above the rainbow waveform strip you tap on as each spike reaches the line, and a line saying to keep it up because something happens at ×10. To the right sit the note about what a contribution funds, the Buy me a coffee link with its QR code, and a confirmation that the pet has its star and dances now.](docs/screenshot9.png)

## Development

### Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org/) 20+ and pnpm
- Visual Studio 2022 with **Desktop development with C++**
- Equalizer APO, for real system-audio integration

### Run it

```powershell
git clone https://github.com/StartSWest/FluidEQ.git
cd FluidEQ
pnpm install
pnpm dev
```

On non-Windows systems FluidEQ exposes two demonstration endpoints, so the UI
and the device-assignment flow can be worked on without touching system audio.

### Commands

```powershell
pnpm test:unit
pnpm lint
pnpm build
pnpm package
```

`pnpm package` builds an installer into `release/build`, which is what you want
for checking a change end to end on a real machine.

`pnpm package:signed` builds the signed installer instead. It refuses to run
unless its whole configuration is present, so it cannot quietly produce an
unsigned one.

The version lives in both `package.json` and `release/app/package.json` and the
two must agree, or the artifact is named after the wrong one.

### Build-time configuration

Copy `.env.example` to `.env` to set the contribution links. Every value in it
is inlined into the renderer bundle and is therefore public by construction —
the file says so at the top, at length, because that is exactly the kind of
thing people get wrong once.

## Where this came from

FluidEQ is designed, written and maintained by Ivan Carmenates Garcia. It began
as a fork of [AQUA](https://github.com/h39s/AQUA), which gave it a foundation:
an Electron and React shell, Equalizer APO integration, filter controls, presets
and a response graph. That foundation is credited here with thanks.

Roughly a tenth of the source is still theirs, and the rest is new work. What
remains is mostly plumbing — a number input, a spinner, part of the IPC
scaffold. Everything below was written for FluidEQ, and it is essentially all of
what you interact with.

**Sound**

- **Automatic per-output profiles.** Tune once and the tuning attaches itself to
  the Windows endpoint you were listening on, by stable GUID rather than by
  display name. Switch outputs and the right sound follows, with no save step.
  This is the idea the whole app is built around.
- **Driver-type compensation.** Twelve profiles for the kind of transducer you
  are actually listening on — dynamic and planar headphones, dynamic,
  balanced-armature and hybrid IEMs, three diaphragm materials and four driver
  sizes — each its own APO layer with a strength control and its own curve on
  the graph.
- **A headphone correction that is a layer, not your bands.** A published
  measurement for your model is applied beside your own tuning rather than over
  the top of it, so clearing the EQ does not take it with it and it can be
  weakened or switched off on its own.
- **Voicing.** Thirteen curated target curves — five by purpose, eight by genre
  — written after your bands so your own tuning is never overwritten and
  switching back restores it exactly.
- **Convolution.** Verified minimum-phase impulse responses from the AutoEq
  catalogue, or any WAV of your own, applied ahead of the parametric stage.
- **Smart EQ.** Measures what is actually coming out of your output and
  flattens what it hears, rather than assuming a target curve. It subtracts the
  rest of the chain as it measures, and **Continuous EQ** keeps it measured
  while music plays.
- **A file per layer.** The chain is a root file, a file per output and a file
  per layer, so a layer can be switched off by leaving its include out, its
  origin can be told apart from your own bands when the config is read back,
  and every output has one file FluidEQ never rewrites.
- **A second output.** What you are hearing, mirrored to other devices with a
  level for each, without a routing driver.
- **One computed preamp.** Every layer contributes to a single `Preamp:` line
  derived from the real combined response, so stacking a voicing on a
  convolution cannot clip you and removing one gives the headroom back.
- **The APO config as source of truth.** FluidEQ reads what is on disk on
  startup instead of trusting its own copy, so a hand edit or another tool
  wins rather than being silently overwritten.
- **Every APO filter type**, not just peak and shelf: low/high pass, band pass
  and notch, with the pass forms written without the `Gain` token APO rejects.
  Up to 128 bands.
- **Import** of Equalizer APO ParametricEQ and GraphicEQ files, FluidEQ
  profiles, and WAV impulse responses.
- **A guided external import**, with a link to Squiglink and a
  preview of the EQ text you paste or open locally.

**Interface**

- A rebuilt UI: a shared design-token layer, a scrolling workspace that stops
  panels fighting over the window, a response graph with draggable points and a
  live output curve, and a motion vocabulary that respects
  `prefers-reduced-motion`.
- **A switch and a strength on every layer**, so any of them can be compared
  against, weakened, or taken out without being taken apart.
- **A Config tab** showing what Equalizer APO has actually got on disk, and
  **export and import** of a whole chain as a `.fluideq` file.
- **A Media tab** with a player for a fixed list of sites, so something can be
  playing while a band is dragged.
- **A Karaoke tab** built out of your own files: a playlist paired from audio
  and lyrics, words that follow the audio's own clock, a live pitch lane drawn
  against the song's target notes where it has them, a chord guide read out of
  the backing track, and a full-screen stage.
- **Media buttons in the title bar** for whatever is playing on the machine.
- **A live spectrum, a response graph and a real level meter**, in three sizes
  that each remember how you left them.
- **Ten languages**, with a test that fails the build when one falls behind.
- **In-app updates** and a What's new dialog rendered from the changelog.
- Window position and size remembered, and no white flash on launch.
- A small animated companion in the titlebar, because the app should be
  pleasant to leave open.

The Git history is kept whole, every file that came from the fork still carries
its notice, and the licence is unchanged. FluidEQ is neither an official
continuation of that project nor endorsed by its maintainers.

## Attribution

Parts of FluidEQ derive from [AQUA](https://github.com/h39s/AQUA), © 2023 AQUA
Dev Team, used under the GPL. Full notices, and what was changed, are in
[NOTICE.md](NOTICE.md).

The headphone correction library is [OPRA](https://github.com/opra-project/OPRA)
(Open Profiles for Revealing Audio), a project of Roon Labs, used under
[CC BY-SA 4.0](assets/licenses/CC-BY-SA-4.0-LICENSE.txt). What ships here is
that dataset reshaped for the application to read, under the same licence and
with no curve altered; individual curves are credited to their authors —
oratory1990, the AutoEq project and Rtings — both in the application and in
[OPRA-ATTRIBUTION.txt](assets/licenses/OPRA-ATTRIBUTION.txt). Maintainers can
refresh it with `pnpm opra:update` and validate the result with `pnpm test:opra`.

Convolution impulse responses are AutoEq's, credited to
[Jaakko Pasanen](https://github.com/jaakkopasanen/AutoEq) and used under the MIT
licence. AutoEq is also the origin of much of the data OPRA redistributes.

Squiglink is linked as an external calculator, not bundled as a database. Users
can export the EQ text there and paste it into FluidEQ; the
import keeps the source link and a visible curve preview with the applied EQ.

**Equalizer APO** is a separate project by
[Jonas Thedering](https://sourceforge.net/projects/equalizerapo/), licensed
GPL-2.0-or-later and therefore compatible with FluidEQ's GPL-3.0. FluidEQ does
not link any of its code — it writes the configuration file that APO reads —
but the FluidEQ installer **bundles APO's own installer** and offers to run it,
so that getting started never means going off to find a download.

Because that means redistributing APO's binary, every FluidEQ release also
publishes the matching **`EqualizerAPO-src-<version>.zip`** as a release asset,
which is how the GPL's source requirement is met. It is deliberately hosted
alongside the installer rather than linked elsewhere. APO's licence text ships
in `resources/assets/licenses/EqualizerAPO-LICENSE.txt`, its installer is bundled
unmodified, and the version is pinned and checksum-verified in
[`.erb/scripts/fetch-equalizer-apo.ts`](.erb/scripts/fetch-equalizer-apo.ts).
If you bump that version, publish the matching source archive with it.

**FluidEQ is not affiliated with or endorsed by Equalizer APO or Jonas
Thedering.** It is an independent front end that happens to write the
configuration file APO reads. If something goes wrong in FluidEQ, please
[open an issue here](https://github.com/StartSWest/FluidEQ/issues) rather than
on the Equalizer APO tracker — a bug in this app is not his to answer for, and
his time is better spent on the engine all of us depend on.

FluidEQ is not affiliated with or endorsed by Dolby Laboratories.

See [NOTICE.md](NOTICE.md) for the full derivative-work notice.

## License

FluidEQ is free software under the
[GNU General Public License v3.0 or later](LICENSE).

Copyright © 2026 Ivan Carmenates Garcia<br>
Portions copyright © 2023 AQUA Dev Team

You may use, study, modify and redistribute this software under the GPL. A
distributed modified version must also make its corresponding source available
under the same license. This summary is not a substitute for the license text.

### Additional term under GPL-3.0 section 7(e)

As section 7(e) of the GNU General Public License version 3 expressly permits,
this program is distributed with one additional term:

> Rights under trademark law to use the name **FluidEQ** or the FluidEQ logo
> are not granted. This term declines to grant those rights. It does not
> restrict any right the GPL grants, and it does not apply to the source code.

You may redistribute FluidEQ unchanged under its own name, and you may always
say truthfully that your work is based on it. Give a modified version you
distribute a name and an icon of your own — the branding is centralised in
[`src/common/branding.ts`](src/common/branding.ts) so that this is a one-file
change. Section 7 also lets you remove this term from material you convey. The
full policy, and what it deliberately does not cover, is in
[TRADEMARK.md](TRADEMARK.md).
