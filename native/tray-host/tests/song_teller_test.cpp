/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// The tray tells the engine the song as main does (`song_teller_fixture.h`,
// main's own `createSongProgramme` and `createSongLevelStore` played through
// the same script): after every step the same files with the same text, and
// at the end the same levels kept in `song-levels.json` — a report heard
// twice recorded once, one too short not at all, a quieter later play not
// lowering what was learned, and a bad endpoint or song id refused.

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

#include <algorithm>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <string>
#include <vector>

#include "fluideq/share/json.h"
#include "song_teller.h"
#include "song_teller_fixture.h"

namespace {

namespace fx = feq::tray::fixture;
namespace json = feq::share::json;
using feq::tray::ProgrammeWrite;

int failures = 0;

void check(bool ok, const std::string& what) {
  if (!ok) {
    std::printf("FAIL: %s\n", what.c_str());
    ++failures;
  }
}

std::optional<std::string> text_or_none(const char* text) {
  return *text == '\0' ? std::nullopt : std::optional<std::string>(text);
}

}  // namespace

int main() {
  const std::filesystem::path folder =
      std::filesystem::temp_directory_path() /
      ("fluideq-song-teller-" + std::to_string(GetCurrentProcessId()));
  std::filesystem::create_directories(folder);
  const std::filesystem::path file = folder / "song-levels.json";
  double clock = 0.0;
  feq::tray::SongLevelStore store(file, [&clock] {
    clock += 1000.0;
    return clock;
  });
  feq::tray::SongTeller teller(store, "fluideq-programme.txt",
                               "fluideq-programme-");

  for (std::size_t at = 0; at < fx::kSteps.size(); ++at) {
    const auto& step = fx::kSteps[at];
    std::vector<ProgrammeWrite> wrote;
    if (step.kind == 0) {
      teller.main_output(text_or_none(step.text));
    } else if (step.kind == 1) {
      wrote = teller.media(text_or_none(step.text));
    } else if (step.kind == 2) {
      std::vector<feq::tray::OutputReport> outputs;
      for (const auto& output : step.outputs) {
        feq::tray::OutputReport report{output.endpoint, std::nullopt};
        if (output.finished) {
          report.last_song = feq::tray::FinishedSong{
              output.id, output.seconds, output.level, output.peak};
        }
        outputs.push_back(report);
      }
      wrote = teller.health(outputs);
    } else {
      wrote = teller.reflush();
    }
    std::sort(wrote.begin(), wrote.end(),
              [](const auto& a, const auto& b) { return a.name < b.name; });
    const auto& wanted = fx::kWrites[at];
    bool same = wrote.size() == wanted.size();
    for (std::size_t file_at = 0; same && file_at < wrote.size(); ++file_at) {
      same = wrote[file_at].name == wanted[file_at].name &&
             wrote[file_at].contents == wanted[file_at].contents;
    }
    check(same, "step " + std::to_string(at) + " wrote " +
                    std::to_string(wrote.size()) + " files, main " +
                    std::to_string(wanted.size()));
  }

  std::ifstream in(file, std::ios::binary);
  const std::string text((std::istreambuf_iterator<char>(in)),
                         std::istreambuf_iterator<char>());
  in.close();
  const auto parsed = json::parse(text);
  const json::Value* songs = parsed ? parsed->get("songs") : nullptr;
  check(json::is_record(songs), "the levels are kept in main's shape");
  if (json::is_record(songs)) {
    check(songs->members().size() == fx::kKept.size(),
          "as many songs kept as main keeps");
    for (const auto& kept : fx::kKept) {
      const json::Value* entry = songs->get(kept.key);
      const auto number = [entry](const char* key) {
        const json::Value* found = entry == nullptr ? nullptr : entry->get(key);
        return found != nullptr && found->is_number() ? found->as_number()
                                                      : -1e300;
      };
      check(entry != nullptr && number("levelLufs") == kept.level &&
                number("peakDb") == kept.peak &&
                number("seconds") == kept.seconds &&
                number("heardAt") == kept.heard_at,
            std::string("the level kept for ") + kept.key);
    }
  }
  std::error_code ignored;
  std::filesystem::remove_all(folder, ignored);
  if (failures != 0) {
    std::printf("%d failure(s)\n", failures);
    return 1;
  }
  std::printf("song teller: the engine told what main tells it, levels kept as main keeps them\n");
  return 0;
}
