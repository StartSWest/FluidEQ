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

namespace {

// The speaker bits in mask order (mmreg.h: FL FR FC LFE BL BR FLC FRC BC SL
// SR) and the room's speaker for each; back and side surrounds both have a
// place on the ring, the two front-of-centre positions and the back centre
// do not.
constexpr unsigned long kSpeakerBits[] = {0x1,  0x2,  0x4,   0x8,   0x10, 0x20,
                                          0x40, 0x80, 0x100, 0x200, 0x400};
constexpr int kSpeakerOfBit[] = {0, 1, 2, -1, 5, 6, -1, -1, -1, 3, 4};
constexpr unsigned long kHighestSpeakerBit = 0x20000;
constexpr int kNoMaskSix[] = {0, 1, 2, -1, 5, 6};
constexpr int kNoMaskEight[] = {0, 1, 2, -1, 5, 6, 3, 4};

}  // namespace

int speaker_of_channel(unsigned long mask, unsigned short channels,
                       unsigned channel) {
  if (channel >= channels) {
    return -1;
  }
  if (mask == 0) {
    if (channels == 2) {
      return channel == 0 ? 0 : 1;
    }
    if (channels == 6) {
      return kNoMaskSix[channel];
    }
    if (channels == 8) {
      return kNoMaskEight[channel];
    }
    return -1;
  }
  unsigned index = 0;
  for (unsigned long bit = 1; bit <= kHighestSpeakerBit; bit <<= 1) {
    if ((mask & bit) == 0) {
      continue;
    }
    if (index == channel) {
      for (unsigned at = 0; at < sizeof(kSpeakerBits) / sizeof(kSpeakerBits[0]);
           ++at) {
        if (kSpeakerBits[at] == bit) {
          return kSpeakerOfBit[at];
        }
      }
      return -1;
    }
    ++index;
  }
  return -1;
}

}  // namespace fluideq_engine
