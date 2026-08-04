# What's new in FluidEQ

Every released version, newest first. FluidEQ shows this file in the app the
first time you run a new version — the **What's new** entry in the actions menu
opens it again any time.

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
