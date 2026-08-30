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

  denoise->residual.resize(denoise->channels);
  for (auto& channel : denoise->residual) {
    channel.assign(maximum_block_frames, 0.0f);
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
  if (isolate) {
    for (uint32_t c = 0; c < denoise->channels; c += 1) {
      std::memcpy(denoise->residual[c].data(), channels[c],
                  frames * sizeof(float));
    }
  }

  const uint32_t clicks = denoise_click_process(denoise, channels, frames);
  denoise_hum_process(denoise, channels, frames);
  const double reduction_db =
      denoise_spectral_process(denoise, channels, frames);
  const uint32_t underruns = denoise_voice_process(denoise, channels, frames);

  if (isolate) {
    // What was removed, which is the difference and nothing cleverer. This is
    // the one control that lets a listener hear whether the stage is taking
    // hiss or taking the hi-hat, so it has to be the actual residual rather
    // than a reconstruction of it.
    for (uint32_t c = 0; c < denoise->channels; c += 1) {
      const float* dry = denoise->residual[c].data();
      float* wet = channels[c];
      for (uint32_t i = 0; i < frames; i += 1) {
        wet[i] = dry[i] - wet[i];
      }
    }
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
    latency += denoise->click[0].capacity;
  }
  if (denoise->settings.hiss.enabled != 0 && denoise->window > 0) {
    // Weighted overlap-add: a sample enters the accumulator one hop from its
    // end and reaches the output after the remaining frames have overlapped
    // it, so the delay is the window less one hop rather than the window.
    latency += denoise->window - denoise->hop;
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
}

}  // extern "C"
