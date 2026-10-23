/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `status_file.h`'s file half for Linux. The text is the shared
 * `status_json`, so the app reads one shape from every platform; only the
 * write differs. `rename(2)` already has the semantics Windows needed
 * `FileRenameInfoEx` for: a reader holding the old file keeps its contents,
 * and the next open finds the new one whole.
 */

#include <fcntl.h>
#include <unistd.h>

#include <cerrno>
#include <cstdio>
#include <ctime>
#include <map>
#include <mutex>
#include <string>
#include <utility>

#include "../compat/wide_path.h"
#include "paths.h"
#include "status_file.h"

namespace fluideq_engine {

namespace {

std::string utc_now() {
  struct timespec now {};
  clock_gettime(CLOCK_REALTIME, &now);
  struct tm utc {};
  gmtime_r(&now.tv_sec, &utc);
  char text[64] = {};
  std::snprintf(text, sizeof(text), "%04d-%02d-%02dT%02d:%02d:%02d.%03ldZ",
                utc.tm_year + 1900, utc.tm_mon + 1, utc.tm_mday, utc.tm_hour,
                utc.tm_min, utc.tm_sec, now.tv_nsec / 1000000L);
  return text;
}

struct Holder {
  unsigned instances = 0;
  std::shared_ptr<std::atomic<bool>> carried =
      std::make_shared<std::atomic<bool>>(false);
  std::shared_ptr<BlockTiming> timing = std::make_shared<BlockTiming>();
};

struct Board {
  std::mutex mutex;
  std::map<std::wstring, Holder> holders;
};

Board& board() {
  static Board instance;
  return instance;
}

bool fail(std::string* why, const char* step, int error) {
  if (why != nullptr) {
    *why = std::string(step) + ": errno " + std::to_string(error);
  }
  return false;
}

}  // namespace

bool write_status(const EngineStatus& status, std::string* why) noexcept {
  try {
    const std::wstring root = engine_root();
    if (root.empty() || status.endpoint.empty()) {
      return fail(why, "no engine root or endpoint", 0);
    }
    if (!is_directory(root)) {
      return fail(why, "engine root is not a directory", ENOENT);
    }
    const std::string path = fluideq_linux::narrow_path(
        root + L"/status-" + status.endpoint + L".json");
    const std::string aside =
        path + "." + std::to_string(getpid()) + ".tmp";
    const std::string text =
        status_json(status, static_cast<unsigned long>(getpid()), utc_now());

    const int fd = ::open(aside.c_str(),
                          O_WRONLY | O_CREAT | O_TRUNC | O_CLOEXEC, 0644);
    if (fd < 0) return fail(why, "create the temporary", errno);
    size_t done = 0;
    while (done < text.size()) {
      const ssize_t wrote = ::write(fd, text.data() + done, text.size() - done);
      if (wrote < 0 && errno == EINTR) continue;
      if (wrote <= 0) {
        const int error = errno;
        ::close(fd);
        ::unlink(aside.c_str());
        return fail(why, "write the temporary", error);
      }
      done += static_cast<size_t>(wrote);
    }
    ::close(fd);
    if (::rename(aside.c_str(), path.c_str()) != 0) {
      const int error = errno;
      ::unlink(aside.c_str());
      return fail(why, "rename into place", error);
    }
    return true;
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

std::shared_ptr<std::atomic<bool>> output_carried_flag(
    const std::wstring& endpoint) {
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    return shared.holders[endpoint].carried;
  } catch (...) {
    return nullptr;
  }
}

std::shared_ptr<BlockTiming> output_block_timing(const std::wstring& endpoint) {
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    return shared.holders[endpoint].timing;
  } catch (...) {
    return nullptr;
  }
}

StatusShare::~StatusShare() { leave(); }

bool StatusShare::publish(const EngineStatus& status,
                          std::string* why) noexcept {
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    if (endpoint_.empty() && !status.endpoint.empty()) {
      std::wstring endpoint = status.endpoint;
      ++shared.holders[endpoint].instances;
      endpoint_.swap(endpoint);
    }
    return write_status(status, why);
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

bool StatusShare::leave(std::string* why) noexcept {
  if (endpoint_.empty()) return true;
  try {
    Board& shared = board();
    const std::lock_guard<std::mutex> hold(shared.mutex);
    std::wstring endpoint;
    endpoint.swap(endpoint_);
    const auto found = shared.holders.find(endpoint);
    if (found == shared.holders.end() || --found->second.instances > 0) {
      return true;
    }
    shared.holders.erase(found);
    EngineStatus released;
    released.endpoint = std::move(endpoint);
    return write_status(released, why);
  } catch (...) {
    return fail(why, "exception", 0);
  }
}

}  // namespace fluideq_engine
