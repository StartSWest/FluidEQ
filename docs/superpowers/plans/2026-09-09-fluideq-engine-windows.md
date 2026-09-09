# FluidEQ Engine (Windows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give FluidEQ its own system-wide audio engine on Windows — an effect
DLL that Windows chains _after_ the vendor's effects on each output — so the
app equalises everything without replacing Equalizer APO's slot, keeps vendor
panels (subwoofer, Nahimic, MaxxAudio) working, and lets the user pick either
engine at install time, with the EQ and DSP pages unchanged and the DSP rack running system-wide under the FluidEQ engine.

**Architecture:** A COM effect DLL (`FluidEQ-Engine.dll`, endpoint effect /
EFX) linked against the existing `fluideq-dsp-core`, appended to each output's
_composite_ endpoint-effect list (Windows 10 1803+ chains every CLSID in that
list in order, so nothing of the vendor's is overwritten). It reads the same
config layout FluidEQ already writes for Equalizer APO — `config.txt` →
`Include: fluideq.txt` → `Device:` blocks → per-device and per-feature files —
from `%ProgramData%\FluidEQ\engine\config\`, and reloads on a directory-change
notification. The app keeps its writer, reader, inspector and adoption code
unchanged and only resolves _which_ config directory to use from a new
`audioEngine` preference (`'fluid' | 'apo'`), writing a neutral root to the
engine that is not in use. A self-elevating helper
(`FluidEQ-Engine-Setup.exe`) does every registry write. One small dialog
switches engines from the menu; the installer asks once.

**Tech Stack:** C++20 / MSVC (existing `native/` CMake tree, `feq_strict`
flags), Windows SDK 10.0.26100 (`audioenginebaseapo.h`, `mmdeviceapi.h`),
Electron main (TypeScript), React renderer, NSIS (`installer.nsh` + nsDialogs),
Jest + ctest.

**Spec:** This document's "Design" section. The investigation that produced it
is summarised in "Background".

## Global Constraints

- Windows x64 only, matching `build.win.target.arch = ["x64"]`. No ARM64 work.
- Windows 10 1803 or later for the engine (composite effect lists). Older
  Windows falls back to Equalizer APO; the dialog says so.
- No `setTimeout`/`setInterval`/`Sleep(n)` anywhere. Waiting is an event, a
  handle, a promise, or `NotifyServiceStatusChange`.
- Strict TS (`no any`, no `!`, no `==`), files under 500 lines, every
  user-facing string through i18n in all ten locales in the same commit.
- Native code: `/W4 /WX /permissive- /GR- /fp:precise` via `feq_strict`;
  nothing on the audio thread allocates, locks, logs, throws or calls the OS.
- Licence: GPL-3.0-or-later, same header as every file in `native/`. No code
  from Microsoft's SwapAPO sample (MS-PL is GPL-incompatible); interfaces are
  implemented directly from the SDK headers.
- The DLL is installed to `%ProgramFiles%\FluidEQ Engine\` (admin-only
  writable — a user-writable DLL loaded into `audiodg.exe` would be a
  privilege escalation). Config lives in `%ProgramData%\FluidEQ\engine\` with
  `Users: Modify` so the unelevated app can write and `LOCAL SERVICE` can read.
- Exactly one engine processes a given output at a time. Switching engines
  writes the neutral root to the other engine before writing the new one.
- Never rename or modify Equalizer APO's registry values. Ours are appended
  to composite lists and removed from them; a backup of every FxProperties
  value is taken before the first write per endpoint.
- The engine sets `DisableProtectedAudioDG=1` exactly as Equalizer APO already
  does. This is the unsigned-effect switch; it is the status quo on every
  FluidEQ machine today and stays until a signing certificate exists.
- Commit after every task with the `Co-Authored-By: Claude Fable 5.1
<noreply@anthropic.com>` trailer. Do not push.

---

## Background (why this shape)

- Windows gives an ordinary process no position between other apps and the
  speakers. Only an effect loaded into the audio engine (an APO) or a kernel
  virtual device sits in that path. The device needs a paid certificate; the
  effect does not (with the same switch APO already flips).
- Each output has one _single_ effect value per stage (`PKEY_FX_*`, pids
  5/6/7) and, since Windows 10 1803, one _composite_ list per stage
  (`PKEY_CompositeFX_*`, pids 13/14/15, `REG_MULTI_SZ`, chained in order).
  On the developer machine the Realtek endpoints already chain Nahimic →
  Realtek → a third effect in the composite mode list and Nahimic → Realtek in
  the composite endpoint list. Equalizer APO writes its CLSID into the single
  values instead, replacing the vendor's, which is why vendor panels lose
  control.
- Legacy drivers register only LFX/GFX (pids 1/2). Windows ignores those once
  modern keys exist, so attaching there must first mirror the vendor's LFX
  into the composite stream list and GFX into the composite mode list, leaving
  pids 1/2 untouched so the vendor panel still finds its own registration.
- The endpoint id string is `{0.0.0.00000000}.{<guid>}`; FluidEQ already
  keys everything by that `{<guid>}` (`IAudioDevice.guid`,
  `IDeviceProfileAssignment.deviceGuid`) and writes `Device: {<guid>}` blocks.
- Everything the app knows about a config — writer (`deviceProfiles.ts`),
  reader (`apoConfigReader.ts`), adoption (`apoAdopt.ts`), the inspector, the
  custom-file layer, IR generation (`convolution.ts`) — is addressed by one
  directory, `session.configPath`, resolved by `getConfigPath()` in
  `src/main/registry.ts`. Making that resolution engine-aware is the entire
  app-side integration; nothing about the files changes.

## Design

### Names and locations

| Thing                                                     | Value                                                                                                                                                                                                                                                  |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Effect CLSID                                              | `{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}`                                                                                                                                                                                                               |
| Effect friendly name                                      | `FluidEQ Engine`                                                                                                                                                                                                                                       |
| DLL                                                       | `%ProgramFiles%\FluidEQ Engine\FluidEQ-Engine.dll` (copied from `resources\native\FluidEQ-Engine.dll`)                                                                                                                                                 |
| Helper                                                    | `resources\native\FluidEQ-Engine-Setup.exe` (runs in place, self-elevates)                                                                                                                                                                             |
| Engine root                                               | `%ProgramData%\FluidEQ\engine\`                                                                                                                                                                                                                        |
| Config dir (what `getConfigPath()` returns for `'fluid'`) | `%ProgramData%\FluidEQ\engine\config\` — holds `config.txt`, `fluideq.txt`, `fluideq-device-*.txt`, `fluideq-*-*.txt`, `fluideq-convolution-*.wav`, exactly as the APO dir does                                                                        |
| Backups                                                   | `%ProgramData%\FluidEQ\engine\backup\<guid>.json`                                                                                                                                                                                                      |
| Log                                                       | `%ProgramData%\FluidEQ\engine\engine.log` (watcher thread only, 1 MB cap)                                                                                                                                                                              |
| Helper result                                             | `%ProgramData%\FluidEQ\engine\last-setup.json`                                                                                                                                                                                                         |
| App preference                                            | `%APPDATA%\FluidEQ\audio-engine.json` = `{ "version": 1, "engine": "fluid" \| "apo" \| null }`                                                                                                                                                         |
| Registry: COM                                             | `HKCR\CLSID\{clsid}` `(default)="FluidEQ Engine"`, `InProcServer32` `(default)=<dll path>`, `ThreadingModel="Both"`                                                                                                                                    |
| Registry: engine registration                             | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Audio\AudioProcessingObjects\{clsid}` (`FriendlyName`, `Copyright`, `MajorVersion`, `MinorVersion`, `Flags`, `MinInputConnections`…, `NumAPOInterfaces`, `APOInterface0` = IID_IAudioProcessingObject) |
| Registry: unsigned switch                                 | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Audio` `DisableProtectedAudioDG` = 1 (REG_DWORD)                                                                                                                                                       |
| Registry: per output                                      | `HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\MMDevices\Audio\Render\{guid}\FxProperties`                                                                                                                                                            |

### Per-output attach rules (the "list edit")

Given the endpoint's FxProperties values, produce the new values:

1. **Mirror singles into composites** so nothing already registered is
   dropped when Windows starts reading the composite keys:
   for each `(single, composite)` in `((5,13),(6,14),(7,15))`: if
   `composite` is absent and `single` is present and non-empty, set
   `composite = [single]`.
2. **Legacy only** (no pid 5/6/7/13/14/15 present, pid 1 and/or 2 present):
   set `13 = [pid1]` if pid 1 present, `14 = [pid2]` if pid 2 present. Leave
   pids 1/2 alone.
3. **Append** our CLSID to `15` if not already present (case-insensitive).
4. **Modes**: if `{d3993a3f-…},7` (EFX streaming modes) is absent, set it to
   `[{C18E2F7E-933D-4965-B7D1-1EEF228D2AF3}]` (DEFAULT). Never change an
   existing value.
5. Detach: remove our CLSID from `15`; if `15` is now empty and it did not
   exist in the backup, delete it; if `{d3993a3f-…},7` did not exist in the
   backup, delete it. Mirrored composites are left in place (they only repeat
   what the vendor registered).

Backups are taken before step 1 the first time an endpoint is touched and never
overwritten afterwards. `--slot mfx` is a helper option that uses pid 14 and
`{d3993a3f-…},6` instead of 15/7, kept for the hardware gate only.

### What the DLL reads

The Equalizer APO layout FluidEQ writes today, with these rules (each mirrors
`apoConfigReader.ts` / `deviceProfiles.ts` and Equalizer APO itself):

- Start at `<config dir>\config.txt`. `Include: <relative>` splices the named
  file, resolved against the config dir and refused if it escapes it; depth
  limit 8; a cycle stops the include.
- `Device: <pattern>` sets the match flag for every following line, across
  includes, until the next `Device:`. Matches when the pattern is `all`, or
  equals the endpoint GUID (case-insensitive, braces included), or is a
  case-insensitive substring of the endpoint's friendly name. No `Device:`
  line yet means "matches" (APO's default). While unmatched, every line is
  skipped — `Include:` too, so another output's files are never opened.
- `Channel: all` accepted; any other channel selection is logged once and the
  block treated as `all` (FluidEQ never writes anything else).
- `Convolution: <file>` (relative to the config dir or absolute), `GraphicEQ:`,
  `Filter [n]: ON <type> Fc <f> Hz [Gain <g> dB] (Q <q> | BW Oct <o>)`,
  `Preamp: <g> [dB]`. Anything else (`Copy:`, `Delay:`, `Plugin:`, …) is
  collected as "ignored" for the log — the custom layer is the one place these
  appear, and the engine dialog says the engine does not run them.
- An empty or missing `config.txt`, or one whose chain has nothing for this
  endpoint, is pass-through. That is the "neutral" state the app writes for the
  engine not in use (`flushDeviceProfiles(..., isEnabled=false)` produces a
  `fluideq.txt` with no `Device:` block).

Processing order: convolution → graphic EQ FIR → biquads in file order →
preamp. Same order as Equalizer APO applies the same lines.

### The DLL

- `IAudioProcessingObject`, `IAudioProcessingObjectRT`,
  `IAudioProcessingObjectConfiguration`, `IAudioSystemEffects`,
  `IAudioSystemEffects2`. Registration properties:
  `APO_FLAG_SAMPLESPERFRAME_MUST_MATCH | APO_FLAG_FRAMESPERSECOND_MUST_MATCH |
APO_FLAG_BITSPERSAMPLE_MUST_MATCH | APO_FLAG_INPLACE`, one input, one output.
- Formats: 32-bit float only, 1–8 channels, any sample rate.
- `Initialize` reads the endpoint id and friendly name from
  `APOInitSystemEffects2::pDeviceCollection` item 0 (plain
  `APOInitSystemEffects` has no collection → empty guid → pass-through and a
  log line).
- `LockForProcess` allocates: planar scratch for `u32MaxFrameCount`, then
  resolves the chain and builds the graph. Starts the watcher thread on first
  lock; `UnlockForProcess` stops it (stop event, join).
- `APOProcess`: deinterleave → per-channel chain → interleave; honours
  `BUFFER_SILENT`; adopts a newly published graph at block start by swapping an
  atomic pointer. Retired graphs are freed by the watcher thread only after
  the audio thread's generation counter shows they are no longer referenced.
- Graph swap keeps biquad history when the band list has the same length and
  types (a gain/frequency drag does not reset the filters).
- Convolution: own WAV reader (PCM 8/16/24/32, float 32/64), first channel,
  resampled with `feq_resampler_create`/`feq_resample` when the rate differs,
  run through `feq_convolver_kernel_create`/`feq_convolver_create`/`feq_convolve`.
- GraphicEQ: linear-phase FIR, 4097 taps at 48 kHz scaled to the rate,
  frequency sampling with log-frequency interpolation between the points,
  Hann window, run through the same convolver.

### The helper

Single `asInvoker` executable. When its command needs administrator it
re-launches itself with `ShellExecuteExW("runas")`, waits, and exits with the
child's code; the child writes `last-setup.json`, the parent prints it to
stdout so Electron gets a result across the elevation boundary.

| Command                                                | Elevated | Does                                                                                                           |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| `install [--attach-all] [--restart-audio]`             | yes      | copy DLL, COM + APO registration, unsigned switch, create engine dirs with ACL, then optional attach + restart |
| `attach <guid>... [--restart-audio] [--slot efx\|mfx]` | yes      | list edit on each endpoint                                                                                     |
| `detach <guid>... [--restart-audio]`                   | yes      | reverse, from backup                                                                                           |
| `uninstall [--purge]`                                  | yes      | detach all, unregister, delete DLL and Program Files dir; engine dir kept unless `--purge`                     |
| `restart-audio`                                        | yes      | stop `Audiosrv`, stop `AudioEndpointBuilder`, start both, waiting with `NotifyServiceStatusChange`             |
| `status`                                               | no       | JSON: `{ installed, dllPath, dllVersion, configDir, endpoints: [{ guid, attached, backupExists }] }`           |

Exit codes: 0 ok · 2 elevation declined · 3 command failed (details in JSON).

### System-wide DSP (the rack, not only the EQ)

The DSP tab's rack today runs only inside the Library player (`dsp-host`).
Under FluidEQ Engine it runs system-wide, because the DLL links the same
`fluideq-dsp-core` and the rack is already one flat array of doubles
(`encodeChainSettings` in `src/common/dsp/chainWire.ts` →
`feq_chain_settings_decode`).

- The renderer already builds that array for the host; it also sends it to
  main (`SET_SYSTEM_DSP_CHAIN`), which writes it to `<config dir>\fluideq-dsp.txt`
  as one line of decimal doubles separated by single spaces, `#` header
  first. Rewritten on every rack change; the DLL watches the directory
  already.
- The DLL parses the line (`std::from_chars`), calls
  `feq_chain_settings_decode`, forces `denoise.enabled = 0` (the neural
  runtime cannot be loaded into `audiodg.exe`), and `feq_chain_configure`s a
  `FeqChain` per endpoint stream. Player-only stages (crossfade, normalizer,
  track-level gains, noise profile) are simply never set.
- Order inside the DLL: rack first, then the EQ chain (convolution → graphic
  → filters → preamp). That is the order the Library player already
  produces: rack in the app, then Equalizer APO on the device.
- Latency reported to Windows through `IAudioProcessingObject::GetLatency`:
  `feq_chain_latency_frames` plus the convolver's, so video players that
  read the audio clock stay in sync. Linear-phase EQ (8192 frames ≈ 171 ms at
  48 kHz) is allowed and the DSP page shows the delay beside the scope pill.
- Missing or unparsable `fluideq-dsp.txt` → rack bypassed, EQ still runs.
- Under Equalizer APO nothing changes: the rack stays Library-only and the
  DSP page says so, with a link to the engine dialog.

### The app — one EQ page, one DSP page, one dialog

- **No new pages, tabs or chips.** The EQ page and the DSP page are byte-for-byte
  the same components. The only visible additions: the DSP page's existing
  scope notice gains a system-wide variant, and the menu gains "Audio
  engine…".
- `audioEngine` preference (`'fluid' | 'apo' | null`). Migration on first
  launch without the file: Equalizer APO installed → `'apo'` (nothing asked,
  nothing changes for existing users); the installer wrote a choice → that;
  otherwise `null`.
- `getConfigPath()` becomes `getConfigPath(engine)`: `'fluid'` → the engine
  config dir; `'apo'` → today's registry lookup. Every existing caller passes
  `session.audioEngine`. `isEqualizerAPOInstalled()` as a gate becomes
  `isEngineInstalled(engine)`.
- **Only one engine is written to.** Every flush goes to `session.configPath`
  and nowhere else. The other engine is touched exactly once, at the moment of
  switching: `neutraliseEngine(other)` writes the neutral `fluideq.txt` (no
  `Device:` block) into that engine's directory _if that engine is installed_,
  and never again until the next switch.
- **Equalizer APO absent is not an error** when the engine is `'fluid'`: no
  registry probe, no config-path lookup, no APO watcher, no APO menu items,
  no `EQUALIZER_APO_NOT_INSTALLED`. The three APO menu items (Reconfigure,
  Settings, Reinstall) move inside the engine dialog and render only when
  the engine is `'apo'`.
- Blocking errors: `AUDIO_ENGINE_NOT_CHOSEN` (preference `null`, shows the
  engine dialog with no Cancel) and `FLUID_ENGINE_NOT_INSTALLED` (shows the
  existing red banner with one button, "Install FluidEQ Engine").
- **One dialog**, `AudioEngineDialog`: two radios (FluidEQ Engine
  recommended / Equalizer APO), three short lines under each, "Now: …", Cancel
  and Apply. Opened from the menu, or as the blocking first-run case. Apply
  from `'apo'` → `'fluid'`: install the engine if missing (one UAC prompt),
  save, reflush (which neutralises APO). Apply from `'fluid'` → `'apo'`:
  save, reflush (which neutralises the engine), then run Equalizer APO's own
  setup if it is not installed.
- The existing red "not enabled for this output" notice
  (`DeviceProfiles.tsx`) becomes engine-aware: under `'fluid'` its button is
  "Enable" and calls `attach`; under `'apo'` it is today's "Enable in Device
  Selector".
- The output pill `output.apoOff` becomes engine-neutral copy ("OFF").
- Installer: an nsDialogs page with two radios and a "why Windows will ask
  for permission" line. It writes `audio-engine.json` and runs the chosen
  engine's setup. The helper's version resource and product name read
  "FluidEQ Audio Processing Engine Setup" so the UAC prompt names it.

### Copy (English source; every locale gets its own)

Installer page

- Title: How should FluidEQ process your sound?
- Subtitle: One engine runs for the whole PC. You can switch later from the app menu.
- FluidEQ Audio Processing Engine (recommended): Runs inside Windows' own
  audio system, after your sound card's effects, so Alienware Sound Center,
  Nahimic, MaxxAudio and Dolby keep working. EQ and the DSP rack apply to
  everything. No restart.
- Equalizer APO: The classic engine. Runs custom commands, Peace and VST
  plugins. Replaces your sound card's effect slot, so vendor panels can lose
  their controls. Its own setup opens next, and Windows must restart. DSP rack
  works in Library playback only.
- Why line: Windows will ask for permission next. An audio engine has to be
  placed inside Windows' audio system, and only an administrator can do that.
  Either choice asks once.

Engine dialog

- FluidEQ Engine — RECOMMENDED: Your sound card's own effects and panel keep
  working · EQ and the DSP rack apply to everything, no restart · Custom APO
  commands, Peace and VST plugins do not run.
- Equalizer APO: Custom commands, Peace, VST plugins · Takes over your sound
  card's effect slot; vendor panels can lose controls · DSP rack works in
  Library playback only. Separate setup, Windows restarts.
- Footer: Now: {engine} · Cancel · Apply.

DSP page scope pill

- fluid: System-wide · {output} (+ "{ms} ms delay" when linear phase is on)
- apo: Library playback only · Use FluidEQ Engine (link opens the dialog)
- Denoise card under fluid: Library playback only.

Output notice (fluid)

- FluidEQ is not enabled for this output. Enabling asks for Windows
  permission and restarts audio for a moment. No reboot. · Not now · Enable.

---

## File Structure

**Native (new)**

- `native/system-apo/CMakeLists.txt` — Windows-only targets, included from
  `native/CMakeLists.txt` under `if(WIN32)`.
- `native/system-apo/include/fluideq_engine/config.h` + `src/config.cpp` —
  line grammar + include/device resolution over a file-provider callback
  (pure, unit-tested).
- `native/system-apo/include/fluideq_engine/graph.h` + `src/graph.cpp` — one
  output's processing graph over dsp-core (pure, unit-tested).
- `native/system-apo/src/wav.h/.cpp`, `src/graphic_eq.h/.cpp` (pure).
- `native/system-apo/src/apo.h/.cpp` — the COM object.
- `native/system-apo/src/watcher.h/.cpp` — directory watch thread + log.
- `native/system-apo/src/paths.h/.cpp`, `src/dll.cpp`, `engine.def`, `engine.rc`.
- `native/system-apo/setup/main.cpp`, `elevate.cpp`, `registry.cpp`,
  `fx_list.h/.cpp` (pure list edit, unit-tested), `services.cpp`, `acl.cpp`,
  `setup.manifest`, `setup.rc`.
- `native/system-apo/tests/config_test.cpp`, `graph_test.cpp`,
  `fx_list_test.cpp`, `wav_test.cpp`, `graphic_eq_test.cpp`, `dll_smoke_test.cpp`.

**TypeScript (new)**

- `src/common/audioEngine.ts` — types, constants.
- `src/main/audioEngineStore.ts` — load/save the preference.
- `src/main/engineSetup.ts` — run the helper, parse its JSON.
- `src/main/engineStatus.ts` — status from the helper + OS version.
- `src/main/ipc/audioEngine.ts` — the IPC handlers.
- `src/renderer/components/AudioEngineDialog.tsx` + `styles/AudioEngineDialog.scss`.
- `src/main/engineNeutralise.ts` — the one write to the engine not in use, at switch time.
- `native/system-apo/src/dsp_chain.h/.cpp` — the rack line → `FeqChainSettings`.
- `src/renderer/utils/audioEngineApi.ts` — renderer wrappers.

**Modified**

- `native/CMakeLists.txt`, `.erb/scripts/build-native-dsp.ts`, `package.json`
  (`extraResources` filter), `assets/nsis/installer.nsh`,
  `assets/windows-audio-devices.ps1`, `src/common/constants.ts`
  (`IAudioDevice.isFluidEngineAttached`), `src/common/errors.ts`,
  `src/common/channels.ts`, `src/main/registry.ts`, `src/main/main.ts`,
  `src/main/ipc/profiles.ts` and `src/main/ipc/references.ts` (they call
  `getConfigPath()` — pass the engine), `src/main/bugReportFacts.ts`,
  `src/renderer/App.tsx`, `src/renderer/PrereqMissingModal.tsx`, `src/renderer/dsp/store.ts`, `src/renderer/dsp/DspPanel.tsx`, `src/renderer/dsp/DspDenoiseCard.tsx`,
  `src/renderer/DeviceProfiles.tsx`, `src/renderer/components/ConfigInspector.tsx`,
  `src/common/i18n/*/app.ts` and `eq.ts` (ten locales), `CHANGELOG.md`,
  `README.md`, `CLAUDE.md`.

---

## Gate: hearing it on real hardware

Task 6 ends with a build that Ivan runs on this PC (Realtek + Nahimic
endpoints, Equalizer APO present) and on the Alienware (legacy vendor effect,
built-in subwoofer). Nothing after Task 6 starts until both say:

1. A -20 dB peak at 1 kHz written to the engine config is audible, and
   removing the line restores the sound without restarting anything.
2. The vendor panel still controls its own features (the subwoofer on the
   Alienware; Nahimic's toggles here).
3. Equalizer APO on the same endpoint keeps working when the engine is
   detached, and vice versa.

If (1) fails on the EFX slot, `attach --slot mfx` is tried before anything
else is changed, and the Design's slot choice is updated with the result.

---

### Task 1: Build scaffolding and the config resolver

**Files:**

- Create: `native/system-apo/CMakeLists.txt`
- Create: `native/system-apo/include/fluideq_engine/config.h`
- Create: `native/system-apo/src/config.cpp`
- Create: `native/system-apo/tests/config_test.cpp`
- Modify: `native/CMakeLists.txt` (append `if(WIN32) add_subdirectory(system-apo) endif()` before the `fluideq-dsp-host` target)

**Interfaces:**

```cpp
namespace fluideq_engine {
enum class FilterType { PK, NO, LSC, HSC, LPQ, HPQ, BP };
struct Band { FilterType type; double frequency; double gain_db; double quality; };
struct GraphicPoint { double frequency; double gain_db; };
struct Chain {
  std::wstring convolution_path;        // empty = none; absolute, resolved by the resolver
  std::vector<GraphicPoint> graphic;    // empty = none
  std::vector<Band> bands;
  double preamp_db = 0.0;
  std::vector<std::string> ignored;     // first token of each unknown line, deduplicated
  std::vector<std::wstring> files_read; // every file the chain touched, for the log
  bool matched = false;                 // any line applied to this endpoint
};
struct Endpoint { std::wstring guid; std::wstring friendly_name; };
/** Returns the file's bytes, or nullopt when unreadable. Paths are absolute. */
using FileProvider = std::function<std::optional<std::string>(const std::wstring& path)>;
/** Start at `<config_dir>\config.txt`. Never throws. */
Chain resolve_chain(const std::wstring& config_dir, const Endpoint& endpoint, const FileProvider& read);
/** One file's lines, includes NOT followed — the unit the resolver is built on. */
struct Line { std::string command; std::string body; };
std::vector<Line> tokenize(std::string_view text);   // BOM/UTF-16 aware, comments stripped
std::optional<Band> parse_filter(std::string_view body);
std::vector<GraphicPoint> parse_graphic(std::string_view body);
bool device_matches(std::string_view pattern, const Endpoint& endpoint);
}
```

- [ ] **Step 1: Write the failing test**

`native/system-apo/tests/config_test.cpp` (licence header, the `CHECK`
macro from the other native tests, a `std::map<std::wstring, std::string>`
backed provider):

```cpp
void follows_includes_and_device_guards() {
  Files files;
  files[L"C:\\cfg\\config.txt"] = "Include: fluideq.txt\r\n";
  files[L"C:\\cfg\\fluideq.txt"] =
      "# Generated by FluidEQ.\r\n"
      "Device: all\r\nChannel: all\r\n"
      "Device: {AAAA}\r\nChannel: all\r\nInclude: fluideq-device-a.txt\r\n"
      "Device: {BBBB}\r\nChannel: all\r\nInclude: fluideq-device-b.txt\r\n";
  files[L"C:\\cfg\\fluideq-device-a.txt"] =
      "Convolution: fluideq-convolution-a.wav\r\n"
      "Include: fluideq-a-eq.txt\r\nPreamp: -3.5 dB\r\nInclude: fluideq-a-custom.txt\r\n";
  files[L"C:\\cfg\\fluideq-a-eq.txt"] =
      "Filter 1: ON PK Fc 1000 Hz Gain -3 dB Q 1.41\r\nFilter 2: ON HPQ Fc 30 Hz Q 0.71\r\n";
  files[L"C:\\cfg\\fluideq-a-custom.txt"] = "Copy: L=R\r\nDelay: 10 ms\r\n";
  files[L"C:\\cfg\\fluideq-device-b.txt"] = "Filter 1: ON PK Fc 500 Hz Gain 9 dB Q 1\r\n";
  const auto chain = resolve_chain(L"C:\\cfg", {L"{AAAA}", L"Speakers (Realtek)"}, provider(files));
  CHECK(chain.matched);
  CHECK(chain.bands.size() == 2);
  CHECK(chain.bands[0].frequency == 1000.0);
  CHECK(chain.convolution_path == L"C:\\cfg\\fluideq-convolution-a.wav");
  CHECK(chain.preamp_db == -3.5);
  CHECK(chain.ignored == std::vector<std::string>{"Copy", "Delay"});
  // B's file is never opened while the guard is false.
  CHECK(std::find(chain.files_read.begin(), chain.files_read.end(),
                  L"C:\\cfg\\fluideq-device-b.txt") == chain.files_read.end());
}

void neutral_root_is_passthrough() {
  Files files;
  files[L"C:\\cfg\\config.txt"] = "Include: fluideq.txt\r\n";
  files[L"C:\\cfg\\fluideq.txt"] = "# Generated by FluidEQ.\r\n# Neutral.\r\n";
  const auto chain = resolve_chain(L"C:\\cfg", {L"{AAAA}", L"Speakers"}, provider(files));
  CHECK(!chain.matched);
  CHECK(chain.bands.empty());
}

void missing_root_is_passthrough() {
  const auto chain = resolve_chain(L"C:\\cfg", {L"{AAAA}", L"Speakers"}, provider({}));
  CHECK(!chain.matched);
}

void device_pattern_rules() {
  const Endpoint endpoint{L"{ABCD-1}", L"Speakers (2- Realtek Audio)"};
  CHECK(device_matches("all", endpoint));
  CHECK(device_matches("{abcd-1}", endpoint));
  CHECK(device_matches("Realtek", endpoint));
  CHECK(!device_matches("{FFFF}", endpoint));
  CHECK(!device_matches("Headphones", endpoint));
}

void include_cannot_escape_or_loop() {
  Files files;
  files[L"C:\\cfg\\config.txt"] = "Include: ..\\evil.txt\r\nInclude: loop.txt\r\nPreamp: -1\r\n";
  files[L"C:\\evil.txt"] = "Preamp: -40\r\n";
  files[L"C:\\cfg\\loop.txt"] = "Include: loop.txt\r\nFilter 1: ON PK Fc 100 Hz Gain 1 dB Q 1\r\n";
  const auto chain = resolve_chain(L"C:\\cfg", {L"{A}", L"X"}, provider(files));
  CHECK(chain.preamp_db == -1.0);
  CHECK(chain.bands.size() == 1);   // loop.txt read once
}

void filter_grammar() {
  CHECK(parse_filter("ON PK Fc 1000 Hz Gain -3 dB Q 1.41")->quality == 1.41);
  CHECK(parse_filter("ON LS Fc 80 Hz Gain 1 dB Q 0.7")->type == FilterType::LSC);
  CHECK(parse_filter("ON HPQ Fc 30 Hz Q 0.71")->gain_db == 0.0);
  CHECK(!parse_filter("OFF PK Fc 1 Hz Gain 1 dB Q 1"));
  CHECK(!parse_filter("ON XX Fc 100 Hz Gain -3 dB Q 1"));
  CHECK(!parse_filter("ON PK Fc nope Hz Gain -3 dB Q 1"));
  CHECK(!parse_filter("ON PK Fc 100 Hz Gain -3 dB Q 0"));
  const auto bw = parse_filter("ON PK Fc 100 Hz Gain -3 dB BW Oct 1");
  CHECK(bw && std::abs(bw->quality - 1.4142135) < 1e-6);
}

void graphic_and_preamp_grammar() {
  const auto points = parse_graphic("20 -2.5; 1000 0; 20000 3");
  CHECK(points.size() == 3 && points[2].gain_db == 3.0);
  CHECK(parse_graphic("20 -2.5; nope").empty());
  const auto lines = tokenize("Preamp: -6\nPreamp:-2.5 dB\n# c\n\nFilter 1: ON PK Fc 1 Hz Gain 1 dB Q 1 # trailing\n");
  CHECK(lines.size() == 3);
  CHECK(lines[0].command == "Preamp" && lines[0].body == "-6");
  CHECK(lines[2].command == "Filter" && lines[2].body == "ON PK Fc 1 Hz Gain 1 dB Q 1");
}

void utf16_with_bom_is_read() {
  const char16_t text[] = u"\uFEFFPreamp: -1 dB\n";
  const auto lines = tokenize(std::string_view(reinterpret_cast<const char*>(text), sizeof(text) - sizeof(char16_t)));
  CHECK(lines.size() == 1 && lines[0].body == "-1 dB");
}
```

`main` calls all eight and prints `config: ok`.

- [ ] **Step 2: Add the CMake target and header; run `pnpm build:native-dsp` — expected: link errors for the new symbols.**

`native/system-apo/CMakeLists.txt`:

```cmake
#[[
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
]]

# The system-wide engine: an audio effect Windows loads into audiodg.exe for
# every output it is attached to, plus the helper that attaches it. Windows
# only, and deliberately split from the DSP host: the host is a process FluidEQ
# owns, the effect is code running inside somebody else's.

add_library(fluideq-engine-config STATIC src/config.cpp)
target_include_directories(fluideq-engine-config PUBLIC include)
target_link_libraries(fluideq-engine-config PRIVATE feq_strict)

add_executable(fluideq-engine-config-test tests/config_test.cpp)
target_link_libraries(fluideq-engine-config-test PRIVATE fluideq-engine-config feq_strict)
add_test(NAME engine-config COMMAND fluideq-engine-config-test)
```

- [ ] **Step 3: Implement `config.cpp`**

Rules, in the order they run:

- `tokenize`: strip UTF-16LE BOM (transcode to UTF-8) or UTF-8 BOM; split on
  `\n`, trim `\r` and whitespace; drop everything from the first `#`; skip
  empty lines and lines without `:`; `command` = text before the colon with a
  trailing ` <digits>` removed (`Filter 3` → `Filter`); `body` = trimmed rest.
- Numbers only through `std::from_chars` — never `strtod`, which reads the
  locale and turns `1.41` into `1` on a German Windows.
- `parse_filter`: `ON <type> Fc <f> Hz [Gain <g> dB] (Q <q> | BW Oct <o>)`,
  aliases `PK PEQ MODAL → PK`, `NO NOTCH`, `LS LSC LSQ → LSC`, `HS HSC HSQ →
HSC`, `LP LPQ`, `HP HPQ`, `BP`; `f > 0`, `q > 0`; `BW Oct o` →
  `q = sqrt(2^o) / (2^o - 1)`; trailing tokens → reject.
- `device_matches`: `all` → true; pattern equals guid (case-insensitive) →
  true; friendly name contains pattern (case-insensitive, UTF-8 compared after
  `towlower` on the wide side) → true.
- `resolve_chain`: `struct Frame { path; lines; index; }` stack, depth ≤ 8,
  `std::set<std::wstring>` of files already opened (cycle guard); `bool
matching = true` carried across frames; on `Include:` when matching:
  `path = canonical(config_dir + '\\' + body)` — computed by
  `PathCchCanonicalizeEx`-free string logic: reject bodies containing `..`
  segments or a drive/UNC prefix, join, and require the prefix `config_dir +
'\\'`; on `Convolution:` resolve the same way, but an absolute path is
  allowed as written.

- [ ] **Step 4: Run `pnpm build:native-dsp --test` — `engine-config` passes; every existing test still passes.**

- [ ] **Step 5: Commit**

```bash
git add native/CMakeLists.txt native/system-apo
git commit -m "feat(engine): resolve the Equalizer APO config layout for one endpoint

Includes, Device: guards and the five commands FluidEQ writes, read the
way apoConfigReader.ts and Equalizer APO read them. Locale-independent
numbers; unknown commands collected for the log, never fatal.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: WAV reader and graphic-EQ kernel design

**Files:**

- Create: `native/system-apo/src/wav.h`, `src/wav.cpp`, `src/graphic_eq.h`, `src/graphic_eq.cpp`
- Create: `native/system-apo/tests/wav_test.cpp`, `tests/graphic_eq_test.cpp`
- Modify: `native/system-apo/CMakeLists.txt` (static lib `fluideq-engine-dsp` = `wav.cpp graphic_eq.cpp graph.cpp`, `PUBLIC` link `fluideq-dsp-core`; tests `engine-wav`, `engine-graphic-eq`)

**Interfaces:**

```cpp
namespace fluideq_engine {
struct WavData { uint32_t sample_rate; std::vector<float> mono; };
std::optional<WavData> parse_wav(const uint8_t* bytes, size_t size);   // first channel; PCM 8/16/24/32, float 32/64
std::optional<WavData> read_wav(const std::wstring& path);             // whole file via CreateFileW, then parse_wav
/** Linear-phase FIR; `taps` is forced odd. Empty points → unit impulse of length `taps`. */
std::vector<float> design_graphic_kernel(const std::vector<GraphicPoint>& points, uint32_t sample_rate, uint32_t taps);
}
```

- [ ] **Step 1: Write the failing tests**

`wav_test.cpp`: build in memory (a) 48 kHz 16-bit stereo, four frames L=+16384/R=-16384 → rate 48000, `mono ≈ {0.5,0.5,0.5,0.5}` within 1e-4; (b) float-32 mono with values `{1, -0.5, 0.25}` → exact; (c) WAVE_FORMAT_EXTENSIBLE (0xFFFE) with the PCM sub-format GUID → parsed; (d) a 20-byte buffer → `nullopt`; (e) format tag 0x0055 → `nullopt`; (f) a `data` chunk size larger than the buffer → `nullopt`, never a read past the end.

`graphic_eq_test.cpp`: points `{20,0},{1000,-12},{20000,0}` at 48 kHz, 4097 taps → symmetric (`k[i] == k[n-1-i]` within 1e-9); DTFT magnitude at 1 kHz (direct `cos/sin` sum over the taps) within 1 dB of -12 dB; at 100 Hz within 1.5 dB of the log-interpolated target (−12 · log(100/20)/log(1000/20) dB); empty points → `k[n/2] == 1` and every other tap 0; `taps = 4096` yields 4097.

- [ ] **Step 2: Run — link errors.**

- [ ] **Step 3: Implement.** `wav.cpp`: RIFF/WAVE chunk walk with bounds checks on every read; `fmt ` tag 1/3/0xFFFE (sub-format GUID first two bytes 1 or 3); channels 1–8; bits ∈ {8,16,24,32,64}; PCM normalised by `2^(bits-1)` (8-bit is unsigned, centre 128). `graphic_eq.cpp`: `n = taps | 1`; FFT size `m` = next power of two ≥ 2n; for bin `k ≤ m/2`, `f = k·rate/m`, gain by piecewise-linear interpolation in `log10(f)` clamped to the outer points, magnitude `10^(dB/20)` with zero phase (mirror to negative bins); `feq_fft_in_place(inverse=1)`, divide by `m`, rotate by `n/2`, keep `n` taps, Hann window.

- [ ] **Step 4: Run tests — both pass. Step 5: Commit** (`feat(engine): WAV reader and linear-phase graphic EQ kernel`).

---

### Task 3: The processing graph

**Files:**

- Create: `native/system-apo/include/fluideq_engine/graph.h`, `src/graph.cpp`
- Create: `native/system-apo/tests/graph_test.cpp`
- Modify: `native/system-apo/CMakeLists.txt` (`graph.cpp` into `fluideq-engine-dsp`; test `engine-graph`)

**Interfaces:**

```cpp
namespace fluideq_engine {
class Graph {
 public:
  /** Allocates everything; loads the IR and designs the FIR here, never later. */
  Graph(const Chain& chain, uint32_t sample_rate, uint32_t channels, uint32_t max_frames);
  ~Graph();
  Graph(const Graph&) = delete; Graph& operator=(const Graph&) = delete;
  void process(float* const* planar, uint32_t frames) noexcept;   // real-time safe, in place
  void inherit_state(const Graph& previous) noexcept;             // biquad histories, when layouts match
  bool has_same_band_layout(const Graph& other) const noexcept;   // same count and types
  bool is_passthrough() const noexcept;                            // !matched, or nothing to do
  uint32_t latency_frames() const noexcept;                        // convolver latency when an IR/FIR is loaded
  const std::vector<std::string>& warnings() const noexcept;       // IR unreadable, rate mismatch fixed, …
};
}
```

Uses `feq_biquad_coefficients(FeqFilterType, frequency, gain_db, quality, sample_rate)` (check the exact parameter order in `biquad.h:85` before writing) and `feq_biquad_process(state, coefficients, buffer, frames)` (`biquad.h:106`), `feq_convolver_*`, `feq_convolve`, `feq_resampler_create`/`feq_resample`/`feq_resampler_flush`.

- [ ] **Step 1: Write the failing test** (`graph_test.cpp`, chains built by `resolve_chain` over an in-memory provider so the same grammar is exercised):
- `peak_cut_attenuates_its_frequency`: `Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4`, 48 kHz stereo, 1 s of a 1 kHz sine at 0.5 in 480-frame blocks; RMS of the last 0.5 s is 20 ± 1 dB below input; a 100 Hz sine stays within 0.5 dB.
- `preamp_scales`: `Preamp: -6 dB` only → −6 ± 0.05 dB.
- `unmatched_chain_is_passthrough`: a chain with `matched == false` → output bit-identical; `is_passthrough()` true.
- `state_inherits_across_gain_change`: A = `PK 1000 -3 Q 1`, 4800 frames; B = `PK 1000 -4 Q 1`; with `inherit_state(A)` the first output sample of B differs from A's last by < 0.05; without it, > 0.05. Assert both.
- `convolution_applies_kernel`: temp WAV written with `std::ofstream` (float32 48 kHz: unit impulse, then 0.5 at frame 48); impulse in → 1.0 at `latency_frames()` and 0.5 at `latency_frames() + 48` (± 1e-4).
- `convolution_at_other_rate_is_resampled`: same IR at 44.1 kHz, graph at 48 kHz → second impulse lands at `latency + round(48·48000/44100)` ± 1 frame, and `warnings()` names the resample.
- `graphic_eq_applies`: `GraphicEQ: 20 0; 1000 -12; 20000 0` → 1 kHz attenuated 12 ± 1.5 dB after `feq_convolver_warmup()` frames.

- [ ] **Step 2: Run — link errors. Step 3: Implement `graph.cpp`** (per-channel `states`, one shared coefficient vector, per-channel convolvers for IR and FIR, `preamp_linear = pow(10, db/20)`; process order convolution → FIR → biquads → preamp). **Step 4: Run — passes. Step 5: Commit** (`feat(engine): per-output processing graph over dsp-core`).

---

### Task 4: The effect DLL

**Files:**

- Create: `native/system-apo/src/apo.h`, `src/apo.cpp`, `src/watcher.h`, `src/watcher.cpp`, `src/paths.h`, `src/paths.cpp`, `src/dll.cpp`, `src/engine.def`, `src/engine.rc`
- Create: `native/system-apo/tests/dll_smoke_test.cpp`
- Modify: `native/system-apo/CMakeLists.txt` (`add_library(fluideq-engine SHARED …)`, `OUTPUT_NAME FluidEQ-Engine`, `RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin`, links `fluideq-engine-config fluideq-engine-dsp feq_strict ole32 propsys mmdevapi shell32`; `engine-dll-smoke` test with the DLL path as `argv[1]`)

**Interfaces:**

- `CLSID_FluidEqEngine = {B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}` in `apo.h`.
- `paths.h`: `std::wstring engine_root()` (`SHGetKnownFolderPath(FOLDERID_ProgramData)` + `\FluidEQ\engine`), `config_dir()` (`+ \config`), `log_path()`.
- Exports: `DllGetClassObject`, `DllCanUnloadNow` (no `DllRegisterServer` — registration is the helper's job).

- [ ] **Step 1: Write the smoke test**: `LoadLibraryW(argv[1])`, `DllGetClassObject(CLSID_FluidEqEngine, IID_IClassFactory)`, `CreateInstance(IID_IAudioProcessingObject)`; `GetRegistrationProperties` → `clsid == CLSID_FluidEqEngine`, `Flags & APO_FLAG_INPLACE`, `u32MinInputConnections == 1`; `QueryInterface` for `IAudioProcessingObjectRT`, `IAudioProcessingObjectConfiguration`, `IAudioSystemEffects`, `IAudioSystemEffects2` all `S_OK`; `IsInputFormatSupported` with a float 48 kHz stereo `IAudioMediaType` (`CreateAudioMediaType`) → `S_OK`; with 16-bit PCM → `S_FALSE` and the suggestion is float; `Initialize` with a plain `APOInitSystemEffects` → `S_OK`; `LockForProcess` with one 480-frame float stereo connection each way → `S_OK`; `APOProcess` on a buffer of ones with no config dir present → output equals input (pass-through); `UnlockForProcess` → `S_OK`; `DllCanUnloadNow` after release → `S_OK`.

- [ ] **Step 2: Run — no DLL. Step 3: Implement** as in Design ("The DLL"). Watcher: `FindFirstChangeNotificationW(config_dir(), TRUE, FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_SIZE | FILE_NOTIFY_CHANGE_FILE_NAME)`; `WaitForMultipleObjects({stop, change})`; on change: `resolve_chain` with a `CreateFileW(FILE_SHARE_READ|WRITE|DELETE)` provider, new `Graph` (inheriting state when layouts match), publish to `std::atomic<Graph*> pending`; audio thread swaps into `active` at block start and bumps `generation`; retired graphs are deleted at the next publish once `generation` moved past their retirement. Log lines: chain loaded (files, band count, preamp, IR), ignored commands (once per set), graph warnings, pass-through reason. `engine.rc`: `VERSIONINFO` with `FileDescription "FluidEQ Engine"`, `ProductName "FluidEQ"`, version from `FEQ_CORE_VERSION`.

- [ ] **Step 4: Run `pnpm build:native-dsp --test` — `bin/FluidEQ-Engine.dll` exists, `engine-dll-smoke` passes. Step 5: Commit** (`feat(engine): the effect DLL Windows loads per output`).

---

### Task 5: The setup helper

**Files:**

- Create: `native/system-apo/setup/fx_list.h`, `fx_list.cpp` (pure), `registry.h/.cpp`, `elevate.h/.cpp`, `services.h/.cpp`, `acl.h/.cpp`, `endpoints.h/.cpp` (MMDevice enumeration), `main.cpp`, `setup.manifest`, `setup.rc`
- Create: `native/system-apo/tests/fx_list_test.cpp`
- Modify: `native/system-apo/CMakeLists.txt` (`fluideq-engine-setup`, output `FluidEQ-Engine-Setup`, links `advapi32 shell32 ole32 version`, `/MANIFEST:EMBED /MANIFESTINPUT:${CMAKE_CURRENT_SOURCE_DIR}/setup/setup.manifest`; test `engine-fx-list`)

**Interfaces (pure part):**

```cpp
namespace fluideq_engine::setup {
struct FxValues {
  std::optional<std::wstring> single[3];                  // pids 5,6,7   (REG_SZ)
  std::optional<std::vector<std::wstring>> composite[3];  // pids 13,14,15 (REG_MULTI_SZ)
  std::optional<std::wstring> legacy[2];                  // pids 1,2
  std::optional<std::vector<std::wstring>> modes[3];      // {d3993a3f},5,6,7
};
enum class Slot { Efx, Mfx };
struct FxPlan { FxValues after; bool changed; };
FxPlan plan_attach(const FxValues& before, std::wstring_view clsid, Slot slot);
FxPlan plan_detach(const FxValues& current, const FxValues& backup, std::wstring_view clsid);
bool is_attached(const FxValues& values, std::wstring_view clsid);
std::wstring to_json(const FxValues&); std::optional<FxValues> from_json(std::wstring_view);
}
```

- [ ] **Step 1: Write the failing test** (`fx_list_test.cpp`) asserting the full `after` for: `modern_with_composites` (this PC's Realtek shape) → 15 gains ours at the end, nothing else changes; `modern_singles_only` (E-APO's shape) → 13=[5], 14=[6], 15=[ours], modes[2]=DEFAULT; `legacy_only` → 13=[1], 14=[2], 15=[ours], 1/2 unchanged; `already_attached` → `changed == false`; `mfx_slot` → ours appended to 14 and modes[1] set when absent; `detach_restores_created_keys` (attach from singles-only, then detach with that backup → ours removed, 15 and modes[2] deleted, 13/14 kept); `detach_keeps_others_in_list`; `case_insensitive_match`; `json_round_trip`.

- [ ] **Step 2: Run — link errors. Step 3: Implement** the rules verbatim; `registry.cpp` read/write per endpoint with `KEY_WOW64_64KEY`, backup JSON under `backup\<guid>.json` (write once); `elevate.cpp` (`TokenElevation`, `ShellExecuteExW` + `runas` + `SEE_MASK_NOCLOSEPROCESS`, wait, return exit code; `ERROR_CANCELLED` → 2); `services.cpp` (`ControlService(STOP)` then `NotifyServiceStatusChange(SERVICE_NOTIFY_STOPPED)` + `SleepEx(INFINITE, TRUE)` — an alertable wait woken by the SCM's APC, not a timer; start in dependency order and wait on `SERVICE_NOTIFY_RUNNING`); `acl.cpp` (`SetNamedSecurityInfoW` DACL: SYSTEM Full, Administrators Full, Users Modify, inherited); `endpoints.cpp` (`IMMDeviceEnumerator::EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)` → guids); `main.cpp` (dispatch, `last-setup.json`, stdout echo, exit codes). `install` copies `<exe dir>\FluidEQ-Engine.dll` to `%ProgramFiles%\FluidEQ Engine\`, writes COM + `AudioProcessingObjects` keys, sets `DisableProtectedAudioDG=1`, creates `engine\`, `engine\config\`, `engine\backup\` with the ACL, writes an empty `config\config.txt` if absent. `uninstall` detaches every endpoint that has a backup, removes the keys, deletes the DLL and its directory; leaves the unsigned switch as found.

- [ ] **Step 4: Run `pnpm build:native-dsp --test` — `engine-fx-list` passes; `bin/FluidEQ-Engine-Setup.exe` exists. Step 5: Commit** (`feat(engine): self-elevating setup helper that appends to the effect list`).

---

### Task 6: Build integration and the hardware gate

**Files:**

- Modify: `.erb/scripts/build-native-dsp.ts` (after the LAN capture check: assert `FluidEQ-Engine.dll` and `FluidEQ-Engine-Setup.exe` exist on Windows)
- Modify: `package.json` `build.extraResources[1].filter` → add `"FluidEQ-Engine*"`
- Create: `docs/superpowers/plans/2026-09-09-fluideq-engine-gate.md`

- [ ] **Step 1:** Make the two edits; `pnpm build`; confirm both files under `native/.build/bin`.
- [ ] **Step 2:** Write the gate checklist with a results table (this PC / Alienware × the three questions above):
  1. `native\.build\bin\FluidEQ-Engine-Setup.exe install --attach-all --restart-audio` (one UAC prompt).
  2. In `%ProgramData%\FluidEQ\engine\config\` write `config.txt` = `Include: fluideq.txt` and `fluideq.txt` = `Device: all` / `Filter 1: ON PK Fc 1000 Hz Gain -20 dB Q 4`; play a 1 kHz tone; expect it to nearly vanish; delete the filter line; expect it back without restarting anything.
  3. Open the vendor panel and confirm its controls still act (subwoofer level on the Alienware; Nahimic's toggles here).
  4. `detach {guid} --restart-audio`; confirm Equalizer APO still processes there; `attach` again; confirm the engine does.
  5. `uninstall`; confirm the endpoint's FxProperties equal the backup JSON.
- [ ] **Step 3: Commit** (`build(engine): ship the engine DLL and helper with the app`), then stop and report `Status: BLOCKED — Needed: Ivan runs the gate checklist on this PC and the Alienware`.

---

### Task 7: Engine preference and engine-aware config directory

**Files:**

- Create: `src/common/audioEngine.ts`, `src/main/audioEngineStore.ts`
- Modify: `src/main/registry.ts` (`getConfigPath(engine)`, `isEngineInstalled(engine)`, `getFluidEngineConfigDir()`)
- Modify: every `getConfigPath()` caller — `src/main/main.ts`, `src/main/ipc/profiles.ts:546-556`, `src/main/ipc/references.ts:223-224` (grep for the rest) — passes `session.audioEngine`
- Test: `src/__tests__/unit_tests/main/audioEngineStore.test.ts`, `src/__tests__/unit_tests/main/engineConfigPath.test.ts`

**Interfaces:**

```ts
// src/common/audioEngine.ts
export type TAudioEngine = 'fluid' | 'apo';
export const AUDIO_ENGINES: readonly TAudioEngine[] = ['fluid', 'apo'];
export const AUDIO_ENGINE_FILENAME = 'audio-engine.json';
export const FLUID_ENGINE_CLSID = '{B7E2C4D1-5A8F-4C3E-9D2B-6F1A0C8E7D34}';
export const FLUID_ENGINE_DSP_FILENAME = 'fluideq-dsp.txt';
export interface IAudioEnginePreference { version: 1; engine: TAudioEngine | null; }
export interface IFluidEngineEndpoint { guid: string; attached: boolean; backupExists: boolean; }
export interface IFluidEngineStatus { installed: boolean; dllPath?: string; dllVersion?: string; configDir?: string; endpoints: IFluidEngineEndpoint[]; }
export interface IAudioEngineStatus { engine: TAudioEngine | null; apo: { installed: boolean }; fluid: IFluidEngineStatus; fluidSupported: boolean; }

// src/main/audioEngineStore.ts
export const loadAudioEnginePreference = (userDataDir: string): IAudioEnginePreference;
export const saveAudioEnginePreference = (userDataDir: string, engine: TAudioEngine | null): void;

// src/main/registry.ts (added)
export const getFluidEngineConfigDir = (): string;                          // %ProgramData%\FluidEQ\engine\config
export const isEngineInstalled = (engine: TAudioEngine): Promise<boolean>;  // 'apo' → isEqualizerAPOInstalled(); 'fluid' → fs.existsSync(%ProgramFiles%\FluidEQ Engine\FluidEQ-Engine.dll)
export const getConfigPath = (engine: TAudioEngine): Promise<string>;      // 'fluid' → getFluidEngineConfigDir() (mkdir -p; empty config.txt if absent); 'apo' → today's lookup; non-Windows demo dir unchanged
```

- [ ] **Step 1: Tests.** Store: missing file → `{ version: 1, engine: null }`; round-trip `'fluid'`; corrupt JSON → `null` without throwing. Config path: with `process.env.ProgramData` pointed at a temp dir, `getConfigPath('fluid')` creates `FluidEQ\engine\config\config.txt` and returns the dir; a second call leaves an existing `config.txt` untouched (mtime unchanged); `getConfigPath('fluid')` never calls `regedit` (mock `regedit` and assert `list` was not called).
- [ ] **Step 2: Run — fail. Step 3: Implement.** `checkConfigFile`/`updateConfig` in `flush.ts` already put `Include: fluideq.txt` into any `config.txt`, so the engine dir needs nothing more.
- [ ] **Step 4:** `pnpm test:unit`, `pnpm typecheck`. **Step 5: Commit** (`feat(engine): engine preference and an engine-aware config directory`).

---

### Task 8: Helper invocation, status and device probe

**Files:**

- Create: `src/main/engineSetup.ts`, `src/main/engineStatus.ts`
- Modify: `assets/windows-audio-devices.ps1` (`FluidEngineClsid` constant; `isFluidEngineAttached` on `Device`, true when composite list `{d04e05a6-…},15` or `,14` contains it; `null` on exception like the APO probe)
- Modify: `src/common/constants.ts` (`IAudioDevice.isFluidEngineAttached?: boolean | null`), `src/main/audioDevices.ts` (demo devices carry the flag)
- Test: `src/__tests__/unit_tests/main/engineSetup.test.ts`, `engineStatus.test.ts`

**Interfaces:**

```ts
// src/main/engineSetup.ts
export type TEngineSetupCommand = 'install' | 'uninstall' | 'attach' | 'detach' | 'restart-audio';
export interface IEngineSetupResult { ok: boolean; declined: boolean; error?: string; endpoints: IFluidEngineEndpoint[]; }
export const getEngineSetupPath = (): string;   // resources/native/FluidEQ-Engine-Setup.exe; dev: native/.build/bin
export const runEngineSetup = (command: TEngineSetupCommand, args: string[]): Promise<IEngineSetupResult>;  // execFile, never a shell
export const parseEngineSetupOutput = (stdout: string, exitCode: number | null): IEngineSetupResult;

// src/main/engineStatus.ts
export const isFluidEngineSupported = (release = os.release()): boolean;  // >= 10.0.17134
export const readFluidEngineStatus = (): Promise<IFluidEngineStatus>;    // helper `status`, unelevated; { installed: false, endpoints: [] } on any failure
export const readAudioEngineStatus = (userDataDir: string, engine: TAudioEngine | null): Promise<IAudioEngineStatus>;  // probes APO only when engine is 'apo' or null
```

- [ ] **Step 1: Tests.** `parseEngineSetupOutput`: ok / exit 2 → `declined` / exit 3 with garbage stdout → `ok: false` and `error` set. `isFluidEngineSupported('10.0.17134')` true, `'10.0.16299'` false, `'6.1.7601'` false. `readAudioEngineStatus(dir, 'fluid')` never calls `isEqualizerAPOInstalled` (mock and assert).
- [ ] **Step 2–4: fail, implement, pass + typecheck. Step 5: Commit** (`feat(engine): drive the setup helper and read engine status`).

---

### Task 9: Update path, neutralising the other engine, errors and IPC

**Files:**

- Modify: `src/common/errors.ts` (`ErrorCode.AUDIO_ENGINE_NOT_CHOSEN`, `ErrorCode.FLUID_ENGINE_NOT_INSTALLED`; both blocking; both in `errors`)
- Modify: `src/common/channels.ts` (`GET_AUDIO_ENGINE_STATUS`, `SET_AUDIO_ENGINE`, `INSTALL_FLUID_ENGINE`, `ATTACH_FLUID_ENGINE`, `DETACH_FLUID_ENGINE`, `SET_SYSTEM_DSP_CHAIN`)
- Create: `src/main/ipc/audioEngine.ts` (`registerAudioEngineIpc(deps)`), `src/main/engineNeutralise.ts`, `src/renderer/utils/audioEngineApi.ts`
- Modify: `src/main/main.ts` (session gains `audioEngine: TAudioEngine | null`; startup migration; `handleUpdateHelperCore` head; register the IPC module beside `registerProfilesIpc`), `src/main/bugReportFacts.ts` (`audioEngine`, `fluidEngineInstalled`)
- Test: `src/__tests__/unit_tests/main/audioEngineIpc.test.ts`, `src/__tests__/unit_tests/main/engineNeutralise.test.ts`

**Interfaces:**

```ts
// src/main/engineNeutralise.ts
/** Write the neutral root into `other`'s directory, only if `other` is installed. Called at switch time only. */
export const neutraliseEngine = (other: TAudioEngine, settings: IDeviceProfileSettings, presetDirForDevice: TPresetDirForDevice): Promise<'written' | 'not-installed'>;
```

**`handleUpdateHelperCore` head:**

```ts
const engine = session.audioEngine;
if (engine === null) {
  handleError(event, channel, ErrorCode.AUDIO_ENGINE_NOT_CHOSEN);
  return;
}
if (!(await isEngineInstalled(engine))) {
  handleError(
    event,
    channel,
    engine === 'fluid'
      ? ErrorCode.FLUID_ENGINE_NOT_INSTALLED
      : ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
  );
  return;
}
```

The tail keeps today's single `flushDeviceProfiles(...)` into `session.configPath`. **No write to the other engine here.** `startApoConfigWatcher()` and `checkConfigFile`/`updateConfig` run for both engines against `session.configPath` (the engine dir has a `config.txt` too).

**Switching (`SET_AUDIO_ENGINE(next)`):** `await neutraliseEngine(current)` → `saveAudioEnginePreference` → `session.audioEngine = next` → `session.configPath = ''` → `reflush()`. Order matters: the old engine goes idle before the new one is written, so no output is ever processed twice.

**Startup migration:** `const pref = loadAudioEnginePreference(userDataDir); session.audioEngine = pref.engine ?? (process.platform !== 'win32' || (await isEqualizerAPOInstalled()) ? 'apo' : null); if (pref.engine === null && session.audioEngine === 'apo') saveAudioEnginePreference(userDataDir, 'apo');`

**IPC deps** (injected): `{ userDataDir, getEngine, setEngine, getConfigPath, reflush, runEngineSetup, readAudioEngineStatus, neutraliseEngine, writeSystemDspChain }`. Install/attach/detach: run the helper; on `ok` → `reflush()`; reply `IEngineSetupResult`. `SET_SYSTEM_DSP_CHAIN(values: number[])`: refuse unless `isChainWirePayload(values)`; write `<configDir>\fluideq-dsp.txt` via `scheduleWrite` when the engine is `'fluid'`; no-op under `'apo'`.

- [ ] **Step 1: Tests.** IPC: `SET_AUDIO_ENGINE('fluid')` from `'apo'` calls `neutraliseEngine('apo')` before `reflush`; `SET_AUDIO_ENGINE('apo')` from `'fluid'` calls `neutraliseEngine('fluid')` before `reflush`; `INSTALL_FLUID_ENGINE` with `declined: true` does not reflush; `SET_SYSTEM_DSP_CHAIN` with a wrong-length array replies `false` and writes nothing; with a valid payload under `'fluid'` writes one line of space-separated numbers under a `#` header. Neutralise: `neutraliseEngine('apo')` with `isEqualizerAPOInstalled` mocked false returns `'not-installed'` and touches no file; mocked true writes a `fluideq.txt` with no `Device:` line into the APO dir.
- [ ] **Step 2–4: fail, implement, `pnpm test:unit` + `pnpm typecheck`.** Existing suites stay green: on non-Windows the migration yields `'apo'` and `getConfigPath('apo')` is the demo dir as before.
- [ ] **Step 5: Commit** (`feat(engine): one engine written at a time, the other neutralised on switch`).

---

### Task 10: System-wide DSP inside the DLL

**Files:**

- Create: `native/system-apo/src/dsp_chain.h`, `src/dsp_chain.cpp` (parse the line → `FeqChainSettings`, denoise forced off)
- Modify: `native/system-apo/include/fluideq_engine/config.h` (`Chain` gains `std::vector<double> dsp_values;`, filled from `fluideq-dsp.txt` when present), `src/config.cpp`, `src/graph.cpp` (owns a `FeqChain*` when `dsp_values` decode; `process` runs the chain first, then the EQ; `latency_frames` adds `feq_chain_latency_frames`), `src/apo.cpp` (`GetLatency`)
- Create: `native/system-apo/tests/dsp_chain_test.cpp`
- Modify: `src/renderer/dsp/store.ts` (every settings write also calls `setSystemDspChain(encodeChainSettings(settings, options))` through `audioEngineApi`), `src/renderer/dsp/DspPanel.tsx` (scope pill: `dsp.scope.system` / `dsp.scope.libraryOnly` + link; latency suffix when `eq.phase === 'linear'`), `src/renderer/dsp/DspDenoiseCard.tsx` (`dsp.denoise.libraryOnly` note under `'fluid'`), `src/common/i18n/*/dsp.ts` (ten locales)
- Test: `src/__tests__/unit_tests/dsp/systemDspChain.test.tsx` (a store write triggers the IPC with the encoded array; the pill reads the engine)

- [ ] **Step 1: Native test.** `dsp_chain_test.cpp`: a line produced by the TypeScript encoder for `DSP_DEFAULTS` with `exciter.enabled = 1` (paste the numbers from a one-off `ts-node` run and keep them in the test) decodes to `exciter.enabled == 1`; `denoise.enabled` is 0 even when the line says 1; a line with the wrong band count is refused and `Graph` runs EQ-only; through `Graph`, a 1 kHz sine with the maximizer at −20 dB ceiling comes out at −20 ± 0.5 dBFS peak.
- [ ] **Step 2: Run — fail. Step 3: Implement.** In `Graph`: `feq_chain_create(rate, channels, max_frames)`, `feq_chain_configure`; stereo only (`FEQ_CHAIN_CHANNELS == 2`; with more channels run the chain on the first two, pass the rest through, and say so in `warnings()`); never set the player-only stages. `process`: rack first, then convolution → graphic → filters → preamp.
- [ ] **Step 4:** ctest passes; `pnpm test:unit`, `pnpm typecheck`. **Step 5: Commit** (`feat(engine): run the DSP rack system-wide under FluidEQ Engine`).

---

### Task 11: The engine dialog, the menu, the notice, the pill

**Files:**

- Create: `src/renderer/components/AudioEngineDialog.tsx`, `src/renderer/styles/AudioEngineDialog.scss`
- Modify: `src/renderer/App.tsx` (menu: one item `app.menu.audioEngine`; the three APO items move into the dialog; blocking `AUDIO_ENGINE_NOT_CHOSEN` renders the dialog without Cancel; `FLUID_ENGINE_NOT_INSTALLED` renders `PrereqMissingModal` with the single button `prereq.install.fluid`)
- Modify: `src/renderer/PrereqMissingModal.tsx` (all copy through `t()`; engine-aware title and button; the APO credit line only under `'apo'`)
- Modify: `src/renderer/DeviceProfiles.tsx` (notice reads `isFluidEngineAttached` under `'fluid'`; button `output.enable` → `attachFluidEngine(guid)` then `healthCheck()`; under `'apo'` unchanged)
- Modify: `src/common/i18n/*/app.ts`, `eq.ts` (ten locales): `app.menu.audioEngine`, `engine.title`, `engine.now`, `engine.fluid.name`, `engine.fluid.l1..l3`, `engine.apo.name`, `engine.apo.l1..l3`, `engine.recommended`, `engine.apply`, `engine.cancel`, `engine.installing`, `engine.declined`, `engine.failed`, `engine.unsupported`, `engine.apo.reconfigure`, `engine.apo.settings`, `engine.apo.reinstall`, `prereq.title.fluid`, `prereq.install.fluid`, `prereq.retry`, `prereq.dismiss`, `output.off` (replaces `output.apoOff`), `output.engineMissingTitle`, `output.engineMissingBody`, `output.enable`
- Test: `src/__tests__/unit_tests/AudioEngineDialog.test.tsx`; extend `DeviceProfiles.test.tsx`

**Interfaces:**

```tsx
interface IAudioEngineDialogProps {
  status: IAudioEngineStatus;
  onApply: (engine: TAudioEngine) => Promise<void>;
  onCancel?: () => void; // absent = blocking first-run
  onApoAction?: (action: 'reconfigure' | 'settings' | 'reinstall') => void; // rendered only when status.engine === 'apo'
}
```

Layout: `role="dialog"`, portal, focus trap and Escape like `SquiglinkImportConfirm`; two radio rows (`role="radio"`, arrow keys), three lines each with check/dash glyphs; footer "Now: {engine}" · Cancel (`button small subtle`) · Apply (`button small`). Apply is disabled while the selection equals the current engine. `!status.fluidSupported` disables the FluidEQ row with `engine.unsupported`. While applying, both rows and both buttons disable and the footer shows `engine.installing`.

- [ ] **Step 1: Component test.** Two radios; Apply disabled when the selection is the current engine; selecting the other enables it; Apply calls `onApply('fluid')`; Escape calls `onCancel` when given, nothing when absent; `fluidSupported: false` disables the FluidEQ row; `status.engine === 'apo'` renders the three APO actions, `'fluid'` renders none.
- [ ] **Step 2–3: fail, implement** (styles from `Modal.scss` tokens, `$weight-*` only), wirings, ten locales.
- [ ] **Step 4:** `pnpm test:unit`, `pnpm typecheck`, `pnpm typecheck:styles`, `pnpm lint`.
- [ ] **Step 5: Visual check** in the running window: normal size, narrowest panel, fullscreen, German and Russian. No clipping, no horizontal scrollbar, loud/quiet emphasis right. Note what was looked at in the commit message.
- [ ] **Step 6: Commit** (`feat(engine): one dialog to switch engines; the EQ and DSP pages unchanged`).

---

### Task 12: Installer and uninstaller

**Files:**

- Modify: `assets/nsis/installer.nsh`
- Modify: `native/system-apo/setup/setup.rc` (`FileDescription` and `ProductName` = `FluidEQ Audio Processing Engine Setup`, so the UAC prompt names it)

**Page** (nsDialogs via `customPageAfterChangeDir`): title `$(EngineTitle)`, subtitle `$(EngineSubtitle)`, radio `$(EngineFluid)` (checked) + `$(EngineFluidHint)`, radio `$(EngineApo)` + `$(EngineApoHint)`, then `$(EngineWhy)`. `LangString` for each id in `${LANG_ENGLISH}` `${LANG_SIMPCHINESE}` `${LANG_HINDI}` `${LANG_SPANISH}` `${LANG_FRENCH}` `${LANG_PORTUGUESEBR}` `${LANG_RUSSIAN}` `${LANG_JAPANESE}` `${LANG_GERMAN}` `${LANG_ITALIAN}`. Skipped under `${Silent}`, `${isUpdated}`, and when `$APPDATA\FluidEQ\audio-engine.json` exists.

**`customInstall`:** `fluid` → `ExecShellWait "runas" "$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe" "install --attach-all --restart-audio"`; on `${Errors}` log + `$(EngineDeclined)` (the app's banner offers the button again); write `{"version":1,"engine":"fluid"}` to `$APPDATA\FluidEQ\audio-engine.json` either way. `apo` → today's APO flow, plus `"engine":"apo"`. Never both.

**`customUnInstall`** (real uninstall only, in this order):

1. If `$INSTDIR\resources\native\FluidEQ-Engine-Setup.exe` exists: `ExecShellWait "runas" … "uninstall"`, logged. **No question** — it is ours; every output's effect list goes back to its backup.
2. If Equalizer APO is installed (`ReadApoUninstallString`): today's "Also uninstall Equalizer APO?" question, default No, unchanged.

- [ ] **Step 1:** Implement page, strings, both macros, the version resource. **Step 2:** `pnpm package`; run the installer twice on this PC (one choice each, uninstall between); check `install.log` and the JSON; confirm the uninstaller removes the engine and asks about APO only when present. **Step 3: Commit** (`feat(installer): choose the engine at install; remove ours on uninstall, ask about APO`).

---

### Task 13: Documentation, changelog, CI

- Modify: `CHANGELOG.md`, `README.md` (engine section: what it is, where it installs, the unsigned-effect switch, how to remove it, DSP system-wide and its two limits), `CLAUDE.md` "Things that will bite you": (1) the DLL must live outside the user profile or `audiodg` cannot read it; (2) FxProperties changes need both audio services restarted, and the helper does it; (3) never write pids 5/6/7 — only composite lists; (4) `FindFirstChangeNotification` is how the DLL waits, not a poll; (5) the engine reads the APO layout, so a change to `deviceProfiles.ts` output is a change to what the DLL parses — extend `config_test.cpp` in the same commit; (6) `fluideq-dsp.txt` is the chain wire — bump `FEQ_CHAIN_PARAM_LEAD` and the DLL test together.
- `.github/workflows/test.yml` needs nothing. Note in the PR that the first weekly build is the proof `pnpm package` ships the two binaries.

- [ ] **Step 1:** Write. **Step 2:** `pnpm lint`, `pnpm typecheck`, `pnpm test`. **Step 3: Commit** (`docs(engine): document the FluidEQ Engine and its footguns`).

---

## Self-Review

**Spec coverage.** Own engine without touching vendor slots → Tasks 4–5. Same EQ page, same DSP page, no new pages/chips → Task 11 (only a menu item, a dialog, a pill variant). User picks at install → Task 12 page with two choices and the "why permission" line; the UAC prompt names the engine (version resource). APO optional and never required → Task 7 (`getConfigPath('fluid')` never probes the registry), Task 8 (`readAudioEngineStatus` skips APO under `'fluid'`), Task 9 (no APO error, no APO watcher, no APO write under `'fluid'`). Only one engine written / the other disabled → Task 9 `neutraliseEngine` at switch time only; the update path writes one directory. DSP system-wide under fluid, Library-only under APO → Task 10 and the pill. Uninstall removes ours and asks about APO → Task 12. Alienware legacy driver → Task 5 `legacy_only` + the gate. No timers → services notification, change notifications, atomic swap.

**Placeholders.** None: every task names its tests with the values asserted and the exact rules to implement.

**Type consistency.** `TAudioEngine`, `IFluidEngineEndpoint`, `IFluidEngineStatus`, `IAudioEngineStatus`, `IEngineSetupResult`, `IAudioEngineDialogProps` are defined once (Tasks 7/8/11) and used by those names everywhere. `Chain.dsp_values` (Task 10) is the only addition to Task 1's struct. `FxValues` indices match the rules, the `Slot` enum and the test names.
