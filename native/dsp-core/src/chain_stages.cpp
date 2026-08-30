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

namespace {

/**
 * The loudest sample in each of the two meter channels.
 *
 * A mono source fills both, because the Normalizer card draws an L and an R
 * bar unconditionally: leaving the second at zero would report the right
 * channel as silent on material that has no right channel to be silent.
 */
void peak_pair(const float* const* channels,
               uint32_t channel_count,
               uint32_t frames,
               double* out_peaks) {
  out_peaks[0] = 0.0;
  out_peaks[1] = 0.0;
  const uint32_t span = channel_count < 2 ? channel_count : 2;
  for (uint32_t channel = 0; channel < span; ++channel) {
    double peak = 0.0;
    for (uint32_t at = 0; at < frames; ++at) {
      const double magnitude = std::fabs(static_cast<double>(
          channels[channel][at]));
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    out_peaks[channel] = peak;
  }
  if (span == 1) {
    out_peaks[1] = out_peaks[0];
  }
}

/** The bars, plus the gain that separates them, in the card's own units. */
void chain_publish_normalizer_meter(FeqChain* chain,
                                    const double* input_peaks,
                                    const double* output_peaks,
                                    uint32_t frames) {
  const double applied_gain_db =
      chain->input_gain_now > 1e-6 ? 20.0 * std::log10(chain->input_gain_now)
                                   : -120.0;
  feq_meters_publish_normalizer(chain->meters, input_peaks, output_peaks,
                                applied_gain_db, frames, chain->sample_rate);
}

}  // namespace

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
  /**
   * The before-peaks and the silence test are the same scan.
   *
   * The Normalizer card's four bars and its applied-gain readout came from the
   * worklet, which is a passthrough now — so they sat at silence with a
   * constant 0.0 dB beside them however loud the track was. They are measured
   * here because here is the only place that sees the signal on both sides of
   * the gain.
   */
  double input_peaks[2] = {0.0, 0.0};
  peak_pair(channels, chain->channels, frames, input_peaks);
  const bool has_programme =
      input_peaks[0] > 1e-8 || input_peaks[1] > 1e-8;
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
    // Published on the silent path too, or the bars stop where the music
    // stopped and stay there.
    chain_publish_normalizer_meter(chain, input_peaks, input_peaks, frames);
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
  double output_peaks[2] = {0.0, 0.0};
  peak_pair(channels, chain->channels, frames, output_peaks);
  chain_publish_normalizer_meter(chain, input_peaks, output_peaks, frames);
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
/**
 * Stereo width, and only when there are two channels to have width between.
 *
 * A mono chain has no side signal at all, so there is nothing here to scale and
 * nothing to decorrelate. Calling the processor with one channel would read a
 * second one that does not exist.
 */
void chain_process_dimension(FeqChain* chain, float* const* channels,
                             uint32_t frames) {
  if (chain->channels < 2) {
    return;
  }
  if (chain->settings.dimension.enabled == 0) {
    // Left settled rather than reset every block: switching the stage back on
    // must not replay an all-pass network full of a minute-old signal.
    feq_dimension_reset(&chain->dimension);
    return;
  }
  FeqDimensionSettings settings{};
  settings.enabled = 1;
  settings.low_width = chain->settings.dimension.low_width;
  settings.mid_width = chain->settings.dimension.mid_width;
  settings.high_width = chain->settings.dimension.high_width;
  settings.low_hz = chain->settings.dimension.low_hz;
  settings.high_hz = chain->settings.dimension.high_hz;
  settings.decorrelation = chain->settings.dimension.decorrelation;
  feq_dimension_process(&chain->dimension, channels[0], channels[1], frames,
                        &settings, chain->sample_rate);
}

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
    // The whole ring, and NOT the first `frames` slots of it. The ring is the
    // reduction in flight and its length is the look-ahead, which has nothing
    // to do with the block size: at a 1 ms look-ahead it holds 49 floats while
    // a block is 480, so reading one slot per frame read 431 floats past the
    // end of the vector. Every slot is rewritten within one look-ahead, so
    // scanning all of them also stops the meter missing a peak that lands
    // between two blocks.
    for (size_t at = 0; at < chain->maximizer_reduction.size(); ++at) {
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

