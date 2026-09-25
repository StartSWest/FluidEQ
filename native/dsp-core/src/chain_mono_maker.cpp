/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The mono maker: the phase-cancellation fix, applied to the side only.
 *
 * Bass out of phase between the two channels vanishes the moment they are
 * summed — a phone speaker, a mono PA and most Bluetooth speakers all do
 * that — so a mix can sound enormous on headphones and gutless everywhere
 * else. High-passing the SIDE removes the part that can cancel and leaves
 * the middle whole. Above the corner the image is untouched: width is worth
 * keeping wherever it cannot cancel.
 *
 * After the EQ, on a mid/side of its own, rather than inside the EQ's. There
 * it decided which domain the EQ ran in, so a preset that turned it on or
 * off moved every band from left and right onto mid and side in one sample,
 * with histories that were still left and right: -42 dBFS above 5 kHz on a
 * switch between Regional Mexican (off) and Corridos (120 Hz), 2026-09-25.
 * Now the EQ always runs where its own stereo setting says, and a change of
 * corner, on or off, crosses from the side as it was to the side as asked
 * over `kEqFadeSeconds` on the raised cosine the rack's EQ uses. A change
 * landing mid-crossing carries on crossing and switches the incoming side at
 * once, as the EQ's fade does.
 */

#include <algorithm>
#include <cmath>
#include <cstdint>

#include "chain_internal.h"

namespace {

constexpr double kPi = 3.14159265358979323846;

bool same(const FeqBiquadCoefficients& left, const FeqBiquadCoefficients& right) {
  return left.b0 == right.b0 && left.b1 == right.b1 && left.b2 == right.b2 &&
         left.a1 == right.a1 && left.a2 == right.a2;
}

/** The side as one configuration plays it: high-passed, or as it came. */
void play(float* side, uint32_t frames, int on, FeqBiquadState* state,
          const FeqBiquadCoefficients& coefficients) {
  if (on != 0) {
    feq_biquad_process(state, side, frames, &coefficients);
  }
}

}  // namespace

void chain_process_mono_maker(FeqChain* chain, float* const* channels,
                              uint32_t frames) {
  FeqChain::MonoMaker& mono = chain->mono_maker;
  if (chain->channels < 2 || frames > mono.side.size()) {
    return;
  }
  const int asked_on = chain->active->has_mono_below;
  const FeqBiquadCoefficients& asked = chain->active->mono_below;
  if (mono.played == 0) {
    // A stream's first block takes what is asked as it is: 20 ms faded in
    // from itself would be a change nobody made.
    mono.playing_on = asked_on;
    mono.playing = asked;
    feq_biquad_reset(&mono.state);
    mono.left = 0;
    mono.played = 1;
  } else if (asked_on != mono.playing_on ||
             (asked_on != 0 && !same(asked, mono.playing))) {
    if (mono.left == 0) {
      mono.outgoing = mono.playing;
      mono.outgoing_on = mono.playing_on;
      mono.outgoing_state = mono.state;
      mono.total = static_cast<uint32_t>(
          std::lround(kEqFadeSeconds * chain->sample_rate));
      if (mono.total == 0) {
        mono.total = 1;
      }
      mono.left = mono.total;
    }
    // The incoming side starts from the history it had, which is the side's
    // own recent past under the other corner: nearer than silence, and the
    // crossing covers what differs.
    mono.playing = asked;
    mono.playing_on = asked_on;
  }
  if (mono.playing_on == 0 && mono.left == 0) {
    return;  // Off and settled: the side passes as it is, at no cost.
  }

  float* left = channels[0];
  float* right = channels[1];
  float* side = mono.side.data();
  for (uint32_t at = 0; at < frames; ++at) {
    side[at] = static_cast<float>(
        (static_cast<double>(left[at]) - static_cast<double>(right[at])) * 0.5);
  }
  float* outgoing = mono.side_outgoing.data();
  if (mono.left > 0) {
    std::copy(side, side + frames, outgoing);
    play(outgoing, frames, mono.outgoing_on, &mono.outgoing_state,
         mono.outgoing);
  }
  play(side, frames, mono.playing_on, &mono.state, mono.playing);

  for (uint32_t at = 0; at < frames; ++at) {
    double shaped = static_cast<double>(side[at]);
    if (mono.left > 0) {
      const uint32_t done = mono.total - mono.left;
      const double weight =
          0.5 - 0.5 * std::cos(kPi * static_cast<double>(done) /
                               static_cast<double>(mono.total));
      shaped = static_cast<double>(outgoing[at]) +
               weight * (shaped - static_cast<double>(outgoing[at]));
      mono.left -= 1;
    }
    // Only the side changes, so the middle stays exactly what it was.
    const double dry =
        (static_cast<double>(left[at]) - static_cast<double>(right[at])) * 0.5;
    const double change = shaped - dry;
    left[at] = static_cast<float>(static_cast<double>(left[at]) + change);
    right[at] = static_cast<float>(static_cast<double>(right[at]) - change);
  }
}

void chain_mono_maker_reset(FeqChain* chain) {
  FeqChain::MonoMaker& mono = chain->mono_maker;
  feq_biquad_reset(&mono.state);
  feq_biquad_reset(&mono.outgoing_state);
  mono.left = 0;
  mono.played = 0;
}
