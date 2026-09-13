/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
#include "fluideq/live_normalizer.h"
#include "fluideq/loudness_meter.h"
#include "fluideq/post_filter_normalizer.h"
#include "leveling_memory_internal.h"
#include <algorithm>
#include <array>
#include <cmath>
#include <memory>
#include <vector>

struct FeqLiveNormalizer {
  double rate;
  uint32_t channels;
  uint32_t latency;
  uint64_t samples = 0;  // since the loudness window was last emptied
  uint64_t silent_samples = 0;
  bool gap_cleared = false;
  int mode = -1;
  FeqLevelingState song{};
  double song_peak = 0;  // linear twin of `song.song_peak_db`
  double settle_clock = 0;
  // The song's level and peak at the last two whole seconds of music, newest
  // first; `song.settled_*` is the one before those.
  std::array<std::array<double, 2>, 2> recent{{{-120, -120}, {-120, -120}}};
  FeqLevelingMemory* memory = nullptr;
  // Whether this leveler's state is the programme's own, rather than one that
  // should first adopt what the memory holds.
  bool live = false;
  bool gap_pending = false;
  FeqLoudnessMeter* loudness = nullptr;
  FeqPostFilterNormalizer safety{};
  std::vector<FeqTruePeak> detectors;
  std::vector<FeqTruePeak> input_detectors;
  std::vector<std::vector<float>> delay;
  std::vector<float*> planes;
  std::vector<float> reductions;
  ~FeqLiveNormalizer() { feq_loudness_meter_destroy(loudness); }
};

namespace {
constexpr double kUnknown = -120;
// The short-term window. No decision is made from a window still filling.
constexpr double kWindowSeconds = 3;
// Digital silence this long ends a programme that has no song identity. A
// named song is paused, not over, however long the silence.
constexpr double kGapSeconds = 3;
// Music heard before an unknown song's level is trusted for raising the gain.
// Twenty seconds covers most intros; the loudest passage can still come later,
// which is why lowering never waits for this.
constexpr double kSettleSeconds = 20;
// A new unknown song may raise the carried gain only while this young, and
// only when it is much quieter than the gain allows. After that the song keeps
// the gain its loudest passage left: the complaint this answers was a song
// turned down for its chorus and back up for every verse after it.
constexpr double kOpeningSeconds = 45;
constexpr double kMuchQuieter = 6;
constexpr double kRaiseShortOf = 3;
// A programme this long is a stream, a mix or a broadcast rather than a song,
// and its loudest passage is allowed to be forgotten, slowly.
constexpr double kLongProgrammeSeconds = 480;
constexpr double kReleaseSeconds = 600;
constexpr double kForegroundRange = 10;
constexpr double kQuietPassage = 6;
constexpr double kDeadband = 0.75;
constexpr double kDownDbPerSecond = 1.0;
constexpr double kUpDbPerSecond = 0.2;
constexpr double kGlideDbPerSecond = 2.0;

double db(double value) { return value > 1e-6 ? 20 * std::log10(value) : kUnknown; }
double bounded(double value, double fallback, double low, double high) {
  return std::isfinite(value) ? std::clamp(value, low, high) : fallback;
}
bool heard(double level) { return level > -100; }

void restart_settled(FeqLiveNormalizer& state) {
  const std::array<double, 2> now = {state.song.song_level, state.song.song_peak_db};
  state.recent = {now, now};
  state.song.settled_level = now[0];
  state.song.settled_peak_db = now[1];
  state.settle_clock = 0;
}

void empty_window(FeqLiveNormalizer& state) {
  state.samples = 0;
  feq_loudness_meter_reset(state.loudness);
}

/* A new programme. The gain and whether one was ever decided carry over. */
void begin_segment(FeqLiveNormalizer& state, uint64_t song_id, double level, double peak_db) {
  auto& song = state.song;
  song.song_id = song_id;
  song.known = heard(level);
  song.song_level = song.known ? std::clamp(level, -70.0, 0.0) : kUnknown;
  song.song_peak_db = song.known && heard(peak_db) ? std::min(peak_db, 12.0) : kUnknown;
  state.song_peak = heard(song.song_peak_db) ? std::pow(10.0, song.song_peak_db / 20) : 0;
  restart_settled(state);
  song.foreground_seconds = 0;
  song.glide = false;
}

double desired_gain(const FeqLevelingState& song, const FeqNormalizerSettings& settings,
                    double& requested, double& peak_room) {
  requested = bounded(settings.target_lufs, -14, -24, -5) - song.song_level;
  peak_room = bounded(settings.ceiling_db, -1, -12, -0.1) - song.song_peak_db - 0.5;
  // Preserve observed crest factor instead of boosting into continuous
  // limiting to force a LUFS target. A target is an aim, not a guarantee.
  return std::clamp(std::min(requested, peak_room), -48.0, 6.0);
}

void apply_cue(FeqLiveNormalizer& state, const feq_leveling::Cue& cue,
               const FeqNormalizerSettings& settings) {
  auto& song = state.song;
  song.cue_seen = cue.sequence;
  if (cue.song_id == 0) {
    // The player stopped saying what it plays. The song is not over until
    // silence says so; a title that flickers out and back is the same song.
    song.named = false;
    return;
  }
  const bool same = cue.song_id == song.song_id && song.song_id != 0;
  song.named = true;
  if (same) {
    if (heard(cue.level_lufs) && cue.level_lufs > song.song_level) {
      song.song_level = cue.level_lufs;
      song.known = true;
    }
    return;
  }
  begin_segment(state, cue.song_id, cue.level_lufs, cue.peak_db);
  // The window still holds the last song's closing seconds. Measured into the
  // new one, a loud ending became a quiet song's loudest passage.
  empty_window(state);
  if (!song.known) return;
  double requested = 0, peak_room = 0;
  song.target_db = desired_gain(song, settings, requested, peak_room);
  song.established = true;
  song.glide = true;
}

void silent_frames(FeqLiveNormalizer& state, uint32_t frames) {
  if (state.gap_cleared) return;
  state.silent_samples += frames;
  if (static_cast<double>(state.silent_samples) < state.rate * kGapSeconds) return;
  state.gap_cleared = true;
  empty_window(state);
  if (!state.song.named) begin_segment(state, 0, kUnknown, kUnknown);
  if (state.memory != nullptr) {
    // Another stream on this output may have gone on playing and learning
    // meanwhile; what it published is the programme now, not this copy.
    state.live = false;
    state.gap_pending = true;
  }
}

/*
 * What the song measured two to three seconds of music ago, which is what the
 * app is told the song measured. Windows names a new track about a second
 * after its audio starts, and until then that audio counts towards the old
 * song's level: a loud opening would otherwise be remembered as the quiet
 * song before it, and that song levelled too low for good.
 */
void advance_settled(FeqLiveNormalizer& state, double seconds) {
  state.settle_clock += seconds;
  if (state.settle_clock < 1) return;
  state.settle_clock -= 1;
  state.song.settled_level = state.recent[1][0];
  state.song.settled_peak_db = state.recent[1][1];
  state.recent[1] = state.recent[0];
  state.recent[0] = {state.song.song_level, state.song.song_peak_db};
}

void adopt(FeqLiveNormalizer& state) {
  if (state.live) return;
  if (state.memory != nullptr) {
    FeqLevelingState learned;
    const auto read = feq_leveling::read_learned(*state.memory, learned);
    if (read == feq_leveling::Read::busy) return;  // The next block asks again.
    if (read == feq_leveling::Read::ready) {
      state.song = learned;
      state.song_peak = heard(learned.song_peak_db) ? std::pow(10.0, learned.song_peak_db / 20) : 0;
      // What was settled stays settled; the newer seconds start again from
      // the level as it now stands.
      const double settled_level = learned.settled_level, settled_peak = learned.settled_peak_db;
      restart_settled(state);
      state.song.settled_level = settled_level;
      state.song.settled_peak_db = settled_peak;
    }
  }
  state.live = true;
  if (state.gap_pending && !state.song.named) begin_segment(state, 0, kUnknown, kUnknown);
  state.gap_pending = false;
}

void follow_cue(FeqLiveNormalizer& state, const FeqNormalizerSettings& settings) {
  if (state.memory == nullptr || !state.live) return;
  const uint64_t sequence = state.memory->cue_sequence.load(std::memory_order_acquire);
  if (sequence == state.song.cue_seen) return;
  feq_leveling::Cue cue{};
  if (feq_leveling::read_cue(*state.memory, cue)) apply_cue(state, cue, settings);
}

int level(FeqLiveNormalizer& state, const FeqLoudnessReading& measured, double peak,
          uint32_t frames, const FeqNormalizerSettings& settings) {
  auto& song = state.song;
  if (peak < 1e-5) {
    silent_frames(state, frames);
    return 3;
  }
  state.silent_samples = 0;
  state.gap_cleared = false;
  state.song_peak = std::max(state.song_peak, peak);
  song.song_peak_db = db(state.song_peak);
  const double seconds = static_cast<double>(frames) / state.rate;
  advance_settled(state, seconds);
  const bool settled = song.known || song.foreground_seconds >= kSettleSeconds;
  if (static_cast<double>(state.samples) < state.rate * kWindowSeconds ||
      measured.momentary_lufs <= -50 || measured.short_term_lufs <= -50) {
    return settled ? 3 : 2;
  }
  const double short_term = measured.short_term_lufs;
  song.song_level = std::max(song.song_level, short_term);
  const bool foreground = short_term >= song.song_level - kForegroundRange;
  if (foreground) song.foreground_seconds += seconds;
  const bool long_programme = song.foreground_seconds >= kLongProgrammeSeconds;
  if (long_programme && foreground && short_term < song.song_level) {
    song.song_level += (short_term - song.song_level) * (-std::expm1(-seconds / kReleaseSeconds));
  }
  double requested = 0, peak_room = 0;
  const double desired = desired_gain(song, settings, requested, peak_room);
  if (desired < song.target_db - kDeadband) {
    // Lowering never waits: a passage louder than the gain allows is heard now.
    song.target_db = desired;
  } else if (!song.established) {
    // The first programme after a start has no gain to keep, so its level
    // sets one in either direction once it has been heard long enough.
    if (song.foreground_seconds >= kSettleSeconds) {
      if (std::abs(desired - song.target_db) > kDeadband) song.target_db = desired;
      song.established = true;
    }
  } else if (long_programme) {
    if (desired > song.target_db + kDeadband) song.target_db = desired;
  } else if (!song.known && song.foreground_seconds >= kSettleSeconds &&
             song.foreground_seconds <= kOpeningSeconds &&
             desired - song.target_db > kMuchQuieter) {
    song.target_db = desired - kRaiseShortOf;
  }
  const double quiet = song.song_level - kQuietPassage;
  if (short_term < quiet || measured.momentary_lufs < quiet) return 3;
  if (!settled) return 2;
  if (peak_room < requested - kDeadband && song.target_db >= peak_room - kDeadband) return 5;
  return desired > song.target_db + kDeadband ? 3 : 4;
}
}

extern "C" {
FeqLiveNormalizer* feq_live_normalizer_create(double rate, uint32_t channels) {
  if (!std::isfinite(rate) || rate < 8000 || rate > 384000 ||
      channels == 0 || channels > 2) return nullptr;
  auto state = std::make_unique<FeqLiveNormalizer>();
  state->rate = rate;
  state->channels = channels;
  state->latency = feq_post_filter_normalizer_look_ahead(rate);
  state->loudness = feq_loudness_meter_create(rate, channels);
  if (state->loudness == nullptr) return nullptr;
  state->detectors.resize(channels);
  state->input_detectors.resize(channels);
  state->delay.resize(channels);
  state->planes.resize(channels);
  state->reductions.resize(state->latency + 1);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    state->delay[channel].resize(state->latency + 1);
    state->planes[channel] = state->delay[channel].data();
  }
  feq_live_normalizer_reset(state.get());
  return state.release();
}
void feq_live_normalizer_destroy(FeqLiveNormalizer* state) { delete state; }
void feq_live_normalizer_reset(FeqLiveNormalizer* state) {
  if (state == nullptr) return;
  state->samples = 0;
  state->silent_samples = 0;
  state->gap_cleared = false;
  state->mode = -1;
  state->song = FeqLevelingState{};
  state->song_peak = 0;
  restart_settled(*state);
  state->live = false;
  state->gap_pending = false;
  feq_loudness_meter_reset(state->loudness);
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    std::fill(state->delay[channel].begin(), state->delay[channel].end(), 0.0f);
    feq_true_peak_init(&state->input_detectors[channel], 4);
  }
  std::fill(state->reductions.begin(), state->reductions.end(), 0.0f);
  feq_post_filter_normalizer_init(&state->safety, state->detectors.data(),
      state->planes.data(), state->reductions.data(), state->channels,
      state->latency + 1, 4);
  feq_linked_limiter_set_look_ahead(&state->safety.limiter, state->latency);
}
void feq_live_normalizer_attach_memory(FeqLiveNormalizer* state, FeqLevelingMemory* memory) {
  if (state == nullptr || state->memory == memory) return;
  state->memory = memory;
  state->live = false;
}
uint32_t feq_live_normalizer_latency(const FeqLiveNormalizer* state) {
  return state == nullptr ? 0 : state->latency;
}
void feq_live_normalizer_silence(FeqLiveNormalizer* state, uint32_t frames) {
  if (state != nullptr && state->mode == 2) silent_frames(*state, frames);
}
FeqLiveNormalizerReading feq_live_normalizer_process(FeqLiveNormalizer* state,
    float* const* channels, uint32_t frames, const FeqNormalizerSettings* settings) {
  FeqLiveNormalizerReading reading{-120, -120, 0, -120, 0};
  if (state == nullptr || channels == nullptr || settings == nullptr || frames == 0)
    return reading;
  if (state->mode != settings->mode) {
    const bool first = state->mode == -1;
    state->mode = settings->mode;
    empty_window(*state);
    state->silent_samples = 0;
    state->gap_cleared = false;
    if (!first) {
      // Switching modes is the deliberate way to start over: nothing learned
      // survives it, and the current song is announced to it afresh. The
      // applied gain stays, so the switch ramps rather than steps.
      const double gain = state->song.gain_db;
      state->song = FeqLevelingState{};
      state->song.gain_db = gain;
      state->song_peak = 0;
      state->live = true;
      state->gap_pending = false;
    }
  }
  feq_loudness_meter_process(state->loudness, channels, frames);
  FeqLoudnessReading measured{};
  feq_loudness_meter_read(state->loudness, &measured);
  state->samples += frames;
  const bool ready = static_cast<double>(state->samples) >= state->rate * kWindowSeconds;
  reading.input_lufs = ready ? measured.short_term_lufs : measured.momentary_lufs;
  double peak = 0;
  for (uint32_t channel = 0; channel < state->channels; ++channel) {
    peak = std::max(peak, feq_true_peak_block(&state->input_detectors[channel],
                                            channels[channel], frames));
  }
  reading.input_true_peak_db = db(peak);
  const bool programme = peak >= 1e-5;
  double target = 0;
  reading.level_state = settings->mode == 1 ? 1 : 0;
  if (settings->mode == 2) {
    if (programme) adopt(*state);
    follow_cue(*state, *settings);
    reading.level_state = level(*state, measured, peak, frames, *settings);
    target = state->song.target_db;
  }
  reading.reference_lufs = state->song.song_level;
  auto& song = state->song;
  // Slow corrections plus a 0.75 LU deadband avoid riding every phrase.
  // Mode changes return to unity promptly without stepping the waveform.
  const double speed = settings->mode != 2 ? 30.0
      : song.glide ? kGlideDbPerSecond
      : target < song.gain_db ? kDownDbPerSecond : kUpDbPerSecond;
  const double step = speed / state->rate;
  for (uint32_t frame = 0; frame < frames; ++frame) {
    song.gain_db += std::clamp(target - song.gain_db, -step, step);
    const double gain = std::pow(10.0, song.gain_db / 20);
    for (uint32_t channel = 0; channel < state->channels; ++channel)
      channels[channel][frame] = static_cast<float>(channels[channel][frame] * gain);
  }
  if (song.glide && std::abs(song.gain_db - target) < 1e-9) song.glide = false;
  // Only a block that carried music says anything about the programme. An
  // idle stream on the same output publishing its copy every block would
  // overwrite what the playing one learned.
  if (state->memory != nullptr && programme && state->live) {
    feq_leveling::publish(*state->memory, song, settings->mode == 2);
  }
  // Peak protection answers the delayed samples, never a UI measurement.
  // Keep the same delay while bypassed so switching modes cannot shift audio.
  FeqPostFilterNormalizerOptions options{};
  options.enabled = settings->mode == 1 || settings->mode == 2;
  options.output_ceiling_db = bounded(settings->ceiling_db, -1, -12, -0.1);
  options.sample_rate = state->rate;
  options.release_ms = 250;
  feq_post_filter_normalizer_process(&state->safety, channels, frames, &options);
  const auto safety = feq_post_filter_normalizer_take_telemetry(&state->safety);
  reading.applied_gain_db = song.gain_db + safety.gain_reduction_db;
  return reading;
}
}
