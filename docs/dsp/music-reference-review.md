# Music preset reference review — 2026-11-04

This checkpoint reviews the 81 remaining music presets after the approved
Pop and K-pop tuning at `418d6c477`. It leaves those two audible configurations
and every game preset intact.

These are reference-guided playback profiles. An official international
playback EQ curve or a universal de-esser threshold for each genre does not
exist in the cited engineering guidance. The settings are FluidEQ choices,
not mastering standards. Finished recordings already contain their own
spectral balance, processing and artistic dynamics.

## Evidence and isolation

`music-reference-audit.json` identifies both suggested recordings for every
reviewed genre, the actual performers and movements, Apple recording IDs,
public source links, preview durations, media hashes, input and output
measurements, exact curves and processor settings. Copyrighted audio and
local Library paths are excluded from git.

Measurements use original-artist public Apple previews, generally 30 seconds,
decoded to stereo floating-point audio at 48 kHz. Classical suggestions name
works rather than exact performances; the audit names the actual performance
and movement. Stravinsky's Dance of the Earth is used for orchestral calibration;
the very quiet opening bassoon solo is not treated as the work's typical level.
These are excerpt measurements, not whole-track LUFS or representative samples
of every recording in a genre.

The native host was built separately from the committed native source at
`418d6c477c7bf97c20f0971532a92eb67d258483`; its executable hash is recorded in
the audit. Uncommitted native engine work was excluded. Renders use immutable
factory settings and the genre's own curve, without headphone correction,
user curves, system volume, live app state, or an opened output device.
The main EQ curve is represented in the limiter's detector and applied once
after the rack, matching the app's routing.

## Processing decisions

Input normalization applies constant source gain before the rack. Targets
reserve reference peak headroom and stay inside the normalizer's supported
range. They are working levels, not output loudness targets. Very quiet or
unusually high-crest material can still meet the normalizer's gain or peak
limit; normalization cannot promise identical perceived loudness for every
possible source.

Curves retain their existing contour where the references support it.
Excessive low-mid scoops and presence boosts were restrained using the
actual filter response and level-matched reference spectra. When a curve
changed the two normalized references' levels too differently, its strength
was reduced and both were rendered again. This avoids using extra limiting
to conceal a tonal imbalance.

Vocal genres use light, centre-only spectral de-essing from 5–10 kHz, capped
at 1.5 dB with cymbal protection. Instrumental styles leave it off. Each active
colour stage was bypass-rendered on both references; de-essing was required
to change integrated loudness by no more than 0.15 LU. Added vocal
decorrelation is disabled outside the atmospheric styles. Existing bass
generation and transient stages remain off where only offered.

One final Maximizer follows the creative stages. Master and Dynamics stay off.
The final ceiling is −1 dBTP. Drive was calibrated from the two references,
then restrained when additional gain cost too much limiting, crest contrast
or phrase contrast. The audit records the actual outputs as well as the
initial listening-level aim. A sparse, high-crest recording can prevent that
aim being reached cleanly; drive is not increased merely to hit a number.

The contrast measurement is the 95th-to-10th percentile range of 400 ms block
RMS levels. It is **not** EBU Loudness Range. Crest loss compares the same
processed signal immediately before and after the Maximizer. Neither metric
is a guarantee of subjective sound quality. DSP changes samples; floating-point
processing without lossy re-encoding does not make it bit-perfect.

## Engineering sources

- [iZotope: How to EQ your master](https://www.izotope.com/community/blog/how-to-eq-your-master):
  subtle finished-mix changes and reference comparison.
- [iZotope: Mastering from start to finish](https://www.izotope.com/community/blog/how-to-master-a-song-from-start-to-finish):
  genre-dependent loudness and the cost of limiting.
- [iZotope: De-essing a master](https://www.izotope.com/community/blog/de-essing-a-master-tools-tips-and-tricks):
  selective processing and protecting the rest of a finished mix.
- [FabFilter: Limiter workflow](https://www.fabfilter.com/help/pro-l/using/recommendedworkflow):
  level-matched comparisons and listening for lost dynamics.

## Regression checks

The reference audit contract holds current factory settings to the rendered
settings, checks source-gain invariance, supported input headroom, reference
coverage, final true peaks, loudness spread and measured dynamics bounds.
Existing curve-split, genre-note, localization, stage-catalogue and Pop/K-pop
isolation checks remain applicable. Re-tuning a measured setting requires a
new render and audit update; editing recorded numbers alone is not verification.
