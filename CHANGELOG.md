# What's new in FluidEQ

Every released version, newest first. FluidEQ shows you the newest section of
this file the first time you run a new version — the **What's new** entry in the
actions menu opens it again any time.

---

## 1.6.0

FluidEQ 1.6 is about what happens to a song after the equaliser. Version 1.5
could play your library and shape whatever the machine was playing; the shaping
was one curve and a preamp. This version adds a full processing rack for the
app's own player — denoise, exciter, bass, dynamics, width and mastering, each
with a picture of what it is doing — and rebuilds the audio underneath it in
C++, in a process of its own, because a browser's audio graph was never going
to carry it.

**The rack applies to music played inside FluidEQ.** It does not change Spotify,
YouTube or anything else on the machine — that is what the equaliser and its
per-output profiles are for, and they are unchanged. The DSP tab says so at the
top of the page.

### New

- **A DSP tab, and a chain of nine stages down it.** Every stage is off until
  you turn it on, every stage says what it is doing while it works, and the
  order is fixed because it is the order the arithmetic makes sense in:
  Normalizer, Denoise, Exciter, Bass Forge, Equaliser, Bass Punch, Dimension,
  Maximizer, Master.
- **Normalizer.** Measures the complete track once, then applies one
  stereo-linked gain before anything colours it — True Peak or Loudness, with
  the measured peak, the integrated loudness and the gain it actually applied
  all on screen. No pumping and no moving follower, because there is nothing
  following: the measurement is of the whole file.
- **Denoise: hiss, mains hum, clicks and a neural voice cleaner.** Measured from
  the track rather than guessed at — the scan finds the noise floor and the hum
  frequency that is really there, and the graph draws the floor the engine is
  subtracting while it subtracts it. Click repair bridges impulsive damage and
  leaves anything too long to be a click alone, so percussion survives. Isolate
  plays only what is being removed, which is the only honest way to judge it.
- **Exciter: three bands, plus Organic and Timing.** Each band generates
  harmonics that were never in the signal — even orders for body, odd for air —
  over a frequency and a range you set. Organic adds smooth even-harmonic
  density around a chosen focus. Timing lets highs lead and delays mids and lows
  for clearer attacks, and adds no harmonics at all. Isolate hears the
  harmonics on their own.
- **Bass Forge and Bass Punch.** Forge synthesises the missing fundamental and
  reinforces the real one from a single band, for speakers that cannot reach it.
  Punch works on time rather than frequency — the fifteen milliseconds of attack
  no filter can get at. Both come with profiles, both can be soloed, and both
  start off.
- **A fifteen-band parametric equaliser, drawn as the filters actually
  respond** rather than as they were asked to. Peak, both shelves, notch, both
  passes and band pass; bands added either side of the one you have selected;
  Character (Focused or Broad) for the way a boost narrows as it grows; Serial
  or Parallel engines; Minimum or Linear phase; Stereo, Mid only or Sides only;
  2× oversampling. Dynamic bands act only when there is something to act on, and
  the graph says which ones are moving. Forty-seven presets, each bringing its
  own headroom, and curves imported from Squiglink, AutoEq or Equalizer APO
  text.
- **Dimension and Maximizer.** A stereo widener that works per band and can
  never change what a mono listener hears — the guard closes on its own when a
  mix is already out of phase — and a maximizer that raises the overall level
  without letting peaks past the ceiling, showing how much it is holding down
  while it does it.
- **Master, with a destination rather than a number.** Streaming, Podcast,
  Audiobook, Broadcast R128 and A/85, Cinema, CD, Vinyl, Club and Reference each
  set the loudness target and ceiling that delivery actually uses. Auto headroom
  reduces only the peaks that approach a true-peak ceiling; gain match takes the
  makeup back off so switching the stage on and off compares the sound instead
  of the volume; and the last guard — DC blocker, invalid-sample repair,
  emergency ceiling — reports what it caught rather than silently catching it.
- **Racks you can save, name and hand to somebody else,** alongside per-stage
  profiles and a crossfade curve you draw and keep.
- **A native audio engine.** The whole chain is C++ in a process of its own,
  named FluidEQ-DSP so a task list says something, and it ends when the app
  does however the app ended. Two decks with a bounded read-ahead each and a
  crossfade that moves per sample; MP3, FLAC, Ogg Vorbis and WAV decoded in the
  engine itself and everything else the library accepts decoded through Windows
  Media Foundation; a resampler, partitioned convolution, and a loudness meter
  measuring with the filter the standard actually specifies. It was held
  bit-identical to the engine it replaces on real music before it became the
  default, and if it cannot start, the app says so and plays through the
  fallback chain rather than pretending.
- **Smart EQ remembers a song.** Listen to a track for two minutes with a
  correction in place and FluidEQ offers to keep it; the next time that song
  plays — from the library, from Spotify, from a browser, whoever is playing it
  — the curve comes back, says which song it recognised, and offers to stop. A
  shelf per output, the oldest correction leaving when it is full, a star on the
  row that has one, and Forget reaching the song wherever it was filed.
- **Karaoke songs can hold more than one language of words.** A second set of
  lyrics borrows the first one's clock, so the translation lands on the same
  notes; the Maker asks which language you are looking at and checks the
  syllable and note counts against the original; and a Spanish sheet you can see
  is a Spanish file you can save.
- **Browse the library by genre,** and the queue no longer stops when the shelf
  it came from runs out.
- **Updates install themselves.** When one has been downloaded and verified,
  FluidEQ waits until the window is closed and nothing is playing, then installs
  it and comes back the way it was. The update that brings you to this version
  still shows the installer's window — the running app is what asks for a quiet
  install, so this one is the first that can. Every update after it is
  invisible.

### Changed

- **The title bar carries the app's navigation.** The five places sit either
  side of the live meter — Online Media and EQ on the left, DSP, Library and
  Karaoke on the right — which gives the workspace its row back. The meter is
  measured into the true centre of the window rather than being left wherever
  the names happened to end.
- **The Media tab is called Online Media,** and shortens to one word on a narrow
  window rather than being abbreviated.
- **One typography on all three platforms.** Each system's own font, one weight
  scale, one monospace stack, and figures that do not shove their neighbours
  around while a value counts up. Two bundled webfonts were tried and taken back
  out — Segoe UI is sharper at the sizes this interface lives at.
- **The DSP page moves like the rest of the app:** the same easings, the same
  card entrances, menus that open away from the now-playing bar instead of
  underneath it.

### Fixed

- **A library on OneDrive scanned to nothing.** Placeholder files were read as
  empty rather than as files waiting to be fetched.
- **Shuffle moved the playhead.** The whole run was shuffled and then searched
  for the current track, which put it at a random index — it looked like a timer
  going off, and it was four lines in `shuffle()`.
- **A crackle during playback.** The mirror feeding the visualisers was seeking
  every time a render arrived late; the seek was the sound.
- **Half of an AAC export was silence** when an offline render outran its own
  decoder.
- **A tag block with a bad length no longer costs the file** — the bounds check
  is where the bug is, rather than a retry wrapped around it.
- **Playback enters softly** instead of stepping into the middle of a waveform,
  and a crossfade waits until there is something to fade to.
- **The engine follows the output device it is supposed to play to,** and brings
  its decks back when the device changes under it.
- **The seek bar stops reporting a song that is no longer on screen.**
- **The Maker's tool popover was measured against the wrong box,** so its last
  row sat under the now-playing bar with no way to scroll to it.
- **A file that had been recovered stopped calling itself an error,** and Stop
  no longer leaves an empty bar behind.

---

## 1.5.0

FluidEQ 1.5 adds a music and video library. The app could already shape whatever
your PC was playing and open other people's media in the Media tab; it could not
see the music sitting on your own drives. Now it can — and because there is
finally one thing playing at a time, everything that draws sound got rebuilt
around it: one transport at the foot of every tab, a level meter redrawn from
scratch, and the title bar's visualiser brought to the response graph.

### New

- **A Library tab that reads your folders.** Add a folder — or drop one on the
  tab — and FluidEQ walks it for music and video: MP3, WAV, OGG, FLAC, M4A,
  Opus, AAC and more, alongside MP4, WebM and the rest. Tags, cover art,
  durations and bitrates are read into an index that is remembered between runs,
  and a rescan re-reads only what actually changed.
- **Everything shows up immediately.** Files appear the moment the folder is
  walked, titled from their filenames and grouped by the folder they sit in,
  dimmed until their details arrive. The scan then fills in the real tags and
  artwork behind them, so a large library is usable while it is still being read
  instead of blank until it finishes.
- **Five ways to browse, three ways to look.** Album, artist, song, folder or
  video, each as a dense sortable list, a grid of covers, or a Cover Flow you
  sweep through with the wheel, a drag or the arrow keys. Folders read either as
  the tree they actually sit in or as every folder at once, which is the one to
  use when you would rather find than browse. Click a column to sort by it,
  click again to reverse, and both choices are remembered.
- **A player that does not stop when you look away.** Double-click a song and
  whatever you were looking at becomes the queue, with shuffle, repeat and a
  transport at the foot of the window that stays there on every tab. Videos play
  in the tab with a full-screen control of their own.
- **Cover art without asking anyone.** The file's own embedded picture, or a
  `cover.jpg` beside it, or a tile drawn from the album's name. Nothing is
  fetched from the internet and no album name leaves the machine.
- **One transport, for whatever is playing.** The bar at the foot of the window
  follows the tab you are on — the Library, Karaoke, the Media tab — and when
  none of them is playing it shows what the rest of the computer is: a desktop
  player, a browser tab. Play, pause, skip and seek reach it from there. Windows
  only. The bar is always drawn, quiet and empty before anything is chosen,
  rather than appearing on the first press and taking sixty pixels off the
  workspace as it arrives — and which player it belongs to survives a restart.
- **One player at a time.** Starting a song in the Library stops the Karaoke
  stage, and starting either stops the Media tab. Optionally it stops players
  outside FluidEQ too, which is off unless you ask for it.
- **The title bar's visualiser, on the response graph.** Fifty-seven forms now
  draw the live spectrum, including the ten wave forms the title bar has always
  had, painted by the same code so the two panes finally agree about what they
  are drawing. Four palettes — signal, rainbow, level and the new Heat, which is
  the reading rather than a map of it — and ten marks for a lit peak, each with
  its own behaviour rather than its own silhouette. The Look designer reaches
  all of it: fill, glow, thickness, how many pieces a form is broken into, and a
  new Gap that thins a column form without changing its count.
- **A level meter with ten looks.** The stereo output meter is drawn in canvas
  rather than assembled from elements: bar, segments, LEDs, fluid, mercury,
  needle, pulse, stack, flow and centre.
- **A clip indicator that watches the real ceiling.** It reads where the output
  actually clips rather than where the chain could in theory, and floats clear
  of the controls beneath it.
- **Auto-normalize gives back the volume it used to waste.** It is the same
  single switch it always was, and off still hands the preamp to you. What
  changed is what "on" reserves. It used to assume the music has full-scale
  energy at the exact frequency where your chain peaks, so a 6 dB boost at
  10 kHz cost 6 dB of volume — while the music up there is typically 30 dB
  down. It now measures what is actually coming out and reserves what the
  programme asks for instead. The arithmetic is still underneath as a floor, so
  a cold start, a silent room or a measurement that is wholly wrong behaves
  exactly like the auto-normalize that shipped, and it can never be louder than
  no chain at all. Measurement lasts the session; nothing about it is stored.
- **The preamp is a dial.** A turned metal knob with a cut notch, which reads at
  a glance in a way a slider on an even range never did.
- **A tray icon.** FluidEQ keeps running when the window is closed, so the
  equalisation does not stop because you tidied your taskbar — see _Changed_
  below, because this changes what the close button does. The icon carries a
  badge when an update is waiting, and its menu will install it, check for one,
  reopen the window or quit for real.
- **Karaoke files that open elsewhere, and open here.** Every format the app
  says it can read it now genuinely reads, and what the Maker exports opens in
  other UltraStar players rather than only in this one.

### Changed

- **The close button hides the window instead of quitting.** FluidEQ carries on
  in the tray, because a window that is closed is not a reason to stop
  equalising the machine. Quit from the tray menu when you mean it. Windows
  shutdown, a session logout and the installer all still end it properly.
- **Only one copy of FluidEQ runs at a time, whichever build it is.** Two copies
  write the same Equalizer APO config and each reads the other's write as an
  outside edit, so they spend the session undoing one another. The second one
  now steps aside and says why.
- **Every output gets its own profiles and its own undo.** A profile is
  identified by the output it belongs to as well as its name, so renaming or
  deleting one on your headphones leaves the identically named one on your
  speakers alone. Saved copies moved the same way, and both are migrated at
  startup.
- **The speech model's real cost, in the two sizes it comes in.** About 570 MB
  where your graphics card can run it and about 1.1 GB where it cannot, rather
  than one number that was right in neither case.
- **Melody detection is no longer offered on the full mix.** It reads the
  isolated voice, which is the only thing it can read honestly, so the button
  waits for a split instead of returning a plausible-looking wrong answer.
- **The side bar is a card per concept**, the tab panels keep their bottom
  breathing room when they are scrolled, and the graph has its floating toolbar
  back.

### Fixed

- A format Chromium cannot decode — MKV, AVI, WMA — is listed and marked rather
  than playing as a black rectangle.
- A folder on a drive that is not plugged in keeps its songs and dims them.
  Unplugging a drive never empties a library, and neither does stopping a scan
  part-way through, nor a file that vanishes while it is being read.
- An album that does not account for every file in its folder lists the rest
  underneath it, instead of quietly leaving them out.
- A file whose tags cannot be read still appears, under its filename, and says
  that its tags were the problem rather than leaving you to guess.
- Songs that come with their own lyrics stay out of the library and are counted
  where they went: they belong to the Karaoke tab.
- Seeking in the Library player lands where you let go of the thumb, instead of
  resetting the song to the start. Audio is held as a blob and byte ranges are
  served for video, which is the whole of what seeking needed.
- **Pressing Play on the album already cued now plays it.** After a restart, or
  after Stop, an album's own Play did nothing while the bar's Play worked.
- **Searching the library searches the library.** Typing in the box steps out of
  whatever folder you are standing in, instead of returning the four matches in
  that one directory and looking like an empty library. On the folder shelf a
  search lists every folder holding a match with its path underneath, rather
  than the single root they all live under.
- **Play in an opened album plays the list in front of you**, which is a
  different record the moment you have typed a filter or sorted a column.
- **The folder chip selects the shelf again.** Opening the menu from the chip
  itself meant the press people make most often cost a second one to dismiss a
  menu nobody asked for; the arrow beside it is the half that means "which
  reading".
- **Auto-normalize no longer walks the preamp down to the floor.** Two faults,
  both in the first cut of the measured reserve: the ceiling it held the output
  under was −3 dBFS, which is _below_ ordinary mastered music and so read "too
  loud" on every track forever — it is −0.3 now, which is the Windows limiter's
  own documented figure with two tenths of margin. And the automatic preamp
  shared its floor with a single band at −20 dB, while two bands an octave apart
  can peak near +26, so it reserved less than the chain took and clipped by
  construction. The automatic value reaches −60 dB now; the manual control keeps
  −20, because it is your thumb.
- **The preamp the config is actually using now reaches the window.** Nothing
  subscribed to the channel carrying it, so the slider and the final curve
  showed whatever was true when a switch was last clicked and then froze — the
  config carried −4.36 dB while the sidebar sat at −20.00 dB. The graph no
  longer computes a second answer of its own and overwrites the real one, which
  is what made the mode look like it did nothing.
- **The preamp dial paints before it writes**, so dragging it no longer waits on
  a round trip to the config for every pixel, and the number field comes back
  when auto-normalize is off — a dial is a poor way to ask for −6.5 exactly.
- **EQ Presets stopped the two layers clearing each other.** A published
  headphone correction and an imported set of bands are separate layers, and
  applying one no longer blanks the other. Both curves are drawn.
- **An output that drops out of the Equalizer APO config now says so.** A
  profile that cannot be read used to take its output out of the chain in
  complete silence, and the error surfaced later somewhere unrelated. It is
  written to the log, naming the output and the profile.
- **A profile name the disk cannot keep is refused as you type it.** Names
  carrying `: ? * " < > |` or a trailing dot used to be accepted and then fail
  as a file-permissions error that sent people looking at folder permissions.
- **Transcription no longer invents timings it never measured.** Whisper
  sometimes returns a whole verse collapsed onto one instant; those are now
  discarded rather than laundered into word timings, and the timings it did
  place are trusted and the rest sung onto the notes. Lines break where the
  singing pauses rather than mid-phrase.
- **Vibrato no longer shatters a held note into a dozen**, and how long a note
  was held is decided by the stem rather than by counting syllables.
- **A sung aside is no longer read as a section label.** `[Ooh ooh ooh]` and
  `[x2]` stay in the song instead of being demoted to a heading and dropped.
- **The graph no longer stacks on itself in full screen**, the editor no longer
  goes see-through when it takes the whole window, and the video player can ask
  for the whole window and get it.
- **The Look designer opens on the look you are actually using**, without
  repainting the graph the moment it appears and without resuming somebody
  else's abandoned draft.
- The release button lets go when it is clicked rather than four seconds later.

### Faster

- **The library scan runs in a process of its own**, so a folder of ten thousand
  files no longer holds the window still while it is read.
- **Tags are read through the file's headers instead of loading every file
  whole** — the difference between reading a few kilobytes and reading forty
  megabytes, once per track.
- **A scan sends its batches rather than the whole library each time.** A
  five-hundred-track folder used to send five hundred copies of a list that grew
  as it went.
- **One cached thumbnail per cover, not one per track.** Two hundred tracks from
  one album share one file instead of writing the same picture two hundred
  times.
- **Only the rows and tiles near the viewport are mounted**, and the list grows a
  page at a time, so scrolling a large library stays smooth.
- Three ways the library held on to things it was finished with are closed, so a
  long session no longer grows.

---

## 1.4.0

FluidEQ 1.4 turns the Karaoke Maker into a complete local production studio.
It can split a song into voice and backing tracks, transcribe the words, follow
the sung melody and carry the result all the way into the player. The Maker and
player were also rebuilt around the same transport, so moving between them now
feels like two views of the same song instead of two different tools.

### New

- **Separate a song into voice and backing tracks, entirely on your PC.** The
  Karaoke Maker can now prepare both stems from an ordinary song, keep them with
  the saved draft and restore them when the project comes back. Each stem can be
  heard alone, and voice, backing and melody guide each have their own level in
  the shared transport.
- **A stronger local lyric and melody pipeline.** Transcription now uses
  Whisper large-v3-turbo and asks for the song's language instead of guessing;
  every language the model supports is available. Melody detection uses RMVPE
  with SwiftF0 as a fallback, follows phrase attacks and singing contours more
  naturally, and decodes stable notes with a Viterbi pass. Downloaded models,
  decoded audio and GPU memory are managed explicitly, with a visible way to
  release the memory when the work is finished.
- **The response graph can live over the Karaoke player.** Double-click or use
  the expanded/fullscreen graph view while Karaoke is playing and the graph is
  drawn over the stage, with its own visibility and blur controls. Karaoke
  remains sharp, and the graph menu and pet make room for the song controls.
- **Double-click the Karaoke stage to enter or leave fullscreen.** Buttons,
  sliders and other interactive controls are protected, so an ordinary control
  click never changes the window mode.
- **The OPRA headphone-correction library replaces the retired AutoEq data.**
  It brings a current catalogue of more than 6,200 products and 12,000 curves,
  keeps the measurement author and source attached to each correction, and can
  update independently with the database carried on every version release.

### Changed

- **The Karaoke player and Maker now use one transport.** Play, seek, skip,
  backing, voice and melody-guide controls have the same icons, proportions and
  bottom position in both views. At narrower widths the large level sliders
  become compact buttons whose menus hold the same settings instead of forcing
  the bar to overflow.
- **The Karaoke Maker has a responsive, two-level header.** Editing tools sit in
  the header rather than stealing a row below the preview; they stay centred
  when there is room and wrap onto their own header line when there is not.
  Playback stays in the bottom transport, and the entire editor contracts for a
  13-inch screen without hiding tools or stacking them over the title.
- **Karaoke lyrics focus more like a stage display.** The current line is larger
  and brighter, the surrounding lines fade with distance instead of disappearing
  into a dark wall, and switching between player and Maker uses a short,
  low-cost transition without moving the bottom controls.
- **Responsive workspaces use the whole window.** Media and Karaoke now fill the
  available height on tall, narrow windows; the side controls scroll instead of
  overlapping; the titlebar waveform gives up width before transport buttons do;
  and graph, player and Maker panes keep bounded heights at the mobile breakpoint.
- **Profiles belong to their output device.** Each device now has its own profile
  folder, deleting a profile asks first, and removing some other profile no
  longer changes the current selection.
- **Visualizer choices show what they look like before playback starts.** The
  look picker renders a representative frame, and the live-output strip has a
  compact wave size available from the existing size shortcut.
- **EQ Presets received a layout and interaction polish.** Clearing the editable
  bands no longer makes the selected reference correction lose its name.

### Fixed

- **The titlebar waveform now follows the sound the meters are showing.** It
  reads the left and right channel analyzers directly, so opposite-polarity
  stereo can no longer cancel into a flat trace while both meters are active.
- **The mobile response graph no longer grows the page forever.** Its narrow
  layout has a bounded viewport-relative height and cannot use its own new size
  as the next flex measurement. Media and Karaoke no longer stop halfway down
  the same narrow window either.
- **Karaoke controls no longer collide in expanded graph or fullscreen views.**
  The graph options, titlebar, pet, chords, lyric-size control, playlist button
  and bottom transport all reserve the space they need, whether the top bar is
  shown or hidden.
- **The Karaoke transport no longer drifts between player and Maker.** Both
  surfaces use the same bottom inset and padding, percentage labels no longer
  squeeze into neighbouring controls, and the backing-only label remains inside
  its own menu at small widths.
- **The Maker's header and tools no longer overlap.** Long titles truncate,
  action groups shrink before they collide, and tool buttons keep a consistent
  icon size instead of expanding with the row.
- **Core tab changes no longer flash through a dark frame.** EQ, EQ Presets,
  Voicing and Convolution remain opaque while their content changes, matching
  the already-stable Media and Karaoke tabs.
- **Saved Karaoke stems and guide vocals recover cleanly.** Restored stems are
  adopted instead of separated again, the guide vocal can rebuild itself after
  an interrupted render, solos stay contained, and drafts follow the source
  content rather than a temporary filename.
- **The embedded Media browser and app window have an explicit content security
  policy.** External navigation is constrained to the intended browser flow,
  and Chromium page zoom cannot accidentally resize the whole interface while
  the timeline keeps its own wheel gestures.
- **Output and profile state no longer invents folders for missing devices.**
  Windows output discovery is kept separate from profile writes, and an absent
  output cannot leave behind a phantom profile location.

---

## 1.3.1

Mostly the Auto normalize switch, which was getting the level wrong in three
different ways and showing the wrong number in a fourth. Also: the Karaoke Maker
had no way back to the song you started from, and these release notes had no
obvious way out.

### New

- **Restore original, in the Karaoke Maker.** Next to Undo and Redo. It throws
  away the whole session and rebuilds the karaoke exactly as it was imported,
  saved draft included — for when an edit went wrong several steps ago and
  undoing one at a time is not the way back. It is itself undoable, so pressing
  it by mistake costs nothing.

### Changed

- **Turning Auto normalize off no longer puts back an older preamp.** It used to
  restore whatever the slider was last moved to, which meant switching off could
  jump the level to a number from some earlier session. Nothing is remembered
  now: switching off keeps the level Auto normalize had arrived at and hands the
  slider control of it, so the switch decides who is in charge of the volume and
  never the volume itself.
- **The release notes have an OK button.** The corner ✕ is what you reach for to
  escape something, not what you press when you have finished reading. OK sits
  at the bottom right, outside the part that scrolls, so a long changelog never
  hides it — and it holds the focus, so Enter closes the notes.

### Fixed

- **Turning Auto normalize on shows the reserve it just worked out.** On the
  Karaoke tab the preamp stayed on the old manual number, so the switch looked
  like it had done nothing. The sound was always right; the display was not, and
  only on tabs without the response graph — everywhere else the graph quietly
  corrected it a moment later.
- **Turning Auto normalize off no longer makes everything louder.** It published
  0 dB instead of the reserve that was actually in force, so a chain holding
  back 11 dB got 11 dB louder from one click of the switch whose whole job is to
  stop it clipping.
- **`Preamp: -19` is read as -19.** A preamp line without the unit was read as 0
  and still reported as a successful import, so the file loaded and played at
  the wrong level with nothing to say so. The unit is optional now, like every
  other tolerant field in that parser.
- **An imported preamp is no longer overruled without a word.** Automatic
  normalization recomputed over the value the file asked for, so what played was
  our number rather than the exported one. A file that carries a preamp line now
  switches automatic mode off, and the import result says that it did.
- **Profile names can no longer reach outside the profiles folder.** A saved
  profile is stored under the name you give it, and that name was being used to
  build the file path without checking it stayed where it belonged. Loading,
  saving, renaming and deleting all check now, and a name that would land
  somewhere else is refused rather than quietly rewritten.
- **Links only open in a browser if they are browser links.** Anything the app
  offered to open externally was handed to Windows as-is, which is not the same
  thing as opening a web page. Only `http` and `https` are passed on — the
  Remote Media player already worked this way, and now the rest of the app does
  too.
- **Rainbow mode switches off properly the first time you win it.** Turning it
  off in the session it was earned in left most of the colour on screen —
  parts of the app went back to normal and the rest kept celebrating. It looked
  fixed after a restart, which is why it was easy to miss. Off means off now,
  whenever you ask for it.

---

## 1.3.0

1.2.0 could play a karaoke file. This one can make you one, out of a song and
nothing else: the words come out of the audio, the timing comes from you tapping
along, and the melody is read off the recording. What comes out is a file the
Karaoke tab plays like any other.

The rest is about trust. A copy of FluidEQ can now tell you where it came from,
and updates arrive only from the place the build in front of you was actually
published.

### New

- **A Karaoke Maker.** Open a song and it walks the whole way to a finished
  karaoke file. The lyrics can be transcribed from the audio, or pasted and kept.
  Timing is recorded by ear — play the track, mark each line as it starts and
  ends, then go back and mark individual words where a line needs the detail;
  every mark can be nudged earlier or later rather than redone. The melody is
  analysed off the recording into notes you can hear, split, delete, retune or
  add to by hand. There is a count-in preview, undo and redo throughout, and the
  result goes straight to the player or saves as a project to come back to.
- **The lyric transcription downloads a model the first time you use it.** It is
  a speech-recognition model fetched from Hugging Face, and it is the one thing
  in FluidEQ that reaches the network for something other than an update. It
  happens on your press, not on launch, and every other part of the Maker — the
  timing, the melody analysis, the audio itself — runs on your machine. If you
  would rather nothing was fetched, paste the words in instead and the rest of
  the Maker works exactly the same.
- **A copy of FluidEQ will tell you where it should have come from.** The licence
  lets anybody copy, change, rebuild and sell this program, which is as it should
  be — but it also means somebody can hand you a build and call it ours. There is
  now a panel naming the official site and the official repository, and saying
  plainly that a download claiming to be official without a valid Windows
  signature is neither.

### Changed

- **Updates come only from where your build was published.** The build from
  GitHub updates from GitHub, exactly as it always has. The signed build updates
  only from its own address and never from the public repository, because signed
  installers are not published there. Which one a copy is was decided when it was
  built and is compiled into it, so it cannot be changed by editing a file in an
  installed copy. Each side checks what it downloaded before running it — the
  signed one that the signature is ours, the GitHub one that there is no
  signature at all — so an installer that ended up in the wrong place is refused
  rather than installed. Development builds do not update at all.
- **The window opens at nine tenths of your screen, centred**, or maximised on
  anything below 2K. It used to open at a fixed 1428×625, centre itself for that
  height and then grow to 1036 from the same corner — which, on a 1080p screen,
  put its bottom edge under the taskbar on the very first launch.

### Fixed

- **Signing in works in the Media tab.** Sites that hand their sign-in to
  somebody else — Suno through Microsoft, Twitch through Amazon, and the Apple,
  Discord and Facebook buttons wherever they appear — used to reach a page the
  player refused, which looked like a broken login. Each of those sign-in hosts
  is now named, one at a time and never as a wildcard, because a page here can
  hold a live login and the list is the whole boundary. Google is listed too, but
  decides for itself whether to allow an embedded sign-in and often will not;
  that one is not ours to fix.
- **Suno's old address resolves.** `suno.ai` still answers and redirects to
  `suno.com`, and a redirect the player would not follow was a dead link.

---

## 1.2.0

FluidEQ has a Karaoke tab: songs you already own, with the words, your pitch
drawn against the melody, and the chords guessed out of the backing track. It
ships no music and downloads none.

The rest of the release is about the config on disk. Your own APO commands are a
layer you can see, an edit made in APO itself no longer goes unnoticed, and
auto-normalise takes back a decision from 1.0.0 that you will hear.

### New

- **A Karaoke workspace, built out of your own files.** Open a song, add a
  folder, or drop files anywhere on the window. Audio can be MP3, WAV, OGG, FLAC
  or M4A; lyrics can be `.lrc` for line timing, enhanced `.lrc` for word timing,
  or an UltraStar `.txt` for syllables and real target notes. Files sharing a
  name pair into a playlist you can reorder, remove and pick through, and where
  the pairing is genuinely ambiguous FluidEQ asks instead of guessing. A file
  this build of Chromium cannot decode says so rather than being called
  supported.
- **Lyrics that follow the track rather than a timer.** Every frame asks the
  audio where it has got to instead of counting forward on its own, which is what
  keeps a long song from drifting away from its words. Where the file carries
  word or syllable timing, the current line fills as it is sung. Scroll to read
  ahead without moving the music, click a line to jump to it, and set the text
  size to whatever you can read from across the room.
- **A pitch lane, honest about where the target comes from.** Turn on a
  microphone — chosen from a list, never opened without your press — and your
  pitch is drawn live, named as a note, and marked high, in tune or low. Target
  notes appear **only when the song file actually contains them**, which today
  means UltraStar. An `.lrc` or a bare audio file gets a working live tuner and a
  line saying there is no target pitch in this song, not an invented melody drawn
  under your voice. There is no score in either case.
- **A melody guide tone.** Where a song does carry target notes, FluidEQ will
  play them as a soft tone at its own volume, so the melody is something you can
  hear rather than something you read off a lane.
- **A performance review.** The places you sang high, sang low, or missed are
  collected as a list of times; pick one and the song jumps there and counts you
  in — 1, 2, 3, GO.
- **A chord guide.** FluidEQ analyses the backing track and shows the chord under
  the playhead and the one coming next, with the seconds until it arrives. It is
  an estimate made from audio and says so: it reports its own confidence, admits
  when it cannot find a stable chord, and knows major and minor triads and
  nothing else.
- **A full-screen stage.** The window goes to the lyrics, the floating controls
  fade after two seconds of stillness and come back the moment you move, and the
  FluidEQ header can be hidden. Playlist, microphone panel and pitch lane all
  resize and remember their sizes. Your playlist, its order, the selected song
  and the playhead all come back when FluidEQ next opens.
- **The microphone is measured, not recorded.** It opens on an explicit press and
  is released the moment you leave the Karaoke tab. Nothing is recorded, nothing
  is sent anywhere, and it is not played back through your speakers, so you hear
  yourself in the room. Echo cancellation, noise suppression and automatic gain
  are all turned off, because each of them rewrites the pitch being measured —
  which also means a microphone sitting beside a loudspeaker will be heard
  singing along with the record. The song keeps playing when you visit another
  tab. The microphone does not.
- **What it is not.** Karaoke does not strip the vocal out of a recording, change
  its key or its tempo, or separate it into stems — an instrumental is something
  you bring. There is no permanent library and no account.
- **Your own Equalizer APO file is a layer like any other.** 1.1.0 gave each
  output a file FluidEQ creates and never writes to, for the APO commands that
  have no interface here — and then ignored what you put in it. Its filters are
  now drawn on the graph in orange, named by a chip that switches off like every
  other layer, and counted in the preamp, so a custom file that boosts no longer
  pushes the chain past the reserve. Only `Preamp`, `Filter` and `GraphicEQ` are
  read: a `Plugin`, `Copy` or `Delay` line gets the chip but no curve and no
  headroom, and the chip's clear button empties the whole file including those
  lines.
- **An edit made in Equalizer APO itself shows up while FluidEQ is open.** Change
  a gain by hand in one of the layer files and the app adopts it, redraws it,
  re-derives the preamp and saves it into your profile, with the layer's chip
  renaming itself to say where the change came from. Where the edit uses a filter
  type FluidEQ cannot represent it is refused silently — your file is left as you
  wrote it, but nothing on screen says the two have stopped agreeing.
- **The AutoEQ and convolution searches remember what you looked for**, the way
  the player's search box already did, with one press to forget all of it.
- **The warranty disclaimer is something you can read, in your own language.**
  Sections 15 and 16 of the GPL have always been in `LICENSE`, in every file
  header and on the installer's licence page — in all three in the register of a
  licence rather than of a sentence, which is a way of being present without
  being read. The same terms are now put in front of you once, on first run, in
  all ten languages: no warranty, and no liability for damage to hearing, to
  equipment, or to data. Nothing in it is a new term. It says that some countries
  do not allow those exclusions and that where that is so, the law wins and the
  notice takes away none of the rights it gives you. There is a Quit button
  beside Accept, because a notice you can only agree to is not a notice, and the
  same text stays in the About panel to be re-read. What is stored is the version
  of the notice, the version of the app and a timestamp — anything FluidEQ cannot
  read back is shown again rather than assumed accepted.
- **A release can say that it must not keep running.** If a version ever ships a
  fault bad enough that carrying on with it is the wrong thing, the release that
  fixes it can be marked as such, and installs from 1.2.0 onward will say so
  rather than waiting to be noticed. It asks rather than blocks: the notice
  closes, says plainly that closing it means later and not no, and returns every
  fifteen minutes until the update is in. The download runs while it sits there,
  and if the download or the install fails it says which of the two and gives you
  the release page as a link and as text. It is not a kill switch — Equalizer APO
  applies its files whether FluidEQ is running or not, so nothing here can take
  your audio away.

### Changed

- **Auto-normalise reserves against the whole curve again.** 1.0.0 started
  discounting a boost by how little music usually holds at that frequency — up to
  8 dB of it in the treble. "Usually" is not what a preamp is for: a recording
  that does reach full scale at 12 kHz was clipped by the reserve meant to
  prevent exactly that. The allowance is gone and the reserve is measured against
  the real peak of the chain. A chain whose largest boost is in the treble is
  several decibels quieter than it was in 1.1.0, everything else is 0.2 dB
  quieter, and nothing gets louder — some system volumes will want turning up. A
  cut no longer buys makeup gain unless the whole curve sits below unity.
- **A convolution file is measured rather than sketched.** The impulse response
  is analysed when it arrives, so the graph draws the file's own response instead
  of the approximation published beside it, and a locally imported WAV — which
  used to draw nothing at all — has a curve. The preamp reserves against what the
  file actually does, so most published responses come out slightly louder and a
  hot one is brought down rather than left to clip.
- **Squiglink is a link now, not a second library.** Browsing GadgetryTech from
  inside FluidEQ has gone, and the measurement-source picker with it. In its
  place is a guided import: open Squiglink in your browser, export the EQ text,
  then paste it or open the file here, with the curve previewed before anything
  is applied. This is the smaller feature and it is worth saying so — what
  arrives becomes your editable bands rather than a headphone layer of its own,
  so it does not survive clearing the EQ. A correction already applied from that
  database keeps playing; the pickers no longer name it.
- **The Ctrl+W cycle trades a stop nobody used for one worth having.** Still five
  stops: `Everything → Layers over wave → Curves only → Clean → Wave only`.
  `Layers only` has gone — it differed from `Curves only` in the weight of
  exactly one line — and `Clean` takes its place: every curve, the grid, the wave
  and the band handles still drawn, without the nine tinted columns that brighten
  as Smart EQ hears each range. That is the state for watching a measurement run
  rather than watching a wash of grey settle over the curves.
- **Every curve can be switched off from the View menu**, not only the EQ line —
  and hiding that line now only hides it, leaving the other layers up to read
  against, where before it quietly rearranged the whole plot. The legend runs in
  the order Equalizer APO applies the layers. The graph also remembers per tab
  whether it was open and how the space was split, so closing it on Convolution
  leaves it open on EQ.
- **The Video tab is called Media**, in all ten languages, and **Config sits at
  the far edge of the tab strip**, away from the tabs that change the sound.
- **Euphoria mode is called Rainbow mode.**
- **What's new opens on the version you just installed.** After an update the
  dialog is answering "what changed", so it shows that one section and stops.
  Opened from the actions menu it is answering "what happened", and the whole
  history is there as before.
- **The installer offers Hindi.** The app has shipped ten languages and the setup
  offered nine, and the setup is the one place a missing language cannot be put
  right afterwards: it picks its language before the app has ever run, so
  somebody handed English there never reaches the menu that would have told them
  otherwise.
- **The Support panel says what is actually sold.** It told you that nothing was
  behind a paywall, which stopped being true the moment a signed build went on
  sale. It now says the arrangement as it stands: the source is public and you
  can always build it yourself for nothing, and what is sold is the signed,
  ready-to-run build. Nothing is tracked, and that has not changed.

### Fixed

- **Smart EQ at zero strength keeps its chip.** A measured correction turned all
  the way down was dropped out of the state altogether, which took away the
  slider that would have brought it back.
- **A dropdown you can search puts the cursor in its search box.** The list is
  drawn outside the control it belongs to, and the field was being looked for
  inside it, so opening one and typing went nowhere.
- **The release notes fill the width they are given.** Every line of this file
  was drawn as a paragraph of its own, so its eighty-column wrapping became the
  layout: the prose broke two thirds of the way across a wide window, and the gap
  between two paragraphs looked no different from the gap between two lines of
  one. Lines join until the next blank one now, the way list items always did.
- **A button near the top of a dialog takes a press.** The titlebar's drag region
  runs the full width of the window, and a dialog painted over it changes what is
  drawn rather than what the mouse hits — so About, Support, the bug report, the
  audio troubleshooter and the score card all had a dead band across the top,
  their close buttons included.
- **The band sliders ask for a length the card can give them.** With the graph
  switched off the track was measured against 330px of surrounding chrome where
  there are really 544px, so every window between the 620px minimum and roughly
  950px promised the row about 214px more than it had: the panel scrolled, the
  captions bunched at the top and the lower arrows went off the bottom edge.
  Above 950px the arithmetic came right on its own, which is how it survived.

---

## 1.1.0

Equalizer APO's configuration used to be one block per output, with every layer
poured into a single run of numbered filter lines and nothing in it saying where
the voicing stopped and your own bands began. It is now a file per layer, and
that is where most of what follows comes from: a layer with a file of its own can
be switched off without being taken apart, told apart from your own tuning when
FluidEQ starts up again, read on disk, and sent to somebody else.

### New

- **Any layer switches off without being lost, and every correction has a
  strength.** Switching one off leaves its file out of the chain rather than
  clearing its settings and stashing them, so pressing the switch again puts
  exactly the same thing back, and it survives a restart. Your bands can finally
  have a switch of their own, so can the impulse response, and Smart EQ has
  joined the driver, headphone and voicing layers in having a strength — half of
  a measured correction is a reasonable thing to want when the measurement is
  more confident than you are.
- **A headphone correction is a layer of its own, on a page of its own.**
  Applying a published measurement used to replace your bands outright, so
  clearing the EQ threw the correction away with your tuning and Smart EQ read it
  as error and flattened it over a few passes. It now sits beside your bands with
  its own chip, strength, switch and curve, from either headphone database.
- **Continuous EQ.** Pressing Smart EQ applies one measurement whole; this is a
  mode instead — measure, move a fraction of the way, measure again, for as long
  as there is music — so one track's emphasis and the next one's cancel out and
  only what every record agrees about survives, which is your headphones and your
  room. **Detail** corrects peaks and dips, **Balance** also evens out a bright or
  warm recording, and **Target** brings every record to the same tonal balance.
- **A Config tab, showing what is actually on disk.** Every other panel shows
  what FluidEQ intends; this one shows what Equalizer APO has got, and the two
  differ exactly when it matters — after a hand edit, another tool, a restore
  from backup. Each output also gets one file FluidEQ creates empty and never
  writes again, applied last, for the APO commands that have no interface here.
- **Send a chain to somebody.** A whole output's tuning exports to a `.fluideq`
  file and imports back, always onto the output you are listening to, because
  that is the only one you can judge the result on.
- **Media buttons in the title bar** — previous, play/pause and next, commanding
  whatever is playing anywhere on the computer rather than only our own player.
  Expect up to a second between the press and the track changing. Windows only.
- **Play to a second output at the same time**, with a level for each and nothing
  to install. What it is not: the sound arrives about a fifth of a second late,
  so it suits music in another room and not video; it runs only while FluidEQ is
  open; and every mirror carries the correction of the device you are listening
  on, because that is in the sound before FluidEQ sees it.
- **A level meter that reads in real decibels**, both channels separately.
  Nothing on screen answered "how loud is this, really" before.
- **Eight genre voicings** — rock, metal, pop, hip-hop and R&B, electronic, jazz,
  classical, acoustic — beside the five that were already there.
- **The graph remembers each of its sizes separately**, so arranging the plot for
  a video in full screen no longer rearranges it for editing bands afterwards.
  The legend is a set of switches, one per curve, and the View menu can switch
  off the level meter and the title-bar wave.
- **The player stays signed in between runs.** It ran on a session thrown away
  when the app closed, which made it no use to anyone with an account: a
  signed-out music service shows ads to somebody who pays not to see them. The
  guarantee changes from "nothing is kept" to "nothing is kept that you did not
  ask for, and one press throws all of it away" — that press is a new button in
  the player's toolbar, always visible.

### Changed

- **Auto-normalise gives volume back as well as taking it away.** The preamp
  could only ever attenuate, so a chain that merely cut made everything quieter
  and nothing put it back. It will not invent volume either: a narrow cut
  restores nothing, because away from its centre the chain never moved.
- **Smart EQ measures the record, not what you have already done to it.** It
  treated everything it heard as correctable, so it could not see past a cut —
  a range dropped 20 dB by mistake hid the very evidence that the cut was wrong.
- **Loudness has been removed.** It was an EQ curve wearing the name of something
  Equalizer APO cannot do: a loudness control on an amplifier raises perceived
  level, and APO has filters and nothing else. Measured, it lifted the ends by
  4.5 dB, the preamp reserved 4.1 dB against that boost, and the midrange ended
  five decibels down — turning it on made things quieter. The equal-loudness
  voicing curve stays, being the same idea stated honestly.
- **Spotify and SoundCloud have gone, and Suno is being tried.** A button leading
  to a page that does not play is worse than no button. Spotify signed in,
  browsed and searched perfectly and never played a note, its audio being
  encrypted with a system this runtime has no decoder for; SoundCloud refused a
  sign-in by all four of its routes without producing a single error anywhere we
  could see. Suno is on the same terms as everything else: it stays only if it
  works.
- **A published correction reaches Equalizer APO as the curve it was published
  as.** Some ship as a list of points rather than as filters and APO draws those
  natively, where until now it was FluidEQ's approximation being written out.
  Nothing on screen ever showed the difference — only the file APO reads.
- **On startup, FluidEQ can tell which layer wrote what.** It used to refuse to
  read a config back at all while any layer was live, because a voicing and a row
  of hand-placed bands looked identical in the text. That refusal now applies
  only to a flat config, and which layers you had switched off comes back too.
- **Zoom moves in half steps**, about 9.5% a press instead of 20%, because
  settling on a size is what people actually do with it.

### Fixed

- **A chain somebody sends you can no longer carry code into Windows audio.** A
  `.fluideq` is advertised as a settings file, and the part of it holding your own
  Equalizer APO commands was written into the config word for word — into a file
  included all the way up to APO's own, in a language that can load libraries. An
  imported block is now refused if any line loads code, includes another file, or
  carries a control character that could end one command and start another; the
  rest of the chain still imports, and the panel says what was dropped and why.
- **The player no longer writes sign-in addresses to the log.** Every address it
  navigated to was recorded whole, and the report-a-problem tool attaches the
  tail of that log and offers to post it publicly. The tail of a sign-in address
  is not a location, it is the credential.
- **The player stopped handing a storage permission to anything that asked**, and
  an impulse response file name can no longer smuggle a second command past the
  config writer — a newline in a name ends a line in an Equalizer APO config.
- **A band drag starts where you grabbed it.** Pressing a handle threw the band
  upward before the cursor had moved a pixel, and grabbing one off-centre snapped
  it by however far off you were: it was measured against the drawn curve rather
  than against your pointer, and the two had stopped being the same curve.
- **A layer that is switched off stays switched off.** Smart EQ preserved the
  voicing, the driver and the headphone correction whether or not you had
  bypassed them, so it looked for shapes that were not in the sound and rebuilt
  the layer you had just switched off inside its own.
- **Importing a chain no longer destroys the thing being imported.** It dropped
  the headphone correction on the way in, then saved the profile back from what
  was live a moment later.
- **Clear on the AutoEQ page clears the correction and leaves your bands alone.**
  It flattened every band, which was right back when clearing a reference meant
  undoing the bands it had written — so it wiped a tuning it no longer owned and
  left the correction playing with nothing on screen naming it.
- **A strength slider can always be moved.** It was disabled while its layer was
  off, which pinned the strength wherever it happened to be. Dragging it brings
  the layer back, dragging it to zero switches the layer off, and switching a
  layer on from zero goes to full.
- **The bands do not vanish when every one of them is at zero.** A flat chain is
  written as a preamp and no filter lines, because a band at 0 dB does nothing —
  but read back, "no filters" and "no bands" look identical.
- **A switched-off equaliser cannot be edited**, and neither can the band handles
  with the engine off. Both stayed draggable while looking inert, so you could
  spend a minute shaping a curve connected to nothing.
- **The EQ chip is about the bands**, which is all it holds now; it was naming
  itself after the headphone model, so one pair of headphones appeared twice in
  the same row. The headphone chip no longer vanishes at zero strength either.
- **Opening a dropdown no longer takes the pane's scrollbar with it**, freezing
  the panel and letting its content jump sideways into the gutter. The View menu
  measures itself rather than running off the bottom of the screen, and the
  expanded graph has its left edge back.

---

## 1.0.0

The version number is the only thing here that changed suddenly. FluidEQ has
been a finished program for a while — automatic per-output profiles, four
processing layers written into one Equalizer APO config, a measured correction,
ten languages, an updater that works. What it did not have was a video playing
underneath the spectrum, and that is what the last two releases were for. It
works now, on every site it offers, in every size the graph comes in.

So: 1.0. Not because a milestone was reached, but because calling it 0.x had
stopped being honest.

### New

- **Switch any layer off without losing it.** Press a chip in _Also applied_ and
  that layer leaves the config — the chip stays, dimmed, and pressing it again
  puts the same settings back. Nothing is recomputed, because nothing was lost.
  It is how you find out whether a correction is actually an improvement:
  the same passage, both ways, a second apart. Voicing, driver, Smart EQ and
  loudness for now.
- **The bands have a chip of their own**, named by the model they came from and
  the measurement behind it, or by how many bands there are when you placed them
  yourself. It says _(modified)_ once you have moved them, so the label never
  claims a curve that is no longer on screen.
- **Loudness moved in with the other layers**, off the waveform meter. It is
  written into the Equalizer APO chain like everything else in that row, and it
  belongs where the rest of them are. Euphoria mode now brings it with it, and
  takes it away again.
- **Full screen, rebuilt.** The window takes the whole display, the side panes
  go, and the picture reaches all four corners. The controls become a small card
  that fades out when nothing is happening and comes back when you move — click
  the drawing to hide or show them at once. The creature stays in the corner.
- **Keep the top bar in full screen**, from the View menu, if you would rather
  see where you are. On by default.
- **See through and Blur are in the View menu**, where there is room for them,
  instead of taking half the control strip.
- **Every site remembers where you left it.** Switching between YouTube, YouTube
  Music, SoundCloud, Bandcamp and Twitch now comes back to the track that was
  playing, a few seconds before where you stopped, and carries on. Only one
  player ever runs, so leaving a site still stops it — this is what makes coming
  back cost nothing. Pressing the site you are already on goes to its front
  page.
- **The wave can hang, mirror, or grow from the middle.** Ctrl+I steps through
  four shapes: standing up, hanging down, mirrored into two halves that share
  the height, and mirrored outward from the centre line.
- **Stretch the wave** across the whole card. With the grid hidden there is no
  scale to leave room for, so the drawing takes the space the labels were using.

### Changed

- **Less is taken from your volume.** The preamp reserves headroom against what
  music actually contains rather than against a flat signal to 20 kHz — a boost
  at 12 kHz can never cost its full value, because nothing arrives at full scale
  up there. Chains that were quiet for no audible reason get several decibels
  back, and are no closer to clipping than before.
- **Smart EQ always measures from flat.** The switch that asked has gone: a
  region already cut hard has almost no energy left in it, so measuring the
  corrected output means the correction hides the very problem it is causing.
  There was only ever one right answer.
- **The chain reads in the order it makes sense.** Convolution, then the driver
  correction, then your bands, then voicing, then Smart EQ last — physical,
  intended, taste, measured. Nothing sounds different; the config is now
  readable at two in the morning.
- **Only the live trace gets the rainbow.** The other curves keep the colours
  their legend names them by, which is what makes the legend worth having.
- **Vimeo has been removed.** It renders its listings entirely on the client,
  from an API that returns nothing to a session it does not recognise — search,
  Staff Picks and the watch feed all arrive with their tabs and filters and not
  one result. FluidEQ's player is signed out by design and always will be, so
  that is the only Vimeo it can ever see. A button onto an empty page is worse
  than no button.
- **The player signs into nothing, and remembers nothing.** Its session is held
  in memory and dies with the app, and sign-in is turned away at each site's own
  front door. No account of yours is ever the identity behind what it does.
- **A refused link leaves you where you are.** Following one that goes outside
  the player used to move you to a different site's front page; now the page you
  were on simply stays, with a note saying what was refused.

- **The spectrum is drawn on a canvas.** Both of them — the one across the
  graph and the small meter in the title bar. They were built out of SVG paths
  before, which meant that thirty times a second the browser was handed a fresh
  description of the shape as text, several thousand characters of it for the
  denser looks, and asked to re-read it, re-measure it and repaint that part of
  the window. A canvas is told to draw and draws. Nothing about the looks
  changed: the same forty-six of them, the same palettes, the same glow, all
  built by the same code — only what receives the drawing is different.
- **The graph no longer redraws itself for sound it is not showing.** The chart
  woke up around twenty-two times a second whether or not the wave was on
  screen, rebuilt everything it owns, and threw the result away. Now only the
  parts that actually show live audio listen for it: the wave, the clipping
  warning, and the measurement overlay.
- **The controls above the graph sit on a panel of their own** instead of
  floating loose over the drawing, and in full screen there is one panel rather
  than a panel inside a panel.
- **The filter types are drawn against a shared 0 dB line, and named.** They
  used to sit on two different baselines — a peak rising off the floor next to
  a low shelf falling from the ceiling — which made a shelf read as a treble
  cut and made the pairs look swapped. They are mirror images of each other now,
  and the band editor spells out which is which.

### Fixed

- **Expanded view and full screen hold steady.** Moving between the two, or
  playing one video after another, used to leave the picture missing until the
  page was reloaded. Both now give the video the whole pane, every time and in
  any order.
- **YouTube Music fills the pane properly**, with no dark band down its side.
- **Twitch fills it too**, with no band along the bottom.
- **The editor stops moving while you tune.** The _Also applied_ row used to
  appear out of nothing the first time a layer went live, pushing everything
  below it down mid-drag. It now holds its line whether or not there is
  anything in it.
- **The player says what it refused.** A link that went nowhere used to go
  nowhere silently, which is indistinguishable from a broken page. Refusals,
  failed loads and the page's own errors are now in the log.
- **Editing several bands at once no longer fails.** Every band in a selection
  sent its own request, and each of those rewrote the whole Equalizer APO
  configuration. Ten selected bands meant ten rewrites for one turn of a knob,
  which was slow enough that the edit gave up and reported a timeout — while
  having worked. A group edit is one write now. Frequency is left out of it on
  purpose: it is what tells the bands apart, and moving them all by the same
  number of hertz stacks them on top of each other.
- **The band editor closes when you deselect.** It used to fall back to the
  first band whenever nothing was selected, so clicking away left it open on a
  band that was highlighted nowhere — and moving a control edited a band you
  had just let go of.
- **Less memory is used while the graph is open.** Some of what the graph
  allocated was never handed back; less of it is now. This is an improvement
  rather than a conclusion — the remaining growth is still being tracked down,
  and closing the graph pane has always released it.
- **The live capture cleans up after itself.** Starting it crosses two points
  where it can be cancelled, and neither was checked, so a capture could
  survive the request to stop it — along with a timer and a listener that
  nothing could reach afterwards.
- **Euphoria stops doing work nobody can see.** It published a value several
  times a second that no stylesheet ever read, which made the browser
  recalculate the whole window's styling for nothing, and it left its glow
  layers in place after the mode ended.

---

## 0.10.0

### New

- **A Video tab.** A player inside FluidEQ — YouTube, YouTube Music, SoundCloud,
  Bandcamp, Vimeo, Twitch — so a track can be tuned while it plays, with the
  spectrum moving underneath it. It is not a browser: it goes to those sites and
  nowhere else, deliberately.
- **The search box remembers.** What you looked for before comes back as you
  type, closest matches first, with a cross on each to forget it. Anyone
  checking a crossover plays the same reference track twenty times in a week.
- **Two sizes for the graph, on one menu.** _Expand view_ (Ctrl+S) floats it
  over the workspace while you keep working; _Full screen_ (Ctrl+F) gives it the
  whole screen and takes the video player fullscreen with it. Escape comes back
  from either.
- **See through the graph.** In full screen, two sliders decide how much of what
  is behind shows through and how hard it is blurred — all the way to a graph
  drawn straight over the video with no panel at all.
- **Hide the grid** (Ctrl+G), so nothing is left but the wave. Separate from
  _Wave only_ (Ctrl+W), which hides the EQ curves and keeps the scale.
- **Every shortcut is written down** in that menu, beside the thing it does.
- **Loudness.** One press, under the euphoria pill, and quiet listening stops
  sounding thin. The ear loses bass and treble far faster than it loses the
  midrange as the volume comes down — which is why music at low level sounds
  hollow rather than merely quiet — so this puts back what your hearing stops
  picking up. It reads as fuller while the peak level barely moves, and it
  cannot clip you: the preamp comes down to meet it automatically, the same way
  it does for every other layer. Not a compressor — Equalizer APO has no
  dynamics processing at all, and a control claiming otherwise would be lying.
- **Report a problem**, in the actions menu. It gathers the logs, strips
  anything that identifies you, shows you the whole thing, and lets you post it
  as a GitHub issue or email it privately. Nothing is sent until you press one
  of those, and you can read and edit every word first. Account names, file
  paths, email addresses and network share names are removed automatically.
- **Fix audio problems**, also in the actions menu. When the sound stops there
  are four things worth trying, they escalate, and until now they sat in a flat
  list with nothing to say which to press first or what each one costs you.
  This puts them in order — restart the audio service, re-select your devices,
  reinstall Equalizer APO, then remove and re-add the device across two
  restarts — with what each one fixes and what it will cost, and a button on
  every step that can be automated. Stop at the first one that works.

### Fixed

- **Signing in to YouTube closed the app.** Not the tab — the whole thing. The
  guard that turns back a link leading off the allowed sites was cancelling the
  navigation from inside the notification that it had started, and taking
  Chromium down with it.
- **The graph goes on watching after the audio device changes.** Reinstalling
  Equalizer APO, restarting the audio service or switching the default device
  leaves the capture running against an endpoint Windows has invalidated —
  live, silent, and never recovering. The trace simply stopped moving. It now
  notices and re-acquires.
- **The divider between the panes keeps its proportion.** It remembered a number
  of pixels, so a split set on a large monitor was most of a laptop screen — and
  the correction that kept the panes on screen overwrote the setting, losing it
  for good. It remembers the ratio.
- **Reinstall Equalizer APO says something useful when the installer is
  missing.** It showed the words `apo-bundle-missing` over "please restart the
  application". It now opens Equalizer APO's own download page, which is the one
  situation where that is the right answer.
- **The window's own errors reach the log.** Nothing in the interface had ever
  written a line to the file a bug report attaches, so a report about the part
  of the app you actually look at described everything except it. Crashes in the
  main process are recorded too, rather than leaving a window that just
  disappears.
- **"Equalizer APO is not responding" can be clicked.** It reopens the notice
  with the Install and Retry buttons — which, once dismissed, previously could
  not be reached again at all, because it only reappears when the error text
  changes and for a missing audio engine it never does.
- **The player comes back where you left it** after a restart, instead of on
  YouTube's home page.
- **The live trace is at full strength in _Wave only_.** It was drawn at half
  strength to sit under the EQ curves — which are exactly what that mode hides.
- **Ordinary limits stop calling themselves internal errors.** Adding a band
  when you already have the maximum, or removing the last one, answered with
  "Internal Error: Invalid parameter — please reach out to the developers".
  Nothing had gone wrong and no developer was needed. They now say what the
  limit is and what to do instead.

---

## 0.8.2

### Fixed

- **Euphoria mode could not be switched off.** Once you had earned it, the
  toggle did nothing — the mode was reading "your current streak is at the
  ceiling" as well as the switch, and a streak does not reset when you stop
  playing. So it stayed true forever and held the colours on no matter what you
  pressed. Winning is now a moment rather than a state: it unlocks the mode for
  good and switches it on there and then, and after that the switch is the only
  thing that decides.
- **The development shortcut invented a score.** In development builds, the
  button that jumps to euphoria used to write a full 19,350 points and a
  36-tap streak straight into the run — so the share card could show a number
  nobody had played for. It now only turns the mode on. Your score is yours.

### New

- **Ctrl+E turns euphoria mode on and off**, once you have earned it. Before
  that it does nothing at all: a shortcut that worked early would give away
  that there is something to find.

### Changed

- **The setup log records nothing that identifies you.** It was writing the
  install directory, which on a normal install contains your Windows account
  name. It now records only what happened — found, offered, declined, started,
  failed — so the file is safe to send to anyone without reading it first.

---

## 0.8.1

### Fixed

- **The installer offered to install Equalizer APO and then did nothing.** You
  said yes, no setup window appeared, and FluidEQ opened over the top of it
  without an audio engine. Equalizer APO's installer requires administrator
  permission, and the call FluidEQ used to start it cannot ask for it — it
  failed instantly, and the message saying so went into a pane that one-click
  installers do not show. It now asks properly, so Windows raises the
  permission prompt and APO's setup opens. If permission is declined, FluidEQ
  says so plainly instead of carrying on in silence.
- **FluidEQ could not tell whether Equalizer APO was already installed.**
  Installers run as 32-bit programs and Windows quietly redirects their
  registry reads away from where 64-bit software records itself, so the check
  always came back empty. Setup would therefore have re-run APO's installer
  over a perfectly good installation, and uninstalling FluidEQ could never
  offer to remove APO, because it could not find it either.
- **Uninstalling could not remove Equalizer APO** even when you asked it to,
  for the same permission reason as the install.
- **The Install Equalizer APO button inside the app was broken the same way.**
  It reported success, and no installer ever opened. Both places now ask
  Windows for permission properly.

### Changed

- **Setup writes a log.** Every decision it makes about Equalizer APO — found
  or not found, offered, declined, started, failed — goes to
  `%APPDATA%FluidEQlogsinstall.log`, next to the app's own logs. None of
  this was visible before, which is why the problem above survived a release.
- **A build missing its copy of Equalizer APO now says so** during setup,
  rather than skipping the step without explanation.

---

## 0.8.0

### New

- **Equalizer APO comes with FluidEQ.** It is inside the installer — nothing is
  downloaded and there is no second website to visit. Setup offers to run it,
  and APO's own installer opens so you can choose which audio devices to
  equalise and get its restart prompt from the tool that owns it. Already have
  Equalizer APO? It is left completely alone, whatever version it is. This was
  the worst moment in getting started and it is gone.
- **Uninstalling asks whether to remove Equalizer APO too**, and defaults to
  No. It is a system-wide audio component and other applications may be relying
  on it, so removing it is never the quiet default. Updating never asks.
- **The Install APO button inside the app runs the bundled copy** rather than
  opening a download page.

### Changed

- **The equaliser is properly inert without Equalizer APO.** The window still
  opens, the meter still runs and the graph still draws — the app is worth
  looking at either way — but every control that writes to the config greys out
  rather than looking live over an engine that is not installed.
- **The share card opens in its own window.** It used to replace the game
  inside the support panel, which meant a picture the size of the panel trying
  to fit inside that panel; on a short screen the buttons that save and post it
  ended up below the fold.
- **The support panel fits a short screen.** It gives things up in order of how
  little they are missed rather than shrinking everything at once — first the
  spacing tightens, then the aside about how the app was built goes, and last
  the QR code, since anyone on a window that short is at a desk and the link
  beside it does the same job in one click.

---

## 0.7.0

### New

- **The live spectrum can be drawn thirty-six different ways, in two palettes.**
  Bars, a ridge, a staircase, floating peak caps, a contour map that shows how
  wide a peak is rather than only how tall, a slope field that draws which way
  the spectrum is turning, stalactites hung from the ceiling, a heart monitor
  that beats once per band, a car riding the loudest frequency along a road made
  of the trace, and a rank of little sprites hanging at their levels. Pick one
  from the searchable list on the legend, or click the graph to walk through
  them while you listen — `Space` does the same, and `Ctrl` with either steps
  back.
- **Every form moves in its own way.** A bar snaps up and hangs, the way a level
  meter does, so a kick lands as a step. A ridge is a landscape and moves like
  one, because a hill that twitches reads as noise. The pulse is nearly
  instant, because a heartbeat that arrives late is not a heartbeat. Choosing a
  drawing changes how the music feels, not just what it looks like.
- **Wave only** hides the EQ response, the voicing and driver layers and the
  band handles, leaving the live trace alone on the grid.
- **Full screen** clears the bands out of the way and presents the graph in the
  middle of the workspace. `Esc` brings them back.
- **Ten ways to draw the titlebar meter**, cycled by clicking it.
- **Smart EQ is its own layer.** It used to rewrite your bands, so applying it
  overwrote the tuning you had done by hand and clearing it took your work with
  it. It now sits on top of everything else with its own chip, and survives
  clearing an AutoEQ reference. It also no longer inverts your own bands: the
  target it corrects towards includes them, where before it measured as if they
  were not there.
- **An applied reference arrives band by band**, in frequency order, instead of
  every slider jumping at once. You can see what it did rather than just what
  it left behind.
- **Zoom the whole interface** with `Ctrl` and `+`, `-` or `0`. Keyboard only,
  deliberately — the mouse wheel belongs to the sliders.
- **There is a game hidden in the support panel**, for anyone with the
  contribution badge. Tap the creature or press space on the beat of whatever
  you are playing. It reads the real percussion out of your own audio, so it is
  your music you are playing along to.
- **Euphoria mode.** Thirty-six consecutive perfect taps and the entire
  application goes rainbow with the music: the bands, the response curve, the
  meter, the menus and the release notes. One mistake and it all goes back to
  being an equaliser.
- **Share your run.** A card is drawn with the creature, your score and the
  mode's own look, ready to post — copy it straight to the clipboard and paste
  it into whatever you are writing.

### Changed

- **Both waveforms move at the display's rate, not the analyser's.** Sound is
  measured about twenty-two times a second, so drawing only when a measurement
  lands meant two frames in three showed the same picture as the one before —
  which the eye reads as stepping. They are drawn between measurements now,
  gliding toward each new one: at the full rate of your screen during euphoria,
  and capped at thirty otherwise, because a meter beside an equaliser does not
  need sixty and the frames are not free.
- **The graph keeps time with the music instead of catching up with it.** The
  analysis window was twice as long as it needed to be and the smoothing on top
  of it added more, so the picture arrived about ninety milliseconds after the
  sound. It is closer to fifty now, and it is quick to rise and slow to fall
  rather than sluggish in both directions, which is what makes it pump rather
  than sway.
- **The graph reaches further across.** The axis started at 10Hz but ended at
  25kHz, which on a logarithmic scale left three times as much empty space
  before 20Hz as after 20kHz. Both marks now sit the same distance from their
  edge, and the drawing gets the space back.
- **The grid and the supporting curves have stepped back** so the response you
  are editing is obviously the subject rather than one line among five.
- **The installer opens FluidEQ when it finishes.** Updates already did; a
  fresh install left you looking at a closed wizard.
- **FluidEQ is called FluidEQ in Task Manager**, in development as well as in
  the installed app.
- **The language picker is one of the app's own dropdowns**, not the operating
  system's, and it opens downwards at a sensible size.
- **The titlebar sits almost flush with the page**, so the window reads as one
  surface rather than a bar stuck on top of one.
- **The delete-band button becomes an icon** when the row runs out of room, and
  gets its label back when there is space for it. It is a bin now, not a cross:
  a cross reads as "close", which is the wrong promise.
- **The score measures accuracy, not endurance.** Only a perfect adds; anything
  else pays a little and gives back a share of the total. Playing longer cannot
  move anyone past their own precision.

### Fixed

- **FluidEQ was capturing your screen the entire time it was open**, and the
  memory that took never came back — several gigabytes and still climbing after
  a few minutes. Windows only offers system audio through the same call that
  offers screen sharing, so a video track arrives whether or not anything wants
  one. It was being switched off in a way that mutes what a track delivers
  while leaving the capture behind it running, so full-resolution frames were
  produced continuously and nothing ever read them. The video is now released
  outright the moment the audio arrives.
- **Euphoria mode ate memory without limit** — a few hundred megabytes with it
  off, several gigabytes and still climbing with it on. The travelling colour
  was animated on the window itself and inherited by everything inside it, so
  the browser had to recompute every element on the page sixty times a second
  for as long as the mode was running; the interface went sluggish, the graph
  stuttered, and the waste piled up faster than it could be cleared. The colour
  now travels only on the handful of things that actually show it. Two of those
  things also carried an animated glow over a picture that redraws twenty-two
  times a second, which meant re-rendering everything beneath it on every
  frame — that glow sits outside the moving part now. It looks the same.
- **A request that timed out leaked its listener, forever.** The bridge that
  cleans up after an internal request rebuilt the wrong function and so removed
  nothing at all, silently. Beyond the memory, the abandoned listener stayed
  first in the queue and would answer somebody else's later request with the
  wrong result.
- **A band deleted mid-animation stayed in memory** until the animation it was
  never going to finish would have ended. One is nothing; an afternoon of
  adding, dragging and deleting bands is not, and none of it is visible while it
  accumulates.
- **Clearing an applied reference clears its bands.** The notes previously
  claimed the bands stayed, which was wrong in both directions — a reference is
  where your tuning came from, not a label beside it.
- **The pet stops reacting to a paused waveform**, and stops swaying in a
  silent room. The analyser freezes mid-frame when paused, and it was dancing
  to a reading that had stopped being true.
- **The graph could not draw.** 0.6.0 shipped a build that dropped d3's
  transition module, so every animated part of the response chart threw
  `e.transition is not a function` and the window came up broken. The build had
  been told d3 was free of side effects, which is true of almost all of it and
  false of exactly the piece that matters: transitions install themselves onto
  d3's selections when the module is evaluated, and nothing refers to them by
  name, so the bundler quite reasonably concluded they were unused and removed
  them. 0.6.0 and 0.6.1 were both withdrawn; everything they contained is in
  this release.

### Faster

- **The renderer is 44% smaller.** Nothing was being tree-shaken at all — the
  TypeScript build emitted `require()` calls before webpack ever saw the import
  graph, so every unused corner of every library shipped. d3 alone was dragging
  in geo, force, contour and delaunay to draw an axis.
- **The creature stopped re-rendering twenty-two times a second.** It sits in
  the titlebar, so that never stopped: not when the window was idle, not when
  nothing was playing.
- **The device list stops polling while the window is hidden.** Each tick
  enumerates every audio endpoint on the machine.
- **The spectrum is drawn as sixty-four columns rather than three hundred and
  twenty.** At that density the bars touched, so it read as a filled area with a
  ragged top — a worse picture, built from a path string five times longer,
  rebuilt on every frame.
- The spellchecker is gone. It was downloading a dictionary to check the
  spelling of preset names.

---

## 0.5.1

### New

- **The installer asks which language to use**, preselecting your Windows one.
  Nine of the app's ten, because NSIS has no Hindi translation — FluidEQ still
  speaks it, the setup wizard does not, which is better than a half-English
  wizard pretending otherwise.

### Changed

- **The release notes open on top of the support dialog** instead of replacing
  it. Reading them is a detour from deciding whether to contribute, not a
  departure from it, so closing them puts you back where you were.
- **The pet sways like someone listening.** It leans, holds there for a beat
  and comes back, rather than swinging evenly from side to side — and the lean
  hinges low, where a neck would be, instead of spinning the whole creature
  about its middle. Still only for anyone with the contribution badge.

### Fixed

- Escape closed both dialogs at once when the release notes were open over the
  support dialog.

---

## 0.5.0

### New

- **FluidEQ updates itself.** It checks GitHub for a new version, downloads it
  in the background and offers to restart, with the progress shown in the app
  rather than as an easy-to-miss system toast. Being offline is not an error
  and says nothing.
- **What's new.** This file, rendered inside the app — shown once after an
  update, and in the actions menu whenever you want it.
- **The window reopens where you left it**, at the size you left it, maximized
  if it was. The position is only reused if a display still covers it, so
  unplugging a second monitor cannot strand it somewhere unreachable.
- **No white flash on launch.** The window waits until the interface has
  actually painted instead of appearing blank and filling in.
- **Measurements are capped at what is believable.** Published corrections
  routinely ask for +16 dB at the edges of the audible band, where the rig is
  measuring its own coupling error rather than the headphone. References are
  now limited to 12 dB, and 8 dB below 25 Hz or above 14 kHz. Bands you move
  yourself are untouched — that is your business.
- **Smart EQ shows its work**, applying the correction one band at a time in
  frequency order rather than making every slider jump at once.
- **Clear the applied reference** from the AutoEQ panel, the same way you clear
  a convolution. The bands go with it — a reference is not a label sitting
  beside your tuning, it is where that tuning came from, and dropping only the
  name left a curve on screen that nothing on screen accounted for. Your
  voicing, driver profile and Smart EQ are separate layers and are untouched.

### Changed

- **No more profile name box.** Renaming happens on the profile row itself,
  where the name is, with accept and cancel buttons on the field. Two places to
  type the same thing meant keeping them in sync, and it made Save ambiguous —
  you could never tell whether it would create a profile or overwrite one. New
  profile is the only way to create one now, so Save says plainly that it
  updates.
- **Smart EQ leaves your band layout alone.** An earlier build expanded a
  coarse layout to 31 bands before measuring. Ten bands genuinely cannot
  describe a measured response, but how many you use is your decision.
- The applied reference records the measurement, not just the model. Most
  models have several and they do not sound alike.

### Fixed

- **The config adoption added in 0.4.0 could empty the band editor.** A block
  with a preamp and no filters is what FluidEQ writes for a flat EQ, not "the
  user cleared their bands", and reading it as truth left the EQ page with no
  sliders at all. Adoption now also refuses when a voicing or driver layer is
  live, since those reach APO as ordinary filter lines and would otherwise be
  pulled into the editor as bands and then applied twice.
- **One output's profile could overwrite another's.** Two outputs could point
  at the same profile file, so saving on the speakers silently overwrote the
  headphones — easy to hit, because "Untitled profile 1" is exactly the name
  two outputs both end up with. Saving now takes a free name or one this output
  already owns.
- **Every output keeps a profile.** Deleting the one an output was playing
  through left it with nothing to save to; that case now resets the sound to
  neutral and creates a fresh empty profile.
- **Renaming a profile to a longer version of its own name aborted halfway.**
  Renaming "Standard" to "Standard 2" cancelled the moment the text passed
  through "Standard".
- **Changing the band count during Smart EQ did nothing useful.** The check
  meant to notice it could never fire, so the measurement applied gains to
  bands that no longer existed. It now measures again against the new layout.
- Dropdowns in the AutoEQ panel were clipped by the equalizer below them.

---

## 0.4.0

### New

- **The Equalizer APO config is the source of truth.** On startup FluidEQ reads
  the config on disk instead of trusting its own copy of the state. If anything
  else changed it — a hand edit, another tool, an APO reinstall, a restore from
  backup — the file wins. What the config cannot express (which voicing, which
  driver profile, which headphone reference) still lives in the profile,
  because those reach APO as ordinary filter lines and reading them back as
  bands would apply them twice.
- **Import EQ settings and impulse responses.** An Equalizer APO ParametricEQ
  or GraphicEQ file, a FluidEQ profile, or any WAV impulse response. The reader
  understands the full APO grammar, including the pass and notch bands that
  carry no `Gain` token.
- **Ten languages.** English, 简体中文, हिन्दी, Español, Français, Português,
  Русский, 日本語, Deutsch, Italiano. Picked from Windows on first run,
  changeable from the actions menu.
- **The applied headphone is remembered.** Applying an AutoEQ reference used to
  leave nothing behind saying where the curve came from. The model now travels
  with the profile, is named on the EQ page, and is re-selected in the picker.
- **Everything shaping your sound is named.** An "Also applied" strip on the EQ
  page lists any convolution, voicing, driver correction or headphone reference
  that is live, each removable in one click.
- **In-app updates.** FluidEQ checks GitHub for a new version, downloads it in
  the background and offers to restart. Being offline is not an error.
- **The window reopens where you left it**, at the size you left it, maximized
  if it was.

### Changed

- The workspace scrolls instead of squeezing every panel into the window. The
  response graph keeps a readable height on a short window, and the profile
  list is no longer three rows tall.
- The named-profile list shows every profile rather than only the one attached
  to the current output, with the live one marked. **New profile** creates one
  for real, named "Untitled profile 1", 2, and so on.
- The AutoEQ library is collapsible, and states which model is applied even
  when folded.
- Icons on the actions menu and the EQ toolbar; only the live band layout is
  highlighted rather than all four.
- One shared motion vocabulary: menus unfold from the control that opened them,
  tab panels rise into place, notices slide in. All of it respects
  `prefers-reduced-motion`.

### Fixed

- **`isAutoPreAmpOn` travels with the profile.** Turning auto-normalise off on
  one output turned it off on every output, and the next auto-save wrote that
  in.
- **Switching outputs reloads everything.** The bands, preamp, voicing, driver
  correction and convolution all belong to the output they were tuned on, but
  the app only found out about a switch by accident.
- The EQ toolbar drew over its own heading — eleven controls and no window
  width at which they fit beside a title.
- Saving a band with a High Pass or Band Pass filter and reloading replaced the
  whole EQ with ten default bands. The preset validator only accepted three of
  the seven filter types.

---

## 0.3.0

### New

- **Driver-type compensation.** Twelve profiles for what you are listening on:
  dynamic, planar magnetic, balanced armature, electrostatic, bone conduction,
  the common diaphragm materials, and driver size — each its own layer with a
  strength slider, drawn as its own curve on the graph.
- **Voicing.** Five curated target curves — music, movies, games, speech, late
  night — written after your bands so your own tuning is never touched.
- **Convolution.** Apply a verified minimum-phase impulse response from the
  AutoEq catalogue before the parametric EQ.
- **Automatic per-output profiles.** Edit any control and the tuning saves
  itself and attaches to the active Windows endpoint. A manual save keeps a
  separate copy you can always restore.
- **Smart EQ** measures what is actually coming out of your output and flattens
  what it hears.

### Fixed

- **Clear EQ left the previous profile fully audible.** Equalizer APO
  accumulates blocks rather than replacing them, so the device block and the
  session block stacked instead of the newer one winning.
- **One preamp for the whole chain.** Every layer used to add its own, so
  stacking a voicing on a convolution buried the signal.
- Loading some Squiglink measurements wrote `Fc NaN Hz` into the config and
  took the whole chain out.

---

## 0.2.0 and earlier

FluidEQ began as a fork of [AQUA](https://github.com/h39s/AQUA) and spent its
early versions on the device-profile foundation: discovering Windows render
endpoints, mapping the stable endpoint GUID rather than the display name, and
generating one Equalizer APO block per assignment.
