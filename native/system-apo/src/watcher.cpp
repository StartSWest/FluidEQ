/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "watcher.h"

#include <process.h>

#include <algorithm>
#include <cstdio>
#include <exception>
#include <memory>
#include <new>
#include <optional>
#include <string>
#include <vector>

#include "paths.h"

namespace fluideq_engine {

namespace {

// Blocks the audio thread must complete after a publish before the graphs
// older than it can be destroyed.
//
// Two, not one. The block in flight when the new graph was stored may already
// have read the previous `pending` and be about to run the old graph; only
// the block after that one is guaranteed to have started after the store was
// visible. Counting completed blocks, `blocks >= at + 2` means both of them
// are finished and every block from here on runs the new graph or a later
// one.
constexpr uint64_t kGraceBlocks = 2;

// A configuration file larger than this is not one FluidEQ wrote. Reading it
// would mean allocating it inside audiodg.exe, which is a protected process
// with a working set nobody expects an effect to move.
constexpr long long kMaxConfigBytes = 4LL * 1024 * 1024;

// The `ignored` line is emitted once per distinct set. The cap stops a config
// being rewritten with a different stray command every second from growing
// this list without bound; a machine that reaches it has already told the log
// everything it had to say.
constexpr size_t kMaxIgnoredSetsLogged = 32;

bool is_directory(const std::wstring& path) {
  if (path.empty()) {
    return false;
  }
  const DWORD attributes = GetFileAttributesW(path.c_str());
  return attributes != INVALID_FILE_ATTRIBUTES &&
         (attributes & FILE_ATTRIBUTE_DIRECTORY) != 0;
}

/**
 * The whole file, or nothing.
 *
 * `FILE_SHARE_WRITE | FILE_SHARE_DELETE` because the app rewrites these files
 * while this runs, and a share mode that excluded the writer would make the
 * effect the reason the app's own save failed.
 */
std::optional<std::string> read_whole_file(const std::wstring& path) {
  const HANDLE file = CreateFileW(
      path.c_str(), GENERIC_READ,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr,
      OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, nullptr);
  if (file == INVALID_HANDLE_VALUE) {
    return std::nullopt;
  }
  LARGE_INTEGER size = {};
  if (GetFileSizeEx(file, &size) == 0 || size.QuadPart > kMaxConfigBytes) {
    CloseHandle(file);
    return std::nullopt;
  }
  std::string text(static_cast<size_t>(size.QuadPart), '\0');
  size_t filled = 0;
  while (filled < text.size()) {
    DWORD read = 0;
    const DWORD want = static_cast<DWORD>(
        std::min<size_t>(text.size() - filled, 1u << 20));
    if (ReadFile(file, text.data() + filled, want, &read, nullptr) == 0) {
      CloseHandle(file);
      return std::nullopt;
    }
    if (read == 0) {
      break;  // Truncated under us; what arrived is what there is.
    }
    filled += read;
  }
  CloseHandle(file);
  text.resize(filled);
  return text;
}

/** Exact enough to compare: `%.17g` round-trips every double. */
std::string number(double value) {
  char text[40] = {};
  const int written = std::snprintf(text, sizeof(text), "%.17g", value);
  if (written <= 0) {
    return std::string("?");
  }
  return std::string(text, static_cast<size_t>(written));
}

/** A file's size and last-write time, or `-` when it is not there. */
std::string stamp_of(const std::wstring& path) {
  if (path.empty()) {
    return std::string("-");
  }
  WIN32_FILE_ATTRIBUTE_DATA data = {};
  if (GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &data) == 0) {
    return std::string("-");
  }
  char text[64] = {};
  const int written = std::snprintf(
      text, sizeof(text), "%lu:%lu:%lu:%lu",
      static_cast<unsigned long>(data.nFileSizeHigh),
      static_cast<unsigned long>(data.nFileSizeLow),
      static_cast<unsigned long>(data.ftLastWriteTime.dwHighDateTime),
      static_cast<unsigned long>(data.ftLastWriteTime.dwLowDateTime));
  if (written <= 0) {
    return std::string("-");
  }
  return std::string(text, static_cast<size_t>(written));
}

/**
 * Everything about a resolved chain that could change what the effect does.
 *
 * The directory notification fires for any write anywhere under the config
 * directory, including files this endpoint's chain never mentions and an
 * editor's own temporary files. Rebuilding the graph on every one of those
 * would design a FIR and reallocate a convolver for nothing, so the graph is
 * only replaced when this string moves.
 *
 * The impulse response's size and timestamp are part of it because the app
 * rewrites `fluideq-convolution-*.wav` in place: every line of the config
 * stays identical while the audio it asks for changes completely.
 */
std::string signature_of(const Chain& chain) {
  std::string out;
  out += chain.matched ? "m1" : "m0";
  out += "|c=" + to_utf8(chain.convolution_path);
  out += "|s=" + stamp_of(chain.convolution_path);
  out += "|p=" + number(chain.preamp_db);
  out += "|b=";
  for (const Band& band : chain.bands) {
    out += std::to_string(static_cast<int>(band.type));
    out += ',' + number(band.frequency);
    out += ',' + number(band.gain_db);
    out += ',' + number(band.quality);
    out += ';';
  }
  out += "|g=";
  for (const GraphicPoint& point : chain.graphic) {
    out += number(point.frequency) + ',' + number(point.gain_db) + ';';
  }
  out += "|f=";
  for (const std::wstring& file : chain.files_read) {
    out += to_utf8(file) + ';';
  }
  out += "|i=";
  for (const std::string& command : chain.ignored) {
    out += command + ';';
  }
  return out;
}

std::string join(const std::vector<std::string>& items) {
  std::string out;
  for (const std::string& item : items) {
    if (!out.empty()) {
      out += ", ";
    }
    out += item;
  }
  return out;
}

}  // namespace

// ---------------------------------------------------------------------------

Watcher::Watcher(GraphSlot& slot, Log& log, Endpoint endpoint,
                 std::wstring config_dir, uint32_t sample_rate,
                 uint32_t channels, uint32_t max_frames)
    : slot_(slot),
      log_(log),
      endpoint_(std::move(endpoint)),
      config_dir_(std::move(config_dir)),
      sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames) {}

Watcher::~Watcher() { stop(); }

void Watcher::load_initial() {
  if (endpoint_.guid.empty()) {
    // Windows handed this instance no device collection, so there is no way
    // to tell which `Device:` blocks apply. Everything unguarded still does.
    log_.write("no endpoint identified; only unguarded configuration applies");
  }
  if (!is_directory(config_dir_)) {
    log_.write("configuration directory " + to_utf8(config_dir_) +
               " is not present; waiting for it");
  }
  reload();
}

bool Watcher::start() {
  stop_event_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (stop_event_ == nullptr) {
    log_.write("could not create the stop event; configuration changes will "
               "not be picked up");
    return false;
  }
  unsigned id = 0;
  // `_beginthreadex` rather than `CreateThread`: this thread runs the C++
  // runtime — strings, vectors, the resolver — and the CRT wants to know
  // about a thread before that thread uses it.
  const uintptr_t handle =
      _beginthreadex(nullptr, 0, &Watcher::thread_entry, this, 0, &id);
  if (handle == 0) {
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
    log_.write("could not start the configuration watcher; changes will not "
               "be picked up");
    return false;
  }
  thread_ = reinterpret_cast<HANDLE>(handle);
  // Below normal inside audiodg.exe, whose audio threads run far above it:
  // designing a 4097-tap FIR must never be scheduled against the callback
  // that has 10 ms to fill a buffer.
  SetThreadPriority(thread_, THREAD_PRIORITY_BELOW_NORMAL);
  return true;
}

void Watcher::stop() noexcept {
  if (thread_ != nullptr) {
    SetEvent(stop_event_);
    WaitForSingleObject(thread_, INFINITE);
    CloseHandle(thread_);
    thread_ = nullptr;
  }
  if (stop_event_ != nullptr) {
    CloseHandle(stop_event_);
    stop_event_ = nullptr;
  }
  // Only now: until the thread has joined it is still the owner of these.
  slot_.clear();
  for (const Retired& retired : owned_) {
    delete retired.graph;
  }
  owned_.clear();
}

unsigned __stdcall Watcher::thread_entry(void* self) {
  // Nothing may leave this thread. It runs inside audiodg.exe, and an
  // exception escaping a thread procedure there is a terminate() that takes
  // every output on the machine down with it — building a path string when
  // the process is out of memory is enough to reach here.
  try {
    static_cast<Watcher*>(self)->run();
  } catch (...) {
    // The endpoint keeps whatever graph was last published; it simply stops
    // following further changes.
  }
  return 0;
}

void Watcher::run() {
  // FILE_NAME covers a create, a rename and a delete; LAST_WRITE and SIZE
  // cover a file being rewritten in place, which is what the app does when it
  // flushes a profile. Together they are every way a configuration changes.
  constexpr DWORD kFilter = FILE_NOTIFY_CHANGE_LAST_WRITE |
                            FILE_NOTIFY_CHANGE_SIZE |
                            FILE_NOTIFY_CHANGE_FILE_NAME;

  for (;;) {
    // The configuration directory may not exist yet — the engine can be
    // attached before the app has ever written a profile. Waiting on the
    // deepest ancestor that does exist turns "not there yet" into an event
    // instead of a retry loop.
    const std::wstring watched = deepest_existing(config_dir_);
    if (watched.empty()) {
      break;
    }
    const HANDLE change =
        FindFirstChangeNotificationW(watched.c_str(), TRUE, kFilter);
    if (change == INVALID_HANDLE_VALUE) {
      log_.write("cannot watch " + to_utf8(watched) +
                 "; configuration changes will not be picked up");
      break;
    }
    const bool watching_config = watched == config_dir_;
    if (watching_config) {
      // A write that landed between the last resolve and this notification
      // being armed would otherwise never be seen.
      reload();
    }

    bool rearm = false;
    HANDLE handles[2] = {stop_event_, change};
    while (!rearm) {
      const DWORD woke = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
      if (woke == WAIT_OBJECT_0) {
        FindCloseChangeNotification(change);
        return;
      }
      if (woke != WAIT_OBJECT_0 + 1) {
        rearm = true;  // The handle went bad; rebuild the watch.
        break;
      }
      if (watching_config) {
        reload();
      } else if (is_directory(config_dir_)) {
        rearm = true;  // It exists now: watch it directly instead.
        break;
      }
      if (FindNextChangeNotification(change) == 0) {
        rearm = true;  // Usually the watched directory itself was removed.
      }
    }
    FindCloseChangeNotification(change);
  }

  // Nothing left to watch. Waiting on the stop event alone is not a poll and
  // costs nothing; the alternative — returning — would leave `stop()` joining
  // a thread that had already gone, which is fine, but this keeps the audio
  // running with whatever graph was last published rather than silently
  // abandoning the endpoint's ability to be reconfigured without a restart.
  WaitForSingleObject(stop_event_, INFINITE);
}

void Watcher::reload() {
  try {
    const FileProvider provider = [](const std::wstring& path) {
      return read_whole_file(path);
    };
    const Chain chain = resolve_chain(config_dir_, endpoint_, provider);

    const std::string next = signature_of(chain);
    if (have_signature_ && next == signature_) {
      return;
    }
    signature_ = next;
    have_signature_ = true;

    auto graph = std::make_unique<Graph>(chain, sample_rate_, channels_,
                                         max_frames_);
    // The audio thread is writing this graph's filter histories while they
    // are read. That race is deliberate and bounded: the values are one
    // biquad's last two samples, so the worst a stale or half-written one can
    // do is the click that carrying them over exists to avoid. The pointer
    // itself is safe — nothing is destroyed until `publish` below, and only
    // this thread destroys anything.
    if (const Graph* previous = slot_.active()) {
      graph->inherit_state(*previous);
    }
    log_chain(chain, *graph);
    publish(std::move(graph));
  } catch (const std::exception& error) {
    log_.write(std::string("configuration reload failed: ") + error.what());
  } catch (...) {
    log_.write("configuration reload failed");
  }
}

void Watcher::publish(std::unique_ptr<Graph> graph) {
  // Ownership is recorded before the graph becomes reachable: if this
  // allocation throws, the unique_ptr still holds the only reference and
  // frees it, and the audio thread never saw it.
  owned_.push_back(Retired{graph.get(), 0});
  Graph* const raw = graph.release();

  slot_.set_latency(raw->latency_frames());
  Graph* const unconsumed = slot_.publish(raw);
  // Read after the exchange: a block that increments this counter from here
  // on cannot have adopted anything older than what was just published.
  owned_.back().blocks_at_publish = slot_.blocks();

  if (unconsumed != nullptr) {
    // The exchange took it back out of `pending` still unread, which is proof
    // the audio thread never adopted it — the common case on an idle endpoint,
    // and what stops a user dragging a band with nothing playing from piling
    // up a graph per frame until the stream starts.
    const auto found = std::find_if(
        owned_.begin(), owned_.end(),
        [unconsumed](const Retired& at) { return at.graph == unconsumed; });
    if (found != owned_.end()) {
      delete found->graph;
      owned_.erase(found);
    }
  }
  reclaim();
}

void Watcher::reclaim() {
  const uint64_t blocks = slot_.blocks();
  // Entries are in publish order and their block counts never decrease, so
  // the newest entry whose grace period has elapsed is a boundary: every
  // entry before it was superseded by something the audio thread has already
  // taken up, and cannot be reached again.
  size_t boundary = 0;
  for (size_t at = owned_.size(); at > 0; --at) {
    if (blocks >= owned_[at - 1].blocks_at_publish + kGraceBlocks) {
      boundary = at - 1;
      break;
    }
  }
  for (size_t at = 0; at < boundary; ++at) {
    delete owned_[at].graph;
  }
  owned_.erase(owned_.begin(),
               owned_.begin() + static_cast<ptrdiff_t>(boundary));
}

void Watcher::log_chain(const Chain& chain, const Graph& graph) {
  std::string files;
  for (const std::wstring& file : chain.files_read) {
    if (!files.empty()) {
      files += ", ";
    }
    files += to_utf8(file_name_of(file));
  }
  std::string line = "chain loaded: files=" +
                     std::to_string(chain.files_read.size());
  if (!files.empty()) {
    line += " (" + files + ")";
  }
  line += " bands=" + std::to_string(chain.bands.size());
  line += " graphic=" + std::to_string(chain.graphic.size());
  line += " preamp=" + decibels(chain.preamp_db) + " dB";
  line += " ir=" + (chain.convolution_path.empty()
                        ? std::string("none")
                        : to_utf8(chain.convolution_path));
  line += " latency=" + std::to_string(graph.latency_frames()) + " frames";
  log_.write(line);

  for (const std::string& warning : graph.warnings()) {
    log_.write("graph warning: " + warning);
  }

  if (!chain.ignored.empty() &&
      logged_ignored_.size() < kMaxIgnoredSetsLogged) {
    const std::string set = join(chain.ignored);
    const bool seen = std::find(logged_ignored_.begin(), logged_ignored_.end(),
                                set) != logged_ignored_.end();
    if (!seen) {
      // Recorded before it is written, so reaching the cap silences the line
      // rather than turning it into one entry per reload.
      logged_ignored_.push_back(set);
      log_.write("ignored commands (this engine does not run them): " + set);
    }
  }

  std::string reason;
  if (graph.is_passthrough()) {
    if (!is_directory(config_dir_)) {
      reason = "no configuration directory";
    } else if (chain.files_read.empty()) {
      reason = "no config.txt in the configuration directory";
    } else if (!chain.matched) {
      reason = "no configuration block names this endpoint";
    } else {
      reason = "the configuration asks for nothing on this endpoint";
    }
  }
  if (!have_passthrough_reason_ || reason != passthrough_reason_) {
    passthrough_reason_ = reason;
    have_passthrough_reason_ = true;
    if (!reason.empty()) {
      log_.write("pass-through: " + reason);
    } else {
      log_.write("processing this endpoint");
    }
  }
}

}  // namespace fluideq_engine
