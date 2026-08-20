# Smart Auto-Normalize — implementation brief

Paste this whole file as the opening message of a fresh chat. It carries
everything that was established by measurement in the session it came from, so
none of it has to be rediscovered.

---

## What to build

An adaptive replacement for FluidEQ's auto-normalize that recovers the headroom
the current one reserves and never uses, without ever letting the output clip.

**Today** (`getAutoPreAmpGain` in `src/common/response.ts`):

```
preamp = −( max_f [ chain_gain(f) ] + AUTO_PREAMP_HEADROOM_DB )
```

That is a worst case: it assumes the programme has full-scale energy at the
exact frequency where the chain peaks. Real music never does. A chain that
boosts 6 dB at 10 kHz reserves 6 dB, while the music at 10 kHz is typically
30–40 dB below full scale — so most of that reservation is wasted volume.

**Target:**

```
preamp = −( max_f [ programme_level(f) + chain_gain(f) ] + margin )
```

Both terms real: `programme_level(f)` measured from the audio, `chain_gain(f)`
computed from the config FluidEQ itself writes. Expected recovery is often
10 dB or more on treble-boosting chains.

---

## Established facts — measured, do not re-derive

These were settled experimentally. Each cost real time to establish.

### 1. The loopback capture IS post-APO

**Confirmed by tone test.** With the music paused, a 1 kHz sine played at
−26.02 dBFS came back at −32.37 dBFS — attenuated by 6.35 dB, consistent with
the `Preamp: -9.5 dB` in the active device config. If the capture were pre-APO
it would have returned at exactly −26.02.

**Consequence for this feature:** what the analyser measures already has the
chain applied. To recover the programme's own spectrum you must SUBTRACT the
chain gain from the measurement:

```
programme_level(f) = measured_level(f) − chain_gain(f)
```

Get this backwards and the loop runs away.

### 2. The output can never be measured clipping

Equalizer APO's own documentation states that since Vista the Windows audio
engine will not let audio clip — it runs a **Limiter APO** that lowers the
overall volume instead of letting the signal rail.

**Measured confirmation:** at +20 dB of preamp with the audio audibly breaking
up, **not one sample in 143,360 reached full scale**, and the peak sat between
−0.1 and −1 dBFS.

**Consequences:**

- Never validate this feature by waiting for a clipped sample. It will not come.
- Any threshold placed at or above 0 dBFS on the capture is unreachable.
- The audible distortion IS the limiter working. Preventing the limiter from
  ever engaging is the actual goal.

Sources:

- [Equalizer APO documentation](https://sourceforge.net/p/equalizerapo/wiki/Documentation/)
- [Loopback Recording — Microsoft](https://learn.microsoft.com/en-us/windows/win32/coreaudio/loopback-recording)

### 3. The chain peak is already computed correctly

`getCombinedResponsePeakGain` (`src/common/response.ts`) sums every layer's
gain **at each frequency** on a 1000-point log grid, then takes the maximum —
it does not add per-layer maxima, so it never reserves headroom for boosts that
do not coincide. It returns a negative peak for a cut-only chain. Reuse it; do
not write a second one.

---

## Where the pieces already are

| Piece                                     | Location                                                 |
| ----------------------------------------- | -------------------------------------------------------- |
| Chain peak gain                           | `getCombinedResponsePeakGain` — `src/common/response.ts` |
| Current auto-preamp                       | `getAutoPreAmpGain` — same file                          |
| Headroom margin                           | `AUTO_PREAMP_HEADROOM_DB = 0.2` — same file              |
| Per-region level accumulation over time   | `src/renderer/utils/autoBalanceCapture.ts`               |
| Live spectrum + per-channel levels        | `src/renderer/graph/useLiveOutputSpectrum.ts`            |
| Where the chain is assembled for the peak | `buildChartData.ts`, the `getAutoPreAmpGain` call        |

`autoBalanceCapture` is Smart EQ's machinery. It already accumulates level per
frequency region across a listening session with hold — the same measurement
this feature needs, asked a different question. Reuse it rather than building a
parallel accumulator.

---

## Design constraints — each earned

1. **Long-term maximum, never instantaneous.** Adapting to the passage playing
   now means the chorus clips after a quiet intro. Accumulate with hold, the way
   Smart EQ does.

2. **Asymmetric response.** Lower the preamp fast, raise it slowly. Being wrong
   downward costs a little volume; being wrong upward costs distortion.

3. **Do not thrash the APO config.** Changing the preamp rewrites the config
   file. A continuous adjustment would hammer it. Recompute on a slow cadence,
   or surface it as a suggestion the user accepts once.

4. **Determinism is being traded away — be explicit about it.** Today the same
   chain always produces the same preamp. After this it depends on what was
   playing, so two users with identical EQs get different preamps. Decide
   deliberately whether that is acceptable, and if it is, make the UI say the
   value is adaptive.

5. **Never regress safety.** Whatever the measurement says, the result must
   still guarantee the output stays under full scale. The measured programme
   level is evidence about what HAS played, not a promise about what comes next
   — keep a margin for material louder than anything measured so far.

---

## Suggested shape

- Accumulate per-region programme level (measured minus chain gain) with a slow
  decay, across the session.
- Compute `max_f [ programme_level(f) + chain_gain(f) ]` on the same grid the
  chain peak already uses.
- Offer the recovered headroom either as an automatic slow adjustment or as a
  one-shot suggestion — decide with the user before building.
- Keep the existing worst-case calculation as the floor: never go above what
  the current auto-normalize would allow plus the measured recovery.

---

## Verification

- **A null test needs a positive control.** A silent room and a correct
  implementation both produce "no change available"; prove the measurement
  moves before trusting that it did not.
- **Do not use music for A/B measurements.** The programme level changes between
  readings, so any difference is unattributable. Use a steady tone, and pause
  other audio — this wasted a lot of time in the originating session.
- Verify in a real window. DevTools is on `127.0.0.1:9222` in dev; the DOM,
  computed styles and canvas pixels can all be probed there.
