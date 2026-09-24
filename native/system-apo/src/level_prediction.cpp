/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "level_prediction.h"

#include <algorithm>
#include <cmath>
#include <utility>

#include "chain_signature.h"
#include "fluideq/primitives.h"
#include "fluideq_engine/graph.h"

namespace fluideq_engine {

namespace {

/** Frames per call into a replay's graph: more than audiodg ever hands one. */
constexpr uint32_t kReplayBlock = 4096;

/**
 * Nothing under this is music to judge a level on — the output guard's own
 * floor: it leaves the level alone below -65 dBFS (`output_guard.cpp`).
 */
constexpr double kSilenceDb = -65.0;

/**
 * A replay starts cold, every filter with no history, so its first moments
 * say what the EQ does to music starting out of nothing. Half a second past
 * the replay's own delay, the bass shelves have settled.
 */
constexpr double kWarmUpSeconds = 0.5;

/** The least music, after the warm-up, worth judging a level on. */
constexpr double kLeastSeconds = 1.0;

/**
 * The music a chain with a convolution in it is judged on. A graphic curve
 * is a 16384-tap convolution, and ten seconds of it took 225 ms to replay
 * where the same chain's bands took 37 — held back that long, every step of
 * a drag would be heard late. Four seconds cost about as much as ten of
 * bands, and three measured only a little worse than ten (the header).
 */
constexpr double kConvolvedSeconds = 4.0;

/** Whether replaying `chain` runs a convolution: see `kConvolvedSeconds`. */
bool convolves(const Chain& chain) {
  return !chain.graphic_curves.empty() || !chain.convolution_path.empty();
}

/**
 * Whether the peaks the output guard measured on `chain` are the peaks its
 * replay would give: a guard to measure them, and every layer in minimum
 * phase, as the replay runs them (the header).
 */
bool plays_as_replayed(const Chain& chain) {
  return chain.output_guard && chain.minimum_eq_phase &&
         chain.minimum_curve_phase;
}

double to_db(double linear) {
  return 20.0 * std::log10(std::max(linear, 1e-12));
}

}  // namespace

Chain replay_chain_of(const Chain& chain) {
  Chain replay = chain;
  // Already in the recording: the history is taken as the rack hands it on.
  replay.dsp_values.clear();
  // The level is what is being worked out, so nothing in here may set one.
  replay.output_guard = false;
  replay.auto_preamp = false;
  replay.auto_preamp_start_db = 0.0;
  // See the class comment in the header.
  replay.minimum_eq_phase = true;
  replay.minimum_curve_phase = true;
  // Not the sound: which files said it, and what in them was ignored.
  replay.files_read.clear();
  replay.ignored.clear();
  return replay;
}

struct LevelPredictor::Replay {
  std::string signature;
  std::unique_ptr<Graph> graph;
  std::vector<FeqTruePeak> detectors;
  /** The first frame of the history this replay has not been given. */
  uint64_t rendered_to = 0;
  /** The first frame whose peak counts, once the cold start has settled. */
  uint64_t valid_from = 0;
  /** The loudest true peak of each chunk, a ring indexed by chunk number. */
  std::vector<float> peaks;
  /** The chunk the newest frame fell in, and frames left before the next. */
  uint64_t chunk = 0;
  uint32_t chunk_left = 0;
};

LevelPredictor::LevelPredictor(uint32_t rate, uint32_t channels,
                               uint64_t window_frames)
    : rate_(rate),
      channels_(std::max(1u, channels)),
      chunk_frames_(std::max(1u, rate / kPeakChunksPerSecond)),
      // The window plus the slack the history keeps, in chunks, and two more
      // for the partial chunks at either end.
      ring_chunks_(static_cast<size_t>(window_frames / chunk_frames_) +
                   kPeakChunksPerSecond + 2) {}

LevelPredictor::~LevelPredictor() = default;

std::unique_ptr<LevelPredictor::Replay> LevelPredictor::start(
    const Chain& replay_chain, std::string signature, uint64_t from) const {
  auto replay = std::make_unique<Replay>();
  replay->signature = std::move(signature);
  replay->graph = std::make_unique<Graph>(replay_chain, rate_, channels_,
                                          kReplayBlock);
  replay->detectors.resize(channels_);
  for (FeqTruePeak& detector : replay->detectors) {
    feq_true_peak_init(&detector, 4);
  }
  replay->rendered_to = from;
  replay->valid_from = from + static_cast<uint64_t>(rate_ * kWarmUpSeconds) +
                       replay->graph->latency_frames() + FEQ_TRUE_PEAK_LATENCY;
  replay->peaks.assign(ring_chunks_, 0.0f);
  replay->chunk = from / chunk_frames_;
  replay->chunk_left =
      chunk_frames_ - static_cast<uint32_t>(from % chunk_frames_);
  return replay;
}

bool LevelPredictor::advance(Replay& replay, const InputHistory& history,
                             uint64_t to,
                             const std::function<bool()>& stop_requested) {
  planes_.resize(channels_);
  // A block at a time out of the history, so the copy is one block and not
  // the window again beside it.
  while (replay.rendered_to < to) {
    if (stop_requested && stop_requested()) {
      return false;
    }
    const uint64_t want = std::min<uint64_t>(to, replay.rendered_to + kReplayBlock);
    const InputHistory::Stretch got =
        history.copy(replay.rendered_to, want, scratch_);
    if (got.from != replay.rendered_to || got.to <= got.from) {
      // The frames this replay needs next are no longer kept: it can only
      // start over, which the caller decides.
      return false;
    }
    const auto span = static_cast<uint32_t>(got.to - got.from);
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      planes_[channel] = scratch_[channel].data();
    }
    replay.graph->process(planes_.data(), span);
    // A chunk's worth at a time through each channel's detector, which keeps
    // its history across the calls: half the time of a call per sample.
    for (uint32_t at = 0; at < span;) {
      if (replay.chunk_left == 0) {
        replay.chunk += 1;
        replay.chunk_left = chunk_frames_;
        replay.peaks[replay.chunk % replay.peaks.size()] = 0.0f;
      }
      const uint32_t take = std::min(replay.chunk_left, span - at);
      double peak = 0.0;
      for (uint32_t channel = 0; channel < channels_; ++channel) {
        peak = std::max(peak, feq_true_peak_block(&replay.detectors[channel],
                                                  planes_[channel] + at, take));
      }
      float& slot = replay.peaks[replay.chunk % replay.peaks.size()];
      slot = std::max(slot, static_cast<float>(peak));
      replay.chunk_left -= take;
      at += take;
    }
    replay.rendered_to = got.to;
  }
  return true;
}

double LevelPredictor::peak_over(const Replay& replay, uint64_t from,
                                 uint64_t to) const {
  // Whole chunks only, the same ones for either replay.
  const uint64_t first = (from + chunk_frames_ - 1) / chunk_frames_;
  const uint64_t end = to / chunk_frames_;
  double peak = 0.0;
  for (uint64_t chunk = first; chunk < end; ++chunk) {
    peak = std::max(peak, static_cast<double>(
                              replay.peaks[chunk % replay.peaks.size()]));
  }
  return peak;
}

std::optional<LevelPredictor::Prediction> LevelPredictor::predict(
    const Chain& next, const InputHistory& history,
    const std::function<bool()>& stop_requested) {
  candidate_.reset();
  if (!current_ || !current_->auto_preamp || !next.auto_preamp ||
      !next.output_guard) {
    return std::nullopt;
  }
  const Chain replay = replay_chain_of(next);
  std::string signature = signature_of(replay);
  if (signature == current_signature_) {
    return std::nullopt;
  }
  const uint64_t now = history.written();
  uint64_t window = history.window_frames();
  if (convolves(next) || convolves(*current_)) {
    window = std::min(window, static_cast<uint64_t>(rate_ * kConvolvedSeconds));
  }
  const uint64_t from = now > window ? now - window : 0;
  if (now - from <
      static_cast<uint64_t>(rate_ * (kWarmUpSeconds + kLeastSeconds))) {
    return std::nullopt;
  }
  candidate_ = start(replay, std::move(signature), from);
  // Settled on the chain playing a tenth of a second after it was published:
  // the handover is at the next block, and its crossfade 20 ms.
  const bool heard = plays_as_replayed(*current_) &&
                     current_since_ + rate_ / 10 <= candidate_->valid_from;
  if (!heard) {
    if (!shadow_ || shadow_->signature != current_signature_ ||
        shadow_->rendered_to < from) {
      shadow_ = start(replay_chain_of(*current_), current_signature_, from);
    }
    if (!advance(*shadow_, history, now, stop_requested)) {
      shadow_.reset();
      candidate_.reset();
      return std::nullopt;
    }
  }
  if (!advance(*candidate_, history, now, stop_requested)) {
    candidate_.reset();
    return std::nullopt;
  }
  const uint64_t lo = std::max(
      {from, candidate_->valid_from, heard ? from : shadow_->valid_from});
  // The history's own peaks stop two chunks short of the newest frame (see
  // `InputHistory::peak_over`): the replay is read over the same chunks.
  const uint64_t hi =
      heard ? candidate_->rendered_to - 2 * uint64_t{chunk_frames_}
            : std::min(shadow_->rendered_to, candidate_->rendered_to);
  if (hi <= lo || hi - lo < static_cast<uint64_t>(rate_ * kLeastSeconds)) {
    return std::nullopt;
  }
  double before = 0.0;
  if (heard) {
    const std::optional<double> measured = history.peak_over(lo, hi);
    if (!measured) {
      return std::nullopt;
    }
    before = to_db(*measured);
  } else {
    before = to_db(peak_over(*shadow_, lo, hi));
  }
  const double after = to_db(peak_over(*candidate_, lo, hi));
  if (before < kSilenceDb || after < kSilenceDb) {
    return std::nullopt;
  }
  return Prediction{before - after, static_cast<double>(hi - lo) / rate_};
}

void LevelPredictor::accept(const Chain& published, uint64_t heard_frames) {
  std::string signature = signature_of(replay_chain_of(published));
  if (signature != current_signature_) {
    current_since_ = heard_frames;
  }
  if (candidate_ && candidate_->signature == signature) {
    shadow_ = std::move(candidate_);
  } else if (shadow_ && shadow_->signature != signature) {
    shadow_.reset();
  }
  candidate_.reset();
  current_ = published;
  current_signature_ = std::move(signature);
}

}  // namespace fluideq_engine
