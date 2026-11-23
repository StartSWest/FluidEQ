/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The voice cleaner's output lands exactly where the chain says it does, so
 * a Strength under 100% blends the cleaned voice with the same instant of the
 * untouched one — at all eight shared-mode rates.
 *
 * Measured by cross-correlation on real speech: the cleaned voice alone
 * (Strength 100%) against the input, peak lag against the latency the chain
 * reports, which is also the delay its dry path carries. A cleaned voice that
 * lands later than its dry copy is the same word heard twice, a few hundredths
 * of a second apart: an echo on every mic whose profile cleans at less than
 * full strength.
 *
 * It needs the real model, its runtime and a speech recording, none of which
 * belong in the tree:
 *   FLUIDEQ_TEST_VOICE_MODEL   the voice model (.onnx)
 *   FLUIDEQ_TEST_ONNXRUNTIME   onnxruntime.dll
 *   FLUIDEQ_TEST_SPEECH        a 16-bit mono 48 kHz WAV of speech
 * Without them it says so and passes, as the sidecar-driven tests do.
 *
 * Real time, because the cleaner's worker runs beside the audio thread: the
 * blocks come one device period apart on a waitable timer standing in for the
 * device clock.
 */

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#endif

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"

namespace {

using feq_test::check;

std::string model;
std::string runtime;

/** An environment variable, or empty. */
std::string env(const char* name) {
#if defined(_MSC_VER)
  char* value = nullptr;
  size_t length = 0;
  if (_dupenv_s(&value, &length, name) != 0 || value == nullptr) return {};
  std::string out(value);
  std::free(value);
  return out;
#else
  const char* value = std::getenv(name);
  return value != nullptr ? value : "";
#endif
}

std::vector<float> read_wav(const char* path) {
  std::vector<float> out;
  std::ifstream file(path, std::ios::binary);
  if (!file) return out;
  const std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(file)),
                                         std::istreambuf_iterator<char>());
  size_t at = 12;
  while (at + 8 <= bytes.size()) {
    const uint32_t size = bytes[at + 4] | (bytes[at + 5] << 8) |
                          (bytes[at + 6] << 16) | (static_cast<uint32_t>(bytes[at + 7]) << 24);
    if (std::memcmp(&bytes[at], "data", 4) == 0) {
      for (size_t i = 0; i + 1 < size && at + 9 + i < bytes.size(); i += 2) {
        const auto sample = static_cast<int16_t>(bytes[at + 8 + i] | (bytes[at + 9 + i] << 8));
        out.push_back(sample / 32768.0f);
      }
      return out;
    }
    at += 8 + size + (size & 1u);
  }
  return out;
}

/** The recording at `rate`, linearly; speech has nothing up where it aliases. */
std::vector<float> at_rate(const std::vector<float>& speech, double rate, double seconds) {
  const size_t frames = static_cast<size_t>(seconds * rate);
  std::vector<float> out(frames, 0.0f);
  for (size_t i = 0; i < frames; ++i) {
    const double from = static_cast<double>(i) * 48000.0 / rate;
    const size_t index = static_cast<size_t>(from);
    if (index + 1 >= speech.size()) break;
    const double frac = from - static_cast<double>(index);
    out[i] = static_cast<float>(speech[index] * (1.0 - frac) + speech[index + 1] * frac);
  }
  return out;
}

/** The cleaner alone, as a mic's rack runs it, at `amount`. */
FeqChain* build(double rate, uint32_t block, double amount, bool low_latency) {
  FeqChain* chain = feq_chain_create(rate, 1, block);
  if (chain == nullptr) return nullptr;
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.low_latency = low_latency ? 1 : 0;
  settings.denoise.enabled = 1;
  settings.denoise.hiss.enabled = 0;
  settings.denoise.click.enabled = 0;
  settings.denoise.voice.enabled = 1;
  settings.denoise.voice.amount = amount;
  feq_chain_configure(chain, &settings);
  std::vector<float> silence(block, 0.0f);
  float* planes[1] = {silence.data()};
  feq_chain_process(chain, planes, block);
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
  if (feq_chain_load_voice_model(chain, model.c_str(), runtime.c_str()) == 0) {
    feq_chain_destroy(chain);
    return nullptr;
  }
  return chain;
}

struct Played {
  std::vector<float> input;
  std::vector<float> output;
  uint32_t latency = 0;
  uint32_t late = 0;
  bool built = false;
};

/** Three seconds of speech through the chain, one device period at a time. */
Played play(double rate, const std::vector<float>& speech, double amount, bool low_latency) {
  Played result;
  const uint32_t block = static_cast<uint32_t>(std::lround(rate * 0.01));
  result.input = at_rate(speech, rate, 3.0);
  result.output.assign(result.input.size(), 0.0f);
  FeqChain* chain = build(rate, block, amount, low_latency);
  if (chain == nullptr) return result;
  result.built = true;
  result.latency = feq_chain_latency_frames(chain);
#if defined(_WIN32)
  HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr,
                                        CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,
                                        TIMER_ALL_ACCESS);
  LARGE_INTEGER frequency{};
  LARGE_INTEGER start{};
  QueryPerformanceFrequency(&frequency);
  QueryPerformanceCounter(&start);
#endif
  std::vector<float> buffer(block);
  const size_t blocks = result.input.size() / block;
  for (size_t b = 0; b < blocks; ++b) {
#if defined(_WIN32)
    const double due = static_cast<double>(b) * block / rate;
    LARGE_INTEGER now{};
    QueryPerformanceCounter(&now);
    const double elapsed =
        static_cast<double>(now.QuadPart - start.QuadPart) / static_cast<double>(frequency.QuadPart);
    if (due > elapsed) {
      LARGE_INTEGER wait{};
      wait.QuadPart = -static_cast<LONGLONG>((due - elapsed) * 1e7);
      SetWaitableTimer(timer, &wait, 0, nullptr, nullptr, FALSE);
      WaitForSingleObject(timer, INFINITE);
    }
#endif
    std::memcpy(buffer.data(), &result.input[b * block], block * sizeof(float));
    float* planes[1] = {buffer.data()};
    feq_chain_process(chain, planes, block);
    feq_chain_wake_workers(chain);
    std::memcpy(&result.output[b * block], buffer.data(), block * sizeof(float));
  }
  result.late = feq_chain_voice_late(chain);
  feq_chain_destroy(chain);
#if defined(_WIN32)
  CloseHandle(timer);
#endif
  return result;
}

/**
 * The lag, in frames, at which the output best matches the input: normalised
 * cross-correlation over the voiced second and a half in the middle, searched
 * up to 80 ms past the reported latency.
 */
long best_lag(const Played& played, double rate) {
  const size_t from = static_cast<size_t>(rate * 0.8);
  const size_t to = static_cast<size_t>(rate * 2.3);
  const long reach = static_cast<long>(played.latency) + static_cast<long>(rate * 0.08);
  long best = -1;
  double best_score = -1.0;
  for (long lag = 0; lag <= reach; ++lag) {
    double cross = 0.0, energy = 0.0;
    for (size_t i = from; i < to; ++i) {
      const double in = played.input[i - static_cast<size_t>(lag)];
      cross += in * played.output[i];
      energy += in * in;
    }
    const double score = energy > 0.0 ? cross / std::sqrt(energy) : 0.0;
    if (score > best_score) {
      best_score = score;
      best = lag;
    }
  }
  return best;
}

}  // namespace

int main() {
  model = env("FLUIDEQ_TEST_VOICE_MODEL");
  runtime = env("FLUIDEQ_TEST_ONNXRUNTIME");
  const std::string speech_path = env("FLUIDEQ_TEST_SPEECH");
  if (model.empty() || runtime.empty() || speech_path.empty()) {
    std::printf("voice alignment: skipped, set FLUIDEQ_TEST_VOICE_MODEL, "
                "FLUIDEQ_TEST_ONNXRUNTIME and FLUIDEQ_TEST_SPEECH to run it\n");
    return 0;
  }
  std::vector<float> speech = read_wav(speech_path.c_str());
  float peak = 0.0f;
  for (const float sample : speech) peak = std::max(peak, std::fabs(sample));
  if (peak > 0.0f) {
    for (float& sample : speech) sample *= 0.5f / peak;
  }
  check(speech.size() > 48000 * 3, "the speech recording holds three seconds");
  for (const double rate : {44100.0, 48000.0, 88200.0, 96000.0, 176400.0,
                            192000.0, 352800.0, 384000.0}) {
    for (const bool low_latency : {true, false}) {
      std::printf("rate %.1f kHz, %s\n", rate / 1000.0,
                  low_latency ? "low lag" : "four hops of headroom");
      const Played cleaned = play(rate, speech, 1.0, low_latency);
      // POSITIVE CONTROL: Strength 0 plays the dry path alone, so the measure
      // finds the dry copy exactly where the chain delays it — the instant a
      // cleaned voice has to land on for a blend to be one voice.
      const Played dry = play(rate, speech, 0.0, low_latency);
      check(cleaned.built && dry.built, "the model loads at this rate");
      if (!cleaned.built || !dry.built) continue;
      const long lag = best_lag(cleaned, rate);
      const long dry_lag = best_lag(dry, rate);
      std::printf("       latency %u frames; dry at %ld, cleaned at %ld "
                  "(%+.2f ms); %u of %zu blocks late\n",
                  cleaned.latency, dry_lag, lag,
                  1000.0 * (static_cast<double>(lag) - cleaned.latency) / rate,
                  cleaned.late, cleaned.input.size() / static_cast<size_t>(std::lround(rate * 0.01)));
      check(dry_lag == static_cast<long>(dry.latency),
            "control: the dry path is found at the reported latency");
      check(std::labs(lag - static_cast<long>(cleaned.latency)) <= 1,
            "the cleaned voice lands on the dry path, within a frame");
      // Every block late plays the dry path at the last gain, which the lag
      // above cannot tell from a cleaned voice: low lag away from 48 kHz was
      // 299 late of 299 and measured as perfectly aligned. The same build run
      // twice on a busy machine went from 11 to 58 late in low lag at 48 kHz,
      // scheduling and nothing else, so the line is half: the fault is all.
      check(cleaned.late * 2 < cleaned.input.size() / std::lround(rate * 0.01),
            "the cleaner keeps up: most blocks are cleaned on time");
    }
  }
  return feq_test::finish();
}
