/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `parse_wav`, held to hand-built RIFF/WAVE byte buffers — never a real
 * file, so the malformed cases (a truncated buffer, a `data` chunk claiming
 * more bytes than exist) are exact and repeatable. `read_wav`'s own file
 * I/O is a thin, untested wrapper around `CreateFileW`/`ReadFile` plus this
 * function; nothing about the format grammar lives there.
 */

#include "../src/wav.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <vector>

using fluideq_engine::parse_wav;
using fluideq_engine::WavData;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

// Variadic for the same reason config_test.cpp's CHECK is: a brace-init-list
// argument (none here yet, but kept consistent with the rest of this
// subtree) would otherwise split on the preprocessor's top-level commas.
#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

void push_u16(std::vector<uint8_t>& out, uint16_t v) {
  out.push_back(static_cast<uint8_t>(v & 0xFF));
  out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
}

void push_u32(std::vector<uint8_t>& out, uint32_t v) {
  out.push_back(static_cast<uint8_t>(v & 0xFF));
  out.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
  out.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
  out.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
}

void push_tag(std::vector<uint8_t>& out, const char* tag) {
  out.insert(out.end(), tag, tag + 4);
}

// A minimal `fmt ` chunk payload for PCM or IEEE float: format tag through
// bits-per-sample, no extension. `format_tag` is 1 (PCM) or 3 (float).
std::vector<uint8_t> basic_fmt(uint16_t format_tag, uint16_t channels,
                               uint32_t sample_rate, uint16_t bits) {
  std::vector<uint8_t> fmt;
  push_u16(fmt, format_tag);
  push_u16(fmt, channels);
  push_u32(fmt, sample_rate);
  const uint32_t block_align = static_cast<uint32_t>(channels) * (bits / 8);
  push_u32(fmt, sample_rate * block_align);  // byte rate, unchecked by parse_wav
  push_u16(fmt, static_cast<uint16_t>(block_align));
  push_u16(fmt, bits);
  return fmt;
}

// Assembles "RIFF" <size> "WAVE" "fmt " <fmt_chunk> "data" <data>, with the
// even-byte chunk padding RIFF requires and the correct RIFF size patched in
// afterwards.
std::vector<uint8_t> build_wav(const std::vector<uint8_t>& fmt_chunk,
                               const std::vector<uint8_t>& data) {
  std::vector<uint8_t> out;
  push_tag(out, "RIFF");
  push_u32(out, 0);  // patched below, once the real size is known
  push_tag(out, "WAVE");
  push_tag(out, "fmt ");
  push_u32(out, static_cast<uint32_t>(fmt_chunk.size()));
  out.insert(out.end(), fmt_chunk.begin(), fmt_chunk.end());
  if (fmt_chunk.size() % 2 != 0) {
    out.push_back(0);
  }
  push_tag(out, "data");
  push_u32(out, static_cast<uint32_t>(data.size()));
  out.insert(out.end(), data.begin(), data.end());
  if (data.size() % 2 != 0) {
    out.push_back(0);
  }
  const uint32_t riff_size = static_cast<uint32_t>(out.size() - 8);
  out[4] = static_cast<uint8_t>(riff_size & 0xFF);
  out[5] = static_cast<uint8_t>((riff_size >> 8) & 0xFF);
  out[6] = static_cast<uint8_t>((riff_size >> 16) & 0xFF);
  out[7] = static_cast<uint8_t>((riff_size >> 24) & 0xFF);
  return out;
}

void pcm16_stereo_reads_first_channel() {
  std::printf("48 kHz 16-bit stereo: rate, and the left channel only\n");
  std::vector<uint8_t> data;
  for (int frame = 0; frame < 4; ++frame) {
    push_u16(data, static_cast<uint16_t>(static_cast<int16_t>(16384)));   // L
    push_u16(data, static_cast<uint16_t>(static_cast<int16_t>(-16384)));  // R
  }
  const auto wav = build_wav(basic_fmt(1, 2, 48000, 16), data);
  const auto parsed = parse_wav(wav.data(), wav.size());
  CHECK(parsed.has_value());
  if (!parsed) {
    return;
  }
  CHECK(parsed->sample_rate == 48000);
  CHECK(parsed->mono.size() == 4);
  for (float sample : parsed->mono) {
    CHECK(std::fabs(static_cast<double>(sample) - 0.5) < 1e-4);
  }
}

void float32_mono_is_exact() {
  std::printf("float32 mono: exact values, no normalisation\n");
  std::vector<uint8_t> data;
  const float values[3] = {1.0f, -0.5f, 0.25f};
  for (float value : values) {
    uint8_t bytes[4];
    std::memcpy(bytes, &value, sizeof(bytes));
    data.insert(data.end(), bytes, bytes + sizeof(bytes));
  }
  const auto wav = build_wav(basic_fmt(3, 1, 48000, 32), data);
  const auto parsed = parse_wav(wav.data(), wav.size());
  CHECK(parsed.has_value());
  if (!parsed) {
    return;
  }
  CHECK(parsed->mono.size() == 3);
  CHECK(parsed->mono[0] == 1.0f);
  CHECK(parsed->mono[1] == -0.5f);
  CHECK(parsed->mono[2] == 0.25f);
}

void extensible_pcm_subformat_is_read() {
  std::printf("WAVE_FORMAT_EXTENSIBLE with the PCM sub-format GUID\n");
  std::vector<uint8_t> fmt;
  push_u16(fmt, 0xFFFE);  // WAVE_FORMAT_EXTENSIBLE
  push_u16(fmt, 1);       // mono
  push_u32(fmt, 44100);
  const uint32_t block_align = 2;  // 16-bit mono
  push_u32(fmt, 44100u * block_align);
  push_u16(fmt, static_cast<uint16_t>(block_align));
  push_u16(fmt, 16);  // bits per sample
  push_u16(fmt, 22);  // cbSize: validBitsPerSample + channelMask + SubFormat
  push_u16(fmt, 16);  // valid bits per sample
  push_u32(fmt, 0);   // channel mask
  // SubFormat GUID: only the first two bytes matter here (1 == PCM); the
  // remaining fourteen are the fixed KSDATAFORMAT_SUBTYPE tail, irrelevant
  // to the check the brief specifies.
  push_u16(fmt, 1);
  for (int i = 0; i < 14; ++i) {
    fmt.push_back(0);
  }

  std::vector<uint8_t> data;
  push_u16(data, static_cast<uint16_t>(static_cast<int16_t>(32767)));
  const auto wav = build_wav(fmt, data);
  const auto parsed = parse_wav(wav.data(), wav.size());
  CHECK(parsed.has_value());
  if (!parsed) {
    return;
  }
  CHECK(parsed->sample_rate == 44100);
  CHECK(parsed->mono.size() == 1);
}

void a_20_byte_buffer_is_not_a_wav() {
  std::printf("a 20-byte buffer is refused\n");
  const std::vector<uint8_t> junk(20, 0);
  CHECK(!parse_wav(junk.data(), junk.size()));
}

void unsupported_format_tag_is_refused() {
  std::printf("format tag 0x0055 (MP3) is refused, not guessed at\n");
  const std::vector<uint8_t> data = {0, 0, 0, 0};
  const auto wav = build_wav(basic_fmt(0x0055, 2, 48000, 16), data);
  CHECK(!parse_wav(wav.data(), wav.size()));
}

void oversized_data_chunk_never_reads_past_the_end() {
  std::printf("a data chunk size larger than the buffer never overreads\n");
  std::vector<uint8_t> wav = build_wav(basic_fmt(1, 1, 48000, 16), {1, 2});
  const char tag[4] = {'d', 'a', 't', 'a'};
  const auto found = std::search(wav.begin(), wav.end(), tag, tag + 4);
  CHECK(found != wav.end());
  if (found == wav.end()) {
    return;
  }
  // The four bytes right after "data" are its declared chunk size; inflate
  // it far past the buffer without adding a single byte of payload. A parser
  // that trusted this header before checking it against `size` would read
  // whatever memory happens to follow the buffer.
  const size_t size_offset = static_cast<size_t>(found - wav.begin()) + 4;
  wav[size_offset] = 0xFF;
  wav[size_offset + 1] = 0xFF;
  wav[size_offset + 2] = 0xFF;
  wav[size_offset + 3] = 0x7F;
  CHECK(!parse_wav(wav.data(), wav.size()));
}

}  // namespace

int main() {
  std::printf("fluideq engine wav reader\n");
  pcm16_stereo_reads_first_channel();
  float32_mono_is_exact();
  extensible_pcm_subformat_is_read();
  a_20_byte_buffer_is_not_a_wav();
  unsupported_format_tag_is_refused();
  oversized_data_chunk_never_reads_past_the_end();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
