/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "chain_internal.h"

#include <algorithm>
#include <cmath>

namespace {

/**
 * Pass a dry reference through one identity oversampling round trip.
 *
 * A plain integer delay is not enough at 4x: the two half-band stages have a
 * half-sample group delay and their skirts are part of the result. Running the
 * same filters is the only sample-for-sample reference for what reaches the
 * processed path — and the isolate monitor is a subtraction, so a reference
 * half a sample early leaves a comb filter behind instead of silence.
 */
void match_oversampling(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        FeqOversampler* state,
                        uint32_t factor,
                        float* work) {
  feq_oversample_up(state, target, work, frames, factor,
                    chain->eq_middle.data());
  feq_oversample_down(state, work, target, frames, factor,
                      chain->eq_middle.data());
}

uint32_t live_band_count(const FeqChain* chain) {
  return static_cast<uint32_t>(chain->active->bands.size());
}

/** Capture this EQ domain's isolate references at exact unity input. */
bool prepare_eq_channel(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        uint32_t slot_index) {
  ChainEqSlot& slot = chain->slots[slot_index];
  if (chain->settings.eq.enabled == 0) {
    return false;
  }
  std::copy(target, target + frames, slot.input.begin());
  std::copy(target, target + frames, slot.delayed_input.begin());
  feq_delay_line_process(&slot.isolate_delay, slot.delayed_input.data(),
                         frames);
  if (chain->settings.eq.phase == FEQ_PHASE_MINIMUM &&
      chain->settings.eq.isolate != 0 && chain->convolvers[0] == nullptr) {
    // The monitor is magnitude-matched, and there is nothing to match against
    // until a kernel exists. Silence is honest; the dry signal is not.
    std::fill(target, target + frames, 0.0f);
    slot.dry_mix = 0.0;
    return false;
  }
  return true;
}

/** Fuzz, and the latency-matched isolate subtraction after all EQ bands. */
void finish_eq_channel(FeqChain* chain,
                       float* target,
                       uint32_t frames,
                       uint32_t slot_index) {
  ChainEqSlot& slot = chain->slots[slot_index];
  const FeqChainEqSettings& eq = chain->settings.eq;
  if (eq.fuzz_amount > 0.0) {
    feq_saturate_block(&slot.fuzz, target, frames,
                       feq_fuzz_drive(eq.fuzz_amount),
                       feq_fuzz_blend(eq.fuzz_amount), chain->sample_rate,
                       chain->fuzz_oversampled.data(),
                       chain->fuzz_middle.data());
  }

  if (eq.phase == FEQ_PHASE_MINIMUM && eq.isolate != 0 &&
      chain->convolver_priming > 0) {
    std::fill(target, target + frames, 0.0f);
    slot.dry_mix = 0.0;
    return;
  }

  const double dry_target = eq.isolate != 0 ? 0.0 : 1.0;
  double dry_mix = slot.dry_mix;
  const double smooth = 1.0 - std::exp(-1.0 / ((kEqIsolateSmoothingMs / 1000.0) *
                                               chain->sample_rate));
  const bool linear = chain_linear_running(chain) != 0;
  float* reference = linear ? slot.delayed_input.data() : slot.input.data();
  if (!linear && eq.oversample > 1) {
    match_oversampling(chain, reference, frames, &slot.isolate_oversampler,
                       eq.oversample, slot.isolate_oversampled.data());
  }
  if (eq.fuzz_amount > 0.0) {
    match_oversampling(chain, reference, frames,
                       &slot.isolate_colour_oversampler, 4,
                       slot.isolate_oversampled.data());
  }
  for (uint32_t at = 0; at < frames; ++at) {
    dry_mix += (dry_target - dry_mix) * smooth;
    target[at] = static_cast<float>(
        static_cast<double>(target[at]) -
        static_cast<double>(reference[at]) * (1.0 - dry_mix));
  }
  if (std::fabs(dry_target - dry_mix) < 0.0001) {
    dry_mix = dry_target;
  }
  slot.dry_mix = dry_mix;
}

/** One selected L/R/M/S EQ domain. */
void process_eq_channel(FeqChain* chain,
                        float* target,
                        uint32_t frames,
                        uint32_t slot_index) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  if (!prepare_eq_channel(chain, target, frames, slot_index)) {
    if (eq.enabled == 0) {
      // Switched off with the rack still crossing: it plays out into the
      // sound as it arrives, which is what the EQ now leaves alone.
      chain_eq_fade_capture(chain, slot_index, target, frames);
      chain_eq_fade_mix(chain, slot_index, target, frames);
    }
    return;
  }
  ChainEqSlot& slot = chain->slots[slot_index];
  const uint32_t live = live_band_count(chain);
  const size_t base =
      static_cast<size_t>(slot_index) * FeqChain::kBandStride;

  if (chain_linear_running(chain) != 0) {
    float* const targets[1] = {target};
    chain_process_eq_linear(chain, targets, &slot_index, 1, frames, false);
  } else {
    chain_eq_fade_capture(chain, slot_index, target, frames);
    if (chain->active->has_subsonic != 0) {
      feq_biquad_process(&slot.subsonic, target, frames,
                         &chain->active->subsonic);
    }
    if (eq.oversample > 1) {
      feq_eq_process_oversampled(
          chain->band_states.data() + base, chain->active->bands.data(), live,
          target, frames, eq.engine, &slot.eq_oversampler, eq.oversample,
          chain->eq_doubled.data(), chain->eq_dry_doubled.data(),
          chain->eq_wet_doubled.data(), chain->eq_middle.data(),
          live == 0 ? nullptr : chain->band_dynamics.data() + base);
    } else {
      feq_eq_process_bands(
          chain->band_states.data() + base, chain->active->bands.data(), live,
          target, frames, eq.engine, chain->eq_dry.data(),
          chain->eq_wet.data(),
          live == 0 ? nullptr : chain->band_dynamics.data() + base);
    }
    chain_eq_fade_mix(chain, slot_index, target, frames);
  }
  finish_eq_channel(chain, target, frames, slot_index);
}

/**
 * Stereo mode: one dynamic amount per band, applied to every domain.
 *
 * Every channel the chain has, not the pair: a dynamic band that opened on
 * the front and not on the centre would move a voice between speakers on
 * every syllable, which is the surround form of the stereo image moving.
 */
void process_eq_stereo(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  const uint32_t channel_count = chain->channels;
  if (eq.enabled == 0 || channel_count < 2) {
    if (eq.enabled == 0) {
      // Switched off with the rack still crossing: it plays out into the
      // sound as it arrives, as in the per-domain path.
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain_eq_fade_capture(chain, channel, channels[channel], frames);
        chain_eq_fade_mix(chain, channel, channels[channel], frames);
      }
    }
    return;
  }
  bool ready = true;
  for (uint32_t channel = 0; channel < channel_count; ++channel) {
    ready = prepare_eq_channel(chain, channels[channel], frames, channel) &&
            ready;
  }
  if (!ready) {
    return;
  }
  const uint32_t live = live_band_count(chain);

  if (chain_linear_running(chain) != 0) {
    uint32_t slots[FEQ_CHAIN_MAX_CHANNELS] = {};
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      slots[channel] = channel;
    }
    chain_process_eq_linear(chain, channels, slots, channel_count, frames,
                            true);
  } else {
    // Every channel's outgoing sound first: the new rack runs on all of
    // them at once, in place.
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      chain_eq_fade_capture(chain, channel, channels[channel], frames);
    }
    if (chain->active->has_subsonic != 0) {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        feq_biquad_process(&chain->slots[channel].subsonic, channels[channel],
                           frames, &chain->active->subsonic);
      }
    }
    if (eq.oversample > 1) {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->pointers_a[channel] = chain->linked_doubled[channel].data();
        chain->pointers_b[channel] = chain->linked_dry_doubled[channel].data();
        chain->pointers_c[channel] = chain->linked_wet_doubled[channel].data();
        chain->pointers_d[channel] = chain->linked_middle[channel].data();
      }
      FeqOversampler oversamplers[FEQ_CHAIN_MAX_CHANNELS] = {};
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        oversamplers[channel] = chain->slots[channel].eq_oversampler;
      }
      feq_eq_process_oversampled_linked(
          chain->band_states.data(), FeqChain::kBandStride,
          chain->active->bands.data(), live, channels,
          channel_count, frames, eq.engine, oversamplers, eq.oversample,
          chain->pointers_a, chain->pointers_b, chain->pointers_c,
          chain->pointers_d,
          live == 0 ? nullptr : chain->band_dynamics.data());
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->slots[channel].eq_oversampler = oversamplers[channel];
      }
    } else {
      for (uint32_t channel = 0; channel < channel_count; ++channel) {
        chain->pointers_a[channel] = chain->linked_dry[channel].data();
        chain->pointers_b[channel] = chain->linked_wet[channel].data();
      }
      feq_eq_process_bands_linked(
          chain->band_states.data(), FeqChain::kBandStride,
          chain->active->bands.data(), live, channels,
          channel_count, frames, eq.engine, chain->pointers_a,
          chain->pointers_b,
          live == 0 ? nullptr : chain->band_dynamics.data());
    }
    for (uint32_t channel = 0; channel < channel_count; ++channel) {
      chain_eq_fade_mix(chain, channel, channels[channel], frames);
    }
  }

  // The other domains' detectors mirror the first: one decision was made, and
  // a meter showing several would suggest the band opened on one side only.
  // At the band stride, which is where every other reader of a channel's
  // detectors looks — the per-domain path, the refresh. Stepping by the live
  // band count instead wrote the mirror into the first channel's spare slots
  // and left the real ones stale, so a switch from stereo to a mid/side mode
  // resumed the side's envelope from wherever it had been left.
  for (uint32_t channel = 1; channel < channel_count; ++channel) {
    const size_t base = static_cast<size_t>(channel) * FeqChain::kBandStride;
    for (uint32_t index = 0; index < live; ++index) {
      chain->band_dynamics[base + index].envelope =
          chain->band_dynamics[index].envelope;
      chain->band_dynamics[base + index].amount =
          chain->band_dynamics[index].amount;
    }
  }
  for (uint32_t channel = 0; channel < channel_count; ++channel) {
    finish_eq_channel(chain, channels[channel], frames, channel);
  }
}

}  // namespace

void chain_refresh_eq(FeqChain* chain) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  // Oversampling runs the cascade at twice the rate, so its filters have to be
  // DESIGNED for that rate. Handing it the ordinary set would place every band
  // an octave low — a bug rather than a mode.
  const double design_rate = chain->sample_rate * eq.oversample;

  /**
   * Built into the set the callback is NOT reading, and published at the end.
   *
   * This function runs on the control thread. Filling the live set in place
   * meant `clear()` and `push_back()` on vectors the audio thread was reading
   * — garbage coefficients for a block on a good day, and a read of freed
   * memory once the band count grew past the capacity. That is a click on
   * every knob turn, and it was audible before it was understood.
   */
  const uint32_t live_index =
      chain->published_coefficients.load(std::memory_order_acquire);
  const uint32_t next_index = live_index == 0 ? 1u : 0u;
  FeqChain::ChainCoefficients& built = chain->coefficient_sets[next_index];

  // Built at the base rate, because they run BEFORE the oversampler: a high
  // pass whose job is to keep energy out has nothing to gain from being
  // inside, and doing it first means the oversampler carries less.
  built.has_mono_below = eq.mono_below_hz > 0.0 ? 1 : 0;
  if (built.has_mono_below != 0) {
    built.mono_below = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, eq.mono_below_hz, 0.0, 0.707, chain->sample_rate);
  }
  built.has_subsonic = eq.subsonic_hz > 0.0 ? 1 : 0;
  if (built.has_subsonic != 0) {
    built.subsonic = feq_biquad_coefficients(
        FEQ_FILTER_HPQ, eq.subsonic_hz, 0.0, 0.707, chain->sample_rate);
  }

  built.bands.clear();
  built.dynamic.clear();
  built.identity.clear();
  std::fill(built.live_of, built.live_of + FEQ_CHAIN_MAX_EQ_BANDS, -1);
  std::fill(built.dynamic_of, built.dynamic_of + FEQ_CHAIN_MAX_EQ_BANDS, -1);
  std::vector<const FeqChainEqBand*> live;
  const uint32_t settings_count = eq.band_count > FEQ_CHAIN_MAX_EQ_BANDS
                                      ? FEQ_CHAIN_MAX_EQ_BANDS
                                      : eq.band_count;
  for (uint32_t index = 0; index < settings_count; ++index) {
    const FeqChainEqBand& band = eq.bands[index];
    if (band.enabled == 0) {
      continue;
    }
    built.live_of[index] = static_cast<int32_t>(live.size());
    live.push_back(&band);
    built.bands.push_back(feq_biquad_coefficients_designed(
        band.type, band.frequency, band.gain_db, band.quality, design_rate,
        eq.model, eq.model_amount, eq.matched));
    ChainBandIdentity identity;
    identity.type = band.type;
    identity.frequency = band.frequency;
    identity.quality = band.quality;
    identity.dynamic = band.dynamic != 0 ? 1 : 0;
    built.identity.push_back(identity);
    if (band.dynamic != 0) {
      built.dynamic_of[index] = static_cast<int32_t>(built.dynamic.size());
      // Built at the base rate, not the design rate: these run after the
      // convolution, which is base rate, and never inside the oversampler.
      built.dynamic.push_back(feq_biquad_coefficients_designed(
          band.type, band.frequency, band.gain_db, band.quality,
          chain->sample_rate, eq.model, eq.model_amount, eq.matched));
    }
  }
  // How the cascade runs this set, for the fade from the one before it
  // (`chain_eq_fade.cpp`); numbered like the tone, so the audio thread sees
  // it came.
  built.eq_enabled = eq.enabled != 0 ? 1 : 0;
  built.eq_running = eq.enabled != 0 && eq.phase == FEQ_PHASE_MINIMUM &&
                             eq.isolate == 0
                         ? 1
                         : 0;
  built.engine = eq.engine;
  built.oversample = eq.oversample;
  built.stereo = eq.stereo;
  built.eq_generation = ++chain->eq_built;
  // The curve the Maximizer limits through, as the target the one playing
  // glides to (`chain_tone.cpp`); numbered, so the audio thread sees it came.
  built.tone = chain->settings.tone;
  built.tone_generation = ++chain->tone_built;

  /**
   * The detectors are refreshed in place, and that is safe where the
   * coefficients were not.
   *
   * `feq_band_dynamics_refresh` writes scalars into an element that already
   * exists — no allocation, no resize, and the array itself was sized to the
   * maximum rack at `create`. A torn read of one threshold for one block is a
   * band opening a hair early; a torn read of a vector's data pointer is a
   * segfault. Those are not the same hazard and do not need the same cure.
   */
  const size_t count = live.size();
  for (uint32_t channel = 0; channel < FEQ_CHAIN_MAX_CHANNELS; ++channel) {
    for (size_t index = 0; index < count; ++index) {
      feq_band_dynamics_refresh(
          &chain->band_dynamics[static_cast<size_t>(channel) *
                                    FeqChain::kBandStride +
                                index],
          eq.enabled, live[index]->enabled, live[index]->dynamic,
          live[index]->gain_db, live[index]->threshold_db, chain->sample_rate);
    }
  }

  // The one store the audio thread is waiting on. Everything above is already
  // written, and `release` is what guarantees it is visible before the index.
  chain->published_coefficients.store(next_index, std::memory_order_release);
}

void chain_process_eq(FeqChain* chain, float* const* channels,
                      uint32_t frames) {
  const FeqChainEqSettings& eq = chain->settings.eq;
  /**
   * Mid/side wraps the whole loop rather than sitting inside it.
   *
   * Mid is what both speakers share and side is what they differ by, so
   * neither exists in one channel: the sum and the difference have to be taken
   * across the pair before anything is filtered, and undone after.
   */
  const bool mid_side =
      (eq.stereo != FEQ_STEREO_STEREO || eq.mono_below_hz > 0.0) &&
      chain->channels >= 2;
  if (mid_side) {
    chain_encode_mid_side(channels, frames);
  }

  if (eq.stereo == FEQ_STEREO_STEREO && chain->channels >= 2) {
    process_eq_stereo(chain, channels, frames);
  } else {
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      // In mid/side the front pair's two slots are no longer left and right:
      // slot 0 carries the middle and slot 1 the difference, and only the
      // chosen one is filtered. The other passes untouched, which is what
      // makes this a tool rather than a different way of spelling stereo.
      // Any channel beyond the pair has no side to speak of and is filtered
      // plainly, in its own slot.
      const bool skip =
          mid_side && ((eq.stereo == FEQ_STEREO_MID && channel == 1) ||
                       (eq.stereo == FEQ_STEREO_SIDE && channel == 0));
      const uint32_t slot_index = channel;
      if (!skip) {
        process_eq_channel(chain, channels[channel], frames, slot_index);
        continue;
      }
      ChainEqSlot& slot = chain->slots[slot_index];
      // Keep this domain's isolate reference current even while it is the half
      // the selected mid/side mode passes through untouched.
      std::copy(channels[channel], channels[channel] + frames,
                slot.delayed_input.begin());
      feq_delay_line_process(&slot.isolate_delay, slot.delayed_input.data(),
                             frames);
      if (chain_linear_running(chain) != 0) {
        // Untouched, but exactly as late as the half that went through the
        // convolver. Without this the decode below recombines two signals
        // 181 ms apart.
        feq_delay_line_process(&slot.bypass_delay, channels[channel], frames);
      }
      if (eq.enabled == 0) {
        continue;
      }
      // The unselected half contributes nothing. Fade that dry-only domain out
      // under isolate rather than leaving it audible beside the selected
      // domain's difference signal.
      if (eq.phase == FEQ_PHASE_MINIMUM && eq.isolate != 0 &&
          (chain->convolvers[0] == nullptr || chain->convolver_priming > 0)) {
        std::fill(channels[channel], channels[channel] + frames, 0.0f);
        slot.dry_mix = 0.0;
        continue;
      }
      const double dry_target = eq.isolate != 0 ? 0.0 : 1.0;
      double dry_mix = slot.dry_mix;
      const double smooth =
          1.0 - std::exp(-1.0 / ((kEqIsolateSmoothingMs / 1000.0) *
                                 chain->sample_rate));
      for (uint32_t at = 0; at < frames; ++at) {
        dry_mix += (dry_target - dry_mix) * smooth;
        channels[channel][at] = static_cast<float>(
            static_cast<double>(channels[channel][at]) * dry_mix);
      }
      if (std::fabs(dry_target - dry_mix) < 0.0001) {
        dry_mix = dry_target;
      }
      slot.dry_mix = dry_mix;
    }
  }
  // Every domain this block was mixed at the same point of the crossing.
  chain_eq_fade_advance(chain, frames);

  chain_settle_convolvers(chain, frames);

  /**
   * The phase-cancellation fix, applied to the side channel only.
   *
   * Bass out of phase between the two channels vanishes the moment they are
   * summed — a phone speaker, a mono PA and most Bluetooth speakers all do
   * that — so a mix can sound enormous on headphones and gutless everywhere
   * else. High-passing the SIDE removes the part that can cancel and leaves
   * the middle whole. Above the corner the image is untouched: width is worth
   * keeping wherever it cannot cancel.
   */
  if (mid_side && chain->active->has_mono_below != 0) {
    feq_biquad_process(&chain->side_highpass, channels[1], frames,
                       &chain->active->mono_below);
  }
  if (mid_side) {
    chain_decode_mid_side(channels, frames);
  }
}
