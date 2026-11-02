/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "song_teller.h"

namespace feq::tray {

SongTeller::SongTeller(SongLevelStore& store, std::string root_name,
                       std::string per_output_prefix)
    : store_(store),
      root_name_(std::move(root_name)),
      per_output_prefix_(std::move(per_output_prefix)) {}

void SongTeller::known(const std::string& endpoint) {
  if (const auto guid = output_guid(endpoint)) {
    endpoints_.insert(*guid);
  }
}

void SongTeller::main_output(const std::optional<std::string>& endpoint) {
  main_guid_ = endpoint ? output_guid(*endpoint) : std::nullopt;
}

std::vector<ProgrammeWrite> SongTeller::tell() {
  if (main_guid_) {
    endpoints_.insert(*main_guid_);
  }
  struct Target {
    std::string name;
    std::optional<std::string> endpoint;
  };
  std::vector<Target> targets{{root_name_, main_guid_}};
  for (const auto& endpoint : endpoints_) {
    targets.push_back({per_output_prefix_ + endpoint + ".txt", endpoint});
  }
  std::vector<ProgrammeWrite> writes;
  for (const auto& [name, endpoint] : targets) {
    const std::optional<SongLevel> known =
        latest_ ? store_.lookup(*latest_, endpoint) : std::nullopt;
    std::string contents = song_programme_text(latest_, known);
    const auto told = told_.find(name);
    if (told != told_.end() && told->second == contents) {
      continue;
    }
    told_[name] = contents;
    writes.push_back({name, std::move(contents)});
  }
  return writes;
}

std::vector<ProgrammeWrite> SongTeller::media(
    const std::optional<std::string>& id) {
  latest_ = id;
  return tell();
}

std::vector<ProgrammeWrite> SongTeller::reflush() {
  told_.clear();
  return tell();
}

std::vector<ProgrammeWrite> SongTeller::health(
    const std::vector<OutputReport>& outputs) {
  bool changed = false;
  for (const auto& [endpoint, last_song] : outputs) {
    const auto guid = output_guid(endpoint);
    if (!guid) {
      continue;
    }
    if (endpoints_.insert(*guid).second) {
      changed = true;
    }
    if (!last_song) {
      continue;
    }
    // Every status repeats the song it last finished: recorded once, and each
    // output through its own chain, never seeding another output's.
    const std::string key = *guid + ":" + last_song->id;
    const auto recorded = recorded_.find(key);
    if (recorded != recorded_.end() && recorded->second == last_song->seconds) {
      continue;
    }
    recorded_[key] = last_song->seconds;
    changed = store_.record(*last_song, *guid) || changed;
  }
  return changed ? tell() : std::vector<ProgrammeWrite>{};
}

}  // namespace feq::tray
