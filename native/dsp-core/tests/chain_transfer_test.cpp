#include "../src/chain_internal.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include <new>
#include <vector>

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

/**
 * The room across a handover. The engine rebuilds the rack on every change
 * to a room dial, and a room that started its convolvers empty put one
 * partition of silence into every such change — heard as the sound cutting
 * for an instant. With the same settings the handover must be inaudible;
 * with a changed room the old room must keep playing until the new one is
 * warm, and the new one must actually arrive.
 */
void the_room_keeps_its_tail_across_a_handover() {
  constexpr uint32_t directions = 24;
  constexpr uint32_t taps = 64;
  // A head that reaches both ears eight frames late, at less than unity, so
  // the room is audibly a filter and not a wire.
  std::vector<float> ring(directions * taps, 0.0f);
  for (uint32_t direction = 0; direction < directions; ++direction) {
    ring[direction * taps + 8] = 0.7f;
  }
  const int speakers[FEQ_CHAIN_MAX_CHANNELS] = {0, 1, -1, -1, -1, -1, -1, -1};
  // Primed with one silent block and reset, as the engine's `build_rack`
  // does: that adopts the published kernels, which a transfer refuses to
  // find pending, and makes the room's set live before the handover.
  const auto with_room = [&](const FeqChainSettings& settings) {
    Rack rack(feq_chain_create(kRate, 2, kFrames), &feq_chain_destroy);
    feq_chain_configure(rack.get(), &settings);
    feq_chain_set_room_layout(rack.get(), speakers);
    feq_chain_set_room_head(rack.get(), ring.data(), ring.data(), directions,
                            taps, 0);
    std::vector<float> silence(static_cast<size_t>(kFrames) * 2);
    float* planes[2] = {silence.data(), silence.data() + kFrames};
    feq_chain_process(rack.get(), planes, kFrames);
    feq_chain_reset(rack.get(), FEQ_CHAIN_RESET_STREAM_START);
    return rack;
  };
  auto settings = settings_for(false);
  settings.room.enabled = 1;
  auto reference = with_room(settings);
  auto running = with_room(settings);
  check(feq_chain_room_active(running.get()) == 1, "the room is folding");

  double maximum_error = 0.0;
  double audible_peak = 0.0;
  for (uint32_t block = 0; block < 500; ++block) {
    if (block >= 300 && block % 7 == 0) {
      auto next = with_room(settings);
      check(transfer(next.get(), running.get()) == 1, "room chains transfer");
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
    if (block >= 300) {
      audible_peak = std::max(audible_peak, peak(actual));
    }
  }
  std::printf("room unchanged: maximum error %.9g, peak %.4f\n",
              maximum_error, audible_peak);
  check(maximum_error < 1e-6, "an unchanged room hands over inaudibly");
  check(audible_peak > 0.02, "the room comparison contains real audio");

  // A changed room: the first partition after the handover is still the old
  // room, sample for sample, and nothing in it is a hole.
  auto changed = settings;
  changed.room.distance_m = 3.5;
  changed.room.walls = 0.1;
  auto next = with_room(changed);
  check(transfer(next.get(), running.get()) == 1, "a changed room transfers");
  running = std::move(next);
  double warm_error = 0.0;
  double minimum_block_peak = 1.0;
  constexpr uint32_t warm_blocks = 512 / kFrames;
  for (uint32_t block = 500; block < 500 + warm_blocks; ++block) {
    auto expected = signal(block);
    auto actual = expected;
    process(reference.get(), expected);
    track_heap = true;
    process(running.get(), actual);
    track_heap = false;
    for (uint32_t channel = 0; channel < 2; ++channel) {
      for (uint32_t frame = 0; frame < kFrames; ++frame) {
        warm_error = std::max(warm_error,
            std::fabs(static_cast<double>(actual[channel][frame]) -
                      expected[channel][frame]));
      }
    }
    minimum_block_peak = std::min(minimum_block_peak, peak(actual));
  }
  std::printf("room changed: warm-up error %.9g, quietest block %.4f\n",
              warm_error, minimum_block_peak);
  check(warm_error < 1e-6, "the old room plays on while the new one warms");
  check(minimum_block_peak > 0.02, "no block after the change is a hole");
  double drift = 0.0;
  for (uint32_t block = 500 + warm_blocks; block < 900; ++block) {
    auto expected = signal(block);
    auto actual = expected;
    process(reference.get(), expected);
    track_heap = true;
    process(running.get(), actual);
    track_heap = false;
    if (block >= 850) {
      for (uint32_t frame = 0; frame < kFrames; ++frame) {
        drift = std::max(drift,
            std::fabs(static_cast<double>(actual[0][frame]) -
                      expected[0][frame]));
      }
    }
  }
  std::printf("room changed: settled difference %.6f\n", drift);
  check(drift > 1e-4, "the changed room really arrives (control)");
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

/**
 * A stage appearing mid-record must not arrive as a step.
 *
 * Every stage that splits the signal into bands turns its phase: the bands
 * have to share one phase or their gains fight where they meet, and the sum of
 * three in-phase bands is the input with its phase turned (`primitives.h`).
 * That turn is inaudible while it is running and is a discontinuity at the
 * instant it starts, which is a click — and a preset switch turns stages on
 * and off constantly, so this is the ordinary case rather than an edge one.
 *
 * Measured against the steepest step the signal itself takes, because that is
 * what a click has to hide inside, and against a splice of the two steady
 * streams, which is what an unsmoothed switch would sound like.
 */
double worst_step(const std::vector<float>& samples, size_t from, size_t until) {
  double worst = 0.0;
  const size_t last = std::min(until, samples.size());
  for (size_t at = from + 1; at < last; ++at) {
    worst = std::max(worst, std::fabs(static_cast<double>(samples[at]) -
                                      static_cast<double>(samples[at - 1])));
  }
  return worst;
}

/**
 * A tone at the corner these stages split at, which is where the phase they
 * turn is a whole half cycle — so a switch that arrived unsmoothed would jump
 * from one end of the waveform to the other, and the measurement has
 * something to see. Two decisions the first version of this test got wrong:
 *
 *  - 1000 Hz at 48 kHz is 48 samples, which divides the 128-sample block
 *    exactly, so every switch landed on a zero crossing and read as nothing.
 *  - A tone well above both corners is turned by only twenty degrees or so,
 *    and at that angle even an unsmoothed switch steps by less than three
 *    times what the tone itself does between samples. The test would have
 *    passed over a real click.
 *
 * The small tone on top is what the steps are measured against: it is the
 * fastest thing in the signal, so anything steeper than it is not the music.
 */
Audio smooth_signal(uint32_t block) {
  Audio audio{};
  for (uint32_t frame = 0; frame < kFrames; ++frame) {
    const double phase = 2.0 * kPi *
                         static_cast<double>(block * kFrames + frame) / kRate;
    const double tone = 0.1 * std::sin(phase * 200.0);
    const double top = 0.03 * std::sin(phase * 997.0);
    audio[0][frame] = static_cast<float>(tone + top);
    audio[1][frame] = static_cast<float>(0.8 * tone - top);
  }
  return audio;
}

/** The left channel of `blocks` blocks, starting at `first`. */
std::vector<float> run_blocks(FeqChain* rack, uint32_t first, uint32_t blocks) {
  std::vector<float> out;
  for (uint32_t block = 0; block < blocks; ++block) {
    Audio audio = smooth_signal(first + block);
    process(rack, audio);
    out.insert(out.end(), audio[0].begin(), audio[0].end());
  }
  return out;
}

void stages_switch_on_without_a_step() {
  struct Case {
    const char* name;
    void (*apply)(FeqChainSettings&);
  };
  const Case cases[] = {
      {"Dimension",
       [](FeqChainSettings& settings) {
         settings.dimension = {1, 0.9, 1.25, 1.55, 200.0, 3000.0, 0.55};
       }},
      {"the exciter's Timing",
       [](FeqChainSettings& settings) {
         settings.exciter.enabled = 1;
         settings.exciter.align_enabled = 1;
         settings.exciter.align_amount = 0.45;
         for (auto& band : settings.exciter.bands) {
           band.enabled = 0;
         }
       }},
  };

  constexpr uint32_t kWarm = 24;
  constexpr uint32_t kAfter = 24;
  for (const Case& one : cases) {
    FeqChainSettings quiet{};
    feq_chain_settings_defaults(&quiet);
    quiet.enabled = 1;
    quiet.normalizer.mode = 0;
    quiet.master.enabled = 0;
    quiet.maximizer.enabled = 0;
    quiet.eq.enabled = 0;
    quiet.exciter.enabled = 0;
    FeqChainSettings loud = quiet;
    one.apply(loud);

    // The host adopts a new snapshot in place; the system-wide engine builds a
    // chain and hands the state over. A click has to be absent from both.
    for (const bool in_place : {true, false}) {
      auto running = prepare(quiet);
      const std::vector<float> before = run_blocks(running.get(), 0, kWarm);
      auto next = prepare(loud);
      if (in_place) {
        feq_chain_configure(running.get(), &loud);
      } else {
        // The prepared chain has to have seen the same past, or the handover
        // is being asked to hide a discontinuity nothing in the field does.
        run_blocks(next.get(), 0, kWarm);
        check(transfer(next.get(), running.get()) == 1,
              "the prepared chain accepts the handover");
      }
      FeqChain* carrying = in_place ? running.get() : next.get();
      std::vector<float> joined = before;
      const size_t seam = joined.size();
      const std::vector<float> after = run_blocks(carrying, kWarm, kAfter);
      joined.insert(joined.end(), after.begin(), after.end());

      // The signal's own steepest step, taken away from the seam: a fade this
      // short leaves nothing steeper than the music it arrives in.
      const double natural =
          std::max(worst_step(joined, kFrames * 2, seam - kFrames),
                   worst_step(joined, seam + 480, joined.size()));
      const double crossing = worst_step(joined, seam - 1, seam + 240);
      std::printf("  %-22s %-8s step %.5f against the signal's %.5f\n",
                  one.name, in_place ? "in place" : "handover", crossing,
                  natural);
      check(crossing < natural * 3.0,
            "a stage switched on arrives without a step");
    }

    /**
     * What there was to hide, which is what makes the checks above mean
     * anything.
     *
     * The stage running and the stage bypassed are far apart at the corner,
     * because the split turns the phase of everything through it. A switch
     * made between one sample and the next would step by that difference, so
     * these checks are only worth something on a case where the difference
     * dwarfs the steepest step the signal itself takes — measuring the step at
     * one splice point instead would depend on where in the waveform the
     * switch happened to land, and the first version of this test passed for
     * exactly that reason.
     */
    auto quiet_rack = prepare(quiet);
    auto loud_rack = prepare(loud);
    const std::vector<float> bypassed = run_blocks(quiet_rack.get(), 0, kWarm);
    run_blocks(loud_rack.get(), 0, kWarm);
    const std::vector<float> processed =
        run_blocks(loud_rack.get(), kWarm, kWarm);
    double apart = 0.0;
    for (size_t at = 0; at < processed.size() && at < bypassed.size(); ++at) {
      apart = std::max(apart, std::fabs(static_cast<double>(processed[at]) -
                                        static_cast<double>(bypassed[at])));
    }
    const double natural = worst_step(bypassed, kFrames * 2, bypassed.size());
    std::printf("  %-22s %-8s the two states are %.5f apart, and the signal "
                "steps %.5f\n",
                one.name, "control", apart, natural);
    check(apart > natural * 3.0,
          "and an unfaded switch would have had something to step by");
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
  the_room_keeps_its_tail_across_a_handover();
  check(allocations == 0, "engine audio handover and processing allocate nothing");
  check(releases == 0, "engine audio handover and processing free nothing");
  incompatible_streams_and_pending_configs_are_refused();
  the_library_kernel_update_also_keeps_audio();
  stages_switch_on_without_a_step();
  std::printf("chain transfer: %d failures\n", failures);
  return failures == 0 ? 0 : 1;
}
