/* FluidEQ — GPL-3.0-or-later */
#pragma once

#include <Windows.h>
// Before ks.h and ksmedia.h: mmreg.h names WAVE_FORMAT_IEEE_FLOAT, and
// ksmedia.h only defines the float subtype once mmreg.h has been read. The
// helpers had it already through audioclient.h; on its own this header did not.
#include <mmreg.h>
#include <ks.h>
#include <ksmedia.h>

#include <cstdint>

namespace feq {

/**
 * Whether a shared-mode mix format is interleaved Float32 PCM a capture can
 * pass on as it is: 1 to `max_channels` channels, 8 kHz to 384 kHz, either
 * plainly IEEE float or WAVE_FORMAT_EXTENSIBLE with the float subtype.
 */
[[nodiscard]] inline bool is_float_mix_format(const WAVEFORMATEX* format,
                                              std::uint16_t max_channels) {
  if (format == nullptr || format->nChannels < 1 ||
      format->nChannels > max_channels || format->nSamplesPerSec < 8'000 ||
      format->nSamplesPerSec > 384'000 || format->wBitsPerSample != 32 ||
      format->nBlockAlign != format->nChannels * sizeof(float)) {
    return false;
  }
  if (format->wFormatTag == WAVE_FORMAT_IEEE_FLOAT) {
    return true;
  }
  if (format->wFormatTag != WAVE_FORMAT_EXTENSIBLE ||
      format->cbSize < sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX)) {
    return false;
  }
  const auto* extensible =
      reinterpret_cast<const WAVEFORMATEXTENSIBLE*>(format);
  return IsEqualGUID(extensible->SubFormat, KSDATAFORMAT_SUBTYPE_IEEE_FLOAT) !=
         FALSE;
}

}  // namespace feq
