/* FluidEQ — GPL-3.0-or-later */

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "../src/input_history.h"
#include "../src/source_analysis.h"
#include "../src/split_tap.h"
#include "dsp_chain_fixture.h"
#include "graph_test_support.h"

using namespace fluideq_engine;
using namespace fluideq_engine_test;

namespace {

constexpr uint32_t kFrames = 480;
constexpr int64_t kTicks = 10'000'000;
const Endpoint kMain{L"{41414141-1111-2222-3333-444455556666}", L"Main"};
const Endpoint kSecond{L"{42424242-1111-2222-3333-444455556666}", L"Second"};
const Endpoint kThird{L"{43434343-1111-2222-3333-444455556666}", L"Third"};
const std::string kRoute =
    "# main {41414141-1111-2222-3333-444455556666}\n"
    "{41414141-1111-2222-3333-444455556666} "
    "{42424242-1111-2222-3333-444455556666} 0.5\n"
    "{41414141-1111-2222-3333-444455556666} "
    "{43434343-1111-2222-3333-444455556666} 1\n";

Chain normalized_chain(double target, const std::string& config) {
  Chain chain = chain_from(config);
  chain.dsp_values = reference_values();
  chain.dsp_values[kExciterEnabled] = 0;
  chain.dsp_values[chain.dsp_values.size() - 3] = 2;
  chain.dsp_values.back() = target;
  return chain;
}

struct Audio {
  std::array<float, kFrames * 2> raw{};
  std::array<float, kFrames> left{};
  std::array<float, kFrames> right{};
  float* planes[2] = {left.data(), right.data()};

  void fill(uint32_t block, double amplitude) {
    for (uint32_t at = 0; at < kFrames; ++at) {
      const float sample = static_cast<float>(amplitude * std::cos(
          2 * kPi * 1000 * (block * kFrames + at) / kRate));
      left[at] = right[at] = sample;
      raw[2 * at] = raw[2 * at + 1] = sample;
    }
  }

  void render(SplitTap& tap, Graph& graph, int64_t ticks) {
    tap.begin();
    tap.write(raw.data(), kFrames, ticks);
    if (tap.reading()) tap.mix(planes, kFrames, ticks);
    graph.process(planes, kFrames);
    if (tap.reading()) tap.trim_output(planes, kFrames);
  }

  double energy() const {
    double result = 0;
    for (float sample : left) result += sample * sample;
    return result;
  }
};

void receivers_process_raw_audio_with_their_own_racks_and_curves() {
  std::printf("receivers own normalization, curves, histories and final trim\n");
  SourceAnalysis facts;
  facts.library = true;
  facts.source = 123;
  facts.epoch = 1;
  facts.revision = 1;
  facts.endpoint = kMain.guid;
  facts.has_level = true;
  facts.level = -18;
  facts.peak = -10;
  const auto second_facts = source_for_endpoint(facts, kSecond, kMain.guid, true);
  const auto third_facts = source_for_endpoint(facts, kThird, kMain.guid, true);
  CHECK(second_facts.library && third_facts.library);
  const auto main_chain = normalized_chain(-24, "Preamp: -30 dB\n");
  const auto second_chain = normalized_chain(-12, "GraphicEQ: 20 -3; 20000 -3\n");
  const auto third_chain = normalized_chain(-24, "Preamp: -3 dB\n");
  Graph main(main_chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &facts);
  Graph second(second_chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &second_facts);
  Graph third(third_chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &third_facts);
  CHECK(main.source_report().ready && second.source_report().ready && third.source_report().ready);
  CHECK(!main.rack_is_shared_with(second) && !second.rack_is_shared_with(third));
  auto history_main = std::make_shared<InputHistory>(kRate, 2, 1);
  auto history_second = std::make_shared<InputHistory>(kRate, 2, 1);
  auto history_third = std::make_shared<InputHistory>(kRate, 2, 1);
  main.own_history(history_main);
  second.own_history(history_second);
  third.own_history(history_third);
  SplitTap source(kMain.guid, kRate, 2, 3, true, kTicks);
  SplitTap receiver(kSecond.guid, kRate, 2, 3, true, kTicks);
  SplitTap another(kThird.guid, kRate, 2, 3, true, kTicks);
  source.follow(kRoute, true);
  receiver.follow(kRoute, true);
  another.follow(kRoute, true);
  Audio a;
  Audio b;
  Audio c;
  double main_energy = 0;
  double second_energy = 0;
  double third_energy = 0;
  const auto source_latency = main.latency_frames();
  for (uint32_t block = 0; block < 200; ++block) {
    const int64_t ticks = block * kTicks / 100;
    a.fill(block, 0.05);
    b.fill(block, 0);
    c.fill(block, 0);
    a.render(source, main, ticks);
    // Kernels are prepared on the watcher, never by main's callback.
    if (block == 1) {
      receiver.follow(kRoute, true);
      another.follow(kRoute, true);
    }
    b.render(receiver, second, ticks + kTicks / 300);
    c.render(another, third, ticks + kTicks / 300);
    if (block >= 150) {
      main_energy += a.energy();
      second_energy += b.energy();
      third_energy += c.energy();
    }
  }
  // The shared scan asks +6 dB on Second and -6 on Third. Their curves each
  // remove 3 dB; Second's post-rack half-volume then removes 6.0206 dB.
  const double difference = 10 * std::log10(second_energy / third_energy);
  std::printf("  receiver difference %.4f dB; main unchanged at %u frames\n",
              difference, source_latency);
  CHECK(std::fabs(difference - 5.9794) < 0.08);
  CHECK(third_energy > main_energy * 400);
  CHECK(main.latency_frames() == source_latency);
  CHECK(second.latency_frames() > third.latency_frames());
  const auto second_status = receiver.report();
  const auto third_status = another.report();
  CHECK(second_status && third_status && second_status->lag_us == third_status->lag_us);
  CHECK(second_status && second_status->lag_us > 12000 && second_status->lag_us < 14000);
  CHECK(history_main->written() == 200 * kFrames);
  CHECK(history_second->written() == 200 * kFrames);
  CHECK(history_third->written() == 200 * kFrames);
  std::vector<std::vector<float>> second_samples;
  std::vector<std::vector<float>> third_samples;
  history_second->copy(180 * kFrames, 190 * kFrames, second_samples);
  history_third->copy(180 * kFrames, 190 * kFrames, third_samples);
  CHECK(second_samples.size() == 2 && third_samples.size() == 2);
  if (second_samples.size() == 2 && third_samples.size() == 2) {
    CHECK(std::fabs(rms_db(second_samples[0], 0, 10 * kFrames) -
                    rms_db(third_samples[0], 0, 10 * kFrames) - 12) < 0.02);
  }
}

void metadata_reuses_only_the_same_outputs_processing() {
  std::printf("metadata reuses an output rack; source facts and epochs replace it\n");
  SourceAnalysis source;
  source.library = true;
  source.source = 123;
  source.epoch = 1;
  source.revision = 1;
  source.has_level = true;
  source.level = -20;
  source.peak = -10;
  const auto chain = normalized_chain(-14, "Preamp: -3 dB\n");
  Graph before(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &source);
  source.revision = 2;
  source.endpoint = kThird.guid;
  Graph metadata(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, &before, &source);
  CHECK(metadata.rack_is_shared_with(before));
  CHECK(metadata.source_report().revision == 2);
  source.level = -30;
  Graph measured(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, &metadata, &source);
  CHECK(!measured.rack_is_shared_with(metadata));
  source.epoch = 2;
  Graph seek(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, &measured, &source);
  CHECK(!seek.rack_is_shared_with(measured));
}

void room_and_host_ownership_are_acknowledged_truthfully() {
  std::printf("requested Room must be prepared before a raw Library handoff\n");
  SourceAnalysis source;
  source.library = true;
  source.source = 123;
  auto chain = normalized_chain(-14, "Preamp: -3 dB\n");
  chain.dsp_values[kRoomEnabled] = 1;
  Graph missing_head(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &source);
  CHECK(!missing_head.source_report().ready);
  CHECK(mentions(missing_head.warnings(), "Room"));
  source.engine_owner = false;
  Graph hosted(chain, kRate, 2, kFrames, nullptr, 3, nullptr, false, nullptr, &source);
  CHECK(hosted.source_report().ready && !hosted.source_report().engine_owner);
  CHECK(hosted.latency_frames() == 0);
  Audio audio;
  audio.fill(0, 0.1);
  hosted.process(audio.planes, kFrames);
  CHECK(std::fabs(audio.left[0] - 0.07079458f) < 1e-6f);
}

}  // namespace

int main() {
  receivers_process_raw_audio_with_their_own_racks_and_curves();
  metadata_reuses_only_the_same_outputs_processing();
  room_and_host_ownership_are_acknowledged_truthfully();
  return report();
}
