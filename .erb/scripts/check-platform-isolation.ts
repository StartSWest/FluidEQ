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
        'Win32 process-handle wait, Linux pidfd poll with a prctl fast path, macOS kqueue NOTE_EXIT; there is no portable way to block on a process that is not our child',
      expected: 9,
    },
  ],
  [
    'native/dsp-host/src/host_commands.cpp',
    {
      reason:
        'fopen_s vs fopen for the comparison WAV, the same C runtime difference as the decoder',
      expected: 1,
    },
  ],
  [
    'native/dsp-core/src/doorbell.cpp',
    {
      reason:
        "a kernel event vs std::atomic's own wait: macOS and Linux take the portable path, and Windows rings through SetEvent because MSVC's notify_one shares a user-mode table with whatever thread it wakes",
      expected: 6,
    },
  ],
  [
    'native/dsp-core/include/fluideq/doorbell.h',
    {
      reason: "the Windows event handle the doorbell's shim keeps",
      expected: 1,
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
  [
    'native/dsp-core/tests/room_comparison_test.cpp',
    {
      reason:
        'fopen_s vs fopen for the optional frame dump, the same C runtime difference as the decoder',
      expected: 1,
    },
  ],
]);

/**
 * Programs that exist on one platform — their platform parts sit under
 * `if(WIN32)` in CMake, either in `native/CMakeLists.txt` or in a list of
 * their own. They are not the seam: what is Windows in them is shared with
 * nothing, so there is nothing for a second platform to inherit and no
 * `platform/` split to make. The FluidEQ Engine loads inside audiodg.exe; a
 * macOS equivalent is its own program, not a branch of this one. The few that
 * keep a platform-free core compiled and tested everywhere have those files
 * named below, and they stay checked.
 *
 * Named, with a reason, for the same reason the file allowances are: the
 * check's job is to notice the NEXT single-platform tree appearing, and a
 * pattern such as "anything outside dsp-core and dsp-host" would not.
 */
const SINGLE_PLATFORM_PROGRAMS = new Map<string, string>([
  [
    'native/mac-remote-audio/',
    'Core Audio capture and isolated LAN playback on macOS',
  ],
  [
    'native/mac-engine/',
    "the FluidEQ Engine on macOS: every app's sound through a Core Audio process tap",
  ],
  [
    'native/wallpaper/',
    'the desktop visualizer helper, which parents a window behind Explorer',
  ],
  ['native/lighting-host/', 'Windows Dynamic Lighting through C++/WinRT'],
  ['native/process-meter/', 'the Processes list meter, which reads psapi'],
  ['native/remote-audio-capture/', 'WASAPI process-loopback capture'],
  ['native/remote-audio-playback/', 'WASAPI playback of audio from the LAN'],
  [
    'native/foreground-watch/',
    "game profiles' watcher, which asks Windows which program is in front",
  ],
  [
    'native/volume-watch/',
    "the volume watcher, which Windows tells of the playing output's level",
  ],
  [
    'native/output-watch/',
    "the outputs watcher, which Windows tells of an output's effects changing",
  ],
  [
    'native/media-watch/',
    "the media watcher, which reads every player's session through WinRT",
  ],
]);

/**
 * Files under one of those trees that are compiled on every platform, so they
 * stay held to the rule: the platform-free cores of the two LAN helpers and
 * the media watcher's line format, which CMake builds and tests everywhere. A
 * Windows header in one of these fails the Mac build before it fails this
 * check — this check is the one that says why.
 */
const SHARED_WITHIN_PROGRAMS = new Set([
  'native/media-watch/src/media_line.h',
  'native/media-watch/tests/media_line_test.cpp',
  'native/remote-audio-capture/src/capture_queue.cpp',
  'native/remote-audio-capture/src/capture_queue.h',
  'native/remote-audio-capture/tests/capture_queue_test.cpp',
  'native/remote-audio-playback/src/playback_core.cpp',
  'native/remote-audio-playback/src/playback_core.h',
  'native/remote-audio-playback/src/sinc_kernel.cpp',
  'native/remote-audio-playback/src/sinc_kernel.h',
  'native/remote-audio-playback/tests/playback_test.cpp',
]);

/**
 * The Windows-only parts of the FluidEQ Engine's tree, which is otherwise
 * shared: its DSP core — the configuration it reads and the graph it runs —
 * builds on Windows and on macOS, where the Mac engine runs the same graph on
 * the same files. So the tree is checked by default and these are the
 * exceptions, each with its reason: a new file in the shared core is held to
 * the rule without anybody remembering to list it, and a new Windows-only one
 * has to say why it is here.
 */
const WINDOWS_ONLY_IN_ENGINE = new Map<string, string>([
  [
    'native/system-apo/src/apo',
    'the effect itself: the COM object audiodg.exe loads, and its format and endpoint',
  ],
  ['native/system-apo/src/dll.cpp', "the DLL's entry points and registration"],
  [
    'native/system-apo/src/watcher',
    "the effect's reload thread, on FindFirstChangeNotification",
  ],
  [
    'native/system-apo/src/owner_link',
    'the named pipe that tells the effect FluidEQ is running',
  ],
  [
    'native/system-apo/src/config_file',
    'reading a configuration file with CreateFileW',
  ],
  [
    'native/system-apo/src/status_file.cpp',
    "writing the effect's status files through Win32; their text (`status_json.cpp`) is shared with the Mac engine",
  ],
  [
    'native/system-apo/src/analysis_',
    'the analysis pipe from the effect to the app',
  ],
  [
    'native/system-apo/src/chain_signature',
    "the effect's change signature, which reads file attributes through Win32",
  ],
  [
    'native/system-apo/src/paths',
    "the effect's folders, from Windows' known folders",
  ],
  ['native/system-apo/src/log', "the effect's log file"],
  [
    'native/system-apo/src/split_',
    'the second output transport uses Windows named shared memory and process handles',
  ],
  [
    'native/system-apo/tests/split_',
    'tests of the Windows second-output transport and its process lifetime',
  ],
  [
    'native/system-apo/tests/repro_test.cpp',
    'loads the Windows DLL to check its MSVC type descriptors for build paths',
  ],
  [
    'native/system-apo/setup/',
    'the helper that installs the effect into Windows',
  ],
  [
    'native/system-apo/tests/dll_',
    'tests that load the built DLL the way audiodg.exe does',
  ],
  [
    'native/system-apo/tests/owner_link_test.cpp',
    'serves the owner pipe the effect connects to',
  ],
  [
    'native/system-apo/tests/status_test.cpp',
    "the effect's status files, written through Win32",
  ],
  [
    'native/system-apo/tests/phase_test.cpp',
    "compiles the effect's signature, paths and log in",
  ],
]);

const isSinglePlatformProgram = (name: string) =>
  !SHARED_WITHIN_PROGRAMS.has(name) &&
  ([...SINGLE_PLATFORM_PROGRAMS.keys()].some((dir) => name.startsWith(dir)) ||
    [...WINDOWS_ONLY_IN_ENGINE.keys()].some((part) => name.startsWith(part)));

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
      !isPlatformScoped(name) &&
      !isSinglePlatformProgram(name),
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
  `${tracked.length} shared native sources are platform-free (${ALLOWED.size} allowed by name; ${SINGLE_PLATFORM_PROGRAMS.size} single-platform programs and the engine's ${WINDOWS_ONLY_IN_ENGINE.size} Windows-only parts are not shared and not checked).`,
);
