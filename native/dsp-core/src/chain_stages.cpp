/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The four stages that are one loop each: gain in, compressor, limiter, gain
 * out. Split from `chain.cpp` so that file holds only lifecycle and order.
 */

#include "chain_internal.h"

#include <cmath>

/**
 * The prevention stage before anything nonlinear can see the source.
 *
 * One gain trajectory for the pair, committed after both channels have used
 * it, so stereo balance stays exact across the ramp.
 */
void chain_process_input_gain(FeqChain* chain, float* const* channels,
                        uint32_t frames) {
  if (frames == 0) {
    return;
  }
  bool has_programme = false;
  for (uint32_t channel = 0; channel < chain->channels && !has_programme;
       ++channel) {
    for (uint32_t at = 0; at < frames; ++at) {
      if (std::fabs(channels[channel][at]) > 1e-8f) {
        has_programme = true;
        break;
      }
    }
  }
  if (!has_programme) {
    /**
     * Digital silence has no waveform to click and no musical time to ride.
     *
     * Advancing a track-level ramp through it made every Master readout creep
     * while playback was stopped, then resumed the song from an arbitrary
     * point in that invisible transition. Landing on the analysed level now
     * means the next non-zero sample starts from the right value.
     */
    chain->input_gain_now = std::pow(10.0, chain->input_gain_target_db / 20.0);
    chain->master_loudness_now_db = chain->master_loudness_target_db;
    chain->transition_elapsed = chain->transition_frames;
    return;
  }

  const double from_db =
      20.0 * std::log10(chain->input_gain_now > 1e-12 ? chain->input_gain_now
                                                      : 1e-12);
  chain->transition_elapsed += static_cast<int64_t>(frames);
  if (chain->transition_elapsed > chain->transition_frames) {
    chain->transition_elapsed = chain->transition_frames;
  }
  const double progress =
      chain->transition_frames > 0
          ? static_cast<double>(chain->transition_elapsed) /
                static_cast<double>(chain->transition_frames)
          : 1.0;
  const double next_db =
      chain->input_gain_start_db +
      (chain->input_gain_target_db - chain->input_gain_start_db) * progress;
  chain->master_loudness_now_db =
      chain->master_loudness_start_db +
      (chain->master_loudness_target_db - chain->master_loudness_start_db) *
          progress;
  const double step_gain =
      std::pow(10.0, (next_db - from_db) / static_cast<double>(frames) / 20.0);
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    double gain = chain->input_gain_now;
    for (uint32_t at = 0; at < frames; ++at) {
      gain *= step_gain;
      channels[channel][at] =
          static_cast<float>(static_cast<double>(channels[channel][at]) * gain);
    }
  }
  chain->input_gain_now = std::pow(10.0, next_db / 20.0);
}

/** The hidden compressor, which stays a linked downstream stage. */
void chain_process_compressor(FeqChain* chain, float* const* channels,
                        uint32_t frames) {
  if (chain->settings.compressor.enabled == 0) {
    for (auto& state : chain->compressors) {
      state.gain = 1.0;
    }
    return;
  }
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    feq_crossover_split(&chain->crossovers[channel], channels[channel],
                        chain->compressor_bands[channel][0].data(),
                        chain->compressor_bands[channel][1].data(),
                        chain->compressor_bands[channel][2].data(), frames,
                        chain->settings.compressor.crossover_hz[0],
                        chain->settings.compressor.crossover_hz[1],
                        chain->sample_rate);
  }
  for (uint32_t band = 0; band < FEQ_CHAIN_COMPRESSOR_BANDS; ++band) {
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      chain->pointers_a[channel] =
          chain->compressor_bands[channel][band].data();
    }
    const FeqChainCompressorBand& source =
        chain->settings.compressor.bands[band];
    FeqCompressorBand setup;
    setup.threshold_db = source.threshold_db;
    setup.ratio = source.ratio;
    setup.attack_ms = source.attack_ms;
    setup.release_ms = source.release_ms;
    setup.makeup_db = source.makeup_db;
    feq_compressor_process_linked(&chain->compressors[band],
                                  chain->pointers_a, chain->channels,
                                  frames, &setup, chain->sample_rate);
  }
  for (uint32_t channel = 0; channel < chain->channels; ++channel) {
    for (uint32_t at = 0; at < frames; ++at) {
      channels[channel][at] =
          static_cast<float>(static_cast<double>(
                                 chain->compressor_bands[channel][0][at]) +
                             static_cast<double>(
                                 chain->compressor_bands[channel][1][at]) +
                             static_cast<double>(
                                 chain->compressor_bands[channel][2][at]));
    }
  }
}

/**
 * Transparent post-EQ peak control, in the final left/right domain.
 *
 * Never inside the per-channel EQ loop: in mid/side those buffers are M and S,
 * so separate gain decisions become moving stereo width after the decode.
 * Feeding the linked detector continuously also keeps its look-ahead current
 * while bypassed, so switching it on cannot replay a stale block.
 */
void chain_process_maximizer(FeqChain* chain, float* const* channels,
                       uint32_t frames) {
  if (chain->maximizer.delay == nullptr) {
    return;
  }
  const bool on = chain->settings.maximizer.enabled != 0;
  if (!on) {
    feq_linked_limiter_reset_control(&chain->maximizer);
    chain->maximizer_reduction_db = 0.0;
  }

  /**
   * Drive, which is the half of a maximizer this stage did not have.
   *
   * Gain goes IN and the ceiling holds the top: everything under the peaks
   * comes up while the peaks stay where they were, and that gap is the whole
   * effect. Without it there was no gain term anywhere in this function or in
   * the limiter it calls, so the stage could only ever attenuate — and the
   * always-on output safety already guaranteed nothing clipped, which left it
   * doing nothing that was not already done.
   *
   * Applied here rather than folded into the ceiling because they are not the
   * same control: the ceiling is where the output is allowed to reach and Drive
   * is how hard the programme is pushed at it. Folding them would mean asking
   * for more loudness by asking for a lower ceiling, which is backwards.
   */
  const double drive =
      on ? std::pow(10.0, chain->settings.maximizer.drive_db / 20.0) : 1.0;
  if (drive != 1.0) {
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      float* samples = channels[channel];
      for (uint32_t at = 0; at < frames; ++at) {
        samples[at] = static_cast<float>(static_cast<double>(samples[at]) *
                                         drive);
      }
    }
  }

  FeqLimiterOptions options{};
  options.ceiling = on ? std::pow(10.0, chain->settings.maximizer.ceiling_db /
                                            20.0)
                       : HUGE_VAL;
  // Both of these are optional in the reference and both DEFAULT to another
  // field rather than to zero: the activation threshold to the ceiling, and the
  // limiting release to the ordinary release. Passing zero instead armed the
  // limiter at silence and gave it an instant recovery, which is inaudible on a
  // sweep and a quarter of full scale out on dense material.
  options.activation_threshold = options.ceiling;
  options.release_coefficient =
      on ? std::exp(-1.0 / ((chain->settings.maximizer.release_ms / 1000.0) *
                            chain->sample_rate))
         : 0.0;
  options.limiting_release_coefficient = options.release_coefficient;
  options.knee_db = on ? kMaximizerSoftKneeDb : 0.0;
  options.release_snap_ratio = on ? kMaximizerReleaseSnapRatio : 0.0;
  options.release_hold_samples =
      on ? std::floor((kMaximizerReleaseHoldMs / 1000.0) * chain->sample_rate +
                      0.5)
         : 0.0;
  options.attack_slew_db_per_second = 0.0;
  options.sample_rate = chain->sample_rate;
  feq_linked_limiter_process(&chain->maximizer, channels, frames, &options);

  // The deepest point of the block rather than its mean: a meter that averaged
  // would read almost nothing on exactly the dense material this stage is for,
  // where the reduction is short and frequent.
  if (on) {
    double deepest = 0.0;
    for (uint32_t at = 0; at < frames; ++at) {
      const double value = static_cast<double>(chain->maximizer_reduction[at]);
      if (value < deepest) {
        deepest = value;
      }
    }
    chain->maximizer_reduction_db = deepest;
  }
}

/**
 * The chain's final user gain, after every creative and level-dependent stage.
 *
 * A gain here can stop the completed result overloading without changing how
 * hard the Exciter or the Fuzz was driven. The ramp is identical in every
 * channel and committed only after all of them have used the same start value.
 */
void chain_process_master_output(FeqChain* chain, float* const* channels,
                           uint32_t frames) {
  const double total_db =
      chain->settings.master.output_trim_db + chain->master_loudness_now_db;
  const double target =
      chain->settings.master.enabled != 0 ? std::pow(10.0, total_db / 20.0)
                                          : 1.0;
  const double from = chain->master_gain_now;
  const double step = (target - from) / static_cast<double>(frames);
  if (from != 1.0 || target != 1.0) {
    for (uint32_t channel = 0; channel < chain->channels; ++channel) {
      for (uint32_t at = 0; at < frames; ++at) {
        channels[channel][at] = static_cast<float>(
            static_cast<double>(channels[channel][at]) *
            (from + step * static_cast<double>(at + 1)));
      }
    }
  }
  chain->master_gain_now = target;
}

