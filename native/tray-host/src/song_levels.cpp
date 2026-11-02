/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "song_levels.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <fstream>
#include <iterator>
#include <limits>
#include <sstream>
#include <utility>
#include <vector>

#include "fluideq/share/json.h"

namespace feq::tray {
namespace {

namespace json = share::json;

bool is_hex(std::string_view text, std::size_t length) {
  return text.size() == length &&
         std::all_of(text.begin(), text.end(), [](char c) {
           return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
         });
}

/** `levelKey`: the song alone, or the endpoint's GUID and the song. */
std::optional<std::string> level_key(const std::string& id,
                                     const std::optional<std::string>& endpoint) {
  if (!is_hex(id, 16)) {
    return std::nullopt;
  }
  if (!endpoint) {
    return id;
  }
  const auto guid = output_guid(*endpoint);
  return guid ? std::optional<std::string>(*guid + ":" + id) : std::nullopt;
}

bool is_level_key(const std::string& key) {
  const auto colon = key.find(':');
  if (colon == std::string::npos) {
    return level_key(key, std::nullopt) == key;
  }
  if (key.find(':', colon + 1) != std::string::npos) {
    return false;
  }
  return level_key(key.substr(colon + 1), key.substr(0, colon)) == key;
}

std::optional<double> finite_at(const json::Value& record, std::string_view key) {
  const json::Value* found = record.get(key);
  if (found == nullptr || !found->is_number() ||
      !std::isfinite(found->as_number())) {
    return std::nullopt;
  }
  return found->as_number();
}

}  // namespace

std::optional<std::string> output_guid(std::string_view endpoint) {
  std::string_view bare = endpoint;
  if (bare.size() >= 2 && bare.front() == '{' && bare.back() == '}') {
    bare = bare.substr(1, bare.size() - 2);
  }
  if (bare.size() != 36) {
    return std::nullopt;
  }
  std::string guid;
  for (std::size_t at = 0; at < bare.size(); ++at) {
    const char c = bare[at];
    const bool dash = at == 8 || at == 13 || at == 18 || at == 23;
    if (dash ? c != '-' : !std::isxdigit(static_cast<unsigned char>(c))) {
      return std::nullopt;
    }
    guid.push_back(static_cast<char>(
        std::tolower(static_cast<unsigned char>(c))));
  }
  return guid;
}

SongLevelStore::SongLevelStore(std::filesystem::path file,
                               std::function<double()> now)
    : file_(std::move(file)), now_(std::move(now)) {}

std::map<std::string, SongLevelStore::Entry>& SongLevelStore::loaded() {
  if (songs_) {
    return *songs_;
  }
  songs_.emplace();
  // Missing at first launch, or half-written after a power cut: either way
  // songs are levelled live again until they are relearned.
  std::ifstream in(file_, std::ios::binary);
  if (!in) {
    return *songs_;
  }
  const std::string text((std::istreambuf_iterator<char>(in)),
                         std::istreambuf_iterator<char>());
  const auto parsed = json::parse(text);
  if (!parsed || !json::is_record(&*parsed)) {
    return *songs_;
  }
  const auto version = finite_at(*parsed, "version");
  const json::Value* songs = parsed->get("songs");
  if (!version || (*version != 1.0 && *version != 2.0) ||
      !json::is_record(songs)) {
    return *songs_;
  }
  for (const auto& [key, entry] : songs->members()) {
    if (!is_level_key(key) || !json::is_record(&entry)) {
      continue;
    }
    const auto level = finite_at(entry, "levelLufs");
    const auto peak = finite_at(entry, "peakDb");
    const auto seconds = finite_at(entry, "seconds");
    const auto heard = finite_at(entry, "heardAt");
    if (level && peak && seconds && heard) {
      (*songs_)[key] = Entry{*level, *peak, *seconds, *heard};
    }
  }
  return *songs_;
}

std::optional<SongLevel> SongLevelStore::lookup(
    const std::string& id, const std::optional<std::string>& endpoint) {
  const auto key = level_key(id, endpoint);
  if (!key) {
    return std::nullopt;
  }
  const auto& songs = loaded();
  const auto found = songs.find(*key);
  if (found == songs.end()) {
    return std::nullopt;
  }
  return SongLevel{found->second.level_lufs, found->second.peak_db};
}

bool SongLevelStore::record(const FinishedSong& song,
                            const std::optional<std::string>& endpoint) {
  const auto key = level_key(song.id, endpoint);
  if (!key || song.seconds < kMinLearnedSeconds) {
    return false;
  }
  auto& songs = loaded();
  const auto known = songs.find(*key);
  constexpr double kNone = -std::numeric_limits<double>::infinity();
  // The loudest either play heard: a play skipped before its chorus measured
  // less of the song, not a quieter song.
  Entry next{
      std::max(known == songs.end() ? kNone : known->second.level_lufs,
               song.level_lufs),
      std::max(known == songs.end() ? kNone : known->second.peak_db,
               song.peak_db),
      std::max(known == songs.end() ? 0.0 : known->second.seconds,
               song.seconds),
      now_()};
  songs[*key] = next;
  save();
  return true;
}

void SongLevelStore::save() {
  auto& songs = loaded();
  std::vector<std::pair<std::string, Entry>> sorted(songs.begin(), songs.end());
  // Most recently heard first. A tie keeps the order the keys sort in, where
  // main keeps the order it learned them in: only which of two songs heard
  // in the same millisecond goes first at the cap.
  std::stable_sort(sorted.begin(), sorted.end(),
                   [](const auto& a, const auto& b) {
                     return a.second.heard_at > b.second.heard_at;
                   });
  std::map<std::string, std::size_t> counts;
  std::vector<std::pair<std::string, Entry>> kept;
  for (auto& entry : sorted) {
    const auto colon = entry.first.find(':');
    const std::string endpoint =
        colon == std::string::npos ? "legacy" : entry.first.substr(0, colon);
    if (counts[endpoint]++ < kLimit) {
      kept.push_back(std::move(entry));
    }
  }
  if (kept.size() < songs.size()) {
    songs.clear();
    for (const auto& [key, entry] : kept) {
      songs[key] = entry;
    }
  }
  std::vector<json::Member> members;
  for (const auto& [key, entry] : kept) {
    members.emplace_back(
        key, json::Value::object({{"levelLufs", json::Value::number(entry.level_lufs)},
                                  {"peakDb", json::Value::number(entry.peak_db)},
                                  {"seconds", json::Value::number(entry.seconds)},
                                  {"heardAt", json::Value::number(entry.heard_at)}}));
  }
  const std::string text = json::stringify(json::Value::object(
      {{"version", json::Value::number(2)},
       {"songs", json::Value::object(std::move(members))}}));
  // Beside the file and renamed over it, as main writes it.
  std::filesystem::path partial = file_;
  partial += L".partial";
  {
    std::ofstream out(partial, std::ios::binary | std::ios::trunc);
    out << text;
    if (!out) {
      return;
    }
  }
  std::error_code failed;
  std::filesystem::rename(partial, file_, failed);
}

}  // namespace feq::tray
