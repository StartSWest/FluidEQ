/* FluidEQ — GPL-3.0-or-later */
#include "source_analysis.h"

#include <array>
#include <charconv>
#include <cmath>
#include <limits>
#include <set>

namespace fluideq_engine {
namespace {

constexpr uint64_t kLargestExactInteger = 9007199254740991ULL;
constexpr size_t kNoiseValues = FEQ_DENOISE_PROFILE_BANDS + 3 +
                               2 * FEQ_DENOISE_MAX_HUM_PARTIALS;

bool integer(std::string_view text, uint64_t& out, int base = 10) {
  if (text.empty()) return false;
  const auto read = std::from_chars(text.data(), text.data() + text.size(), out, base);
  return read.ec == std::errc() && read.ptr == text.data() + text.size();
}

bool number(std::string_view text, double& out) {
  if (text.empty()) return false;
  const auto read = std::from_chars(text.data(), text.data() + text.size(), out);
  return read.ec == std::errc() && read.ptr == text.data() + text.size() &&
         std::isfinite(out);
}

bool absolute_model(std::string_view text) {
  // A data file only. Executable paths are never accepted from this file.
  return text.size() > 3 && text.size() <= 32767 &&
      ((text[0] >= 'A' && text[0] <= 'Z') || (text[0] >= 'a' && text[0] <= 'z')) &&
      text[1] == ':' && (text[2] == '\\' || text[2] == '/') &&
      text.find_first_of("\r\n\0", 0, 3) == std::string_view::npos;
}

bool noise_profile(std::string_view text, FeqNoiseProfile& out) {
  std::array<double, kNoiseValues> values{};
  for (double& value : values) {
    const size_t first = text.find_first_not_of(" \t");
    if (first == std::string_view::npos) return false;
    text.remove_prefix(first);
    const size_t end = text.find_first_of(" \t");
    if (!number(text.substr(0, end), value)) return false;
    text.remove_prefix(end == std::string_view::npos ? text.size() : end);
  }
  if (text.find_first_not_of(" \t") != std::string_view::npos) return false;
  size_t at = 0;
  for (double& band : out.bands_db) band = values[at++];
  out.floor_dbfs = values[at++];
  out.hum_hz = values[at++];
  const double count = values[at++];
  if (count < 0 || count > FEQ_DENOISE_MAX_HUM_PARTIALS || std::floor(count) != count) {
    return false;
  }
  out.hum_partial_count = static_cast<uint32_t>(count);
  for (double& hz : out.hum_partial_hz) hz = values[at++];
  for (double& excess : out.hum_partial_excess_db) excess = values[at++];
  return true;
}

bool same_endpoint(const std::wstring& left, const std::wstring& right) {
  const auto a = endpoint_config_name(L"id", Endpoint{left, {}});
  const auto b = endpoint_config_name(L"id", Endpoint{right, {}});
  return a && b && *a == *b;
}

}  // namespace

FeqChainSourceAnalysis SourceAnalysis::view() const noexcept {
  const bool voice = voice_available && voice_model_guard &&
                     !voice_model.empty() && !voice_runtime.empty();
  return FeqChainSourceAnalysis{1, library ? 1 : 0, source, epoch, revision,
      has_level ? 1 : 0, level, peak, noise ? &*noise : nullptr,
      voice ? voice_model.c_str() : nullptr, voice ? voice_runtime.c_str() : nullptr};
}

std::string SourceAnalysis::processing_identity() const {
  std::string out = library ? "library" : "live";
  const auto integer_part = [&](uint64_t value) {
    std::array<char, 32> buffer{};
    const auto encoded = std::to_chars(buffer.data(), buffer.data() + buffer.size(), value);
    out.push_back('|');
    out.append(buffer.data(), encoded.ptr);
  };
  const auto number_part = [&](double value) {
    std::array<char, 64> buffer{};
    const auto encoded = std::to_chars(buffer.data(), buffer.data() + buffer.size(),
        value, std::chars_format::general, std::numeric_limits<double>::max_digits10);
    out.push_back('|');
    out.append(buffer.data(), encoded.ptr);
  };
  integer_part(engine_owner ? 1 : 0);
  integer_part(source);
  integer_part(epoch);
  integer_part(has_level ? 1 : 0);
  if (has_level) {
    number_part(level);
    number_part(peak);
  }
  integer_part(noise ? 1 : 0);
  if (noise) {
    for (double band : noise->bands_db) number_part(band);
    number_part(noise->floor_dbfs);
    number_part(noise->hum_hz);
    integer_part(noise->hum_partial_count);
    for (double hz : noise->hum_partial_hz) number_part(hz);
    for (double excess : noise->hum_partial_excess_db) number_part(excess);
  }
  integer_part(voice_available ? 1 : 0);
  integer_part(voice_model_guard ? 1 : 0);
  integer_part(voice_model.size());
  out += voice_model;
  integer_part(voice_runtime.size());
  out += voice_runtime;
  return out;
}

std::optional<SourceAnalysis> parse_source_analysis(std::string_view text) {
  if (text.size() > 65536 || text.find('\0') != std::string_view::npos) {
    return std::nullopt;
  }
  SourceAnalysis out;
  out.identity = text;
  std::set<std::string_view> seen;
  bool has_peak = false;
  while (!text.empty()) {
    const size_t end = text.find('\n');
    std::string_view line = text.substr(0, end);
    text.remove_prefix(end == std::string_view::npos ? text.size() : end + 1);
    if (!line.empty() && line.back() == '\r') line.remove_suffix(1);
    if (line.empty() || line.front() == '#') continue;
    const size_t equals = line.find('=');
    if (equals == std::string_view::npos) return std::nullopt;
    const std::string_view key = line.substr(0, equals);
    const std::string_view value = line.substr(equals + 1);
    if (!seen.insert(key).second) return std::nullopt;
    if (key == "version") {
      if (value != "1") return std::nullopt;
    } else if (key == "kind") {
      if (value != "library" && value != "live") return std::nullopt;
      out.library = value == "library";
    } else if (key == "owner") {
      if (value != "host" && value != "engine") return std::nullopt;
      out.engine_owner = value == "engine";
    } else if (key == "source") {
      if (value.size() != 16 || !integer(value, out.source, 16)) return std::nullopt;
    } else if (key == "epoch" || key == "revision") {
      uint64_t& target = key == "epoch" ? out.epoch : out.revision;
      if (!integer(value, target) || target > kLargestExactInteger) return std::nullopt;
    } else if (key == "endpoint") {
      out.endpoint.assign(value.begin(), value.end());
      if (!endpoint_config_name(L"id", Endpoint{out.endpoint, {}})) return std::nullopt;
    } else if (key == "level" || key == "peak") {
      double& target = key == "level" ? out.level : out.peak;
      if (!number(value, target) || target < -120 || target > 24) return std::nullopt;
      if (key == "level") out.has_level = true;
      else has_peak = true;
    } else if (key == "noise") {
      FeqNoiseProfile profile{};
      if (!noise_profile(value, profile)) return std::nullopt;
      out.noise = profile;
    } else if (key == "voice") {
      if (value != "available" && value != "unavailable") return std::nullopt;
      out.voice_available = value == "available";
    } else if (key == "voiceModel") {
      if (!absolute_model(value)) return std::nullopt;
      out.voice_model = value;
    } else {
      return std::nullopt;
    }
  }
  for (const auto* key : {"version", "kind", "source", "epoch", "revision"}) {
    if (seen.count(key) == 0) return std::nullopt;
  }
  if (out.has_level != has_peak ||
      (out.voice_available && out.voice_model.empty()) ||
      (!out.voice_available && !out.voice_model.empty()) ||
      (out.library && (out.source == 0 || out.endpoint.empty() || seen.count("owner") == 0))) {
    return std::nullopt;
  }
  return out;
}

SourceAnalysis source_for_endpoint(const std::optional<SourceAnalysis>& source,
    const Endpoint& endpoint, const std::wstring& from, bool default_mode) {
  if (source && source->library && default_mode &&
      (same_endpoint(endpoint.guid, source->endpoint) ||
       same_endpoint(from, source->endpoint))) return *source;

  // Unrelated outputs have their own live source. A Library seek/scan cannot
  // reset their leveling or force their graph to rebuild.
  SourceAnalysis live;
  if (source) {
    live.voice_available = source->voice_available;
    live.voice_model = source->voice_model;
    live.voice_runtime = source->voice_runtime;
    live.voice_model_guard = source->voice_model_guard;
  }
  live.identity = "live|model=" + live.voice_model + "|runtime=" + live.voice_runtime +
                  (live.voice_model_guard ? "|verified=1" : "|verified=0");
  return live;
}

}  // namespace fluideq_engine
