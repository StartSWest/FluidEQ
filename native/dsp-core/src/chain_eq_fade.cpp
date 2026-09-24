/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every change to the rack's EQ fades, and every band keeps its history.
 *
 * The histories were kept by a band's place among the live bands, so
 * switching one band on moved every band after it onto its neighbour's
 * history, and a changed band's filter jumped between two blocks with
 * nothing in between. Under a 55 Hz + 700 Hz programme, whose steady sound
 * leaves -106 dBFS above 8 kHz, switching a 700 Hz band on or off left
 * -37 dBFS there, a band added between two the same, a 700 Hz bell flipped
 * from +6 to -6 dB -73 and the Treble choice changed on a 12 kHz band -66 —
 * measured 2026-09-23, both as the engine hands a rack over and as the
 * Library's host configures one in place.
 *
 * The main EQ had the same faults and mends them the same way
 * (`iir_cascade.cpp` in the engine): a band still there is found again by
 * its shape — the same type, frequency and Q; then the same type and
 * frequency; then the same type in the same place — and the rack as it was
 * keeps playing beside the new one for `kEqFadeSeconds` while the sound
 * slides across on an equal-gain raised cosine. The two are nearly the same
 * signal, so an equal-power fade would swell correlated audio 3 dB at its
 * middle. A fade already crossing carries on rather than restarting, and
 * the change that arrived reaches the incoming side at once: what that
 * leaves grows with the step, and a drag's steps are small — 0.5 dB leaves
 * -104 dBFS on that programme, a 6 dB jump inside the 20 ms -88. Crossing
 * afresh would need the rack before last playing as well, one more for each
 * step of a drag that lands a message every few milliseconds.
 * Switching the EQ on fades in from the sound as it arrived, with the
 * histories started from silence rather than from wherever they were left;
 * switching it off lets the rack play out into it.
 *
 * Not faded, as before: a change of phase mode, oversampling factor or
 * stereo arrangement, which moves the bands to another signal or another
 * rate rather than changing what they do, and anything while the EQ runs
 * through its linear-phase kernel, whose kernels cross-fade on their own.
 */

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <utility>

#include "chain_internal.h"

namespace {

constexpr double kPi = 3.14159265358979323846;

/**
 * What a handover numbers the rack it brings, which no set of the new chain
 * can be numbered: the sets count from 1 and never get near it. Nought is a
 * chain that has played nothing, whose first rack is taken as it is — a
 * stream's first 20 ms faded in from itself would be a change nobody made.
 */
constexpr uint64_t kHandedOver = UINT64_MAX;

bool same_coefficients(const FeqBiquadCoefficients& left,
                       const FeqBiquadCoefficients& right) {
  return left.b0 == right.b0 && left.b1 == right.b1 && left.b2 == right.b2 &&
         left.a1 == right.a1 && left.a2 == right.a2;
}

/** Whether the set plays exactly what played, so there is nothing to cross. */
bool same_sound(const ChainEqPlaying& playing,
                const FeqChain::ChainCoefficients& set) {
  if (playing.running != set.eq_running) {
    return false;
  }
  if (playing.running == 0) {
    return true;
  }
  if (playing.engine != set.engine ||
      playing.has_subsonic != set.has_subsonic ||
      (playing.has_subsonic != 0 &&
       !same_coefficients(playing.subsonic, set.subsonic)) ||
      playing.count != set.bands.size()) {
    return false;
  }
  for (uint32_t band = 0; band < playing.count; ++band) {
    if (!same_coefficients(playing.bands[band], set.bands[band]) ||
        playing.identity[band].dynamic != set.identity[band].dynamic) {
      return false;
    }
  }
  return true;
}

/**
 * Whether the rack that played can go on playing where the new one does.
 *
 * `running` is the cascade: the EQ switched on and not in its kernel. A side
 * that is switched on but in its kernel has no cascade to cross from or to,
 * and a change of stereo arrangement or oversampling factor puts the bands
 * on another signal or at another rate.
 */
bool crossable(const ChainEqPlaying& playing,
               const FeqChain::ChainCoefficients& set) {
  const bool was_kernel = playing.enabled != 0 && playing.running == 0;
  const bool is_kernel = set.eq_enabled != 0 && set.eq_running == 0;
  if (was_kernel || is_kernel) {
    return false;
  }
  if (playing.running == 0 && set.eq_running == 0) {
    return false;
  }
  if (playing.stereo != set.stereo) {
    return false;
  }
  return playing.running == 0 || set.eq_running == 0 ||
         playing.oversample == set.oversample;
}

/** The rack that played becomes the one the EQ crosses from. */
void start_fade(FeqChain* chain) {
  const ChainEqPlaying& playing = chain->eq_playing;
  ChainEqFade& fade = chain->eq_fade;
  const uint32_t stride = FeqChain::kBandStride;
  fade.total = std::max<uint32_t>(
      1u, static_cast<uint32_t>(std::lround(kEqFadeSeconds * chain->sample_rate)));
  fade.left = fade.total;
  fade.count = 0;
  fade.has_subsonic = 0;
  // Switched on from off: the rack faded from is the sound as it arrived.
  fade.oversample = 1;
  fade.engine = FEQ_EQ_SERIAL;
  if (playing.running == 0) {
    return;
  }
  fade.engine = playing.engine;
  fade.oversample = playing.oversample;
  fade.has_subsonic = playing.has_subsonic;
  fade.subsonic = playing.subsonic;
  for (uint32_t band = 0; band < playing.count; ++band) {
    if (playing.identity[band].dynamic != 0) {
      continue;
    }
    for (uint32_t slot = 0; slot < chain->channels; ++slot) {
      fade.states[slot * stride + fade.count] =
          chain->band_states[slot * stride + band];
    }
    fade.bands[fade.count] = playing.bands[band];
    fade.count += 1;
  }
  for (uint32_t slot = 0; slot < chain->channels; ++slot) {
    fade.subsonic_states[slot] = chain->slots[slot].subsonic;
    fade.oversamplers[slot] = chain->slots[slot].eq_oversampler;
  }
}

/**
 * Where each band of `set` finds its history among what played, or -1.
 *
 * The main EQ's three passes, in its order: the same band exactly, then the
 * same type at the same frequency with a new width, then — for a band whose
 * frequency was dragged — the same type in the same place.
 */
void match_bands(const ChainEqPlaying& playing,
                 const FeqChain::ChainCoefficients& set, int32_t* from) {
  const uint32_t count = static_cast<uint32_t>(set.identity.size());
  bool taken[FEQ_CHAIN_MAX_EQ_BANDS] = {};
  std::fill(from, from + count, -1);
  for (int pass = 0; pass < 3; ++pass) {
    for (uint32_t band = 0; band < count; ++band) {
      if (from[band] >= 0) {
        continue;
      }
      const ChainBandIdentity& now = set.identity[band];
      if (pass == 2) {
        if (band < playing.count && !taken[band] &&
            playing.identity[band].type == now.type) {
          from[band] = static_cast<int32_t>(band);
          taken[band] = true;
        }
        continue;
      }
      for (uint32_t then = 0; then < playing.count; ++then) {
        const ChainBandIdentity& was = playing.identity[then];
        if (taken[then] || was.type != now.type ||
            was.frequency != now.frequency ||
            (pass == 0 && was.quality != now.quality)) {
          continue;
        }
        from[band] = static_cast<int32_t>(then);
        taken[then] = true;
        break;
      }
    }
  }
}

/** Every band's history, and a dynamic band's envelope, to where it is now. */
void carry_histories(FeqChain* chain, const FeqChain::ChainCoefficients& set) {
  const ChainEqPlaying& playing = chain->eq_playing;
  const uint32_t stride = FeqChain::kBandStride;
  const uint32_t count = std::min<uint32_t>(
      static_cast<uint32_t>(set.identity.size()), FEQ_CHAIN_MAX_EQ_BANDS);
  int32_t from[FEQ_CHAIN_MAX_EQ_BANDS];
  match_bands(playing, set, from);
  FeqBiquadState states[FEQ_CHAIN_MAX_EQ_BANDS];
  double envelopes[FEQ_CHAIN_MAX_EQ_BANDS];
  double amounts[FEQ_CHAIN_MAX_EQ_BANDS];
  for (uint32_t slot = 0; slot < FEQ_CHAIN_MAX_CHANNELS; ++slot) {
    const size_t base = static_cast<size_t>(slot) * stride;
    for (uint32_t then = 0; then < playing.count; ++then) {
      states[then] = chain->band_states[base + then];
      envelopes[then] = chain->band_dynamics[base + then].envelope;
      amounts[then] = chain->band_dynamics[base + then].amount;
    }
    for (uint32_t band = 0; band < count; ++band) {
      const int32_t then = from[band];
      FeqBiquadState& state = chain->band_states[base + band];
      FeqBandDynamics& detector = chain->band_dynamics[base + band];
      if (then < 0) {
        feq_biquad_reset(&state);
        detector.envelope = 0.0;
        detector.amount = 0.0;
        continue;
      }
      state = states[then];
      const bool both_dynamic = set.identity[band].dynamic != 0 &&
                                playing.identity[then].dynamic != 0;
      detector.envelope = both_dynamic ? envelopes[then] : 0.0;
      detector.amount = both_dynamic ? amounts[then] : 0.0;
    }
  }
}

/** The EQ comes on: its histories start from silence, not from long ago. */
void start_histories(FeqChain* chain) {
  for (FeqBiquadState& state : chain->band_states) {
    feq_biquad_reset(&state);
  }
  for (FeqBandDynamics& detector : chain->band_dynamics) {
    detector.envelope = 0.0;
    detector.amount = 0.0;
  }
  for (ChainEqSlot& slot : chain->slots) {
    feq_biquad_reset(&slot.subsonic);
    feq_oversampler_reset(&slot.eq_oversampler);
  }
}

void remember(ChainEqPlaying& playing, const FeqChain::ChainCoefficients& set) {
  playing.generation = set.eq_generation;
  playing.enabled = set.eq_enabled;
  playing.running = set.eq_running;
  playing.engine = set.engine;
  playing.oversample = set.oversample;
  playing.stereo = set.stereo;
  playing.has_subsonic = set.has_subsonic;
  playing.subsonic = set.subsonic;
  playing.count = std::min<uint32_t>(static_cast<uint32_t>(set.bands.size()),
                                     FEQ_CHAIN_MAX_EQ_BANDS);
  std::copy_n(set.bands.begin(), playing.count, playing.bands);
  std::copy_n(set.identity.begin(), playing.count, playing.identity);
}

}  // namespace

void chain_eq_adopt(FeqChain* chain) {
  const FeqChain::ChainCoefficients& set = *chain->active;
  ChainEqPlaying& playing = chain->eq_playing;
  if (set.eq_generation == playing.generation) {
    return;
  }
  if (playing.generation == 0) {
    remember(playing, set);
    return;
  }
  ChainEqFade& fade = chain->eq_fade;
  if (!crossable(playing, set)) {
    fade.left = 0;
  } else if (fade.left == 0 && !same_sound(playing, set)) {
    start_fade(chain);
  }
  if (playing.running != 0 && set.eq_running != 0) {
    carry_histories(chain, set);
  } else if (set.eq_running != 0) {
    start_histories(chain);
  }
  remember(playing, set);
}

void chain_eq_fade_capture(FeqChain* chain, uint32_t slot_index,
                           const float* target, uint32_t frames) {
  ChainEqFade& fade = chain->eq_fade;
  if (fade.left == 0 || slot_index >= chain->channels) {
    return;
  }
  float* outgoing = fade.outgoing[slot_index].data();
  std::copy(target, target + frames, outgoing);
  if (fade.has_subsonic != 0) {
    feq_biquad_process(&fade.subsonic_states[slot_index], outgoing, frames,
                       &fade.subsonic);
  }
  FeqBiquadState* states =
      fade.states.data() +
      static_cast<size_t>(slot_index) * FeqChain::kBandStride;
  if (fade.oversample > 1) {
    feq_eq_process_oversampled(
        states, fade.bands, fade.count, outgoing, frames, fade.engine,
        &fade.oversamplers[slot_index], fade.oversample,
        chain->eq_doubled.data(), chain->eq_dry_doubled.data(),
        chain->eq_wet_doubled.data(), chain->eq_middle.data(), nullptr);
  } else if (fade.count > 0) {
    feq_eq_process_bands(states, fade.bands, fade.count, outgoing, frames,
                         fade.engine, chain->eq_dry.data(),
                         chain->eq_wet.data(), nullptr);
  }
}

void chain_eq_fade_mix(FeqChain* chain, uint32_t slot_index, float* target,
                       uint32_t frames) {
  const ChainEqFade& fade = chain->eq_fade;
  if (fade.left == 0 || slot_index >= chain->channels) {
    return;
  }
  const float* outgoing = fade.outgoing[slot_index].data();
  const uint32_t done = fade.total - fade.left;
  for (uint32_t frame = 0; frame < frames; ++frame) {
    const uint32_t at = done + frame;
    if (at >= fade.total) {
      break;  // The rest of the block is the new rack alone.
    }
    const double weight =
        0.5 - 0.5 * std::cos(kPi * static_cast<double>(at) /
                             static_cast<double>(fade.total));
    const double from = static_cast<double>(outgoing[frame]);
    target[frame] = static_cast<float>(
        from + weight * (static_cast<double>(target[frame]) - from));
  }
}

void chain_eq_fade_advance(FeqChain* chain, uint32_t frames) {
  ChainEqFade& fade = chain->eq_fade;
  fade.left -= std::min(fade.left, frames);
}

int chain_eq_fading(const FeqChain* chain) {
  return chain->eq_fade.left > 0 ? 1 : 0;
}

void chain_eq_fade_allocate(FeqChain* chain) {
  ChainEqFade& fade = chain->eq_fade;
  fade.states.assign(
      static_cast<size_t>(FeqChain::kBandStride) * FEQ_CHAIN_MAX_CHANNELS,
      FeqBiquadState{});
  for (uint32_t slot = 0; slot < chain->channels; ++slot) {
    fade.outgoing[slot].assign(chain->max_frames, 0.0f);
  }
}

void chain_eq_fade_stop(FeqChain* chain) { chain->eq_fade.left = 0; }

void chain_eq_fade_transfer(FeqChain& prepared, FeqChain& previous) {
  using std::swap;
  // What played is what the new chain's first block crosses from and finds
  // each band's history in, numbered so that block takes its own set up
  // from it.
  prepared.eq_playing = previous.eq_playing;
  prepared.eq_playing.generation =
      previous.eq_playing.generation == 0 ? 0 : kHandedOver;
  // And a fade already crossing goes on crossing from where it had got to.
  ChainEqFade& to = prepared.eq_fade;
  ChainEqFade& from = previous.eq_fade;
  to.total = from.total;
  to.left = from.left;
  to.engine = from.engine;
  to.oversample = from.oversample;
  to.has_subsonic = from.has_subsonic;
  to.subsonic = from.subsonic;
  to.count = from.count;
  std::copy_n(from.bands, from.count, to.bands);
  std::copy_n(from.subsonic_states, FEQ_CHAIN_MAX_CHANNELS, to.subsonic_states);
  std::copy_n(from.oversamplers, FEQ_CHAIN_MAX_CHANNELS, to.oversamplers);
  swap(to.states, from.states);
  from.left = 0;
}
