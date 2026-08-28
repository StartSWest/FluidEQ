/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "pcm_decoder.h"

#include "compressed_decoder.h"
#include "media_decoder.h"

#include <cmath>
#include <cstdint>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>

namespace {

enum class Encoding {
  Unsupported,
  /** Two's complement, 8 to 32 bits, little- or big-endian. */
  Integer,
  Float32,
  Float64,
  /** 8-bit WAV is unsigned with 128 as silence, which nothing else is. */
  UnsignedByte
};

struct PcmFile {
  std::ifstream stream;
  Encoding encoding = Encoding::Unsupported;
  int big_endian = 0;
  uint32_t bytes_per_sample = 0;
  /** What the file holds. */
  uint32_t channels = 0;
  /** What the player asked for, which is what `read` must produce. */
  uint32_t out_channels = 2;
  uint32_t sample_rate = 0;
  uint64_t total_frames = 0;
  /** Byte offset of the first sample, and the span of them. */
  uint64_t data_offset = 0;
  uint64_t data_bytes = 0;
  uint64_t position = 0;
  /** One block of raw bytes, sized once so `read` never allocates. */
  std::vector<uint8_t> raw;
};

uint32_t read_le32(const uint8_t* at) {
  return static_cast<uint32_t>(at[0]) |
         (static_cast<uint32_t>(at[1]) << 8) |
         (static_cast<uint32_t>(at[2]) << 16) |
         (static_cast<uint32_t>(at[3]) << 24);
}

uint16_t read_le16(const uint8_t* at) {
  return static_cast<uint16_t>(static_cast<uint32_t>(at[0]) |
                               (static_cast<uint32_t>(at[1]) << 8));
}

uint32_t read_be32(const uint8_t* at) {
  return (static_cast<uint32_t>(at[0]) << 24) |
         (static_cast<uint32_t>(at[1]) << 16) |
         (static_cast<uint32_t>(at[2]) << 8) | static_cast<uint32_t>(at[3]);
}

uint16_t read_be16(const uint8_t* at) {
  return static_cast<uint16_t>((static_cast<uint32_t>(at[0]) << 8) |
                               static_cast<uint32_t>(at[1]));
}

/**
 * AIFF stores its rate as an 80-bit IEEE extended float.
 *
 * A format nothing else in the world uses, for a number that is always 44100
 * or 48000. Reading it as anything simpler works until it does not, and the
 * failure is a track that plays at the wrong speed rather than one that
 * refuses to open.
 */
double read_extended80(const uint8_t* at) {
  const int sign = (at[0] & 0x80) != 0 ? -1 : 1;
  const int exponent = ((static_cast<int>(at[0]) & 0x7F) << 8) |
                       static_cast<int>(at[1]);
  uint64_t mantissa = 0;
  for (int index = 0; index < 8; ++index) {
    mantissa = (mantissa << 8) | static_cast<uint64_t>(at[2 + index]);
  }
  if (exponent == 0 && mantissa == 0) {
    return 0.0;
  }
  if (exponent == 0x7FFF) {
    return 0.0;
  }
  return sign * static_cast<double>(mantissa) *
         std::pow(2.0, static_cast<double>(exponent - 16383 - 63));
}

bool read_exact(std::ifstream& stream, uint8_t* into, size_t bytes) {
  stream.read(reinterpret_cast<char*>(into), static_cast<std::streamsize>(bytes));
  return static_cast<size_t>(stream.gcount()) == bytes;
}

/** RIFF/WAVE. Chunks are walked rather than assumed to be in any order. */
bool parse_wav(PcmFile& file) {
  uint8_t header[12];
  file.stream.seekg(0);
  if (!read_exact(file.stream, header, sizeof(header))) {
    return false;
  }
  if (std::memcmp(header, "RIFF", 4) != 0 ||
      std::memcmp(header + 8, "WAVE", 4) != 0) {
    return false;
  }

  bool have_format = false;
  uint16_t format_tag = 0;
  uint16_t bits = 0;
  for (;;) {
    uint8_t chunk[8];
    if (!read_exact(file.stream, chunk, sizeof(chunk))) {
      break;
    }
    const uint32_t size = read_le32(chunk + 4);
    const std::streampos body = file.stream.tellg();

    if (std::memcmp(chunk, "fmt ", 4) == 0 && size >= 16) {
      std::vector<uint8_t> format(size);
      if (!read_exact(file.stream, format.data(), size)) {
        return false;
      }
      format_tag = read_le16(format.data());
      file.channels = read_le16(format.data() + 2);
      file.sample_rate = read_le32(format.data() + 4);
      bits = read_le16(format.data() + 14);
      /**
       * WAVE_FORMAT_EXTENSIBLE moves the real tag into a GUID.
       *
       * Every file above two channels or 16 bits written by a modern encoder
       * uses it, and a reader that only knows tags 1 and 3 rejects most of a
       * high-resolution library while accepting the CD rips beside it.
       */
      if (format_tag == 0xFFFE && size >= 40) {
        format_tag = read_le16(format.data() + 24);
      }
      have_format = true;
    } else if (std::memcmp(chunk, "data", 4) == 0) {
      file.data_offset = static_cast<uint64_t>(body);
      file.data_bytes = size;
      if (have_format) {
        break;
      }
    }

    // Chunks are word-aligned and the pad byte is not counted in the size.
    const uint64_t advance = size + (size % 2);
    file.stream.seekg(static_cast<std::streamoff>(
                          static_cast<uint64_t>(body) + advance),
                      std::ios::beg);
    if (!file.stream) {
      break;
    }
  }
  if (!have_format || file.channels == 0 || file.sample_rate == 0 ||
      file.data_bytes == 0) {
    return false;
  }

  file.bytes_per_sample = bits / 8u;
  file.big_endian = 0;
  if (format_tag == 1 && bits == 8) {
    file.encoding = Encoding::UnsignedByte;
  } else if (format_tag == 1 && (bits == 16 || bits == 24 || bits == 32)) {
    file.encoding = Encoding::Integer;
  } else if (format_tag == 3 && bits == 32) {
    file.encoding = Encoding::Float32;
  } else if (format_tag == 3 && bits == 64) {
    file.encoding = Encoding::Float64;
  } else {
    return false;
  }
  const uint64_t frame_bytes =
      static_cast<uint64_t>(file.bytes_per_sample) * file.channels;
  file.total_frames = frame_bytes > 0 ? file.data_bytes / frame_bytes : 0;
  return file.total_frames > 0;
}

/** AIFF and AIFF-C. Big-endian by definition; `sowt` is the exception. */
bool parse_aiff(PcmFile& file) {
  uint8_t header[12];
  file.stream.seekg(0);
  if (!read_exact(file.stream, header, sizeof(header))) {
    return false;
  }
  if (std::memcmp(header, "FORM", 4) != 0) {
    return false;
  }
  const bool compressed = std::memcmp(header + 8, "AIFC", 4) == 0;
  if (!compressed && std::memcmp(header + 8, "AIFF", 4) != 0) {
    return false;
  }

  bool have_common = false;
  uint16_t bits = 0;
  file.big_endian = 1;
  for (;;) {
    uint8_t chunk[8];
    if (!read_exact(file.stream, chunk, sizeof(chunk))) {
      break;
    }
    const uint32_t size = read_be32(chunk + 4);
    const std::streampos body = file.stream.tellg();

    if (std::memcmp(chunk, "COMM", 4) == 0 && size >= 18) {
      std::vector<uint8_t> common(size);
      if (!read_exact(file.stream, common.data(), size)) {
        return false;
      }
      file.channels = read_be16(common.data());
      file.total_frames = read_be32(common.data() + 2);
      bits = read_be16(common.data() + 6);
      file.sample_rate =
          static_cast<uint32_t>(read_extended80(common.data() + 8));
      if (compressed && size >= 22) {
        const uint8_t* codec = common.data() + 18;
        if (std::memcmp(codec, "sowt", 4) == 0) {
          // Little-endian PCM in a big-endian container: what every Mac
          // recorder writes, and the one AIFF-C variant that is not a codec.
          file.big_endian = 0;
        } else if (std::memcmp(codec, "fl32", 4) == 0 ||
                   std::memcmp(codec, "FL32", 4) == 0) {
          bits = 32;
          file.encoding = Encoding::Float32;
        } else if (std::memcmp(codec, "NONE", 4) != 0) {
          return false;
        }
      }
      have_common = true;
    } else if (std::memcmp(chunk, "SSND", 4) == 0 && size >= 8) {
      uint8_t offsets[8];
      if (!read_exact(file.stream, offsets, sizeof(offsets))) {
        return false;
      }
      file.data_offset =
          static_cast<uint64_t>(body) + 8 + read_be32(offsets);
      file.data_bytes = size - 8;
      if (have_common) {
        break;
      }
    }

    const uint64_t advance = size + (size % 2);
    file.stream.seekg(static_cast<std::streamoff>(
                          static_cast<uint64_t>(body) + advance),
                      std::ios::beg);
    if (!file.stream) {
      break;
    }
  }
  if (!have_common || file.channels == 0 || file.sample_rate == 0 ||
      file.total_frames == 0) {
    return false;
  }
  file.bytes_per_sample = bits / 8u;
  if (file.encoding != Encoding::Float32) {
    if (bits != 8 && bits != 16 && bits != 24 && bits != 32) {
      return false;
    }
    file.encoding = Encoding::Integer;
  }
  return true;
}

/** One raw sample to -1..1, whatever it was stored as. */
double decode_sample(const PcmFile& file, const uint8_t* at) {
  switch (file.encoding) {
    case Encoding::UnsignedByte:
      // 128 is silence and the range is 0..255, so it centres rather than
      // scales: an 8-bit WAV read as signed is full-scale square-wave noise.
      return (static_cast<double>(at[0]) - 128.0) / 128.0;
    case Encoding::Float32: {
      uint32_t bits = file.big_endian != 0 ? read_be32(at) : read_le32(at);
      float value = 0.0f;
      std::memcpy(&value, &bits, sizeof(value));
      return static_cast<double>(value);
    }
    case Encoding::Float64: {
      uint64_t bits = 0;
      for (int index = 0; index < 8; ++index) {
        const int byte = file.big_endian != 0 ? index : 7 - index;
        bits = (bits << 8) | static_cast<uint64_t>(at[byte]);
      }
      double value = 0.0;
      std::memcpy(&value, &bits, sizeof(value));
      return value;
    }
    case Encoding::Integer: {
      int32_t value = 0;
      for (uint32_t index = 0; index < file.bytes_per_sample; ++index) {
        const uint32_t byte =
            file.big_endian != 0 ? index : file.bytes_per_sample - 1 - index;
        value = (value << 8) | static_cast<int32_t>(at[byte]);
      }
      // Sign-extend from whatever width it actually was. 24-bit is the case
      // that matters: read as a 32-bit value every negative sample becomes a
      // very large positive one, which is full-scale noise rather than audio.
      const uint32_t bits = file.bytes_per_sample * 8;
      const int32_t sign_bit = static_cast<int32_t>(1u << (bits - 1));
      if ((value & sign_bit) != 0) {
        value -= static_cast<int32_t>(1u << bits);
      }
      return static_cast<double>(value) / static_cast<double>(sign_bit);
    }
    case Encoding::Unsupported:
    default:
      return 0.0;
  }
}

void* pcm_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  auto* file = new PcmFile();
  file->out_channels = info->channels > 0 ? info->channels : 2;
  file->stream.open(path, std::ios::binary);
  if (!file->stream) {
    delete file;
    return nullptr;
  }
  if (!parse_wav(*file)) {
    file->stream.clear();
    if (!parse_aiff(*file)) {
      delete file;
      return nullptr;
    }
  }
  file->position = 0;
  file->stream.clear();
  file->stream.seekg(static_cast<std::streamoff>(file->data_offset),
                     std::ios::beg);
  info->sample_rate = file->sample_rate;
  // Echoed back unchanged: what `read` produces is what was asked for.
  info->channels = file->out_channels;
  info->total_frames = file->total_frames;
  return file;
}

void pcm_close(void* /*user*/, void* handle) {
  delete static_cast<PcmFile*>(handle);
}

uint32_t pcm_read(void* /*user*/, void* handle, float* const* channels,
                  uint32_t frames) {
  auto* file = static_cast<PcmFile*>(handle);
  if (file->position >= file->total_frames) {
    return 0;
  }
  const uint64_t remaining = file->total_frames - file->position;
  const uint32_t span =
      static_cast<uint32_t>(frames < remaining ? frames : remaining);
  const size_t frame_bytes =
      static_cast<size_t>(file->bytes_per_sample) * file->channels;
  const size_t wanted = frame_bytes * span;
  if (file->raw.size() < wanted) {
    file->raw.resize(wanted);
  }
  file->stream.read(reinterpret_cast<char*>(file->raw.data()),
                    static_cast<std::streamsize>(wanted));
  const auto got = static_cast<size_t>(file->stream.gcount());
  const auto produced = static_cast<uint32_t>(got / frame_bytes);

  /**
   * The player asked for its own channel count, which is rarely the file's.
   *
   * Mono is duplicated into every requested channel rather than left in the
   * first: a mono track that played only on the left is not a subtle bug.
   * Above the requested count the extra channels are dropped rather than
   * mixed, because a real fold-down needs the channel layout and WAV only
   * sometimes carries one — inventing a matrix silently would make two
   * surround files behave differently for no reason a listener could name.
   */
  for (uint32_t frame = 0; frame < produced; ++frame) {
    const uint8_t* at =
        file->raw.data() + static_cast<size_t>(frame) * frame_bytes;
    for (uint32_t channel = 0; channel < file->out_channels; ++channel) {
      const uint32_t source =
          file->channels == 1 ? 0
                              : (channel < file->channels ? channel
                                                          : file->channels - 1);
      channels[channel][frame] = static_cast<float>(decode_sample(
          *file, at + static_cast<size_t>(source) * file->bytes_per_sample));
    }
  }
  file->position += produced;
  return produced;
}

int pcm_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* file = static_cast<PcmFile*>(handle);
  if (frame > file->total_frames) {
    return 0;
  }
  const uint64_t frame_bytes =
      static_cast<uint64_t>(file->bytes_per_sample) * file->channels;
  file->stream.clear();
  file->stream.seekg(
      static_cast<std::streamoff>(file->data_offset + frame * frame_bytes),
      std::ios::beg);
  if (!file->stream) {
    return 0;
  }
  file->position = frame;
  return 1;
}

}  // namespace

namespace {

/**
 * Which decoder opened a given file, remembered for as long as it is open.
 *
 * The two decoders have separate handles and separate function tables, and the
 * player holds one `void*` per deck with no room for a tag. Rather than widen
 * its interface for something only this file cares about, the handle is
 * wrapped: one small allocation per open, freed on close.
 */
struct AnyDecoder {
  FeqDecoderOps ops;
  void* handle;
};

void* any_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  /**
   * PCM first, compressed second, and the order is not arbitrary.
   *
   * The PCM reader recognises its formats by a magic number at a fixed offset
   * and refuses everything else immediately. The compressed one ends by
   * offering the file to dr_mp3, which scans for a frame header â and an
   * unlucky WAV can contain a byte pattern that looks like one. Asking the
   * strict reader first means that never comes up.
   */
  const FeqDecoderOps pcm = feq_pcm_decoder_ops();
  FeqDecoderInfo asked = *info;
  void* handle = pcm.open(pcm.user, path, info);
  if (handle != nullptr) {
    return new AnyDecoder{pcm, handle};
  }

  // `open` may have written into `info` before failing, so the request is
  // restored rather than passed on in whatever state it was left.
  *info = asked;
  const FeqDecoderOps compressed = feq_compressed_decoder_ops();
  handle = compressed.open(compressed.user, path, info);
  if (handle != nullptr) {
    return new AnyDecoder{compressed, handle};
  }

  /**
   * Last, because it is the only one that can be absent.
   *
   * The platform decoder covers what no vendored library could without a
   * licence or a patent problem â the MPEG-4 family and WMA â but it exists
   * only where the operating system provides it, and its `open` is null
   * everywhere else. Asking it after the two that are always compiled in means
   * a machine without one behaves exactly like a file none of them can read.
   */
  *info = asked;
  const FeqDecoderOps platform = feq_media_decoder_ops();
  if (platform.open == nullptr) {
    return nullptr;
  }
  handle = platform.open(platform.user, path, info);
  if (handle != nullptr) {
    return new AnyDecoder{platform, handle};
  }
  return nullptr;

}

void any_close(void* /*user*/, void* handle) {
  auto* any = static_cast<AnyDecoder*>(handle);
  if (any == nullptr) {
    return;
  }
  any->ops.close(any->ops.user, any->handle);
  delete any;
}

uint32_t any_read(void* /*user*/, void* handle, float* const* channels,
                  uint32_t frames) {
  auto* any = static_cast<AnyDecoder*>(handle);
  return any == nullptr
             ? 0
             : any->ops.read(any->ops.user, any->handle, channels, frames);
}

int any_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* any = static_cast<AnyDecoder*>(handle);
  return any == nullptr ? 0 : any->ops.seek(any->ops.user, any->handle, frame);
}

}  // namespace

/** WAV and AIFF alone, which is what the compressed reader falls back from. */
FeqDecoderOps feq_pcm_decoder_ops(void) {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = pcm_open;
  ops.close = pcm_close;
  ops.read = pcm_read;
  ops.seek = pcm_seek;
  return ops;
}

FeqDecoderOps feq_decoder_ops(void) {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = any_open;
  ops.close = any_close;
  ops.read = any_read;
  ops.seek = any_seek;
  return ops;
}


int feq_decoder_handles(const char* path) {
  if (path == nullptr) {
    return 0;
  }
  // By content rather than by extension: a `.wav` holding an mp3 payload is a
  // real thing, and so is a correct file someone renamed.
  std::ifstream stream(path, std::ios::binary);
  if (!stream) {
    return 0;
  }
  uint8_t header[12] = {0};
  stream.read(reinterpret_cast<char*>(header), sizeof(header));
  if (stream.gcount() < static_cast<std::streamsize>(sizeof(header))) {
    return 0;
  }
  const bool wave = std::memcmp(header, "RIFF", 4) == 0 &&
                    std::memcmp(header + 8, "WAVE", 4) == 0;
  const bool aiff = std::memcmp(header, "FORM", 4) == 0 &&
                    (std::memcmp(header + 8, "AIFF", 4) == 0 ||
                     std::memcmp(header + 8, "AIFC", 4) == 0);
  return wave || aiff ? 1 : 0;
}
