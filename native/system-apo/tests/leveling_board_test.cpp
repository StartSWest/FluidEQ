/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's side of song leveling: the programme file the app writes, the
 * memory each output keeps across locks, and the finished song it reports.
 * The file's text is pinned against `src/main/songProgramme.ts`, which writes
 * it — a key spelled differently on one side levels every song as unknown.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "../src/leveling_board.h"
#include "../src/programme.h"
#include "dsp_chain_fixture.h"
#include "fluideq_engine/graph.h"
#include "graph_test_support.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine::Leveling;
using fluideq_engine::Programme;
using fluideq_engine::leveling_for;
using fluideq_engine::parse_programme;
using fluideq_engine_test::chain_with;
using fluideq_engine_test::kNormalizerModeFromEnd;
using fluideq_engine_test::reference_values;
using fluideq_engine_test::report;

namespace {

constexpr uint32_t kBlock = 480;

void the_programme_file() {
  std::printf("the programme file the app writes\n");
  // The exact text `formatSongProgramme` produces for a remembered song.
  const Programme known = parse_programme(
      "# FluidEQ Engine programme v1\r\nsong=00000000000a11ce\r\n"
      "level=-11.84\r\npeak=-0.62\r\n");
  CHECK(known.song_id == 0xa11ce);
  CHECK(std::fabs(known.level_lufs + 11.84) < 1e-9);
  CHECK(std::fabs(known.peak_db + 0.62) < 1e-9);

  const Programme unheard =
      parse_programme("# FluidEQ Engine programme v1\r\nsong=ffffffffffffffff\r\n");
  CHECK(unheard.song_id == 0xffffffffffffffffULL);
  CHECK(unheard.level_lufs < -100 && unheard.peak_db < -100);

  CHECK(parse_programme("# FluidEQ Engine programme v1\r\n").song_id == 0);
  // A wrong identity would level one song at another's loudness, so anything
  // that is not exactly sixteen hex digits names no song at all.
  CHECK(parse_programme("song=a11ce\r\nlevel=-11\r\n").song_id == 0);
  CHECK(parse_programme("song=00000000000a11cez\r\n").song_id == 0);
  CHECK(parse_programme("song=0000000000000000\r\n").song_id == 0);
  CHECK(parse_programme("song=00000000000a11ce\r\nlevel=-11,84\r\n").level_lufs < -100);
  CHECK(parse_programme("song=00000000000a11ce\r\nlevel=40\r\n").level_lufs < -100);
  // A peak alone is half a measurement.
  CHECK(parse_programme("song=00000000000a11ce\r\npeak=-1\r\n").peak_db < -100);
}

void one_memory_per_output() {
  std::printf("one leveling memory per output, shared by its instances\n");
  const auto first = leveling_for(L"{947B0242-A1CF-4483-A44E-B72DA462C901}");
  const auto again = leveling_for(L"{947B0242-A1CF-4483-A44E-B72DA462C901}");
  const auto other = leveling_for(L"{00000000-0000-0000-0000-000000000001}");
  CHECK(first != nullptr && first->memory() != nullptr);
  CHECK(first == again);
  CHECK(first != other);
  CHECK(leveling_for(L"") != leveling_for(L""));
}

/** A stereo tone through live leveling alone. */
void play(FeqLiveNormalizer* leveler, double seconds, double amplitude) {
  std::vector<float> left(kBlock), right(kBlock);
  FeqNormalizerSettings settings{2, -1, -14};
  const auto blocks = static_cast<int>(seconds * 48000 / kBlock);
  for (int block = 0; block < blocks; ++block) {
    for (uint32_t at = 0; at < kBlock; ++at) {
      left[at] = right[at] = static_cast<float>(
          amplitude * std::sin(6.283185307179586 * 1000 * static_cast<double>(block * kBlock + at) / 48000));
    }
    float* planes[2] = {left.data(), right.data()};
    feq_live_normalizer_process(leveler, planes, kBlock, &settings);
  }
}

void a_finished_song_is_reported_once() {
  std::printf("announcing songs, and the song each announcement finished\n");
  Leveling leveling;
  const auto memory = leveling.memory();
  const std::unique_ptr<FeqLiveNormalizer, void (*)(FeqLiveNormalizer*)> leveler(
      feq_live_normalizer_create(48000, 2), feq_live_normalizer_destroy);
  feq_live_normalizer_attach_memory(leveler.get(), memory.get());

  Programme song_a;
  song_a.song_id = 0xa11ce;
  CHECK(!leveling.announce(song_a));  // Nothing had been learned before it.
  play(leveler.get(), 40, 0.2);
  CHECK(!leveling.announce(song_a));  // The same song, from another instance.
  CHECK(!leveling.last_song());

  const Programme untitled;  // The player stopped naming it for a moment.
  CHECK(leveling.announce(untitled));
  const auto paused = leveling.last_song();
  CHECK(paused && paused->song_id == 0xa11ce);
  play(leveler.get(), 1, 0.2);
  CHECK(!leveling.announce(song_a));  // And named it again: nothing ended.

  Programme song_b;
  song_b.song_id = 0xb0b;
  CHECK(leveling.announce(song_b));
  const auto finished = leveling.last_song();
  CHECK(finished && finished->song_id == 0xa11ce);
  CHECK(finished && finished->level_lufs > -20 && finished->level_lufs < -12);
  CHECK(finished && finished->seconds > 30);
}

/** The loudest sample of the last block `blocks` of a quiet tone came out at. */
double level_after(Graph& graph, int blocks) {
  std::vector<float> left(kBlock), right(kBlock);
  double peak = 0;
  for (int block = 0; block < blocks; ++block) {
    for (uint32_t at = 0; at < kBlock; ++at) {
      left[at] = right[at] = static_cast<float>(
          0.02 * std::sin(6.283185307179586 * 1000 * static_cast<double>(block * kBlock + at) / 48000));
    }
    float* planes[2] = {left.data(), right.data()};
    graph.process(planes, kBlock);
    peak = 0;
    for (const float sample : left) peak = std::max(peak, std::fabs(static_cast<double>(sample)));
  }
  return peak;
}

void a_graph_for_a_new_lock_resumes_the_output_s_level() {
  std::printf("a graph built when Windows locks the output again resumes its level\n");
  std::vector<double> values = reference_values();
  values[values.size() - kNormalizerModeFromEnd] = 2;  // Loudness.
  const Chain chain = chain_with(values);
  Leveling leveling;
  double learned = 0;
  {
    Graph first(chain, 48000, 2, kBlock, leveling.memory());
    learned = level_after(first, 6000);  // A minute of a quiet source.
  }
  Graph forgetful(chain, 48000, 2, kBlock);
  const double fresh = level_after(forgetful, 300);
  // Positive control: leveling did raise the quiet source, so the level a
  // fresh chain starts from is audibly lower than the one it learned.
  CHECK(learned > fresh * 1.5);

  Graph relocked(chain, 48000, 2, kBlock, leveling.memory());
  const double resumed = level_after(relocked, 300);
  CHECK(std::fabs(resumed - learned) < learned * 0.05);
}

}  // namespace

int main() {
  std::printf("fluideq engine song leveling\n");
  the_programme_file();
  one_memory_per_output();
  a_finished_song_is_reported_once();
  a_graph_for_a_new_lock_resumes_the_output_s_level();
  return report();
}
