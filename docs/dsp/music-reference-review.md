# Factory DSP at the original source level

All 118 factory racks take their input at the recording's original level.
This includes 83 music genres and 35 standard, voice, repair, Room and Gaming
racks. Factory selection switches the Normalizer and adaptive Master off.
Reference, Speech, Podcast and Audiobook use a fixed Maximizer profile.
The None rack passes the input through. The manual Normalizer and Master
controls remain available for saved and manually edited racks.

## Gain and peak protection

The source starts playing immediately. Library analysis and the Live
Normalizer's learned level cannot boost new audio after a switch to a fixed
rack. This also applies to the outgoing rack while the system graph crosses
between two different latencies. Existing delay histories and the output
peak protection stay in the signal path. A continuous signal gets a short
gain ramp across callbacks, even when a callback is one sample. The
input peak already in the callback limits the old gain immediately on a
strong onset.

Drive is a signed fixed gain before the Maximizer. Negative drive reserves
headroom before limiting. The appropriate amount depends on the peaks
created by each curve and its active stages. Every genre uses its own drive
and release. Its established look-ahead bounds the attack and latency.
Genre peaks are held at or below the nominal −1 dBTP ceiling. Techno and
Bollywood reserve an extra 0.1 dB for measured reconstructed peaks on a hot
opening. Audiobook, Late Night and Game Night keep their lower peak ceilings.

The review uses each genre's existing tonal curve and named references.
The creative stages receive the unscaled source. The Pop and K-pop
references retain their approved curves and use restrained spectral
de-essing. The full rack renders each reference again with every active
colour stage individually bypassed, including the genre curve. Voice,
general, Room and Gaming renders report their own stage effects.

Quiet passages and quieter recordings keep their relative levels. A source
master with reconstructed peaks above full scale can measure louder than
the processed result. The audit shows both the untouched source and a
constant-gain dry reference set to the same true-peak ceiling. That second
reference separates headroom from the gain reduction and crest changes
caused by the Maximizer.

Select the factory preset again to apply the new settings to an older saved
selection. In Gaming Lab, **Reset to Profile** applies the current factory
rack to an existing game copy. Saved settings are treated as the user's
sound until a factory preset is applied.

## Measurements and validation

- [Music reference audit](music-reference-audit.json) records both named
  recordings for each genre, exact media and decoded hashes, original
  and processed levels, limiter loss, crest, phrase contrast and source-time
  alignment. Reference excerpts identify the recording or performance
  and measure only the supplied edition and interval.
- [Other factory racks](factory-rack-audit.json) records actual system-graph
  renders of the remaining 35 racks. The set includes recorded music,
  deterministic spoken-word controls and Gaming scenes with dialogue,
  ambience, steps, explosions and score changes. Room uses the bundled
  medium head. These voice checks establish behaviour on the control
  material. They do not establish the sound of a particular podcast or
  audiobook narrator.
- Twelve non-genre racks needed a second gain and release pass. On the hot
  music control, this reduced limiter loss from 2.66 to 1.13 LU for Music
  Room, 2.41 to 1.22 LU for Car, and 2.07 to 1.21 LU for Laptop. Their
  delivered level changed by 0.46, 0.06 and 0.38 LU respectively. Music
  Room's quieter jazz control plays 2 LU lower after this adjustment.
  The general limiter-loss budget is 1.25 LU. Late Night and Game Night
  use a 1.6 LU budget with their lower ceiling.
- The native music fixture measures dry dense and sparse material, an
  independent low-crest control and a hot unanalysed Live input. It
  compares a quiet-to-loud transition with the same loud onset after
  silence, over the first callback, 100 ms and one second. Those onset
  windows report RMS differences. The original tests for generator
  aliasing, wanted harmonics and wrong-gain input controls run alongside
  the new level checks.
- Programme and true-peak measurements use the BS.1770 method. Foreground
  is the maximum complete three-second short-term window. Phrase contrast
  is the 95th-to-10th percentile span of 400 ms RMS windows. The comparator
  applies only the fixed drive to the pre-limiter waveform so the phrase
  gate sees the same reference level on both sides. Original per-genre
  limiting, crest and phrase budgets are pinned in
  [music-reference-policy.json](music-reference-policy.json).
  [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en)
  · [EBU Tech 3341](https://tech.ebu.ch/publications/tech3341)

Genre renders use the native Library host and feed the exact factory curve
once. The input-only pass must match the original floating-point waveform
below −100 dB residual after latency compensation. The raw and aligned
outputs both pass the peak check. The desktop renderer, headphone
correction and output devices are absent from these renders. The system
graph separately exercises unanalysed audio, actual Room processing and
Game Mode. Matched-level spectrum and dynamics are checked against the
approved Pop and K-pop control renders. Listening remains a separate
check of preference.

At 48 kHz, the candidate and its base report identical delay for all 118
factory racks in Library and Live, and for 15 complete Gaming and Room
graphs. Standard Gaming is 48 samples. Game Night retains its 645-sample
dynamics path.

The tests use transparent limiting and selective de-essing practices as
engineering references. Genre voicings and release times are FluidEQ
playback choices measured on those recordings.
[FabFilter limiter timing](https://www.fabfilter.com/help/pro-l/using/advancedsettings)
· [FabFilter spectral de-essing](https://www.fabfilter.com/help/pro-ds/using/advancedcontrols)

## Reproduce

- Run `pnpm test:music` for the native music, opening, host, state handover,
  restoration, timing and Gaming cue contracts.
- Run `review-music-references.ts` with `--engine`, `--meter`, `--manifest`
  and `--output`. The private manifest names two exact original recordings
  per genre and their excerpt positions. `--only` is for a partial run.
- Run `review-factory-racks.ts` with `--graph`, `--meter`, `--manifest`
  and `--output`. Supply 48 kHz stereo float WAVs grouped as music, speech,
  gaming, cinema and repair. The graph renderer can export the two Gaming
  controls with `--sources`.
- Both audits record the native binaries, source definitions and exact
  encoded configuration. Source and binary hashes are checked again at the
  end of each run. The unit contracts tie the results to the current
  processing sources and CI fixture. Source recordings, listening WAVs and
  private paths stay outside Git.
