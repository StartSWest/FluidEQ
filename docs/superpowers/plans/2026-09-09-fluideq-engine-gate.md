# FluidEQ Engine hardware gate

The automated suite proves the engine DLL loads, processes audio and edits
the registry correctly against fixtures. It cannot prove any of the following
on a real machine, because none of it is visible to a test that only reads
bytes:

1. **Does the filter change what comes out of the speaker, and does it change
   back without a restart?**
2. **Does the laptop's own sound-enhancement suite still work with the engine
   attached** — Alienware Sound Center / Nahimic here, Realtek's panel on
   this PC?
3. **When FluidEQ is removed, is the endpoint's effect registration exactly
   what it was before FluidEQ ever touched it** — not "close enough", not
   "sound still comes out", but byte-for-byte the same `FxProperties` values?

Answering those needs a human's ears, a vendor's own UI, and a registry
comparison a script can do but a person has to read. That is what
`native/system-apo/tools/engine-gate.ps1` runs.

## How to run it

Two commands, on each machine (this PC, then the Alienware laptop):

```
pnpm build:native-dsp
powershell -ExecutionPolicy Bypass -File native\system-apo\tools\engine-gate.ps1
```

The script finds `FluidEQ-Engine-Setup.exe` next to itself or under
`native\.build\bin\` on its own; pass `-BinDir <path>` only if it is
somewhere else (a packaged kit copied off the build machine, for instance).

It is interactive by design — five steps, each ending in a question read
with `Read-Host`. Answer honestly; the point of the gate is to catch a "no"
before Ivan does. Every command it runs against the installed engine is
echoed to the console first, so the run can be checked back against its own
transcript.

When it finishes (or is interrupted with Ctrl+C), it writes
`%ProgramData%\FluidEQ\engine\gate-results.txt` and prints the same table to
the console. **Send that file back** — it is the record of what passed on
that machine.

## What the three questions come down to, step by step

| Step | What it does                                                                                                        | What decides pass/fail                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1    | `install --attach-all --restart-audio`                                                                              | Exit code 0, JSON `"ok":true`                                                                |
| 2    | Writes a −20 dB notch at 1 kHz, plays a tone, removes the notch, plays it again — no restart between                | You hear the tone nearly vanish, then come back on its own                                   |
| 3    | Nothing run — you open the vendor panel yourself                                                                    | Its controls (subwoofer level, Nahimic toggles, whatever the laptop has) still respond       |
| 4    | `detach` the default endpoint, ask about Equalizer APO, `attach` it again, replay the tone with the filter restored | APO (if present) still processes; the engine's own filter is audible again after reattaching |
| 5    | `uninstall`, then compares the endpoint's live `FxProperties` against the backup JSON `uninstall` left behind       | Every composite (`{d04e05a6-…},13/14/15`) and mode (`{d3993a3f-…},5/6/7`) value reads MATCH  |

## Results

Fill in as each machine is gated. `y`/`n` for the yes-no questions, `MATCH` /
`MISMATCH` per registry value from the script's own step 5 output — paste
from the machine's `gate-results.txt` rather than re-typing from memory.

### This PC

| Step | Question                                     | Answer |
| ---- | -------------------------------------------- | ------ |
| 1    | install succeeded                            |        |
| 2    | tone dropped with the filter                 |        |
| 2    | tone restored, no restart                    |        |
| 3    | Realtek panel controls still work            |        |
| 4    | Equalizer APO still processes (if installed) |        |
| 4    | tone dropped again after reattach            |        |
| 5    | uninstall succeeded                          |        |
| 5    | composite/mode values MATCH                  |        |

### Alienware laptop

| Step | Question                                             | Answer |
| ---- | ---------------------------------------------------- | ------ |
| 1    | install succeeded                                    |        |
| 2    | tone dropped with the filter                         |        |
| 2    | tone restored, no restart                            |        |
| 3    | Alienware Sound Center / Nahimic controls still work |        |
| 4    | Equalizer APO still processes (if installed)         |        |
| 4    | tone dropped again after reattach                    |        |
| 5    | uninstall succeeded                                  |        |
| 5    | composite/mode values MATCH                          |        |

## If step 2 fails

A "no" at step 2 — the tone does not audibly drop — almost always means the
effect landed in a slot the driver's own DSP chain does not actually run
(some drivers only process EFX, the slot this attaches to by default, when
nothing already occupies MFX; others are the other way around). Before
treating it as a real defect:

```
native\.build\bin\FluidEQ-Engine-Setup.exe attach {guid} --slot mfx --restart-audio
```

using the same default-endpoint guid the gate script printed at step 4 (or
read it again from `status`), then repeat step 2's config write and tone
test. If the filter is audible in the other slot, the driver has an opinion
about which slot runs — worth a note in the results table — and is not a
bug in the engine itself. If it is still inaudible in both slots, that is a
real failure and the gate should be reported as failed for that step.
