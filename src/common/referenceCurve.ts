/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * What a correction is measured against.
 *
 * WHAT THE MEASUREMENT ACTUALLY IS, because everything here depends on it.
 * Smart correction hears the record before FluidEQ processes it
 * (`renderer/audio/rawSource.ts`). It is not a microphone: it cannot hear
 * headphones or a room, and no amount of listening will tell it anything about
 * either. So it corrects nobody's gear — that is what the headphone
 * corrections and the driver profiles are for, working from published
 * measurements. What it corrects is the RECORD.
 *
 * ONE WAY OF DOING IT: Balance. The reference is a line at a fixed slope, so a
 * dull record is brightened and a boomy one tightened, and each stays where it
 * lands; nothing imposes a shape, so the record's own character survives. The
 * level is fitted, because an absolute level means nothing to a measurement
 * that carries whatever the volume is set to, and the solver centres its
 * answer anyway.
 *
 * There used to be four ways and a picker between them — a one-shot repair
 * against a line fitted to the record, Detail (that fitted line with a lift
 * through the mids and highs, the bass held), Balance, and Target (Balance
 * plus a house curve). Ivan settled on Balance alone and the picker went
 * (2026-11-27: "we agreed a while ago to remove the modes and default to
 * Balance"); a choice somebody stored reads as Balance.
 */

/**
 * The slope a record is expected to arrive at, in dB per decade.
 *
 * Music is not spectrally flat and a correction aiming at flat would be asking
 * for something like twenty decibels of treble lift — thin and shrill, the
 * opposite of what anybody wants. Real programme falls away toward the top, and
 * this is roughly where.
 *
 * It was eight, taken from this project's own capture tests, and eight was too
 * bright — which is a thing that can be measured rather than argued about.
 *
 * On a per-bin axis, which is what the analyser reads, pink noise falls ten
 * decibels per decade: three per octave. Analyser convention puts classic pop
 * at about that and modern productions nearer four and a half per octave, which
 * is fifteen. Eight per decade is 2.4 per octave — shallower than pink, so
 * brighter than any real record.
 *
 * Held to it, a perfectly good modern master measured as deficient everywhere
 * above a kilohertz and excessive below. Running the solver against a synthetic
 * one gave −3.3 dB at 50 Hz and +4.5 dB at 12.5 kHz: it thinned a record that
 * needed nothing, and the treble bands sat near their boost limit for as long
 * as it ran. That is the "only the air ever moves" complaint, and it was this
 * number rather than the caps or the anchor.
 *
 * Eleven sits between classic and modern, and leaves a good master alone.
 *
 * THE NUMBER MOST LIKELY TO WANT TUNING BY EAR. Everything else here is
 * structure; this is a judgement about what music should sound like, and it is
 * one decibel per decade away from being noticeably different.
 */
export const REFERENCE_SLOPE_DB_PER_DECADE = -11;
