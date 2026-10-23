/* FluidEQ — GPL-3.0-or-later */
#include <unistd.h>

#include <cmath>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "engine.h"
#include "posix_path.h"
#include "dsp_chain_fixture.h"

using fluideq_engine_test::report;

namespace {

struct Configuration {
  std::filesystem::path root;
  Configuration() {
    std::string pattern =
        (std::filesystem::temp_directory_path() / "fluideq-mac-test-XXXXXX").string();
    const char* made = ::mkdtemp(pattern.data());
    if (made == nullptr) throw std::runtime_error("could not create test config");
    root = made;
  }
  ~Configuration() { std::filesystem::remove_all(root); }
  void write(const std::string& name, const std::string& text) const {
    std::ofstream file(root / name);
    file << text;
    if (!file) throw std::runtime_error("could not write test config");
  }
};

constexpr const char* kIdA = "aaaaaaaa-1111-2222-3333-444455556666";
constexpr const char* kIdB = "bbbbbbbb-1111-2222-3333-444455556666";
const fluideq_engine::Endpoint kA{L"{AAAAAAAA-1111-2222-3333-444455556666}", L"A"};
const fluideq_engine::Endpoint kB{L"{BBBBBBBB-1111-2222-3333-444455556666}", L"B"};
constexpr fluideq_mac::EngineFormat kFormat{48000, 480};

std::string head() {
  std::string text = "# FluidEQ room head v1 medium\nrate 48000 directions 24 taps 8\n";
  for (int direction = 0; direction < 24; ++direction) {
    text += "1 0 0 0 0 0 0 0 0.5 0 0 0 0 0 0 0\n";
  }
  return text;
}

void room_heads_belong_to_the_output() {
  Configuration config;
  auto values = fluideq_engine_test::reference_values();
  values[fluideq_engine_test::kRoomEnabled] = 1;
  const auto rack = fluideq_engine_test::dsp_file(fluideq_engine_test::join(values));
  config.write(std::string("fluideq-dsp-") + kIdA + ".txt", rack);
  config.write(std::string("fluideq-dsp-") + kIdB + ".txt", rack);
  config.write(std::string("fluideq-room-head-") + kIdA + ".txt", head());
  // A global head and another output's head cannot fill in a missing head.
  config.write("fluideq-room-head.txt", head());
  fluideq_mac::Engine engine(fluideq_engine::wide_path(config.root.string()), nullptr);
  CHECK(engine.reload(kA, kFormat).processing);
  CHECK(engine.facts().room != "no-head" && engine.facts().room != "off");
  CHECK(!engine.reload(kA, kFormat).rebuilt);
  engine.release_all();
  engine.reload(kB, kFormat);
  CHECK(engine.facts().room == "no-head");
  // Publishing B's head wakes and rebuilds B, without an unrelated EQ edit.
  config.write(std::string("fluideq-room-head-") + kIdB + ".txt", head());
  CHECK(engine.reload(kB, kFormat).rebuilt);
  CHECK(engine.facts().room != "no-head" && engine.facts().room != "off");
}

void songs_follow_the_output_without_rebuilding_its_graph() {
  Configuration config;
  config.write("config.txt", "Device: all\nPreamp: -6 dB\n");
  config.write(std::string("fluideq-programme-") + kIdA + ".txt",
               "song=00000000000a11ce\n");
  config.write("fluideq-programme.txt", "song=000000000000dead\n");
  fluideq_mac::Engine engine(fluideq_engine::wide_path(config.root.string()), nullptr);
  CHECK(engine.reload(kA, kFormat).processing);
  // Learn through the same per-output memory as the real engine, so the
  // reported identity proves which file the Mac reader actually announced.
  auto memory = fluideq_engine::leveling_for(kA.guid)->memory();
  const std::unique_ptr<FeqLiveNormalizer, void (*)(FeqLiveNormalizer*)> leveler(
      feq_live_normalizer_create(48000, 2), feq_live_normalizer_destroy);
  feq_live_normalizer_attach_memory(leveler.get(), memory.get());
  const FeqNormalizerSettings settings{2, -1, -14};
  std::vector<float> left(480), right(480);
  float* planes[2] = {left.data(), right.data()};
  for (int block = 0; block < 4000; ++block) {
    for (int frame = 0; frame < 480; ++frame) {
      left[frame] = right[frame] = static_cast<float>(
          0.2 * std::sin(6.283185307179586 * 1000 * (block * 480 + frame) / 48000));
    }
    feq_live_normalizer_process(leveler.get(), planes, 480, &settings);
  }
  config.write(std::string("fluideq-programme-") + kIdA + ".txt",
               "song=0000000000000b0b\n");
  const auto changed = engine.reload(kA, kFormat);
  CHECK(!changed.rebuilt && changed.finished_song);
  CHECK(engine.last_song() && engine.last_song()->song_id == 0xa11ce);
  CHECK(engine.last_song() && engine.last_song()->seconds > 30);
}

}  // namespace

int main() {
  room_heads_belong_to_the_output();
  songs_follow_the_output_without_rebuilding_its_graph();
  return report();
}
