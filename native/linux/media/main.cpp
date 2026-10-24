/* FluidEQ — GPL-3.0-or-later */

// Linux had no session watcher, so the shared bar could neither describe nor
// control another player. MPRIS is the desktop's existing session interface;
// this adapter emits the Windows helper's lines through its shared encoder.
#include "player.h"

#include <poll.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>
#include <vector>

namespace {
namespace bus = fluideq_linux::bus;
using Player = fluideq_linux::media::Player;

class Watcher {
 public:
  Watcher(const bus::Api& api, pid_t owner) : a_(api), owner_(owner) {}
  ~Watcher() { if (connection_ != nullptr) a_.close_unref(connection_); }

  bool start() {
    if (a_.open_user(&connection_) < 0) return false;
    for (const char* match : {
        "type='signal',sender='org.freedesktop.DBus',"
        "interface='org.freedesktop.DBus',member='NameOwnerChanged',"
        "arg0namespace='org.mpris.MediaPlayer2'",
        "type='signal',path='/org/mpris/MediaPlayer2',"
        "interface='org.freedesktop.DBus.Properties',member='PropertiesChanged'",
        "type='signal',path='/org/mpris/MediaPlayer2',"
        "interface='org.mpris.MediaPlayer2.Player',member='Seeked'"}) {
      if (a_.add_match(connection_, nullptr, match, changed, this) < 0)
        return false;
    }
    return true;
  }

  int run() {
    std::string input;
    for (;;) {
      int processed = 0;
      do {
        processed = a_.process(connection_, nullptr);
      } while (processed > 0);
      if (processed < 0) return 2;
      if (dirty_) {
        dirty_ = false;
        refresh();
        // A call can dispatch a signal while reading the other players.
        if (dirty_) continue;
      }
      const int events = a_.get_events(connection_);
      const int fd = a_.get_fd(connection_);
      if (events < 0 || fd < 0) return 2;
      pollfd waits[2] = {{fd, static_cast<short>(events), 0},
                         {STDIN_FILENO, POLLIN, 0}};
      // Only D-Bus traffic or the owner's pipe wakes this process. No
      // periodic session scans, guessed readiness delay, or timer.
      if (::poll(waits, 2, -1) < 0) {
        if (errno == EINTR) continue;
        return 1;
      }
      if (waits[1].revents == 0) continue;
      char bytes[4096];
      const ssize_t count = ::read(STDIN_FILENO, bytes, sizeof(bytes));
      if (count == 0) return 0;
      if (count < 0) {
        if (errno == EINTR) continue;
        return 1;
      }
      input.append(bytes, static_cast<size_t>(count));
      for (size_t end = input.find('\n'); end != std::string::npos;
           end = input.find('\n')) {
        std::string line = input.substr(0, end);
        input.erase(0, end + 1);
        if (!line.empty() && line.back() == '\r') line.pop_back();
        if (!command(line)) return 1;
      }
      if (input.size() > 4096) return 1;
    }
  }

 private:
  static int changed(bus::Message*, void* data, bus::Error*) {
    static_cast<Watcher*>(data)->dirty_ = true;
    return 0;
  }

  bool own_player(const std::string& name) {
    bus::Message* reply = nullptr;
    if (a_.call_method(connection_, bus::kBus, bus::kBusPath, bus::kBus,
        "GetConnectionUnixProcessID", nullptr, &reply, "s", name.c_str()) < 0)
      return true;  // Gone before the lookup; not a usable session.
    uint32_t pid = 0;
    const int read = a_.read(reply, "u", &pid);
    a_.message_unref(reply);
    if (read <= 0) return true;
    // Chromium's embedded guests can register their own media sessions.
    // Exclude the owning Electron process and its descendants, or a song
    // inside FluidEQ appears again as another app and pauses itself.
    for (uint32_t previous = 0; pid > 1 && pid != previous;) {
      if (pid == static_cast<uint32_t>(owner_)) return true;
      std::ifstream stat("/proc/" + std::to_string(pid) + "/stat");
      std::string line;
      if (!std::getline(stat, line)) break;
      const size_t close = line.rfind(')');
      if (close == std::string::npos) break;
      std::istringstream fields(line.substr(close + 1));
      char state = 0;
      previous = pid;
      if (!(fields >> state >> pid)) break;
    }
    return false;
  }

  void refresh() {
    bus::Message* reply = nullptr;
    if (a_.call_method(connection_, bus::kBus, bus::kBusPath, bus::kBus,
                      "ListNames", nullptr, &reply, "") < 0) return;
    std::vector<std::string> names;
    if (a_.enter(reply, 'a', "s") > 0) {
      const char* name = nullptr;
      while (a_.read(reply, "s", &name) > 0) {
        if (name != nullptr &&
            std::string_view(name).rfind("org.mpris.MediaPlayer2.", 0) == 0)
          names.emplace_back(name);
      }
    }
    a_.message_unref(reply);
    std::sort(names.begin(), names.end());
    players_.clear();
    for (const auto& name : names) {
      if (own_player(name)) continue;
      Player player;
      if (fluideq_linux::media::read_player(a_, connection_, name, player))
        players_.push_back(std::move(player));
    }
    auto chosen = std::find_if(players_.begin(), players_.end(),
        [](const Player& p) { return p.reading.is_playing; });
    if (chosen == players_.end()) {
      chosen = std::find_if(players_.begin(), players_.end(),
          [&](const Player& p) { return p.reading.app == selected_; });
    }
    if (chosen == players_.end() && !players_.empty()) chosen = players_.begin();
    std::string line = fluideq_media::kNothingLine;
    std::string shape = line;
    if (chosen != players_.end()) {
      selected_ = chosen->reading.app;
      auto& reading = chosen->reading;
      for (const auto& p : players_)
        if (p.reading.is_playing) reading.playing.push_back(p.reading.app);
      if (!reading.title.empty()) {
        line = fluideq_media::reading_line(reading);
        shape = fluideq_media::reading_shape(reading);
        // Artwork I/O belongs to main's async adapter, never this bus loop.
        // The shared decoder ignores this extra Linux field.
        const std::string art = ",\"artUrl\":" +
            fluideq_media::json_string(chosen->artwork) + "}";
        line.pop_back(); line += art;
        shape.pop_back(); shape += art;
      }
    } else {
      selected_.clear();
    }
    if (shape != previous_) {
      previous_ = shape;
      std::puts(line.c_str());
      std::fflush(stdout);
    }
  }

  void invoke(const Player& player, const char* method,
              const int64_t* position = nullptr) {
    if (!player.can_control) return;
    bus::Message* reply = nullptr;
    if (position == nullptr) {
      a_.call_method(connection_, player.reading.app.c_str(), bus::kPath,
          bus::kPlayer, method, nullptr, &reply, "");
    } else if (player.reading.can_seek) {
      a_.call_method(connection_, player.reading.app.c_str(), bus::kPath,
          bus::kPlayer, "SetPosition", nullptr, &reply, "ox",
          player.track.c_str(), *position);
    }
    if (reply != nullptr) a_.message_unref(reply);
  }

  bool command(const std::string& line) {
    const size_t space = line.find(' ');
    const std::string verb = line.substr(0, space);
    const std::string value = space == std::string::npos ? "" : line.substr(space + 1);
    if (verb != "next" && verb != "previous" && verb != "playPause" &&
        verb != "pause" && verb != "stop" && verb != "seek" &&
        verb != "pauseOthers") return false;
    int64_t position = 0;
    if (verb == "seek") {
      char* end = nullptr;
      const double ms = std::strtod(value.c_str(), &end);
      if (end == value.c_str() || *end != '\0' || !std::isfinite(ms) ||
          ms < 0 || ms > 9e12) return false;
      position = static_cast<int64_t>(std::llround(ms * 1000));
    }
    refresh();
    for (const auto& player : players_) {
      if (verb == "pauseOthers") {
        if (player.reading.is_playing && player.reading.app != value)
          invoke(player, "Pause");
      } else if (player.reading.app == selected_) {
        if (verb == "seek") invoke(player, "SetPosition", &position);
        else if (verb == "next" && player.reading.can_next) invoke(player, "Next");
        else if (verb == "previous" && player.reading.can_previous)
          invoke(player, "Previous");
        else if (verb == "playPause") invoke(player, "PlayPause");
        else if (verb == "pause") invoke(player, "Pause");
        else if (verb == "stop") invoke(player, "Stop");
      }
    }
    dirty_ = true;
    return true;
  }

  const bus::Api& a_;
  pid_t owner_;
  bus::Connection* connection_ = nullptr;
  bool dirty_ = true;
  std::vector<Player> players_;
  std::string selected_;
  std::string previous_;
};
}  // namespace

int main(int argc, char** argv) {
  std::signal(SIGPIPE, SIG_IGN);
  pid_t owner = getppid();
  if (argc > 1) {
    char* end = nullptr;
    const long pid = std::strtol(argv[1], &end, 10);
    if (end == argv[1] || *end != '\0' || pid < 1 || pid > INT32_MAX) return 1;
    owner = static_cast<pid_t>(pid);
  }
  std::string error;
  const bus::Api* api = bus::api(error);
  if (api != nullptr) {
    Watcher watcher(*api, owner);
    if (watcher.start()) return watcher.run();
    error = "the desktop session bus could not be opened";
  }
  std::fprintf(stderr, "FluidEQ-Media: %s\n", error.c_str());
  std::puts("null");
  return 2;
}
