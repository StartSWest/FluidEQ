/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <filesystem>
#include <functional>
#include <map>
#include <optional>
#include <string>

#include "song_programme.h"

/*
 * How loud each song the engine has levelled turned out to be: main's
 * `song-levels.json` (`src/main/songLevels.ts`), read and written by the
 * tray while Electron is gone, in the same shape, so either side picks up
 * what the other learned. Keyed by the endpoint's GUID and the song's
 * identity, never a title; capped per endpoint, the least recently heard
 * going first.
 */

namespace feq::tray {

/** A song the engine finished levelling (`lastSong` in its status). */
struct FinishedSong {
  std::string id;
  double seconds = 0.0;
  double level_lufs = 0.0;
  double peak_db = 0.0;
};

class SongLevelStore {
 public:
  /** The file, and the clock a record is stamped with (ms since 1970). */
  SongLevelStore(std::filesystem::path file, std::function<double()> now);

  std::optional<SongLevel> lookup(const std::string& id,
                                  const std::optional<std::string>& endpoint);
  /** False when the report was too short to learn from, or names nothing. */
  bool record(const FinishedSong& song,
              const std::optional<std::string>& endpoint);

  /** Songs kept per endpoint (`SONG_LEVELS_LIMIT`). */
  static constexpr std::size_t kLimit = 2000;
  /** A song heard for less taught the leveler its opening, not its level. */
  static constexpr double kMinLearnedSeconds = 30.0;

 private:
  struct Entry {
    double level_lufs = 0.0;
    double peak_db = 0.0;
    double seconds = 0.0;
    double heard_at = 0.0;
  };

  std::map<std::string, Entry>& loaded();
  void save();

  std::filesystem::path file_;
  std::function<double()> now_;
  std::optional<std::map<std::string, Entry>> songs_;
};

/**
 * `outputConfigGuid`: an endpoint id, braced or bare, as the lowercase GUID
 * every per-output file is named by; none for anything else.
 */
std::optional<std::string> output_guid(std::string_view endpoint);

}  // namespace feq::tray
