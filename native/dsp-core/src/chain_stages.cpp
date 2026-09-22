/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The stages that are one call each: gain in, width, both bass stages,
 * limiter, gain out. Split from `chain.cpp` so that file holds only
 * lifecycle and order.
 */

#include "chain_internal.h"

#include <algorithm>
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
  if (chain->live_normalizer != nullptr) {
    const auto reading = feq_live_normalizer_process(chain->live_normalizer,
        channels, frames, &chain->settings.normalizer);
    double output_peaks[2]{};
    peak_pair(channels, chain->channels, frames, output_peaks);
    feq_meters_publish_normalizer(chain->meters, input_peaks, output_peaks,
        reading.applied_gain_db, frames, chain->sample_rate);
    feq_meters_publish_live_input(chain->meters, reading.input_true_peak_db,
                                  reading.input_lufs, reading.reference_lufs, reading.level_state);
    return;
  }
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
  const bool enabled = chain->settings.dimension.enabled != 0 &&
                       !feq_room_position_protected(chain->room);
  if (!enabled && feq_dimension_fade(&chain->dimension) <= 0.0) {
    // Reset every block it is off for, not left settled: switching the stage
    // back on must not replay an all-pass network full of a minute-old signal.
    // Only once it is all the way out, though — a stage still fading needs the
    // history it is fading.
    feq_dimension_reset(&chain->dimension);
    return;
  }
  FeqDimensionSettings settings{};
  settings.enabled = enabled ? 1 : 0;
  settings.low_width = chain->settings.dimension.low_width;
  settings.mid_width = chain->settings.dimension.mid_width;
  settings.high_width = chain->settings.dimension.high_width;
  settings.low_hz = chain->settings.dimension.low_hz;
  settings.high_hz = chain->settings.dimension.high_hz;
  settings.decorrelation = chain->settings.dimension.decorrelation;
  feq_dimension_process(&chain->dimension, channels[0], channels[1], frames,
                        &settings, chain->sample_rate);
}

/**
 * The generated low end, and only where there are two channels to generate it.
 *
 * The stage sources every harmonic from `(low[0] + low[1]) / 2` and writes back
 * over both, so a one-channel chain has no second buffer for it to read. That
 * is the same reason `chain_process_dimension` above turns itself off.
 */
void chain_process_bass_forge(FeqChain* chain, float* const* channels,
                              uint32_t frames) {
  if (chain->channels < 2) {
    return;
  }
  if (chain->settings.bass_forge.enabled == 0) {
    // Reset every block it is off for, not left settled: switching the stage
    // back on must not replay a crossover and a set of meter followers holding
    // a minute-old signal, and `chain.cpp` publishes the bands unconditionally
    // so a stage that kept them would hold a stale reading on screen.
    feq_bass_forge_reset(&chain->bass_forge);
    return;
  }
  FeqBassForgeSettings settings{};
  settings.enabled = 1;
  settings.isolate = chain->settings.bass_forge.isolate;
  // The eight-band analyser is a graph and nothing else, so it runs only while
  // something is reading it — the gate every other stage's meter work is
  // already behind, inside `feq_meters_capture`.
  settings.meters = feq_meters_enabled(chain->meters);
  settings.split_hz = chain->settings.bass_forge.split_hz;
  settings.drive_db = chain->settings.bass_forge.drive_db;
  settings.sub_amount = chain->settings.bass_forge.sub_amount;
  settings.presence_amount = chain->settings.bass_forge.presence_amount;
  settings.texture = chain->settings.bass_forge.texture;
  settings.mix = chain->settings.bass_forge.mix;
  feq_bass_forge_process(&chain->bass_forge, channels, chain->channels, frames,
                         &settings, chain->sample_rate);
}

/**
 * How the low end hits, in the same two-channel-only shape and for the same
 * reason: the bloom is fed from the low band summed to mono.
 */
void chain_process_bass_punch(FeqChain* chain, float* const* channels,
                              uint32_t frames) {
  if (chain->channels < 2) {
    return;
  }
  // Game mode, with Punch off: skipped outright, alignment and all. The
  // standby delay exists only so that switching Punch on never moves the
  // audio, and a player would rather have the 11 ms than that comfort —
  // switching Punch on in game mode moves the audio once, and that is the
  // trade. `feq_chain_latency_frames` leaves the term out on the same test.
  if (chain_bass_punch_idle(chain)) {
    chain->bass_punch_skipped = true;
    return;
  }
  if (chain->bass_punch_skipped) {
    // Its filters last ran before the skip; from silence is the only start
    // that does not replay a moment of old audio into the new.
    feq_bass_punch_reset(&chain->bass_punch);
    chain->bass_punch_skipped = false;
  }
  // Keep dry alignment and histories current under bypass. Skipping this path
  // would jump playback by the FIR delay whenever Bass Punch was toggled.
  FeqBassPunchSettings settings{};
  settings.enabled = chain->settings.bass_punch.enabled;
  settings.isolate = chain->settings.bass_punch.isolate;
  settings.split_hz = chain->settings.bass_punch.split_hz;
  settings.attack = chain->settings.bass_punch.attack;
  settings.sustain = chain->settings.bass_punch.sustain;
  settings.bloom_amount = chain->settings.bass_punch.bloom_amount;
  settings.bloom_decay_ms = chain->settings.bass_punch.bloom_decay_ms;
  settings.duck = chain->settings.bass_punch.duck;
  settings.mix = chain->settings.bass_punch.mix;
  feq_bass_punch_process(&chain->bass_punch, channels, chain->channels, frames,
                         &settings, chain->sample_rate);
  // The pair has just been delayed by the FIR, on or off; the channels
  // beyond it are delayed by the same amount or the image smears.
  chain_process_punch_align(chain, channels, frames);
}

void chain_process_denoise_align(FeqChain* chain, float* const* channels,
                                 uint32_t frames) {
  for (uint32_t channel = FEQ_CHAIN_CHANNELS; channel < chain->channels;
       ++channel) {
    feq_delay_line_process(&chain->denoise_align[channel], channels[channel],
                           frames);
  }
}

void chain_process_punch_align(FeqChain* chain, float* const* channels,
                               uint32_t frames) {
  for (uint32_t channel = FEQ_CHAIN_CHANNELS; channel < chain->channels;
       ++channel) {
    feq_delay_line_process(&chain->punch_align[channel], channels[channel],
                           frames);
  }
}

void chain_apply_denoise_alignment(FeqChain* chain) {
  const uint32_t latency = feq_denoise_latency_frames(chain->denoise);
  for (uint32_t channel = FEQ_CHAIN_CHANNELS; channel < chain->channels;
       ++channel) {
    FeqDelayLine& line = chain->denoise_align[channel];
    if (line.buffer == nullptr) {
      continue;
    }
    // One integer the next sample reads; the audio already in the line stays
    // where it is. The front pair's own restoration ring moves by the same
    // step at the same moment, which is a step in both rather than a drift
    // between them.
    line.delay = latency < line.capacity ? latency : line.capacity - 1;
  }
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
   * the limiter it calls, so the stage could only ever attenuate.
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

namespace {

/** Below this there is nothing to measure: BS.1770's absolute gate. */
constexpr double kLiveMasterGateLufs = -70.0;
/** Enough programme for a gated integration to mean something. */
constexpr double kLiveMasterSettleSeconds = 3.0;
/** How long the makeup takes to arrive once it changes. */
constexpr double kLiveMasterGlideSeconds = 2.0;

/**
 * The Master's makeup where the chain has to measure the programme itself.
 *
 * Runs on the signal about to receive the master gain — after Auto Headroom,
 * which is the stage that has already computed this block's true peak — and
 * follows the same arithmetic the app uses on a cached analysis: the target
 * minus the programme's integrated loudness, capped by the peak room it has
 * left plus the limiting the listener has agreed to spend.
 *
 * Two honest differences from the Library's number, neither of which moves
 * the result by more than a fraction of a decibel: the loudness is measured
 * after the limiter rather than before it, so any reduction it is already
 * applying counts as programme; and the peak is the true peak of the loudest
 * block so far rather than of the whole file, which a first play only
 * approaches as the song goes on.
 */
void chain_update_live_master(FeqChain* chain, float* const* channels,
                              uint32_t frames) {
  const auto& master = chain->settings.master;
  const bool wanted = master.enabled != 0 && master.loudness_maximize != 0 &&
                      chain->host_track_gains == 0 &&
                      chain->programme_meter != nullptr;
  if (!wanted) {
    // Nothing measured means nothing applied, and the gain that is already on
    // the signal leaves the way every other gain here does rather than in a
    // step: switching the stage off must not click.
    chain->live_master_target_db = 0.0;
  } else {
    if (chain->leveling != nullptr) {
      FeqSongLevel song{};
      if (feq_leveling_memory_read_song(chain->leveling, &song) != 0 &&
          song.song_id != chain->live_master_song) {
        chain->live_master_song = song.song_id;
        feq_loudness_meter_reset(chain->programme_meter);
        chain->live_master_peak_db = -120.0;
        chain->live_master_frames = 0;
        chain->live_master_target_db = 0.0;
      }
    }
    feq_loudness_meter_process(chain->programme_meter, channels, frames);
    chain->live_master_frames += static_cast<int64_t>(frames);
    const double heard_seconds =
        static_cast<double>(chain->live_master_frames) / chain->sample_rate;
    FeqLoudnessReading reading{};
    feq_loudness_meter_read(chain->programme_meter, &reading);
    if (heard_seconds >= kLiveMasterSettleSeconds &&
        reading.integrated_lufs > kLiveMasterGateLufs) {
      const double requested =
          master.loudness_target_lufs - reading.integrated_lufs;
      double applied = 0.0;
      if (requested <= 0.0) {
        // A target is a target in both directions: a record already louder
        // than the chosen level is brought DOWN to it, or the dial would mean
        // "how much boost at most" and read as broken on modern masters.
        applied = std::max(FEQ_MASTER_LOUDNESS_MIN_DB, requested);
      } else {
        const double room = master.ceiling_db - chain->live_master_peak_db -
                            std::max(0.0, master.output_trim_db);
        const double allowed = room + master.peak_limiting_db;
        applied = std::max(
            0.0, std::min(std::min(FEQ_MASTER_LOUDNESS_MAX_DB, requested),
                          allowed));
      }
      chain->live_master_target_db = applied;
    }
  }
  const double glide =
      -std::expm1(-static_cast<double>(frames) /
                  (kLiveMasterGlideSeconds * chain->sample_rate));
  chain->live_master_now_db +=
      (chain->live_master_target_db - chain->live_master_now_db) * glide;
}

}  // namespace

/**
 * The chain's final user gain, after every creative and level-dependent stage.
 *
 * A gain here can stop the completed result overloading without changing how
 * hard the Exciter or the Fuzz was driven. The ramp is identical in every
 * channel and committed only after all of them have used the same start value.
 */
void chain_process_master_output(FeqChain* chain, float* const* channels,
                           uint32_t frames) {
  chain_update_live_master(chain, channels, frames);
  /**
   * Matched listen drops the makeup HERE and nowhere earlier.
   *
   * Auto Headroom has already reserved the whole makeup, so every sample has
   * been limited exactly as it would be at full loudness — the drive into the
   * ceiling, the reduction, the release, all identical. Only the level that
   * leaves is different, which is the entire point: an A/B decided by which
   * side is louder is not an A/B.
   */
  const double makeup_db =
      chain->settings.master.matched_bypass != 0
          ? 0.0
          : chain->master_loudness_now_db + chain->live_master_now_db;
  const double total_db =
      chain->settings.master.output_trim_db + makeup_db;
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
