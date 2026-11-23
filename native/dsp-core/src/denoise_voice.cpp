/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The neural module: DPDFNet, behind a worker thread.
 *
 * The model and its runtime library are loaded once per process and shared
 * by every chain (`denoise_voice_model.h`); each runtime here keeps its own
 * worker, rings and recurrent state.
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
 * worker, the callback only reads a ring, and it never stalls and never emits
 * a partial block. A block whose cleaning is not ready in time is counted as
 * late and played as the delayed input at the gain the cleaner last applied,
 * joined to its neighbours without a step — never the raw room. In low lag
 * the worker has one 10 ms hop for each block, and a late block used to pass
 * the input untouched: ten milliseconds of the room at full level between
 * two cleaned blocks, with a click at each edge. That was the mic's cutoff.
 */

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstring>
#include <new>
#include <string>
#include <thread>
#include <vector>

#include "denoise_internal.h"
#include "denoise_voice_blend.h"
#include "denoise_voice_model.h"
#include "fluideq/convolver.h"
#include "fluideq/doorbell.h"
#include "fluideq/resampler.h"

using fluideq_voice::ort_ok;

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
  /** The shared model; `api`, `session` and `memory` are its, copied here. */
  fluideq_voice::VoiceModel* model = nullptr;
  const OrtApi* api = nullptr;
  OrtSession* session = nullptr;
  OrtMemoryInfo* memory = nullptr;

  std::vector<double> window;
  std::vector<VoiceChannel> channels;
  /** The 960-point transform. Built at load, used only by the worker. */
  FeqDft* transform = nullptr;
  /**
   * The worker's per-hop scratch, sized at load. A vector built per hop was
   * three heap calls every 10 ms inside the audio service, where the heap's
   * lock is shared with every thread in the process — time taken straight
   * out of the one hop the worker has.
   */
  std::vector<double> hop_real;
  std::vector<double> hop_imaginary;
  std::vector<float> hop_spectrum;

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
  /** Finished hops kept in hand; the prefill and the latency both use it. */
  uint32_t headroom_hops = kDenoiseVoiceLatencyFrames;
  double device_rate = kVoiceRate;

  /** Audio-thread only: what carries a late block, per channel. */
  VoiceBlend blend[FEQ_DENOISE_CHANNELS];
  /** The delayed input for one block, unwrapped from the dry ring. */
  std::vector<float> delayed;

  std::thread worker;
  std::atomic<bool> running{false};
  /** Whether the worker got Windows' audio scheduling class, for the bench. */
  std::atomic<bool> worker_prioritised{false};
  uint32_t channel_count = 2;
  /**
   * Armed by the callback each block it pushes input or takes output, rung
   * after the block by `denoise_voice_wake`, and slept on by the worker.
   */
  FeqDoorbell bell;
};

/** One 480-sample hop for one channel, through the transform and the model. */
void process_hop(VoiceRuntime& runtime, VoiceChannel& channel) {
  const OrtApi* api = runtime.api;
  std::vector<double>& real = runtime.hop_real;
  std::vector<double>& imaginary = runtime.hop_imaginary;
  for (uint32_t i = 0; i < kVoiceWindow; i += 1) {
    real[i] = static_cast<double>(channel.analysis[i]) * runtime.window[i];
    imaginary[i] = 0.0;
  }
  feq_dft_in_place(runtime.transform, real.data(), imaginary.data(), 0);

  std::vector<float>& spectrum = runtime.hop_spectrum;
  for (uint32_t bin = 0; bin < kVoiceBins; bin += 1) {
    spectrum[bin * 2] = static_cast<float>(real[bin]);
    spectrum[bin * 2 + 1] = static_cast<float>(imaginary[bin]);
  }

  const int64_t spec_shape[4] = {1, 1, static_cast<int64_t>(kVoiceBins), 2};
  const int64_t state_shape[1] = {static_cast<int64_t>(channel.state.size())};
  // Every call through `ort_ok`: a failure hands back a status this code owns,
  // and a model that fails every hop dropped one each 10 ms for as long as
  // the Voice module played.
  OrtValue* spec_value = nullptr;
  OrtValue* state_value = nullptr;
  if (!ort_ok(api, api->CreateTensorWithDataAsOrtValue(
                       runtime.memory, spectrum.data(),
                       spectrum.size() * sizeof(float), spec_shape, 4,
                       ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT, &spec_value))) {
    return;
  }
  if (!ort_ok(api, api->CreateTensorWithDataAsOrtValue(
                       runtime.memory, channel.state.data(),
                       channel.state.size() * sizeof(float), state_shape, 1,
                       ONNX_TENSOR_ELEMENT_DATA_TYPE_FLOAT, &state_value))) {
    api->ReleaseValue(spec_value);
    return;
  }

  const char* input_names[2] = {"spec", "state_in"};
  const char* output_names[2] = {"spec_e", "state_out"};
  const OrtValue* inputs[2] = {spec_value, state_value};
  OrtValue* outputs[2] = {nullptr, nullptr};
  const bool ran =
      ort_ok(api, api->Run(runtime.session, nullptr, input_names, inputs, 2,
                           output_names, 2, outputs));
  api->ReleaseValue(spec_value);
  api->ReleaseValue(state_value);
  if (!ran) {
    return;
  }

  float* enhanced = nullptr;
  float* next_state = nullptr;
  if (ort_ok(api, api->GetTensorMutableData(
                      outputs[0], reinterpret_cast<void**>(&enhanced))) &&
      ort_ok(api, api->GetTensorMutableData(
                      outputs[1], reinterpret_cast<void**>(&next_state)))) {
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

/**
 * The worker converts to 48 kHz, runs the model, then converts back.
 *
 * It sleeps until a block has given it something: input to take, or room in
 * the output the callback has just emptied. It used to sleep a millisecond
 * and look again, which is a thousand wake-ups a second for as long as a
 * model is loaded — with the Library stopped, all of them for nothing — and
 * still up to a millisecond late on the block that did bring work. The ring
 * after each block (`denoise_voice_wake`) is at most microseconds late, and
 * the four hops of scheduling headroom the latency carries are untouched.
 *
 * The count is read before the rings are looked at, so a block that lands
 * between the look and the sleep is a ring the sleep returns on at once.
 */
void worker_loop(VoiceRuntime* runtime) {
  // For the thread's whole life: every hop has the same one-block deadline.
  const fluideq_voice::AudioWorkerPriority priority;
  runtime->worker_prioritised.store(priority.joined(),
                                    std::memory_order_release);
  for (;;) {
    const uint32_t seen = runtime->bell.rung();
    if (!runtime->running.load(std::memory_order_acquire)) {
      return;
    }
    bool worked = resample_input(*runtime);
    while (process_model_hop(*runtime)) {
      worked = true;
    }
    while (resample_output(*runtime)) {
      worked = true;
    }
    if (!worked) {
      runtime->bell.wait(seen);
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
        runtime.device_rate, kVoiceHop * runtime.headroom_hops);
    while (remaining > 0) {
      const uint32_t block = remaining < 64 ? remaining : 64;
      runtime.output[c].push(silence, block);
      remaining -= block;
    }

    VoiceChannel& channel = runtime.channels[c];
    std::fill(channel.analysis.begin(), channel.analysis.end(), 0.0f);
    std::fill(channel.synthesis.begin(), channel.synthesis.end(), 0.0f);
    channel.state = runtime.model->initial_state;
    voice_blend_reset(runtime.blend[c], runtime.device_rate,
                      runtime.voice_latency);
  }
  runtime.scratch.assign(runtime.max_frames, 0.0f);
  runtime.delayed.assign(runtime.max_frames, 0.0f);
  runtime.hop_real.assign(kVoiceWindow, 0.0);
  runtime.hop_imaginary.assign(kVoiceWindow, 0.0);
  runtime.hop_spectrum.assign(kVoiceBins * 2, 0.0f);
  runtime.dry_cursor = 0;
  runtime.output_debt = 0;
}

void destroy_runtime(VoiceRuntime* runtime) {
  if (runtime == nullptr) {
    return;
  }
  runtime->running.store(false, std::memory_order_release);
  // The worker is asleep until rung, and the next ring would have been a block
  // that is never coming.
  runtime->bell.ring();
  if (runtime->worker.joinable()) {
    runtime->worker.join();
  }
  feq_resampler_destroy(runtime->to_model);
  runtime->to_model = nullptr;
  feq_resampler_destroy(runtime->from_model);
  runtime->from_model = nullptr;
  feq_dft_destroy(runtime->transform);
  runtime->transform = nullptr;
  // After the worker has joined: it was the last thing running the session.
  fluideq_voice::release_voice_model(runtime->model);
  runtime->model = nullptr;
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

uint32_t denoise_voice_latency_for(double device_rate,
                                   uint32_t headroom_hops) {
  // One overlap-add hop, plus the worker's scheduling headroom.
  return device_frames_for(device_rate, kVoiceHop) +
         device_frames_for(device_rate, kVoiceHop * headroom_hops);
}

uint32_t denoise_voice_low_latency_hops(double device_rate,
                                        uint32_t max_frames) {
  // The worker is woken after each device block and must have the next
  // block's output ready before it: fewer hops than one block holds is an
  // underrun on every block, however fast the machine.
  const double model_frames =
      static_cast<double>(max_frames) * kVoiceRate / device_rate;
  const uint32_t hops =
      static_cast<uint32_t>(std::ceil(model_frames / kVoiceHop - 1e-9));
  return std::clamp(hops, 1u, kDenoiseVoiceLatencyFrames);
}

namespace {

/** Whether the cleaner is meant to be heard: the restoration and it both on. */
bool voice_wanted(const FeqDenoise* denoise) {
  return denoise->settings.enabled != 0 && denoise->settings.voice.enabled != 0;
}

/**
 * The runtime retired, the model's paths kept to bring it back.
 *
 * A cleaner switched off used to keep its worker running the network on every
 * block — the callback still fed it and took its output, only to throw the
 * output away — and the Library host loads the model on every chain rebuild
 * whether the cleaner is on or not. Parked, nothing runs and nothing is
 * allocated beyond the two paths.
 */
void park_voice(FeqDenoise* denoise) {
  auto* runtime = static_cast<VoiceRuntime*>(
      denoise->voice.exchange(nullptr, std::memory_order_acq_rel));
  retire_runtime(denoise, runtime);
}

}  // namespace

void denoise_voice_configure(FeqDenoise* denoise) {
  if (denoise->voice_model_path.empty() ||
      denoise->voice_runtime_path.empty()) {
    return;
  }
  const bool live = denoise->voice.load(std::memory_order_acquire) != nullptr;
  if (!voice_wanted(denoise)) {
    if (live) {
      park_voice(denoise);
    }
    return;
  }
  if (!live) {
    // Switched back on in place: the model is shared, so this builds only
    // the stream's own worker and rings around it.
    const std::string model_path = denoise->voice_model_path;
    const std::string runtime_path = denoise->voice_runtime_path;
    denoise_voice_load_model(denoise, model_path.c_str(), runtime_path.c_str());
  }
}

void denoise_voice_reset(FeqDenoise* denoise) {
  if (denoise->voice_model_path.empty() ||
      denoise->voice_runtime_path.empty() || !voice_wanted(denoise)) {
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
    if (output_ready) {
      runtime->output[c].pop(runtime->scratch.data(), frames);
    }
    if (!enabled) {
      continue;
    }
    const float* line = runtime->dry_delay[c].data();
    for (uint32_t i = 0; i < frames; i += 1) {
      runtime->delayed[i] =
          line[(runtime->dry_cursor + i + dry_ring - runtime->voice_latency) %
               dry_ring];
    }
    voice_blend_block(runtime->blend[c], channels[c], runtime->delayed.data(),
                      output_ready ? runtime->scratch.data() : nullptr, frames,
                      amount);
  }

  if (!output_ready) {
    runtime->output_debt += frames;
    if (enabled) {
      underruns = 1;
    }
  }
  runtime->dry_cursor = (runtime->dry_cursor + frames) % dry_ring;
  // Input pushed, output taken: either is work. Rung after the block.
  runtime->bell.arm();
  denoise->voice_readers.fetch_sub(1, std::memory_order_release);
  return underruns;
}

extern "C" uint32_t feq_denoise_voice_late(const FeqDenoise* denoise) {
  return denoise == nullptr
             ? 0
             : denoise->reported_voice_underruns.load(std::memory_order_relaxed);
}

extern "C" uint32_t feq_denoise_voice_hops(const FeqDenoise* denoise) {
  if (denoise == nullptr || denoise->settings.enabled == 0 ||
      denoise->settings.voice.enabled == 0) {
    return 0;
  }
  const auto* runtime = static_cast<const VoiceRuntime*>(
      denoise->voice.load(std::memory_order_acquire));
  return runtime == nullptr ? 0 : runtime->headroom_hops;
}

bool denoise_voice_can_swap(const FeqDenoise* prepared,
                            const FeqDenoise* previous) {
  const auto* fresh = static_cast<const VoiceRuntime*>(
      prepared->voice.load(std::memory_order_acquire));
  const auto* playing = static_cast<const VoiceRuntime*>(
      previous->voice.load(std::memory_order_acquire));
  return fresh != nullptr && playing != nullptr &&
         fresh->model == playing->model &&
         fresh->channel_count == playing->channel_count &&
         fresh->max_frames == playing->max_frames &&
         fresh->device_rate == playing->device_rate &&
         fresh->voice_latency == playing->voice_latency;
}

void denoise_voice_swap(FeqDenoise* prepared, FeqDenoise* previous) {
  void* playing = previous->voice.load(std::memory_order_acquire);
  void* fresh = prepared->voice.exchange(playing, std::memory_order_acq_rel);
  previous->voice.store(fresh, std::memory_order_release);
}

void denoise_voice_wake(FeqDenoise* denoise) {
  // Counted as a reader like the callback, so a model swapped on the control
  // thread cannot be retired between the load and the ring.
  denoise->voice_readers.fetch_add(1, std::memory_order_acq_rel);
  auto* runtime = static_cast<VoiceRuntime*>(
      denoise->voice.load(std::memory_order_acquire));
  if (runtime != nullptr) {
    runtime->bell.ring_if_armed();
  }
  denoise->voice_readers.fetch_sub(1, std::memory_order_release);
}

int denoise_voice_load_model(FeqDenoise* denoise, const char* model_path,
                             const char* runtime_path) {
  if (model_path == nullptr || runtime_path == nullptr) {
    return 0;
  }
  if (!voice_wanted(denoise)) {
    // Remembered, not run: switching the cleaner on loads it from here
    // (`denoise_voice_configure`). Whether the files load is learnt then.
    denoise->voice_model_path = model_path;
    denoise->voice_runtime_path = runtime_path;
    park_voice(denoise);
    return 1;
  }

  auto* runtime = new (std::nothrow) VoiceRuntime();
  if (runtime == nullptr) {
    return 0;
  }
  runtime->model = fluideq_voice::acquire_voice_model(model_path, runtime_path);
  if (runtime->model == nullptr) {
    delete runtime;
    return 0;
  }
  runtime->api = runtime->model->api;
  runtime->session = runtime->model->session;
  runtime->memory = runtime->model->memory;

  runtime->channel_count = denoise->channels;
  runtime->max_frames = denoise->max_frames;
  runtime->device_rate = denoise->sample_rate;
  runtime->headroom_hops = denoise->voice_headroom_hops;
  runtime->voice_latency =
      denoise_voice_latency_for(runtime->device_rate, runtime->headroom_hops);
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
    channel.state = runtime->model->initial_state;
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
  return denoise_voice_latency_for(denoise->sample_rate,
                                   denoise->voice_headroom_hops);
}
