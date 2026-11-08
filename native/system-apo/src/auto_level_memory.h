/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The level Auto normalize settled at on one output, kept for the next time
 * Windows opens that output (Ivan, 2026-11-07: "the preamp kind of resets and
 * needs to rise again ... we need to ensure stable volume").
 *
 * Every lock is a new watcher with new graphs, so every lock's guard started
 * over at its curve's own level — -10 dB under the correction on his headset —
 * and climbed back at 0.15 dB/s once five seconds had left room: more than
 * half a minute of the music turned down each time Windows opened the output
 * again, which it does whenever FluidEQ restarts, the Library's player starts
 * its stream again, or anything starts playing on an idle output. Switching
 * FluidEQ or Auto normalize off and back on did the same to the level an A/B
 * comparison was listening at. Kept beside the output's leveling memory
 * (`leveling_board.h`), for as long as audiodg.exe lives.
 *
 * One word, so the audio thread writing it and the audio thread of another
 * lock reading it never see the level of one moment beside the curve of
 * another: the level and the curve level it was settled under, as two floats.
 */
#ifndef FLUIDEQ_ENGINE_AUTO_LEVEL_MEMORY_H
#define FLUIDEQ_ENGINE_AUTO_LEVEL_MEMORY_H

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstring>

namespace fluideq_engine {

class AutoLevelMemory {
 public:
  /** Audio thread: the level this output's music settled at, under a curve
   * whose own level is `curve_level_db`. */
  void remember(double level_db, double curve_level_db) noexcept {
    const float level = static_cast<float>(level_db);
    const float curve = static_cast<float>(curve_level_db);
    uint32_t level_bits = 0;
    uint32_t curve_bits = 0;
    std::memcpy(&level_bits, &level, sizeof level_bits);
    std::memcpy(&curve_bits, &curve, sizeof curve_bits);
    word_.store((static_cast<uint64_t>(level_bits) << 32) | curve_bits,
                std::memory_order_relaxed);
  }

  /**
   * Where a guard starting under a curve whose own level is `curve_level_db`
   * begins: the level remembered, brought down by however much louder this
   * curve is than the one it was settled under — the rule an edit's held
   * level follows (`OutputGuard::hold`) — and never above unity. A quieter
   * curve is left to the recovery, as it is mid-song. With nothing
   * remembered, the curve's own level, which is where every lock used to
   * start.
   */
  double start_for(double curve_level_db) const noexcept {
    const uint64_t word = word_.load(std::memory_order_relaxed);
    if (word == kNothing) {
      return curve_level_db;
    }
    const auto level_bits = static_cast<uint32_t>(word >> 32);
    const auto curve_bits = static_cast<uint32_t>(word);
    float level = 0;
    float curve = 0;
    std::memcpy(&level, &level_bits, sizeof level);
    std::memcpy(&curve, &curve_bits, sizeof curve);
    if (!std::isfinite(level) || !std::isfinite(curve)) {
      return curve_level_db;
    }
    // Parenthesised: this header reaches translation units that include
    // <windows.h> without NOMINMAX, where `min` is a macro.
    return (std::min)(0.0, static_cast<double>(level) +
                               (std::min)(0.0, curve_level_db - static_cast<double>(curve)));
  }

 private:
  // Two NaNs: no level a guard could have reached.
  static constexpr uint64_t kNothing = ~uint64_t{0};
  std::atomic<uint64_t> word_{kNothing};
};

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_AUTO_LEVEL_MEMORY_H
