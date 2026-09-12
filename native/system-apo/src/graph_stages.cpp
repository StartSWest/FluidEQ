/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "graph_stages.h"

#include <cmath>
#include <cstddef>
#include <optional>
#include <mutex>
#include <utility>

#include "fluideq/resampler.h"
#include "graphic_eq.h"
#include "wav.h"

namespace fluideq_engine {

std::shared_ptr<const std::vector<float>> kernel_identity(std::vector<float> samples) {
  static std::mutex mutex;
  static std::vector<std::weak_ptr<const std::vector<float>>> identities;
  const std::lock_guard<std::mutex> lock(mutex);
  for (auto entry = identities.begin(); entry != identities.end();) {
    if (auto existing = entry->lock()) {
      if (*existing == samples) {
        return existing;
      }
      ++entry;
    } else {
      entry = identities.erase(entry);
    }
  }
  auto identity = std::make_shared<const std::vector<float>>(std::move(samples));
  identities.push_back(identity);
  return identity;
}

namespace {

// The longest kernel this engine hands to the convolver, for the
// `Convolution:` file and the graphic FIR alike: 128 partitions of
// frequency-domain multiply per block, past which a longer response stops
// buying anything either source can express and starts putting the
// audiodg.exe callback at risk.
//
// It bites on both, for different reasons. An impulse response reaches it
// often — a two-second reverb at 48 kHz is 96000 samples — and is truncated
// with a warning rather than refused, because half a reverb tail is still the
// room the user chose and silence is not. The FIR's tap count is derived from
// the stream's sample rate, which arrives from Windows in a mix format this
// code did not write: a rate it would be wrong to trust becomes an allocation
// sized by it, on a load path that has nowhere to report a failure.
constexpr uint32_t kMaxKernelTaps = 65536;

// The graphic-EQ FIR's tap count is specified at 48 kHz and scaled with the
// stream, so its resolution in Hz per tap — and therefore how closely it
// tracks a curve down at 20 Hz — is the same on every device.
constexpr uint32_t kGraphicTapsAt48k = 4097;
constexpr double kGraphicReferenceRate = 48000.0;

/**
 * A path, flattened to ASCII for one warning line.
 *
 * Lossy on purpose: this string is only ever printed to a log, never opened,
 * and a faithful UTF-8 conversion would mean `WideCharToMultiByte` and a
 * Windows header in a translation unit that has no other reason for one.
 */
std::string narrow(const std::wstring& text) {
  std::string out;
  out.reserve(text.size());
  for (const wchar_t character : text) {
    const bool printable = character >= 0x20 && character < 0x7f;
    out.push_back(printable ? static_cast<char>(character) : '?');
  }
  return out;
}

/**
 * Converts a mono kernel to another rate, once, at construction.
 *
 * `feq_resample` returns short whenever the input runs out mid-call, so the
 * loop is driven by how much input has been consumed rather than by one call
 * being enough; the flush afterwards is the half window the converter still
 * holds when the file ends, which for an impulse response is real tail.
 */
std::vector<float> resample_mono(const std::vector<float>& input,
                                 double from_rate, double to_rate) {
  FeqResampler* state = feq_resampler_create(from_rate, to_rate, 1);
  if (state == nullptr) {
    return {};
  }

  const double scaled =
      std::ceil(static_cast<double>(input.size()) * to_rate / from_rate);
  std::vector<float> output(static_cast<size_t>(scaled) + FEQ_RESAMPLER_TAPS,
                            0.0f);

  size_t taken = 0;
  size_t written = 0;
  while (taken < input.size() && written < output.size()) {
    const float* const in_planar[1] = {input.data() + taken};
    float* const out_planar[1] = {output.data() + written};
    uint32_t consumed = 0;
    const uint32_t produced = feq_resample(
        state, in_planar, static_cast<uint32_t>(input.size() - taken),
        out_planar, static_cast<uint32_t>(output.size() - written), &consumed);
    if (produced == 0 && consumed == 0) {
      break;  // Neither side moved; looping again would never terminate.
    }
    taken += consumed;
    written += produced;
  }
  while (written < output.size()) {
    float* const out_planar[1] = {output.data() + written};
    const uint32_t produced = feq_resampler_flush(
        state, out_planar, static_cast<uint32_t>(output.size() - written));
    if (produced == 0) {
      break;
    }
    written += produced;
  }

  feq_resampler_destroy(state);
  output.resize(written);
  return output;
}

}  // namespace

std::vector<float> load_impulse(const std::wstring& path, uint32_t sample_rate,
                                std::vector<std::string>& warnings) {
  const std::optional<WavData> wav = read_wav(path);
  if (!wav || wav->mono.empty()) {
    // The size cap is named here because it is the one refusal a user can act
    // on: the others (missing, damaged, a compressed format) are all "this is
    // not a WAVE this engine can read", but "too large" is a file they can
    // trim. `read_wav` cannot say which of the two it hit without growing a
    // reason type for one caller, so the line names both.
    warnings.push_back("Convolution file could not be read — missing, not a "
                       "supported WAVE, or larger than " +
                       std::to_string(kMaxWavBytes / (1024u * 1024u)) +
                       " MiB: " + narrow(path));
    return {};
  }

  const size_t source_taps = wav->mono.size();
  bool truncated = false;

  std::vector<float> kernel = wav->mono;
  if (wav->sample_rate != sample_rate) {
    // Truncated BEFORE the conversion rather than after it. A six-minute file
    // at 44.1 kHz is sixteen million samples; converting all of them means an
    // allocation that size and the converter's work on every one, and then
    // all but the first 65536 are thrown away. Only the input that can still
    // land inside `kMaxKernelTaps` at the stream's rate is converted, plus
    // one resampler window so the last kept tap is produced from a full
    // window rather than from an input that stops underneath it.
    const double source_needed =
        std::ceil(static_cast<double>(kMaxKernelTaps) *
                  static_cast<double>(wav->sample_rate) /
                  static_cast<double>(sample_rate)) +
        static_cast<double>(FEQ_RESAMPLER_TAPS);
    if (source_needed < static_cast<double>(kernel.size())) {
      kernel.resize(static_cast<size_t>(source_needed));
      truncated = true;
    }
    kernel = resample_mono(kernel, static_cast<double>(wav->sample_rate),
                           static_cast<double>(sample_rate));
    // Checked, and the failure warning pushed, BEFORE the success warning
    // below: a resample that produced nothing must not be logged as having
    // resampled the file, which is what happened when the two lines were the
    // other way round.
    if (kernel.empty()) {
      warnings.push_back("Convolution file could not be resampled: " +
                         narrow(path));
      return {};
    }
    warnings.push_back("Convolution file is " +
                       std::to_string(wav->sample_rate) + " Hz; resampled to " +
                       std::to_string(sample_rate) + " Hz.");
  }
  if (kernel.size() > kMaxKernelTaps) {
    kernel.resize(kMaxKernelTaps);
    truncated = true;
  }
  // The file's own length, not the converted one: after a pre-resample
  // truncation the converted vector is a number this engine chose, and
  // reporting it would tell the user their file was the size of our limit.
  if (truncated) {
    warnings.push_back("Convolution file is " + std::to_string(source_taps) +
                       " samples at " + std::to_string(wav->sample_rate) +
                       " Hz; only the first " +
                       std::to_string(kMaxKernelTaps) + " are used.");
  }
  return kernel;
}

std::vector<float> design_graphic(
    const std::vector<std::vector<GraphicPoint>>& curves, uint32_t sample_rate,
    std::vector<std::string>& warnings) {
  const double scaled = static_cast<double>(kGraphicTapsAt48k) *
                        static_cast<double>(sample_rate) /
                        kGraphicReferenceRate;
  // Compared as a double BEFORE any narrowing. `sample_rate` arrives from a
  // mix format this code did not write, and at rates the cap is meant to
  // guard against, `scaled` can be far past what `std::lround` (into a 32-bit
  // `long`) or a `uint32_t` can round-trip; narrowing first let that
  // wraparound land back under `kMaxKernelTaps` and skip the cap entirely.
  uint32_t taps;
  if (scaled > static_cast<double>(kMaxKernelTaps)) {
    taps = (kMaxKernelTaps - 1u) | 1u;
    warnings.push_back("Graphic EQ needs " + std::to_string(std::llround(scaled)) +
                       " taps at " + std::to_string(sample_rate) +
                       " Hz; designed with " + std::to_string(taps) +
                       " instead.");
  } else {
    taps = static_cast<uint32_t>(std::lround(scaled)) | 1u;
  }
  return design_graphic_kernel(curves, sample_rate, taps);
}

bool build_convolvers(const FeqConvolverKernel* kernel, uint32_t channels,
                      std::vector<ConvolverPtr>& out) {
  out.clear();
  out.reserve(channels);
  for (uint32_t at = 0; at < channels; ++at) {
    ConvolverPtr convolver(feq_convolver_create(kernel));
    if (!convolver) {
      out.clear();
      return false;
    }
    out.push_back(std::move(convolver));
  }
  return true;
}

}  // namespace fluideq_engine
