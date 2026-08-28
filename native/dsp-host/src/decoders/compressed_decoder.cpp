/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * MP3, FLAC and Ogg Vorbis, behind the same handle the PCM decoder uses.
 *
 * Three single-header libraries do the actual decoding — see `vendor.cpp` for
 * which, and for the licence of each verified at its author's own repository.
 * What lives here is everything they do NOT agree on: two of them hand back
 * interleaved floats and one wants a channel count up front, none of them maps
 * a file's channels onto the player's, and each spells "seek" differently.
 *
 * The player asks for a fixed channel count and gets exactly that. Doing the
 * fold-down here rather than in the player is what stops two files in one
 * playlist behaving differently — a mono track duplicated across both channels
 * is 3 dB louder than one that leaves the right silent, and both are
 * defensible right up until they are heard back to back.
 */

#include "compressed_decoder.h"

#include "vendor/dr_flac.h"
#include "vendor/dr_mp3.h"
#include "vendor/stb_vorbis_decl.h"

#include <cstring>
#include <string>
#include <vector>

namespace {

enum class Codec { None, Mp3, Flac, Vorbis };

struct CompressedFile {
  Codec codec = Codec::None;
  drmp3 mp3{};
  drflac* flac = nullptr;
  stb_vorbis* vorbis = nullptr;
  uint32_t file_channels = 0;
  uint32_t out_channels = 2;
  uint32_t sample_rate = 0;
  uint64_t total_frames = 0;
  /**
   * Interleaved scratch, sized once for the largest read the player makes.
   *
   * Every one of these libraries returns interleaved and the chain is planar,
   * so a de-interleave is unavoidable. Growing the buffer inside `read` would
   * allocate on the decoder thread once per size change; sizing it on the
   * first call and keeping it costs one allocation per file.
   */
  std::vector<float> interleaved;
};

/**
 * By content, not by extension.
 *
 * A `.mp3` holding a FLAC stream is a real thing people have in their music
 * folders, and so is a correct file somebody renamed. An ID3 tag can also push
 * the first MPEG frame arbitrarily far in, which is why the mp3 case is left
 * to the library's own scan rather than guessed at from the first four bytes.
 */
Codec sniff(const char* path) {
  std::FILE* file = nullptr;
#if defined(_WIN32)
  if (fopen_s(&file, path, "rb") != 0) {
    file = nullptr;
  }
#else
  file = std::fopen(path, "rb");
#endif
  if (file == nullptr) {
    return Codec::None;
  }
  unsigned char header[4] = {0, 0, 0, 0};
  const size_t got = std::fread(header, 1, sizeof(header), file);
  std::fclose(file);
  if (got < sizeof(header)) {
    return Codec::None;
  }
  if (std::memcmp(header, "fLaC", 4) == 0) {
    return Codec::Flac;
  }
  if (std::memcmp(header, "OggS", 4) == 0) {
    return Codec::Vorbis;
  }
  // Everything else is offered to dr_mp3, which scans for a frame header and
  // refuses if it finds none. That is the honest way to answer "is this an
  // mp3": the format has no magic number at a fixed offset.
  return Codec::Mp3;
}

void close_file(CompressedFile* file) {
  if (file == nullptr) {
    return;
  }
  switch (file->codec) {
    case Codec::Mp3:
      drmp3_uninit(&file->mp3);
      break;
    case Codec::Flac:
      drflac_close(file->flac);
      break;
    case Codec::Vorbis:
      stb_vorbis_close(file->vorbis);
      break;
    case Codec::None:
    default:
      break;
  }
  delete file;
}

void* compressed_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  auto* file = new CompressedFile();
  file->out_channels = info->channels > 0 ? info->channels : 2;
  file->codec = sniff(path);

  switch (file->codec) {
    case Codec::Flac: {
      file->flac = drflac_open_file(path, nullptr);
      if (file->flac == nullptr) {
        break;
      }
      file->file_channels = file->flac->channels;
      file->sample_rate = file->flac->sampleRate;
      file->total_frames = file->flac->totalPCMFrameCount;
      break;
    }
    case Codec::Vorbis: {
      int error = 0;
      file->vorbis = stb_vorbis_open_filename(path, &error, nullptr);
      if (file->vorbis == nullptr) {
        break;
      }
      const stb_vorbis_info spec = stb_vorbis_get_info(file->vorbis);
      file->file_channels = static_cast<uint32_t>(spec.channels);
      file->sample_rate = spec.sample_rate;
      file->total_frames = stb_vorbis_stream_length_in_samples(file->vorbis);
      break;
    }
    case Codec::Mp3: {
      if (drmp3_init_file(&file->mp3, path, nullptr) == DRMP3_FALSE) {
        file->codec = Codec::None;
        break;
      }
      file->file_channels = file->mp3.channels;
      file->sample_rate = file->mp3.sampleRate;
      // Costs a scan of the frame headers, which is the only way to know a
      // duration for a stream that carries no length. Done once, at open, so
      // the transport has a number before the first block is asked for.
      file->total_frames = drmp3_get_pcm_frame_count(&file->mp3);
      break;
    }
    case Codec::None:
    default:
      break;
  }

  if (file->codec == Codec::None || file->file_channels == 0 ||
      file->sample_rate == 0) {
    close_file(file);
    return nullptr;
  }

  info->sample_rate = file->sample_rate;
  // Echoed back unchanged: what `read` produces is what was asked for.
  info->channels = file->out_channels;
  info->total_frames = file->total_frames;
  return file;
}

void compressed_close(void* /*user*/, void* handle) {
  close_file(static_cast<CompressedFile*>(handle));
}

uint32_t compressed_read(void* /*user*/, void* handle, float* const* channels,
                         uint32_t frames) {
  auto* file = static_cast<CompressedFile*>(handle);
  if (file == nullptr || frames == 0) {
    return 0;
  }
  const size_t wanted =
      static_cast<size_t>(frames) * file->file_channels;
  if (file->interleaved.size() < wanted) {
    file->interleaved.resize(wanted);
  }
  float* raw = file->interleaved.data();

  uint32_t produced = 0;
  switch (file->codec) {
    case Codec::Mp3:
      produced = static_cast<uint32_t>(
          drmp3_read_pcm_frames_f32(&file->mp3, frames, raw));
      break;
    case Codec::Flac:
      produced = static_cast<uint32_t>(
          drflac_read_pcm_frames_f32(file->flac, frames, raw));
      break;
    case Codec::Vorbis: {
      const int got = stb_vorbis_get_samples_float_interleaved(
          file->vorbis, static_cast<int>(file->file_channels), raw,
          static_cast<int>(wanted));
      produced = got > 0 ? static_cast<uint32_t>(got) : 0;
      break;
    }
    case Codec::None:
    default:
      return 0;
  }

  /**
   * Interleaved to planar, and the file's channels onto the player's.
   *
   * Mono is duplicated into every requested channel rather than left in the
   * first: a mono track playing only on the left is not a subtle bug. Above
   * the requested count the extras are dropped rather than mixed, because a
   * real fold-down needs the channel layout and inventing a matrix silently
   * would make two surround files behave differently for no reason a listener
   * could name.
   */
  for (uint32_t frame = 0; frame < produced; ++frame) {
    const float* source =
        raw + static_cast<size_t>(frame) * file->file_channels;
    for (uint32_t channel = 0; channel < file->out_channels; ++channel) {
      const uint32_t from =
          file->file_channels == 1
              ? 0
              : (channel < file->file_channels ? channel
                                               : file->file_channels - 1);
      channels[channel][frame] = source[from];
    }
  }
  return produced;
}

int compressed_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* file = static_cast<CompressedFile*>(handle);
  if (file == nullptr) {
    return 0;
  }
  switch (file->codec) {
    case Codec::Mp3:
      return drmp3_seek_to_pcm_frame(&file->mp3, frame) == DRMP3_TRUE ? 1 : 0;
    case Codec::Flac:
      return drflac_seek_to_pcm_frame(file->flac, frame) == DRFLAC_TRUE ? 1 : 0;
    case Codec::Vorbis:
      return stb_vorbis_seek(file->vorbis,
                             static_cast<unsigned int>(frame)) != 0
                 ? 1
                 : 0;
    case Codec::None:
    default:
      return 0;
  }
}

}  // namespace

FeqDecoderOps feq_compressed_decoder_ops(void) {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = compressed_open;
  ops.close = compressed_close;
  ops.read = compressed_read;
  ops.seek = compressed_seek;
  return ops;
}
