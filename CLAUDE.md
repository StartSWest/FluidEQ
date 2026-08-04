# Working on FluidEQ

## Releasing

When asked to **release**, **cut a version**, or **make a new version**, do the
whole thing without asking for the steps back. In order:

1. **Decide the version.** Patch for fixes only, minor for anything new. Set it
   in **both** `package.json` and `release/app/package.json` — they must match
   or electron-builder names the artifact after the wrong one.

2. **Write the changelog entry.** A new `## X.Y.Z` section at the top of
   `CHANGELOG.md`, under `### New` / `### Changed` / `### Fixed`. Say what
   changed for the user and why, not which files moved. This file is rendered
   in the app's What's new dialog and read on GitHub, so it is the release
   notes — do not write them twice.

3. **Bring the README up to date.** Anything the release adds or changes that
   the README currently describes wrongly, or does not describe at all. It
   should never be stale after a release.

4. **Verify before building.** All three must be clean. Do not package a tree
   that does not pass.

   ```bash
   pnpm exec tsc --noEmit; pnpm test; pnpm run lint
   ```

   All three genuinely pass, so a single error is a real one. They did not
   always: `tsc` used to report 89 errors — dependency typings that conflict
   with each other, plus the cucumber suite — and `pnpm test` counted that
   suite as 14 failures. Nobody can pick a real failure out of that, so both
   are now scoped to what they can actually speak for. If you find yourself
   explaining away a failure here, fix it or scope it; do not learn to ignore
   it.

   The cucumber suite drives a packaged FluidEQ through WebdriverIO against a
   real Equalizer APO install. It cannot run here, and it has not compiled
   since before the fork. `pnpm test:cucumber` still reaches it.

5. **Commit, tag, push.**

   ```bash
   git add -A && git commit -m "Version X.Y.Z" && git tag -a vX.Y.Z -m "FluidEQ X.Y.Z" && git push origin main && git push origin vX.Y.Z
   ```

6. **Package.**

   ```bash
   pnpm package > /dev/null 2>&1; echo "package rc=$?"
   ```

   Redirect the output. electron-builder prints an enormous amount and none of
   it is worth reading; the exit code is the only part that matters. If it is
   non-zero, re-run showing only the tail.

7. **Publish, with both files.**

   ```bash
   gh release create vX.Y.Z --title "FluidEQ X.Y.Z" --notes-file <notes> "release/build/FluidEQ-Setup-X.Y.Z.exe" "release/build/latest.yml"
   ```

   `latest.yml` is not optional. It is the manifest electron-updater fetches to
   compare versions; a release without it means no user ever sees the update.
   Verify both assets landed:

   ```bash
   gh release view vX.Y.Z --json assets
   ```

### Never read the installer

Do not `Read`, `cat`, `head` or otherwise open `release/build/*.exe`, and do not
dump packaging output into the transcript. It is a hundred-megabyte binary and
a wall of build log — reading either burns an enormous number of tokens and
tells you nothing. Check the file exists with `ls -la` and move on.

### Warn before anything else expensive

Any other long-running or high-volume command: say what it will cost and let
the user decide first.

## Working the queue

Requests often arrive faster than they can be finished, several of them landing
mid-turn. **Do them in the order they were asked.** Finish the one in hand
before starting the next; do not reorder by what looks quick, and do not batch
several later requests together and leave an earlier one sitting.

If something genuinely cannot start yet — it needs a file that work already
underway is rewriting — say so explicitly, name what is blocking it, and go back
to it the moment that clears. That is the only acceptable reason to take things
out of order, and it has to be stated rather than assumed.

Keep the outstanding list visible at the end of a reply, oldest first, so the
running order is never in question.

## Workflows and subagents

**Default to doing the work yourself.** A styling fix, a component, a bug with a
known cause, a stylesheet — all of that is faster and better done directly, and
it stays that way even when it spans a few files.

Fanning out to a crowd of agents does not scale the way it looks like it should.
Each one has to rediscover context you already have, they take far longer than
the work warrants, and the more of them there are the more time goes on
coordinating rather than building. A run that takes half an hour to change what
you could have changed in five minutes is a loss even when the output is fine.

If a workflow is genuinely warranted — the work is large, spans subsystems, and
has a testable core that is easy to get confidently wrong, like filter maths or
scoring balance — keep it **small**: a couple of agents doing the work, one
verifying. Do not add a reviewer per dimension and a skeptic per finding. Read
the diff yourself instead; it is quicker and you will trust it more.

And never run one for something the user is waiting on and watching. If it
starts dragging, stop it and finish by hand — the tree survives being
interrupted, which is worth checking with a type-check straight after.

## Conventions

- **The GPL headers are not editable.** Every source file carries
  `<AQUA: ...>` and `Copyright (C) <2023> <AQUA Dev Team>`. Section 5(a)
  requires them to be preserved. Rename identifiers freely; never touch those
  lines, `NOTICE.md`, or the README attribution.
- **`LEGACY_CONFIG_CONTENT`** matches `Include: aqua.txt`, which upstream AQUA
  wrote into Equalizer APO's `config.txt`. It is a value on disk, not a name —
  it must keep matching.
- **New user-facing strings need all ten locales.** `src/common/i18n/en.ts` is
  the source of truth; the other nine are typed as `Partial` of it and a test
  asserts 100% coverage. Adding an English key without the others fails that
  test, which is the point.
- **Shell is PowerShell 5.1.** `&&` is a parse error there. Any command handed
  to the user runs as separate lines, or uses `; if ($?) { ... }`.
- **Never run Electron.** The user runs the app themselves.

## Shape of the thing

- `src/common/` — pure logic, no Electron. Filter maths, the APO text
  reader/writer helpers, voicing and driver profiles, i18n, validation.
- `src/main/` — Electron main. `flush.ts` writes the APO config; `main.ts` owns
  the IPC surface and the live `state`.
- `src/renderer/` — React. `FluidEqContext` holds the live EQ state;
  `I18nContext` holds the language.

The Equalizer APO config is the source of truth for anything audible (bands,
preamp, GraphicEQ, which impulse response). The profile owns what the config
cannot express (which voicing, which driver profile, which headphone reference,
the profile name) — those reach APO as anonymous `Filter N:` lines, so reading
them back as bands would apply them twice. See `src/common/apoSync.ts`.
