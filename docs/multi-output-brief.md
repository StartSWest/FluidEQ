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

## Route A — Mirror, no driver

FluidEQ already captures system audio; it is what draws the live spectrum on the
graph, and it is currently measured and thrown away. The mirror feeds that same
capture into a Web Audio graph, filters it, and renders it to a second output via
`setSinkId`.

```
app -> APO -> headphones
                 |
                 '- FluidEQ captures the mix, already corrected
                        |
                        '- straight through -> speakers  (150-300ms later)
```

**Works with no install and nothing to configure.** That is its whole appeal.

**The delay is unavoidable.** Audio is played, captured back, processed, and
played again. Say so in the UI rather than hoping nobody notices:

- Music into another room — fine.
- Video or games — lips out of sync by a fifth of a second. Useless.
- Both devices audible from one seat — a slapback echo.
- Only works while FluidEQ is open. It is not a service.

### Mirrored outputs get their OWN EQ — this was wrong

The original argument: the captured audio has **already been EQ'd by APO for the
primary device**, so mirroring it raw sends a headphone correction to a speaker,
and the mirror therefore needs a second EQ engine in Web Audio applying the
target device's profile.

It was built that way. The first time anyone listened, it sounded hollow and
phasey — "like cancelling" — and the level dropped whenever a second output was
switched on. Two causes, neither visible from the code:

1. **APO hooks the endpoint the mirror plays into.** Where it is attached
   there, it applies that device's profile on the way out — so the Web Audio
   chain was applying the same correction a second time. A doubled correction
   is doubled in dB: a 6 dB dip becomes 12.
2. **Chromium's echo canceller was running on the loopback.** The capture asked
   for a bare `audio: true`, so voice processing applied. Echo cancellation
   subtracts what the machine is playing from what it hears, and a mirror plays
   the very audio being captured — so it chased its own output.

Both are fixed. The mirror applies **no EQ at all**, and the capture explicitly
asks for `autoGainControl`, `echoCancellation` and `noiseSuppression` off —
which also stops the live curve describing Chromium's idea of loudness rather
than the track's.

**What reaches a mirrored output is the primary device's correction**, baked
into the capture before FluidEQ sees it. Both outputs therefore sound the same,
and changing the primary's tuning changes every mirror with it. That was
accepted rather than fixed.

If it ever does need fixing, the answer is the **inverse** of the primary's
chain — for peaking and shelf filters, the same filter with the gain negated,
exact, from `getTFCoefficients` — and _not_ reapplying the target's. The
mistake worth not repeating is correcting twice.

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

## The wrinkle to solve first

**Two different identity namespaces have to be bridged.**

- Windows and APO identify an endpoint by **GUID**. `IAudioDevice` in
  `src/common/constants.ts` carries `id`, `name` and `guid`, and device profiles
  are keyed on the GUID. This is what `Device:` blocks are written against.
- Chromium's `setSinkId` needs a **`deviceId` from `enumerateDevices()`**, which
  is hashed per origin and shares nothing with the GUID.

The only bridge is the display name, which is neither guaranteed unique (two
things called "Speakers") nor stable (a user can rename one). Everything else
sits on top of this, so settle it before writing any audio code, and decide what
happens when the match is ambiguous — silently mirroring to the wrong speaker is
worse than refusing.

## Where the existing pieces are

| What                     | Where                                         |
| ------------------------ | --------------------------------------------- |
| System audio capture     | `src/renderer/graph/useLiveOutputSpectrum.ts` |
| Live audio provider      | `src/renderer/audio/LiveAudioContext.tsx`     |
| Device enumeration (IPC) | `ChannelEnum.GET_AUDIO_DEVICES`, `src/main/`  |
| Device shape             | `IAudioDevice` in `src/common/constants.ts`   |
| Per-device profiles      | `src/main/deviceProfiles.ts`                  |
| Config writing           | `src/main/flush.ts`, `src/common/apoSync.ts`  |

**Reuse the existing capture. Do not open a second one.** A previous session
spent a long time on a memory leak caused by `getDisplayMedia` — Windows only
offers loopback audio through the screen-sharing call, so a video track arrives
whether or not anything wants one, and it must be `stop()`ed rather than
disabled. See the 0.7.0 changelog entry, and `useLiveOutputSpectrum.ts`.

## Suggested order

1. Bridge the GUID <-> `deviceId` namespaces, and decide the ambiguous case.
2. Mirror one extra device, no EQ, so the plumbing is provable by ear.
3. ~~Per-mirror EQ sharing the band maths with the APO path.~~ Built, then
   removed — see the section above. The mirror applies no EQ.
4. Detect virtual devices and let each hold a profile.
5. One checkbox UI over both, which names which mechanism is in use and warns
   about latency only when the mirror is what is actually running.
