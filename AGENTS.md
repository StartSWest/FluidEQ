# Working on FluidEQ

Instructions for coding agents. `CLAUDE.md` in this directory holds the full set
— request handling, verification discipline, the traps in the build — and
everything in it applies here too. Read it. This file exists so the rules are
found under the name other tools look for, and it repeats in full the one area
where a plausible-looking change is most likely to be silently wrong.

## Typography

FluidEQ ships on Windows, macOS and Ubuntu and uses each one's system font, so
the same CSS renders in three different families with three different sets of
cuts. Every rule below was earned by shipping the mistake first.

- **Never name a font family that is not shipped.** `Inter` sat at the front of
  the stack for the life of this project without ever being bundled. The list
  resolved to Segoe UI anyway, so every size, padding and letter-spacing in the
  app was tuned against a font that was never on screen — and nobody noticed,
  because the failure is silent by construction.

- **No raw `font-weight` numbers. Use the `$weight-*` scale in
  `src/renderer/styles/_theme.scss`.** The app had grown eighteen distinct
  literals — 650, 680, 720, 730, 750, 760, 780, 820, 840, 850, 880, 950 among
  them — which measured as exactly four faces in the running window. The ramp
  was decoration. `.erb/scripts/check-styles.ts` rejects a raw value and runs in
  both CI workflows; it has to keep letting `font-weight: 100 900` through,
  which is a variable axis range in `@font-face` and not a weight at all.

- **`$weight-bold` (700) is the ceiling at UI sizes, on every platform.** Segoe
  UI has no cut between Bold and Black, so 800 and 900 both land on
  `Segoe UI Black` — a poster face whose counters close up below roughly 20px.
  That is what the titlebar tabs looked like when this was reported as the fonts
  being _apastadas_, and 74 further declarations at 8-16px carried the same bug
  unnoticed. macOS could render more steps, and taking them would make the same
  panel heavier on one machine than another for no reason a user could name.

- **`$weight-display` (900) belongs above ~20px only** — karaoke lyric and score
  text. There is deliberately no 800 token, because on Windows 800 is not a
  distinct face; it is Black, arriving early.

- **A font stack names one native family per platform**, in the order each
  resolves: `-apple-system`, `BlinkMacSystemFont` (macOS), `Segoe UI`
  (Windows), then `Ubuntu`, `Cantarell`, `Noto Sans`, `DejaVu Sans` (Linux).
  Without the Linux names the stack ran out and fell to generic `sans-serif`,
  which fontconfig answers with DejaVu Sans. `ui-sans-serif` is deliberately
  absent: Chromium does not resolve it on Windows, and on Linux it answers from
  fontconfig ahead of the named families, which is the opposite of choosing
  them.

- **Monospace goes through `$font-mono`,** and `ui-monospace` is never the last
  real name in it: alone on Windows it falls through to Times New Roman, a
  proportional serif, in the one place where fixed width is the entire point.
  Three separate stacks had drifted apart here and painted the same kind of
  evidence text — config dumps, bug reports — in two different faces depending
  on which panel it appeared in.

- **Do not bundle a webfont for UI text.** Inter and Cascadia Mono were both
  bundled and both taken back out. Windows leans on TrueType hinting at the
  9-15px this UI lives at and the system fonts are hinted for exactly that; an
  unhinted variable woff2 has nothing to compete with, and it was visibly softer
  on screen — worst on bold text, where there is more stem area to blur. A
  bundled display face for headings alone is still an open question; UI text is
  settled.

- **Keep `font-variant-numeric: tabular-nums` on the shell through any font
  change.** Segoe UI carries no proportional figures at all, so every readout in
  this app has been tabular by accident of the fallback. A font with
  proportional digits — Inter spreads "111" against "000" by 30px at 40px —
  makes a gain counting 1.1 → 8.8 shove its neighbours on every frame while a
  band is dragged. Nothing in the test suite can see that.

## Checking typography

Tests query by role. They cannot see a typeface, so none of the above is caught
by the suite, and both of these caught something that reasoning about the
cascade did not:

- **`CSS.getPlatformFontsForNode`, over the CDP socket on `127.0.0.1:9222` in
  dev, reports which real font file painted a node** — family, PostScript name,
  and `isCustomFont`. Computed style only reports what was asked for. That is
  what proved the tabs were drawn in Segoe UI Black while every control beside
  them was drawn in Segoe UI, and later that a bundled face was actually
  winning over the identically-named system copy.

- **Measure DOM text, never canvas text.** Chromium rasterises them on different
  paths. A canvas-based sharpness comparison reported Inter as level with Segoe
  UI at weights 400 and 600; on screen it plainly was not, and that wrong
  conclusion stood until a human looked at the window and said so.

## Do not run the app

Ivan runs it. Say plainly what has and has not been verified — passing tests are
not a working window — and ask before launching anything.
