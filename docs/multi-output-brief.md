# Multiple outputs at once

Play to several devices simultaneously, the way Voicemeeter does.

Built, and listened to. Where a section below turned out to be wrong once it met
a real machine, it says so rather than being quietly rewritten — the reasoning
that led there is the useful part.

This document is the brief for that work. It exists because the constraint at
the top of it is not obvious, is easy to get wrong, and is the reason the
feature is shaped the way it is.

## The constraint

**Equalizer APO cannot send audio to another device.** Its complete command set
is `Preamp`, `Filter`, `Delay`, `Copy`, `GraphicEQ`, `Convolution`, `Include`,
`Device`, `Channel`, `Stage`, and the expression commands. `Copy:` looks like it
might help and does not: it copies _channels within one device_, never across
endpoints.

That is not a gap in APO. It is what APO is — it hooks an endpoint the audio has
already been routed to and filters it in place. Nothing about it routes.

Voicemeeter achieves simultaneous output by being a different kind of thing
entirely: a **virtual audio device driver**. Applications play into its virtual
sound card and it fans the signal out to real outputs. That is kernel-level, and
writing one is explicitly out of scope — FluidEQ's README sells "no proprietary
driver, no virtual audio device" as a feature, and a driver would end it.

So there are two routes, and the decision taken was to build **both**, because
they serve different situations honestly.

## Route A — Pre-EQ mirror, no driver

On Windows, one native helper captures the process mix before endpoint effects
and plays the mirrors itself. LAN sending leases that same helper. Its own
process tree is excluded from capture, so neither local mirrors nor LAN can
recapture the mirrored audio. Audio received from another PC and played by
Electron remains part of the local mix.

```
application mix ─┬─ APO A ─ main output A
                 └─ process loopback ─ native mirror ─ APO B ─ output B
```

The helper opens the explicit Windows endpoint GUID in shared mode with effects
enabled. Windows does endpoint format conversion and APO B applies B's profile.
No inverse EQ is used: inverse peaking filters cannot recover clipping or undo
arbitrary convolution and nonlinear effects in A's endpoint chain.

Game/Video starts with about 30 ms of reserve and crossfades stale audio after a
stall. Music starts with about 100 ms and keeps its queued audio. Small continuous
rate corrections compensate independent device clocks. Both modes refill after
underruns; device buffering adds delay beyond these reserve targets. The buffers
are bounded and an unresponsive endpoint fails visibly.

Each enabled output has its own saved-profile picker and level. The picker
reads that endpoint's profile directory and changes its APO assignment, without
making it the main device or loading its profile into the main EQ controls.

### Output switching and teardown

The old mirror branched from the spectrum's source node. Switching from A to B
made the spectrum disconnect its source first, then the mirror tried to
disconnect the now-absent edge and raised InvalidAccessError. Windows mirrors
now own their playback in the native helper, independently of that graph. The
non-Windows fallback owns a separate source node on the same captured stream.

Starts are cancellable and tied to the current output generation. Switching
the main output stops running mirrors and waits for cancelled starts to clean
up before changing Windows' default. A late start cannot resurrect an old
mirror. Closing or reloading the window also releases its mirrors.

### History

The original endpoint-loopback mirror carried A's correction to B, where B's
APO applied another correction. Reapplying B's filters in Web Audio compounded
that problem. A hidden media player also added an uncontrolled playback queue.
The current Windows path avoids both; the Web Audio path remains only as a
fallback on other platforms.

Windows process-loopback exclusion is documented in Microsoft's
[Application Loopback sample](https://github.com/microsoft/Windows-classic-samples/tree/main/Samples/ApplicationLoopback).
Audio isolation, latency, and switching still require listening on real devices;
compilation is not evidence of audible correctness.

## Route B — Virtual device, when one is present

If VB-Cable or Voicemeeter is installed, APO attaches to _their_ endpoints
perfectly well. The work is recognising them, labelling them usefully, and
letting each carry its own FluidEQ profile.

```
app -> virtual device -+-> APO (profile 1) -> headphones
                       '-> APO (profile 2) -> speakers
```

In sync, no added latency, works with everything, works whether or not FluidEQ
is running. FluidEQ's contribution is only the EQ — the routing belongs to
somebody else's driver, which is the correct division.

Endpoints worth detecting by name: `CABLE Input`, `VoiceMeeter Input`,
`VoiceMeeter Aux Input`, `VoiceMeeter VAIO3`.

## Endpoint identity

Windows mirrors open the stable endpoint GUID directly. They do not depend on
Chromium permissions, display names, salted device IDs, or the movable
`default` alias. The Web Audio fallback still uses the existing conservative
name bridge and refuses ambiguous matches.

## Implementation map

| What                                     | Where                                                |
| ---------------------------------------- | ---------------------------------------------------- |
| Shared native capture leases             | `src/main/remoteAudioCapture.ts`                     |
| Helper transport                         | `src/main/nativeCaptureProcess.ts`                   |
| Native mirror playback and buffering     | `native/remote-audio-capture/src/mirror_output.cpp`  |
| Native control and lifetime              | `native/remote-audio-capture/src/mirror_control.cpp` |
| Window-scoped mirrors and switch barrier | `src/main/ipc/outputMirror.ts`                       |
| Renderer cancellation and reconciliation | `src/renderer/audio/useMirrorPlayback.ts`            |
| Second-output profile picker             | `src/renderer/SecondOutputProfilePicker.tsx`         |
| Per-device profiles and APO config       | `src/main/deviceProfiles.ts`                         |

Windows mirrors share one native capture with LAN; the spectrum retains its
separate endpoint capture because it measures the post-EQ output. The
non-Windows fallback reuses the spectrum's stream without another display-media
request. No additional screen/video capture is opened for a second output.
