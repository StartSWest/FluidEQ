/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "room_head.h"

#include <sstream>

namespace fluideq_engine {

namespace {

// Bounds on what a head may declare: a ring finer than 5° or a response
// longer than 85 ms at 48 kHz is not a head file, it is a mistake, and the
// vectors it would ask for are the reason to say no before allocating.
constexpr unsigned kMaxDirections = 72;
constexpr unsigned kMaxTaps = 4096;

double block_rate_for(double stream_rate, bool* doubling) {
  *doubling = false;
  if (stream_rate == 44100.0 || stream_rate == 48000.0 ||
      stream_rate == 96000.0) {
    return stream_rate;
  }
  if (stream_rate == 192000.0) {
    *doubling = true;
    return 96000.0;
  }
  return 0.0;
}

}  // namespace

std::optional<RoomHead> parse_room_head(const std::string& text,
                                        double stream_rate) {
  bool doubling = false;
  const double rate = block_rate_for(stream_rate, &doubling);
  if (rate == 0.0) {
    return std::nullopt;
  }
  std::istringstream lines(text);
  std::string line;
  while (std::getline(lines, line)) {
    if (line.rfind("rate ", 0) != 0) {
      continue;
    }
    std::istringstream header(line);
    std::string word;
    double block_rate = 0.0;
    unsigned directions = 0;
    unsigned taps = 0;
    header >> word >> block_rate >> word >> directions >> word >> taps;
    if (block_rate != rate) {
      continue;
    }
    if (directions == 0 || taps == 0 || directions > kMaxDirections ||
        taps > kMaxTaps) {
      return std::nullopt;
    }
    RoomHead head;
    head.directions = directions;
    head.taps = taps;
    head.sample_rate = rate;
    head.needs_doubling = doubling;
    head.left.resize(static_cast<size_t>(directions) * taps);
    head.right.resize(head.left.size());
    for (unsigned direction = 0; direction < directions; ++direction) {
      if (!std::getline(lines, line)) {
        return std::nullopt;
      }
      std::istringstream numbers(line);
      for (unsigned ear = 0; ear < 2; ++ear) {
        std::vector<float>& into = ear == 0 ? head.left : head.right;
        for (unsigned tap = 0; tap < taps; ++tap) {
          double value = 0.0;
          if (!(numbers >> value)) {
            return std::nullopt;
          }
          into[static_cast<size_t>(direction) * taps + tap] =
              static_cast<float>(value);
        }
      }
    }
    return head;
  }
  return std::nullopt;
}

}  // namespace fluideq_engine
