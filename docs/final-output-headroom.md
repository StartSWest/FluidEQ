# Final-output headroom and continuous curve edits

FluidEQ Engine 1.4 applies Auto normalize to the actual final audio samples,
after the DSP rack, convolution, graphic response, parametric bands and preamp.
It does not infer protection from the curve's largest theoretical boost.

The existing shared true-peak protector uses 4x detection and 2 ms lookahead,
linked across output channels. The internal target includes a 0.2 dB safety
margin below a -0.8 dB ceiling. It attenuates peaks, then releases toward unity;
it does not boost quiet passages or force a LUFS target. Recovery takes longer
under sustained limiting to avoid repeated volume dips between transients.
The DSP rack's loudness-normalization feature remains separate.

Engine-only comment directives keep the generated APO fallback intact. Equalizer
APO and older FluidEQ engines ignore these comments and keep the existing static
headroom. The native engine replaces only the generated automatic preamp with
unity, then protects the real output; later user-file preamp settings still apply.
Manual preamp remains manual. No audio-driver attachment changes are involved.

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
