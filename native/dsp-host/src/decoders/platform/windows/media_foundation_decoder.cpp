/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../../media_decoder.h"

#include <windows.h>

#include <mferror.h>
#include <mfapi.h>
#include <mfidl.h>
#include <mfreadwrite.h>
#include <propvarutil.h>
#include <wrl/client.h>

#include <atomic>
#include <string>
#include <vector>

using Microsoft::WRL::ComPtr;

namespace {

/** Media Foundation counts time in 100-nanosecond units, everywhere. */
constexpr double kHundredNanosPerSecond = 10000000.0;

/**
 * Started once per process, and never shut down while a file may be open.
 *
 * `MFShutdown` is refcounted against `MFStartup`, but a reader outliving its
 * shutdown is undefined rather than merely unsupported. The counter here means
 * the last file closing releases it and the first one opening brings it back,
 * which is the only ordering that holds when two decks load at once.
 */
std::atomic<int> g_started{0};

bool startup() {
  if (g_started.fetch_add(1, std::memory_order_acq_rel) == 0) {
    if (FAILED(MFStartup(MF_VERSION, MFSTARTUP_LITE))) {
      g_started.fetch_sub(1, std::memory_order_acq_rel);
      return false;
    }
  }
  return true;
}

void shutdown() {
  if (g_started.fetch_sub(1, std::memory_order_acq_rel) == 1) {
    MFShutdown();
  }
}

struct MediaFile {
  ComPtr<IMFSourceReader> reader;
  uint32_t file_channels = 0;
  uint32_t out_channels = 2;
  uint32_t sample_rate = 0;
  uint64_t total_frames = 0;
  uint64_t position = 0;
  /**
   * What a sample gave us that the caller did not ask for yet.
   *
   * `ReadSample` returns whole compressed frames — 1024 for AAC — and the
   * player asks for whatever the ring has room for. Without somewhere to put
   * the remainder, every read would have to discard the tail of a frame, which
   * is a gap every 21 milliseconds.
   */
  std::vector<float> pending;
  uint32_t pending_at = 0;
  int exhausted = 0;
};

std::wstring widen(const char* path) {
  const int needed =
      MultiByteToWideChar(CP_UTF8, 0, path, -1, nullptr, 0);
  if (needed <= 0) {
    return std::wstring();
  }
  std::wstring wide(static_cast<size_t>(needed), L'\0');
  MultiByteToWideChar(CP_UTF8, 0, path, -1, wide.data(), needed);
  // The count includes the terminator; the string owns its own.
  wide.resize(static_cast<size_t>(needed) - 1);
  return wide;
}

/**
 * Ask the reader for float PCM and let it insert whatever decoder it needs.
 *
 * Setting a partial type — major type and subtype only — is Media Foundation's
 * own idiom for "convert to this and work out how yourself". It is what makes
 * one code path serve AAC, WMA and everything else the OS carries.
 */
bool request_float_pcm(IMFSourceReader* reader) {
  ComPtr<IMFMediaType> wanted;
  if (FAILED(MFCreateMediaType(&wanted))) {
    return false;
  }
  if (FAILED(wanted->SetGUID(MF_MT_MAJOR_TYPE, MFMediaType_Audio)) ||
      FAILED(wanted->SetGUID(MF_MT_SUBTYPE, MFAudioFormat_Float))) {
    return false;
  }
  return SUCCEEDED(reader->SetCurrentMediaType(
      static_cast<DWORD>(MF_SOURCE_READER_FIRST_AUDIO_STREAM), nullptr,
      wanted.Get()));
}

bool read_format(IMFSourceReader* reader, MediaFile& file) {
  ComPtr<IMFMediaType> actual;
  if (FAILED(reader->GetCurrentMediaType(
          static_cast<DWORD>(MF_SOURCE_READER_FIRST_AUDIO_STREAM), &actual))) {
    return false;
  }
  UINT32 channels = 0;
  UINT32 rate = 0;
  UINT32 bits = 0;
  if (FAILED(actual->GetUINT32(MF_MT_AUDIO_NUM_CHANNELS, &channels)) ||
      FAILED(actual->GetUINT32(MF_MT_AUDIO_SAMPLES_PER_SECOND, &rate))) {
    return false;
  }
  // Asked for float and told it was float. Anything else means the reader
  // silently gave us something we would misread as samples.
  if (SUCCEEDED(actual->GetUINT32(MF_MT_AUDIO_BITS_PER_SAMPLE, &bits)) &&
      bits != 32) {
    return false;
  }
  file.file_channels = channels;
  file.sample_rate = rate;
  return channels > 0 && rate > 0;
}

/** Total frames, from the duration the container declares. */
uint64_t read_duration(IMFSourceReader* reader, uint32_t sample_rate) {
  PROPVARIANT value;
  PropVariantInit(&value);
  uint64_t frames = 0;
  if (SUCCEEDED(reader->GetPresentationAttribute(
          static_cast<DWORD>(MF_SOURCE_READER_MEDIASOURCE), MF_PD_DURATION,
          &value))) {
    LONGLONG hundred_nanos = 0;
    if (SUCCEEDED(PropVariantToInt64(value, &hundred_nanos)) &&
        hundred_nanos > 0) {
      frames = static_cast<uint64_t>(
          (static_cast<double>(hundred_nanos) / kHundredNanosPerSecond) *
          sample_rate);
    }
  }
  PropVariantClear(&value);
  // Zero rather than a guess. The player reads it as "the decoder cannot say",
  // which is true, and shows no duration rather than a wrong one.
  return frames;
}

/** Pull one sample and leave its floats in `pending`. False at end of stream. */
bool pull(MediaFile* file) {
  DWORD flags = 0;
  ComPtr<IMFSample> sample;
  const HRESULT read = file->reader->ReadSample(
      static_cast<DWORD>(MF_SOURCE_READER_FIRST_AUDIO_STREAM), 0, nullptr,
      &flags, nullptr, &sample);
  if (FAILED(read) || (flags & MF_SOURCE_READERF_ENDOFSTREAM) != 0) {
    file->exhausted = 1;
    return false;
  }
  if (!sample) {
    // A gap or a format change with no data attached. Not the end, and not
    // something to report as one — the next call carries on.
    return true;
  }

  ComPtr<IMFMediaBuffer> buffer;
  if (FAILED(sample->ConvertToContiguousBuffer(&buffer))) {
    return true;
  }
  BYTE* bytes = nullptr;
  DWORD length = 0;
  if (FAILED(buffer->Lock(&bytes, nullptr, &length))) {
    return true;
  }
  const size_t floats = length / sizeof(float);
  file->pending.assign(reinterpret_cast<const float*>(bytes),
                       reinterpret_cast<const float*>(bytes) + floats);
  file->pending_at = 0;
  buffer->Unlock();
  return true;
}

void* media_open(void* /*user*/, const char* path, FeqDecoderInfo* info) {
  if (!startup()) {
    return nullptr;
  }
  const std::wstring wide = widen(path);
  if (wide.empty()) {
    shutdown();
    return nullptr;
  }

  auto* file = new MediaFile();
  file->out_channels = info->channels > 0 ? info->channels : 2;

  ComPtr<IMFAttributes> attributes;
  if (SUCCEEDED(MFCreateAttributes(&attributes, 1))) {
    // Hardware transforms are for video and can pull in a driver's decoder;
    // this path wants the software one, which is the one Microsoft licenses
    // and the one that behaves the same on every machine.
    attributes->SetUINT32(MF_READWRITE_ENABLE_HARDWARE_TRANSFORMS, FALSE);
  }
  if (FAILED(MFCreateSourceReaderFromURL(wide.c_str(), attributes.Get(),
                                         &file->reader)) ||
      !request_float_pcm(file->reader.Get()) ||
      !read_format(file->reader.Get(), *file)) {
    delete file;
    shutdown();
    return nullptr;
  }
  file->total_frames = read_duration(file->reader.Get(), file->sample_rate);

  info->sample_rate = file->sample_rate;
  // Echoed back unchanged: what `read` produces is what was asked for.
  info->channels = file->out_channels;
  info->total_frames = file->total_frames;
  return file;
}

void media_close(void* /*user*/, void* handle) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr) {
    return;
  }
  // The reader goes before `MFShutdown`, which is what the refcount above is
  // protecting: releasing it after would be a call into a torn-down library.
  file->reader.Reset();
  delete file;
  shutdown();
}

uint32_t media_read(void* /*user*/, void* handle, float* const* channels,
                    uint32_t frames) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr || frames == 0) {
    return 0;
  }
  uint32_t produced = 0;
  while (produced < frames) {
    const uint32_t available =
        (static_cast<uint32_t>(file->pending.size()) - file->pending_at) /
        file->file_channels;
    if (available == 0) {
      if (file->exhausted != 0 || !pull(file)) {
        break;
      }
      continue;
    }
    const uint32_t span =
        available < frames - produced ? available : frames - produced;
    for (uint32_t frame = 0; frame < span; ++frame) {
      const float* source =
          file->pending.data() + file->pending_at +
          static_cast<size_t>(frame) * file->file_channels;
      /**
       * The file's channels onto the player's.
       *
       * Mono is duplicated into every requested channel rather than left in
       * the first; above the requested count the extras are dropped rather
       * than mixed, because a real fold-down needs the channel layout and
       * inventing a matrix silently would make two surround files behave
       * differently for no reason a listener could name. The same rule as the
       * other two decoders, on purpose.
       */
      for (uint32_t channel = 0; channel < file->out_channels; ++channel) {
        const uint32_t from =
            file->file_channels == 1
                ? 0
                : (channel < file->file_channels ? channel
                                                 : file->file_channels - 1);
        channels[channel][produced + frame] = source[from];
      }
    }
    file->pending_at += span * file->file_channels;
    produced += span;
  }
  file->position += produced;
  return produced;
}

int media_seek(void* /*user*/, void* handle, uint64_t frame) {
  auto* file = static_cast<MediaFile*>(handle);
  if (file == nullptr || file->sample_rate == 0) {
    return 0;
  }
  PROPVARIANT position;
  InitPropVariantFromInt64(
      static_cast<LONGLONG>((static_cast<double>(frame) / file->sample_rate) *
                            kHundredNanosPerSecond),
      &position);
  const HRESULT moved = file->reader->SetCurrentPosition(GUID_NULL, position);
  PropVariantClear(&position);
  if (FAILED(moved)) {
    return 0;
  }
  // Whatever was decoded for the old position belongs to it. Keeping it would
  // play a fragment of the previous point before the new one arrives.
  file->pending.clear();
  file->pending_at = 0;
  file->exhausted = 0;
  file->position = frame;
  return 1;
}

}  // namespace

FeqDecoderOps feq_media_decoder_ops(void) {
  FeqDecoderOps ops{};
  ops.user = nullptr;
  ops.open = media_open;
  ops.close = media_close;
  ops.read = media_read;
  ops.seek = media_seek;
  return ops;
}
