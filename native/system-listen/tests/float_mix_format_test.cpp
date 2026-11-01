/* FluidEQ — GPL-3.0-or-later */
// The one rule both loopback helpers (FluidEQ-Listen and FluidEQ-LAN-Capture)
// use to decide whether Windows' mix format is Float32 PCM they can pass on
// untouched. Anything else would be sent as if it were floats: integer PCM
// read as Float32 is full-scale noise in every display and every mirror.
#include "../../common/float_mix_format.h"

#include <cstdio>

namespace {
int failures = 0;
void check(bool condition, const char* description) {
  std::printf("  %s %s\n", condition ? "ok" : "FAIL", description);
  if (!condition) { ++failures; }
}

WAVEFORMATEXTENSIBLE extensible_float(WORD channels, DWORD rate) {
  WAVEFORMATEXTENSIBLE format{};
  format.Format.wFormatTag = WAVE_FORMAT_EXTENSIBLE;
  format.Format.nChannels = channels;
  format.Format.nSamplesPerSec = rate;
  format.Format.wBitsPerSample = 32;
  format.Format.nBlockAlign = static_cast<WORD>(channels * sizeof(float));
  format.Format.nAvgBytesPerSec = rate * format.Format.nBlockAlign;
  format.Format.cbSize = sizeof(WAVEFORMATEXTENSIBLE) - sizeof(WAVEFORMATEX);
  format.Samples.wValidBitsPerSample = 32;
  format.dwChannelMask = KSAUDIO_SPEAKER_STEREO;
  format.SubFormat = KSDATAFORMAT_SUBTYPE_IEEE_FLOAT;
  return format;
}

void accepts_what_windows_mixes_in() {
  auto stereo = extensible_float(2, 48'000);
  check(feq::is_float_mix_format(&stereo.Format, 8),
        "the ordinary shared-mode format: extensible float, stereo, 48 kHz");

  WAVEFORMATEX plain{};
  plain.wFormatTag = WAVE_FORMAT_IEEE_FLOAT;
  plain.nChannels = 2;
  plain.nSamplesPerSec = 44'100;
  plain.wBitsPerSample = 32;
  plain.nBlockAlign = 8;
  check(feq::is_float_mix_format(&plain, 8), "plain IEEE float");

  auto surround = extensible_float(8, 384'000);
  check(feq::is_float_mix_format(&surround.Format, 8),
        "7.1 at 384 kHz, the widest and fastest taken");
  auto low = extensible_float(1, 8'000);
  check(feq::is_float_mix_format(&low.Format, 8), "mono at 8 kHz");
}

void refuses_what_it_would_misread() {
  check(!feq::is_float_mix_format(nullptr, 8), "no format at all");

  auto integer = extensible_float(2, 48'000);
  integer.SubFormat = KSDATAFORMAT_SUBTYPE_PCM;
  check(!feq::is_float_mix_format(&integer.Format, 8),
        "32-bit integer PCM in an extensible format");

  auto sixteen = extensible_float(2, 48'000);
  sixteen.Format.wBitsPerSample = 16;
  sixteen.Format.nBlockAlign = 4;
  check(!feq::is_float_mix_format(&sixteen.Format, 8), "16-bit samples");

  auto wide = extensible_float(8, 48'000);
  check(!feq::is_float_mix_format(&wide.Format, 2),
        "more channels than the caller can carry");

  auto fast = extensible_float(2, 768'000);
  check(!feq::is_float_mix_format(&fast.Format, 8), "a rate past 384 kHz");

  auto padded = extensible_float(2, 48'000);
  padded.Format.nBlockAlign = 12;
  check(!feq::is_float_mix_format(&padded.Format, 8),
        "frames padded past their samples");

  auto truncated = extensible_float(2, 48'000);
  truncated.Format.cbSize = 0;
  check(!feq::is_float_mix_format(&truncated.Format, 8),
        "an extensible tag with no extension to read the subtype from");
}
}  // namespace

int main() {
  accepts_what_windows_mixes_in();
  refuses_what_it_would_misread();
  if (failures != 0) {
    std::printf("%d check(s) failed\n", failures);
    return 1;
  }
  std::printf("all checks passed\n");
  return 0;
}
