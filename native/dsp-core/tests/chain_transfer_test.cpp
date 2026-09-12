#include "../src/chain_internal.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <new>

namespace {
bool track_heap = false;
uint32_t allocations = 0;
uint32_t releases = 0;
}

void* operator new(std::size_t size) {
  if (track_heap) {
    ++allocations;
  }
  if (void* memory = std::malloc(size == 0 ? 1 : size)) {
    return memory;
  }
  throw std::bad_alloc();
}

void* operator new[](std::size_t size) { return ::operator new(size); }

void operator delete(void* memory) noexcept {
  if (track_heap && memory != nullptr) {
    ++releases;
  }
  std::free(memory);
}

void operator delete[](void* memory) noexcept { ::operator delete(memory); }
void operator delete(void* memory, std::size_t) noexcept {
  ::operator delete(memory);
}
void operator delete[](void* memory, std::size_t) noexcept {
  ::operator delete(memory);
}

namespace {

constexpr uint32_t kFrames = 128;
constexpr double kRate = 48000.0;
constexpr double kPi = 3.14159265358979323846;
using Audio = std::array<std::array<float, kFrames>, 2>;
using Rack = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;
int failures = 0;

void check(bool passed, const char* message) {
  if (!passed) {
    std::printf("FAIL: %s\n", message);
    ++failures;
  }
}

Rack prepare(const FeqChainSettings& settings, double rate = kRate,
             uint32_t channels = 2, uint32_t frames = kFrames) {
  Rack rack(feq_chain_create(rate, channels, frames), &feq_chain_destroy);
  feq_chain_configure(rack.get(), &settings);
  std::vector<float> silence(static_cast<size_t>(frames) * channels);
  float* planes[2] = {silence.data(), silence.data() + frames};
  feq_chain_process(rack.get(), planes, frames);
  feq_chain_reset(rack.get(), FEQ_CHAIN_RESET_STREAM_START);
  return rack;
}

Audio signal(uint32_t block) {
  Audio audio{};
  for (uint32_t frame = 0; frame < kFrames; ++frame) {
    const double phase = 2.0 * kPi *
                         static_cast<double>(block * kFrames + frame) / kRate;
    audio[0][frame] = static_cast<float>(0.1 * std::sin(phase * 1000.0) +
                                       0.04 * std::sin(phase * 70.0));
    audio[1][frame] = static_cast<float>(0.08 * std::sin(phase * 1000.0) +
                                       0.03 * std::sin(phase * 110.0));
  }
  return audio;
}

void process(FeqChain* rack, Audio& audio) {
  float* planes[2] = {audio[0].data(), audio[1].data()};
  feq_chain_process(rack, planes, kFrames);
}

int transfer(FeqChain* next, FeqChain* previous) {
  track_heap = true;
  const int result = feq_chain_transfer_state(next, previous);
  track_heap = false;
  return result;
}

double peak(const Audio& audio) {
  double value = 0.0;
  for (const auto& channel : audio) {
    for (float sample : channel) {
      check(std::isfinite(sample), "all output samples are finite");
      value = std::max(value, std::fabs(static_cast<double>(sample)));
    }
  }
  return value;
}

FeqChainSettings settings_for(bool linear) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.eq.enabled = 1;
  settings.eq.phase = linear ? FEQ_PHASE_LINEAR : FEQ_PHASE_MINIMUM;
  settings.eq.band_count = 1;
  settings.eq.bands[0].enabled = 1;
  settings.eq.bands[0].type = FEQ_FILTER_PK;
  settings.eq.bands[0].frequency = 1000.0;
  settings.eq.bands[0].quality = 1.0;
  settings.maximizer.enabled = 1;
  settings.master.enabled = 1;
  return settings;
}

void unchanged_settings_match_uninterrupted_audio() {
  for (const bool linear : {false, true}) {
    auto settings = settings_for(linear);
    settings.compressor.enabled = 1;
    settings.bass_forge.enabled = 1;
    settings.bass_forge.mix = 0.3;
    settings.bass_forge.sub_amount = 0.1;
    settings.bass_punch.enabled = 1;
    settings.bass_punch.bloom_amount = 0.2;
    settings.dimension = {1, 0.9, 1.1, 1.2, 200.0, 3000.0, 0.3};
    settings.exciter.enabled = 1;
    settings.exciter.organic_enabled = 1;
    settings.exciter.organic_amount = 0.15;
    settings.exciter.organic_focus_hz = 900.0;
    settings.exciter.organic_range = 0.4;
    auto reference = prepare(settings);
    auto running = prepare(settings);
    double maximum_error = 0.0;
    double audible_peak = 0.0;
    for (uint32_t block = 0; block < 650; ++block) {
      if (block >= 400 && block % 7 == 0) {
        auto next = prepare(settings);
        check(transfer(next.get(), running.get()) == 1,
              "compatible histories transfer");
        running = std::move(next);
      }
      auto expected = signal(block);
      auto actual = expected;
      process(reference.get(), expected);
      track_heap = true;
      process(running.get(), actual);
      track_heap = false;
      for (uint32_t channel = 0; channel < 2; ++channel) {
        for (uint32_t frame = 0; frame < kFrames; ++frame) {
          maximum_error = std::max(maximum_error,
              std::fabs(static_cast<double>(actual[channel][frame]) -
                        expected[channel][frame]));
        }
      }
      if (block >= 400) {
        audible_peak = std::max(audible_peak, peak(actual));
      }
    }
    std::printf("unchanged phase %d: maximum error %.9g, peak %.4f\n",
                linear, maximum_error, audible_peak);
    check(maximum_error < 1e-7, "handover matches uninterrupted processing");
    check(audible_peak > 0.02, "comparison contains real audio, not silence");
  }
}

void changed_settings_arrive_without_a_silent_block() {
  for (const bool linear : {false, true}) {
    auto settings = settings_for(linear);
    auto running = prepare(settings);
    double minimum_peak = 1.0;
    for (uint32_t block = 0; block < 900; ++block) {
      if (block >= 400 && block < 460 && block % 3 == 0) {
        settings.master.output_trim_db = -6.0;
        settings.eq.bands[0].gain_db = -6.0 - static_cast<double>(block % 5);
        auto next = prepare(settings);
        check(transfer(next.get(), running.get()) == 1,
              "edited settings transfer");
        running = std::move(next);
      }
      auto audio = signal(block);
      track_heap = true;
      process(running.get(), audio);
      track_heap = false;
      if (block >= 400) {
        minimum_peak = std::min(minimum_peak, peak(audio));
      }
    }
    auto reference = prepare(settings);
    auto actual = signal(900);
    Audio expected{};
    for (uint32_t block = 0; block <= 900; ++block) {
      expected = signal(block);
      process(reference.get(), expected);
    }
    process(running.get(), actual);
    std::printf("changed phase %d: minimum peak %.6f, final %.6f / %.6f\n",
                linear, minimum_peak, peak(actual), peak(expected));
    check(minimum_peak > 0.005, "rapid edits never empty the delay lines");
    check(std::fabs(peak(actual) - peak(expected)) < 0.001,
          "latest EQ and trim really arrive, not just the old audio");
    if (linear) {
      check(running->retired_count > 0,
            "old kernel waits for control-thread destruction");
    }
  }
}

void incompatible_streams_and_pending_configs_are_refused() {
  const auto settings = settings_for(true);
  auto running = prepare(settings);
  auto rate = prepare(settings, 44100.0);
  auto mono = prepare(settings, kRate, 1);
  auto larger = prepare(settings, kRate, 2, 256);
  check(feq_chain_transfer_state(rate.get(), running.get()) == 0,
        "sample rate mismatch is refused");
  check(feq_chain_transfer_state(mono.get(), running.get()) == 0,
        "channel mismatch is refused");
  check(feq_chain_transfer_state(larger.get(), running.get()) == 0,
        "block size mismatch is refused");
  check(feq_chain_transfer_state(running.get(), running.get()) == 0,
        "self transfer is refused");
  auto pending = Rack(feq_chain_create(kRate, 2, kFrames), &feq_chain_destroy);
  feq_chain_configure(pending.get(), &settings);
  check(feq_chain_transfer_state(pending.get(), running.get()) == 0,
        "unadopted kernel is refused");
}

void the_library_kernel_update_also_keeps_audio() {
  auto settings = settings_for(true);
  auto running = prepare(settings);
  double minimum_peak = 1.0;
  for (uint32_t block = 0; block < 800; ++block) {
    if (block == 400) {
      settings.eq.bands[0].gain_db = -6.0;
      feq_chain_configure(running.get(), &settings);
    }
    auto audio = signal(block);
    process(running.get(), audio);
    if (block >= 400) {
      minimum_peak = std::min(minimum_peak, peak(audio));
    }
  }
  std::printf("library kernel change: minimum peak %.6f\n", minimum_peak);
  check(minimum_peak > 0.01, "library fades only once the whole FIR is warm");
}

void dynamic_edits_keep_new_configuration() {
  auto settings = settings_for(false);
  settings.eq.bands[0].gain_db = -12.0;
  auto running = prepare(settings);
  for (uint32_t block = 0; block < 400; ++block) {
    auto audio = signal(block);
    process(running.get(), audio);
  }
  for (const double threshold : {-10.0, -40.0}) {
    settings.eq.bands[0].dynamic = 1;
    settings.eq.bands[0].threshold_db = threshold;
    auto next = prepare(settings);
    const FeqBandDynamics configured = next->band_dynamics[0];
    check(transfer(next.get(), running.get()) == 1, "dynamic edit transfers");
    check(next->band_dynamics[0].active == configured.active &&
          next->band_dynamics[0].threshold == configured.threshold &&
          next->band_dynamics[0].normalise == configured.normalise,
          "dynamic toggle, threshold and normalization keep new values");
    running = std::move(next);
    auto reference = prepare(settings);
    Audio actual{}, expected{};
    for (uint32_t block = 400; block < 1200; ++block) {
      actual = signal(block);
      expected = actual;
      process(running.get(), actual);
      process(reference.get(), expected);
    }
    check(std::fabs(peak(actual) - peak(expected)) < 0.001,
          "dynamic changes audibly reach the requested result");
  }
}

void edits_during_audible_fades_keep_the_fade() {
  for (const uint32_t channels : {1u, 2u}) {
    auto settings = settings_for(true);
    auto running = prepare(settings, kRate, channels);
    uint32_t block = 0;
    for (; block < 400; ++block) {
      auto audio = signal(block);
      process(running.get(), audio);
    }
    settings.eq.bands[0].gain_db = -6.0;
    auto second = prepare(settings, kRate, channels);
    check(transfer(second.get(), running.get()) == 1, "first filter edit");
    running = std::move(second);
    for (; block < 700 && running->convolver_blend[0] == 0.0; ++block) {
      auto audio = signal(block);
      track_heap = true;
      process(running.get(), audio);
      track_heap = false;
    }
    const double blend = running->convolver_blend[0];
    check(blend > 0.0 && blend < 1.0, "positive control is inside audible fade");
    auto* audible_next = running->convolvers_next[0];
    settings.eq.bands[0].gain_db = -12.0;
    auto third = prepare(settings, kRate, channels);
    check(transfer(third.get(), running.get()) == 1, "midfade edit transfers");
    check(third->convolver_blend[0] == blend &&
          third->convolvers_next[0] == audible_next && third->queued_kernel != nullptr,
          "audible mixture remains intact; latest filter waits its turn");
    running = std::move(third);
    for (uint32_t count = 0; count < 400; ++count, ++block) {
      auto audio = signal(block);
      track_heap = true;
      process(running.get(), audio);
      track_heap = false;
      if (channels == 1) {
        audio[1].fill(0.0f);
      }
      check(peak(audio) > 0.005, "queued fade never empties the audio");
    }
    check(running->kernel_next == nullptr && running->queued_kernel == nullptr,
          "mono and stereo both finish the two fades");
    check(running->retired_count == 2,
          "both completed filters are retained for off-thread destruction");
  }
}

}

int main() {
  track_heap = true;
  void* control = ::operator new(64);
  ::operator delete(control);
  track_heap = false;
  check(allocations == 1 && releases == 1, "heap monitor positive control");
  allocations = 0;
  releases = 0;
  unchanged_settings_match_uninterrupted_audio();
  changed_settings_arrive_without_a_silent_block();
  dynamic_edits_keep_new_configuration();
  edits_during_audible_fades_keep_the_fade();
  check(allocations == 0, "engine audio handover and processing allocate nothing");
  check(releases == 0, "engine audio handover and processing free nothing");
  incompatible_streams_and_pending_configs_are_refused();
  the_library_kernel_update_also_keeps_audio();
  std::printf("chain transfer: %d failures\n", failures);
  return failures == 0 ? 0 : 1;
}
