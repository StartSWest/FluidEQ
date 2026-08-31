/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The four modules in the order they have to run, and Isolate.
 *
 * Clicks FIRST. An impulse is broadband: left in place it lands in every bin
 * of the spectral module's window at once and is measured as signal at every
 * frequency, so a record with ticks on it trains the estimator to leave the
 * whole spectrum alone.
 *
 * Hum SECOND, so its partials are gone before a floor is estimated. A 50 Hz
 * tone standing 30 dB over the floor is not noise by any statistic the
 * spectral module computes, and leaving it in place would have the adaptive
 * tracker treat it as programme.
 *
 * Hiss THIRD, against what those two left. Voice LAST, on a signal the cheap
 * modules have already cleaned — the model was trained on speech in noise, not
 * on speech in noise with ticks and mains buzz.
 */

#include <algorithm>
#include <cmath>
#include <cstring>
#include <new>

#include "denoise_internal.h"
#include "fluideq/denoise.h"

namespace {

constexpr double kProfileLowHz = 20.0;
constexpr double kProfileHighHz = 20000.0;

/**
 * Octaves per band, derived rather than written down.
 *
 * Must equal `NOISE_PROFILE_OCTAVES_PER_BAND` exactly. Writing 0.25 on either
 * side instead of deriving it would put the top band's edge at 20.6 kHz on
 * that side only, and the two would disagree about where every band after the
 * first one sits — a profile that subtracts the wrong amount at every
 * frequency while still looking like a plot of a noise floor.
 */
double octaves_per_band() {
  return std::log2(kProfileHighHz / kProfileLowHz) /
         static_cast<double>(FEQ_DENOISE_PROFILE_BANDS);
}

}  // namespace

extern "C" {

double feq_denoise_band_hz(uint32_t index) {
  return kProfileLowHz *
         std::pow(2.0, (static_cast<double>(index) + 0.5) * octaves_per_band());
}

double feq_denoise_profile_level_at(const double* bands_db, double hz) {
  if (bands_db == nullptr) {
    return kDenoiseSilenceDb;
  }
  const double position =
      std::log2(std::max(1e-6, hz) / kProfileLowHz) / octaves_per_band() - 0.5;
  if (position <= 0.0) {
    return bands_db[0];
  }
  const uint32_t last = FEQ_DENOISE_PROFILE_BANDS - 1;
  if (position >= static_cast<double>(last)) {
    return bands_db[last];
  }
  const uint32_t lower = static_cast<uint32_t>(position);
  const double fraction = position - static_cast<double>(lower);
  // Interpolated in dB rather than in magnitude: a noise floor plotted against
  // log frequency is close to piecewise linear in dB, and interpolating
  // magnitudes instead pulls the curve toward whichever neighbour is louder,
  // which reads as a tilt nobody measured.
  return bands_db[lower] * (1.0 - fraction) + bands_db[lower + 1] * fraction;
}

void feq_denoise_settings_defaults(FeqDenoiseSettings* settings) {
  if (settings == nullptr) {
    return;
  }
  *settings = FeqDenoiseSettings{};
  settings->enabled = 0;
  settings->isolate = 0;
  settings->profile_source = FEQ_DENOISE_PROFILE_SCANNED;
  settings->hiss.enabled = 1;
  settings->hiss.amount = 0.5;
  settings->hiss.floor_db = -18.0;
  settings->hiss.sensitivity_db = 3.0;
  settings->hiss.smoothing = 0.7;
  settings->hum.enabled = 1;
  settings->hum.mode = FEQ_DENOISE_HUM_AUTO;
  settings->hum.harmonics = 6.0;
  settings->hum.depth_db = 24.0;
  settings->hum.quality = 30.0;
  settings->click.enabled = 1;
  settings->click.sensitivity = 0.5;
  settings->click.max_repair_samples = 32.0;
  settings->voice.enabled = 0;
  settings->voice.amount = 1.0;
}

FeqDenoise* feq_denoise_create(double sample_rate,
                               uint32_t channels,
                               uint32_t maximum_block_frames) {
  if (!(sample_rate > 0.0) || channels == 0 || maximum_block_frames == 0) {
    return nullptr;
  }
  FeqDenoise* denoise = new (std::nothrow) FeqDenoise();
  if (denoise == nullptr) {
    return nullptr;
  }
  denoise->sample_rate = sample_rate;
  denoise->channels = std::min(channels, uint32_t{FEQ_DENOISE_CHANNELS});
  denoise->max_frames = maximum_block_frames;
  feq_denoise_settings_defaults(&denoise->settings);

  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    denoise->profile.bands_db[band] = kDenoiseSilenceDb;
  }
  denoise->profile.floor_dbfs = kDenoiseSilenceDb;

  denoise->live_floor_db.assign(FEQ_DENOISE_PROFILE_BANDS, kDenoiseSilenceDb);

  denoise->residual.resize(denoise->channels);
  for (auto& channel : denoise->residual) {
    channel.assign(maximum_block_frames, 0.0f);
  }

  // Sized once for the deepest the stage can ever delay — every module on, at
  // the highest rate — rather than resized when a module is toggled. The
  // alternative reallocates a buffer the callback is reading, which is the
  // class of bug the Maximizer's look-ahead already had to be rescued from.
  denoise->dry_delay.resize(denoise->channels);
  for (auto& channel : denoise->dry_delay) {
    channel.assign(kDenoiseMaxLatencyFrames + maximum_block_frames, 0.0f);
  }

  denoise_spectral_configure(denoise);
  denoise_hum_configure(denoise);
  denoise_click_configure(denoise);
  denoise_voice_configure(denoise);
  return denoise;
}

void feq_denoise_destroy(FeqDenoise* denoise) {
  if (denoise == nullptr) {
    return;
  }
  denoise_voice_unload(denoise);
  delete denoise;
}

void feq_denoise_configure(FeqDenoise* denoise,
                           const FeqDenoiseSettings* settings) {
  if (denoise == nullptr || settings == nullptr) {
    return;
  }
  denoise->settings = *settings;
  denoise_spectral_configure(denoise);
  denoise_hum_configure(denoise);
  denoise_click_configure(denoise);
  denoise_voice_configure(denoise);
}

void feq_denoise_set_profile(FeqDenoise* denoise,
                             const FeqNoiseProfile* profile) {
  if (denoise == nullptr) {
    return;
  }
  if (profile == nullptr) {
    denoise->profile_ready = false;
    denoise->profile_bins_valid = false;
    // The hum comb is built from the profile's measured partials, so dropping
    // one has to rebuild it rather than leave notches at frequencies that are
    // no longer known to contain anything.
    denoise_hum_configure(denoise);
    return;
  }
  // Copied rather than borrowed: the caller's buffer comes off an IPC frame
  // that is reused, and the audio thread reads this for a whole track.
  denoise->profile = *profile;
  denoise->profile_ready = true;
  denoise->profile_bins_valid = false;
  denoise_spectral_configure(denoise);
  denoise_hum_configure(denoise);
}

int feq_denoise_load_voice_model(FeqDenoise* denoise,
                                 const char* model_path,
                                 const char* runtime_path) {
  if (denoise == nullptr) {
    return 0;
  }
  if (model_path == nullptr) {
    denoise_voice_unload(denoise);
    return 1;
  }
  return denoise_voice_load_model(denoise, model_path, runtime_path);
}

void feq_denoise_reset(FeqDenoise* denoise) {
  if (denoise == nullptr) {
    return;
  }
  denoise_spectral_reset(denoise);
  denoise_hum_reset(denoise);
  denoise_click_reset(denoise);
  denoise_voice_reset(denoise);
  // Isolate's delay line holds the previous stream's audio. Left in place, the
  // first blocks after a seek subtract a bar of the old position from the new
  // one, which is the same defect this delay exists to remove.
  for (auto& channel : denoise->dry_delay) {
    std::fill(channel.begin(), channel.end(), 0.0f);
  }
  denoise->dry_cursor = 0;
  denoise->reported_reduction_db.store(0.0, std::memory_order_relaxed);
  denoise->reported_clicks.store(0, std::memory_order_relaxed);
  denoise->reported_voice_underruns.store(0, std::memory_order_relaxed);
}

void feq_denoise_process(FeqDenoise* denoise,
                         float* const* channels,
                         uint32_t frames) {
  if (denoise == nullptr || channels == nullptr || frames == 0 ||
      frames > denoise->max_frames || denoise->settings.enabled == 0) {
    return;
  }

  const bool isolate = denoise->settings.isolate != 0;
  /*
   * The delay the wet path is about to cost, read BEFORE processing.
   *
   * It has to be the same number for the write and the read below, and the
   * modules can be reconfigured between blocks — reading it twice would align
   * the subtraction to two different delays across one toggle and click.
   */
  const uint32_t latency = feq_denoise_latency_frames(denoise);
  const uint32_t ring =
      denoise->dry_delay.empty()
          ? 0
          : static_cast<uint32_t>(denoise->dry_delay[0].size());

  if (isolate && ring > 0) {
    for (uint32_t c = 0; c < denoise->channels; c += 1) {
      float* line = denoise->dry_delay[c].data();
      for (uint32_t i = 0; i < frames; i += 1) {
        line[(denoise->dry_cursor + i) % ring] = channels[c][i];
      }
    }
  }

  const uint32_t clicks = denoise_click_process(denoise, channels, frames);
  denoise_hum_process(denoise, channels, frames);
  const double reduction_db =
      denoise_spectral_process(denoise, channels, frames);
  const uint32_t underruns = denoise_voice_process(denoise, channels, frames);

  if (isolate && ring > 0) {
    /*
     * What was removed: the difference between the dry signal and the wet one,
     * TIME-ALIGNED.
     *
     * The alignment is the whole correctness of this control. Subtracting the
     * undelayed input from the delayed output is not a residual, it is the
     * input minus a shifted copy of itself — a comb filter whose notches sit
     * at multiples of 1/D. At this stage's real delay that is an audible
     * slapback, and it was reported as a chamber effect on the first listen,
     * which is exactly what it was.
     */
    for (uint32_t c = 0; c < denoise->channels; c += 1) {
      const float* line = denoise->dry_delay[c].data();
      float* wet = channels[c];
      for (uint32_t i = 0; i < frames; i += 1) {
        const uint32_t at =
            (denoise->dry_cursor + i + ring - latency) % ring;
        wet[i] = line[at] - wet[i];
      }
    }
  }

  if (ring > 0) {
    denoise->dry_cursor = (denoise->dry_cursor + frames) % ring;
  }

  denoise->reported_reduction_db.store(reduction_db, std::memory_order_relaxed);
  denoise->reported_clicks.fetch_add(clicks, std::memory_order_relaxed);
  denoise->reported_voice_underruns.fetch_add(underruns,
                                              std::memory_order_relaxed);

  const bool adaptive =
      denoise->settings.profile_source == FEQ_DENOISE_PROFILE_ADAPTIVE ||
      !denoise->profile_ready;
  denoise->reported_floor_db.store(
      adaptive ? kDenoiseSilenceDb : denoise->profile.floor_dbfs,
      std::memory_order_relaxed);
}

uint32_t feq_denoise_latency_frames(const FeqDenoise* denoise) {
  if (denoise == nullptr || denoise->settings.enabled == 0) {
    return 0;
  }
  uint32_t latency = 0;
  if (denoise->settings.click.enabled != 0 && !denoise->click.empty()) {
    /*
     * The whole buffer LESS ONE. The read head is the write head plus one, so
     * a sample leaving is `capacity - 1` old, not `capacity`.
     *
     * One sample sounds like a rounding argument and is not. Isolate takes a
     * difference, and the difference of a signal against itself shifted by a
     * single sample is a first-order high-pass — 6 dB per octave, and the
     * whole programme comes through it. Reported as hearing the song in
     * Isolate, which is precisely what a one-sample error produces.
     */
    latency += denoise->click[0].capacity - 1;
  }
  if (denoise->settings.hiss.enabled != 0 && denoise->window > 0) {
    /*
     * A full window, MEASURED rather than reasoned about.
     *
     * The reasoning said a window less a hop, on the argument that a sample
     * enters the accumulator one hop from its end. It was wrong by exactly one
     * hop: an impulse fed in at 2048 leaves at 3072 with a 1024-point window,
     * at unit amplitude and unit energy. The transform reconstructs perfectly
     * — it simply does it a whole window later.
     *
     * Under-reporting this is not only an Isolate problem. The chain adds it
     * into `feq_chain_latency_frames`, which is what a deck handoff aligns
     * against, so a stage that lies about its delay puts every crossfade out
     * by the difference.
     */
    latency += denoise->window;
  }
  latency += denoise_voice_latency_frames(denoise);
  return latency;
}

void feq_denoise_report(const FeqDenoise* denoise, FeqDenoiseReport* out) {
  if (out == nullptr) {
    return;
  }
  if (denoise == nullptr) {
    *out = FeqDenoiseReport{};
    out->noise_floor_db = kDenoiseSilenceDb;
    return;
  }
  out->reduction_db =
      denoise->reported_reduction_db.load(std::memory_order_relaxed);
  out->noise_floor_db =
      denoise->reported_floor_db.load(std::memory_order_relaxed);
  out->clicks_repaired =
      denoise->reported_clicks.load(std::memory_order_relaxed);
  out->voice_underruns =
      denoise->reported_voice_underruns.load(std::memory_order_relaxed);
  out->profile_ready = denoise->profile_ready ? 1 : 0;
  out->voice_model_loaded =
      denoise->voice_model_loaded.load(std::memory_order_relaxed);
  for (uint32_t band = 0; band < FEQ_DENOISE_PROFILE_BANDS; band += 1) {
    out->floor_bands_db[band] =
        band < denoise->live_floor_db.size()
            ? denoise->live_floor_db[band]
            : kDenoiseSilenceDb;
  }
}

}  // extern "C"
