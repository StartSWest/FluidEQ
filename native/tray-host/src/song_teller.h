/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <map>
#include <optional>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "song_levels.h"

/*
 * Telling the FluidEQ Engine which song is playing, as main tells it
 * (`createSongProgramme` in `src/main/songProgramme.ts`), for the tray to do
 * while Electron is gone: the main output's root file and one file per
 * output the engine has reported, each naming the song and, for a song an
 * output levelled before, the level it learned. What it says is held to the
 * TypeScript by `song_teller_test.cpp` (`songTellerFixture.ts`).
 */

namespace feq::tray {

/** One programme file to write: its name in the engine's folder, and its text. */
struct ProgrammeWrite {
  std::string name;
  std::string contents;
  bool operator==(const ProgrammeWrite&) const = default;
};

/** One output's status, as the engine wrote it. */
struct OutputReport {
  std::string endpoint;
  std::optional<FinishedSong> last_song;
};

class SongTeller {
 public:
  /**
   * `root_name` is the main output's file (the legacy engine reads only
   * it); `per_output_prefix` starts every output's own, its GUID after it.
   */
  SongTeller(SongLevelStore& store, std::string root_name,
             std::string per_output_prefix);

  /** An output main already told, so it hears the next song too. */
  void known(const std::string& endpoint);
  /** The output Windows plays through now; none for no valid one. */
  void main_output(const std::optional<std::string>& endpoint);
  /** A media reading: the song's identity, or none for nothing named. */
  std::vector<ProgrammeWrite> media(const std::optional<std::string>& id);
  /** The engine's statuses: outputs seen, and songs they finished. */
  std::vector<ProgrammeWrite> health(const std::vector<OutputReport>& outputs);
  /** What to write so the engine hears the song again (`reflush`). */
  std::vector<ProgrammeWrite> reflush();
  /** A write that did not land: said again by the next telling. */
  void unsent(const std::string& name) { told_.erase(name); }

 private:
  std::vector<ProgrammeWrite> tell();

  SongLevelStore& store_;
  std::string root_name_;
  std::string per_output_prefix_;
  std::optional<std::string> latest_;
  std::optional<std::string> main_guid_;
  std::set<std::string> endpoints_;
  /** What each file was last told: a write that says it again is skipped. */
  std::map<std::string, std::string> told_;
  /** The seconds each output's song was last recorded at. */
  std::map<std::string, double> recorded_;
};

}  // namespace feq::tray
