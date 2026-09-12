# Final-output headroom and continuous curve edits

FluidEQ Engine 1.4.1 applies Auto normalize to the actual final audio samples,
after the DSP rack, convolution, graphic response, parametric bands and preamp.
It does not infer protection from the curve's largest theoretical boost.

The true-peak protector uses 4x detection and 2 ms lookahead, linked across output
channels, with a -1 dB ceiling. Two controllers share ONE gain multiplication:
the fast lookahead envelope catches exceptional peaks; a retained programme gain
stops that envelope repeatedly rising and falling between musical beats. This is
not another creative compressor, EQ, loudness target or rack normalizer.

Programme peaks are measured in 100 ms audio windows. Two overload windows within
one second establish a retained gain; an isolated peak uses only the fast stage
(50 ms hold, 150 ms exponential recovery). A retained gain rises at most 0.1 dB/s,
only after five seconds of continuous active audio with at least 1 dB of spare
headroom. Silence below -65 dBFS resets that recovery evidence, not the learned
gain. The fast stage can always reduce further when an unexpectedly larger peak
arrives. Recovery cannot boost beyond unity. All timing is counted from audio
samples, independent of callback size, renderer visibility or configuration writes.

Actual EQ/curve edits trigger a new evaluation rather than waiting for the
long recovery. The graph compares real biquad coefficients and interned curve/IR
kernels, not file timestamps: writing the same settings again is not an edit.
After the previous pipeline latency and 50 ms crossfade have passed, two seconds
of active new output establish a fresh peak reserve. The existing fast envelope
releases excess attenuation at a controlled 1 dB/s, rather than jumping to the
new level while a band is being tuned, and still catches peaks throughout. Silence
does not reset the gain. DSP-only edits do not trigger this EQ-specific reevaluation.

Both controllers constrain the same gain rather than multiplying two reductions.
This prevents the slow stage adding another dip while the fast stage is already
protecting a peak. Safe audio is unchanged apart from its fixed delay; continuous
heavy boosts must lower the overall level. No limiter can promise inaudible
handling of unlimited overload. DSP rack settings and their gain laws are unchanged.

Engine-only comment directives keep the generated APO fallback intact. Equalizer
APO and older FluidEQ engines ignore these comments and keep static headroom.
The native engine replaces only the generated automatic preamp with
unity, then protects the real output; later user-file preamp settings still apply.
Manual preamp remains manual. No audio-driver attachment changes are involved.
Under Fluid, the saved manual preamp is separate from live automatic attenuation:
the graph and main-process automatic flush no longer overwrite it with a curve
estimate. Turning Auto off never reapplies an old calculated response. A late
disable reply cannot overwrite a manual reset, and overlapping toggles are blocked
until the current operation replies. While Fluid telemetry is unavailable the
automatic readout starts at zero, not at an unrelated manual/theoretical value.

## Equalizer APO fallback

APO keeps the conservative response-based reserve; a spectrum estimate no longer
moves that reserve throughout a song. An audio-worklet tap measures each channel's
actual output peak in 100 ms windows, even when the UI is hidden. Its output is
muted and cannot play the loopback back into itself. This tap measures only: it
does not insert a second audible processing chain.

Near-full-scale output can request extra attenuation in steps no larger than
0.5 dB, at most once every two seconds. Recovery needs ten seconds of continuously
active audio below -3 dBFS, advances at 0.05 dB/s, and writes at most once every
15 seconds with a 0.25 dB deadband. Silence never requests recovery. One correlated
write acknowledgment must complete before another request; engine switching or
Auto off rejects late reports. Measurements do not save device profiles.
Windows captured before the last acknowledgment are discarded by their audio
timestamps, so queued messages after a UI stall cannot cause a burst of file writes.
An actual EQ/curve edit allows an earlier 0.5 dB recovery step when the newly
measured output permits it; it still obeys the two-second file-write floor.

The acknowledgment confirms the file write, not the instant APO reloads it.
Loopback is downstream and cannot undo already-clipped samples or reliably see
clipping masked by Windows volume/limiting. This is deliberately NOT equivalent
to Fluid's in-engine lookahead protection. When capture fails, static reserve and
the last written extra attenuation remain; it never compensates by boosting.

## Design references

- [Sonnox Oxford Limiter: general gain management](https://dload.sonnoxplugins.com/pub/plugins/UserGuides/Oxford_Limiter_User_Guide.html)
- [FabFilter Pro-L 2: lookahead and release](https://www.fabfilter.com/help/pro-l/using/advancedsettings)

These motivate separating long-term gain from transient protection, not copied
algorithms or standard-mandated time constants. The chosen times are FluidEQ's.

The sidebar and response graph read real gain reduction from the endpoint, even
with the DSP rack off. A capability byte in the existing pipe handshake prevents
unsupported requests to older engines. The display uses animation-frame demand;
protection continues in the native audio callback when the window is hidden.

Curve edits reuse the previous convolver's input history and queued output and
crossfade responses over 50 ms. No rack is run twice. Outputs with curve processing
keep a unity graphic stage when smoothing is Off, so switching smoothing does not
change latency. At 48 kHz that stage adds 2560 samples (about 53 ms); final-output
protection adds another 96 samples (2 ms). Main parametric EQ alone needs no graphic
stage. Off preserves the source curve's response, not zero processing latency.

Regression checks compare a deliberately cold convolver against a continuous
handover, test multiple callback sizes and both channels, and verify real final
peaks stay bounded while an otherwise identical unprotected graph exceeds unity.
