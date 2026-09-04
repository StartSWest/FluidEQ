/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The neural module: DPDFNet, behind a worker thread.
 *
 * The runtime is loaded at RUNTIME rather than linked, and that is the whole
 * shape of this file. `onnxruntime.dll` already ships with the app for karaoke
 * separation, so the host asks the operating system for it by path and reaches
 * the C API through `OrtGetApiBase`. Nothing is added to the build, the audio
 * host still links against nothing new, and a missing runtime is an ordinary
 * answer — the module reports itself unavailable and audio passes untouched —
 * rather than a host that will not start.
 *
 * The model is the SPECTRAL stage only: it takes one frame of complex spectrum
 * plus an explicit RNN state and returns both. The transform either side of it
 * is ours, and it is not the same transform the hiss module uses — 960-sample
 * Vorbis window at 50% overlap, which is what the network was trained against.
 * A Hann window here would be a different front end from the one the weights
 * were fitted to.
 *
 * Because the state is an explicit tensor rather than session-internal, ONE
 * session serves both channels: each carries its own state buffer. Two
 * sessions would double the memory for nothing.
 *
 * The contract with the audio thread never changes: inference happens on the
 * worker, the callback only reads a ring, and a frame that is not ready in
 * time passes DRY and counts an underrun. It never stalls and never emits a
 * partial block — half a block of audio followed by whatever was in the buffer
 * is worse than a dropout, because it sounds like the material.
 */

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <cstring>
#include <new>
#include <string>
#include <thread>
#include <vector>

#include "denoise_internal.h"
#include "fluideq/convolver.h"
#include "fluideq/resampler.h"

#if defined(_WIN32)
#define WIN32_LEAN_AND_MEAN
// windows.h defines `min` and `max` as macros, which turns every `std::min`
// below into a syntax error rather than into anything a reader would suspect.
#define NOMINMAX
#include <windows.h>
#else
#include <dlfcn.h>
#endif

#include "onnxruntime_c_api.h"

namespace {

constexpr uint32_t kVoiceWindow = 960;
constexpr uint32_t kVoiceHop = 480;
constexpr uint32_t kVoiceBins = kVoiceWindow / 2 + 1;
constexpr double kPi = 3.14159265358979323846;

/** The rate the 48 kHz model was trained at; anything else must resample. */
constexpr double kVoiceRate = 48000.0;

uint32_t device_frames_for(double device_rate, uint32_t model_frames) {
  return static_cast<uint32_t>(std::llround(static_cast<double>(model_frames) *
                                            device_rate / kVoiceRate));
}

/** One overlap-add hop, plus the worker's four-hop scheduling headroom. */
uint32_t voice_latency_for(double device_rate) {
  return device_frames_for(device_rate, kVoiceHop) +
         device_frames_for(device_rate, kVoiceHop * kDenoiseVoiceLatencyFrames);
}

/**
 * A single-producer, single-consumer float ring.
 *
 * The audio thread owns one end of each and the worker the other, so a plain
 * pair of atomic indices is the whole synchronisation. No lock is taken on
 * either side, which is the property the callback needs.
 */
struct VoiceRing {
  std::vector<float> data;
  std::atomic<uint32_t> read{0};
  std::atomic<uint32_t> write{0};

  void reset(uint32_t capacity) {
    data.assign(capacity, 0.0f);
    read.store(0, std::memory_order_relaxed);
    write.store(0, std::memory_order_relaxed);
  }

  uint32_t available() const {
    const uint32_t w = write.load(std::memory_order_acquire);
    const uint32_t r = read.load(std::memory_order_relaxed);
    return w - r;
  }

  uint32_t space() const {
    return static_cast<uint32_t>(data.size()) - available();
  }

  void push(const float* from, uint32_t count) {
    const uint32_t capacity = static_cast<uint32_t>(data.size());
    uint32_t w = write.load(std::memory_order_relaxed);
    for (uint32_t i = 0; i < count; i += 1) {
      data[(w + i) % capacity] = from[i];
    }
    write.store(w + count, std::memory_order_release);
  }

  void pop(float* into, uint32_t count) {
    const uint32_t capacity = static_cast<uint32_t>(data.size());
    uint32_t r = read.load(std::memory_order_relaxed);
    for (uint32_t i = 0; i < count; i += 1) {
      into[i] = data[(r + i) % capacity];
    }
    read.store(r + count, std::memory_order_release);
  }

  void peek(float* into, uint32_t count) const {
    const uint32_t capacity = static_cast<uint32_t>(data.size());
    const uint32_t r = read.load(std::memory_order_relaxed);
    for (uint32_t i = 0; i < count; i += 1) {
      into[i] = data[(r + i) % capacity];
    }
  }

  void discard(uint32_t count) {
    const uint32_t r = read.load(std::memory_order_relaxed);
    read.store(r + count, std::memory_order_release);
  }
};

/**
 * The window the network was trained with, and it is not Hann.
 *
 * The Vorbis (Princen-Bradley) window: sin(pi/2 * sin^2(pi (n+0.5) / N)). Its
 * square sums to exactly one at half-window hop, so analysis and synthesis
 * windowing reconstruct an unmodified signal at unity with no correction term.
 */
double vorbis_window(uint32_t index, uint32_t length) {
  const double phase =
      kPi * (static_cast<double>(index) + 0.5) / static_cast<double>(length);
  const double inner = std::sin(phase);
  return std::sin(0.5 * kPi * inner * inner);
}

/** One channel's overlap-add state around the model. */
struct VoiceChannel {
  std::vector<float> analysis;
  std::vector<float> synthesis;
  std::vector<float> state;
  uint32_t fill = 0;
};

struct VoiceRuntime {
#if defined(_WIN32)
  HMODULE library = nullptr;
#else
  void* library = nullptr;
#endif
  const OrtApi* api = nullptr;
  OrtEnv* env = nullptr;
  OrtSession* session = nullptr;
  OrtSessionOptions* options = nullptr;
  OrtMemoryInfo* memory = nullptr;

  std::vector<double> window;
  std::vector<VoiceChannel> channels;
  std::vector<float> initial_state;
  /** The 960-point transform. Built at load, used only by the worker. */
  FeqDft* transform = nullptr;

  /**
   * One pair of rings per channel, as fixed arrays rather than vectors.
   *
   * A ring holds atomics, so it is neither copyable nor movable and a vector
   * of them cannot be resized at all. The module is stereo at most, so the
   * ceiling is the honest shape here anyway.
   */
  VoiceRing input[FEQ_DENOISE_CHANNELS];
  VoiceRing output[FEQ_DENOISE_CHANNELS];
  /** Worker-only rings on the model's fixed 48 kHz timeline. */
  VoiceRing model_input[FEQ_DENOISE_CHANNELS];
  VoiceRing model_output[FEQ_DENOISE_CHANNELS];
  FeqResampler* to_model = nullptr;
  FeqResampler* from_model = nullptr;
  std::vector<float> worker_device_input[FEQ_DENOISE_CHANNELS];
  std::vector<float> worker_model_input[FEQ_DENOISE_CHANNELS];
  std::vector<float> worker_model_output[FEQ_DENOISE_CHANNELS];
  std::vector<float> worker_device_output[FEQ_DENOISE_CHANNELS];
  std::vector<float> dry_delay[FEQ_DENOISE_CHANNELS];
  std::vector<float> scratch;
  uint32_t dry_cursor = 0;
  uint64_t output_debt = 0;
  uint32_t max_frames = 0;
  uint32_t voice_latency = 0;
  double device_rate = kVoiceRate;

  std::thread worker;
  std::atomic<bool> running{false};
  std::atomic<uint32_t> underruns{0};
  uint32_t channel_count = 2;
};

void* load_symbol(VoiceRuntime& runtime, const char* name) {
#if defined(_WIN32)
  return reinterpret_cast<void*>(GetProcAddress(runtime.library, name));
#else
  return dlsym(runtime.library, name);
#endif
}

void close_library(VoiceRuntime& runtime) {
  if (runtime.library == nullptr) {
    return;
  }
#if defined(_WIN32)
  FreeLibrary(runtime.library);
#else
  dlclose(runtime.library);
#endif
  runtime.library = nullptr;
}

/**
 * The state the network starts a stream from, read out of the model itself.
 *
 * Not zeros. The first two spans of the state vector are running normalisation
 * estimates, and the export embeds the values they must begin at; starting
 * them at zero makes the first seconds of every track come out wrong while the
 * estimates climb. Reading them from the model rather than baking them in
 * means a re-exported model brings its own.
 */
bool read_initial_state(VoiceRuntime& runtime) {
  const OrtApi* api = runtime.api;
  OrtModelMetadata* metadata = nullptr;
  if (api->SessionGetModelMetadata(runtime.session, &metadata) != nullptr) {
    return false;
  }
  OrtAllocator* allocator = nullptr;
  if (api->GetAllocatorWithDefaultOptions(&allocator) != nullptr) {
    api->ReleaseModelMetadata(metadata);
    return false;
  }

  auto lookup = [&](const char* key, std::string& out) -> bool {
    char* value = nullptr;
    if (api->ModelMetadataLookupCustomMetadataMap(metadata, allocator, key,
                                                  &value) != nullptr ||
        value == nullptr) {
      return false;
    }
    out.assign(value);
    api->AllocatorFree(allocator, value);
    return true;
  };

  std::string size_text;
  std::string erb_size_text;
  std::string spec_size_text;
  std::string erb_init;
  std::string spec_init;
  const bool complete = lookup("state_size", size_text) &&
                        lookup("erb_norm_state_size", erb_size_text) &&
                        lookup("spec_norm_state_size", spec_size_text) &&
                        lookup("erb_norm_init", erb_init) &&
                        lookup("spec_norm_init", spec_init);
  api->ReleaseModelMetadata(metadata);
  if (!complete) {
    return false;
  }

  const size_t total = static_cast<size_t>(std::stol(size_text));
  const size_t erb = static_cast<size_t>(std::stol(erb_size_text));
  const size_t spec = static_cast<size_t>(std::stol(spec_size_text));
  if (total == 0 || erb + spec > total) {
    return false;
  }

  runtime.initial_state.assign(total, 0.0f);
  auto fill = [&](const std::string& csv, size_t at, size_t limit) {
    size_t index = 0;
    size_t from = 0;
    while (from <= csv.size() && index < limit) {
      const size_t comma = csv.find(',', from);
      const std::string piece = csv.substr(
          from, comma == std::string::npos ? std::string::npos : comma - from);
      if (!piece.empty()) {
        runtime.initial_state[at + index] = std::stof(piece);
        index += 1;
      }
      if (comma == std::string::npos) {
        break;
      }
      from = comma + 1;
    }
  };
  fill(erb_init, 0, erb);
  fill(spec_init, erb, spec);
  return true;
}

/** One 480-sample hop for one channel, through the transform and the model. */
void process_hop(VoiceRuntime& runtime, VoiceChannel& channel) {
  const OrtApi* api = runtime.api;
  std::vector<double> real(kVoiceWindow, 0.0);
  std::vector<double> imaginary(kVoiceWindow, 0.0);
  for (uint32_t i = 0; i < kVoiceWindow; i += 1) {
    real[i] = static_cast<double>(channel.analysis[i]) * runtime.window[i];
  }
  feq_dft_in_place(runtime.transform, real.data(), imaginary.data(), 0);

  std::vector<float> spectrum(kVoiceBins * 2, 0.0f);
  for (uint32_t bin = 0; bin < kVoiceBins; bin += 1) {
    spectrum[bin * 2] = static_cast<float>(real[bin]);
    spectrum[bin * 2 + 1] = static_cast<float>(imaginary[bin]);
  }

  const int64_t spec_shape[4] = {1, 1, static_cast<int64_t>(kVoiceBins), 2};
  const int64_t state_shape[1] = {static_cast<int64_t>(channel.state.size())};
  OrtValue* spec_value = nullptr;
  OrtValue* state_value = nullptr;
  if (api->CreateTensorWithDataAsOrtValue(
          runtime.memory, spectrum.data(), spectrum.size() * sizeof(float),
          spec_shape, 4, ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT,
          &spec_value) != nullptr) {
    return;
  }
  if (api->CreateTensorWithDataAsOrtValue(
          runtime.memory, channel.state.data(),
          channel.state.size() * sizeof(float), state_shape, 1,
          ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT, &state_value) != nullptr) {
    api->ReleaseValue(spec_value);
    return;
  }

  const char* input_names[2] = {"spec", "state_in"};
  const char* output_names[2] = {"spec_e", "state_out"};
  const OrtValue* inputs[2] = {spec_value, state_value};
  OrtValue* outputs[2] = {nullptr, nullptr};
  const bool ran = api->Run(runtime.session, nullptr, input_names, inputs, 2,
                            output_names, 2, outputs) == nullptr;
  api->ReleaseValue(spec_value);
  api->ReleaseValue(state_value);
  if (!ran) {
    return;
  }

  float* enhanced = nullptr;
  float* next_state = nullptr;
  if (api->GetTensorMutableData(
          outputs[0], reinterpret_cast<void**>(&enhanced)) == nullptr &&
      api->GetTensorMutableData(
          outputs[1], reinterpret_cast<void**>(&next_state)) == nullptr) {
    for (uint32_t bin = 0; bin < kVoiceBins; bin += 1) {
      real[bin] = enhanced[bin * 2];
      imaginary[bin] = enhanced[bin * 2 + 1];
      // Hermitian mirror, so the inverse transform comes back real.
      if (bin > 0 && bin < kVoiceWindow / 2) {
        real[kVoiceWindow - bin] = enhanced[bin * 2];
        imaginary[kVoiceWindow - bin] = -enhanced[bin * 2 + 1];
      }
    }
    std::memcpy(channel.state.data(), next_state,
                channel.state.size() * sizeof(float));
  }
  api->ReleaseValue(outputs[0]);
  api->ReleaseValue(outputs[1]);

  feq_dft_in_place(runtime.transform, real.data(), imaginary.data(), 1);

  const double scale = 1.0 / static_cast<double>(kVoiceWindow);
  for (uint32_t i = 0; i < kVoiceWindow - kVoiceHop; i += 1) {
    channel.synthesis[i] = channel.synthesis[i + kVoiceHop];
  }
  for (uint32_t i = kVoiceWindow - kVoiceHop; i < kVoiceWindow; i += 1) {
    channel.synthesis[i] = 0.0f;
  }
  for (uint32_t i = 0; i < kVoiceWindow; i += 1) {
    channel.synthesis[i] +=
        static_cast<float>(real[i] * scale * runtime.window[i]);
  }
  for (uint32_t i = 0; i < kVoiceWindow - kVoiceHop; i += 1) {
    channel.analysis[i] = channel.analysis[i + kVoiceHop];
  }
}

bool resample_input(VoiceRuntime& runtime) {
  uint32_t available = UINT32_MAX;
  uint32_t space = UINT32_MAX;
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    available = std::min(available, runtime.input[c].available());
    space = std::min(space, runtime.model_input[c].space());
  }
  if (available == 0 || space == 0) {
    return false;
  }

  const uint32_t input_frames = std::min(
      available, static_cast<uint32_t>(runtime.worker_device_input[0].size()));
  const uint32_t output_frames = std::min(
      space, static_cast<uint32_t>(runtime.worker_model_input[0].size()));
  const float* input[FEQ_DENOISE_CHANNELS] = {};
  float* output[FEQ_DENOISE_CHANNELS] = {};
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.input[c].peek(runtime.worker_device_input[c].data(), input_frames);
    input[c] = runtime.worker_device_input[c].data();
    output[c] = runtime.worker_model_input[c].data();
  }
  uint32_t consumed = 0;
  const uint32_t produced = feq_resample(runtime.to_model, input, input_frames,
                                         output, output_frames, &consumed);
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.input[c].discard(consumed);
    if (produced > 0) {
      runtime.model_input[c].push(output[c], produced);
    }
  }
  return consumed > 0 || produced > 0;
}

bool process_model_hop(VoiceRuntime& runtime) {
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    if (runtime.model_input[c].available() < kVoiceHop ||
        runtime.model_output[c].space() < kVoiceHop) {
      return false;
    }
  }
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.model_input[c].pop(runtime.worker_model_input[c].data(), kVoiceHop);
    VoiceChannel& channel = runtime.channels[c];
    std::memcpy(&channel.analysis[kVoiceWindow - kVoiceHop],
                runtime.worker_model_input[c].data(),
                kVoiceHop * sizeof(float));
    process_hop(runtime, channel);
    runtime.model_output[c].push(channel.synthesis.data(), kVoiceHop);
  }
  return true;
}

bool resample_output(VoiceRuntime& runtime) {
  uint32_t available = UINT32_MAX;
  uint32_t space = UINT32_MAX;
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    available = std::min(available, runtime.model_output[c].available());
    space = std::min(space, runtime.output[c].space());
  }
  if (available == 0 || space == 0) {
    return false;
  }

  const uint32_t input_frames = std::min(
      available, static_cast<uint32_t>(runtime.worker_model_output[0].size()));
  const uint32_t output_frames = std::min(
      space, static_cast<uint32_t>(runtime.worker_device_output[0].size()));
  const float* input[FEQ_DENOISE_CHANNELS] = {};
  float* output[FEQ_DENOISE_CHANNELS] = {};
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.model_output[c].peek(runtime.worker_model_output[c].data(),
                                 input_frames);
    input[c] = runtime.worker_model_output[c].data();
    output[c] = runtime.worker_device_output[c].data();
  }
  uint32_t consumed = 0;
  const uint32_t produced =
      feq_resample(runtime.from_model, input, input_frames, output,
                   output_frames, &consumed);
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.model_output[c].discard(consumed);
    if (produced > 0) {
      runtime.output[c].push(output[c], produced);
    }
  }
  return consumed > 0 || produced > 0;
}

/** The worker converts to 48 kHz, runs the model, then converts back. */
void worker_loop(VoiceRuntime* runtime) {
  while (runtime->running.load(std::memory_order_acquire)) {
    bool worked = resample_input(*runtime);
    while (process_model_hop(*runtime)) {
      worked = true;
    }
    while (resample_output(*runtime)) {
      worked = true;
    }
    if (!worked) {
      // Nothing ready. Yielding rather than spinning: the callback refills
      // every few milliseconds and a busy loop would take a core from it.
      std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
  }
}

/** Prepare a runtime that is not yet visible to the audio callback. */
void reset_runtime(VoiceRuntime& runtime) {
  const uint32_t model_capacity = kVoiceHop * 128 + kVoiceWindow;
  const uint32_t device_capacity =
      device_frames_for(runtime.device_rate, kVoiceHop * 128) +
      runtime.max_frames + FEQ_RESAMPLER_TAPS;
  const uint32_t model_chunk = kVoiceHop * 8 + FEQ_RESAMPLER_TAPS;
  const uint32_t device_chunk =
      std::max(runtime.max_frames,
               device_frames_for(runtime.device_rate, kVoiceHop * 8) +
                   FEQ_RESAMPLER_TAPS);
  const uint32_t dry_capacity = runtime.voice_latency + runtime.max_frames;
  feq_resampler_reset(runtime.to_model);
  feq_resampler_reset(runtime.from_model);
  for (uint32_t c = 0; c < runtime.channel_count; c += 1) {
    runtime.input[c].reset(device_capacity);
    runtime.output[c].reset(device_capacity);
    runtime.model_input[c].reset(model_capacity);
    runtime.model_output[c].reset(model_capacity);
    runtime.worker_device_input[c].assign(device_chunk, 0.0f);
    runtime.worker_model_input[c].assign(model_chunk, 0.0f);
    runtime.worker_model_output[c].assign(model_chunk, 0.0f);
    runtime.worker_device_output[c].assign(device_chunk, 0.0f);
    runtime.dry_delay[c].assign(dry_capacity, 0.0f);

    /*
     * Four finished hops are scheduling headroom. The overlap-add front end
     * contributes one more hop: the first input hop enters the right half of
     * the window and is emitted after the next hop. The dry path carries both
     * terms so partial Amount stays phase-coherent with the cleaned output.
     */
    float silence[64] = {0.0f};
    uint32_t remaining = device_frames_for(
        runtime.device_rate, kVoiceHop * kDenoiseVoiceLatencyFrames);
    while (remaining > 0) {
      const uint32_t block = remaining < 64 ? remaining : 64;
      runtime.output[c].push(silence, block);
      remaining -= block;
    }

    VoiceChannel& channel = runtime.channels[c];
    std::fill(channel.analysis.begin(), channel.analysis.end(), 0.0f);
    std::fill(channel.synthesis.begin(), channel.synthesis.end(), 0.0f);
    channel.state = runtime.initial_state;
  }
  runtime.scratch.assign(runtime.max_frames, 0.0f);
  runtime.dry_cursor = 0;
  runtime.output_debt = 0;
}

void destroy_runtime(VoiceRuntime* runtime) {
  if (runtime == nullptr) {
    return;
  }
  runtime->running.store(false, std::memory_order_release);
  if (runtime->worker.joinable()) {
    runtime->worker.join();
  }
  feq_resampler_destroy(runtime->to_model);
  runtime->to_model = nullptr;
  feq_resampler_destroy(runtime->from_model);
  runtime->from_model = nullptr;
  feq_dft_destroy(runtime->transform);
  runtime->transform = nullptr;
  const OrtApi* api = runtime->api;
  if (api != nullptr) {
    if (runtime->memory != nullptr) {
      api->ReleaseMemoryInfo(runtime->memory);
    }
    if (runtime->session != nullptr) {
      api->ReleaseSession(runtime->session);
    }
    if (runtime->options != nullptr) {
      api->ReleaseSessionOptions(runtime->options);
    }
    if (runtime->env != nullptr) {
      api->ReleaseEnv(runtime->env);
    }
  }
  close_library(*runtime);
  delete runtime;
}

/** Retire only after the callback has left the runtime it acquired. */
void retire_runtime(FeqDenoise* denoise, VoiceRuntime* runtime) {
  if (runtime == nullptr) {
    return;
  }
  while (denoise->voice_readers.load(std::memory_order_acquire) != 0) {
    std::this_thread::yield();
  }
  destroy_runtime(runtime);
}

}  // namespace

void denoise_voice_configure(FeqDenoise* denoise) { (void)denoise; }

void denoise_voice_reset(FeqDenoise* denoise) {
  if (denoise->voice_model_path.empty() ||
      denoise->voice_runtime_path.empty()) {
    return;
  }
  // Build and publish a clean replacement. Mutating the live worker's rings
  // here races both the callback and the inference thread on a seek.
  const std::string model_path = denoise->voice_model_path;
  const std::string runtime_path = denoise->voice_runtime_path;
  denoise_voice_load_model(denoise, model_path.c_str(), runtime_path.c_str());
}

uint32_t denoise_voice_process(FeqDenoise* denoise, float* const* channels,
                               uint32_t frames) {
  denoise->voice_readers.fetch_add(1, std::memory_order_acq_rel);
  auto* runtime = static_cast<VoiceRuntime*>(
      denoise->voice.load(std::memory_order_acquire));
  if (runtime == nullptr) {
    denoise->voice_readers.fetch_sub(1, std::memory_order_release);
    return 0;
  }

  const bool enabled = denoise->settings.voice.enabled != 0;
  const double amount =
      std::min(1.0, std::max(0.0, denoise->settings.voice.amount));
  uint32_t underruns = 0;
  bool can_push = true;
  for (uint32_t c = 0; c < denoise->channels && c < runtime->channel_count;
       c += 1) {
    can_push = can_push && runtime->input[c].space() >= frames;
  }

  /* Ingress is all-or-none so stereo can never move by different blocks. */
  for (uint32_t c = 0;
       can_push && c < denoise->channels && c < runtime->channel_count;
       c += 1) {
    runtime->input[c].push(channels[c], frames);
  }

  const uint32_t dry_ring =
      runtime->dry_delay[0].empty()
          ? 0
          : static_cast<uint32_t>(runtime->dry_delay[0].size());
  for (uint32_t c = 0; c < denoise->channels && c < runtime->channel_count;
       c += 1) {
    float* line = runtime->dry_delay[c].data();
    for (uint32_t i = 0; i < frames; i += 1) {
      line[(runtime->dry_cursor + i) % dry_ring] = channels[c][i];
    }
  }

  /*
   * Output that missed its block is never allowed to masquerade as the next
   * block. Drop that debt once it arrives, then resume on the common timeline.
   */
  uint32_t available = UINT32_MAX;
  for (uint32_t c = 0; c < denoise->channels && c < runtime->channel_count;
       c += 1) {
    available = std::min(available, runtime->output[c].available());
  }
  const uint32_t discard = static_cast<uint32_t>(std::min<uint64_t>(
      runtime->output_debt, static_cast<uint64_t>(available)));
  if (discard > 0) {
    for (uint32_t c = 0; c < denoise->channels && c < runtime->channel_count;
         c += 1) {
      runtime->output[c].discard(discard);
    }
    runtime->output_debt -= discard;
    available -= discard;
  }

  const bool output_ready =
      can_push && runtime->output_debt == 0 && available >= frames;

  for (uint32_t c = 0; c < denoise->channels && c < runtime->channel_count;
       c += 1) {
    float* buffer = channels[c];
    const float* line = runtime->dry_delay[c].data();
    if (output_ready) {
      runtime->output[c].pop(runtime->scratch.data(), frames);
      if (enabled) {
        for (uint32_t i = 0; i < frames; i += 1) {
          const uint32_t at =
              (runtime->dry_cursor + i + dry_ring - runtime->voice_latency) %
              dry_ring;
          buffer[i] = static_cast<float>(line[at] * (1.0 - amount) +
                                         runtime->scratch[i] * amount);
        }
      }
    } else if (enabled) {
      for (uint32_t i = 0; i < frames; i += 1) {
        const uint32_t at =
            (runtime->dry_cursor + i + dry_ring - runtime->voice_latency) %
            dry_ring;
        buffer[i] = line[at];
      }
    }
  }

  if (!output_ready) {
    runtime->output_debt += frames;
    if (enabled) {
      underruns = 1;
    }
  }
  runtime->dry_cursor = (runtime->dry_cursor + frames) % dry_ring;
  denoise->voice_readers.fetch_sub(1, std::memory_order_release);
  return underruns;
}

int denoise_voice_load_model(FeqDenoise* denoise, const char* model_path,
                             const char* runtime_path) {
  if (model_path == nullptr || runtime_path == nullptr) {
    return 0;
  }

  auto* runtime = new (std::nothrow) VoiceRuntime();
  if (runtime == nullptr) {
    return 0;
  }

#if defined(_WIN32)
  runtime->library = LoadLibraryA(runtime_path);
#else
  runtime->library = dlopen(runtime_path, RTLD_NOW | RTLD_LOCAL);
#endif
  if (runtime->library == nullptr) {
    delete runtime;
    return 0;
  }

  using GetApiBase = const OrtApiBase*(ORT_API_CALL*)();
  auto base =
      reinterpret_cast<GetApiBase>(load_symbol(*runtime, "OrtGetApiBase"));
  if (base == nullptr) {
    close_library(*runtime);
    delete runtime;
    return 0;
  }
  runtime->api = base()->GetApi(ORT_API_VERSION);
  if (runtime->api == nullptr) {
    close_library(*runtime);
    delete runtime;
    return 0;
  }

  const OrtApi* api = runtime->api;
  bool ok = api->CreateEnv(ORT_LOGGING_LEVEL_ERROR, "fluideq", &runtime->env) ==
            nullptr;
  ok = ok && api->CreateSessionOptions(&runtime->options) == nullptr;
  if (ok) {
    // One thread each. The worker is already off the audio thread and ORT
    // spawning its own pool would put unpredictable scheduling next to a
    // real-time callback for no throughput this needs.
    api->SetIntraOpNumThreads(runtime->options, 1);
    api->SetInterOpNumThreads(runtime->options, 1);
  }
#if defined(_WIN32)
  std::wstring wide;
  if (ok) {
    const int needed =
        MultiByteToWideChar(CP_UTF8, 0, model_path, -1, nullptr, 0);
    wide.resize(needed > 0 ? static_cast<size_t>(needed) : 0);
    MultiByteToWideChar(CP_UTF8, 0, model_path, -1, wide.data(), needed);
    ok = api->CreateSession(runtime->env, wide.c_str(), runtime->options,
                            &runtime->session) == nullptr;
  }
#else
  ok = ok && api->CreateSession(runtime->env, model_path, runtime->options,
                                &runtime->session) == nullptr;
#endif
  ok = ok && api->CreateCpuMemoryInfo(OrtArenaAllocator, OrtMemTypeDefault,
                                      &runtime->memory) == nullptr;
  ok = ok && read_initial_state(*runtime);

  if (!ok) {
    destroy_runtime(runtime);
    return 0;
  }

  runtime->channel_count = denoise->channels;
  runtime->max_frames = denoise->max_frames;
  runtime->device_rate = denoise->sample_rate;
  runtime->voice_latency = voice_latency_for(runtime->device_rate);
  runtime->to_model = feq_resampler_create(runtime->device_rate, kVoiceRate,
                                           runtime->channel_count);
  runtime->from_model = feq_resampler_create(kVoiceRate, runtime->device_rate,
                                             runtime->channel_count);
  if (runtime->to_model == nullptr || runtime->from_model == nullptr) {
    destroy_runtime(runtime);
    return 0;
  }
  runtime->transform = feq_dft_create(kVoiceWindow);
  if (runtime->transform == nullptr) {
    destroy_runtime(runtime);
    return 0;
  }
  runtime->window.resize(kVoiceWindow);
  for (uint32_t i = 0; i < kVoiceWindow; i += 1) {
    runtime->window[i] = vorbis_window(i, kVoiceWindow);
  }
  runtime->channels.resize(runtime->channel_count);
  for (auto& channel : runtime->channels) {
    channel.analysis.assign(kVoiceWindow, 0.0f);
    channel.synthesis.assign(kVoiceWindow, 0.0f);
    channel.state = runtime->initial_state;
  }

  reset_runtime(*runtime);

  runtime->running.store(true, std::memory_order_release);
  try {
    runtime->worker = std::thread(worker_loop, runtime);
  } catch (...) {
    runtime->running.store(false, std::memory_order_release);
    destroy_runtime(runtime);
    return 0;
  }

  denoise->voice_model_path = model_path;
  denoise->voice_runtime_path = runtime_path;
  auto* previous = static_cast<VoiceRuntime*>(
      denoise->voice.exchange(runtime, std::memory_order_acq_rel));
  retire_runtime(denoise, previous);
  return 1;
}

void denoise_voice_unload(FeqDenoise* denoise) {
  denoise->voice_model_path.clear();
  denoise->voice_runtime_path.clear();
  auto* runtime = static_cast<VoiceRuntime*>(
      denoise->voice.exchange(nullptr, std::memory_order_acq_rel));
  retire_runtime(denoise, runtime);
}

uint32_t denoise_voice_latency_frames(const FeqDenoise* denoise) {
  if (denoise->settings.voice.enabled == 0 ||
      denoise->voice.load(std::memory_order_acquire) == nullptr) {
    return 0;
  }
  return voice_latency_for(denoise->sample_rate);
}
