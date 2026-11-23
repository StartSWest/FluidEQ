/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "denoise_voice_blend.h"

#include <algorithm>
#include <cmath>

namespace {

constexpr double kPi = 3.14159265358979323846;
/** A block quieter than this per sample tells nothing about the cleaner. */
constexpr double kGainFloor = 1e-10;

}  // namespace

void voice_blend_reset(VoiceBlend& blend, double rate, uint32_t latency) {
  blend = VoiceBlend{};
  blend.fade_from = latency;
  blend.seam_frames =
      std::max(1u, static_cast<uint32_t>(rate * kVoiceSeamMs / 1000.0));
  blend.fade_in_frames =
      std::max(1u, static_cast<uint32_t>(rate * kVoiceFadeInMs / 1000.0));
}

void voice_blend_block(VoiceBlend& blend, float* out, const float* delayed,
                       const float* cleaned, uint32_t frames, double amount) {
  if (frames == 0) {
    return;
  }
  const bool late = cleaned == nullptr;
  const double wet = std::min(1.0, std::max(0.0, amount));
  double cleaned_energy = 0.0;
  double input_energy = 0.0;
  for (uint32_t i = 0; i < frames; i += 1) {
    const double dry = delayed[i];
    double heard = dry * blend.held_gain;
    if (!late) {
      heard = cleaned[i];
      cleaned_energy += heard * heard;
      input_energy += dry * dry;
    }
    out[i] = static_cast<float>(dry * (1.0 - wet) + heard * wet);
  }
  // Never a lift: the network can return a hair more than it was given, and a
  // late block in the room's silence must not come out louder than the room.
  if (!late && input_energy > kGainFloor * static_cast<double>(frames)) {
    blend.held_gain = std::min(1.0, std::sqrt(cleaned_energy / input_energy));
  }
  // A cleaned block after a late one, or a late one after a cleaned one: two
  // different signals, which would meet with a step. Start from where the
  // previous block ended and lean into this one's own over the seam. With
  // nothing of the cleaner mixed in both kinds are the same signal, and there
  // is no seam to lean.
  if (late != blend.was_late && wet > 0.0) {
    const uint32_t seam = std::min(blend.seam_frames, frames);
    const double step = blend.last_out - out[0];
    for (uint32_t i = 0; i < seam; i += 1) {
      out[i] += static_cast<float>(
          step * (1.0 - static_cast<double>(i) / static_cast<double>(seam)));
    }
  }
  const uint64_t fade_to = blend.fade_from + blend.fade_in_frames;
  for (uint32_t i = 0; i < frames && blend.emitted + i < fade_to; i += 1) {
    const uint64_t position = blend.emitted + i;
    const double into =
        position < blend.fade_from
            ? 0.0
            : static_cast<double>(position - blend.fade_from) /
                  static_cast<double>(blend.fade_in_frames);
    out[i] = static_cast<float>(out[i] * (0.5 - 0.5 * std::cos(kPi * into)));
  }
  blend.last_out = out[frames - 1];
  blend.was_late = late;
  blend.emitted += frames;
}
