/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "wav.h"

#include <algorithm>
#include <cstring>

namespace fluideq_engine {

namespace {

// Every one of these takes the buffer and its size again rather than trusting
// a cursor that was validated once: the chunk walk below reads several
// unrelated offsets inside one chunk (format tag, then bits-per-sample, then
// maybe a sub-format GUID 24 bytes further in), and a cursor that was only
// checked at the top of the chunk says nothing about whether THIS field is
// still inside the buffer.

std::optional<uint16_t> read_u16(const uint8_t* bytes, size_t size,
                                 size_t offset) {
  if (offset + 2 > size) {
    return std::nullopt;
  }
  return static_cast<uint16_t>(bytes[offset] |
                               (static_cast<uint16_t>(bytes[offset + 1])
                                << 8));
}

std::optional<uint32_t> read_u32(const uint8_t* bytes, size_t size,
                                 size_t offset) {
  if (offset + 4 > size) {
    return std::nullopt;
  }
  return static_cast<uint32_t>(bytes[offset]) |
         (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
         (static_cast<uint32_t>(bytes[offset + 2]) << 16) |
         (static_cast<uint32_t>(bytes[offset + 3]) << 24);
}

// One `fmt ` chunk's fields this reader cares about. `format_tag` is
// resolved to 1 (PCM) or 3 (float) even when the chunk declared
// WAVE_FORMAT_EXTENSIBLE, so every caller past this function reasons about
// exactly two formats.
struct FormatInfo {
  uint16_t format_tag;
  uint16_t channels;
  uint32_t sample_rate;
  uint16_t bits_per_sample;
};

std::optional<FormatInfo> parse_fmt_chunk(const uint8_t* bytes, size_t size,
                                          size_t data_start,
                                          uint32_t chunk_size) {
  if (chunk_size < 16) {
    return std::nullopt;  // Too short to hold the fixed PCM header.
  }
  const auto tag = read_u16(bytes, size, data_start);
  const auto channels = read_u16(bytes, size, data_start + 2);
  const auto sample_rate = read_u32(bytes, size, data_start + 4);
  // Bytes 8..13 (byte rate, block align) are not needed: both are derived
  // from channels/bits/sample_rate below rather than trusted from the file,
  // so a header that lies about them cannot desync the sample stride.
  const auto bits = read_u16(bytes, size, data_start + 14);
  if (!tag || !channels || !sample_rate || !bits) {
    return std::nullopt;
  }

  uint16_t resolved_tag = *tag;
  if (resolved_tag == 0xFFFE) {
    // WAVE_FORMAT_EXTENSIBLE: the real format lives in the sub-format GUID,
    // 24 bytes into the extension (16-byte fixed header + 2-byte cbSize +
    // 2-byte valid-bits + 4-byte channel mask). Only the GUID's first two
    // bytes are read, per the brief's resolution: 1 == PCM, 3 == float,
    // anything else refused rather than guessed at.
    if (chunk_size < 40) {
      return std::nullopt;
    }
    const auto sub_format = read_u16(bytes, size, data_start + 24);
    if (!sub_format || (*sub_format != 1 && *sub_format != 3)) {
      return std::nullopt;
    }
    resolved_tag = *sub_format;
  } else if (resolved_tag != 1 && resolved_tag != 3) {
    return std::nullopt;  // e.g. 0x0055 (MP3): a compressed tag this reader
                          // does not decode, refused rather than misread as
                          // raw PCM bytes.
  }

  return FormatInfo{resolved_tag, *channels, *sample_rate, *bits};
}

// One sample of the first channel, normalised to [-1, 1] for PCM (float
// passes through unscaled). `offset` has already been checked to have
// `bits_per_sample / 8` bytes available by the caller.
float read_sample(const uint8_t* bytes, size_t offset, uint16_t format_tag,
                  uint16_t bits_per_sample) {
  if (format_tag == 3) {  // IEEE float
    if (bits_per_sample == 32) {
      float value = 0.0f;
      std::memcpy(&value, bytes + offset, sizeof(value));
      return value;
    }
    // 64-bit float: read as double, then narrow, per the brief.
    double value = 0.0;
    std::memcpy(&value, bytes + offset, sizeof(value));
    return static_cast<float>(value);
  }

  // PCM. 8-bit is unsigned with centre 128; 16/24/32-bit are signed
  // little-endian, normalised by 2^(bits-1).
  if (bits_per_sample == 8) {
    return (static_cast<float>(bytes[offset]) - 128.0f) / 128.0f;
  }
  if (bits_per_sample == 16) {
    const uint32_t raw = static_cast<uint32_t>(bytes[offset]) |
                         (static_cast<uint32_t>(bytes[offset + 1]) << 8);
    const int16_t signed_value = static_cast<int16_t>(raw);
    return static_cast<float>(signed_value) / 32768.0f;
  }
  if (bits_per_sample == 24) {
    uint32_t raw = static_cast<uint32_t>(bytes[offset]) |
                   (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
                   (static_cast<uint32_t>(bytes[offset + 2]) << 16);
    if ((raw & 0x00800000u) != 0) {
      raw |= 0xFF000000u;  // Sign-extend the top byte before the cast below.
    }
    const int32_t signed_value = static_cast<int32_t>(raw);
    return static_cast<float>(signed_value) / 8388608.0f;  // 2^23
  }
  // 32-bit PCM.
  const uint32_t raw = static_cast<uint32_t>(bytes[offset]) |
                       (static_cast<uint32_t>(bytes[offset + 1]) << 8) |
                       (static_cast<uint32_t>(bytes[offset + 2]) << 16) |
                       (static_cast<uint32_t>(bytes[offset + 3]) << 24);
  const int32_t signed_value = static_cast<int32_t>(raw);
  return static_cast<float>(signed_value) / 2147483648.0f;  // 2^31
}

}  // namespace

std::optional<WavData> parse_wav(const uint8_t* bytes, size_t size) {
  if (bytes == nullptr || size < 12 || size > kMaxWavBytes) {
    return std::nullopt;
  }
  if (std::memcmp(bytes, "RIFF", 4) != 0 ||
      std::memcmp(bytes + 8, "WAVE", 4) != 0) {
    return std::nullopt;
  }

  std::optional<FormatInfo> format;
  size_t data_offset = 0;
  uint32_t data_size = 0;
  bool have_data = false;

  size_t pos = 12;
  while (pos + 8 <= size) {
    const uint8_t* id = bytes + pos;
    const auto chunk_size = read_u32(bytes, size, pos + 4);
    if (!chunk_size) {
      return std::nullopt;
    }
    const size_t chunk_data = pos + 8;
    // The cap comes before the bounds check, so a header claiming a gigabyte
    // of samples is refused on its own claim rather than on how much of it
    // happens to be present. Nothing is allocated from a declared size until
    // both have passed.
    if (*chunk_size > kMaxWavBytes) {
      return std::nullopt;
    }
    // The bounds check every chunk gets, `data` included: a declared size
    // that runs past the buffer fails the whole parse right here, before a
    // single byte of it is read, rather than a `data` chunk in particular
    // being special-cased after the fact.
    if (*chunk_size > size - chunk_data) {
      return std::nullopt;
    }

    if (std::memcmp(id, "fmt ", 4) == 0) {
      format = parse_fmt_chunk(bytes, size, chunk_data, *chunk_size);
      if (!format) {
        return std::nullopt;
      }
    } else if (std::memcmp(id, "data", 4) == 0) {
      data_offset = chunk_data;
      data_size = *chunk_size;
      have_data = true;
    }

    // RIFF chunks are word-aligned: an odd payload is followed by one pad
    // byte that is not part of the chunk's declared size.
    //
    // Widened to `size_t` before the addition: `*chunk_size` is a `uint32_t`,
    // and a declared size of 0xFFFFFFFF plus its pad byte wraps to 0 in that
    // type — an advance of zero on a 64-bit build is a loop that never leaves
    // this chunk. (The bounds check above already refuses that size against
    // any real buffer; this is the arithmetic not depending on it.)
    const size_t advance =
        static_cast<size_t>(*chunk_size) + (*chunk_size % 2u);
    pos = chunk_data + advance;
  }

  if (!format || !have_data) {
    return std::nullopt;
  }
  if (format->channels < 1 || format->channels > 8) {
    return std::nullopt;
  }
  const bool bits_valid =
      format->format_tag == 3
          ? (format->bits_per_sample == 32 || format->bits_per_sample == 64)
          : (format->bits_per_sample == 8 || format->bits_per_sample == 16 ||
             format->bits_per_sample == 24 || format->bits_per_sample == 32);
  if (!bits_valid) {
    return std::nullopt;
  }

  const uint32_t bytes_per_sample = format->bits_per_sample / 8;
  const uint32_t block_align =
      static_cast<uint32_t>(format->channels) * bytes_per_sample;
  const uint32_t frame_count = data_size / block_align;

  WavData result;
  result.sample_rate = format->sample_rate;
  result.mono.resize(frame_count);
  for (uint32_t frame = 0; frame < frame_count; ++frame) {
    // Every sample read stays inside `data_offset + data_size`, which was
    // already checked against `size` above: frame_count is data_size /
    // block_align, so the last frame's last byte is at most data_size - 1
    // past data_offset.
    const size_t offset =
        data_offset + static_cast<size_t>(frame) * block_align;
    result.mono[frame] =
        read_sample(bytes, offset, format->format_tag, format->bits_per_sample);
  }
  return result;
}

// The one Windows-specific function in this library. `WIN32_LEAN_AND_MEAN`
// and `NOMINMAX` keep this translation unit's only `<windows.h>` include from
// dragging in GDI/shell declarations or redefining `min`/`max` over the
// standard library names used above.
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>

std::optional<WavData> read_wav(const std::wstring& path) {
  const HANDLE file =
      CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr,
                 OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }

  LARGE_INTEGER file_size{};
  if (!GetFileSizeEx(file, &file_size) || file_size.QuadPart <= 0 ||
      file_size.QuadPart > static_cast<LONGLONG>(kMaxWavBytes)) {
    CloseHandle(file);
    // Empty, or past the cap. Checked against the size the file system
    // reports rather than after reading it: this runs inside audiodg.exe on
    // whatever path a config file names, so the file the user pointed at is
    // never read into memory before its size has been agreed to.
    // `kMaxWavBytes` is well under `UINT32_MAX`, so a chunk size in the
    // format this reader parses can still describe every byte of it.
    return std::nullopt;
  }

  std::vector<uint8_t> buffer(static_cast<size_t>(file_size.QuadPart));
  size_t total_read = 0;
  while (total_read < buffer.size()) {
    // `ReadFile` can return short (a network volume, an interrupted read)
    // even for a plain local file; looping until the buffer is full or a
    // call fails is what makes a short read impossible to mistake for a
    // truncated file.
    const size_t remaining = buffer.size() - total_read;
    constexpr size_t kMaxPerCall = 1u << 20;
    const DWORD to_read = static_cast<DWORD>(
        remaining < kMaxPerCall ? remaining : kMaxPerCall);
    DWORD read_now = 0;
    if (!ReadFile(file, buffer.data() + total_read, to_read, &read_now,
                 nullptr) ||
        read_now == 0) {
      CloseHandle(file);
      return std::nullopt;
    }
    total_read += read_now;
  }
  CloseHandle(file);

  return parse_wav(buffer.data(), buffer.size());
}

}  // namespace fluideq_engine
