# Master: a loudness target that arrives, and a picture of it

2026-08-30. Approved in chat before implementation.

## What is wrong today

**The LUFS target is arithmetically dead.** `masterLoudnessGainDb` in
`src/renderer/dsp/inputNormalizer.ts` caps positive makeup at

    peakRoom = master.ceilingDb - normalizedTruePeak - max(0, outputTrimDb)

Under the shipped defaults — Normalizer in True Peak mode at -1 dBTP, Master
ceiling at -1 dBTP — every track leaves the normalizer peaking at exactly
-1 dBTP, so `peakRoom` is exactly 0.0 and the applied gain is exactly 0.0 dB
for every commercially mastered record ever made. On quiet material the clamp
bites differently: a -20 LUFS record asking for +11 dB receives +5 because its
peaks happen to sit lower. The stage therefore delivers a _different_ gain to
every track and reaches its target on none of them, which is precisely the
complaint — the loudness still moves between tracks.

The irony is that the chain already contains the limiter that makes the gain
safe. `chain_process` runs Auto Headroom — a look-ahead, true-peak, soft-knee
limiter — immediately before the master output gain, **only** when LUFS
maximize is on, and it already reserves the following gain so it holds the
final output to the ceiling. The gain law refuses to use it.

**Nothing on the page shows loudness.** `DspMasterGraph` is a log-frequency
spectrum with two flat gain lines. The only LUFS on screen are the number the
user dialled and a chip reading `+0.0 dB`. The app has no live BS.1770 meter at
all: the only measurement is offline, per file, and cached.

## The design

### 1. The gain law delivers the target

`masterLoudnessGainDb` gains a companion `masterLoudnessBreakdown`, in the same
shape and for the same reason as `normalizerGainBreakdown` — one function
answers both "what gain" and "which control won", so the readout cannot
disagree with the audio.

    requested = target - normalizedLufs
    if requested <= 0: attenuate, as today
    applied = min(MAX_GAIN, requested, peakRoom + peakLimitingDb)

`peakLimitingDb` is a new dial: how much gain reduction the target is allowed
to buy from Auto Headroom. At 0 it reproduces today's peak-safe behaviour
exactly, so the old character remains reachable as a setting rather than as an
invisible law. Default 6 dB.

### 2. A live loudness meter in the engine

New `FeqLoudnessMeter`, beside the offline `FeqLoudnessAnalyzer` and sharing
its K-weighting derivation. Reports momentary (400 ms), short term (3 s),
integrated (gated) and loudness range.

Real-time safe: energy is accumulated per 100 ms sub-block into a fixed ring;
momentary is the mean of the last 4 sub-blocks and short term the mean of the
last 30, so no seconds-long sample buffer is ever allocated. Integrated and LRA
come from two fixed histograms of block loudness — count and energy sum per
0.1 LU bin — which makes memory constant however long the session runs and
keeps the gated mean exact rather than reconstructed from bin centres.

No true peak here: the safety stage already measures the final output's true
peak and the meter would be paying for a second oversampling FIR to learn the
same number.

Tapped at the master capture point, after safety, because that is the one tap
that is what leaves for the device.

### 3. The Master graph becomes a mastering meter

The frequency axis goes. A limiter and a loudness target have no opinion about
frequency, and the master spectrum is very nearly the picture the EQ page
already draws — the same argument `DspMaximizerGraph` makes for itself.

The axis that means something is time: a 30 s window with the target as a fixed
horizontal line, momentary as a fill, short term as the line riding the target,
integrated as a held line, the gain reduction band drawn down from the top and
true-peak ticks along the ceiling. Chips read M, S, I, LRA, TP max and PLR.

### 4. What else makes it a master

- **Target presets** — streaming, quiet streaming, broadcast R128, club,
  reference — each setting target, ceiling and peak limiting together, in the
  profile idiom the Dimension, Exciter and Maximizer pages already use.
- **Matched listen** — the master output subtracts the makeup it just applied,
  so the limiting is identical and the level is not. Without it an A/B is
  decided by whichever side is louder, which is the oldest way to be wrong
  about a master.
- **The Release dial** — `master.releaseMs` has been a setting, a wire
  parameter and an i18n string since the stage shipped, and has never had a
  control. It is the difference between limiting you hear and limiting you do
  not, and it matters far more once the target actually engages the limiter.
- **Queue pre-analysis** — an uncached track starts at unity and ramps to its
  gain over two seconds when the analysis lands, which is an audible move at
  the top of a song. Measuring the next track while the current one plays
  removes it.
- **Program-dependent release on Auto Headroom** — a fast release for isolated
  peaks and a slow one for sustained reduction, so deep limiting does not pump.

## Testing

After the change is confirmed by ear: parity fixtures for the new gain law and
the wire lead, native unit tests for the meter against BS.1770 test signals
(a 1 kHz sine at -23 dBFS must read -23 LUFS), and the existing suites.
