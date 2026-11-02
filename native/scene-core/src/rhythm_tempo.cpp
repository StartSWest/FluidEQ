/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/rhythmTempo.ts`: the tempo from the onsets' autocorrelation,
// and where the beats fall in them. What the TypeScript keeps in a
// Float32Array is a float here and nothing else is.

#include <algorithm>
#include <cmath>
#include <limits>

#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kMinTempo = 60.0;
constexpr double kMaxTempo = 200.0;
constexpr std::size_t kOssMin = 300;
constexpr double kPreferredTempo = 120.0;
constexpr double kContinuity = 0.35;
constexpr double kContinuityWidth = 0.03;
constexpr std::array<double, 4> kComb{1.0, 0.5, 1.0 / 3.0, 1.0};
constexpr double kLagStep = 0.005;
constexpr double kHalfShare = 0.5;
constexpr std::array<double, 6> kRelatedRatios{0.5, 2.0 / 3.0, 0.75,
                                               4.0 / 3.0, 1.5, 2.0};
constexpr double kKeepMargin = 1.15;

double clamp01(double value) { return std::max(0.0, std::min(1.0, value)); }

/** `history[index]`, or 0 where JavaScript would read undefined. */
double sample(const std::vector<float>& history, double index) {
  if (index < 0.0 || index >= static_cast<double>(history.size())) {
    return 0.0;
  }
  return static_cast<double>(history[static_cast<std::size_t>(index)]);
}

double around(const std::vector<float>& history, double at) {
  const double whole = std::floor(at);
  const double part = at - whole;
  const double here =
      sample(history, whole) * (1.0 - part) + sample(history, whole + 1.0) * part;
  return here + 0.5 * (sample(history, whole - 1.0) + sample(history, whole + 2.0));
}

double grid_fit(const std::vector<float>& history, double period, double back) {
  double score = 0.0;
  double weight = 1.0;
  for (double at = static_cast<double>(history.size()) - 1.0 - back; at >= 1.0;
       at -= period) {
    score += weight * around(history, at);
    weight *= 0.9;
  }
  return score;
}

}  // namespace

bool is_related(double ratio) {
  return std::any_of(kRelatedRatios.begin(), kRelatedRatios.end(),
                     [ratio](double related) {
                       return std::abs(ratio / related - 1.0) < 0.04;
                     });
}

std::optional<TempoHeard> estimate_tempo(const std::vector<float>& history,
                                         double held) {
  const std::size_t count = history.size();
  if (count < kOssMin) {
    return std::nullopt;
  }
  std::vector<float> smooth(count);
  double mean = 0.0;
  for (std::size_t at = 0; at < count; ++at) {
    double sum = 0.0;
    double weight = 0.0;
    for (int near = -2; near <= 2; ++near) {
      const auto index = static_cast<std::ptrdiff_t>(at) + near;
      if (index >= 0 && index < static_cast<std::ptrdiff_t>(count)) {
        const double share = 3.0 - std::abs(near);
        sum += share * static_cast<double>(history[static_cast<std::size_t>(index)]);
        weight += share;
      }
    }
    smooth[at] = static_cast<float>(sum / weight);
    mean += static_cast<double>(smooth[at]);
  }
  mean /= static_cast<double>(count);
  double energy = 0.0;
  for (std::size_t at = 0; at < count; ++at) {
    smooth[at] = static_cast<float>(static_cast<double>(smooth[at]) - mean);
    energy += static_cast<double>(smooth[at]) * static_cast<double>(smooth[at]);
  }
  energy /= static_cast<double>(count);
  if (energy < 1e-12) {
    return std::nullopt;
  }
  const double shortest = 60000.0 / kMaxTempo / kOssHopMs;
  const double longest = 60000.0 / kMinTempo / kOssHopMs;
  const std::size_t reach = count / 2 + 1;
  std::vector<float> correlations(reach + 1);
  for (std::size_t lag = 0; lag <= reach; ++lag) {
    double sum = 0.0;
    for (std::size_t at = lag; at < count; ++at) {
      sum += static_cast<double>(smooth[at]) *
             static_cast<double>(smooth[at - lag]);
    }
    correlations[lag] = static_cast<float>(
        sum / static_cast<double>(count - lag) / energy);
  }
  const auto correlation = [&](double lag) {
    const double whole = std::floor(lag);
    const double part = lag - whole;
    const auto at = static_cast<std::size_t>(whole);
    return static_cast<double>(correlations[at]) * (1.0 - part) +
           static_cast<double>(correlations[std::min(reach, at + 1)]) * part;
  };
  const auto comb = [&](double lag) {
    double sum = kHalfShare * correlation(lag / 2.0);
    double weight = kHalfShare;
    for (std::size_t index = 0; index < kComb.size(); ++index) {
      const double multiple = lag * static_cast<double>(index + 1);
      if (multiple <= static_cast<double>(count) / 2.0) {
        sum += kComb[index] * correlation(multiple);
        weight += kComb[index];
      }
    }
    return weight > 0.0 ? sum / weight : 0.0;
  };
  std::vector<double> lags;
  for (double lag = shortest; lag <= longest; lag *= 1.0 + kLagStep) {
    lags.push_back(lag);
  }
  std::vector<double> scores;
  scores.reserve(lags.size());
  std::ptrdiff_t best = -1;
  double best_score = -std::numeric_limits<double>::infinity();
  for (const double lag : lags) {
    const double tempo = 60000.0 / (lag * kOssHopMs);
    const double octaves = std::log2(tempo / kPreferredTempo);
    const double prior = std::exp(-0.5 * octaves * octaves);
    const double from_held =
        held > 0.0 ? std::log2(tempo / held) / kContinuityWidth : 0.0;
    const double lean =
        held > 0.0 ? 1.0 + kContinuity * std::exp(-0.5 * from_held * from_held)
                   : 1.0;
    const double score = comb(lag) * prior * lean;
    scores.push_back(score);
    if (score > best_score) {
      best_score = score;
      best = static_cast<std::ptrdiff_t>(scores.size()) - 1;
    }
  }
  if (best < 0 || best_score <= 0.0) {
    return std::nullopt;
  }
  double shift = 0.0;
  if (best > 0 && best + 1 < static_cast<std::ptrdiff_t>(scores.size())) {
    const double left = scores[static_cast<std::size_t>(best - 1)];
    const double right = scores[static_cast<std::size_t>(best + 1)];
    const double curve = left - 2.0 * best_score + right;
    if (curve < 0.0) {
      shift = std::max(-0.5, std::min(0.5, (0.5 * (left - right)) / curve));
    }
  }
  const double lag =
      lags[static_cast<std::size_t>(best)] * std::pow(1.0 + kLagStep, shift);
  return TempoHeard{
      std::max(kMinTempo, std::min(kMaxTempo, 60000.0 / (lag * kOssHopMs))),
      clamp01((best_score - 0.08) / 0.45)};
}

std::optional<PhaseHeard> estimate_phase(const std::vector<float>& history,
                                         double period,
                                         std::optional<double> keep) {
  const auto count = static_cast<double>(history.size());
  if (period < 2.0 || count < 3.0 * period) {
    return std::nullopt;
  }
  const auto offsets = static_cast<std::size_t>(std::ceil(period));
  std::vector<float> scores(offsets);
  std::size_t best = 0;
  double best_score = -std::numeric_limits<double>::infinity();
  double total = 0.0;
  for (std::size_t back = 0; back < offsets; ++back) {
    const double score = grid_fit(history, period, static_cast<double>(back));
    scores[back] = static_cast<float>(score);
    total += score;
    if (score > best_score) {
      best_score = score;
      best = back;
    }
  }
  const double mean = total / static_cast<double>(offsets);
  if (best_score <= 0.0 || mean <= 0.0) {
    return std::nullopt;
  }
  if (keep.has_value()) {
    const double kept = grid_fit(history, period, *keep);
    if (kept * kKeepMargin >= best_score) {
      return PhaseHeard{*keep, clamp01((kept / mean - 1.0) / 1.2)};
    }
  }
  const double left = scores[(best + offsets - 1) % offsets];
  const double right = scores[(best + 1) % offsets];
  const double curve = left - 2.0 * best_score + right;
  const double shift =
      curve < 0.0 ? std::max(-0.5, std::min(0.5, (0.5 * (left - right)) / curve))
                  : 0.0;
  return PhaseHeard{static_cast<double>(best) + shift,
                    clamp01((best_score / mean - 1.0) / 1.2)};
}

}  // namespace feq::scene
