# Music playback reference review — 2026-11-05

This review covers all 83 music presets, including the approved Pop and
K-pop references. These are FluidEQ playback choices. There is no official
international playback EQ curve or universal de-esser setting for a genre.
The original Pop and K-pop curve gains are retained.

## What changed

Library and Live now use the same foreground reference: the maximum complete
three-second K-weighted window on a fixed 100 ms grid. Integrated loudness
is measured separately. The working target is −18 LUFS, with a common
−48/+12 dB gain range and source-peak headroom. The 0.95 dB reserve keeps
the input protection stage out of its soft knee at the selected peak limit.
Peak-limited and gain-limited sources are reported as such, rather than
claimed to have reached an impossible target.

A Library file is measured before choosing constant source gain. Old cached
measurements are refreshed lazily without resetting the Library index.
Unchanged files retain their separately measured noise profiles. Completing
a scan transfers the playing song's filter histories and glides to its new
gain, including the old-to-new source-fact protocol transition.

Live must learn unknown audio as it arrives. A newly identified recording
learns independently of its predecessor and can establish its own level
after 20 foreground seconds. A named song retains quiet movements and pauses;
an unnamed long stream slowly adapts after eight minutes. A genuine anonymous
silence boundary clears the previous source's peak interpolation history.
Ordinary Live deadband and causal learning mean this is a common policy,
not a claim of sample-identical playback or immediate whole-file knowledge.

Nine high-frequency Exciter bands that generated measurable aliasing at
Off oversampling were disabled. Organic and Exciter input filters now reject
distant frequencies more strongly while preserving their intended centre
gain. Wanted second/third harmonics are tested against an independent
render from checkpoint 130b69ff7; dry controls prevent a silent or muted
generator from passing. Oversampling remains a user choice.

Piano, Strings and Ambient preserve their natural low-frequency stereo
content instead of inheriting an unsupported blanket bass-mono assumption.
Bossa Nova's 125 Hz boost was reduced by 0.6 dB after both normalized
references exposed source-dependent bass gain. Other curve changes from
the earlier review remain in the restoring checkpoint.

Vocal presets retain gentle, centre-only spectral de-essing from 5–10 kHz,
capped at 1.5 dB with cymbal protection. Instrumental presets leave it off
where appropriate. Every enabled colour stage and the genre curve are
rendered both on and off for each recording. De-essing must change integrated
loudness by no more than 0.15 LU.

Master and Dynamics remain off in every music factory preset. One final
Maximizer supplies fixed makeup and a −1 dBTP ceiling. The original
per-genre limiting, crest and phrase-contrast budgets from 130b69ff7 are
pinned in music-reference-policy.json, rather than relaxed to fit new output.
Shared native colour-filter improvements also affect manually configured
and gaming consumers of those processors; game preset values were not retuned.

## Evidence and limits

music-reference-audit.json records both named recordings, public catalogue
links, available performance/edition metadata, exact media/decoded hashes,
source and measured normalized-input facts, final measurements, stage-bypass
effects, all factory settings, the exact tone filter design, native host and
meter hashes, and the complete processing-source fingerprint.

The reference set combines public Apple excerpts with the previously
supplied complete Blinding Lights recording. Catalogue links identify
recordings; they do not establish that a local encoded edition matches
the store's current master. Classical suggestions name works; retained
performance and movement metadata identify what was actually measured.
Excerpt measurements do not establish whole-track loudness or a genre's
universal sound.

Renders use an isolated native offline host and floating-point waveforms.
They consult no headphone curve, user correction, live application setting,
system volume or output device. The factory genre curve uses its real
frequency/Q/model design and is applied exactly once in the playback routing.
Known native latency is queried independently, flushed, and trimmed to
source time before comparing fixed-grid windows. Untrimmed output true
peaks are checked too.

An input-only readback checks every stereo sample against the independently
predicted constant gain, with gain error below 0.0001 dB and residual below
−100 dB. Alignment must be zero after latency trimming. Known wrong-gain
and single-sample corruptions fail the native positive/negative controls.

Raw integrated and foreground spreads are reported separately. A peak-heavy
recording may remain quieter to preserve its transients. The consistency
gate instead also compares each chain's additional gain after subtracting
the independently measured input level; both I and S residual spreads must
stay within 1.5 LU. When both sources reach the input target without
constraint, their output foreground spread must also stay within 1.5 LU.
This never asserts that all tracks reach the same whole-song LUFS.

Strength is checked separately from safety. The audit reports the strongest
reference's miss from the nominal integrated aim. A miss over 1.5 LU is
conditional on both references being input constrained and is labelled
peak-constrained-references. Every preset must also pass a public
deterministic low-crest control: 32 harmonics from 125 Hz to 4 kHz with equal
octave energy and Schroeder phases. Its measured P−maxS is about 4.91 dB,
so it reaches −18 maxS without input constraint even at a −12 dBTP limit.
Its integrated and foreground outputs must exceed the genre aim minus
1.5 LU while respecting the same peak, limiting and contrast budgets.
Neither a quiet output nor heavy compression can satisfy that gate alone.

Phrase contrast is the 95th-to-10th percentile span of 400 ms RMS blocks,
not EBU Loudness Range. Crest loss compares the same processed waveform
before and after the Maximizer. The alias ceiling is an engineering
regression limit, not a guarantee of inaudibility for every stimulus.
Measurements do not replace listening. Floating-point DSP changes samples;
avoiding lossy re-encoding does not make processed playback bit-perfect.

## Reproducing and preventing stale evidence

- pnpm test:music builds native tests and renders every factory music chain
  on dense/sparse, gain-scaled, low-crest and hot Live stimuli. It sweeps
  colour generators at 44.1/48 kHz over multiple frequencies/levels and folded
  harmonics, and executes source, handover, ownership and status contracts.
  CI runs this gate on every push.
- review-music-references.ts accepts explicit --engine, --meter, --manifest
  and --output paths. The private manifest supplies two source files,
  named references and exact excerpt lengths for each genre. A final run
  uses neither --calibrate nor --resume-calibration.
- Calibration produces parameter plans only. It cannot promote reused
  measurements into final evidence. Final verification always decodes and
  renders every source afresh, checks immutable inputs before/after, and
  refuses a complete audit if any required genre fails.
- Unit contracts match current source/configuration fingerprints and the
  committed native fixture to the audit. Editing measured JSON alone
  cannot validate changed DSP. Copyrighted audio, private paths and detailed
  calibration attempts remain outside git.

## Primary engineering sources

- [ITU-R BS.1770-5](https://www.itu.int/rec/R-REC-BS.1770-5-202311-I/en):
  programme-loudness and true-peak measurement.
- [EBU Tech 3341](https://tech.ebu.ch/publications/tech3341):
  short-term and integrated metering. Using maximum S as the shared input
  policy is FluidEQ's choice, not a prescribed genre mastering target.
- [FabFilter Pro-DS advanced controls](https://www.fabfilter.com/help/pro-ds/using/advancedcontrols):
  frequency-selective and mid-only processing for full mixes.
- [FabFilter Pro-L workflow](https://www.fabfilter.com/help/pro-l/using/recommendedworkflow):
  level-matched comparisons and checking the audible cost of limiting.
