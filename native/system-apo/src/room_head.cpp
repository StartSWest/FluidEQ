/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "room_head.h"

#include "fluideq/room.h"

#include <sstream>

namespace fluideq_engine {

namespace {

// Bounds on what a head may declare: a ring finer than 5° or a response
// longer than 85 ms at 48 kHz is not a head file, it is a mistake, and the
// vectors it would ask for are the reason to say no before allocating.
constexpr unsigned kMaxDirections = 72;
constexpr unsigned kMaxTaps = 4096;

// The room's own table (`feq_room_head_rate`), so the block read here is
// the one the room renders at: a second copy of it once kept every output
// faster than 192 kHz without a head while the room could play there.
double block_rate_for(double stream_rate, bool* doubling) {
  int doubled = 0;
  const double rate = feq_room_head_rate(stream_rate, &doubled);
  *doubling = doubled != 0;
  return rate;
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
  int head_size = -1;
  while (std::getline(lines, line)) {
    constexpr const char* kHeader = "# FluidEQ room head v1 ";
    if (line.rfind(kHeader, 0) == 0) {
      const size_t size_from = std::char_traits<char>::length(kHeader);
      const size_t size_to = line.find_first_of(" \t\r", size_from);
      const std::string size = line.substr(size_from, size_to - size_from);
      head_size = size == "small" ? 0 : size == "medium" ? 1
                                      : size == "large" ? 2 : -1;
      continue;
    }
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
    head.size = head_size;
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
