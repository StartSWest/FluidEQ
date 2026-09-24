/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The curve the Maximizer limits through, and how it changes.
 *
 * A preset's tone plays after the rack, so the rack puts the same curve on in
 * front of the Maximizer and takes it off again behind the Master
 * (`FeqChainToneSettings`): the Maximizer's limiters and the Master's Auto
 * Headroom hear the programme as the listener will, and hold that to the
 * ceiling.
 *
 * Swapped for another in one block, a curve was heard. Its filters' histories
 * belonged to the old curve, and the audio the limiters hold had been through
 * the old curve and came out through the new one's inverse: a preset picked
 * from None, the Preset chip's A/B and Double each clicked at -49 dBFS on a
 * tone at a third of full scale, -39 on one being limited. So a curve glides,
 * as every change the engine hears fades: each band moves to its new gain
 * over `kGlideMs`, a band that arrives starts flat and one that leaves ends
 * flat and is then let go, and the inverse follows the same path once the
 * audio the limiters hold has caught up — so where nothing is limited the
 * two still cancel, during a change as well as between them.
 */

#include <algorithm>
#include <cmath>

#include "chain_internal.h"

namespace {

using ToneBand = FeqChain::ToneBand;
using ToneGlide = FeqChain::ToneGlide;

/** How long a band takes to reach its new gain: the main EQ's own crossfade. */
constexpr double kGlideMs = 20.0;
/**
 * How long a band that left is kept, flat, before it is dropped: until its
 * histories agree with its input, which a flat band's own poles bring about
 * (the slowest, a 10 Hz shelf's, by more than 70 dB in this time).
 */
constexpr double kSettleMs = 250.0;
/** While any band moves, the curve is rebuilt this often, in frames. */
constexpr uint32_t kGlideChunk = 32;

uint32_t frames_of(double ms, double sample_rate) {
  const double frames = std::floor(ms / 1000.0 * sample_rate + 0.5);
  return frames < 1.0 ? 1u : static_cast<uint32_t>(frames);
}

/**
 * A band at a gain, as the layer after the rack builds it.
 *
 * Exactly flat is the cookbook's flat, whatever the design: its numerator
 * and denominator are the same numbers, so it passes its input unchanged from
 * any history that agrees with it — which is what lets a band arrive and
 * leave without a step.
 */
FeqBiquadCoefficients design(const ToneBand& band, double gain_db,
                             double sample_rate) {
  if (gain_db == 0.0 || band.matched == 0) {
    return feq_biquad_coefficients(band.type, band.frequency, gain_db,
                                   band.quality, sample_rate);
  }
  return feq_biquad_coefficients_matched(band.type, band.frequency, gain_db,
                                         band.quality, sample_rate);
}

/**
 * A band's exact inverse, when it has a stable one.
 *
 * The numerator's roots become the poles, so they have to sit inside the unit
 * circle — true of a minimum-phase bell or shelf at any gain, but a gain is
 * whatever arrived on the wire, so the stability triangle is checked rather
 * than assumed.
 */
bool invert(const FeqBiquadCoefficients& forward,
            FeqBiquadCoefficients* inverse) {
  if (!(std::fabs(forward.b0) > 1e-12)) {
    return false;
  }
  const double c1 = forward.b1 / forward.b0;
  const double c2 = forward.b2 / forward.b0;
  if (!(std::fabs(c2) < 1.0 && std::fabs(c1) < 1.0 + c2)) {
    return false;
  }
  inverse->b0 = 1.0 / forward.b0;
  inverse->b1 = forward.a1 / forward.b0;
  inverse->b2 = forward.a2 / forward.b0;
  inverse->a1 = c1;
  inverse->a2 = c2;
  return std::isfinite(inverse->b0) && std::isfinite(inverse->b1) &&
         std::isfinite(inverse->b2);
}

/** Sets a glide going to `target`, arriving in `frames`. */
void aim(ToneGlide* glide, double target, double frames) {
  glide->target = target;
  glide->step = std::fabs(target - glide->db) / frames;
}

/** Moves a glide on by `frames`; true when its gain changed. */
bool advance(ToneGlide* glide, uint32_t frames) {
  if (glide->db == glide->target) {
    return false;
  }
  const double move = glide->step * static_cast<double>(frames);
  if (!(glide->step > 0.0) || std::fabs(glide->target - glide->db) <= move) {
    glide->db = glide->target;
  } else {
    glide->db += glide->target > glide->db ? move : -move;
  }
  return true;
}

bool same_shape(const ToneBand& band, const FeqChainToneBand& wanted,
                int matched) {
  return band.type == wanted.type && band.frequency == wanted.frequency &&
         band.quality == wanted.quality && band.matched == matched;
}

void clear_histories(FeqChain* chain, uint32_t slot) {
  for (uint32_t channel = 0; channel < FEQ_CHAIN_MAX_CHANNELS; ++channel) {
    const size_t at = static_cast<size_t>(channel) * FeqChain::kToneSlots + slot;
    feq_biquad_reset(&chain->tone_states[at]);
    feq_biquad_reset(&chain->tone_inverse_states[at]);
  }
}

/**
 * The audio held between the curve going on and coming off: both of the
 * Maximizer's limiters and the Master's Auto Headroom, which run whether they
 * limit or not (`feq_chain_latency_parts`).
 */
uint32_t limiter_delay(const FeqChain* chain) {
  return chain->maximizer.look_ahead + chain->maximizer_low.look_ahead +
         chain->post_normalizer.limiter.look_ahead;
}

/**
 * Takes a newly published curve as the target of the one playing.
 *
 * A band of the new curve with the shape of one playing — type, frequency, Q
 * and design, which is every band from one genre's curve to another's — is
 * that band moving; any other arrives flat; a band playing that is in the new
 * curve nowhere is on its way out. Before any audio has passed there is
 * nothing to glide from, and the curve is taken as it is.
 */
void adopt(FeqChain* chain) {
  const FeqChain::ChainCoefficients& set = *chain->active;
  if (set.tone_generation == chain->tone_adopted) {
    return;
  }
  chain->tone_adopted = set.tone_generation;
  const FeqChainToneSettings& wanted = set.tone;
  const uint32_t count = std::min<uint32_t>(wanted.band_count,
                                            FEQ_CHAIN_MAX_TONE_BANDS);
  const double sample_rate = chain->sample_rate;
  const int matched = wanted.matched != 0 ? 1 : 0;

  if (chain->tone_primed == 0) {
    chain->tone_count = 0;
    for (uint32_t index = 0; index < count; ++index) {
      const FeqChainToneBand& source = wanted.bands[index];
      ToneBand band{};
      band.type = source.type;
      band.frequency = source.frequency;
      band.quality = source.quality;
      band.matched = matched;
      band.forward_coefficients = design(band, source.gain_db, sample_rate);
      if (!invert(band.forward_coefficients, &band.inverse_coefficients)) {
        continue;
      }
      band.forward = ToneGlide{source.gain_db, source.gain_db, 0.0};
      band.inverse = band.forward;
      const uint32_t slot = chain->tone_count;
      chain->tone_bands[slot] = band;
      clear_histories(chain, slot);
      chain->tone_count += 1;
    }
    return;
  }

  const double glide = static_cast<double>(frames_of(kGlideMs, sample_rate));
  const uint32_t delay = limiter_delay(chain);
  bool claimed[FeqChain::kToneSlots] = {};
  const uint32_t playing = chain->tone_count;
  for (uint32_t index = 0; index < count; ++index) {
    const FeqChainToneBand& source = wanted.bands[index];
    // A band with no stable inverse cannot be taken off again, so it is not
    // put on: left out of both, the two always cancel.
    ToneBand probe{};
    probe.type = source.type;
    probe.frequency = source.frequency;
    probe.quality = source.quality;
    probe.matched = matched;
    FeqBiquadCoefficients unused{};
    if (!invert(design(probe, source.gain_db, sample_rate), &unused)) {
      continue;
    }
    uint32_t slot = playing;
    for (uint32_t at = 0; at < playing; ++at) {
      if (!claimed[at] && same_shape(chain->tone_bands[at], source, matched)) {
        slot = at;
        break;
      }
    }
    if (slot == playing) {
      if (chain->tone_count >= FeqChain::kToneSlots) {
        continue;
      }
      slot = chain->tone_count;
      chain->tone_count += 1;
      ToneBand& fresh = chain->tone_bands[slot];
      fresh = probe;
      fresh.forward = ToneGlide{};
      fresh.inverse = ToneGlide{};
      fresh.forward_coefficients = design(fresh, 0.0, sample_rate);
      fresh.inverse_coefficients = fresh.forward_coefficients;
      fresh.forward_fresh = 1;
      fresh.inverse_fresh = 1;
      clear_histories(chain, slot);
    }
    claimed[slot] = true;
    ToneBand& band = chain->tone_bands[slot];
    band.outgoing = 0;
    band.settle = 0;
    aim(&band.forward, source.gain_db, glide);
    band.inverse_pending = source.gain_db;
    band.inverse_wait = delay;
    band.has_pending = 1;
  }
  for (uint32_t slot = 0; slot < playing; ++slot) {
    if (claimed[slot]) {
      continue;
    }
    ToneBand& band = chain->tone_bands[slot];
    band.outgoing = 1;
    band.settle = frames_of(kSettleMs, sample_rate);
    aim(&band.forward, 0.0, glide);
    band.inverse_pending = 0.0;
    band.inverse_wait = delay;
    band.has_pending = 1;
  }
}

/** A cascade over `frames` from `offset`, slot order or its reverse. */
void run(FeqChain* chain, float* const* channels, uint32_t offset,
         uint32_t frames, bool inverse) {
  const uint32_t count = chain->tone_count;
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    FeqBiquadState* own =
        (inverse ? chain->tone_inverse_states : chain->tone_states).data() +
        static_cast<size_t>(channel) * FeqChain::kToneSlots;
    float* samples = channels[channel] + offset;
    for (uint32_t index = 0; index < count; ++index) {
      const uint32_t slot = inverse ? count - 1 - index : index;
      const ToneBand& band = chain->tone_bands[slot];
      feq_biquad_process(
          &own[slot], samples, frames,
          inverse ? &band.inverse_coefficients : &band.forward_coefficients);
    }
  }
}

/** Lets go of the bands that left and have been flat long enough. */
void drop_settled(FeqChain* chain, uint32_t frames) {
  uint32_t kept = 0;
  for (uint32_t slot = 0; slot < chain->tone_count; ++slot) {
    ToneBand& band = chain->tone_bands[slot];
    const bool flat = band.forward.db == 0.0 && band.forward.target == 0.0 &&
                      band.inverse.db == 0.0 && band.inverse.target == 0.0 &&
                      band.has_pending == 0;
    if (band.outgoing != 0 && flat) {
      band.settle = band.settle > frames ? band.settle - frames : 0u;
      if (band.settle == 0) {
        continue;
      }
    }
    if (kept != slot) {
      chain->tone_bands[kept] = band;
      for (uint32_t channel = 0; channel < FEQ_CHAIN_MAX_CHANNELS; ++channel) {
        const size_t base = static_cast<size_t>(channel) * FeqChain::kToneSlots;
        chain->tone_states[base + kept] = chain->tone_states[base + slot];
        chain->tone_inverse_states[base + kept] =
            chain->tone_inverse_states[base + slot];
      }
    }
    kept += 1;
  }
  chain->tone_count = kept;
}

}  // namespace

void chain_tone_forward(FeqChain* chain, float* const* channels,
                        uint32_t frames) {
  adopt(chain);
  chain->tone_primed = 1;
  const double sample_rate = chain->sample_rate;
  uint32_t done = 0;
  while (done < frames && chain->tone_count > 0) {
    bool moving = false;
    for (uint32_t slot = 0; slot < chain->tone_count; ++slot) {
      const ToneGlide& glide = chain->tone_bands[slot].forward;
      moving = moving || glide.db != glide.target;
    }
    const uint32_t chunk =
        moving ? std::min(kGlideChunk, frames - done) : frames - done;
    if (moving) {
      for (uint32_t slot = 0; slot < chain->tone_count; ++slot) {
        ToneBand& band = chain->tone_bands[slot];
        if (band.forward_fresh != 0) {
          band.forward_fresh = 0;
        } else if (advance(&band.forward, chunk)) {
          band.forward_coefficients =
              design(band, band.forward.db, sample_rate);
        }
      }
    }
    run(chain, channels, done, chunk, false);
    done += chunk;
  }
}

void chain_tone_inverse(FeqChain* chain, float* const* channels,
                        uint32_t frames) {
  if (chain->tone_count == 0) {
    return;
  }
  const double sample_rate = chain->sample_rate;
  const double glide = static_cast<double>(frames_of(kGlideMs, sample_rate));
  uint32_t done = 0;
  while (done < frames) {
    bool moving = false;
    for (uint32_t slot = 0; slot < chain->tone_count; ++slot) {
      const ToneBand& band = chain->tone_bands[slot];
      moving = moving || band.has_pending != 0 ||
               band.inverse.db != band.inverse.target;
    }
    const uint32_t chunk =
        moving ? std::min(kGlideChunk, frames - done) : frames - done;
    if (moving) {
      for (uint32_t slot = 0; slot < chain->tone_count; ++slot) {
        ToneBand& band = chain->tone_bands[slot];
        if (band.has_pending != 0) {
          if (band.inverse_wait <= chunk) {
            band.has_pending = 0;
            band.inverse_wait = 0;
            aim(&band.inverse, band.inverse_pending, glide);
          } else {
            band.inverse_wait -= chunk;
          }
        }
        FeqBiquadCoefficients next{};
        // An inverse that is not stable at a gain on the way keeps the one it
        // had for this chunk; the target's inverse was checked on arrival.
        if (band.inverse_fresh != 0) {
          band.inverse_fresh = 0;
        } else if (advance(&band.inverse, chunk) &&
                   invert(design(band, band.inverse.db, sample_rate), &next)) {
          band.inverse_coefficients = next;
        }
      }
    }
    run(chain, channels, done, chunk, true);
    done += chunk;
  }
  drop_settled(chain, frames);
}

void chain_tone_restart(FeqChain* chain) {
  std::fill(chain->tone_states.begin(), chain->tone_states.end(),
            FeqBiquadState{});
  std::fill(chain->tone_inverse_states.begin(),
            chain->tone_inverse_states.end(), FeqBiquadState{});
  chain->tone_primed = 0;
  chain->tone_adopted = 0;
}

void chain_tone_transfer(FeqChain& prepared, FeqChain& previous) {
  using std::swap;
  swap(prepared.tone_bands, previous.tone_bands);
  swap(prepared.tone_count, previous.tone_count);
  swap(prepared.tone_primed, previous.tone_primed);
  swap(prepared.tone_states, previous.tone_states);
  swap(prepared.tone_inverse_states, previous.tone_inverse_states);
  // Each takes its own target again, from the curve it now holds.
  prepared.tone_adopted = 0;
  previous.tone_adopted = 0;
}
