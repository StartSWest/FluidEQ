# macOS Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run FluidEQ's in-app engine on macOS (Apple Silicon) — library, player, the six-layer rack, meters and spectrum — with no Equalizer APO, no Windows source edited, and the native suite green.

**Architecture:** Three new files under `platform/macos/` satisfy the three interfaces that already exist for this purpose: `audio_backend.h` (AUHAL), `process_stats.h` (mach) and `media_decoder.h` (ExtAudioFile). CMake gains an `elseif(APPLE)` branch; the `if(WIN32)` branch and the trailing `else()` stub are left exactly as they are. On the TypeScript side a capability descriptor in `src/common` replaces the renderer's assumption that APO exists.

**Tech Stack:** C++20, Apple Clang, CMake 3.21+, CoreAudio / AudioUnit / AudioToolbox frameworks, Electron, TypeScript, React, ts-node, jest.

## Global Constraints

- **Target: arm64 only.** `CMAKE_OSX_ARCHITECTURES` is `arm64`. No universal build.
- **No Windows source may be edited, and no existing Windows target may change.** `platform/windows/*` is untouched by every task in this plan. The `if(WIN32)` branch of `native/CMakeLists.txt` may gain the sources of the NEW test target in Task 4 and nothing else — no existing target's sources, flags or libraries change.
- **The existing non-Windows `else()` branch stays.** Linux and unknown platforms keep compiling against the stub.
- **`-Werror` is never relaxed**, for any platform or file. `dsp-host/src/decoders/vendor/vendor.cpp` keeps the single existing documented exemption and remains the only one.
- **Platform code lives under a `platform/` directory and nowhere else.** No `#ifdef _WIN32` / `__APPLE__` / `__linux__` and no platform header outside those directories.
- **No allocation, lock, logging or system call on the render callback.** The contract in `fluideq/dsp.h` and `audio_backend.h` applies in full.
- **Node floor is 22.** `packageManager` is `pnpm@11.7.0`, which imports `node:sqlite`.
- **Tests print what they measured.** There is no gtest in this tree: a test is a function that calls `feq_test::check(bool, const char*)`, and `main` returns `feq_test::finish()`.
- **Files are UTF-8, no BOM, never written back through a shell.** `pnpm typecheck:encoding` enforces this.
- **Scope excludes** system-wide capture, `.dmg`/signing/notarization, and Linux.

## File Structure

**Created:**

| Path                                                                   | Responsibility                                                                                                 |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `native/dsp-host/src/platform/macos/coreaudio_backend.cpp`             | `IAudioOutputBackend` over AUHAL: device selection, format negotiation, render callback, default-device change |
| `native/dsp-host/src/platform/macos/process_stats_macos.cpp`           | `feq_sample_process_stats` from `task_info` and `proc_pid_rusage`                                              |
| `native/dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp` | `feq_media_decoder_ops` over `ExtAudioFile` for m4a/AAC/ALAC                                                   |
| `native/dsp-host/tests/backend_test.cpp`                               | The `IAudioOutputBackend` contract, run on every platform                                                      |
| `.erb/scripts/check-platform-isolation.ts`                             | Fails the build when platform code escapes `platform/`                                                         |
| `src/common/platformCapabilities.ts`                                   | What a platform can do, and the resolver for a given `NodeJS.Platform`                                         |
| `src/main/audioDevicesMac.ts`                                          | CoreAudio output-device enumeration for macOS                                                                  |
| `src/__tests__/unit_tests/common/platformCapabilities.test.ts`         | Capability descriptor tests                                                                                    |

**Modified:**

| Path                                          | Change                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `native/CMakeLists.txt`                       | Add `elseif(APPLE)` branch between the Windows branch and the existing `else()` |
| `native/dsp-core/src/denoise_voice.cpp`       | Check three discarded `OrtStatus*`; delete dead `kVoiceRate`                    |
| `native/dsp-core/tests/chain_meters_test.cpp` | Delete dead `bin_for`                                                           |
| `package.json`                                | `engines.node`, `typecheck:platform` script, wire into `test`                   |
| `.github/workflows/test.yml`                  | Add a macOS job                                                                 |
| `src/main/api.ts`                             | Expose `capabilities` alongside `platform`                                      |
| `src/main/audioDevices.ts`                    | Delegate to the macOS implementation when on darwin                             |
| `src/renderer/utils/FluidEqContext.tsx`       | Provide capabilities to the tree                                                |

**Why `ExtAudioFile` and not AVFoundation:** the comment in `media_decoder.h` suggests AVFoundation, but that is an Objective-C API and would force this file to be `.mm`, adding a second language to a build that has none. `ExtAudioFile` is a C API in AudioToolbox, decodes the same MPEG-4 family through the same system codecs, and keeps the file a plain `.cpp`.

---

### Task 1: Unblock the macOS build

The five diagnostics that stop Apple Clang. Two of them are a real discarded error status, so this task improves Windows as well.

**Files:**

- Modify: `native/dsp-core/src/denoise_voice.cpp:69`, `:224`, `:513-514`
- Modify: `native/dsp-core/tests/chain_meters_test.cpp:125-128`

**Interfaces:**

- Consumes: nothing.
- Produces: a native tree that configures, compiles and passes `ctest` on macOS. Every later native task depends on this.

- [ ] **Step 1: Reproduce the failure**

Run:

```bash
cd native && cmake -S . -B .verify -DCMAKE_BUILD_TYPE=Release && cmake --build .verify -j8
```

Expected: FAIL. `denoise_voice.cpp:224`, `:513`, `:514` report `-Werror,-Wunused-result`; `:69` reports `-Werror,-Wunused-const-variable`.

- [ ] **Step 2: Check the discarded status on the two thread-count calls**

In `denoise_voice.cpp`, replace lines 513-514 inside the `if (ok)` block:

```cpp
  if (ok) {
    // One thread each. The worker is already off the audio thread and ORT
    // spawning its own pool would put unpredictable scheduling next to a
    // real-time callback for no throughput this needs.
    //
    // The status was discarded here until Clang refused to compile it. MSVC
    // does not diagnose a dropped `warn_unused_result`, so on Windows a
    // session that silently kept ORT's default pool looked identical to one
    // that had been pinned to a single thread.
    ok = api->SetIntraOpNumThreads(runtime->options, 1) == nullptr;
    ok = ok && api->SetInterOpNumThreads(runtime->options, 1) == nullptr;
  }
```

- [ ] **Step 3: Check the discarded status on the allocator free**

In `denoise_voice.cpp`, replace line 224:

```cpp
    out.assign(value);
    // Freeing cannot fail in a way this lambda can act on — the string is
    // already copied out — but the status is inspected rather than dropped so
    // that the compiler's rule holds everywhere and this file needs no
    // exemption.
    const bool freed = api->AllocatorFree(allocator, value) == nullptr;
    return freed;
  };
```

- [ ] **Step 4: Delete the dead constant**

In `denoise_voice.cpp`, delete lines 68-69 entirely:

```cpp
/** The rate the 48 kHz model was trained at; anything else must resample. */
constexpr double kVoiceRate = 48000.0;
```

It has no reader anywhere in the file. The resampling it documents is driven by the model's own metadata; the constant was left behind when that changed.

- [ ] **Step 5: Delete the dead test helper**

In `chain_meters_test.cpp`, delete lines 125-128 entirely:

```cpp
/** The bin a frequency lands in for this transform size and rate. */
uint32_t bin_for(double hz) {
  return static_cast<uint32_t>((hz / kRate) * FEQ_METER_WINDOW + 0.5);
}
```

No test in the file calls it. The spectrum checks compare whole runs against each other rather than reading named bins.

- [ ] **Step 6: Verify the build now completes**

Run:

```bash
cd native && cmake --build .verify -j8
```

Expected: PASS. `libfluideq-dsp-core.a`, all thirteen test binaries and `bin/FluidEQ-DSP` build with no warnings.

- [ ] **Step 7: Verify the suite passes, parity included**

Run:

```bash
pnpm build:native-dsp --test
```

Expected: the parity corpus is expanded to 2085 fixtures and all thirteen ctest cases pass, `dsp-parity` among them.

If `dsp-parity` fails on arm64, do NOT widen a tolerance. Record the failing case and its magnitude and stop — the spec calls for that to be examined per-test, and a global loosening would hide the one thing this corpus exists to detect.

- [ ] **Step 8: Confirm Windows is unaffected**

Run:

```bash
git diff --stat
```

Expected: exactly two files changed, neither under `platform/`.

- [ ] **Step 9: Commit**

```bash
git add native/dsp-core/src/denoise_voice.cpp native/dsp-core/tests/chain_meters_test.cpp
git commit -m "Check the ORT statuses Clang would not let us drop

Two of these set the thread pool and returned a status the code discarded,
so a session that silently kept ORT's default pool was indistinguishable
from one pinned to a single thread. MSVC does not diagnose a dropped
warn_unused_result, which is why this survived on Windows.

The other two removals are dead: a constexpr with no reader and a test
helper no test calls."
```

---

### Task 2: The platform-isolation guardrail

Written before any macOS source exists, so the new files are held to the rule from their first line.

**Files:**

- Create: `.erb/scripts/check-platform-isolation.ts`
- Modify: `package.json` (scripts)

**Interfaces:**

- Consumes: nothing.
- Produces: `pnpm typecheck:platform`, exiting non-zero on a violation. Task 10 adds it to CI.

- [ ] **Step 1: Write the check**

Create `.erb/scripts/check-platform-isolation.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.

Keeps the layering that makes a third platform cheap.

Ninety-six per cent of the native tree is written once and compiled
everywhere. That is not an accident of the code — it is a rule, and until
this script the rule lived in a comment at the top of `audio_backend.h`.
Comments do not fail builds.

The failure this exists to prevent is not a bad decision. It is somebody
adding one `#ifdef __APPLE__` inside `chain.cpp` to fix one thing on one
platform, and the ninety-six per cent beginning to slide — after which a
filter fix is three edits and a preset fix is three edits, and the reason
FluidEQ could afford macOS at all is gone.

The rule: platform code lives under a `platform/` directory. Everything
above that line compiles identically on every platform FluidEQ ships on.
*/

import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';

const REPO_ROOT = path.join(__dirname, '..', '..');

/** Our own C++ . Vendored trees are somebody else's rules. */
const SOURCE_EXTENSIONS = new Set(['.cpp', '.h', '.hpp']);

const isVendored = (name: string) => name.includes('/vendor/');

/** A file that is allowed to know which OS it is on. */
const isPlatformScoped = (name: string) =>
  name.includes('/platform/') || name.endsWith('.rc');

/**
 * Branching on the platform, which above the seam means two behaviours in
 * one file rather than one behaviour behind an interface.
 */
const PLATFORM_MACRO =
  /^\s*#\s*(if|ifdef|ifndef|elif).*\b(_WIN32|_WIN64|__APPLE__|__linux__|__MACH__|TARGET_OS_)/;

/**
 * A system header, which is the other half of the same mistake: a file that
 * includes one has already decided which OS it is for.
 */
const PLATFORM_INCLUDE =
  /^\s*#\s*include\s*[<"](windows\.h|AudioToolbox\/|AudioUnit\/|AVFoundation\/|Accelerate\/|CoreAudio\/|CoreFoundation\/|CoreMIDI\/|IOKit\/|TargetConditionals\.h|mach\/|alsa\/|pulse\/|pipewire\/|sys\/sysctl\.h|sys\/prctl\.h|libproc\.h)/i;

/**
 * The files that may know which OS they are on without living under
 * `platform/`, each with the reason it is not a seam.
 *
 * There are two kinds of platform code and this check exists to separate
 * them. A device backend is genuinely different BEHAVIOUR per OS, it has an
 * interface to hide behind, and it belongs under `platform/`. A two-way
 * Win/POSIX shim for `dlopen` or `fopen` is portability plumbing: six lines
 * with no decision in them, and splitting it across three files to satisfy a
 * rule would make it harder to read, not easier.
 *
 * These four are the second kind. They are listed rather than pattern-matched
 * so that the debt is visible and finite — the check's real job is to stop
 * the NEXT one appearing unnoticed, not to relitigate these.
 *
 * Which is why each carries a COUNT rather than a bare exemption. Skipping
 * the file outright would have made these four the only places a new
 * `#ifdef __APPLE__` could be added unnoticed — and `denoise_voice.cpp` is
 * in shared dsp-core, so that is not a hypothetical. The count is a ratchet:
 * the file is allowed exactly the lines it trips today and fails the moment
 * it trips one more. Lowering it when a shim goes away is free; raising it
 * needs the argument a new entry needs.
 *
 * A reason is required rather than a bare path, so anything added here has to
 * say what it is for.
 */
interface IAllowance {
  reason: string;
  /** Lines in this file that trip the patterns above, as of today. */
  expected: number;
}

const ALLOWED = new Map<string, IAllowance>([
  [
    'native/dsp-host/src/main.cpp',
    {
      reason: 'stdio binary mode is a CRT property with no seam to sit behind',
      expected: 3,
    },
  ],
  [
    'native/dsp-core/src/denoise_voice.cpp',
    {
      reason:
        'LoadLibrary/dlopen shim: the ONNX Runtime is loaded by path at runtime, and the POSIX half is what macOS and Linux both take',
      expected: 7,
    },
  ],
  [
    'native/dsp-host/src/parent_watch.cpp',
    {
      reason:
        'Win32 process wait vs POSIX poll, with a Linux prctl fast path; there is no portable way to block on a process that is not our child',
      expected: 6,
    },
  ],
  [
    'native/dsp-host/src/decoders/compressed_decoder.cpp',
    {
      reason:
        'fopen_s vs fopen, which is a C runtime difference rather than a platform capability',
      expected: 1,
    },
  ],
]);

const tracked = execFileSync('git', ['ls-files', '-z', 'native'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
})
  .split('\0')
  .filter(
    (name) =>
      name !== '' &&
      SOURCE_EXTENSIONS.has(path.extname(name)) &&
      !isVendored(name) &&
      !isPlatformScoped(name),
  );

const offences: string[] = [];

tracked.forEach((name) => {
  const text = readFileSync(path.join(REPO_ROOT, name), 'utf8');
  const hits: string[] = [];
  text.split('\n').forEach((line, index) => {
    if (PLATFORM_MACRO.test(line)) {
      hits.push(
        `${name}:${index + 1}  platform macro above the seam: ${line.trim().slice(0, 72)}`,
      );
    }
    if (PLATFORM_INCLUDE.test(line)) {
      hits.push(
        `${name}:${index + 1}  system header above the seam: ${line.trim().slice(0, 72)}`,
      );
    }
  });

  const allowance = ALLOWED.get(name);
  if (allowance === undefined) {
    offences.push(...hits);
    return;
  }
  // Allowed at today's count and no further. The lines are still printed,
  // because "this file grew by one" is not actionable without saying which.
  if (hits.length > allowance.expected) {
    offences.push(
      `${name}  platform code grew from ${allowance.expected} to ${hits.length} lines. This file is allowed its existing shim (${allowance.reason}) and nothing more:\n${hits
        .map((hit) => `    ${hit}`)
        .join('\n')}`,
    );
  }
});

if (offences.length > 0) {
  console.error(
    `\n${offences.length} platform-isolation violation(s) — this code belongs under a platform/ directory behind one of the interfaces in dsp-host/src; see the header of this script:\n\n${offences.join('\n')}\n`,
  );
  process.exit(1);
}

console.log(
  `${tracked.length} shared native sources are platform-free (${ALLOWED.size} allowed by name).`,
);
```

- [ ] **Step 2: Register the script**

In `package.json`, add after the `typecheck:encoding` line:

```json
    "typecheck:platform": "ts-node ./.erb/scripts/check-platform-isolation.ts",
```

- [ ] **Step 3: Run it against the tree as it stands**

Run:

```bash
pnpm typecheck:platform
```

Expected: PASS, reporting the count of shared sources and 4 allowed by name.

The four `expected` counts are a recording of today's tree, not a target. If the run says a file "grew from N to M", the count in the map is wrong rather than the file — set it to the M the check reports and say so in your report.

If it reports a violation in a file NOT in the `ALLOWED` map, that file is a genuine pre-existing leak — report it rather than adding it to `ALLOWED` yourself.

- [ ] **Step 4: Prove the check can fail, on BOTH paths (positive controls)**

A check nobody has watched fail is a check nobody knows works. There are two ways this one must fail and they are separate code paths — an earlier version of this script passed its own run while the ratchet path did nothing at all.

**Control A — an unlisted file.** Temporarily add to `native/dsp-core/src/eq.cpp`, after the includes:

```cpp
#ifdef __APPLE__
#endif
```

Run:

```bash
pnpm typecheck:platform
```

Expected: FAIL, naming `native/dsp-core/src/eq.cpp` and the line number. Then revert it:

```bash
git checkout native/dsp-core/src/eq.cpp
```

**Control B — an allowed file that grew.** Temporarily add the same two lines to `native/dsp-core/src/denoise_voice.cpp`, which IS in the `ALLOWED` map:

```cpp
#ifdef __APPLE__
#endif
```

Run:

```bash
pnpm typecheck:platform
```

Expected: FAIL, reporting that `denoise_voice.cpp` grew from 7 to 8 lines and printing all eight. This is the finding that made the ratchet necessary: with a whole-file exemption this run PASSES, and a new platform branch in shared dsp-core code goes unnoticed forever. Then revert it:

```bash
git checkout native/dsp-core/src/denoise_voice.cpp
```

- [ ] **Step 5: Confirm both controls are reverted**

Run:

```bash
git status --short && pnpm typecheck:platform
```

Expected: no modified C++ files listed, and the check PASSES. A positive control left in the tree is a failing build for everybody else.

- [ ] **Step 6: Commit**

```bash
git add .erb/scripts/check-platform-isolation.ts package.json
git commit -m "Make the platform-isolation rule a check rather than a comment

The layering that lets a preset or a filter be one edit for every platform
was enforced by a sentence at the top of audio_backend.h. This fails the
build instead, so the first #ifdef above the seam is caught rather than
noticed a year later."
```

---

### Task 3: The CoreAudio output backend

The one substantial piece of new code. Written as a single task because a backend that opens a device but cannot render has no deliverable a reviewer could accept or reject.

**Files:**

- Create: `native/dsp-host/src/platform/macos/coreaudio_backend.cpp`
- Modify: `native/CMakeLists.txt` (add `elseif(APPLE)` between the Windows branch and the existing `else()`)

**Interfaces:**

- Consumes: `IAudioOutputBackend`, `FeqBackendFormat`, `FeqBackendStats`, `FeqRenderFn` from `native/dsp-host/src/audio_backend.h`; Task 1's buildable tree.
- Produces: `create_audio_backend(FeqRenderFn, void*)` returning a working backend on macOS, whose `name()` is `"coreaudio"`. Nothing else consumes this directly — `main.cpp` already calls it.

- [ ] **Step 1: Add the CMake branch**

In `native/CMakeLists.txt`, insert immediately before the existing `else()` that adds the unsupported sources:

```cmake
elseif(APPLE)
  # Apple Silicon only. Universal is a flag rather than a port, but a second
  # architecture doubles what the frozen parity corpus has to be checked
  # against, and that is a cost to pay when somebody needs it.
  set(CMAKE_OSX_ARCHITECTURES "arm64" CACHE STRING "" FORCE)
  target_sources(fluideq-dsp-host PRIVATE
    dsp-host/src/platform/macos/coreaudio_backend.cpp
    dsp-host/src/platform/macos/process_stats_macos.cpp
    dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp)
  # All three ship with macOS. AUHAL is a user-mode audio unit: no driver, no
  # kernel extension, nothing to install and nothing to sign — the same
  # property that made WASAPI the right answer on Windows.
  target_link_libraries(fluideq-dsp-host PRIVATE
    "-framework CoreAudio"
    "-framework AudioToolbox"
    "-framework AudioUnit"
    "-framework CoreFoundation")
  find_package(Threads REQUIRED)
  target_link_libraries(fluideq-dsp-host PRIVATE Threads::Threads)
```

Do not touch the `if(WIN32)` branch above it or the `else()` below it.

- [ ] **Step 2: Create the backend with a failing build**

Create `native/dsp-host/src/platform/macos/coreaudio_backend.cpp` containing only the licence header and the includes below, then run Step 3 to confirm the build reaches this file before writing the rest.

```cpp
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../../audio_backend.h"

#include <AudioUnit/AudioUnit.h>
#include <CoreAudio/CoreAudio.h>

#include <atomic>
#include <cstring>
#include <string>
#include <vector>
```

- [ ] **Step 3: Run the build to verify it fails for the right reason**

Run:

```bash
pnpm build:native-dsp
```

Expected: FAIL at link with an undefined `create_audio_backend`. That failure proves the CMake branch is selected and this file is compiled; a failure naming a missing framework or header instead means Step 1 is wrong.

- [ ] **Step 4: Write the device queries**

Append to `coreaudio_backend.cpp`:

```cpp
namespace {

/** The engine is stereo; a wider device is fed its first two channels. */
constexpr uint32_t kEngineChannels = 2;

AudioObjectPropertyAddress global_address(AudioObjectPropertySelector what) {
  AudioObjectPropertyAddress address{};
  address.mSelector = what;
  address.mScope = kAudioObjectPropertyScopeGlobal;
  address.mElement = kAudioObjectPropertyElementMain;
  return address;
}

/** The system's current default output, or `kAudioObjectUnknown`. */
AudioDeviceID default_output_device() {
  AudioObjectPropertyAddress address =
      global_address(kAudioHardwarePropertyDefaultOutputDevice);
  AudioDeviceID device = kAudioObjectUnknown;
  UInt32 size = sizeof(device);
  const OSStatus status = AudioObjectGetPropertyData(
      kAudioObjectSystemObject, &address, 0, nullptr, &size, &device);
  return status == noErr ? device : kAudioObjectUnknown;
}

/**
 * What the device is actually clocked at.
 *
 * Asked rather than assumed for the same reason the Windows backend asks: a
 * machine set to 44.1 will not open at 48 because the engine would prefer it,
 * and the engine is rebuilt around the answer.
 */
double device_sample_rate(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyNominalSampleRate);
  Float64 rate = 0.0;
  UInt32 size = sizeof(rate);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size, &rate) !=
      noErr) {
    return 0.0;
  }
  return static_cast<double>(rate);
}

/**
 * The device period, in frames, which is how long a callback has to return.
 *
 * This is the denominator `FeqBackendStats::buffer_frames` exists to carry: a
 * figure in microseconds says nothing about whether the work fit.
 */
uint32_t device_buffer_frames(AudioDeviceID device) {
  AudioObjectPropertyAddress address =
      global_address(kAudioDevicePropertyBufferFrameSize);
  UInt32 frames = 0;
  UInt32 size = sizeof(frames);
  if (AudioObjectGetPropertyData(device, &address, 0, nullptr, &size,
                                 &frames) != noErr) {
    return 0;
  }
  return static_cast<uint32_t>(frames);
}

}  // namespace
```

- [ ] **Step 5: Write the backend class**

Append to `coreaudio_backend.cpp`, inside the same anonymous namespace (move the closing `}  // namespace` to after this class):

```cpp
/**
 * AUHAL, which is a pull model with a render callback — the shape
 * `FeqRenderFn` already has.
 *
 * `kAudioFormatFlagIsNonInterleaved` is the reason this file is shorter than
 * its Windows counterpart. CoreAudio then hands the callback an
 * `AudioBufferList` holding one buffer per channel, which IS `float* const*
 * planar`: no scratch buffer, and no per-frame interleave loop.
 */
class CoreAudioBackend final : public IAudioOutputBackend {
 public:
  CoreAudioBackend(FeqRenderFn render, void* context)
      : render_(render), context_(context) {}

  ~CoreAudioBackend() override { close(); }

  bool open(FeqBackendFormat& negotiated, std::string& error) override {
    close();
    const AudioDeviceID device = default_output_device();
    if (device == kAudioObjectUnknown) {
      // A fact about the machine, not a defect. A build agent with no output
      // fails here forever and correctly, and reporting that as a refused
      // format would make a green tree indistinguishable from a broken one.
      endpoint_absent_ = true;
      error = "this machine has no default audio output device";
      return false;
    }
    endpoint_absent_ = false;

    const double rate = device_sample_rate(device);
    if (rate <= 0.0) {
      error = "the default output device did not report a sample rate";
      return false;
    }

    AudioComponentDescription wanted{};
    wanted.componentType = kAudioUnitType_Output;
    wanted.componentSubType = kAudioUnitSubType_HALOutput;
    wanted.componentManufacturer = kAudioUnitManufacturer_Apple;
    AudioComponent component = AudioComponentFindNext(nullptr, &wanted);
    if (component == nullptr) {
      error = "the HAL output audio unit is not available";
      return false;
    }
    if (AudioComponentInstanceNew(component, &unit_) != noErr ||
        unit_ == nullptr) {
      error = "the HAL output audio unit could not be created";
      return false;
    }

    if (AudioUnitSetProperty(unit_, kAudioOutputUnitProperty_CurrentDevice,
                             kAudioUnitScope_Global, 0, &device,
                             sizeof(device)) != noErr) {
      error = "the audio unit refused the default output device";
      close();
      return false;
    }

    const uint32_t period = device_buffer_frames(device);
    UInt32 slice = period > 0 ? period : 512;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_MaximumFramesPerSlice,
                             kAudioUnitScope_Global, 0, &slice,
                             sizeof(slice)) != noErr) {
      error = "the audio unit refused the maximum block size";
      close();
      return false;
    }

    // Non-interleaved float32: one buffer per channel, which is the planar
    // contract exactly. `mBytesPerFrame` and `mBytesPerPacket` are ONE
    // sample's width in this layout, not the frame's — an interleaved-shaped
    // value here is accepted and then renders one channel of noise.
    AudioStreamBasicDescription format{};
    format.mSampleRate = rate;
    format.mFormatID = kAudioFormatLinearPCM;
    format.mFormatFlags =
        kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked |
        kAudioFormatFlagIsNonInterleaved;
    format.mFramesPerPacket = 1;
    format.mChannelsPerFrame = kEngineChannels;
    format.mBitsPerChannel = 32;
    format.mBytesPerFrame = sizeof(float);
    format.mBytesPerPacket = sizeof(float);
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_StreamFormat,
                             kAudioUnitScope_Input, 0, &format,
                             sizeof(format)) != noErr) {
      error = "the device refused non-interleaved 32-bit float stereo";
      close();
      return false;
    }

    AURenderCallbackStruct callback{};
    callback.inputProc = &CoreAudioBackend::render_trampoline;
    callback.inputProcRefCon = this;
    if (AudioUnitSetProperty(unit_, kAudioUnitProperty_SetRenderCallback,
                             kAudioUnitScope_Input, 0, &callback,
                             sizeof(callback)) != noErr) {
      error = "the audio unit refused the render callback";
      close();
      return false;
    }

    if (AudioUnitInitialize(unit_) != noErr) {
      error = "the audio unit failed to initialise";
      close();
      return false;
    }

    // Everything the callback touches is sized here, because it may not
    // allocate. `silence_` backs any channel the device does not give us.
    planar_pointers_.assign(kEngineChannels, nullptr);
    silence_.assign(slice, 0.0f);

    device_ = device;
    buffer_frames_ = slice;
    underruns_.store(0, std::memory_order_relaxed);
    periods_.store(0, std::memory_order_relaxed);
    add_listeners();

    negotiated.sample_rate = static_cast<uint32_t>(rate);
    negotiated.channels = kEngineChannels;
    negotiated.max_block_frames = slice;
    open_ = true;
    return true;
  }

  bool endpoint_absent() const override { return endpoint_absent_; }

  bool start(std::string& error) override {
    if (!open_) {
      error = "the device is not open";
      return false;
    }
    if (AudioOutputUnitStart(unit_) != noErr) {
      error = "the audio unit would not start";
      return false;
    }
    running_ = true;
    return true;
  }

  void close() override {
    remove_listeners();
    if (unit_ != nullptr) {
      if (running_) {
        AudioOutputUnitStop(unit_);
      }
      AudioUnitUninitialize(unit_);
      AudioComponentInstanceDispose(unit_);
      unit_ = nullptr;
    }
    running_ = false;
    open_ = false;
    device_ = kAudioObjectUnknown;
    buffer_frames_ = 0;
  }

  bool is_open() const override { return open_; }

  bool is_running() const override { return running_; }

  FeqBackendStats stats() const override {
    FeqBackendStats out{};
    out.underruns = underruns_.load(std::memory_order_relaxed);
    out.periods = periods_.load(std::memory_order_relaxed);
    out.buffer_frames = buffer_frames_;
    return out;
  }

  bool needs_reopen() const override {
    return reopen_.load(std::memory_order_relaxed);
  }

  void clear_reopen() override {
    reopen_.store(false, std::memory_order_relaxed);
  }

  void request_reopen() override {
    reopen_.store(true, std::memory_order_relaxed);
  }

  const char* name() const override { return "coreaudio"; }

 private:
  static OSStatus render_trampoline(void* refcon,
                                    AudioUnitRenderActionFlags* flags,
                                    const AudioTimeStamp* timestamp,
                                    UInt32 bus, UInt32 frames,
                                    AudioBufferList* data) {
    (void)flags;
    (void)timestamp;
    (void)bus;
    return static_cast<CoreAudioBackend*>(refcon)->render_period(frames, data);
  }

  /** The real-time thread. No allocation, no lock, no logging, no syscall. */
  OSStatus render_period(UInt32 frames, AudioBufferList* data) {
    const uint32_t supplied = data->mNumberBuffers;
    for (uint32_t buffer = 0; buffer < supplied; buffer += 1) {
      std::memset(data->mBuffers[buffer].mData, 0,
                  data->mBuffers[buffer].mDataByteSize);
    }
    const uint32_t channels = static_cast<uint32_t>(planar_pointers_.size());
    for (uint32_t channel = 0; channel < channels; channel += 1) {
      planar_pointers_[channel] =
          channel < supplied
              ? static_cast<float*>(data->mBuffers[channel].mData)
              : silence_.data();
    }
    render_(context_, planar_pointers_.data(), frames);
    periods_.fetch_add(1, std::memory_order_relaxed);
    return noErr;
  }

  /**
   * The default output changed, or this device overloaded.
   *
   * Both are answered rather than defaulted, because macOS has the
   * notification `audio_backend.h` says a platform should not pretend to
   * lack: a stream whose device is no longer the default stays technically
   * healthy and completely inaudible.
   */
  static OSStatus property_changed(AudioObjectID object, UInt32 count,
                                   const AudioObjectPropertyAddress* addresses,
                                   void* context) {
    (void)object;
    auto* self = static_cast<CoreAudioBackend*>(context);
    for (UInt32 index = 0; index < count; index += 1) {
      if (addresses[index].mSelector ==
          kAudioHardwarePropertyDefaultOutputDevice) {
        self->reopen_.store(true, std::memory_order_relaxed);
      }
      if (addresses[index].mSelector == kAudioDeviceProcessorOverload) {
        self->underruns_.fetch_add(1, std::memory_order_relaxed);
      }
    }
    return noErr;
  }

  void add_listeners() {
    AudioObjectPropertyAddress def =
        global_address(kAudioHardwarePropertyDefaultOutputDevice);
    AudioObjectAddPropertyListener(kAudioObjectSystemObject, &def,
                                   &CoreAudioBackend::property_changed, this);
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectAddPropertyListener(device_, &overload,
                                   &CoreAudioBackend::property_changed, this);
    listening_ = true;
  }

  void remove_listeners() {
    if (!listening_) {
      return;
    }
    AudioObjectPropertyAddress def =
        global_address(kAudioHardwarePropertyDefaultOutputDevice);
    AudioObjectRemovePropertyListener(kAudioObjectSystemObject, &def,
                                      &CoreAudioBackend::property_changed,
                                      this);
    AudioObjectPropertyAddress overload =
        global_address(kAudioDeviceProcessorOverload);
    AudioObjectRemovePropertyListener(device_, &overload,
                                      &CoreAudioBackend::property_changed,
                                      this);
    listening_ = false;
  }

  FeqRenderFn render_ = nullptr;
  void* context_ = nullptr;
  AudioUnit unit_ = nullptr;
  AudioDeviceID device_ = kAudioObjectUnknown;
  bool open_ = false;
  bool running_ = false;
  bool listening_ = false;
  bool endpoint_absent_ = false;
  uint32_t buffer_frames_ = 0;
  std::atomic<uint64_t> underruns_{0};
  std::atomic<uint64_t> periods_{0};
  std::atomic<bool> reopen_{false};
  std::vector<float*> planar_pointers_;
  std::vector<float> silence_;
};
```

- [ ] **Step 6: Write the factory**

Append, after the closing `}  // namespace`:

```cpp
std::unique_ptr<IAudioOutputBackend> create_audio_backend(FeqRenderFn render,
                                                          void* context) {
  return std::make_unique<CoreAudioBackend>(render, context);
}
```

- [ ] **Step 7: Build**

Run:

```bash
pnpm build:native-dsp
```

Expected: PASS, with no warnings. `-Wall -Wextra -Wpedantic -Werror` is in force; an unused parameter or a narrowing conversion fails here.

- [ ] **Step 8: Verify the isolation rule still holds**

Run:

```bash
pnpm typecheck:platform
```

Expected: PASS. The new file is under `platform/`, so the framework headers it includes are allowed; if this fails, the file is in the wrong directory.

- [ ] **Step 9: Hold a real device open and count dropouts**

Run:

```bash
pnpm test:native-dsp
```

Expected: PASS. `smoke-device.ts` opens the actual endpoint, holds it for six seconds under a deliberately expensive rack and reports underruns and worst-case callback time. It runs silent by design — no deck is loaded — so nothing audible comes out.

A non-zero underrun count here is the real-time thread priority risk named in the spec. If it appears, record the count and the worst callback time before changing anything: the fix is a time-constraint policy via `thread_policy_set`, not a larger buffer.

- [ ] **Step 10: Verify the handshake names the backend**

Run:

```bash
pnpm test:native-dsp 2>&1 | grep -i coreaudio
```

Expected: the handshake reports `coreaudio` as the backend name. This is what a support report will carry, and it is the one line that distinguishes a macOS host from a Windows one.

- [ ] **Step 11: Commit**

```bash
git add native/dsp-host/src/platform/macos/coreaudio_backend.cpp native/CMakeLists.txt
git commit -m "Open the Mac's output device through AUHAL

Non-interleaved float is the whole reason this is shorter than the WASAPI
backend beside it: CoreAudio hands the callback one buffer per channel,
which is the planar contract already, so there is no scratch and no
per-frame interleave.

needs_reopen is answered rather than defaulted, because macOS has the
notification audio_backend.h says a platform should not pretend to lack.
A device that stops being the default leaves a stream that is healthy and
inaudible, and that is the case the mechanism exists for.

The Windows branch of CMakeLists is untouched and the unsupported else()
stays, so Linux keeps building green."
```

---

### Task 4: The backend's contract

The spec asks for two things no other task checks: that a machine with no output is reported as a fact rather than a defect, and that a reopen request survives a failed attempt. Both are properties of `audio_backend.h` rather than of macOS, so the test is shared and every platform runs it — including the stub, which must refuse in exactly the documented way.

**Files:**

- Create: `native/dsp-host/tests/backend_test.cpp`
- Modify: `native/CMakeLists.txt` (add a test target beside the existing ones, outside the platform branches)

**Interfaces:**

- Consumes: `create_audio_backend`, `IAudioOutputBackend`, `FeqBackendFormat`, `FeqBackendStats` from `native/dsp-host/src/audio_backend.h`; Task 3's macOS backend.
- Produces: a `backend` ctest case. Nothing consumes it.

- [ ] **Step 1: Write the failing test**

Create `native/dsp-host/tests/backend_test.cpp`:

```cpp
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The contract in `audio_backend.h`, held to on whichever platform is running.
 *
 * Deliberately not a macOS test. The interface makes promises that are the
 * same everywhere — closed until opened, a reopen request that survives a
 * failed attempt, and a refusal that says whether the machine is silent or
 * the device said no — and a test that only ran where a backend was newest
 * would let the older ones drift out from under it.
 *
 * It passes on a machine with no sound card, which is the point: a build
 * agent must be able to run this and go green, because `endpoint_absent` is
 * the difference between a fact about the hardware and a defect.
 */

#include "../src/audio_backend.h"

#include <cstdio>
#include <cstring>
#include <string>

namespace {

int g_failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::printf("  FAIL %s\n", what);
    g_failures += 1;
  } else {
    std::printf("  ok   %s\n", what);
  }
}

/** A render callback that must never be reached by this test. */
void never_called(void* context, float* const* planar, uint32_t frames) {
  (void)context;
  (void)planar;
  (void)frames;
}

}  // namespace

int main() {
  std::printf("\nbackend: the contract every platform's device must keep\n");

  auto backend = create_audio_backend(&never_called, nullptr);
  check(backend != nullptr, "a backend is always supplied, never a null");
  if (backend == nullptr) {
    return 1;
  }

  check(backend->name() != nullptr && std::strlen(backend->name()) > 0,
        "it names itself for the handshake and for support reports");
  std::printf("       backend is \"%s\"\n", backend->name());

  check(!backend->is_open(), "it starts closed");
  check(!backend->is_running(), "and not running");

  // Idle means closed, not paused: opening is what wakes the DAC, so a
  // backend that reported itself open before anything asked to be heard
  // would be holding the hardware awake for nothing.
  FeqBackendStats idle = backend->stats();
  check(idle.buffer_frames == 0,
        "and reports no buffer, because no device is open");

  // The request has to outlive a failed attempt. A reopen is acknowledged
  // BEFORE it is tried, so nothing else holds the request when the attempt
  // fails — and a device that has just gone away is exactly when opening
  // fails, which is the one case the whole mechanism exists for.
  backend->clear_reopen();
  check(!backend->needs_reopen(), "a cleared reopen request stays cleared");
  backend->request_reopen();
  check(backend->needs_reopen(),
        "and a re-requested one stands, so a failed attempt is retried");
  backend->clear_reopen();

  FeqBackendFormat negotiated{};
  std::string error;
  const bool opened = backend->open(negotiated, error);

  if (opened) {
    check(!backend->endpoint_absent(),
          "a backend that opened did not find the machine silent");
    check(negotiated.sample_rate > 0,
          "an open device reports the rate it agreed to");
    check(negotiated.channels > 0, "and how many channels it took");
    check(negotiated.max_block_frames > 0,
          "and the largest block it will ask for");
    check(backend->is_open(), "and says it is open");
    std::printf("       negotiated %u Hz, %u ch, %u frames\n",
                negotiated.sample_rate, negotiated.channels,
                negotiated.max_block_frames);
    backend->close();
    check(!backend->is_open(), "and is closed again afterwards");
    check(!backend->is_running(), "with nothing left running");
  } else {
    // The two honest refusals. A silent machine is a fact; anything else is
    // a device that said no. Both must carry a reason, because a refusal
    // with an empty string is indistinguishable from a bug in the caller.
    check(!error.empty(), "a refusal always says why");
    std::printf("       refused: %s (endpoint_absent=%s)\n", error.c_str(),
                backend->endpoint_absent() ? "true" : "false");
    check(!backend->is_open(), "and leaves nothing open behind it");
  }

  if (g_failures > 0) {
    std::printf("\n%d check(s) failed\n", g_failures);
    return 1;
  }
  std::printf("\nall checks passed\n");
  return 0;
}
```

- [ ] **Step 2: Register the target**

In `native/CMakeLists.txt`, add immediately after the `fluideq-dsp-host` target's `set_source_files_properties` for the vendored decoders, and BEFORE the `if(WIN32)` platform branch:

```cmake
# The device contract, held to on every platform including the stub. It is
# linked against whichever backend this platform compiles, which is why the
# sources are listed again here rather than reused from the host: the host is
# an executable and has no library to link against.
add_executable(fluideq-backend-test dsp-host/tests/backend_test.cpp)
target_include_directories(fluideq-backend-test PRIVATE dsp-host/src)
target_link_libraries(fluideq-backend-test PRIVATE feq_strict)
add_test(NAME backend COMMAND fluideq-backend-test)
```

Then add the backend source to that target inside each platform branch. In the `elseif(APPLE)` branch added in Task 3, append:

```cmake
  target_sources(fluideq-backend-test PRIVATE
    dsp-host/src/platform/macos/coreaudio_backend.cpp)
  target_link_libraries(fluideq-backend-test PRIVATE
    "-framework CoreAudio"
    "-framework AudioToolbox"
    "-framework AudioUnit"
    "-framework CoreFoundation")
```

In the `if(WIN32)` branch, append these two lines only — this ADDS a target, it does not alter any existing Windows source or the sources of any existing target:

```cmake
  target_sources(fluideq-backend-test PRIVATE
    dsp-host/src/platform/windows/wasapi_backend.cpp)
  target_link_libraries(fluideq-backend-test PRIVATE ole32 avrt)
```

In the trailing `else()` branch, append:

```cmake
  target_sources(fluideq-backend-test PRIVATE
    dsp-host/src/platform/unsupported_backend.cpp)
```

- [ ] **Step 3: Run it to verify it fails before the target exists**

If Step 2 has not been applied yet, run:

```bash
cd native && cmake -S . -B .verify && ctest --test-dir .verify -R backend
```

Expected: FAIL with "No tests were found". This confirms the name `backend` is the one the new target registers.

- [ ] **Step 4: Build and run the contract test**

Run:

```bash
pnpm build:native-dsp && ctest --test-dir native/.build -R backend --output-on-failure
```

Expected: PASS. On this Mac the backend opens, so the printed line names the negotiated rate, channels and block size, and reports `coreaudio`.

- [ ] **Step 5: Verify it also passes with no device**

There is no way to remove the default output on a working Mac, so this is verified on CI in Task 10 rather than locally. What must be true here is that the refusal branch is written and compiles — confirm by reading the printed output: it names which branch ran.

Expected: the `opened` branch ran locally, printing a negotiated format.

- [ ] **Step 6: Confirm the whole suite still passes**

Run:

```bash
pnpm test:native-dsp
```

Expected: PASS, now fourteen ctest cases.

- [ ] **Step 7: Commit**

```bash
git add native/dsp-host/tests/backend_test.cpp native/CMakeLists.txt
git commit -m "Hold every platform's device to the contract it promised

Not a macOS test. audio_backend.h makes the same promises everywhere, and
a test that only ran where the newest backend lived would let the older
ones drift out from under it.

It goes green on a machine with no sound card, which is the point:
endpoint_absent is the difference between a fact about the hardware and a
defect, and a build agent has to be able to tell a reviewer which one it
found."
```

---

### Task 5: Process cost on macOS

The engine's row in the process list shows a dash for memory and CPU on macOS, because `feq_sample_process_stats` returns false. Two calls fix it.

**Files:**

- Create: `native/dsp-host/src/platform/macos/process_stats_macos.cpp`

**Interfaces:**

- Consumes: `FeqProcessStats` and `bool feq_sample_process_stats(FeqProcessStats*)` from `native/dsp-host/src/process_stats.h`. The macOS CMake branch from Task 3 already lists this file.
- Produces: nothing new. `main.cpp`'s telemetry thread is the only caller.

- [ ] **Step 1: Write the implementation**

Create `native/dsp-host/src/platform/macos/process_stats_macos.cpp`:

```cpp
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What this process costs, asked of the kernel by the process itself.
 *
 * `resident_size` is the macOS analogue of the working set Electron reports
 * for its own rows, so the column adds up rather than mixing two different
 * measures. The CPU figure is a difference against the previous call, which
 * is why `process_stats.h` says this is not thread-safe and has one caller.
 */

#include "../process_stats.h"

#include <libproc.h>
#include <mach/mach.h>
#include <unistd.h>

#include <chrono>

namespace {

/** Nanoseconds of CPU this process has used, user and system. */
bool cpu_nanoseconds(uint64_t* out) {
  rusage_info_current usage{};
  if (proc_pid_rusage(getpid(), RUSAGE_INFO_CURRENT,
                      reinterpret_cast<rusage_info_t*>(&usage)) != 0) {
    return false;
  }
  *out = usage.ri_user_time + usage.ri_system_time;
  return true;
}

uint64_t g_previous_cpu_ns = 0;
std::chrono::steady_clock::time_point g_previous_at{};
bool g_have_previous = false;

}  // namespace

bool feq_sample_process_stats(FeqProcessStats* out) {
  if (out == nullptr) {
    return false;
  }

  mach_task_basic_info info{};
  mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
  if (task_info(mach_task_self(), MACH_TASK_BASIC_INFO,
                reinterpret_cast<task_info_t>(&info), &count) != KERN_SUCCESS) {
    return false;
  }
  out->working_set_bytes = info.resident_size;

  uint64_t cpu_ns = 0;
  if (!cpu_nanoseconds(&cpu_ns)) {
    return false;
  }
  const auto now = std::chrono::steady_clock::now();

  // The first sample has nothing to difference against, and inventing one
  // from process start would report an average over the whole run rather
  // than the share of one core since the last look.
  if (!g_have_previous) {
    g_previous_cpu_ns = cpu_ns;
    g_previous_at = now;
    g_have_previous = true;
    out->cpu_percent = 0.0;
    return true;
  }

  const auto elapsed_ns =
      std::chrono::duration_cast<std::chrono::nanoseconds>(now - g_previous_at)
          .count();
  const uint64_t used_ns =
      cpu_ns > g_previous_cpu_ns ? cpu_ns - g_previous_cpu_ns : 0;
  g_previous_cpu_ns = cpu_ns;
  g_previous_at = now;

  // Share of ONE core, which is Chromium's convention: a host pinning two
  // cores reads 200 rather than 100.
  out->cpu_percent =
      elapsed_ns > 0 ? (static_cast<double>(used_ns) /
                        static_cast<double>(elapsed_ns)) * 100.0
                     : 0.0;
  return true;
}
```

- [ ] **Step 2: Build**

Run:

```bash
pnpm build:native-dsp
```

Expected: PASS with no warnings.

- [ ] **Step 3: Verify the numbers reach the telemetry frame**

Run:

```bash
pnpm test:native-dsp
```

Expected: PASS. `smoke-device.ts` holds the endpoint for six seconds, which is twelve process samples at the host's `kStatsIntervalTicks` of 20; the reported memory must be non-zero and the CPU figure must be finite and at least zero.

- [ ] **Step 4: Commit**

```bash
git add native/dsp-host/src/platform/macos/process_stats_macos.cpp
git commit -m "Measure the host's own cost on macOS

resident_size is the analogue of the working set Electron reports for its
own rows, so the process list adds up instead of mixing two measures. The
first sample reports zero CPU rather than an average over the whole run,
because a difference needs something to difference against."
```

---

### Task 6: The AudioToolbox decoder

The MPEG-4 family — m4a, m4b, AAC, ALAC — through the codecs macOS already licenses. This decoder is tried last: `pcm_decoder.cpp` falls through to the compressed decoders and then to this one, so it only ever sees files the vendored libraries could not read.

**Files:**

- Create: `native/dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp`

**Interfaces:**

- Consumes: `FeqDecoderOps` and `FeqDecoderInfo` from `fluideq/player.h`; `FeqDecoderOps feq_media_decoder_ops(void)` from `native/dsp-host/src/decoders/media_decoder.h`. The macOS CMake branch from Task 3 already lists this file.
- Produces: nothing new. `pcm_decoder.cpp:467` is the only caller.

Note `FeqDecoderInfo::channels` is **in and out**: the player writes the count it wants before `open`, and the decoder must produce exactly that many. The client format is set to that count, which makes the AudioConverter do the fold — a mono file arrives duplicated across both channels rather than silent in one ear.

- [ ] **Step 1: Write the implementation**

Create `native/dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp`:

```cpp
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The MPEG-4 family, decoded by the operating system that already licenses it.
 *
 * `ExtAudioFile` rather than AVFoundation, which `media_decoder.h` suggests:
 * AVFoundation is Objective-C and would make this file a `.mm`, adding a
 * second language to a build that has none. ExtAudioFile is a C API over the
 * same system codecs and decodes the same containers.
 *
 * Tried last. `pcm_decoder.cpp` reads WAV and AIFF, the vendored libraries
 * read MP3, FLAC and Ogg, and only what neither could open reaches here. WMA
 * has no macOS codec: `ExtAudioFileOpenURL` fails on one, `open` returns null,
 * and the renderer hands that file back to the element — a working app missing
 * a format, not a broken one.
 */

#include "../../media_decoder.h"

#include <AudioToolbox/AudioToolbox.h>
#include <CoreFoundation/CoreFoundation.h>

#include <cstring>
#include <string>

namespace {

/**
 * Enough buffers for any layout this player asks for, held inline.
 *
 * `AudioBufferList` is a variable-length struct, and the alternative is an
 * allocation per read on the decoder thread. Eight is far past the two the
 * engine uses and costs a hundred and change bytes of stack.
 */
constexpr uint32_t kMaxChannels = 8;

struct InlineBufferList {
  AudioBufferList list;
  AudioBuffer extra[kMaxChannels - 1];
};

struct MediaFile {
  ExtAudioFileRef ext = nullptr;
  uint32_t channels = 2;
};

void* media_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  const uint32_t wanted =
      info->channels > 0 && info->channels <= kMaxChannels ? info->channels : 2;

  CFURLRef url = CFURLCreateFromFileSystemRepresentation(
      nullptr, reinterpret_cast<const UInt8*>(path),
      static_cast<CFIndex>(std::strlen(path)), false);
  if (url == nullptr) {
    return nullptr;
  }

  ExtAudioFileRef ext = nullptr;
  const OSStatus opened = ExtAudioFileOpenURL(url, &ext);
  CFRelease(url);
  if (opened != noErr || ext == nullptr) {
    return nullptr;
  }

  AudioStreamBasicDescription file_format{};
  UInt32 size = sizeof(file_format);
  if (ExtAudioFileGetProperty(ext, kExtAudioFileProperty_FileDataFormat, &size,
                              &file_format) != noErr ||
      file_format.mSampleRate <= 0.0) {
    ExtAudioFileDispose(ext);
    return nullptr;
  }

  // At the FILE's rate, as the ops table requires — the player resamples.
  // Non-interleaved float, which is what `read` is asked to produce.
  AudioStreamBasicDescription client{};
  client.mSampleRate = file_format.mSampleRate;
  client.mFormatID = kAudioFormatLinearPCM;
  client.mFormatFlags = kAudioFormatFlagIsFloat | kAudioFormatFlagIsPacked |
                        kAudioFormatFlagIsNonInterleaved;
  client.mFramesPerPacket = 1;
  client.mChannelsPerFrame = wanted;
  client.mBitsPerChannel = 32;
  client.mBytesPerFrame = sizeof(float);
  client.mBytesPerPacket = sizeof(float);
  if (ExtAudioFileSetProperty(ext, kExtAudioFileProperty_ClientDataFormat,
                              sizeof(client), &client) != noErr) {
    ExtAudioFileDispose(ext);
    return nullptr;
  }

  SInt64 frames = 0;
  size = sizeof(frames);
  if (ExtAudioFileGetProperty(ext, kExtAudioFileProperty_FileLengthFrames,
                              &size, &frames) != noErr ||
      frames < 0) {
    frames = 0;
  }

  auto* file = new MediaFile();
  file->ext = ext;
  file->channels = wanted;

  info->sample_rate = static_cast<uint32_t>(file_format.mSampleRate);
  // Echoed back unchanged: what `read` produces is what was asked for. The
  // converter does the fold, so a mono file is duplicated across both
  // channels rather than left silent in one ear.
  info->channels = wanted;
  info->total_frames = static_cast<uint64_t>(frames);
  return file;
}

void media_close(void* /*user*/, void* handle) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr) {
    return;
  }
  if (file->ext != nullptr) {
    ExtAudioFileDispose(file->ext);
  }
  delete file;
}

uint32_t media_read(void* /*user*/, void* handle, float* const* channels,
                    uint32_t frames) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr || frames == 0) {
    return 0;
  }

  InlineBufferList storage{};
  storage.list.mNumberBuffers = file->channels;
  for (uint32_t channel = 0; channel < file->channels; channel += 1) {
    AudioBuffer& buffer = storage.list.mBuffers[channel];
    buffer.mNumberChannels = 1;
    buffer.mDataByteSize =
        static_cast<UInt32>(frames * static_cast<uint32_t>(sizeof(float)));
    buffer.mData = channels[channel];
  }

  UInt32 produced = frames;
  if (ExtAudioFileRead(file->ext, &produced, &storage.list) != noErr) {
    return 0;
  }
  return static_cast<uint32_t>(produced);
}

int media_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr) {
    return 0;
  }
  return ExtAudioFileSeek(file->ext, static_cast<SInt64>(frame)) == noErr ? 1
                                                                         : 0;
}

}  // namespace

FeqDecoderOps feq_media_decoder_ops(void) {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = &media_open;
  ops.close = &media_close;
  ops.read = &media_read;
  ops.seek = &media_seek;
  return ops;
}
```

- [ ] **Step 2: Build**

Run:

```bash
pnpm build:native-dsp
```

Expected: PASS with no warnings. `InlineBufferList` is written to with `storage.list.mBuffers[channel]` past index 0, which is the documented way to address a variable-length `AudioBufferList`; if `-Warray-bounds` objects, the inline array is too small rather than the access being wrong.

- [ ] **Step 3: Decode a real file end to end**

Run:

```bash
pnpm test:native-dsp
```

Expected: PASS. `smoke-decoders.ts` is the existing check that a file loads and produces frames; on macOS it now exercises this path for any m4a in its corpus.

- [ ] **Step 4: Confirm an unreadable format refuses cleanly**

Create a file that is not audio and try to load it:

```bash
printf 'not audio' > /tmp/feq-not-audio.m4a && node -e "console.log(require('fs').statSync('/tmp/feq-not-audio.m4a').size)"
```

Then run the decoder smoke script again and confirm no crash and no hang. `ExtAudioFileOpenURL` fails, `media_open` returns null, and the player reports a failed load.

Expected: `pnpm test:native-dsp` still PASSES.

- [ ] **Step 5: Commit**

```bash
git add native/dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp
git commit -m "Decode the MPEG-4 family with the codecs macOS already has

ExtAudioFile rather than the AVFoundation the header suggests: AVFoundation
is Objective-C and would make this a .mm, adding a second language to a
build that has none. Same system codecs, same containers, a C API.

WMA has no macOS codec, so ExtAudioFileOpenURL fails, open returns null and
the renderer hands the file back to the element — which is what the
fallback is for."
```

---

### Task 7: The capability descriptor

What a platform can do, said once, so no panel has to assume APO exists.

**Files:**

- Create: `src/common/platformCapabilities.ts`
- Create: `src/__tests__/unit_tests/common/platformCapabilities.test.ts`
- Modify: `src/main/api.ts:512`

**Interfaces:**

- Consumes: nothing.
- Produces: `IPlatformCapabilities`, `capabilitiesFor(platform: NodeJS.Platform): IPlatformCapabilities`, and `window.electron.capabilities` in the renderer. Task 8 consumes all three.

- [ ] **Step 1: Write the failing test**

Create `src/__tests__/unit_tests/common/platformCapabilities.test.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import {
  capabilitiesFor,
  IPlatformCapabilities,
} from '../../../common/platformCapabilities';

describe('platform capabilities', () => {
  it('gives Windows everything it has today', () => {
    const windows = capabilitiesFor('win32');
    expect(windows.systemWideEq).toBe(true);
    expect(windows.apoConfig).toBe(true);
    expect(windows.deviceRouting).toBe(true);
    expect(windows.mediaKeys).toBe(true);
    expect(windows.inAppEngine).toBe(true);
  });

  it('tells the truth about macOS rather than overpromising', () => {
    const mac = capabilitiesFor('darwin');
    expect(mac.inAppEngine).toBe(true);
    expect(mac.systemWideEq).toBe(false);
    expect(mac.apoConfig).toBe(false);
  });

  // The stub backend refuses to open, so claiming an engine here would put a
  // player in front of somebody that can never make a sound.
  it('claims no engine on a platform whose backend is still a stub', () => {
    expect(capabilitiesFor('linux').inAppEngine).toBe(false);
  });

  it('treats an unknown platform as capable of nothing', () => {
    const unknown = capabilitiesFor('freebsd' as NodeJS.Platform);
    const every = Object.values(unknown as unknown as Record<string, boolean>);
    expect(every.every((flag) => flag === false)).toBe(true);
  });

  it('never hands back a shared object a caller could mutate', () => {
    const first = capabilitiesFor('win32') as IPlatformCapabilities & {
      systemWideEq: boolean;
    };
    first.systemWideEq = false;
    expect(capabilitiesFor('win32').systemWideEq).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run:

```bash
pnpm test:jest --testPathPattern platformCapabilities
```

Expected: FAIL with "Cannot find module '../../../common/platformCapabilities'".

- [ ] **Step 3: Write the descriptor**

Create `src/common/platformCapabilities.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What this platform can actually do, so no panel has to guess.
 *
 * FluidEQ was written where Equalizer APO exists, and forty-seven renderer
 * files reason about it directly. On macOS there is no APO and the rack
 * applies to what FluidEQ itself plays — so a panel that says "applied to
 * every application" is not merely unhelpful there, it is wrong, and a user
 * who reads it goes looking for the bug in their own machine.
 *
 * A descriptor rather than a `platform === 'darwin'` check at each site,
 * because the question a panel wants answered is never which OS this is. It
 * is whether the thing the panel offers can happen. Linux later declares its
 * own row and every panel already knows what to do with it.
 */
export interface IPlatformCapabilities {
  /** The rack reaches audio this app did not play. Equalizer APO, today. */
  systemWideEq: boolean;
  /** Equalizer APO's own config files are read and written. */
  apoConfig: boolean;
  /** The system's default output can be changed from inside FluidEQ. */
  deviceRouting: boolean;
  /** The transport buttons press real media keys. */
  mediaKeys: boolean;
  /** The native host can open a device, so FluidEQ can play. */
  inAppEngine: boolean;
}

const NOTHING: IPlatformCapabilities = {
  systemWideEq: false,
  apoConfig: false,
  deviceRouting: false,
  mediaKeys: false,
  inAppEngine: false,
};

const BY_PLATFORM: Partial<Record<NodeJS.Platform, IPlatformCapabilities>> = {
  win32: {
    systemWideEq: true,
    apoConfig: true,
    deviceRouting: true,
    mediaKeys: true,
    inAppEngine: true,
  },
  // No APO, and nothing is claimed in its place. The engine is real: the
  // CoreAudio backend opens the default output and the whole rack runs on
  // what FluidEQ plays.
  darwin: {
    systemWideEq: false,
    apoConfig: false,
    deviceRouting: false,
    mediaKeys: false,
    inAppEngine: true,
  },
  // `inAppEngine` stays false until a backend exists. The stub refuses to
  // open, and offering a player that can never make a sound is worse than
  // offering none.
  linux: NOTHING,
};

/**
 * A fresh object every call.
 *
 * Handing out the shared record would let one panel's defensive `= false`
 * become every panel's answer, and the resulting bug reads as "the feature
 * disappeared after visiting that screen".
 */
export const capabilitiesFor = (
  platform: NodeJS.Platform,
): IPlatformCapabilities => ({ ...(BY_PLATFORM[platform] ?? NOTHING) });
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm test:jest --testPathPattern platformCapabilities
```

Expected: PASS, five tests.

- [ ] **Step 5: Expose it to the renderer**

In `src/main/api.ts`, add the import at the top of the file:

```ts
import { capabilitiesFor } from '../common/platformCapabilities';
```

and add immediately after the `platform: process.platform,` line in the default export:

```ts
  /**
   * What this platform can do, resolved once beside `platform` itself.
   *
   * The window needs it for the same reason it needs `platform`, one level
   * up: not which OS this is, but whether what a panel offers can happen
   * here at all.
   */
  capabilities: capabilitiesFor(process.platform),
```

`src/renderer/preload.d.ts` types `window.electron` as `typeof api`, so this needs no separate declaration.

- [ ] **Step 6: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/common/platformCapabilities.ts src/__tests__/unit_tests/common/platformCapabilities.test.ts src/main/api.ts
git commit -m "Say what a platform can do, once

Forty-seven renderer files reason about Equalizer APO directly, which is
fine where APO exists and wrong where it does not. A panel that promises
audio from every application on a Mac sends somebody looking for a bug in
their own machine.

Windows declares everything it has today, so nothing there changes."
```

---

### Task 8: Stop demanding Equalizer APO where it cannot exist

The blocking modal offers to install Equalizer APO. On macOS it must never appear.

**Files:**

- Modify: `src/renderer/App.tsx:2387-2394`

**Interfaces:**

- Consumes: `window.electron.capabilities.apoConfig` from Task 7.
- Produces: nothing.

- [ ] **Step 1: Gate the modal on the capability**

Two edits in `src/renderer/App.tsx`, and no markup is duplicated — the notice that already exists below the modal is the one that shows.

First, gate the modal itself. Its condition gains one term:

```text
{globalError && isBlockingError && window.electron.capabilities.apoConfig && (
  <PrereqMissingModal
    key={prereqNonce}
    isLoading={isLoading}
    onRetry={performHealthCheck}
    errorMsg={globalError.shortError}
    actionMsg={globalError.action}
  />
)}
```

Second, widen the existing `workspace-notice` block's condition so it also
catches the blocking errors the modal no longer shows. Change ONLY its
condition; its body stays exactly as it is:

```text
{globalError &&
  (!isBlockingError || !window.electron.capabilities.apoConfig) && (
```

The error is still shown, as a notice rather than a blocking modal. Swallowing it would leave a Mac with a real engine fault and a silent app; what must not happen is offering a Windows installer as the remedy.

On Windows `apoConfig` is true, so the first condition reduces to what it was and the second to `!isBlockingError` — the two branches partition exactly as before.

- [ ] **Step 2: Typecheck and lint**

Run:

```bash
pnpm typecheck && pnpm lint
```

Expected: PASS.

- [ ] **Step 3: Verify Windows behaviour is unchanged**

Run:

```bash
pnpm test:unit --runInBand
```

Expected: PASS. `apoConfig` is true on win32, so the first branch is the one that renders and the modal behaves exactly as before.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx
git commit -m "Do not offer a Windows installer to a Mac

The blocking modal's remedy is to install Equalizer APO, which cannot
exist here. The error still shows as a notice — a real engine fault on a
Mac must not become a silent app — but the fix it offers is no longer one
nobody can take."
```

---

### Task 9: Output devices on macOS

`discoverAudioDevices` shells out to PowerShell and already returns early off Windows, so the device list is empty on a Mac and profiles have nothing to follow.

**Files:**

- Create: `src/main/audioDevicesMac.ts`
- Modify: `src/main/audioDevices.ts:107-147`

**Interfaces:**

- Consumes: `IAudioDevice` from `src/common/constants.ts` — fields `id`, `name`, `guid`, `isDefault`, `isActive`.
- Produces: `discoverMacAudioDevices(): Promise<IAudioDevice[]>`, consumed only by `audioDevices.ts`.

- [ ] **Step 1: Write the macOS enumerator**

Create `src/main/audioDevicesMac.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Asking macOS which outputs exist.
 *
 * The same shape as the Windows path beside it: one call that leaves the
 * process and returns a list, and an empty list as the honest answer to "I
 * could not read this". `system_profiler` is to this what the PowerShell
 * script is to that — already on every machine, no dependency, no addon.
 *
 * It does not set the default output. That is `deviceRouting`, which macOS
 * declares false: changing the system default needs a CoreAudio call this
 * process cannot make without a native addon, and the in-app engine follows
 * the default rather than choosing it.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';
import { IAudioDevice } from '../common/constants';

const execFileAsync = promisify(execFile);

/** What `system_profiler` calls an output device that is the default. */
const DEFAULT_MARKER = 'spaudio_yes';

interface ISystemProfilerItem {
  _name?: string;
  coreaudio_device_output?: unknown;
  coreaudio_default_audio_output_device?: string;
}

/**
 * The items out of one `system_profiler` payload, or none.
 *
 * Every level is checked rather than trusted. The Windows path learned this
 * the hard way — a bare `JSON.parse` there threw on one unexpected line and
 * the device list came back as an error rather than as a list, for a machine
 * whose devices were perfectly readable.
 */
export const parseMacAudioDevices = (stdout: string): IAudioDevice[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  const root = (parsed as Record<string, unknown>)?.SPAudioDataType;
  if (!Array.isArray(root)) {
    return [];
  }
  const devices: IAudioDevice[] = [];
  root.forEach((group) => {
    const items = (group as Record<string, unknown>)?._items;
    if (!Array.isArray(items)) {
      return;
    }
    items.forEach((raw) => {
      const item = raw as ISystemProfilerItem;
      // An input-only device has no output channel count, and listing one
      // would offer somebody a microphone to send music to.
      if (item.coreaudio_device_output === undefined) {
        return;
      }
      const name = typeof item._name === 'string' ? item._name : '';
      if (name === '') {
        return;
      }
      devices.push({
        id: name,
        name,
        guid: name,
        isDefault:
          item.coreaudio_default_audio_output_device === DEFAULT_MARKER,
        isActive: true,
      });
    });
  });
  return devices;
};

export const discoverMacAudioDevices = async (): Promise<IAudioDevice[]> => {
  try {
    const { stdout } = await execFileAsync(
      '/usr/sbin/system_profiler',
      ['SPAudioDataType', '-json'],
      { maxBuffer: 8 * 1024 * 1024 },
    );
    return parseMacAudioDevices(stdout);
  } catch (error) {
    log.error(`could not read macOS audio devices: ${String(error)}`);
    return [];
  }
};
```

- [ ] **Step 2: Delegate from the shared entry point**

In `src/main/audioDevices.ts`, add the import beside the others:

```ts
import { discoverMacAudioDevices } from './audioDevicesMac';
```

and replace the early return inside `discoverAudioDevices` at line 108:

```ts
if (process.platform === 'darwin') {
  return discoverMacAudioDevices();
}
if (process.platform !== 'win32') {
  return [];
}
```

Leave the guard in `setDefaultAudioDevice` at line 149 exactly as it is: macOS declares `deviceRouting: false`, and a function that quietly does nothing is worse than one that is never called.

- [ ] **Step 3: Write the parser test**

Create `src/__tests__/unit_tests/main/audioDevicesMac.test.ts`:

```ts
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import { parseMacAudioDevices } from '../../../main/audioDevicesMac';

const payload = JSON.stringify({
  SPAudioDataType: [
    {
      _items: [
        {
          _name: 'MacBook Pro Speakers',
          coreaudio_device_output: 2,
          coreaudio_default_audio_output_device: 'spaudio_yes',
        },
        { _name: 'MacBook Pro Microphone' },
        { _name: 'Studio Display Speakers', coreaudio_device_output: 2 },
      ],
    },
  ],
});

describe('macOS audio device discovery', () => {
  it('lists the outputs and marks the default', () => {
    const devices = parseMacAudioDevices(payload);
    expect(devices.map((device) => device.name)).toEqual([
      'MacBook Pro Speakers',
      'Studio Display Speakers',
    ]);
    expect(devices[0].isDefault).toBe(true);
    expect(devices[1].isDefault).toBe(false);
  });

  // Offering a microphone as somewhere to send music is worse than a short
  // list, and the input-only entry has no output channel count to give it away
  // other than its absence.
  it('leaves out a device with no output channels', () => {
    const devices = parseMacAudioDevices(payload);
    expect(devices.some((device) => device.name.includes('Microphone'))).toBe(
      false,
    );
  });

  it('answers unreadable output with an empty list rather than throwing', () => {
    expect(parseMacAudioDevices('not json')).toEqual([]);
    expect(parseMacAudioDevices('{}')).toEqual([]);
    expect(parseMacAudioDevices('{"SPAudioDataType":[{}]}')).toEqual([]);
  });
});
```

- [ ] **Step 4: Run the tests**

Run:

```bash
pnpm test:jest --testPathPattern audioDevicesMac
```

Expected: PASS, three tests.

- [ ] **Step 5: Verify against the real machine**

Run:

```bash
/usr/sbin/system_profiler SPAudioDataType -json | head -40
```

Expected: JSON naming this Mac's outputs. If the key for the default marker differs from `spaudio_yes` on this OS version, fix `DEFAULT_MARKER` and the test's fixture together — the fixture is a recording of this command, and a fixture that has drifted from it tests nothing.

- [ ] **Step 6: Commit**

```bash
git add src/main/audioDevicesMac.ts src/main/audioDevices.ts src/__tests__/unit_tests/main/audioDevicesMac.test.ts
git commit -m "List the Mac's outputs so profiles have something to follow

system_profiler is to this what the PowerShell script is to the Windows
path: already on the machine, no dependency, no addon. Every level of the
payload is checked rather than trusted, because the Windows path already
learned what one unexpected line does to a bare JSON.parse.

setDefaultAudioDevice stays Windows-only. macOS declares deviceRouting
false, and a function that quietly does nothing is worse than one that is
never called."
```

---

### Task 10: The Node floor and a macOS CI job

The last thing a new platform's first contributor meets is the toolchain, and today it meets `ERR_UNKNOWN_BUILTIN_MODULE` with no indication of the cause.

**Files:**

- Modify: `package.json` (engines, test script)
- Modify: `.github/workflows/test.yml`

**Interfaces:**

- Consumes: `pnpm typecheck:platform` from Task 2; everything Tasks 1-9 built.
- Produces: nothing.

- [ ] **Step 1: Declare the Node floor**

In `package.json`, add above `"packageManager"`:

```json
  "engines": {
    "node": ">=22"
  },
```

`packageManager` is `pnpm@11.7.0`, and pnpm 11 imports `node:sqlite`, which Node 20 does not have. Without this the mismatch arrives as a stack trace from inside pnpm's own bundle rather than as a version error, which is how an hour goes missing on a fresh machine.

- [ ] **Step 2: Wire the guardrail into the suite**

In `package.json`, change the `test` script:

```json
    "test": "pnpm typecheck:platform && jest && pnpm test:native-dsp",
```

- [ ] **Step 3: Verify locally**

Run:

```bash
pnpm typecheck:platform && pnpm test:unit --runInBand
```

Expected: PASS.

- [ ] **Step 4: Add the macOS job**

In `.github/workflows/test.yml`, add after the existing `test` job, at the same indentation:

```text
  macos:
    runs-on: macos-14

    # `pipefail` is not the default, and both a failed `pnpm install` and a
    # missing `cmake` have already reported success on this platform because
    # the failing command was upstream of a pipe. A green job that ran nothing
    # is worse than a red one.
    defaults:
      run:
        shell: bash -euo pipefail {0}

    steps:
      - name: Check out FluidEQ
        uses: actions/checkout@v4

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 11.7.0
          run_install: false

      - name: Install Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Ahead of the build, because it is seconds and it is what keeps a
      # filter or a preset a single edit for every platform.
      - name: Check the platform isolation
        run: pnpm typecheck:platform

      - name: Check the file encodings
        run: pnpm typecheck:encoding

      # Builds the host and runs all fourteen ctest cases, parity included.
      # A GitHub runner has no sound card, which the backend reports through
      # `endpoint_absent` rather than as a failure — that distinction is why
      # this job can be trusted to go red for a real reason.
      - name: Build and test the native engine
        run: pnpm test:native-dsp

      - name: Run unit tests
        run: pnpm test:unit --runInBand
```

- [ ] **Step 5: Verify the workflow parses**

Run:

```bash
node -e "const y=require('js-yaml');y.load(require('fs').readFileSync('.github/workflows/test.yml','utf8'));console.log('workflow parses')"
```

Expected: `workflow parses`. If `js-yaml` is not resolvable, run `pnpm exec node -e ...` instead.

- [ ] **Step 6: Confirm the Windows job is untouched**

Run:

```bash
git diff .github/workflows/test.yml
```

Expected: additions only, below the existing job. No line inside the `test:` job is modified.

- [ ] **Step 7: Commit**

```bash
git add package.json .github/workflows/test.yml
git commit -m "Name the Node floor and keep macOS green

pnpm 11 imports node:sqlite, so Node 20 fails inside pnpm's own bundle
with no indication of the cause. An engines floor turns that into a
version error.

The macOS job runs with pipefail because both a failed install and a
missing cmake have already reported success on this platform, the failing
command being upstream of a pipe. A green job that ran nothing is worse
than a red one."
```

---

## Done

The engine runs on macOS: `pnpm dev` launches FluidEQ, the library plays through CoreAudio with the whole rack applied, the fourteen native tests are green, the platform-isolation check holds the layering, and CI runs all of it on both platforms.

Not done, by design: system-wide capture, packaging and signing, Linux. Each is its own spec.
