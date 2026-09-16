/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "channel_layout.h"

namespace fluideq_engine {

namespace {

// `SPEAKER_LOW_FREQUENCY` from mmreg.h, spelled here so this unit needs no
// Windows header: the mask's bits are the speaker positions in the order
// Windows lays channels out, and this is the fourth of them.
constexpr unsigned long kLowFrequencyBit = 0x8;

}  // namespace

int lfe_channel_of(unsigned long mask, unsigned short channels) {
  if (mask == 0) {
    return channels >= 6 ? 3 : -1;
  }
  if ((mask & kLowFrequencyBit) == 0) {
    return -1;
  }
  int index = 0;
  for (unsigned long bit = 1; bit < kLowFrequencyBit; bit <<= 1) {
    if ((mask & bit) != 0) {
      ++index;
    }
  }
  return index < channels ? index : -1;
}

}  // namespace fluideq_engine
