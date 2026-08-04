# FluidEQ

> Your sound. Every device. Automatically.

FluidEQ is a free, open-source system-wide parametric equalizer for Windows.
It puts a modern workflow on top of
[Equalizer APO](https://sourceforge.net/projects/equalizerapo/): tune once per
output, and the right sound follows the right device without you touching
anything again.

![FluidEQ interface preview](docs/fluid-eq-preview.svg)

## What it does

**Follows your output.** Every setting below belongs to the device you tuned it
on. Plug in your headphones and their tuning comes back; switch to speakers and
theirs does. FluidEQ maps the stable Windows endpoint ID, not the display name,
so it survives renames and re-plugs.

**Four layers, one chain.** Each is written as its own stage in the Equalizer
APO config, in this order:

| Layer         | What it is                                                                                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Convolution   | A measured impulse response applied before anything else — from the AutoEq catalogue or a WAV of your own.                                                                                |
| Parametric EQ | Up to 128 bands. Peak, low/high shelf, low/high pass, band pass and notch, each with frequency, gain and Q.                                                                               |
| Voicing       | Five curated target curves — music, movies, games, speech, late night — with a strength slider.                                                                                           |
| Driver type   | Twelve compensation profiles for what you are actually listening on: dynamic, planar, balanced armature, electrostatic, bone conduction, the common diaphragm materials, and driver size. |

Everything active is named on the EQ page, so a bump in the graph is never a
mystery — you can see what put it there and remove it in one click.

**Start from a measurement.** 6,028 headphone models and 8,850 responses ship
offline from the official AutoEq results. The GadgetryTech Squiglink database is
available online as a second source. Once applied, FluidEQ remembers which model
your bands came from and says so.

**Smart EQ.** Measures what is actually coming out of your output and flattens
what it hears, rather than assuming a target.

**One preamp, computed.** Every layer contributes to a single `Preamp:` line
derived from the real combined response, so adding a voicing or a convolution
cannot clip you — and removing one gives the headroom back.

**Import what you already have.** An Equalizer APO ParametricEQ or GraphicEQ
file, a FluidEQ profile, or any WAV impulse response.

**Ten languages.** English, 简体中文, हिन्दी, Español, Français, Português,
Русский, 日本語, Deutsch, Italiano. FluidEQ picks yours from Windows on first
run.

**Local and account-free.** No cloud, no telemetry, no proprietary driver, no
virtual audio device.

## How device switching works

FluidEQ writes one `Device:` block per assigned output into its own config file,
which Equalizer APO includes. Because APO accumulates every block whose device
matches, the block for the output you are listening on is the one that applies.

```text
# Neutral fallback for every output without an attached profile.
Device: all
Channel: all

# Headphones -> Sony XM5 · Music
Device: {HEADPHONE-ENDPOINT-GUID}
Channel: all
Preamp: -6.4 dB
Convolution: fluideq-ir-8f2a1c9b4d70.wav
Filter 1: ON LSC Fc 105 Hz Gain 5.4 dB Q 0.7
Filter 2: ON PK Fc 2200 Hz Gain -3.1 dB Q 1.41
```

No virtual output device and no kernel driver.

## Getting started

FluidEQ is Windows-only, because Equalizer APO is the audio engine.

1. Install [Equalizer APO](https://sourceforge.net/projects/equalizerapo/).
2. Run its Configurator and tick every output you want FluidEQ to manage.
   Reboot if it asks.
3. Download the installer from
   [Releases](https://github.com/StartSWest/FluidEQ/releases) and run it.
4. Pick your output at the top right, then tune.

That is the whole setup. Nothing needs saving — every edit attaches itself to
the current output automatically. Naming a profile is only needed if you want
several tunings for the same device.

> The installer is not code-signed yet, so SmartScreen will warn on first run.
> Choose **More info → Run anyway**, or build it yourself from source below.

## Supporting the work

FluidEQ is free and stays free. Nothing is behind a paywall, nothing is tracked,
and there is no paid tier waiting in the wings.

**This is one person's work, built with a lot of love and an unreasonable amount
of attention to detail.** Every panel was drawn by hand and argued over: how the
response curve reads at a glance, the way a menu unfolds, what a knob does when
you drag it slowly, which words go on a button, whether a chip should truncate
its label or its value. Nothing here is a stock component with a theme painted
on top. The parts you are not supposed to notice are the parts that took the
longest.

If it earned a place in your setup, a contribution funds the time that keeps it
maintained and the next ideas out of the same workshop.

<a href="https://buymeacoffee.com/startswest"><img src="assets/support-qr.png" alt="QR code for the FluidEQ Buy Me a Coffee page" width="200" align="left" hspace="20"></a>

**[buymeacoffee.com/startswest](https://buymeacoffee.com/startswest)**

A one-off tip, no account needed. Click the link, or scan the code with your
phone.

Prefer to contribute time? Issues and pull requests are just as welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md).

<br clear="left">

## Development

### Requirements

- Windows 10 or 11
- [Node.js](https://nodejs.org/) 20+ and pnpm
- Visual Studio 2022 with **Desktop development with C++**
- Equalizer APO, for real system-audio integration

### Run it

```powershell
git clone https://github.com/StartSWest/FluidEQ.git
cd FluidEQ
pnpm install
pnpm dev
```

On non-Windows systems FluidEQ exposes two demonstration endpoints, so the UI
and the device-assignment flow can be worked on without touching system audio.

### Commands

```powershell
pnpm test:unit
pnpm lint
pnpm build
pnpm package
```

`pnpm package` produces the NSIS installer in `release/build`.

### Build-time configuration

Copy `.env.example` to `.env` to set the contribution links. Every value in it
is inlined into the renderer bundle and is therefore public by construction —
the file says so at the top, at length, because that is exactly the kind of
thing people get wrong once.

## Attribution

FluidEQ is a derivative of [AQUA](https://github.com/h39s/AQUA), created by the
AQUA Dev Team, which provided the original Electron/React equalizer interface,
Equalizer APO integration, AutoEQ support, filter controls, preset management
and graph visualization. FluidEQ keeps the original Git history, the copyright
notices in every source file, and the GPL licensing, and continues the project
under a new identity with a device-aware profile system. It is not presented as
an official continuation and is not endorsed by the AQUA maintainers.

AutoEq data and targets are credited to
[Jaakko Pasanen](https://github.com/jaakkopasanen/AutoEq) and
[Ian Walton](https://github.com/iwalton3/AutoEq). The bundled library is the
official AutoEq results snapshot at commit
`7ae0f56d53074872b028649617a22bbb4232feb7`; maintainers can refresh it with
`pnpm autoeq:update` and validate every generated filter with
`pnpm test:autoeq`.

The optional **GadgetryTech / Squiglink** source stays separate from the offline
library. FluidEQ reads their public `phone_book.json` and REW measurements on
demand and fits the selected response into PEQ filters locally. Nothing from it
is bundled or republished by the installer; it is cached in the user data
directory only, and the attribution link stays visible in the app.

Equalizer APO is a separate GPL-licensed project by Jonas Thedering.

FluidEQ is not affiliated with or endorsed by Dolby Laboratories.

See [NOTICE.md](NOTICE.md) for the full derivative-work notice.

## License

FluidEQ is free software under the
[GNU General Public License v3.0 or later](LICENSE), matching upstream AQUA.

Copyright © 2023 AQUA Dev Team<br>
FluidEQ modifications copyright © 2026 FluidEQ contributors

You may use, study, modify and redistribute this software under the GPL. A
distributed modified version must also make its corresponding source available
under the same license. This summary is not a substitute for the license text.
