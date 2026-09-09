/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A bounds-checked RIFF/WAVE reader for one use: loading a `Convolution:`
 * impulse response off disk. `parse_wav` never touches Windows or the file
 * system, so the grammar of the format itself can be unit tested with
 * hand-built byte buffers, including the malformed ones a hand-edited or
 * truncated file can produce. `read_wav` is the one place this subtree calls
 * into the file system, and it does nothing but read the bytes and hand them
 * to `parse_wav`.
 *
 * Not under `include/`: nothing outside `fluideq-engine-dsp` needs this
 * shape, only the reader itself and `graph.cpp` (Task 3), both of which sit
 * beside it in this directory.
 */
#ifndef FLUIDEQ_ENGINE_WAV_H
#define FLUIDEQ_ENGINE_WAV_H

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace fluideq_engine {

struct WavData {
  uint32_t sample_rate;
  // First channel only. A convolution kernel is a mono impulse response;
  // anything past channel 0 was never asked for and is silently dropped
  // rather than mixed, which would change the measured impulse.
  std::vector<float> mono;
};

/**
 * Parses one WAVE file already in memory.
 *
 * Every field this function reads is bounds-checked against `size` before
 * the read happens — a chunk whose declared size runs past the buffer
 * (truncated file, or a `data` size larger than what is actually there)
 * fails the whole parse rather than reading past `bytes + size`.
 *
 * Accepts PCM (format tag 1) at 8/16/24/32 bits, IEEE float (tag 3) at 32/64
 * bits, and WAVE_FORMAT_EXTENSIBLE (tag 0xFFFE) whose sub-format resolves to
 * one of those two. Anything else — including a compressed tag like 0x0055
 * (MP3) — is `nullopt`, never a guess at how to decode it.
 */
std::optional<WavData> parse_wav(const uint8_t* bytes, size_t size);

/** Reads the whole file via `CreateFileW`/`ReadFile`, then `parse_wav`. */
std::optional<WavData> read_wav(const std::wstring& path);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_WAV_H
