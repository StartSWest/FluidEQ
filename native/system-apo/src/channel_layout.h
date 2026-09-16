/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a stream's channel mask says about where its channels sit.
 *
 * Its own unit, with nothing of COM in it, so the rule can be held by a test
 * that does not build the effect: which channel is the subwoofer feed decides
 * which channel the exciter leaves alone, and a rule that is off by one adds
 * harmonics to a subwoofer and leaves a centre speaker plain.
 */
#ifndef FLUIDEQ_ENGINE_CHANNEL_LAYOUT_H
#define FLUIDEQ_ENGINE_CHANNEL_LAYOUT_H

namespace fluideq_engine {

/**
 * Where the subwoofer feed sits in the stream, or -1.
 *
 * The channels of a stream are in the order of the mask's set bits, so the
 * LFE's index is how many speaker bits sit below `SPEAKER_LOW_FREQUENCY`.
 * A stream with no mask — a plain format, or an extensible one that says 0 —
 * is in Windows' own order for its count, which for six channels and up is
 * 5.1's and 7.1's with the LFE fourth; fewer than six without a mask says
 * nothing, and a quad or a 2.1 without one is left alone rather than guessed.
 * A mask naming the LFE past the stream's count is a mask that does not
 * describe this stream, and answers -1 too.
 */
int lfe_channel_of(unsigned long mask, unsigned short channels);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_CHANNEL_LAYOUT_H
