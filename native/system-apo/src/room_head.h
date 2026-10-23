/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The head the room renders through, as the app writes it beside the rack.
 *
 * `fluideq-room-head-<guid>.txt` is one head at three rates: a `# FluidEQ room head
 * v1 <size>` line, then for 44.1, 48 and 96 kHz a `rate R directions D taps
 * T` line followed by D lines of 2·T numbers — the left ear's response then
 * the right ear's, for the direction D·15° clockwise from straight ahead,
 * seen from above. Text rather than a binary, so the file goes through the
 * same reader, writer and notification every other engine file does.
 */
#ifndef FLUIDEQ_ENGINE_ROOM_HEAD_H
#define FLUIDEQ_ENGINE_ROOM_HEAD_H

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace fluideq_engine {

/** The endpoint suffix is added by `endpoint_config_name`. */
inline constexpr const wchar_t* kRoomHeadFileStem = L"fluideq-room-head";

/** One head at one rate: a ring of directions, left ear then right. */
struct RoomHead {
  /** The header's small/medium/large selection, or -1 for a legacy header. */
  int size = -1;
  uint32_t directions = 0;
  uint32_t taps = 0;
  double sample_rate = 0;
  /** The stream runs at twice this block's rate (192 kHz on the 96 block). */
  bool needs_doubling = false;
  /** `directions * taps` floats each, direction-major. */
  std::vector<float> left;
  std::vector<float> right;
};

/**
 * The block for a stream rate, or nothing.
 *
 * 44.1, 48 and 96 kHz have blocks; 192 kHz takes the 96 block with doubling;
 * 88.2, 176.4 and 352.8 kHz take the 44.1 block and 384 kHz the 96 block,
 * which the room renders at between a converter's two halves
 * (`feq_room_head_rate`); any other rate has no head. A block short of its
 * declared numbers is refused whole — a head of zeros plays silence and
 * reports a room.
 */
std::optional<RoomHead> parse_room_head(const std::string& text,
                                        double stream_rate);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_ROOM_HEAD_H
