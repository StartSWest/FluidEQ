#include <algorithm>
#include <cmath>
#include <limits>
#include <memory>
#include "graph_test_support.h"
#include "fluideq/convolver.h"
#include "../src/graph_stages.h"
#include "../src/graphic_eq.h"
#include "../src/chain_signature.h"

using namespace fluideq_engine_test;
using fluideq_engine::Chain;
using fluideq_engine::FilterType;
using fluideq_engine::Graph;

namespace {

constexpr uint32_t kFftSize = 262144;
constexpr uint32_t kBlock = 256;

struct Measurement {
  std::vector<double> real;
  std::vector<double> imaginary;
  uint32_t latency;
};

Measurement measure(const Chain& chain, uint32_t rate) {
  Graph graph(chain, rate, 1, kBlock);
  CHECK(!graph.is_passthrough() && graph.problems().empty());
  std::vector<float> buffer(kBlock);
  float* planes[] = {buffer.data()};
  for (uint32_t frame = 0; frame < rate * 2; frame += kBlock) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    graph.process(planes, kBlock);
  }
  Measurement result{std::vector<double>(kFftSize), std::vector<double>(kFftSize), graph.latency_frames()};
  for (uint32_t frame = 0; frame < kFftSize; frame += kBlock) {
    std::fill(buffer.begin(), buffer.end(), 0.0f);
    if (frame == 0) buffer[0] = 0.05f;
    graph.process(planes, kBlock);
    for (uint32_t index = 0; index < kBlock; ++index) result.real[frame + index] = buffer[index] / 0.05;
  }
  feq_fft_in_place(result.real.data(), result.imaginary.data(), kFftSize, 0);
  return result;
}

/** A curve's own line, as the app draws it: dB linear in log frequency. */
double drawn_db(const std::vector<std::vector<fluideq_engine::GraphicPoint>>& curves,
                double frequency) {
  double sum = 0;
  for (const auto& curve : curves) {
    if (frequency <= curve.front().frequency) {
      sum += curve.front().gain_db;
      continue;
    }
    if (frequency >= curve.back().frequency) {
      sum += curve.back().gain_db;
      continue;
    }
    for (size_t at = 1; at < curve.size(); ++at) {
      if (frequency <= curve[at].frequency) {
        const double t = std::log10(frequency / curve[at - 1].frequency) /
                         std::log10(curve[at].frequency / curve[at - 1].frequency);
        sum += curve[at - 1].gain_db + t * (curve[at].gain_db - curve[at - 1].gain_db);
        break;
      }
    }
  }
  return sum;
}

Chain correction() {
  Chain chain;
  chain.matched = true;
  chain.bands = {
    {FilterType::PK, 25, 12, 2, true, false},
    {FilterType::PK, 1000, 6, 2, true, false},
    {FilterType::PK, 58, 3.2, 2, false, true},
    {FilterType::PK, 130, -6.3, 0.9, false, true},
    {FilterType::PK, 4300, 10.6, 1.2, false, true},
    {FilterType::PK, 7900, -6.4, 5, false, true}
  };
  return chain;
}

void parametric_phase_preserves_tuning() {
  const Chain chain = correction();
  double largest = 0.0;
  double phase_error = 0.0;
  double positive = 0.0;
  for (uint32_t rate : {44100u, 48000u, 96000u}) {
    const auto reference = measure(chain, rate);
    CHECK(reference.latency == 0);
    for (int mode = 1; mode < 4; ++mode) {
      Chain selected = chain;
      selected.minimum_eq_phase = (mode & 1) == 0;
      selected.minimum_curve_phase = (mode & 2) == 0;
      const auto response = measure(selected, rate);
      // One FIR for every layer in linear phase: both layers linear cost
      // the delay of one, not two in series.
      const uint32_t shared = (rate > 48000 ? 32767u : 16383u) + feq_convolver_latency();
      CHECK(response.latency == shared);
      for (uint32_t bin = 1; bin < kFftSize / 2; ++bin) {
        const double frequency = static_cast<double>(bin) * rate / kFftSize;
        if (frequency < 20 || frequency > 20000) continue;
        const double before = std::hypot(reference.real[bin], reference.imaginary[bin]);
        const double after = std::hypot(response.real[bin], response.imaginary[bin]);
        largest = std::max(largest, std::abs(20 * std::log10(after / before)));
        positive = std::max(positive, 20 * std::log10(before));
        if (mode == 3) phase_error = std::max(phase_error, std::abs(std::remainder(
            std::atan2(response.imaginary[bin], response.real[bin]) +
            2 * kPi * bin * response.latency / kFftSize, 2 * kPi)));
      }
    }
  }
  std::printf("phase: magnitude error %.8f dB, phase residual %.8g, boost %.4f dB\n", largest, phase_error, positive);
  CHECK(largest < 0.1);
  CHECK(phase_error < 0.01);
  CHECK(positive > 6);
}

void minimum_keeps_original_filters_and_custom_is_not_rephased() {
  auto tagged = correction();
  auto original = tagged;
  for (auto& band : original.bands) { band.user_eq = false; band.curve_layer = false; }
  auto selected = original;
  selected.minimum_eq_phase = false;
  selected.minimum_curve_phase = false;
  Graph before(original, kRate, 1, kBlock);
  Graph after(tagged, kRate, 1, kBlock);
  Graph custom(selected, kRate, 1, kBlock);
  std::vector<std::vector<float>> input{tone(1000, 0.05, kRate, 0)};
  auto normal = input;
  auto untouched = input;
  run_blocks(before, input, kBlock);
  run_blocks(after, normal, kBlock);
  run_blocks(custom, untouched, kBlock);
  CHECK(input == normal);
  CHECK(input == untouched);
  CHECK(custom.latency_frames() == 0);
  CHECK(rms_db(input[0], kRate / 2, kRate) > -30);
}

void sampled_curves_keep_magnitude_but_change_phase() {
  Chain chain;
  chain.matched = true;
  chain.graphic_curves = {
    {{20, 2}, {1000, 0}, {20000, -2}},
    {{20, 0}, {100, 4}, {1000, -3}, {5000, 6}, {20000, 0}}
  };
  chain.eq_graphic_curves = {chain.graphic_curves[0]};
  chain.comparison_curves = {chain.graphic_curves[1]};
  chain.minimum_eq_phase = false;
  chain.minimum_curve_phase = false;
  std::vector<std::string> warnings;
  const auto baseline = fluideq_engine::design_graphic_kernel(chain.graphic_curves, kRate, 4097);
  const auto original = fluideq_engine::design_graphic(chain, kRate, warnings);
  CHECK(std::equal(baseline.begin(), baseline.end(), original.samples.begin()));
  const auto reference = measure(chain, kRate);
  double phase_change = 0;
  double largest = 0;
  double positive = 0;
  // Mixed modes only: with some curve still linear the stage keeps the
  // linear design, and switching the other layer changes phase alone.
  for (int mode = 1; mode < 3; ++mode) {
    auto selected = chain;
    selected.minimum_eq_phase = (mode & 1) != 0;
    selected.minimum_curve_phase = (mode & 2) != 0;
    const auto response = measure(selected, kRate);
    CHECK(response.latency == reference.latency);
    for (uint32_t bin = 1; bin < kFftSize / 2; ++bin) {
      const double frequency = static_cast<double>(bin) * kRate / kFftSize;
      if (frequency < 20 || frequency > 20000) continue;
      const double before = std::hypot(reference.real[bin], reference.imaginary[bin]);
      const double after = std::hypot(response.real[bin], response.imaginary[bin]);
      largest = std::max(largest, std::abs(20 * std::log10(after / before)));
      positive = std::max(positive, 20 * std::log10(before));
      phase_change = std::max(phase_change, std::abs(std::remainder(
          std::atan2(response.imaginary[bin], response.real[bin]) -
          std::atan2(reference.imaginary[bin], reference.real[bin]), 2 * kPi)));
    }
  }
  CHECK(largest < 0.05);
  CHECK(positive > 3);
  CHECK(phase_change > 0.1);

  // Every curve minimum phase: one minimum-phase kernel with no delay of its
  // own — only the convolver's partition — that holds the drawn curve at
  // least as closely as the linear design it replaces, which smoothed it.
  auto minimum = chain;
  minimum.minimum_eq_phase = true;
  minimum.minimum_curve_phase = true;
  const auto response = measure(minimum, kRate);
  CHECK(response.latency == feq_convolver_latency());
  double worst_minimum = 0;
  double worst_linear = 0;
  for (uint32_t bin = 1; bin < kFftSize / 2; ++bin) {
    const double frequency = static_cast<double>(bin) * kRate / kFftSize;
    if (frequency < 30 || frequency > 16000) continue;
    const double wanted = drawn_db(chain.graphic_curves, frequency);
    worst_minimum = std::max(worst_minimum, std::abs(20 * std::log10(
        std::hypot(response.real[bin], response.imaginary[bin])) - wanted));
    worst_linear = std::max(worst_linear, std::abs(20 * std::log10(
        std::hypot(reference.real[bin], reference.imaginary[bin])) - wanted));
  }
  std::printf("graphic curves off the drawn line: minimum phase %.3f dB, "
              "linear design %.3f dB\n", worst_minimum, worst_linear);
  CHECK(worst_minimum <= worst_linear + 0.01);
  CHECK(worst_minimum < 0.5);
}

void switching_never_drops_a_noise_block() {
  auto chain = correction();
  auto current = std::make_unique<Graph>(chain, kRate, 2, kBlock);
  double minimum_rms = 1;
  uint32_t seed = 123456;
  for (uint32_t block = 0; block < 1200; ++block) {
    if (block == 200 || block == 210 || block == 220 || block == 400 || block == 600 || block == 800) {
      chain.minimum_eq_phase = block == 210 || block == 400 || block == 800;
      chain.minimum_curve_phase = block < 600;
      auto next = std::make_unique<Graph>(chain, kRate, 2, kBlock);
      next->request_state_transfer();
      next->adopt_state(current.get());
      current = std::move(next);
    }
    std::vector<float> left(kBlock);
    for (auto& sample : left) {
      seed = seed * 1664525u + 1013904223u;
      sample = static_cast<float>((static_cast<double>(seed) / 4294967296.0 - 0.5) * 0.04);
    }
    auto right = left;
    float* planes[] = {left.data(), right.data()};
    current->process(planes, kBlock);
    CHECK(left == right);
    double power = 0;
    for (const float sample : left) power += sample * sample;
    minimum_rms = std::min(minimum_rms, std::sqrt(power / kBlock));
  }
  CHECK(std::isfinite(minimum_rms) && minimum_rms > 0.001);
}

void switching_latency_explains_the_repeat_without_a_permanent_minimum_delay() {
  Chain chain;
  chain.matched = true;
  chain.bands = {{FilterType::PK, 1000, 0, 2, true, false}};
  Graph minimum(chain, kRate, 1, kBlock);
  chain.minimum_eq_phase = false;
  Graph linear(chain, kRate, 1, kBlock);
  linear.request_state_transfer();
  linear.adopt_state(&minimum);
  const uint32_t pulse_at = 30000;
  std::vector<std::vector<float>> samples(1, std::vector<float>(kRate * 2));
  samples[0][pulse_at] = 0.1f;
  run_blocks(linear, samples, kBlock);
  CHECK(minimum.latency_frames() == 0);
  CHECK(linear.latency_frames() > kRate / 3);
  CHECK(std::abs(samples[0][pulse_at] - 0.1f) < 1e-6f);
  CHECK(std::abs(samples[0][pulse_at + linear.latency_frames()] - 0.1f) < 1e-6f);
  CHECK(std::abs(samples[0].back()) < 1e-6f);
}

/**
 * The curves leaving linear phase while Your EQ stays in it: the delay they
 * shared stays, and a click already inside the FIR when the switch lands
 * comes out once, at that delay — not early, which is what moving the FIR
 * in the chain would have done, and not twice.
 */
void a_layer_leaving_linear_keeps_the_shared_delay() {
  auto chain = correction();
  chain.minimum_eq_phase = false;
  chain.minimum_curve_phase = false;
  auto both = std::make_unique<Graph>(chain, kRate, 1, kBlock);
  chain.minimum_curve_phase = true;
  auto eq_only = std::make_unique<Graph>(chain, kRate, 1, kBlock);
  const uint32_t delay = both->latency_frames();
  CHECK(delay > kRate / 3);
  CHECK(eq_only->latency_frames() == delay);
  const uint32_t click_at = kRate;
  const uint32_t switch_at = click_at + 20 * kBlock;
  std::vector<float> out(click_at + delay + kRate / 2);
  std::vector<float> block(kBlock);
  float* planes[] = {block.data()};
  Graph* current = both.get();
  for (uint32_t frame = 0; frame + kBlock <= out.size(); frame += kBlock) {
    if (frame == switch_at) {
      eq_only->request_state_transfer();
      eq_only->adopt_state(both.get());
      current = eq_only.get();
    }
    std::fill(block.begin(), block.end(), 0.0f);
    if (frame <= click_at && click_at < frame + kBlock) block[click_at - frame] = 0.1f;
    current->process(planes, kBlock);
    std::copy(block.begin(), block.end(), out.begin() + frame);
  }
  const auto energy = [&](uint32_t from, uint32_t to) {
    double sum = 0;
    for (uint32_t at = from; at < to; ++at) sum += static_cast<double>(out[at]) * out[at];
    return sum;
  };
  const double early = energy(click_at - kRate / 10, click_at + kRate / 5);
  const double on_time = energy(click_at + delay - kRate / 10, click_at + delay + kRate / 10);
  std::printf("shared delay: %u frames; click energy early %.3g, on time %.3g\n",
              delay, early, on_time);
  CHECK(on_time > 1e-4);
  CHECK(early < on_time * 1e-4);
}

void impossible_linear_design_falls_back_and_reports_it() {
  Chain chain;
  chain.matched = true;
  chain.minimum_eq_phase = false;
  chain.bands = {{FilterType::PK, 20, 20, 100, true, false}};
  Graph graph(chain, kRate, 1, kBlock);
  CHECK(mentions(graph.problems(), "eq-phase"));
  CHECK(graph.latency_frames() == 0);
  CHECK(!graph.is_passthrough());
  std::vector<std::vector<float>> audio{tone(20, 0.001, kRate * 4, 0)};
  const auto before = audio[0];
  run_blocks(graph, audio, kBlock);
  CHECK(rms_db(audio[0], kRate * 3, kRate * 4) > rms_db(before, kRate * 3, kRate * 4) + 3);
}

void nonfinite_history_recovers_on_clean_audio() {
  auto chain = correction();
  chain.minimum_eq_phase = false;
  Graph graph(chain, kRate, 1, kBlock);
  std::vector<std::vector<float>> clean{tone(1000, 0.01, kRate * 2, 0)};
  run_blocks(graph, clean, kBlock);
  float bad[kBlock]{};
  bad[0] = std::numeric_limits<float>::quiet_NaN();
  float* planes[] = {bad};
  graph.process(planes, kBlock);
  clean = {tone(1000, 0.01, kRate * 3, 0)};
  run_blocks(graph, clean, kBlock);
  CHECK(std::all_of(clean[0].begin(), clean[0].end(), [](float sample) { return std::isfinite(sample); }));
  CHECK(rms_db(clean[0], kRate * 2, kRate * 3) > -50);
}

}

int main() {
  Chain eq_scope;
  eq_scope.eq_graphic_curves = {{{20, 4}, {20000, 0}}};
  eq_scope.graphic_curves = eq_scope.eq_graphic_curves;
  Chain curve_scope = eq_scope;
  curve_scope.comparison_curves = curve_scope.eq_graphic_curves;
  curve_scope.eq_graphic_curves.clear();
  CHECK(fluideq_engine::signature_of(eq_scope) != fluideq_engine::signature_of(curve_scope));
  CHECK(fluideq_engine::signature_of(eq_scope) == fluideq_engine::signature_of(eq_scope));
  parametric_phase_preserves_tuning();
  minimum_keeps_original_filters_and_custom_is_not_rephased();
  sampled_curves_keep_magnitude_but_change_phase();
  switching_never_drops_a_noise_block();
  switching_latency_explains_the_repeat_without_a_permanent_minimum_delay();
  a_layer_leaving_linear_keeps_the_shared_delay();
  impossible_linear_design_falls_back_and_reports_it();
  nonfinite_history_recovers_on_clean_audio();
  return report();
}
