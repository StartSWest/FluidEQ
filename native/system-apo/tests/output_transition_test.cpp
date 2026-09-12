#include "fluideq_engine/graph.h"
#include "graph_test_support.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <filesystem>
#include "wav_fixture.h"

using namespace fluideq_engine_test;
using fluideq_engine::Graph;

void smoothing_keeps_history() {
  for (const uint32_t block : {127u, 480u, 512u}) {
    auto running = std::make_unique<Graph>(chain_from("Preamp: 0 dB\n# FluidEQCurveStage: ON\n"), kRate, 2, block);
    std::vector<std::vector<float>> warm(2, tone(1000, 0.2, kRate, 0));
    run_blocks(*running, warm, block);
    uint32_t position = kRate;
    for (const char* curve : {"GraphicEQ: 20 -6; 20000 -6\n", "", "GraphicEQ: 20 -3; 20000 -3\n", ""}) {
      const auto chain = chain_from(std::string("Preamp: 0 dB\n# FluidEQCurveStage: ON\n") + curve);
      auto next = std::make_unique<Graph>(chain, kRate, 2, block);
      Graph cold(chain, kRate, 2, block);
      CHECK(next->latency_frames() == running->latency_frames());
      next->request_state_transfer();
      next->adopt_state(running.get());
      running.reset();
      std::vector<std::vector<float>> audio(2, tone(1000, 0.2, block * 30, position));
      auto control = audio;
      run_blocks(cold, control, block);
      run_blocks(*next, audio, block);
      CHECK(rms_db(control[0], 0, 127) < -60);
      for (uint32_t offset = 0; offset < audio[0].size(); offset += block) {
        CHECK(rms_db(audio[0], offset, offset + block) > -28);
      }
      CHECK(audio[0] == audio[1]);
      position += block * 30;
      running = std::move(next);
    }
  }
}

void guard_follows_final_samples() {
  const auto chain = chain_from("Filter: ON PK Fc 1000 Hz Gain 12 dB Q 2\n"
      "GraphicEQ: 20 6; 20000 6\nPreamp: -18 dB\n# FluidEQAutoPreamp: ON\n");
  CHECK(chain.auto_preamp && chain.output_guard);
  CHECK(chain.preamp_db == 0);
  Graph graph(chain, kRate, 2, 480);
  auto unprotected = chain;
  unprotected.output_guard = false;
  Graph control(unprotected, kRate, 2, 480);
  std::vector<std::vector<float>> audio(2, tone(1000, 0.5, kRate, 0));
  auto raw = audio;
  run_blocks(graph, audio, 480);
  run_blocks(control, raw, 480);
  float peak = 0, raw_peak = 0;
  for (const float sample : audio[0]) peak = std::max(peak, std::abs(sample));
  for (const float sample : raw[0]) raw_peak = std::max(raw_peak, std::abs(sample));
  CHECK(raw_peak > 3);
  CHECK(peak <= 0.93f);
  CHECK(peak > 0.75f);
  CHECK(graph.auto_preamp_gain_db() < -10);
  CHECK(audio[0] == audio[1]);
  const double held = graph.auto_preamp_gain_db();
  Graph next(chain, kRate, 2, 480);
  next.request_state_transfer();
  next.adopt_state(&graph);
  CHECK(std::abs(next.auto_preamp_gain_db() - held) < 1e-6);
  std::vector<std::vector<float>> quiet(2, tone(1000, 0.005, kRate * 8, kRate));
  run_blocks(next, quiet, 480);
  CHECK(next.auto_preamp_gain_db() > held);
  CHECK(next.auto_preamp_gain_db() < held + 0.6);
  std::vector<std::vector<float>> recovery(2, tone(1000, 0.005, kRate * 160, 0));
  run_blocks(next, recovery, 480);
  CHECK(next.auto_preamp_gain_db() > -0.1);
  const auto manual = chain_from("Preamp: -7 dB\n# FluidEQAutoPreamp: OFF\n");
  CHECK(manual.output_guard && !manual.auto_preamp && manual.preamp_db == -7);
}

void guard_follows_impulse_response() {
  const auto path = std::filesystem::temp_directory_path() / "fluideq-final-guard-ir.wav";
  CHECK(write_float_wav(path, kRate, {4.0f}));
  const auto chain = chain_from("Convolution: " + path.string() +
      "\nPreamp: 0 dB\n# FluidEQAutoPreamp: ON\n");
  Graph protected_graph(chain, kRate, 2, 480);
  auto raw_chain = chain;
  raw_chain.output_guard = false;
  Graph raw_graph(raw_chain, kRate, 2, 480);
  std::vector<std::vector<float>> protected_audio(2, tone(1000, 0.5, kRate, 0));
  auto raw_audio = protected_audio;
  run_blocks(protected_graph, protected_audio, 480);
  run_blocks(raw_graph, raw_audio, 480);
  float raw_peak = 0, protected_peak = 0;
  for (const float sample : raw_audio[0]) raw_peak = std::max(raw_peak, std::abs(sample));
  for (const float sample : protected_audio[0]) protected_peak = std::max(protected_peak, std::abs(sample));
  CHECK(raw_peak > 1.9f);
  CHECK(protected_peak > 0.75f && protected_peak < 0.93f);
  CHECK(protected_audio[0] == protected_audio[1]);
  std::filesystem::remove(path);
}

void actual_eq_edits_reassess_quickly() {
  for (const bool curve : {false, true}) {
    for (const bool changed : {false, true}) {
      const std::string prefix = "Preamp: 0 dB\n# FluidEQAutoPreamp: ON\n";
      const std::string raised = curve ? "GraphicEQ: 20 20; 20000 20\n"
          : "Filter: ON PK Fc 60 Hz Gain 20 dB Q 2\n";
      const std::string fixed = curve ? "GraphicEQ: 20 0; 20000 0\n"
          : "Filter: ON PK Fc 60 Hz Gain 0 dB Q 2\n";
      Graph previous(chain_from(prefix + raised), kRate, 2, 480);
      std::vector<std::vector<float>> loud(2, tone(60, 0.4, kRate * 3, 0));
      run_blocks(previous, loud, 480);
      const double held = previous.auto_preamp_gain_db();
      CHECK(held < -10);
      Graph next(chain_from(prefix + (changed ? fixed : raised)), kRate, 2, 480);
      next.request_state_transfer();
      next.adopt_state(&previous);
      CHECK(std::abs(next.auto_preamp_gain_db() - held) < 1e-6);
      std::vector<std::vector<float>> audio(2, tone(60, changed ? 0.4 : 0.01, kRate * 2, kRate * 3));
      run_blocks(next, audio, 480);
      if (changed) {
        CHECK(next.auto_preamp_gain_db() > held + 1.0);
        CHECK(next.auto_preamp_gain_db() < held + 2.2);
        std::vector<std::vector<float>> recovered(2, tone(60, 0.4, kRate * 22, 0));
        run_blocks(next, recovered, 480);
        CHECK(next.auto_preamp_gain_db() > -0.1);
        CHECK(rms_db(recovered[0], kRate * 21, kRate * 22) > -12);
      } else {
        CHECK(std::abs(next.auto_preamp_gain_db() - held) < 0.1);
      }
      CHECK(*std::max_element(audio[0].begin(), audio[0].end()) < 0.94f);
    }
  }
}
int main() {
  smoothing_keeps_history();
  guard_follows_final_samples();
  guard_follows_impulse_response();
  actual_eq_edits_reassess_quickly();
  return report();
}
