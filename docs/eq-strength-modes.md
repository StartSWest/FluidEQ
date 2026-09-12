# EQ strength modes

The EQ page has one dropdown with independent Your EQ and Curves groups.
Each offers Normal, Studio ×1.5, and ×2. Your EQ affects editable bands and
imported main-EQ curves. Curves affects headphone/driver correction, voicing,
Smart EQ, convolution, and EQ commands in custom files. Legacy presets without
a separate curve mode retain their previous global choice; editing either
group freezes the other group's current choice. Both choices are saved per profile. DSP, preamp and non-EQ custom commands are not multiplied.
The saved bands remain unchanged. The final-output curve shows the effective
processing, while the editing curve stays aligned with the band handles.

- **Normal:** the original single-pass EQ.
- **EQ ×2:** two identical passes, including cutoff/notch filters. This retains
  the original requested cascade sound rather than substituting doubled gains.
- **Studio:** one pass with 1.5 times the gain of bells and shelves. Bell Q becomes
  `Q * sqrt(1 + abs(originalGainDb) / 12)` only for legacy Studio presets.
  New strength changes preserve the separately selected Band Q behavior.
  Shelves retain their width; gainless filters retain their original response.
  Graphic curves have their dB values scaled once; there is no bell Q to alter.
  Effective gains are bounded to ±30 dB, from the existing ±20 dB input range.
  Convolution uses two FIR passes only in ×2. Studio uses the original IR plus
  a GraphicEQ correction containing half its measured dB response (or half the
  generated filter response). This strengthens its magnitude without repeating
  the room response; the correction adds its own linear-phase FIR latency.
  Imported IRs must have measured response data to receive the Studio correction. Custom files remain untouched; generated compensation commands adjust
  their EQ response without duplicating plugins or channel routing.

Studio is FluidEQ's original gain/width mapping, not a simulation or licensed
copy of a hardware unit. Gain scaling and gain/Q interaction are documented
professional EQ techniques, but there is no claim that this mapping sounds
better than the exact cascade. Compare at matched perceived loudness.

References:

- [FabFilter gain scaling](https://www.fabfilter.com/help/pro-q/using/output)
- [FabFilter gain/Q interaction](https://www.fabfilter.com/help/pro-q/using/bandcontrols)
- [API proportional-Q hardware](https://www.apiaudio.com/docs/manuals/5500_user_2024-01-17.pdf)

Automatic normalization accounts for the effective processing of both groups.
Manual preamp remains under user control; neither mode silently enables
normalization or adds a limiter. More EQ can clip with insufficient headroom.
Both Equalizer APO and the FluidEQ Engine consume the same rendered EQ commands.

## Independent shaping

Both groups offer Constant, Proportional and Asymmetric Band Q. Constant
preserves every original per-band Q as gain changes; it never forces a shared
Q or averages the bands. The redundant Band Q Off option is removed.
Proportional multiplies it by sqrt(1 + abs(gain)/12); Asymmetric uses that
factor for cuts and its reciprocal for boosts. The mapping is FluidEQ's,
not an exact hardware emulation. Q never changes shelves or cutoff filters.
Constant retains the `off` storage value for compatibility. Legacy `constant`
and `fixed` settings resolve to that same preserve-Q behavior in both groups.
The old fixed-Q override is no longer offered or accepted for new changes.
The original per-band Q and gain remain editable and unchanged in saved bands.

Curves additionally offers Off, 1/12-octave and 1/3-octave smoothing. This
integrates piecewise-linear dB response across a symmetric log-frequency
window, with constant endpoint extension. It is independent of sample density.
It smooths sampled graphic curves directly; parametric Curves retain their
bands and receive a generated correction for the difference between their
original and smoothed response. It never smooths the user's main EQ or DSP.
Imported and generated convolution responses receive a generated magnitude
correction after the original IR; custom files receive compensation without
being overwritten. Both operations change audio, not merely the graph.

The dropdown stays open for comparisons. A check identifies applied choices,
a spinner identifies the pending one. Buttons remain clickable; writes are
serialized and rapid clicks retain the newest queued choice per row. Hover never
replaces the selected accent. The compact trigger fits its text without
padding the Normal label to the width of a longer selection.
The closed trigger shows only Normal or Custom; per-group details stay inside.
Menu glyphs are 16px, with the selected check retained independently of hover.
