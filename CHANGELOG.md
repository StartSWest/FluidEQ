# What's new in FluidEQ

Every released version, newest first. FluidEQ shows this file in the app the
first time you run a new version — the **What's new** entry in the actions menu
opens it again any time.

---

## 0.11.0

### New

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

- **Vimeo has been removed.** It renders its listings entirely on the client,
  from an API that returns nothing to a session it does not recognise — search,
  Staff Picks and the watch feed all arrive with their tabs and filters and not
  one result. FluidEQ's player is signed out by design and always will be, so
  that is the only Vimeo it can ever see. A button onto an empty page is worse
  than no button.
- **The player signs into nothing, and remembers nothing.** Its session is held
  in memory and dies with the app, and sign-in is turned away at each site's own
  front door. No account of yours is ever the identity behind what it does.
- **The ad blocker is no longer part of the interface**, and is off. It is still
  in there for anyone who goes looking.
- **A refused link leaves you where you are.** Following one that goes outside
  the player used to move you to a different site's front page; now the page you
  were on simply stays, with a note saying what was refused.

### Fixed

- **YouTube Music no longer has a black band down its side** in expanded view or
  full screen. Its player sits inside the app's own element, still sized for a
  layout with the nav rail beside it, and pinning the outer one told the inner
  one nothing.
- **The second video is stripped back like the first.** In expanded view and
  full screen the page is reduced to just its player — but only ever on the
  first page loaded. Every video after that came back wearing the whole site.
- **The player says what it refused.** A link that went nowhere used to go
  nowhere silently, which is indistinguishable from a broken page. Refusals,
  failed loads and the page's own errors are now in the log.

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
