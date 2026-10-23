/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "status_report.h"

#include <fcntl.h>
#include <sys/stat.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstdio>
#include <cstring>
#include <ctime>

#include "fluideq_engine/graph.h"
#include "posix_path.h"

namespace fluideq_mac {

namespace {

/** ISO-8601 UTC to the millisecond, the Windows effect's own stamp. */
std::string utc_now() {
  timespec now{};
  clock_gettime(CLOCK_REALTIME, &now);
  std::tm parts{};
  gmtime_r(&now.tv_sec, &parts);
  char text[32] = {};
  std::snprintf(text, sizeof(text), "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
                parts.tm_year + 1900, parts.tm_mon + 1, parts.tm_mday,
                parts.tm_hour, parts.tm_min, parts.tm_sec,
                now.tv_nsec / 1000000L);
  return text;
}

std::string failure(const char* step) {
  return std::string(step) + ": " + std::strerror(errno);
}

}  // namespace

std::vector<std::pair<std::string, unsigned>> latency_parts_of(
    const fluideq_engine::Graph& graph) {
  const fluideq_engine::Graph::LatencyParts& parts = graph.latency_parts();
  const std::pair<const char*, uint32_t> named[] = {
      {"leveler", parts.rack.leveler},
      {"restoration", parts.rack.restoration},
      {"deesser", parts.rack.deesser},
      {"exciter", 0u},
      {"bassForge", 0u},
      {"linearEq", parts.rack.eq},
      {"bassPunch", parts.rack.bass_punch},
      {"room", parts.rack.room},
      {"dimension", 0u},
      {"maximizer", parts.rack.maximizer},
      {"headroom", parts.rack.headroom},
      {"master", 0u},
      {"eqPhase", parts.eq_phase},
      {"curvePhase", parts.curve_phase},
      {"convolution", parts.convolution},
      {"curves", parts.curves},
      {"guard", parts.guard},
      {"filters", 0u},
      {"preamp", 0u},
  };
  const std::vector<std::string>& active = graph.active_stages();
  std::vector<std::pair<std::string, unsigned>> out;
  for (const auto& one : named) {
    if (one.second > 0u ||
        std::find(active.begin(), active.end(), one.first) != active.end()) {
      out.emplace_back(one.first, one.second);
    }
  }
  return out;
}

StatusFiles::StatusFiles(std::string root) : root_(std::move(root)) {}

bool StatusFiles::write(const fluideq_engine::EngineStatus& status,
                        std::string& why) const {
  if (status.endpoint.empty()) {
    why = "no output to name the file after";
    return false;
  }
  const std::string text = fluideq_engine::status_json(
      status, static_cast<unsigned long>(::getpid()), utc_now());
  const std::string name =
      "status-" + fluideq_engine::posix_path(status.endpoint) + ".json";
  const std::string final_path = root_ + "/" + name;
  // A dot in front keeps the half-written file out of the app's reads, which
  // take `status-{GUID}.json` and nothing else.
  const std::string aside = root_ + "/." + name + ".tmp";

  const int file = ::open(aside.c_str(), O_WRONLY | O_CREAT | O_TRUNC, 0644);
  if (file < 0) {
    why = failure("open");
    return false;
  }
  size_t done = 0;
  while (done < text.size()) {
    const ssize_t wrote = ::write(file, text.data() + done, text.size() - done);
    if (wrote < 0) {
      if (errno == EINTR) {
        continue;
      }
      why = failure("write");
      ::close(file);
      ::unlink(aside.c_str());
      return false;
    }
    done += static_cast<size_t>(wrote);
  }
  if (::close(file) != 0) {
    why = failure("close");
    ::unlink(aside.c_str());
    return false;
  }
  if (::rename(aside.c_str(), final_path.c_str()) != 0) {
    why = failure("rename");
    ::unlink(aside.c_str());
    return false;
  }
  return true;
}

}  // namespace fluideq_mac
