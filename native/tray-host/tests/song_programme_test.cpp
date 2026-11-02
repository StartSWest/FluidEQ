/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The tray names a song and writes the engine's programme exactly as main
// does (`song_programme_fixture.h`, from `songProgrammeFixture.ts`): every
// identity byte for byte, across Unicode's spaces, a dotted capital I, a
// Greek final sigma, CJK and an emoji; and every file, levels that round up,
// down and exactly half way, a negative zero and a tiny negative.

#include <cstdio>
#include <string>

#include "song_programme.h"
#include "song_programme_fixture.h"

namespace {

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

}  // namespace

int main() {
  namespace fx = feq::tray::fixture;
  int row = 0;
  for (const auto& song : fx::kSongs) {
    const auto id = feq::tray::song_identity(song.app, song.title, song.artist);
    check(id.has_value() && *id == song.identity,
          "song " + std::to_string(row) + " named " + id.value_or("nothing") +
              ", main names it " + song.identity);
    ++row;
  }
  row = 0;
  for (const auto& programme : fx::kProgrammes) {
    const std::string text = feq::tray::song_programme_text(
        std::string("0123456789abcdef"),
        feq::tray::SongLevel{programme.level, programme.peak});
    check(text == programme.text,
          "programme " + std::to_string(row) + ": " + text);
    ++row;
  }
  check(feq::tray::song_programme_text(std::string("0123456789abcdef"),
                                       std::nullopt) == fx::kUnknownSong,
        "a song heard for the first time");
  check(feq::tray::song_programme_text(std::nullopt, std::nullopt) ==
            fx::kNoSong,
        "no song at all");

  // The one-player rule's winner, as `startedOverOthers` picks it.
  using feq::tray::started_over_others;
  check(!started_over_others({}, {"A"}), "one player starting alone wins nothing");
  check(started_over_others({"A"}, {"A", "B"}) == std::optional<std::string>("B"),
        "a player starting over another is the winner");
  check(!started_over_others({"A"}, {"A"}), "nothing new started");
  check(started_over_others({"A", "B"}, {"B", "C", "D"}) ==
            std::optional<std::string>("D"),
        "of two starting over one, the newest");
  check(!started_over_others({"A"}, {"B", "C"}),
        "everything playing just started: nothing to pause");
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("song programme: named and written as main names and writes it\n");
  return 0;
}
