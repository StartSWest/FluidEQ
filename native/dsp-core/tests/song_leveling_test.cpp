/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
/*
 * Live leveling that knows which song is playing: the level a loud passage
 * leaves is kept for the rest of the song, the next song keeps it unless it is
 * much quieter, a song heard before is levelled from its first second, and
 * none of that is lost when Windows hands the output a new chain.
 */
#include "fluideq/leveling_memory.h"
#include "fluideq/live_normalizer.h"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <vector>

namespace {
int failures = 0;
void check(bool valid, const char* label) {
  std::printf("%s %s\n", valid ? "PASS" : "FAIL", label);
  if (!valid) ++failures;
}

constexpr double kRate = 48000;
constexpr uint32_t kBlock = 480;
// Stereo 1 kHz tones, the right channel at half the left: 0.04 measures about
// -30 LUFS, 0.2 about -16, 0.5 about -8.
constexpr double kVerse = 0.04, kChorus = 0.2, kLoud = 0.5, kQuiet = 0.01;

struct Leveler {
  FeqLiveNormalizer* processor = feq_live_normalizer_create(kRate, 2);
  FeqNormalizerSettings settings{2, -1, -14};
  FeqLiveNormalizerReading reading{};
  std::vector<float> left = std::vector<float>(kBlock), right = std::vector<float>(kBlock);
  uint64_t position = 0;
  explicit Leveler(FeqLevelingMemory* memory) {
    feq_live_normalizer_attach_memory(processor, memory);
  }
  ~Leveler() { feq_live_normalizer_destroy(processor); }
  Leveler(const Leveler&) = delete;
  Leveler& operator=(const Leveler&) = delete;
  void block(double amplitude) {
    for (uint32_t i = 0; i < kBlock; ++i) {
      left[i] = static_cast<float>(amplitude * std::sin(6.283185307179586 * 1000 *
                                       static_cast<double>(position++) / kRate));
      right[i] = 0.5f * left[i];
    }
    float* planes[2] = {left.data(), right.data()};
    reading = feq_live_normalizer_process(processor, planes, kBlock, &settings);
  }
  void play(double seconds, double amplitude) {
    const auto blocks = static_cast<uint64_t>(std::llround(seconds * kRate / kBlock));
    for (uint64_t at = 0; at < blocks; ++at) block(amplitude);
  }
  double gain() const { return reading.applied_gain_db; }
};

struct Memory {
  FeqLevelingMemory* handle = feq_leveling_memory_create();
  ~Memory() { feq_leveling_memory_destroy(handle); }
  Memory() = default;
  Memory(const Memory&) = delete;
  Memory& operator=(const Memory&) = delete;
};

constexpr uint64_t kSongA = 0xA11CE, kSongB = 0xB0B, kSongC = 0xC0FFEE;

void a_loud_passage_sets_the_level_for_the_rest_of_the_song() {
  Memory memory;
  check(memory.handle != nullptr, "leveling memory can be created");
  Leveler leveler(memory.handle);
  check(feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120) == 1,
        "a first song is an announcement");
  leveler.play(60, kVerse);
  const double verse = leveler.gain();
  check(verse > 5, "positive control: a quiet opening is raised once settled");
  leveler.play(20, kChorus);
  const double chorus = leveler.gain();
  check(chorus < verse - 3, "the loud passage turns the song down");
  leveler.play(90, kVerse);
  check(std::abs(leveler.gain() - chorus) < 0.2,
        "the quiet verse after it keeps the chorus's level instead of rising again");
  FeqSongLevel song{};
  check(feq_leveling_memory_read_song(memory.handle, &song) == 1 && song.song_id == kSongA,
        "what was learned about the song can be read back");
  check(std::abs(song.level_lufs - leveler.reading.reference_lufs) < 0.01 &&
            song.level_lufs > -18 && song.level_lufs < -14,
        "the song is remembered at its loudest settled level, the chorus");
  check(song.foreground_seconds > 60, "and says how much music that was learned from");
}

void the_next_song_keeps_the_level_unless_it_is_much_quieter() {
  Memory memory;
  Leveler leveler(memory.handle);
  feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120);
  leveler.play(40, kChorus);
  const double carried = leveler.gain();
  feq_leveling_memory_begin_song(memory.handle, kSongB, -120, -120);
  leveler.play(60, kChorus * 0.6);
  check(std::abs(leveler.gain() - carried) < 0.2,
        "a slightly quieter next song plays at the level the last one left");

  Memory loud_first;
  Leveler raised(loud_first.handle);
  feq_leveling_memory_begin_song(loud_first.handle, kSongA, -120, -120);
  raised.play(40, kLoud);
  const double lowered = raised.gain();
  check(lowered < -5, "positive control: a loud song is turned down");
  feq_leveling_memory_begin_song(loud_first.handle, kSongC, -120, -120);
  raised.play(15, kVerse);
  check(std::abs(raised.gain() - lowered) < 0.2,
        "a much quieter song is not raised before its opening has been heard");
  raised.play(90, kVerse);
  check(raised.gain() > lowered + 6 && raised.gain() < 3.2,
        "then it is raised, stopping short of what its opening alone asks");
}

void a_song_heard_before_is_levelled_from_its_first_second() {
  Memory memory;
  Leveler known(memory.handle);
  feq_leveling_memory_begin_song(memory.handle, kSongA, -30, -27);
  known.play(4, kVerse);
  check(known.gain() > 5.5, "a remembered quiet song is raised within seconds");

  Memory fresh;
  Leveler unknown(fresh.handle);
  feq_leveling_memory_begin_song(fresh.handle, kSongA, -120, -120);
  unknown.play(4, kVerse);
  check(std::abs(unknown.gain()) < 0.01, "positive control: the same song unheard is not");

  Memory loud;
  Leveler chorus_known(loud.handle);
  feq_leveling_memory_begin_song(loud.handle, kSongA, -16, -13);
  chorus_known.play(30, kVerse);
  check(chorus_known.gain() < 2.5,
        "a song remembered with a loud chorus is not raised for its quiet opening");
}

void what_was_learned_survives_a_new_chain() {
  Memory memory;
  double learned = 0;
  {
    Leveler first(memory.handle);
    feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120);
    first.play(40, kVerse);
    first.play(15, kChorus);
    learned = first.gain();
  }
  Leveler second(memory.handle);
  second.play(0.02, kVerse);
  check(std::abs(second.gain() - learned) < 0.1,
        "a chain built when Windows locks the output again resumes the learned gain");
  second.play(60, kVerse);
  check(std::abs(second.gain() - learned) < 0.2, "and keeps the song's level after it");

  Leveler forgetful(nullptr);
  forgetful.play(0.02, kVerse);
  check(std::abs(forgetful.gain()) < 0.01, "positive control: without the memory it starts over");

  Memory shared;
  Leveler playing(shared.handle);
  Leveler idle(shared.handle);
  feq_leveling_memory_begin_song(shared.handle, kSongA, -120, -120);
  for (int at = 0; at < 4000; ++at) {
    playing.block(at < 3000 ? kVerse : kChorus);
    idle.block(0);
  }
  Leveler next(shared.handle);
  next.play(0.02, kVerse);
  check(std::abs(next.gain() - playing.gain()) < 0.1,
        "a silent stream on the same output does not overwrite what the playing one learned");
}

void titles_pauses_and_the_next_song() {
  Memory memory;
  Leveler leveler(memory.handle);
  feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120);
  leveler.play(40, kChorus);
  const double level = leveler.reading.reference_lufs;
  check(feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120) == 0,
        "the same song announced again by another instance is not a new song");
  feq_leveling_memory_begin_song(memory.handle, 0, -120, -120);
  leveler.play(1, kChorus);
  feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120);
  leveler.play(1, kChorus);
  check(std::abs(leveler.reading.reference_lufs - level) < 0.01,
        "a title that flickers out and back is the same song");
  leveler.play(10, 0);
  leveler.play(5, kVerse);
  check(std::abs(leveler.reading.reference_lufs - level) < 0.01,
        "a named song paused for ten seconds is still the same song");

  leveler.play(30, kVerse);
  leveler.play(1.5, kLoud);
  FeqSongLevel finished{};
  check(feq_leveling_memory_read_song(memory.handle, &finished) == 1 &&
            std::abs(finished.level_lufs - level) < 0.5,
        "the next song's opening, before Windows names it, does not count towards this one");
  check(leveler.reading.reference_lufs > level + 1,
        "positive control: that opening did reach the live level");
  feq_leveling_memory_begin_song(memory.handle, kSongB, -120, -120);
  leveler.play(0.02, kLoud);
  check(leveler.reading.reference_lufs < -100, "a new song is learned afresh");
}

void switching_modes_starts_over() {
  Memory memory;
  Leveler leveler(memory.handle);
  feq_leveling_memory_begin_song(memory.handle, kSongA, -120, -120);
  leveler.play(40, kChorus);
  leveler.settings.mode = 0;
  leveler.play(2, kChorus);
  check(std::abs(leveler.gain()) < 0.01, "Off returns to unity");
  Leveler relocked(memory.handle);
  relocked.settings.mode = 0;
  relocked.play(1, kChorus);
  relocked.settings.mode = 2;
  relocked.play(2, kChorus);
  check(relocked.reading.reference_lufs < -100 && std::abs(relocked.gain()) < 0.01,
        "switching back on relearns rather than restoring what Off discarded");
}
}

int main() {
  a_loud_passage_sets_the_level_for_the_rest_of_the_song();
  the_next_song_keeps_the_level_unless_it_is_much_quieter();
  a_song_heard_before_is_levelled_from_its_first_second();
  what_was_learned_survives_a_new_chain();
  titles_pauses_and_the_next_song();
  switching_modes_starts_over();
  return failures == 0 ? 0 : 1;
}
