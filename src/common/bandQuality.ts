/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What Q a band starts at, and why it depends on how many bands there are.
 *
 * A band's Q is its width, and the width that is right for it is the distance
 * to the band beside it. Thirty-one bands a third of an octave apart want
 * narrow filters or every one of them is playing the same note as its
 * neighbours; six bands an octave and a half apart want wide ones or there
 * are holes between them that nothing can reach. One number for all of them
 * is wrong at both ends, and was: every layout in the main equaliser was
 * built at Q 2 whatever its size, so the thirty-one-band layout stacked three
 * bands on every frequency and the six-band left gaps.
 *
 * The relation is the standard one for a graphic equaliser,
 * Q = 1 / (2^(n/2) - 2^(-n/2)) for bands n octaves apart, which puts the
 * skirts of neighbouring bands at their crossing point. It answers 4.3 for a
 * third-octave rack, 2.1 for a two-thirds-octave one (the fifteen-band), 1.4
 * for an octave rack and 0.9 for the six-band — and the fifteen-band answer
 * is the 2 the app had been using everywhere, which is why that one size
 * always felt right and the others did not.
 *
 * Both equalisers derive their starting Q from this, including the band added
 * by hand: an added band that arrives at a Q the rack does not use is a band
 * that sounds unlike every other one on the page.
 */

/**
 * What a band this width can still be used as.
 *
 * The relation has no floor of its own, and a rack does not have to be a
 * shipped one: two bands left at 20 Hz and 20 kHz are ten octaves apart, and
 * the honest answer for them is a filter so wide it tilts the whole spectrum,
 * which is not a band anybody added on purpose. The widest rack this app
 * ships is the six-band at 0.35 and the narrowest a sixty-four-band import at
 * about 4.5, so both ends here are outside every real layout and bite only on
 * the degenerate ones. 0.5 was the floor until the skirt rule below doubled
 * every band's width, and it then clipped the six-band — a limit that catches
 * a shipped layout is a limit in the wrong place.
 */
const WIDEST = 0.25;
const NARROWEST = 12;

/** Q for bands sitting `octaves` apart, to two places. */
export const qualityForSpacing = (octaves: number): number => {
  if (!Number.isFinite(octaves) || octaves <= 0) {
    return DEFAULT_BAND_QUALITY;
  }
  const spacing = 2 ** (octaves / 2) - 2 ** (-octaves / 2);
  const quality = Math.min(NARROWEST, Math.max(WIDEST, 1 / spacing));
  return Math.round(quality * 100) / 100;
};

/**
 * The two-thirds-octave answer, and the app's fallback.
 *
 * Used where there is no rack to measure — a single band with nothing beside
 * it, a value that failed to parse — because a fifteen-band layout is what
 * this app opens with and what its factory curves are written against.
 */
export const DEFAULT_BAND_QUALITY = 2;

/**
 * The Q a rack of these centres wants, from its own average spacing.
 *
 * Geometric, so it does not matter whether the caller hands them in order or
 * whether the rack is evenly spaced: what is measured is the whole span
 * divided by the number of gaps, which is what "how far apart are these"
 * means on a log axis.
 *
 * For a rack whose spacing is the same all the way along — every layout here
 * but the twenty — this and `qualitiesForRack` give the same answer.
 */
export const qualityForRack = (frequencies: readonly number[]): number => {
  const usable = frequencies.filter(
    (frequency) => Number.isFinite(frequency) && frequency > 0,
  );
  if (usable.length < 2) {
    return DEFAULT_BAND_QUALITY;
  }
  const lowest = Math.min(...usable);
  const highest = Math.max(...usable);
  if (highest <= lowest) {
    return DEFAULT_BAND_QUALITY;
  }
  return qualityForSpacing(Math.log2(highest / lowest) / (usable.length - 1));
};

/**
 * How far past its neighbour a swept rack's skirts have to reach.
 *
 * The textbook rule above puts a band's half-power points on the centres of
 * the bands either side, and it is the right rule for filters summed in
 * PARALLEL, where their powers add. These are cascaded, so their decibels add
 * — and at a band's own centre you then get that band plus half of each
 * neighbour, while between two centres you get half of each and nothing else.
 * The curve comes out scalloped. Measured on the twenty-band rack, the tone
 * controls' Treble at +16 landed 2.8 dB from what the dial said, peaking at
 * every centre and dipping between them; neither more measuring points nor a
 * smoother fit moved it, because it is what that width can do rather than
 * what the fit chose.
 *
 * At twice the spacing the skirts reach the neighbour's neighbour, the gaps
 * fill, and the same measurement falls to about 1 dB on the fifteen, the
 * twenty and the thirty-one alike — which a sweep confirms is as flat as any
 * width gets, the bottom of the curve sitting at 0.6 of the textbook Q and
 * this rule landing at 0.5.
 *
 * It applies where a rack is SWEPT — the main equaliser, whose bands are
 * dragged and whose three tone dials move a dozen of them at once — and
 * deliberately not to the DSP rack, which takes `qualityForRack` above. That
 * rack's factory curves are fifteen written gains, measured and levelled at
 * the textbook width; widening it moved all 104 of them further from what
 * they say, for a level change of under a fifth of a decibel. One is a rack
 * somebody sweeps, the other is a curve somebody wrote down.
 */
const SKIRT_REACH = 2;

/**
 * A width per band, from the distance to the bands either side of it.
 *
 * One number for the whole rack is only right while the rack is evenly
 * spaced, and the twenty-band layout deliberately is not: it runs third-octave
 * from 63 to 250 and from 6.3k to 16k, and two-thirds through the middle, so
 * one number would leave the middle with holes between its bands and the ends
 * with three bands playing the same note.
 *
 * Each band therefore takes the mean of the gap below it and the gap above,
 * in octaves; the two on the ends take the one gap they have. Answered in the
 * order the frequencies were handed over, sorted or not.
 */
export const qualitiesForRack = (frequencies: readonly number[]): number[] => {
  const ordered = frequencies
    .map((frequency, at) => ({ frequency, at }))
    .filter(({ frequency }) => Number.isFinite(frequency) && frequency > 0)
    .sort((one, other) => one.frequency - other.frequency);
  const answer = frequencies.map(() => DEFAULT_BAND_QUALITY);
  if (ordered.length < 2) {
    return answer;
  }
  const gap = (below: number, above: number) => Math.log2(above / below);
  ordered.forEach(({ at }, index) => {
    const previous = ordered[index - 1];
    const next = ordered[index + 1];
    const below = previous
      ? gap(previous.frequency, ordered[index].frequency)
      : undefined;
    const above = next
      ? gap(ordered[index].frequency, next.frequency)
      : undefined;
    const sides = [below, above].filter(
      (octaves): octaves is number => octaves !== undefined && octaves > 0,
    );
    if (sides.length === 0) {
      return;
    }
    answer[at] = qualityForSpacing(
      (sides.reduce((sum, octaves) => sum + octaves, 0) / sides.length) *
        SKIRT_REACH,
    );
  });
  return answer;
};
