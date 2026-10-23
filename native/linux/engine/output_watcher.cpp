/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Linux watcher's thread and its reload. The reload is the Windows
 * engine's `Watcher::load_chain` (`watcher_load.cpp`) without the parts this
 * engine has no counterpart for yet — see `output_watcher.h`.
 */

#include "output_watcher.h"

#include <dirent.h>
#include <poll.h>
#include <sys/eventfd.h>
#include <sys/inotify.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <exception>
#include <utility>

#include "../compat/wide_path.h"
#include "chain_signature.h"
#include "config_file.h"
#include "dsp_chain.h"
#include "paths.h"

namespace fluideq_linux {

using fluideq_engine::Chain;
using fluideq_engine::FileProvider;
using fluideq_engine::OwnedGraph;
using fluideq_engine::RoomHead;

namespace {

// A file landing whole (the app writes aside and renames), an editor saving
// in place, a file or folder appearing or going, and the watched folder
// itself going. Never IN_MODIFY: that is one event per write() of a file
// still being written, and every one would be a reload of half a file.
constexpr uint32_t kConfigEvents = IN_CLOSE_WRITE | IN_MOVED_TO |
                                   IN_MOVED_FROM | IN_CREATE | IN_DELETE |
                                   IN_DELETE_SELF | IN_MOVE_SELF | IN_ONLYDIR;
// Waiting for the config folder to exist: only something appearing matters.
constexpr uint32_t kAncestorEvents =
    IN_CREATE | IN_MOVED_TO | IN_DELETE_SELF | IN_MOVE_SELF | IN_ONLYDIR;

void signal(int fd) noexcept {
  if (fd < 0) return;
  const uint64_t one = 1;
  const ssize_t wrote = ::write(fd, &one, sizeof(one));
  (void)wrote;  // An eventfd only refuses at 2^64-1 pending, i.e. never.
}

void drain(int fd) noexcept {
  uint64_t count = 0;
  const ssize_t got = ::read(fd, &count, sizeof(count));
  (void)got;  // Non-blocking: nothing pending is not an error.
}

std::vector<std::pair<std::string, unsigned>> latency_parts_of(
    const fluideq_engine::Graph& graph) {
  const fluideq_engine::Graph::LatencyParts& parts = graph.latency_parts();
  // The Windows watcher's names and order (`watcher_load.cpp`): the app
  // reads both platforms' statuses with one parser.
  const std::pair<const char*, uint32_t> named[] = {
      {"leveler", parts.rack.leveler},
      {"restoration", parts.rack.restoration},
      {"deEsser", parts.rack.deesser},
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
  std::vector<std::pair<std::string, unsigned>> out;
  const auto& active = graph.active_stages();
  for (const auto& one : named) {
    if (one.second > 0u ||
        std::find(active.begin(), active.end(), one.first) != active.end()) {
      out.emplace_back(one.first, one.second);
    }
  }
  return out;
}

}  // namespace

OutputWatcher::OutputWatcher(GraphSlot& slot, fluideq_engine::Log& log,
                             Endpoint endpoint, std::wstring config_dir,
                             uint32_t sample_rate, uint32_t channels,
                             uint32_t max_frames, unsigned long channel_mask,
                             std::function<void()> latency_changed)
    : slot_(slot),
      log_(log),
      endpoint_(std::move(endpoint)),
      config_dir_(std::move(config_dir)),
      sample_rate_(sample_rate),
      channels_(channels),
      max_frames_(max_frames),
      channel_mask_(channel_mask),
      latency_changed_(std::move(latency_changed)) {}

OutputWatcher::~OutputWatcher() {
  stop();
  release_graphs();
}

void OutputWatcher::load_initial() {
  try {
    leveling_ = fluideq_engine::leveling_for(endpoint_.guid);
  } catch (...) {
    log_.write("song leveling memory unavailable; leveling relearns per stream");
  }
  open_level_prediction();
  if (!fluideq_engine::is_directory(config_dir_)) {
    log_.write("configuration directory " + fluideq_engine::to_utf8(config_dir_) +
               " is not present; waiting for it");
  }
  reload();
}

bool OutputWatcher::start() {
  stop_fd_ = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  status_fd_ = eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK);
  inotify_ = inotify_init1(IN_CLOEXEC | IN_NONBLOCK);
  if (stop_fd_ < 0 || status_fd_ < 0 || inotify_ < 0) {
    log_.write("could not create the watcher's descriptors; configuration "
               "changes will not be picked up");
    stop();
    return false;
  }
  try {
    thread_ = std::thread([this] {
      try {
        run();
      } catch (...) {
        // The output keeps the graph last published; it stops following
        // changes, which the status says (`reload-failed` on the next try).
      }
    });
  } catch (...) {
    log_.write("could not start the configuration watcher");
    stop();
    return false;
  }
  return true;
}

void OutputWatcher::stop() noexcept {
  if (thread_.joinable()) {
    signal(stop_fd_);
    thread_.join();
    report_status(false);
  }
  for (int* fd : {&stop_fd_, &status_fd_, &inotify_}) {
    if (*fd >= 0) ::close(*fd);
    *fd = -1;
  }
  watch_ = -1;
}

void OutputWatcher::release_graphs() noexcept {
  slot_.clear();
  rack_source_ = nullptr;
  for (const OwnedGraph& retired : owned_) delete retired.graph;
  owned_.clear();
}

void OutputWatcher::say_it_carried() noexcept { signal(status_fd_); }
void OutputWatcher::say_it_was_slow() noexcept { signal(status_fd_); }

bool OutputWatcher::stop_requested() const noexcept {
  if (stop_fd_ < 0) return false;
  pollfd one{stop_fd_, POLLIN, 0};
  return ::poll(&one, 1, 0) > 0;
}

bool OutputWatcher::change_pending() const noexcept {
  if (inotify_ < 0 || !watching_config_) return false;
  pollfd one{inotify_, POLLIN, 0};
  return ::poll(&one, 1, 0) > 0;
}

bool OutputWatcher::arm_watch() {
  if (watch_ >= 0) inotify_rm_watch(inotify_, watch_);
  watch_ = -1;
  const std::wstring watched = fluideq_engine::deepest_existing(config_dir_);
  if (watched.empty()) return false;
  watching_config_ = watched == config_dir_;
  watch_ = inotify_add_watch(inotify_,
                             fluideq_linux::narrow_path(watched).c_str(),
                             watching_config_ ? kConfigEvents : kAncestorEvents);
  if (watch_ < 0) {
    log_.write("cannot watch " + fluideq_engine::to_utf8(watched) +
               "; configuration changes will not be picked up");
    return false;
  }
  return true;
}

bool OutputWatcher::drain_changes() noexcept {
  bool rearm = false;
  alignas(inotify_event) char buffer[4096];
  for (;;) {
    const ssize_t got = ::read(inotify_, buffer, sizeof(buffer));
    if (got <= 0) break;  // EAGAIN: everything pending has been read.
    for (ssize_t at = 0; at < got;) {
      const auto* event = reinterpret_cast<const inotify_event*>(buffer + at);
      if ((event->mask & (IN_IGNORED | IN_DELETE_SELF | IN_MOVE_SELF |
                          IN_Q_OVERFLOW)) != 0) {
        rearm = true;
      }
      at += static_cast<ssize_t>(sizeof(inotify_event) + event->len);
    }
  }
  return rearm;
}

void OutputWatcher::run() {
  for (;;) {
    if (!arm_watch()) {
      unwatched_ = true;
      report_status(true);
      break;
    }
    if (watching_config_) {
      // A write between the last resolve and this watch would otherwise
      // never be seen.
      reload();
    }
    bool rearm = false;
    while (!rearm) {
      pollfd waits[3] = {{stop_fd_, POLLIN, 0},
                         {status_fd_, POLLIN, 0},
                         {inotify_, POLLIN, 0}};
      if (::poll(waits, 3, -1) < 0) {
        if (errno == EINTR) continue;
        return;
      }
      if (waits[0].revents != 0) return;
      if (waits[1].revents != 0) {
        drain(status_fd_);
        log_timing();
        report_status(true);
      }
      if (waits[2].revents == 0) continue;
      // Drained before the reload, as the Windows watcher re-arms before
      // its own: a write landing during the reload is then pending, and
      // tells a level being worked out that a newer edit made it worthless.
      rearm = drain_changes();
      if (!watching_config_) {
        rearm = true;  // Something appeared on the way to the config folder.
      } else {
        reload();
      }
    }
  }
  // Nothing left to watch: keep answering status wakes until stopped, so an
  // output with no configuration folder still tells the app it carries sound.
  for (;;) {
    pollfd waits[2] = {{stop_fd_, POLLIN, 0}, {status_fd_, POLLIN, 0}};
    if (::poll(waits, 2, -1) < 0) {
      if (errno == EINTR) continue;
      return;
    }
    if (waits[0].revents != 0) return;
    drain(status_fd_);
    log_timing();
    report_status(true);
  }
}

std::optional<std::string> OutputWatcher::read_endpoint_file(
    const wchar_t* stem) const {
  const auto name = fluideq_engine::endpoint_config_name(stem, endpoint_);
  if (!name) return std::nullopt;
  return fluideq_engine::read_config_file(config_dir_ + L"/" + *name);
}

void OutputWatcher::reload() {
  load_chain();
  settle_level();
}

void OutputWatcher::load_chain() {
  try {
    const FileProvider provider = [](const std::wstring& path) {
      return fluideq_engine::read_config_file(path);
    };
    const Chain chain =
        fluideq_engine::resolve_chain(config_dir_, endpoint_, provider);
    if (stop_requested()) return;
    const bool finished_song = follow_programme();

    std::optional<std::string> head_text =
        read_endpoint_file(fluideq_engine::kRoomHeadFileStem);
    if (head_text != room_head_text_) {
      std::optional<RoomHead> parsed =
          head_text ? fluideq_engine::parse_room_head(
                          *head_text, static_cast<double>(sample_rate_))
                    : std::nullopt;
      room_head_.swap(parsed);
      room_head_text_.swap(head_text);
      room_head_generation_ += 1;
    }
    if (stop_requested()) return;

    // The app publishes the head before its rack; until both name the same
    // head, keep the complete graph already playing.
    FeqChainSettings requested{};
    if (room_head_ && room_head_->size >= 0 &&
        fluideq_engine::decode_dsp_chain(chain.dsp_values, &requested) &&
        requested.enabled != 0 && requested.room.enabled != 0 &&
        requested.room.head != room_head_->size) {
      return;
    }

    std::string next = fluideq_engine::signature_of(chain) + "|o=1|h=" +
                       std::to_string(room_head_generation_);
    if (have_signature_ && next == signature_) {
      if (finished_song) report_status(true);
      return;
    }

    const RoomHead* const head = room_head_ ? &*room_head_ : nullptr;
    const Graph* const rack_from =
        rack_source_head_ == room_head_generation_ ? rack_source_ : nullptr;
    const Graph* const running = slot_.active();
    const bool follows_processing =
        running != nullptr && !running->is_passthrough();
    auto graph = std::make_unique<Graph>(
        chain, sample_rate_, channels_, max_frames_,
        leveling_ ? leveling_->memory() : nullptr, channel_mask_, head,
        follows_processing, rack_from, nullptr);
    const bool rack_kept =
        rack_from != nullptr && graph->rack_is_shared_with(*rack_from);
    if (!graph->room_note().empty() && !rack_kept) {
      log_.write(graph->room_note());
    }
    if (stop_requested()) return;
    graph->request_state_transfer();
    const bool level_owed = plan_level(chain, *graph);
    if (const Graph* previous = slot_.active()) {
      const uint32_t silenced = previous->silenced_blocks();
      if (silenced > 0) {
        log_.write("silenced " + std::to_string(silenced) +
                   " block(s) whose samples were not all real numbers");
      }
    }
    log_chain(chain, *graph);
    const bool processing = !graph->is_passthrough();
    std::vector<std::string> problems = graph->problems();
    room_state_ = graph->room_state();
    latency_ = processing ? graph->latency_frames() : 0u;
    latency_active_ =
        processing ? graph->active_stages() : std::vector<std::string>{};
    latency_parts_ = processing ? latency_parts_of(*graph)
                                : std::vector<std::pair<std::string, unsigned>>{};
    game_mode_ = processing && graph->low_latency();
    publish(std::move(graph));
    owe_level(chain, level_owed);
    signature_.swap(next);
    have_signature_ = true;
    last_processing_ = processing;
    graph_problems_.swap(problems);
    reload_failed_ = false;
    report_status(true);
  } catch (const std::exception& error) {
    log_.write(std::string("configuration reload failed: ") + error.what());
    reload_failed_ = true;
    report_status(true);
  } catch (...) {
    log_.write("configuration reload failed");
    reload_failed_ = true;
    report_status(true);
  }
}

void OutputWatcher::publish(std::unique_ptr<Graph> graph) {
  graph->own_history(history_);
  owned_.push_back(OwnedGraph{graph.get(), 0});
  Graph* const raw = graph.release();
  rack_source_ = raw;
  rack_source_head_ = room_head_generation_;

  slot_.set_latency(raw->latency_frames());
  Graph* const unconsumed = slot_.publish(raw);
  owned_.back().blocks_at_publish = slot_.blocks();
  if (unconsumed != nullptr) {
    const auto found = std::find_if(
        owned_.begin(), owned_.end(),
        [unconsumed](const OwnedGraph& at) { return at.graph == unconsumed; });
    if (found != owned_.end()) {
      delete found->graph;
      owned_.erase(found);
    }
  }
  reclaim();
  const uint32_t latency = slot_.latency();
  if (latency != latency_reported_) {
    latency_reported_ = latency;
    if (latency_changed_) latency_changed_();
  }
}

void OutputWatcher::reclaim() {
  fluideq_engine::reclaim_graphs(owned_, slot_.blocks());
}

}  // namespace fluideq_linux
