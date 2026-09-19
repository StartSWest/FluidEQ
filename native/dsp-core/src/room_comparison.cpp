/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include <algorithm>
#include <cmath>
#include <cstring>

#include "fluideq/convolver.h"
#include "room_internal.h"
// Computed only on control: value hashing ignores struct padding and A/B
// toggles.
uint64_t room_comparison_key(const FeqRoom* r) {
  uint64_t hash = 1469598103934665603ull;
  auto add = [&](const auto& v) {
    const auto* b = reinterpret_cast<const unsigned char*>(&v);
    for (size_t i = 0; i < sizeof(v); i++) {
      hash ^= b[i];
      hash *= 1099511628211ull;
    }
  };
  const auto& s = r->settings;
  add(s.renderer_version);
  add(s.early_reflection_db);
  add(s.ambience_mix);
  add(s.ambience_decay_s);
  add(s.ambience_damping_hz);
  add(s.enabled);
  add(s.source_already_spatial);
  add(s.size_m);
  add(s.walls);
  add(s.distance_m);
  add(s.centre_db);
  add(s.sub_db);
  add(s.bass_management);
  add(s.crossover_hz);
  add(s.music_upmix);
  add(s.upmix_amount);
  add(s.head_scale);
  add(s.angle_deg);
  add(s.level_db);
  add(s.speaker_distance_m);
  add(s.mute);
  add(r->speaker);
  add(r->lfe_channel);
  add(r->sample_rate);
  add(r->channels);
  add(r->low_latency);
  add(r->directions);
  add(r->taps);
  add(r->doubling);
  for (float v : r->head_left) add(v);
  for (float v : r->head_right) add(v);
  return hash;
}
void RoomComparison::prepare(uint32_t frames) {
  line.assign(2 * (feq_convolver_latency() + 1u), 0.f);
  reference.assign(2 * frames, 0.f);
  reset();
}
void RoomComparison::reset() {
  std::fill(line.begin(), line.end(), 0.f);
  cursor = 0;
  key = 0;
  samples = 0;
  wet_energy = reference_energy = 0;
  blend = gain_db = target_db = 0;
  matched = false;
  report = {FEQ_ROOM_REPORT_TAG, 0};
}
void RoomComparison::capture(FeqRoom* room, const FeqRoomKernels* set,
                             float* const* channels, uint32_t frames) {
  if (key != set->comparison_key) {
    samples = 0;
    wet_energy = reference_energy = 0;
    matched = false;
    target_db = 0;
    key = set->comparison_key;
  }
  const size_t length = line.size() / 2;
  const size_t delay = set->split ? 0 : feq_convolver_latency();
  for (uint32_t i = 0; i < frames; i++) {
    double l = 0, r = 0;
    if (room->channels == 2) {
      l = channels[0][i];
      r = channels[1][i];
    } else
      for (uint32_t c = 0; c < room->channels; c++) {
        // Conventional stereo: fronts unity; centre/same-side surrounds -3 dB.
        // LFE omitted (no bass-management gain or +10 dB playback convention).
        if (static_cast<int>(c) == set->lfe_channel) continue;
        double x = channels[c][i];
        switch (set->speaker[c]) {
          case 0:
            l += x;
            break;
          case 1:
            r += x;
            break;
          case 2:
            l += x * .7071067811865476;
            r += x * .7071067811865476;
            break;
          case 3:
          case 5:
            l += x * .7071067811865476;
            break;
          case 4:
          case 6:
            r += x * .7071067811865476;
            break;
          default:
            break;
        }
      }
    line[cursor] = static_cast<float>(l);
    line[length + cursor] = static_cast<float>(r);
    size_t read = (cursor + length - delay) % length;
    reference[i] = line[read];
    reference[room->max_frames + i] = line[length + read];
    cursor = (cursor + 1) % length;
  }
}
void RoomComparison::process(FeqRoom* room, const FeqRoomKernels* set,
                             uint32_t frames, bool stable) {
  double wet = 0, ref = 0;
  bool finite = true;
  for (uint32_t i = 0; i < frames; i++) {
    double l = room->mix_left[i], r = room->mix_right[i], a = reference[i],
           b = reference[room->max_frames + i];
    finite = finite && std::isfinite(l) && std::isfinite(r) &&
             std::isfinite(a) && std::isfinite(b);
    wet += l * l + r * r;
    ref += a * a + b * b;
  }
  if (!finite) {
    matched = false;
    target_db = 0;
    samples = 0;
    wet_energy = reference_energy = 0;
  } else if (stable && !matched) {
    // Require 1.5 contiguous seconds of usable paired energy (-80 dB floor).
    // Kernel warmup/fades do not teach a gain for an in-between room.
    if (wet / frames > 1e-8 && ref / frames > 1e-8) {
      samples += frames;
      wet_energy += wet;
      reference_energy += ref;
      if (samples >= static_cast<uint64_t>(room->sample_rate * 1.5)) {
        target_db =
            std::clamp(10 * std::log10(wet_energy / reference_energy), -6., 6.);
        matched = true;
      }
    } else {
      samples = 0;
      wet_energy = reference_energy = 0;
    }
  }
  // Signal-domain ramps, independent of callback size and control cadence.
  const double step = 1 / (room->sample_rate * .02),
               gain_step = 6 / (room->sample_rate * .1);
  for (uint32_t i = 0; i < frames; i++) {
    blend += std::clamp((set->compare_original ? 1. : 0.) - blend, -step, step);
    gain_db += std::clamp(target_db - gain_db, -gain_step, gain_step);
    if (blend > 0) {
      double gain = std::pow(10., gain_db / 20.);
      for (int ear = 0; ear < 2; ear++) {
        float& wet_sample = ear ? room->mix_right[i] : room->mix_left[i];
        double original =
            reference[static_cast<size_t>(ear) * room->max_frames + i];
        if (!std::isfinite(original)) original = 0;
        wet_sample = static_cast<float>(wet_sample +
                                        (original * gain - wet_sample) * blend);
      }
    }
  }
  report = {FEQ_ROOM_REPORT_TAG | FEQ_ROOM_REPORT_ACTIVE |
                (blend > 0 ? FEQ_ROOM_REPORT_ORIGINAL : 0u) |
                (matched ? FEQ_ROOM_REPORT_MATCH : 0u) |
                (room->channels > 2 ? FEQ_ROOM_REPORT_FOLD_DOWN : 0u) |
                (set->preserve_position ? FEQ_ROOM_REPORT_PROTECTED : 0u),
            static_cast<float>(gain_db)};
}
