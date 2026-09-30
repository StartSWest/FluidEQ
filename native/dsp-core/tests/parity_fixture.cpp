/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Reading a fixture, comparing two renders, and the rack helpers. */
#include "parity_fixture.h"

namespace feq_parity {

namespace {

template <typename T>
T read_at(const std::vector<char>& bytes, size_t offset) {
  T value{};
  std::memcpy(&value, bytes.data() + offset, sizeof(T));
  return value;
}

}  // namespace

bool load(const std::filesystem::path& file, Fixture& out) {
  std::ifstream stream(file, std::ios::binary);
  if (!stream) {
    return false;
  }
  std::vector<char> bytes((std::istreambuf_iterator<char>(stream)),
                          std::istreambuf_iterator<char>());
  if (bytes.size() < kHeaderBytes) {
    return false;
  }
  if (read_at<uint32_t>(bytes, 0) != kMagic ||
      read_at<uint32_t>(bytes, 4) != kVersion) {
    return false;
  }
  out.processor = read_at<uint32_t>(bytes, 8);
  out.sample_rate = read_at<uint32_t>(bytes, 12);
  out.channels = read_at<uint32_t>(bytes, 16);
  out.frames = read_at<uint32_t>(bytes, 20);
  const uint32_t param_count = read_at<uint32_t>(bytes, 24);
  out.max_abs_tolerance = read_at<double>(bytes, 32);
  out.rms_tolerance = read_at<double>(bytes, 40);

  const char* name = bytes.data() + 48;
  out.name.assign(name, ::strnlen(name, kNameBytes));

  const size_t samples =
      static_cast<size_t>(out.channels) * static_cast<size_t>(out.frames);
  const size_t expected_size = kHeaderBytes + param_count * 8 + samples * 4 * 2;
  if (bytes.size() != expected_size || out.channels == 0 || out.frames == 0) {
    return false;
  }

  size_t at = kHeaderBytes;
  out.params.resize(param_count);
  for (uint32_t index = 0; index < param_count; ++index) {
    out.params[index] = read_at<double>(bytes, at);
    at += 8;
  }
  out.input.resize(samples);
  std::memcpy(out.input.data(), bytes.data() + at, samples * 4);
  at += samples * 4;
  out.expected.resize(samples);
  std::memcpy(out.expected.data(), bytes.data() + at, samples * 4);
  return true;
}

/**
 * Both metrics, because either alone lies.
 *
 * A single sample wrong by a lot moves the max and barely moves the RMS; a
 * whole block wrong by a little does the opposite. A port can fail either way
 * and a suite watching one of them will eventually let the other through.
 */
Difference compare(const std::vector<float>& actual,
                   const std::vector<float>& expected) {
  Difference difference;
  double sum_squared = 0.0;
  for (size_t at = 0; at < expected.size(); ++at) {
    if (!std::isfinite(actual[at])) {
      difference.non_finite = true;
      continue;
    }
    const double error = std::fabs(static_cast<double>(actual[at]) -
                                   static_cast<double>(expected[at]));
    difference.max_abs = std::max(difference.max_abs, error);
    sum_squared += error * error;
  }
  difference.rms =
      expected.empty()
          ? 0.0
          : std::sqrt(sum_squared / static_cast<double>(expected.size()));
  return difference;
}

/** The entry that takes a fixture out of comparison, or null. */
const Superseded* superseded_entry(const Fixture& fixture) {
  for (const auto& entry : kSuperseded) {
    if (entry.processor != fixture.processor) {
      continue;
    }
    if (entry.fixtures.empty()) {
      return &entry;
    }
    for (const char* name : entry.fixtures) {
      if (fixture.name == name) {
        return &entry;
      }
    }
  }
  return nullptr;
}

bool parse_rack(const Fixture& fixture,
                size_t offset,
                double coefficient_rate,
                Rack& out) {
  if (fixture.params.size() < offset + 2) {
    return false;
  }
  out.engine =
      static_cast<FeqEqEngine>(static_cast<int>(fixture.params[offset]));
  out.band_count = static_cast<uint32_t>(fixture.params[offset + 1]);
  // Asserted rather than assumed: a layout the generator and the runner
  // disagree about would read a threshold as a Q and still sound plausible.
  if (fixture.params.size() !=
      offset + 2 + static_cast<size_t>(out.band_count) * kBandParams) {
    return false;
  }

  out.coefficients.resize(out.band_count);
  out.gain_db.resize(out.band_count);
  out.dynamic.resize(out.band_count);
  out.threshold_db.resize(out.band_count);
  for (uint32_t band = 0; band < out.band_count; ++band) {
    const size_t base = offset + 2 + static_cast<size_t>(band) * kBandParams;
    out.coefficients[band] = feq_biquad_coefficients(
        static_cast<FeqFilterType>(static_cast<int>(fixture.params[base])),
        fixture.params[base + 1], fixture.params[base + 2],
        fixture.params[base + 3], coefficient_rate);
    out.gain_db[band] = fixture.params[base + 2];
    out.dynamic[band] = fixture.params[base + 4] != 0.0 ? 1 : 0;
    out.threshold_db[band] = fixture.params[base + 5];
    out.has_dynamic = out.has_dynamic || out.dynamic[band] != 0;
  }
  return true;
}

std::vector<FeqBandDynamics> build_dynamics(const Rack& rack, double rate) {
  std::vector<FeqBandDynamics> dynamics(rack.band_count);
  for (uint32_t band = 0; band < rack.band_count; ++band) {
    feq_band_dynamics_init(&dynamics[band]);
    feq_band_dynamics_refresh(&dynamics[band], 1, 1, rack.dynamic[band],
                              rack.gain_db[band], rack.threshold_db[band],
                              rate);
  }
  return dynamics;
}

std::vector<FeqBiquadState> fresh_states(uint32_t count) {
  std::vector<FeqBiquadState> states(count);
  for (auto& state : states) {
    feq_biquad_reset(&state);
  }
  return states;
}

bool engaged_in(const std::vector<FeqBandDynamics>& dynamics) {
  for (const auto& dynamic : dynamics) {
    if (dynamic.active != 0 && dynamic.amount > 0.0) {
      return true;
    }
  }
  return false;
}

void note_coverage(bool has_dynamic, bool engaged) {
  if (!has_dynamic) {
    return;
  }
  ++g_dynamic_fixtures;
  if (engaged) {
    ++g_dynamic_engaged;
  }
}

float* channel_at(std::vector<float>& block, uint32_t channel,
                  uint32_t frames) {
  return block.data() + static_cast<size_t>(channel) * frames;
}

bool within_tolerance(const Fixture& fixture, const Difference& difference) {
  return !difference.non_finite &&
         difference.max_abs <= fixture.max_abs_tolerance &&
         difference.rms <= fixture.rms_tolerance;
}

}  // namespace feq_parity
