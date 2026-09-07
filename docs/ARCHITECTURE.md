# Architecture reference

Inventory of what the codebase is and how it is shaped. Verified against the
tree on 2026-09-06. Versions, counts and limits live in the files named next to
them; read those rather than trusting a number here.

**FluidEQ** is a Windows desktop equalizer and audio workstation built on
Electron. Equalizer APO is the engine for system-wide EQ; FluidEQ writes APO's
config files, reads them back as the source of truth, and adds its own
out-of-process native DSP host for the media player, Karaoke, Share Audio and
the DSP rack. The product is Windows-only; on other platforms the app runs with
two demonstration endpoints and touches nothing.

## Tech stack

Exact versions are in `package.json` and `pnpm-workspace.yaml`.

- Electron 43, React 19, TypeScript 6 (pinned by a workspace override),
  webpack 5 (configs in `.erb/configs/`), Jest 29 with `jest-cucumber`,
  WebdriverIO + `electron-chromedriver` for the cucumber suite.
- CommonJS project (`"type": "commonjs"`). pnpm, pinned via `packageManager`.
  Two workspace packages: the root and `release/app`, whose own `package.json`
  is what ships (`main: ./dist/main/main.js`, sole dependency
  `onnxruntime-node`). The version in both `package.json` files must agree.
- Node 22 (`devEngines`, both CI workflows).
- Native C++20 via CMake 3.21+ in `native/`. Warnings are errors, RTTI off,
  exceptions on, no fast-math. `build-native-dsp.ts` finds CMake and Ninja
  inside Visual Studio rather than on `PATH`.
- ML: `@huggingface/transformers` (patched in `patches/`), `onnxruntime-node`
  and `onnxruntime-web`, models in `assets/models/`.
- Updates: `electron-updater`. Packaging: `electron-builder` with NSIS on
  Windows; macOS and Linux targets exist in the config even though the feature
  set is Windows-only.
- Ten UI languages in `src/common/i18n/` (de, en, es, fr, hi, it, ja, pt, ru,
  zh).

## Processes

| Process             | Entry                                                      | Notes                                                                                                                                                                                                                                                  |
| ------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Main                | `src/main/main.ts` (`dev-main.cjs` in dev)                 | Registers `fluideq-media://` before `app.ready`, owns the tray, menus, APO files, updates, and spawns every child below.                                                                                                                               |
| Preload             | `src/main/preload.ts`                                      | Typed for the renderer by `src/renderer/preload.d.ts`. `dspHost/bridge.ts` uses `import type` only so `child_process` never enters the preload bundle.                                                                                                 |
| Renderer            | `src/renderer/index.tsx` → `App.tsx`                       | Tabs in order: `eq, presets, voicing, convolution, video, library, karaoke, dsp, share, config`.                                                                                                                                                       |
| Native DSP host     | `native/dsp-host/` → `FluidEQ-DSP.exe`                     | Located by `src/main/dspHost/hostPath.ts` (resources dir, then `native/.build/bin`, never cwd). Supervised by `src/main/dspHost/supervisor.ts`: `stopped / starting / ready / failed`, bounded restart budget, started explicitly and never at launch. |
| LAN capture         | `native/remote-audio-capture/` → `FluidEQ-LAN-Capture.exe` | Windows-only. Spawned by `src/main/nativeCaptureProcess.ts` with `--parent-pid`; captures the system mix excluding its own process tree.                                                                                                               |
| Library scan worker | `src/main/library/scanWorker.ts`                           | Separate process driven by `scanHost.ts`.                                                                                                                                                                                                              |
| Inference worker    | `src/main/inferenceWorker.ts`                              | Karaoke separation, pitch and denoise models.                                                                                                                                                                                                          |
| PowerShell helpers  | `assets/windows-*.ps1`                                     | Audio device enumeration and media keys.                                                                                                                                                                                                               |

**Wire protocol.** `HOST_WIRE_PROTOCOL_VERSION` in `src/main/dspHost/wire.ts`
must equal `FEQ_WIRE_PROTOCOL_VERSION` in `native/dsp-host/src/wire.h`; the
handshake refuses a mismatch. Layout is pinned by
`src/__tests__/unit_tests/dspHostWireLayout.test.ts` and
`dspHostHandshakeLayout.test.ts`. Native parameter tables are generated from
`src/common/dsp/nativeParameters.ts` into `native/dsp-core/include/fluideq/parameters.h`
by `.erb/scripts/generate-native-parameters.ts`. Spec:
[native-dsp-spec.md](native-dsp-spec.md).

**IPC.** Channel names live in `src/common/channels.ts`; the renderer API is
assembled in `src/main/api.ts` and exposed through the preload. Handlers are
split across `src/main/ipc/` (one file per surface: `dspHost`, `filters`,
`karaoke`, `layers`, `library`, `libraryPlaylists`, `outputMirror`, `preamp`,
`processes`, `profiles`, `references`, `remoteAudio`, `songEq`, `transfer`,
`updates`, `video`, `window`) with a remainder still in `main.ts`.

## Equalizer APO integration

- APO's config directory comes from the registry (`src/main/registry.ts`,
  `getConfigPath()`), never a hardcoded path.
- File contract in `src/main/flush.ts`: APO's own `config.txt` gets a single
  `Include: fluideq.txt` line appended (existing content preserved, legacy
  `Include: aqua.txt` recognised). `fluideq.txt` is FluidEQ's root file.
  Presets live in `%APPDATA%\FluidEQ\presets`.
- Per-device files (`src/main/deviceProfiles.ts`): `fluideq-device-<slug>.txt`
  where the slug is a 12-hex digest of the Windows endpoint id, one
  `fluideq-<slug>-<feature>.txt` per layer, `fluideq-<slug>-custom.txt` which is
  never rewritten, and `fluideq-convolution-<slug>.wav`. FluidEQ writes only its
  own files; `config.txt` belongs to APO.
- Config is the source of truth: `src/main/apoConfigReader.ts` reads back,
  `apoAdopt.ts` adopts bands and infers switched-off layers from missing
  `Include:` lines, `apoRender.ts` renders. `src/common/apoConfig.ts` carries the
  flag for whether `config.txt` still includes `fluideq.txt` at all, which is
  how an APO reinstall or another tool removing FluidEQ is detected rather than
  assumed away. Pure parsing is in `src/common/apoText.ts`, `apoConfig.ts`,
  `apoSync.ts`, `apoFeatureSync.ts`.
- **APO is bundled.** `pnpm package` runs `clean.js dist`, `pnpm fetch-apo`,
  `pnpm build`, then `electron-builder --publish never`.
  `.erb/scripts/fetch-equalizer-apo.ts` downloads the pinned installer
  (version, SHA-256 and byte count in the script) into `vendor/equalizer-apo/`
  (gitignored) and reuses a cached copy whose hash matches. The download is
  buffered whole, not streamed through `pipeline`, for reasons documented in
  the script. `extraResources` filters that directory to
  `equalizer-apo-setup.exe` and `version.txt` so the source zip that also
  lives there never ships. `assets/nsis/installer.nsh` launches the installer
  with `ExecShellWait "runas"` because APO's setup is manifested
  `requireAdministrator` and only ShellExecute honours that; it runs visibly
  and unmodified, and the uninstall branch is skipped on updates.

## Subsystems

- **EQ, layers, Smart EQ.** `src/common/{smartEq,smartEqContinuous,smartHeadroom,songEq*,songIdentity}.ts`,
  `src/main/songEqStore.ts`, renderer `SmartEqEngine.tsx` and
  `SmartHeadroomEngine.tsx`. Headphone correction data from OPRA:
  `opra/index.json` + `opra/curves/`, shipped as `extraResources`, refreshed by
  `pnpm opra:update` and the `update-opra-database.yml` workflow, validated by
  `pnpm test:opra`.
- **DSP rack.** `src/common/dsp/` (chain, analysis wire, diagnostics, per-stage
  preset catalogues, `presetFile.ts`, `dspChainPresetFile.ts`) over
  `native/dsp-core/` (static library, 18 CTest binaries including the
  `preset-safety-*` partitions fed by `generate-preset-fixtures.ts`).
- **Media library.** `src/main/library/` (scanner, worker, `fluideq-media://`
  protocol whitelisted in `contentSecurityPolicy.ts`), `src/common/library/`,
  `src/renderer/library/`. Tags via patched `music-metadata`.
- **Visualizers.** `src/common/graphStyles.ts` (`GRAPH_STYLES`),
  `meterStyles.ts`, `waveformStyles.ts`, geometry in `graphShapes.ts`,
  `graphScenes.ts`, `graphStems.ts`, `graphTerrace.ts`, `graphTruss.ts`,
  `graphStalactites.ts`, look designer in `customLooks.ts`. The counts are
  deliberately not written anywhere in prose; read the arrays.
- **Karaoke and Karaoke Maker.** `src/common/karaoke/` (LRC, UltraStar,
  syllables, chords, pitch, audio-clock driven `clock.ts`, maker export and
  persistence), `src/main/karaoke*.ts`, `src/renderer/karaoke/`. Design records
  in `docs/superpowers/`.
- **Online Media.** `src/main/video*.ts`, `src/common/video*.ts`,
  `src/renderer/video/`; separate cookie partition and hardening.
- **Second output and mirroring.** `src/main/outputMirrorBridge.ts`,
  `ipc/outputMirror.ts`, `src/renderer/audio/*OutputMirror*`,
  `useMirrorPlayback.ts`. Brief: [multi-output-brief.md](multi-output-brief.md).
- **Share Audio (LAN).** Twelve `src/main/remoteAudio*.ts` modules,
  `src/common/remoteAudio*.ts`, `src/renderer/remoteAudio/` (PCM worklets,
  mixer, resampler, sender), `ws`, and the LAN capture binary above.
- **Updates.** `src/main/signedAutoUpdates.ts` checks on machine wake, unlock,
  window focus and tray click, never on a timer; the private feed token
  provider has no unauthenticated fallback. `unattendedUpdate.ts`,
  `nativeUpdatePrompt.ts`. Mandatory updates: `.erb/scripts/mandatory-update.ts`
  turns `FLUIDEQ_MANDATORY_UPDATE` into `releaseInfo.vendor` fields in
  `latest.yml`; `src/common/mandatoryUpdate.ts` reads them and fails open.
  `.erb/scripts/package-signed.ts` refuses to run unless every
  `FLUIDEQ_SIGN_*`, `FLUIDEQ_UPDATE_URL` and `AZURE_*` variable is set, so an
  unsigned build cannot be produced by accident.
- **Branding.** `src/common/branding.ts` documents what is not renameable: the
  literal `fluideq` in file names, localStorage keys, DOM events and APO include
  lines is an on-disk contract.
- **Build-time public env.** `.erb/configs/public-env.ts` lists the
  `FLUIDEQ_*` values inlined into the renderer bundle (version, URLs, support
  addresses). They are public by construction; `.env.example` is committed.

## Directory map

| Path                 | What                                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main/`          | Main process, `dspHost/`, `ipc/`, `library/`                                                                                           |
| `src/common/`        | Shared pure modules: `dsp/`, `karaoke/`, `library/`, `i18n/`, APO text handling, styles catalogues                                     |
| `src/renderer/`      | React app: `audio/`, `components/`, `dsp/`, `graph/`, `help/`, `karaoke/`, `library/`, `remoteAudio/`, `styles/`, `video/`, `widgets/` |
| `src/__tests__/`     | `unit_tests/` (Jest, jsdom), `cucumber_tests/` (features + steps), `utils/`, `data/`                                                   |
| `native/`            | `CMakeLists.txt`, `dsp-core/`, `dsp-host/`, `remote-audio-capture/`; build tree in `native/.build/`                                    |
| `.erb/scripts/`      | Every build, check, smoke and packaging script (see below)                                                                             |
| `.erb/configs/`      | webpack configs and `public-env.ts`                                                                                                    |
| `release/app/`       | The shipped package: its `package.json`, `dist/`, `node_modules`                                                                       |
| `release/build/`     | Installer output                                                                                                                       |
| `assets/`            | Icons, NSIS scripts, models, licences, tour images, PowerShell helpers                                                                 |
| `opra/`              | OPRA headphone database                                                                                                                |
| `patches/`           | pnpm patches for `@huggingface/transformers` and `music-metadata`                                                                      |
| `scripts/`           | `build-opra-database.ts` only                                                                                                          |
| `docs/`              | User guide (generated), design briefs and specs, `superpowers/` plans and specs, `qa/` snapshots                                       |
| `.github/workflows/` | `test.yml`, `weekly-build.yml`, `update-opra-database.yml`, `discussions-feed.yml`                                                     |

### `.erb/scripts/`

- Build: `build-native-dsp.ts` (`--clean`, `--test`), `generate-native-parameters.ts`,
  `generate-preset-fixtures.ts`, `postinstall.ts`, `link-modules.ts`
  (junctions `release/app/node_modules` to `src/node_modules`),
  `electron-rebuild.js`, `clean.js`, `delete-source-maps.js`,
  `name-dev-electron.ts`.
- Checks: `check-build-exists.ts` (Jest refuses to start without
  `dist/main/main.js` and `dist/renderer/renderer.js`), `check-styles.ts`
  (compiles every non-partial SCSS in `src/renderer/styles` and rejects raw
  numeric `font-weight` outside `_theme.scss`), `check-encoding.ts` (BOMs and
  double-encoded UTF-8 across source, style, doc and C++ files),
  `check-native-dep.js`, `check-node-env.js`.
- Smoke (all drive the real native host over a real pipe): `smoke-native-dsp`,
  `smoke-wire-bounds`, `smoke-supervisor`, `smoke-orphan`, `smoke-playback`,
  `smoke-decoders`, `smoke-presets`, `smoke-device`, `smoke-analysis`,
  `smoke-crossfade`; `programme-fixture.ts` synthesises music-shaped material so
  they pass on a checkout with no audio; `tone-native-dsp.ts` makes real sound
  and is kept separate.
- Packaging and release: `fetch-equalizer-apo.ts`, `package-signed.ts`,
  `mandatory-update.ts`, `notarize.js`, `make-tray-badge-icon.ts`,
  `make-codec-fixtures.ts`, `export-user-guide.ts` (writes
  `docs/user-guide.html` and `docs/USER-GUIDE.md`; never hand-edit those).
- Dev: `dev.cjs`, `exit-dev-session-on-app-quit.ts`, `load-dotenv.ts`,
  `jest-setup.ts`.

## Typography

One sans stack in `src/renderer/styles/App.scss` (`-apple-system`,
`BlinkMacSystemFont`, `Segoe UI`, `Ubuntu`, `Cantarell`, `Noto Sans`, `DejaVu
Sans`) and one mono stack in `_theme.scss` (`$font-mono`, starting with
`ui-monospace`). No webfont is bundled; the app renders in three system
families across Windows, macOS and Ubuntu. Weights are the tokens in
`_theme.scss` (`$weight-regular` 400 through `$weight-bold` 700, plus
`$weight-display` 900); `check-styles.ts` rejects any raw number elsewhere.
Numeric readouts use `font-variant-numeric: tabular-nums`. In development the
renderer exposes DevTools over CDP on `127.0.0.1:9222`.

## Commands and CI

```bash
pnpm dev                 # renderer dev server, which starts preload and main
pnpm typecheck           # tsc --noEmit
pnpm typecheck:e2e       # the cucumber suite's tsconfig (tsconfig.e2e.json)
pnpm typecheck:styles    # check-styles.ts
pnpm typecheck:encoding  # check-encoding.ts
pnpm lint
pnpm build               # build:native-dsp, then main + renderer bundles
pnpm test                # jest (unit tests only) && test:native-dsp
pnpm test:unit
pnpm test:cucumber       # not part of `pnpm test`
pnpm test:native-dsp     # CTest + the ten smoke scripts
pnpm package             # unsigned installer; fetches APO first
pnpm package:signed      # needs the signing and update env vars
pnpm docs:guide          # regenerates docs/USER-GUIDE.md and user-guide.html
```

- `pre-commit` (Husky) runs `lint-staged` only. There is no pre-push hook.
- `test.yml`: install, `typecheck:styles`, `typecheck:encoding`, `build`,
  `test:unit --runInBand`, `test:opra`. It does not run `typecheck`, `lint`,
  the cucumber suite or the native smoke tests.
- `weekly-build.yml` (Mondays 06:00 UTC, `windows-latest`, caches off): every
  typecheck, `build`, `test`, `lint`, `package`. Publishes nothing.
- Jest needs a build first (`check-build-exists.ts`), so any new CI job runs
  `pnpm build` before `pnpm test`.

## Traps that are facts about the tree

- **Dev Electron is renamed.** `name-dev-electron.ts` rewrites the version
  resource of `node_modules/electron/dist/electron.exe` so the dev window says
  FluidEQ; the basename stays `electron.exe` because `app.isPackaged` derives
  from it.
- **Root is a workspace package.** Adding a dependency at the root needs
  `pnpm add -w`.
- **electronmon watches `src/main/**` and `src/common/**` only.** A change in
  `src/common` restarts main; the renderer is served by webpack-dev-server.
- **Generated and built paths to keep out of searches and reads:**
  `release/build/`, `release/app/dist/`, `native/.build/` (including
  `native/.build/parity-baseline/`, a full copy of the C++ sources),
  `native/dsp-core/include/fluideq/parameters.h`, `node_modules/`,
  `src/node_modules`, and `.claude/worktrees/` (complete second checkouts).
  Scope searches to `src/`, `native/dsp-core/`, `native/dsp-host/`,
  `native/remote-audio-capture/`, `.erb/`, `scripts/`, `assets/`.
- **Jest ignores `.claude/` and `.gigaide/`** in `jest.config.js` for the same
  reason; `^d3$` is anchored there because an unanchored `d3` once hijacked
  `id3v1`/`id3v2`.
- **`lint-staged` json glob.** The key `"*.json,.{eslintrc,prettierrc}"` is a
  single string with a comma and does not match plain `.json` files the way it
  reads.
