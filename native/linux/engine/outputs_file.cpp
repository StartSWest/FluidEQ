/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "outputs_file.h"

#include <fcntl.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstdio>

#include "../compat/wide_path.h"
#include "paths.h"

namespace fluideq_linux {

namespace {

struct Named {
  const char* name;
  Speaker bit;
};

// PipeWire's short names against KSAUDIO speaker bits. MONO is the centre,
// as Windows lays a one-channel stream out.
constexpr Named kSpeakers[] = {
    {"FL", 0x1},       {"FR", 0x2},       {"FC", 0x4},      {"MONO", 0x4},
    {"LFE", 0x8},      {"RL", 0x10},      {"RR", 0x20},     {"FLC", 0x40},
    {"FRC", 0x80},     {"RC", 0x100},     {"SL", 0x200},    {"SR", 0x400},
    {"TC", 0x800},     {"TFL", 0x1000},   {"TFC", 0x2000},  {"TFR", 0x4000},
    {"TRL", 0x8000},   {"TRC", 0x10000},  {"TRR", 0x20000},
};

Speaker speaker_named(std::string_view name) {
  for (const Named& one : kSpeakers) {
    if (name == one.name) return one.bit;
  }
  return 0;
}

std::string json_string(std::string_view text) {
  std::string out = "\"";
  for (const char c : text) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (static_cast<unsigned char>(c) < 0x20) {
          char escaped[8] = {};
          std::snprintf(escaped, sizeof(escaped), "\\u%04x",
                        static_cast<unsigned>(static_cast<unsigned char>(c)));
          out += escaped;
        } else {
          out.push_back(c);
        }
    }
  }
  out.push_back('"');
  return out;
}

uint64_t fnv1a(std::string_view text, uint64_t basis) {
  uint64_t hash = basis;
  for (const char c : text) {
    hash ^= static_cast<uint8_t>(c);
    hash *= 0x100000001b3ull;
  }
  return hash;
}

}  // namespace

bool ChannelLayout::operator==(const ChannelLayout& other) const noexcept {
  if (channels != other.channels || mask != other.mask) return false;
  for (uint32_t at = 0; at < channels && at < 8; ++at) {
    if (speakers[at] != other.speakers[at]) return false;
  }
  return true;
}

std::vector<Speaker> parse_positions(std::string_view text) {
  std::vector<Speaker> out;
  size_t at = 0;
  while (at < text.size()) {
    while (at < text.size() &&
           (text[at] == '[' || text[at] == ']' || text[at] == ',' ||
            text[at] == ' ' || text[at] == '"')) {
      ++at;
    }
    size_t end = at;
    while (end < text.size() && text[end] != ',' && text[end] != ' ' &&
           text[end] != ']' && text[end] != '"') {
      ++end;
    }
    if (end > at) out.push_back(speaker_named(text.substr(at, end - at)));
    at = end;
  }
  return out;
}

ChannelLayout layout_for(uint32_t channels,
                         const std::vector<Speaker>& speakers) {
  ChannelLayout layout;
  if (channels == 0) channels = static_cast<uint32_t>(speakers.size());
  if (channels == 0) {
    layout.channels = 2;
    layout.speakers[0] = 0x1;
    layout.speakers[1] = 0x2;
    layout.mask = 0x3;
    return layout;
  }
  const bool named = speakers.size() == channels && channels <= 8 &&
                     std::none_of(speakers.begin(), speakers.end(),
                                  [](Speaker s) { return s == 0; });
  std::vector<Speaker> sorted(speakers.begin(), speakers.end());
  std::sort(sorted.begin(), sorted.end());
  const bool unique =
      std::adjacent_find(sorted.begin(), sorted.end()) == sorted.end();
  if (named && unique) {
    layout.channels = channels;
    for (uint32_t at = 0; at < channels; ++at) {
      layout.speakers[at] = sorted[at];
      layout.mask |= sorted[at];
    }
    return layout;
  }
  layout.channels = std::min<uint32_t>(channels, 8);
  for (uint32_t at = 0; at < layout.channels; ++at) {
    layout.speakers[at] = at < speakers.size() ? speakers[at] : 0;
  }
  return layout;
}

std::string endpoint_id_for(std::string_view node_name) {
  // Two FNV-1a passes from different bases: 128 bits, then marked as an
  // RFC 9562 version 8 ("custom") UUID so it can never be mistaken for one
  // Windows or a random generator made.
  const uint64_t high = fnv1a(node_name, 0xcbf29ce484222325ull);
  const uint64_t low = fnv1a(node_name, 0x84222325cbf29ce4ull);
  const unsigned long a = static_cast<unsigned long>(high >> 32);
  const unsigned b = static_cast<unsigned>((high >> 16) & 0xFFFF);
  const unsigned c = static_cast<unsigned>((high & 0x0FFF) | 0x8000);
  const unsigned d = static_cast<unsigned>(((low >> 48) & 0x3FFF) | 0x8000);
  const unsigned long long e = low & 0xFFFFFFFFFFFFull;
  char text[40] = {};
  std::snprintf(text, sizeof(text), "{%08lX-%04X-%04X-%04X-%012llX}", a, b, c,
                d, e);
  return text;
}

bool write_outputs_file(const std::string& backend, const std::string& sink,
                        const std::vector<OutputEntry>& outputs,
                        std::string* why) noexcept {
  const auto fail = [why](const char* step, int error) {
    if (why != nullptr) *why = std::string(step) + ": errno " + std::to_string(error);
    return false;
  };
  try {
    const std::wstring root = fluideq_engine::engine_root();
    if (root.empty()) return fail("no engine root", 0);
    std::string text = "{\n  \"version\": 1,\n  \"engineVersion\": " +
                       json_string(FEQ_ENGINE_FILE_VERSION) +
                       ",\n  \"backend\": " +
                       json_string(backend) + ",\n  \"sink\": " +
                       json_string(sink) + ",\n  \"pid\": " +
                       std::to_string(getpid()) + ",\n  \"outputs\": [";
    for (size_t at = 0; at < outputs.size(); ++at) {
      const OutputEntry& one = outputs[at];
      text += at == 0 ? "\n" : ",\n";
      text += "    {\"id\": " + json_string(one.id) +
              ", \"name\": " + json_string(one.name) +
              ", \"description\": " + json_string(one.description) +
              ", \"channels\": " + std::to_string(one.channels) +
              ", \"target\": " + (one.target ? "true" : "false") + "}";
    }
    text += outputs.empty() ? "]\n}\n" : "\n  ]\n}\n";

    const std::string path = narrow_path(root + L"/outputs.json");
    const std::string aside = path + "." + std::to_string(getpid()) + ".tmp";
    const int fd =
        ::open(aside.c_str(), O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
    if (fd < 0) return fail("create the temporary", errno);
    size_t done = 0;
    while (done < text.size()) {
      const ssize_t wrote = ::write(fd, text.data() + done, text.size() - done);
      if (wrote < 0 && errno == EINTR) continue;
      if (wrote <= 0) {
        const int error = errno;
        ::close(fd);
        ::unlink(aside.c_str());
        return fail("write the temporary", error);
      }
      done += static_cast<size_t>(wrote);
    }
    ::close(fd);
    if (::rename(aside.c_str(), path.c_str()) != 0) {
      const int error = errno;
      ::unlink(aside.c_str());
      return fail("rename into place", error);
    }
    return true;
  } catch (...) {
    return fail("exception", 0);
  }
}

}  // namespace fluideq_linux
