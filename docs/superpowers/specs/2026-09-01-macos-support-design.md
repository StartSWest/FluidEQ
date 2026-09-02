# macOS support

FluidEQ runs on Windows because Equalizer APO does. This is the design for
running the rest of it — the engine, the library, the player, every layer of
the rack — on macOS, without APO and without a second copy of anything.

The authority for every name and number here is code, not this file:

- `native/dsp-host/src/audio_backend.h` — the device interface, and the only
  contract a new platform has to satisfy
- `native/dsp-host/src/process_stats.h` — the process-cost interface
- `native/dsp-host/src/decoders/media_decoder.h` — the platform decoder
  interface
- `native/CMakeLists.txt` — which sources each platform compiles
- `.erb/scripts/build-native-dsp.ts` — the build, which already resolves a
  toolchain per platform

Where this document and those modules disagree, the modules are right.

## Scope

In: the in-app engine. Audio played through FluidEQ — the library, the player,
the six-layer rack, the meters, the spectrum — works on macOS, on Apple
Silicon, from `pnpm dev`, with the native test suite green and a macOS job in
CI.

Out, and deliberately:

- **System-wide EQ.** macOS has no Equalizer APO. Processing another
  application's audio needs either a HAL plugin the user installs or the
  14.4+ process-tap API, and both are their own project with their own
  permission story. Neither is started here.
- **Distribution.** No `.dmg`, no signing, no notarization. Those need an
  Apple Developer account and a set of decisions that have nothing to do with
  whether the engine runs.
- **Intel.** arm64 only. `CMAKE_OSX_ARCHITECTURES` makes universal a build
  flag later, not an architecture change — but a second architecture doubles
  what the parity corpus has to be checked against, and that is a cost to pay
  when somebody actually needs it.
- **Linux.** Later, and this design is shaped so that later is cheap.

## What the port actually costs

Measured, not estimated. The native tree was configured and built on macOS 26
with Apple Clang 21 before this document was written:

- `fluideq-dsp-core` compiles: 45 of 45 sources
- `FluidEQ-DSP`, the host executable, links
- 11 of 12 test binaries build and pass
- `dsp-parity` did not run: its corpus is expanded by
  `build:native-dsp --test`, which the failed build never reached
- Five diagnostics, in two files, are the whole blocker list

Sixty thousand lines of audio code, and the platform bill is five compiler
diagnostics. That is what `audio_backend.h` bought by being written before a
backend existed.

## The rule this design is built on

One number decides whether a third platform is cheap or ruinous:

|                                                     | lines  |
| --------------------------------------------------- | ------ |
| `src/common` — shared TypeScript                    | 55,924 |
| `native/dsp-core` and the shared half of `dsp-host` | 31,105 |
| `platform/windows`                                  | 975    |
| the stub every other platform gets today            | 105    |

More than ninety-six per cent of the native code, and all of `src/common`, is
written once. A preset lives in `src/common/dsp/eqPresets.ts`; a filter lives in
`native/dsp-core/src/eq.cpp`; the chain lives in `src/common/dsp/chain.ts`.
Fixing any of them is one edit that every platform receives. Parameter ids go
further than convention — `parameters.h` is generated from
`src/common/dsp/nativeParameters.ts` and gitignored, so a divergent second copy
cannot exist to be wrong.

Everything below the seam answers one question and no other: how does this
operating system want its samples. Nothing below the seam decides anything.

**Platform code lives under `platform/` and nowhere else.** That rule is
currently a comment in a header, and comments do not fail builds. This design
makes it a check (see "The guardrail"), because the failure mode is not a bad
decision — it is somebody adding `#ifdef __APPLE__` inside `chain.cpp` at
eleven at night to fix one thing, and that margin beginning to slide.

## Native

Three new files. No existing Windows source is edited, and no Windows library
is replaced.

```text
native/dsp-host/src/platform/macos/coreaudio_backend.cpp
native/dsp-host/src/platform/macos/process_stats_macos.cpp
native/dsp-host/src/decoders/platform/macos/audiotoolbox_decoder.cpp
```

### The device

AUHAL — an `AudioUnit` of subtype `kAudioUnitSubType_HALOutput`. It is a pull
model with a render callback, which is the shape `FeqRenderFn` already has, and
it negotiates the format instead of asserting one, which is what `open`
already reports back through `FeqBackendFormat`.

Rejected: `AudioDeviceIOProc` on the raw HAL, which trades format conversion
and device lifecycle we would then write ourselves for a latency difference
nobody can hear; and `AudioQueue`, which buffers internally and is the wrong
model for a real-time rack.

Set `kAudioFormatFlagIsNonInterleaved` and CoreAudio hands the callback an
`AudioBufferList` holding one buffer per channel. That **is** `float* const*
planar`. The Windows backend keeps a `planar_` scratch and interleaves every
frame by hand because WASAPI will not do this; macOS needs neither the scratch
nor the loop.

`needs_reopen()` is answered honestly rather than defaulted, because macOS has
the notification the header says a platform should not pretend to lack: an
`AudioObjectAddPropertyListener` on `kAudioHardwarePropertyDefaultOutputDevice`
sets the flag, and `request_reopen()` puts it back when the reopen attempt
fails — which is exactly the case of a device that has just been unplugged.

`endpoint_absent()` returns true when the system reports no default output
device, so a Mac build agent with no sound card stays distinguishable from a
broken one. That distinction is the reason the predicate exists.

### Process cost

`task_info` with `MACH_TASK_BASIC_INFO` for resident memory, and
`proc_pid_rusage` for CPU time. The same two figures the Windows
implementation reports, from the two calls macOS supplies them from.

### The decoder

`ExtAudioFile`, from AudioToolbox, for the containers the vendored decoders do
not cover — m4a, AAC and ALAC. Apple licenses those codecs for the operating
system, which is the same reason the Windows build reaches for Media
Foundation rather than linking a decoder of its own.

mp3, FLAC and Ogg keep going through the vendored `dr_mp3`, `dr_flac` and
`stb_vorbis`, which are already platform-neutral and already compile here.
WMA has no macOS decoder and will not get one; the decoder reports the format
as unsupported through the interface's existing channel.

### CMake

`if(WIN32) … elseif(APPLE) … else() …`. The Windows branch is not touched. The
existing `else()` stays exactly as it is, so Linux and anything unknown keep
building green against the stub, and Linux later becomes a fourth branch of
the same shape rather than a change to any of the first three.

The macOS branch links `CoreAudio`, `AudioToolbox` and `AudioUnit`, and sets
`CMAKE_OSX_ARCHITECTURES` to `arm64`.

## The five fixes

They are in `denoise_voice.cpp` and `chain_meters_test.cpp`, and they are
fixed rather than silenced.

Three are `-Wunused-result` on ONNX Runtime calls. Two of those —
`SetIntraOpNumThreads` and `SetInterOpNumThreads` — return an `OrtStatus*` that
the code currently drops on the floor. Clang found a real silent failure that
MSVC does not diagnose; the fix is to check the status, and it improves the
Windows build too. The third, `AllocatorFree`, is checked the same way.

The remaining two are an unused `constexpr` and an unused static function, both
dead. They are deleted.

`-Werror` is not relaxed, for any platform, for any file. The vendored decoder
already has the single documented exemption in this project and it stays the
only one.

## The capability model

macOS cannot do system-wide EQ, so the UI must not claim it does. Forty-seven
renderer files currently reason about APO directly.

A new `src/common/platformCapabilities.ts` describes what a platform can do —
`systemWideEq`, `apoConfig`, `deviceRouting`, and so on. Electron main resolves
it once and exposes it over IPC; panels read capabilities instead of assuming
them, and APO-only surfaces hide themselves where the capability is absent.

Windows declares every capability it has today, so **Windows behaviour is
unchanged**. This is the mechanism, not a macOS special case: Linux declares
its own row and inherits every panel without new branching. Copy follows the
same descriptor — where Windows says a layer applies to every application,
macOS says it applies to FluidEQ playback, because that is true.

## Device enumeration

`src/main/audioDevices.ts` shells out to a PowerShell script. It already
returns early when `process.platform !== 'win32'`, so nothing there breaks; a
sibling macOS implementation lists output devices through CoreAudio behind the
same interface. Device profiles keep their meaning — a profile still follows
the output you render to.

## The guardrail

A test, roughly forty lines, that fails when:

1. a source outside a `platform/` directory includes a platform header
   (`<windows.h>`, `<AudioToolbox/…>`, `<alsa/…>`)
2. a source outside a `platform/` directory branches on `_WIN32`,
   `__APPLE__` or `__linux__`
3. one platform gains a file its siblings lack, so a feature cannot quietly
   become single-platform

This is the part of the design that survives us. Without it the layering is a
habit; with it, it is a property the build checks.

## Housekeeping

`package.json` gains `engines: { node: ">=22" }`. It pins
`packageManager: pnpm@11.7.0`, and pnpm 11 imports `node:sqlite`, so Node 20
fails with `ERR_UNKNOWN_BUILTIN_MODULE` and no indication of the cause. A
`packageManager` pin without an `engines` floor turns a version mismatch into a
stack trace, and that is the first thing a new platform's first contributor
meets.

CI gains a macOS arm64 job running the native build and `ctest`. Every shell
step sets `pipefail`: during this investigation both a failed `pnpm install`
and a missing `cmake` reported success, because the failing command was
upstream of a pipe.

## Testing

The existing suite is the test. All twelve native binaries must build and pass
on macOS, `dsp-parity` included — it is the check that the rack computes the
same numbers here, and it is expanded by `build:native-dsp --test`.

New, and only where there is new behaviour:

- the backend reports `endpoint_absent` on a machine with no default output,
  and a plain failure on a machine that has one and refuses the format
- a default-device change raises `needs_reopen`, and a failed reopen leaves the
  request standing rather than dropping it
- the AudioToolbox decoder returns the same PCM as the vendored decoders for a
  file both can read, and reports unsupported for WMA
- the guardrail fails on a deliberately misplaced `#ifdef`

The DSP itself gets no new tests. It is unchanged, and `dsp-parity` already
asks the only question that matters about it.

## Risks

**Parity on arm64.** The corpus was frozen from a Windows x86_64 run. Different
FMA contraction can move the last bits. `-ffp-contract=off` is already set for
non-MSVC, which is the reason to expect this to hold; if it does not, the
tolerance is examined per-test and argued for, not widened globally.

**Real-time thread priority.** macOS wants a time-constraint policy set through
`thread_policy_set` rather than a priority number. Getting it wrong shows up as
occasional dropouts under load, not as an error, so the underrun counter
`FeqBackendStats` already carries is the thing to watch during bring-up.
