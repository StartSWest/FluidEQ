# What's new in FluidEQ

Every released version, newest first. FluidEQ shows this file in the app the
first time you run a new version — the **What's new** entry in the actions menu
opens it again any time.

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
