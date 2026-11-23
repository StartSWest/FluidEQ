/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A rack edit in the middle of speech, with the voice cleaner running, leaves
 * no gap and no step — at all eight shared-mode rates, beside the control of
 * the same edit with the cleaner restarted cold, which is what every switch
 * on a mic's tab used to do.
 *
 * It needs the real model, its runtime and a speech recording, none of which
 * belong in the tree:
 *   FLUIDEQ_TEST_VOICE_MODEL   the voice model (.onnx)
 *   FLUIDEQ_TEST_ONNXRUNTIME   onnxruntime.dll
 *   FLUIDEQ_TEST_SPEECH        a 16-bit mono 48 kHz WAV of speech
 * Without them it says so and passes, as the sidecar-driven tests do.
 *
 * Real time, because the cleaner's worker runs beside the audio thread and a
 * block it has not delivered is the very thing measured: the blocks come one
 * device period apart on a waitable timer standing in for the device clock.
 */

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <windows.h>
#endif

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iterator>
#include <string>
#include <thread>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/chain.h"

namespace {

using feq_test::check;

std::string model;
std::string runtime;
const char* model_path = nullptr;
const char* runtime_path = nullptr;

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

FeqChainSettings mic(double low_cut) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.low_latency = 1;
  settings.denoise.enabled = 1;
  settings.denoise.hiss.enabled = 0;
  settings.denoise.click.enabled = 0;
  settings.denoise.voice.enabled = 1;
  settings.denoise.voice.amount = 0.55;
  settings.voice.enabled = 1;
  settings.voice.low_cut_hz = low_cut;
  return settings;
}

/** Built and primed the way the engine publishes a chain. */
FeqChain* build(double rate, uint32_t block, double low_cut) {
  FeqChain* chain = feq_chain_create(rate, 1, block);
  if (chain == nullptr) return nullptr;
  const FeqChainSettings settings = mic(low_cut);
  feq_chain_configure(chain, &settings);
  std::vector<float> silence(block, 0.0f);
  float* planes[1] = {silence.data()};
  feq_chain_process(chain, planes, block);
  feq_chain_reset(chain, FEQ_CHAIN_RESET_STREAM_START);
  if (feq_chain_load_voice_model(chain, model_path, runtime_path) == 0) {
    feq_chain_destroy(chain);
    return nullptr;
  }
  return chain;
}

struct Run {
  size_t cuts = 0;
  size_t steps = 0;
  size_t carried = 0;
  bool built = true;
};

/**
 * Four seconds of speech over a room, an edit every 400 ms; `carry` hands the
 * playing chain's state over, otherwise the new chain starts as built.
 */
Run edit_while_speaking(double rate, const std::vector<float>& speech, bool carry) {
  Run result;
  const uint32_t block = static_cast<uint32_t>(std::lround(rate * 0.01));
  std::vector<float> clean = at_rate(speech, rate, 4.0);
  std::vector<float> input(clean.size());
  uint32_t seed = 99;
  for (size_t i = 0; i < clean.size(); ++i) {
    seed = seed * 1664525u + 1013904223u;
    input[i] = static_cast<float>(
        clean[i] + (static_cast<double>(seed >> 8) / 8388608.0 - 1.0) * 0.003);
  }
  FeqChain* chain = build(rate, block, 80.0);
  if (chain == nullptr) {
    result.built = false;
    return result;
  }
  const uint32_t latency = feq_chain_latency_frames(chain);
  std::atomic<FeqChain*> ready{nullptr};
  std::atomic<bool> want{false};
  std::atomic<bool> done{false};
  std::vector<FeqChain*> retired;
  std::thread builder([&] {
    bool flip = false;
    while (!done.load()) {
      if (want.exchange(false)) {
        flip = !flip;
        ready.store(build(rate, block, flip ? 90.0 : 80.0));
      }
      std::this_thread::yield();
    }
  });
#if defined(_WIN32)
  HANDLE timer = CreateWaitableTimerExW(nullptr, nullptr,
                                        CREATE_WAITABLE_TIMER_HIGH_RESOLUTION,
                                        TIMER_ALL_ACCESS);
  LARGE_INTEGER frequency{};
  LARGE_INTEGER start{};
  QueryPerformanceFrequency(&frequency);
  QueryPerformanceCounter(&start);
#endif
  const size_t blocks = input.size() / block;
  const size_t every = 40;
  std::vector<float> output(input.size(), 0.0f);
  std::vector<float> buffer(block);
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
    if (b % every == every / 2) want.store(true);
    FeqChain* next = ready.exchange(nullptr);
    if (next != nullptr) {
      if (carry && feq_chain_carries_restoration(next, chain) != 0 &&
          feq_chain_transfer_state(next, chain) != 0) {
        ++result.carried;
      }
      retired.push_back(chain);
      chain = next;
    }
    std::memcpy(buffer.data(), &input[b * block], block * sizeof(float));
    float* planes[1] = {buffer.data()};
    feq_chain_process(chain, planes, block);
    feq_chain_wake_workers(chain);
    std::memcpy(&output[b * block], buffer.data(), block * sizeof(float));
  }
  done.store(true);
  builder.join();
  FeqChain* leftover = ready.exchange(nullptr);
  if (leftover != nullptr) retired.push_back(leftover);
  for (FeqChain* old : retired) feq_chain_destroy(old);
  feq_chain_destroy(chain);
#if defined(_WIN32)
  CloseHandle(timer);
#endif

  // A cut: more than 5 ms with the output 20 dB under the input while the
  // voice is present. Millisecond windows, aligned by the chain's delay.
  const size_t window = std::max<size_t>(1, static_cast<size_t>(rate / 1000.0));
  size_t run = 0;
  for (size_t w = (latency + window * 100) / window; (w + 1) * window <= output.size(); ++w) {
    double in = 0.0, out = 0.0, voice = 0.0;
    for (size_t i = w * window; i < (w + 1) * window; ++i) {
      const size_t from = i - latency;
      in += static_cast<double>(input[from]) * input[from];
      voice += static_cast<double>(clean[from]) * clean[from];
      out += static_cast<double>(output[i]) * output[i];
    }
    const double scale = 1.0 / static_cast<double>(window);
    const bool voiced = 10.0 * std::log10(voice * scale + 1e-20) > -45.0;
    const bool dropped = voiced && out < in * 0.01;
    if (dropped) {
      ++run;
    } else {
      if (run > 5) ++result.cuts;
      run = 0;
    }
  }
  // A step: a jump over four times the largest the output takes within a
  // millisecond either side of it.
  for (size_t i = latency + 2 * window; i + 2 * window < output.size(); ++i) {
    const double jump = std::fabs(static_cast<double>(output[i]) - output[i - 1]);
    if (jump < 0.01) continue;
    double local = 1e-6;
    for (size_t k = i - window; k <= i + window; ++k) {
      if (k + 1 >= i && k <= i + 1) continue;
      local = std::max(local, std::fabs(static_cast<double>(output[k]) - output[k - 1]));
    }
    if (jump > 4.0 * local) ++result.steps;
  }
  return result;
}

}  // namespace

int main() {
  model = env("FLUIDEQ_TEST_VOICE_MODEL");
  runtime = env("FLUIDEQ_TEST_ONNXRUNTIME");
  const std::string speech_path = env("FLUIDEQ_TEST_SPEECH");
  model_path = model.c_str();
  runtime_path = runtime.c_str();
  if (model.empty() || runtime.empty() || speech_path.empty()) {
    std::printf("voice handover: skipped, set FLUIDEQ_TEST_VOICE_MODEL, "
                "FLUIDEQ_TEST_ONNXRUNTIME and FLUIDEQ_TEST_SPEECH to run it\n");
    return 0;
  }
  std::vector<float> speech = read_wav(speech_path.c_str());
  float peak = 0.0f;
  for (const float sample : speech) peak = std::max(peak, std::fabs(sample));
  if (peak > 0.0f) {
    for (float& sample : speech) sample *= 0.5f / peak;
  }
  check(speech.size() > 48000 * 4, "the speech recording holds four seconds");
  for (const double rate : {44100.0, 48000.0, 88200.0, 96000.0, 176400.0,
                            192000.0, 352800.0, 384000.0}) {
    std::printf("rate %.1f kHz\n", rate / 1000.0);
    const Run carried = edit_while_speaking(rate, speech, true);
    const Run cold = edit_while_speaking(rate, speech, false);
    check(carried.built && cold.built, "the model loads at this rate");
    check(carried.carried >= 8, "every edit carried the playing cleaner over");
    check(carried.cuts == 0, "an edit mid-speech leaves no gap");
    check(carried.steps == 0, "an edit mid-speech leaves no step");
    check(cold.cuts > 0, "control: the cleaner restarted cold leaves gaps");
  }
  return feq_test::finish();
}
