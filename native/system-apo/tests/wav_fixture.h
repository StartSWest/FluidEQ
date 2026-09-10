/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A real WAVE file on disk, for the tests that cannot avoid one.
 *
 * `read_wav` is the only door an impulse response comes through, so a test
 * that wants to prove the graph loads one has to put a file where it can find
 * it. Kept out of the test that needs it because the byte layout of a RIFF
 * chunk has nothing to do with what any of those tests are measuring — and
 * because every later test that loads an IR wants the same twenty lines.
 */
#ifndef FLUIDEQ_ENGINE_TESTS_WAV_FIXTURE_H
#define FLUIDEQ_ENGINE_TESTS_WAV_FIXTURE_H

#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <vector>

namespace fluideq_engine_test {

namespace fixture_detail {

inline void put_tag(std::vector<unsigned char>& out, const char* tag) {
  for (size_t at = 0; at < 4; ++at) {
    out.push_back(static_cast<unsigned char>(tag[at]));
  }
}

inline void put_u32(std::vector<unsigned char>& out, uint32_t value) {
  out.push_back(static_cast<unsigned char>(value & 0xffu));
  out.push_back(static_cast<unsigned char>((value >> 8) & 0xffu));
  out.push_back(static_cast<unsigned char>((value >> 16) & 0xffu));
  out.push_back(static_cast<unsigned char>((value >> 24) & 0xffu));
}

inline void put_u16(std::vector<unsigned char>& out, uint32_t value) {
  out.push_back(static_cast<unsigned char>(value & 0xffu));
  out.push_back(static_cast<unsigned char>((value >> 8) & 0xffu));
}

}  // namespace fixture_detail

/**
 * Writes mono 32-bit float WAVE, and returns whether the bytes reached disk.
 *
 * The sample bytes are copied out of the float's own storage, which assumes
 * little-endian IEEE-754 — true of every target this engine is built for, and
 * the same assumption `parse_wav` makes reading them back.
 */
inline bool write_float_wav(const std::filesystem::path& path, uint32_t rate,
                            const std::vector<float>& samples) {
  std::vector<unsigned char> bytes;
  const auto payload = static_cast<uint32_t>(samples.size() * sizeof(float));
  fixture_detail::put_tag(bytes, "RIFF");
  fixture_detail::put_u32(bytes, 36u + payload);
  fixture_detail::put_tag(bytes, "WAVE");
  fixture_detail::put_tag(bytes, "fmt ");
  fixture_detail::put_u32(bytes, 16u);
  fixture_detail::put_u16(bytes, 3u);  // IEEE float
  fixture_detail::put_u16(bytes, 1u);  // mono
  fixture_detail::put_u32(bytes, rate);
  fixture_detail::put_u32(bytes, rate * 4u);  // byte rate
  fixture_detail::put_u16(bytes, 4u);         // block align
  fixture_detail::put_u16(bytes, 32u);        // bits per sample
  fixture_detail::put_tag(bytes, "data");
  fixture_detail::put_u32(bytes, payload);
  for (const float sample : samples) {
    unsigned char raw[sizeof(float)];
    std::memcpy(raw, &sample, sizeof(float));
    for (const unsigned char byte : raw) {
      bytes.push_back(byte);
    }
  }

  std::ofstream out(path, std::ios::binary | std::ios::trunc);
  if (!out) {
    return false;
  }
  out.write(reinterpret_cast<const char*>(bytes.data()),
            static_cast<std::streamsize>(bytes.size()));
  out.close();
  return out.good();
}

}  // namespace fluideq_engine_test

#endif  // FLUIDEQ_ENGINE_TESTS_WAV_FIXTURE_H
