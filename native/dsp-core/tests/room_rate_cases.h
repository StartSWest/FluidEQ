/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The four output rates a room renders through a converter, shared by the
 * converter's own test (`room_rate_test.cpp`) and the room's at those rates
 * (`room_converted_test.cpp`).
 */
#ifndef FLUIDEQ_ROOM_RATE_CASES_H
#define FLUIDEQ_ROOM_RATE_CASES_H

#include <cstdint>

namespace feq_test {

struct RateCase {
  double stream;
  double room;
  uint32_t factor;
};

// The four rates that render at a head's rate, and the factor each takes.
inline constexpr RateCase kRateCases[] = {{88200.0, 44100.0, 2u},
                                          {176400.0, 44100.0, 4u},
                                          {352800.0, 44100.0, 8u},
                                          {384000.0, 96000.0, 4u}};

/** A driver's 10 ms period at the case's rate: the most a block may be. */
inline uint32_t block_of(const RateCase& c) {
  return static_cast<uint32_t>(c.stream / 100.0);
}

}  // namespace feq_test

#endif  // FLUIDEQ_ROOM_RATE_CASES_H
