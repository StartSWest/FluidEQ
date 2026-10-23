# FluidEQ on Linux — native side

Everything here is Linux-only and is added to the build by one block at the end
of `native/CMakeLists.txt`. Windows and macOS never configure a line of it, and
nothing under `system-apo/` or `dsp-host/src/` is edited for Linux: features
arrive from `main` by merge.

## FluidEQ-Engine (the system-wide engine)

On Windows the engine is an audio effect inside every output's chain. On Linux
it is a process of the user's, started by FluidEQ, that adds an output named
**FluidEQ** to the sound server, makes it the default, runs the engine over
what applications play into it, and plays the result to the real output the
listener chose. Picking another output in the desktop's sound settings moves
the engine there (that output's own profile applies) and FluidEQ stays the
default. Quitting gives the chosen output back as the default.

The processing is the Windows engine's, compiled unchanged from
`system-apo/src`: the config resolver, the graph and every stage, Auto
normalize's level prediction, song leveling, the room, the status text. Only
what talks to the operating system is Linux's own:

| Windows                         | Linux                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| effect slot in audiodg.exe      | `engine/pw_router.*` (PipeWire), `engine/pulse_router.*` (PulseAudio)                       |
| `LockForProcess` / `APOProcess` | `engine/output_engine.*`                                                                    |
| `Watcher` (change notification) | `engine/output_watcher*` (inotify)                                                          |
| `%ProgramData%\FluidEQ\engine`  | `$XDG_DATA_HOME/FluidEQ/engine` (`~/.local/share/FluidEQ/engine`), or `FLUIDEQ_ENGINE_ROOT` |
| endpoint GUID                   | derived from the output's `node.name` (`engine/outputs_file.*`)                             |
| owner pipe                      | the engine is FluidEQ's child: `--owner-fd`, `--exit-with-parent`                           |

The engine folder has the Windows layout: `config/` (what the app writes, same
file names, per-output files named by the output's id), `engine.log`,
`status-{ID}.json` per output, plus `outputs.json`, which lists the machine's
outputs with their ids, names and which one is being played to.

```
FluidEQ-Engine [--target <name>] [--no-default] [--server auto|pipewire|pulse]
               [--root <dir>] [--owner-fd <n>] [--exit-with-parent]
```

Exit codes: 0 stopped as asked, 1 bad command line, 2 no sound server it can
use, 3 already running for this user.

### Sound servers

- **PipeWire** (Ubuntu 22.10+, Debian 12+, Fedora 34+, Arch, Mint 22, Pop!_OS):
  the FluidEQ sink and the playback are one node group, run in the real
  output's cycle — no second clock, no resampling, the delay is reported to
  PipeWire so video players keep lips in sync.
- **PulseAudio** (Ubuntu 22.04, Debian 11, Mint 21): a null sink, its monitor
  recorded, played to the real output; the drift between the two clocks is
  held with rare 0.05% rate nudges (see `pulse_router.cpp`).

Both libraries are opened at run time (`pipewire/pw_api.*`, `pulse/pa_api.*`),
never linked, so one binary starts everywhere and says plainly what is missing.

## FluidEQ-DSP (the Library player's host)

`dsp-host/` fills the host's existing per-OS slot: PipeWire where it runs, ALSA
otherwise (which reaches PulseAudio through its ALSA plugin), the shared stub
only when neither library exists. Process memory and CPU come from `/proc`.

## Building

`pnpm build:native-dsp` builds everything on a Linux machine with
`libpipewire-0.3-dev` (Debian/Ubuntu) or `pipewire-devel` (Fedora) installed;
without it the engine is built for PulseAudio only. `ctest -R linux-` runs the
Linux tests.

Release binaries come from `linux/build-portable.sh`, which builds inside
AlmaLinux 8 (glibc 2.28) with a current compiler and pinned PipeWire headers,
so they start on any distribution from 2018 on (they need glibc 2.27). Docker
is the only requirement.
