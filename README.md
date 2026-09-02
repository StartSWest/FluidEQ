# FluidEQ

> Your sound, finally worth watching.

**[fluideq.com](https://fluideq.com)** · [Download](https://github.com/StartSWest/FluidEQ/releases)
· [What's new](CHANGELOG.md) · [Report a bug](https://github.com/StartSWest/FluidEQ/issues)

FluidEQ is a free, open-source graphical interface for
[Equalizer APO](https://sourceforge.net/projects/equalizerapo/) — a system-wide
parametric equalizer for Windows 10 and 11. It puts a modern workflow on top of
the engine: tune once per output, and the right sound follows the right device
without you touching anything again.

![The FluidEQ EQ page: fifteen parametric bands drawn as vertical sliders from 25 Hz to 16 kHz, and above them a row of chips naming everything else applied to this output — a Razer Kraken V3 Pro headphone correction at 100%, the fifteen EQ bands, the Music voicing and Smart EQ on Balance — each with its own switch and strength slider. The selected band's filter type, frequency, gain and Q sit in a panel underneath. In the graph below, the headphone, EQ, voicing and Smart EQ curves are drawn over the live spectrum. Down the left are the engine switch, the preamp, auto-normalize and a stereo level meter; down the right, the output column with the device picker, the second output, the driver-type panel and the named profiles for this device. The live output meter runs across the title bar, between Online Media and EQ on one side and DSP, Library and Karaoke on the other.](docs/03-eq-parametric-bands-and-live-response.png)

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

**Start from a measurement.** 6,229 headphones and 12,594 published curves ship
offline from [OPRA](https://github.com/opra-project/OPRA), the community
directory of headphone EQ profiles, grouped by brand and credited to whoever
measured them. For anything not in it, the EQ Presets tab links to Squiglink so
you can export its EQ text and import it locally. Published corrections remain
their own layer; an external export becomes editable EQ bands with a visible
source and curve preview.

![The EQ Presets tab: at the top, the headphone-correction picker — a brand-grouped model list showing the Razer Kraken V3 Pro and its three curves, the measurement and target beside it, and a line saying the OPRA library is up to date at 6,229 models — with the crinacle measurement applied and its ten-band curve drawn to the right. Underneath sits the OPRA credit. Below that, the guided Squiglink import in three numbered steps: the EQ text exported from Squiglink pasted into the left pane as a preamp and ten ParametricEQ filter lines with their own frequency, gain and Q, and on the right the curve those bands produce, marked not applied until you press Apply imported EQ.](docs/04-eq-headphone-correction-and-import.png)

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

Computing it from the response alone is a worst case, though: it assumes the
music has full-scale energy at the exact frequency where your chain peaks, and
real music never does. So auto-normalize — still the one switch it always was —
also measures what is actually coming out, and reserves what the programme asks
for rather than what the chain could theoretically need. A 6 dB boost at 10 kHz
stops costing 6 dB of volume when the music up there is 30 dB down.

The two halves answer questions neither can answer alone. The arithmetic is a
proof about what happens inside Equalizer APO, so it holds whatever plays and
wherever the volume sits, and it stays underneath as the floor: a cold start, a
silent room or a measurement that is wholly wrong behaves exactly like the
worst case, never like distortion. The measurement covers what happens after,
where Windows applies its own volume and ends the path with a limiter — whether
that fires depends on a number the main process cannot compute. A sample-peak
supervisor holds the output under −0.3 dBFS, which is the limiter's own
documented figure with two tenths of margin. Nothing measured is stored; every
launch starts at the worst case and works up. A clip indicator watches where
the output really clips, not where the chain theoretically could.

**Import what you already have.** An Equalizer APO ParametricEQ or GraphicEQ
file, a FluidEQ profile, or any WAV impulse response. The **Convolution** tab
also carries the AutoEq catalogue itself, searchable by model or by whoever
measured it, so a verified impulse can be fetched and applied without leaving
the app.

![The Convolution tab: a searchable library of verified minimum-phase headphone impulse responses from the AutoEq catalogue, each row naming the model and, beneath it, who measured it, on what rig, and that the file is a 48 kHz WAV — because Equalizer APO needs the impulse to match the output's sample rate — with a link to the source and a Download and apply button on the right. A search box sits above the list and an Import a WAV button above that, and a line at the foot notes that no convolution is loaded and the EQ tab remains fully independent.](docs/05-eq-convolution-library.png)

**Send a chain to somebody.** A **Config** tab shows the config Equalizer APO has
actually got on disk, per output, as the include tree it really is — what each
file holds, which layers are on, and any include pointing at nothing. Every
output also gets one file FluidEQ never rewrites, for the APO commands that have
no interface here. From that tab a whole chain exports to a `.fluideq` file and
imports back onto the output you are listening to.

![The Config tab, headed "what is on disk right now, not what FluidEQ intends", with a green line confirming Equalizer APO is applying this config. A card for every output runs across the top, the one in use marked "playing now" with its profile and filter count. Below them, the include tree for that output as it really is: the device file carrying the computed preamp, and under it one generated file per layer — headphone, eq, voicing and smart — each with its own switch, its filter count, the actual Filter lines it holds, an Edit link, and a note that it is rewritten on the next change. Export chain and Import chain buttons sit above the tree.](docs/06-eq-equalizer-apo-config.png)

**Media buttons in the title bar.** Previous, play/pause and next, commanding
whatever is playing anywhere on the computer — a desktop player, a browser tab,
FluidEQ's own Online Media tab. They send the media keys a keyboard sends, so
anything already listening for those responds. Windows only.

**One transport, at the foot of every tab.** It follows whichever of FluidEQ's
own players is going — the Library, Karaoke, Online Media — and when none of
them is, it shows what the rest of the computer is playing and names it, with
play, pause, skip and seek reaching that player instead. Where a loaded page
exposes its own Previous, Next, Play and Pause, Online Media uses those rather
than guessing. Only one thing plays at a time: starting a song in the Library
stops the Karaoke stage, and starting either stops Online Media. It will stop
players outside FluidEQ too, if you ask it to.

**Watch the sound, however you like to.** The live spectrum draws in any of
fifty-seven forms — lines, bars, terraces, ribbons, flames, a fluid — including
the ten the title bar has always used, now painted by the same code so the two
panes agree. Four palettes, ten different marks for a lit peak, and a designer
that opens on the look you are using and changes its fill, glow, thickness,
piece count and spacing without touching the geometry. The stereo output meter
has ten looks of its own: bar, segments, LEDs, fluid, mercury, needle, pulse,
stack, flow and centre.

![The Library's full-screen player with the visualizer designer open: a mirrored pillar spectrum runs above and below the album artwork, coloured across the frequency axis, over a background blurred out of the cover itself. Down the right, the New look panel sets the colour logic — Flat, Frequency, Level or Heat — the palette and its gradient, the piece count, the gap, the attack and how long a peak hangs before it falls away, whether the form is filled or stroked, the fill amount, the rainbow glow and border, which of ten marks a lit peak uses, and the name the look is saved under.](docs/10-library-customize-visualizer.png)

**Plays in two places at once.** A second output mirrors what you are hearing to
any number of other devices, with a level for each, and nothing to install.
Mirrored sound arrives about a fifth of a second late — fine for music in another
room, unusable for video or anywhere you can hear both at once — it runs only
while FluidEQ is open, and every mirror carries the correction of the device you
are listening on, because that is already in the sound before FluidEQ sees it.

![The Second output panel open down the right of the window: every other endpoint on the machine listed with its own switch and level — an NVIDIA display output set to neutral, a second pair of Razer speakers turned on at 100%, a Realtek output and another monitor — each naming the profile attached to it, above the note that mirrored sound arrives about a fifth of a second late and plays only while FluidEQ is open. Above it, the automatic mapping panel says that editing any EQ control saves it to the current output, and that FluidEQ maps the stable endpoint ID so the sound follows the device whenever Windows selects it. Suno is playing inside Online Media to the left.](docs/02-online-media-multiple-outputs-one-player-at-a-time.png)

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

**Closing the window does not stop it.** FluidEQ carries on in the notification
area, because a window you tidied away is not a reason to stop equalising the
machine. Its tray icon reopens the window, carries a badge when an update is
waiting, and its menu installs that update, checks for one, or quits for real.
A Windows shutdown, a session logout and the installer all still end it
properly. Only one copy runs at a time — two would both write the same Equalizer
APO config and spend the session undoing each other.

**Plays something to tune against.** An **Online Media** tab opens a small set of
music and video sites — YouTube, YouTube Music, Bandcamp, Twitch and Suno — in a
window inside the app, so a track can be playing while the spectrum moves
underneath it and a band is dragged. It is not a browser: it goes to those sites
and nowhere else, and it downloads nothing.

![The Online Media tab: YouTube open inside the FluidEQ window, playing a music video with the site's own page, search box, results column and player exactly as they come, and the row of site chips — YouTube, YouTube Music, Bandcamp, Twitch, Suno — along the top beside FluidEQ's own search field and an ad-blocking switch. Underneath the whole thing FluidEQ's response graph carries on, the EQ curve and its draggable points drawn over a live spectrum in the fluid form.](docs/01-online-media-youtube-live-eq.png)

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
by album, artist, genre, song, folder or video, as a dense sortable list, a grid
of covers, or a Cover Flow you sweep through. Folders read either as the tree they
actually sit in, which is how you see that thirty of your forty albums live in
one place, or as every folder at once, which is the one to use when you would
rather find than browse. Everything in a folder appears the moment you add
it, titled from the filename and grouped by the folder it sits in; the scan then
fills in the real tags, cover art and durations behind it, so a large library is
usable while it is still being read rather than blank until it finishes.

![The Library on its Artists shelf: a grid of tiles, each carrying the artist's own cover art where a file had one and a tile drawn from the name where none did, with the album count beneath. Along the top sit the shelves — Albums, Artists, Genres, Songs, Folders, Videos, Playlists — the view and sort controls, a search box, and buttons to add a folder or rescan. Down the right, the Up Next queue lists what is coming, grouped under the album or folder each run of songs came from, with a Keep playing switch above it.](docs/08-library-artists-and-up-next.png)

Cover art comes from the file's own tags, or a `cover.jpg` beside it, or a tile
drawn from the album's name — nothing is fetched from the internet, and no album
name leaves the machine. A track in a format Chromium cannot decode says so
rather than failing silently; a folder on a drive that is not plugged in keeps
its songs and dims them rather than losing them; and an album that does not
account for every file in its folder lists the rest underneath it instead of
hiding them.

![The Library on its Albums shelf in Cover Flow: the covers swept into a curve with the selected one face on and reflected beneath it. Under that, the album itself opened — its artwork, title, artist and track count, Play and Add to up next buttons, the folder path it was read from, a box to filter within it, and its songs as a sortable table of number, title, artist, album and length. The Up Next queue stays down the right.](docs/09-library-album-and-play-queue.png)

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

![The Karaoke tab mid-song, headed "a stage built around your music": a playlist of twenty-five paired files down the left with the playing one marked, and the stage beside it showing the song's own artwork behind the words. The current line is large and lit in the middle with the line coming next dimmed beneath it. In the top right corner sit the chord under the playhead and the one after it, and a panel saying the file carries UltraStar syllables and pitch, with a transpose control beside it.](docs/11-karaoke-player.png)

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

![The Karaoke Maker with a song open: the track's waveform across the top, the words laid out in two rows beneath it, and under them a pitch lane spanning C1 to C7 where the melody sits as labelled note blocks with a playhead through them. A scrubber below shows the position within the song and follows the lyrics. At the foot, a live preview draws the stage exactly as the player will — the current line word by word, the lines either side of it dimmed, and a coloured syllable strip underneath — beside a running count of notes, words and how many are still pending, the artist and BPM fields, and a box confirming there is permission to use and export this audio and these lyrics.](docs/12-karaoke-maker-pitch-and-lyrics.png)

**Shape what FluidEQ itself plays.** A **DSP** tab adds a rack of nine stages to
the app's own player — Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass
Punch, Dimension, Maximizer and Master. The order is fixed because it is the
order the arithmetic makes sense in. Every stage starts off, and every one of
them draws what it is actually doing while it works rather than what it was
asked to do.

This is the one part of FluidEQ that stops at the app's own edge. It applies to
music played inside FluidEQ and changes nothing about Spotify, YouTube or
anything else on the machine — that is what the equaliser and its per-output
profiles are for, and they are untouched by it. The DSP tab says so at the top
of its own page.

| Stage                  | What it does                                                                                                                                                                                                   |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Normalizer             | Measures the complete track once, then applies one stereo-linked gain before anything colours it. Nothing pumps, because nothing is following — the measurement is of the whole file.                          |
| Denoise                | Finds the noise floor and the mains hum that are really there rather than assuming them, draws the floor it is subtracting while it subtracts it, and repairs clicks without eating percussion.                |
| Exciter                | Harmonics that were never in the signal — even orders for body, odd for air — over three bands you place, plus Organic for density and Timing, which sharpens attacks and adds no harmonics at all.            |
| Bass Forge, Bass Punch | Forge synthesises the missing fundamental for speakers that cannot reach it. Punch works on time instead of frequency: the fifteen milliseconds of attack no filter can get at.                                |
| Equaliser              | Fifteen bands drawn as the filters actually respond. Serial or parallel, minimum or linear phase, stereo, mid or sides, 2× oversampling, dynamic bands, and forty-seven presets that bring their own headroom. |
| Dimension, Maximizer   | A widener that works per band and can never change what a mono listener hears, and a maximizer that raises the level without letting peaks past the ceiling, showing how much it holds down.                   |
| Master                 | A destination rather than a number — Streaming, Podcast, Audiobook, Broadcast, Cinema, CD, Vinyl, Club, Reference — each setting the loudness target and ceiling delivery really uses.                         |

![The Denoise stage of the DSP tab, headed with what it is for: repairing the source before anything colours it — hiss, mains hum, clicks and a neural voice cleaner, measured from the track itself rather than guessed. A noise-floor graph runs across the top with the output, the floor being subtracted, the hum and the click repairs each drawn as their own line, and a source-analysis strip under it reporting the noise floor, the hum it found and the clicks it counted. Below those sit four panels of controls — hiss with its amount, reduction limit, sensitivity and smoothing; hum with its harmonics, depth and width and a note that it notches the mains frequency the scan actually found; clicks with a sensitivity and a longest repair, which leaves anything too long to be a click alone so percussion survives; and the voice cleaner — each with its own switch, over readouts of what is being reduced, repaired and dropped. Isolate and Bypassed sit at the top right, and the nine stages run down the left with a dot beside the ones that are on.](docs/13-dsp-denoise-and-source-analysis.png)

Anything that adds level can hand it back: gain match takes the makeup off again
so switching a stage on and off compares the sound rather than the volume, and
Isolate on the stages that have it plays only what is being removed or added,
which is the only honest way to judge one. A whole rack saves, names and exports
as a chain file of its own, distinct from an EQ curve, with per-stage profiles
and a crossfade curve you draw beside it.

The chain is C++ in a process of its own, named `FluidEQ-DSP` so a task list
says something, and it ends when the app does however the app ended. If it
cannot start, Library playback carries on unchanged, every stage is visibly
disabled and the app says why — there is no second implementation waiting to
drift away from it.

![The DSP tab with the Maximizer stage selected: the nine stages listed down the left in their fixed order — Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension, Maximizer, Master — with a dot marking those that are on, and Crossfade under a playback-options heading below them. The stage itself fills the rest: a preset picker reading Rock, a line saying it raises the overall level without letting peaks pass the ceiling, and a rolling six-second graph of the output against the ceiling with the amount being held down shaded under it, annotated with the current reduction, peak hold, output and drive. Beneath the graph sit the drive and ceiling knobs under Loudness, and look-ahead and release under Timing. A line at the top of the page says the rack applies to music played inside FluidEQ and does not change Spotify, YouTube or other apps.](docs/07-dsp-maximizer-and-processing-chain.png)

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
| `native/`       | The C++ audio engine behind the DSP tab: `dsp-core` is the chain itself, `dsp-host` the executable that runs it in a process of its own. Built with CMake.                                    |
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
whole interface goes rainbow with the sound.

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
- **A nine-stage DSP rack for FluidEQ's own player**, running on a C++ engine in
  a process of its own: normalisation, denoise, exciter, two bass stages, a
  fifteen-band equaliser, width, maximiser and a mastering stage with a delivery
  target, saved and exchanged as complete racks.

**Interface**

- A rebuilt UI: a shared design-token layer, a scrolling workspace that stops
  panels fighting over the window, a response graph with draggable points and a
  live output curve, and a motion vocabulary that respects
  `prefers-reduced-motion`.
- **A switch and a strength on every layer**, so any of them can be compared
  against, weakened, or taken out without being taken apart.
- **A Config tab** showing what Equalizer APO has actually got on disk, and
  **export and import** of a whole chain as a `.fluideq` file.
- **An Online Media tab** with a player for a fixed list of sites, so something
  can be playing while a band is dragged.
- **A Karaoke tab** built out of your own files: a playlist paired from audio
  and lyrics, words that follow the audio's own clock, a live pitch lane drawn
  against the song's target notes where it has them, a chord guide read out of
  the backing track, and a full-screen stage.
- **A Library tab** for the music and video on your own drives, browsed by
  album, artist, song, folder or video, with one transport at the foot of every
  tab and only one thing playing at a time.
- **Media buttons in the title bar** for whatever is playing on the machine.
- **A live spectrum, a response graph and a real level meter**, in three sizes
  that each remember how you left them, drawn in any of fifty-seven forms and
  ten meter looks.
- **Ten languages**, with a test that fails the build when one falls behind.
- **In-app updates** and a What's new dialog rendered from the changelog, with a
  tray icon that keeps the equaliser running when the window is closed.
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
