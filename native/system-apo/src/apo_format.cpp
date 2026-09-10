/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What shape of audio this effect will take, and what it answers with when
 * offered something else.
 *
 * Its own translation unit for the same reason `apo_process.cpp` is: the
 * three files split along what Windows is asking about, not along how big
 * `apo.cpp` had grown. This one is the negotiation that happens before a
 * connection exists, `apo.cpp` is the object's identity and lifetime, and
 * `apo_process.cpp` is the audio itself.
 *
 * No `initguid.h` here on purpose — `apo.cpp` is the one translation unit
 * that defines GUIDs, and every id this file names
 * (`KSDATAFORMAT_SUBTYPE_IEEE_FLOAT`) is a compile-time `__uuidof` rather
 * than a symbol to link against.
 */

#include "apo.h"
#include "log.h"

// After `apo.h`, which is what pulls in `windows.h`: mmreg.h is one of the
// old multimedia headers and does not include it itself — on its own it does
// not know what a WORD is, and fails in a hundred lines of syntax errors that
// name none of that.
#include <mmreg.h>

namespace fluideq_engine {

namespace {

// 1 to 8: mono through 7.1. Above that the deinterleave scratch and the
// per-channel filter states stop being a fixed cost and this effect has no
// business in the signal path of a mixing desk.
constexpr WORD kMaxChannels = 8;

/**
 * The float32 answer to a format this effect cannot take.
 *
 * Same channel count and same rate as the request — the only thing changed
 * is the sample type, because that is the only thing being refused. A
 * suggestion that also moved the rate would have the audio engine resample
 * for no reason this effect asked for.
 */
HRESULT suggest_float(const WAVEFORMATEX* requested,
                      IAudioMediaType** supported) {
  WORD channels = requested == nullptr ? 2 : requested->nChannels;
  if (channels == 0) {
    channels = 2;
  }
  if (channels > kMaxChannels) {
    channels = kMaxChannels;
  }
  DWORD rate = requested == nullptr ? 48000 : requested->nSamplesPerSec;
  if (rate == 0) {
    rate = 48000;
  }

  WAVEFORMATEXTENSIBLE format = {};
  format.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
  format.Format.nChannels = channels;
  format.Format.nSamplesPerSec = rate;
  format.Format.wBitsPerSample = 32;
  format.Format.nBlockAlign = static_cast<WORD>(channels * 4);
  format.Format.nAvgBytesPerSec = rate * format.Format.nBlockAlign;
  format.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  format.Samples.wValidBitsPerSample = 32;
  format.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  // Carried over when the request had one; zero otherwise, which is the
  // documented "the channels are in their natural order" and is what a
  // plain WAVEFORMATEX request means anyway.
  if (requested != nullptr &&
      requested->nChannels == channels &&
      requested->wFormatTag == WAVE_FORMAT_EXTENSIBLE &&
      requested->cbSize >= sizeof(WAVEFORMATEXTENSIBLE) -
                               sizeof(WAVEFORMATEX)) {
    format.dwChannelMask =
        reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(requested)
            ->dwChannelMask;
  }
  return CreateAudioMediaType(&format.Format, sizeof(WAVEFORMATEXTENSIBLE),
                              supported);
}

}  // namespace

ConnectionFormat describe_format(const WAVEFORMATEX* format) {
  ConnectionFormat described;
  if (format == nullptr) {
    return described;
  }
  described.channels = format->nChannels;
  described.rate = format->nSamplesPerSec;
  if (format->wBitsPerSample != 32 || format->nChannels == 0 ||
      format->nChannels > kMaxChannels || format->nSamplesPerSec == 0 ||
      format->nBlockAlign != format->nChannels * sizeof(float) ||
      format->nAvgBytesPerSec !=
          static_cast<uint64_t>(format->nSamplesPerSec) * format->nBlockAlign) {
    return described;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    described.acceptable = true;
    return described;
  }
  if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE ||
      format->cbSize < sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX)) {
    return described;
  }
  const auto* extensible =
      reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
  // A 32-bit container carrying fewer valid bits is a padded integer format
  // wearing a float's clothes; those samples would not be floats.
  if (extensible->Samples.wValidBitsPerSample != 32 &&
      extensible->Samples.wValidBitsPerSample != 0) {
    return described;
  }
  described.acceptable =
      IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) != 0;
  return described;
}

STDMETHODIMP Apo::IsInputFormatSupported(IAudioMediaType* opposite,
                                         IAudioMediaType* requested,
                                         IAudioMediaType** supported) {
  if (!locked_) {
    trace(endpoint_.guid, "format asked about");
  }
  if (requested == nullptr) {
    return E_POINTER;
  }
  const WAVEFORMATEX* format = requested->GetAudioFormat();
  const ConnectionFormat input = describe_format(format);
  const ConnectionFormat output = describe_format(
      opposite == nullptr ? nullptr : opposite->GetAudioFormat());
  if (opposite != nullptr && !output.acceptable) {
    return APOERR_FORMAT_NOT_SUPPORTED;
  }
  if (input.acceptable &&
      (opposite == nullptr ||
       (input.channels == output.channels && input.rate == output.rate))) {
    if (supported != nullptr) {
      *supported = requested;
      requested->AddRef();
    }
    return S_OK;
  }
  if (supported == nullptr) {
    return S_FALSE;
  }
  if (opposite != nullptr) {
    // No remixing or resampling: negotiate the already fixed opposite side
    // instead of accepting a pair that LockForProcess will later reject.
    *supported = opposite;
    opposite->AddRef();
    return S_FALSE;
  }
  IAudioMediaType* suggestion = nullptr;
  const HRESULT made = suggest_float(format, &suggestion);
  if (FAILED(made)) {
    return APOERR_FORMAT_NOT_SUPPORTED;
  }
  *supported = suggestion;
  return S_FALSE;
}

STDMETHODIMP Apo::IsOutputFormatSupported(IAudioMediaType* opposite,
                                          IAudioMediaType* requested,
                                          IAudioMediaType** supported) {
  // Symmetric by construction: this effect never changes the format, so a
  // format it can read is exactly a format it can write.
  return IsInputFormatSupported(opposite, requested, supported);
}

}  // namespace fluideq_engine
