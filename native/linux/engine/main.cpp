/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Engine for Linux: the system-wide engine as a process of the
 * user's, started by FluidEQ.
 *
 *   FluidEQ-Engine [--target <node.name>] [--no-default] [--root <dir>]
 *                  [--owner-fd <n>] [--exit-with-parent]
 *
 * It runs until it is told to stop — SIGTERM, SIGINT, SIGHUP, the owner fd
 * closing (FluidEQ quitting, crashing or being killed closes it for us), or
 * the parent dying with `--exit-with-parent` — and then gives the default
 * output back before its sink goes. That is the Linux form of the Windows
 * rule that quitting FluidEQ turns the engine off: here there is nothing
 * left behind to turn off.
 *
 * Exit codes: 0 stopped as asked, 1 bad command line, 2 no sound server it
 * can use, 3 another engine is already running for this user.
 */

#include <fcntl.h>
#include <poll.h>
#include <sys/file.h>
#include <sys/prctl.h>
#include <sys/signalfd.h>
#include <sys/stat.h>
#include <unistd.h>

#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

#include "../compat/sound_server.h"
#include "../compat/wide_path.h"
#include "log.h"
#include "paths.h"
#include "pulse_router.h"
#if FEQ_LINUX_HAS_PIPEWIRE
#include "pw_router.h"
#endif

namespace {

constexpr int kExitBadArguments = 1;
constexpr int kExitNoSoundServer = 2;
constexpr int kExitAlreadyRunning = 3;

struct Arguments {
  fluideq_linux::RouterOptions router;
  /** `auto` (PipeWire when it runs, else PulseAudio), `pipewire` or `pulse`. */
  std::string server = "auto";
  int owner_fd = -1;
  bool exit_with_parent = false;
};

void usage() {
  std::fprintf(stderr,
               "usage: FluidEQ-Engine [--target <name>] [--no-default] "
               "[--server auto|pipewire|pulse]\n"
               "                      [--root <dir>] [--owner-fd <n>] "
               "[--exit-with-parent]\n");
}

/**
 * PipeWire where it runs — the engine then sits in the server's own cycle —
 * and PulseAudio otherwise. PipeWire's PulseAudio layer would take the
 * PulseAudio route too, but at a second buffer's delay for nothing.
 */
std::unique_ptr<fluideq_linux::SoundRouter> open_router(const Arguments& args,
                                                        std::string& error) {
  const bool pipewire =
      args.server == "pipewire" ||
      (args.server == "auto" && fluideq_linux::pipewire_running());
#if FEQ_LINUX_HAS_PIPEWIRE
  if (pipewire) {
    if (auto router = fluideq_linux::PipeWireRouter::create(args.router, error)) {
      return router;
    }
    if (args.server == "pipewire") return nullptr;
  }
#else
  if (pipewire) error = "this build has no PipeWire support";
  if (args.server == "pipewire") return nullptr;
#endif
  std::string why;
  if (auto router = fluideq_linux::PulseRouter::create(args.router, why)) {
    return router;
  }
  error = error.empty() ? why : error + "; " + why;
  return nullptr;
}

bool parse(int argc, char** argv, Arguments& out) {
  for (int at = 1; at < argc; ++at) {
    const std::string arg = argv[at];
    const bool has_value = at + 1 < argc;
    if (arg == "--target" && has_value) {
      out.router.target = argv[++at];
    } else if (arg == "--server" && has_value) {
      out.server = argv[++at];
      if (out.server != "auto" && out.server != "pipewire" &&
          out.server != "pulse") {
        return false;
      }
    } else if (arg == "--no-default") {
      out.router.take_default = false;
    } else if (arg == "--root" && has_value) {
      setenv("FLUIDEQ_ENGINE_ROOT", argv[++at], 1);
    } else if (arg == "--owner-fd" && has_value) {
      char* end = nullptr;
      const long fd = std::strtol(argv[++at], &end, 10);
      if (end == nullptr || *end != '\0' || fd < 0 || fd > 65535) return false;
      out.owner_fd = static_cast<int>(fd);
    } else if (arg == "--exit-with-parent") {
      out.exit_with_parent = true;
    } else if (arg == "--version") {
      std::printf("FluidEQ-Engine %s\n", FEQ_ENGINE_FILE_VERSION);
      std::exit(0);
    } else {
      return false;
    }
  }
  return true;
}

/**
 * Reads what FluidEQ wrote on its link and acts on each whole line. False
 * once the link has ended, which is the engine's cue to stop.
 *
 *   output <name>   play to that output (the desktop's default moves there,
 *                   then back to "FluidEQ", as when the listener picks one
 *                   in the system's sound settings)
 */
bool follow_owner(int fd, std::string& pending,
                  fluideq_linux::SoundRouter& router,
                  fluideq_engine::Log& log) {
  char buffer[4096];
  const ssize_t got = ::read(fd, buffer, sizeof(buffer));
  if (got < 0) return errno == EINTR || errno == EAGAIN;
  if (got == 0) return false;
  pending.append(buffer, static_cast<size_t>(got));
  // A line is a command; a stream of text that never ends one is not, and
  // is not kept growing.
  if (pending.size() > 64 * 1024) pending.clear();
  for (size_t end = pending.find('\n'); end != std::string::npos;
       end = pending.find('\n')) {
    std::string line = pending.substr(0, end);
    pending.erase(0, end + 1);
    if (!line.empty() && line.back() == '\r') line.pop_back();
    constexpr const char* kOutput = "output ";
    if (line.rfind(kOutput, 0) == 0 && line.size() > std::strlen(kOutput)) {
      const std::string name = line.substr(std::strlen(kOutput));
      log.write("FluidEQ asked for output " + name);
      router.select_output(name);
    } else if (!line.empty()) {
      log.write("FluidEQ sent a command this engine does not know: " + line);
    }
  }
  return true;
}

/** `mkdir -p` for the engine's own folder; true when it exists after. */
bool make_directories(const std::string& path) {
  for (size_t at = 1; at <= path.size(); ++at) {
    if (at == path.size() || path[at] == '/') {
      const std::string part = path.substr(0, at);
      if (::mkdir(part.c_str(), 0755) != 0 && errno != EEXIST) return false;
    }
  }
  struct stat info {};
  return ::stat(path.c_str(), &info) == 0 && S_ISDIR(info.st_mode);
}

}  // namespace

int main(int argc, char** argv) {
  Arguments args;
  if (!parse(argc, argv, args)) {
    usage();
    return kExitBadArguments;
  }
  if (args.exit_with_parent) {
    const pid_t parent = getppid();
    // SIGTERM is blocked for the main loop below. If a sound-server call
    // stalls before that loop, a dead owner's signal stays pending forever,
    // retaining the engine lock and inherited app sockets across restarts.
    // Normal quit still closes the owner pipe for graceful route cleanup;
    // an owner that has already died must never leave an orphan behind.
    prctl(PR_SET_PDEATHSIG, SIGKILL);
    // The parent may have died between fork and prctl; then nothing will
    // ever send the signal.
    if (getppid() != parent) return 0;
  }

  const std::string root =
      fluideq_linux::narrow_path(fluideq_engine::engine_root());
  if (root.empty() || !make_directories(root)) {
    std::fprintf(stderr, "FluidEQ-Engine: no engine folder (%s)\n",
                 root.c_str());
    return kExitNoSoundServer;
  }

  // One engine per user: a second would add a second FluidEQ output and
  // fight the first over the default. The lock goes with the process.
  const std::string lock_path = root + "/engine.lock";
  const int lock = ::open(lock_path.c_str(), O_RDWR | O_CREAT | O_CLOEXEC, 0644);
  if (lock < 0 || ::flock(lock, LOCK_EX | LOCK_NB) != 0) {
    std::fprintf(stderr, "FluidEQ-Engine: already running for this user\n");
    return kExitAlreadyRunning;
  }

  sigset_t stops;
  sigemptyset(&stops);
  sigaddset(&stops, SIGINT);
  sigaddset(&stops, SIGTERM);
  sigaddset(&stops, SIGHUP);
  // Blocked before PipeWire starts its threads, so they inherit the mask and
  // the signals arrive here, on the fd, and nowhere else.
  pthread_sigmask(SIG_BLOCK, &stops, nullptr);
  std::signal(SIGPIPE, SIG_IGN);
  const int signals = signalfd(-1, &stops, SFD_CLOEXEC);

  fluideq_engine::Log log(fluideq_engine::no_endpoint());
  log.write(std::string("engine starting (") + FEQ_CORE_VERSION + ")");

  std::string error;
  std::unique_ptr<fluideq_linux::SoundRouter> router = open_router(args, error);
  if (!router) {
    log.write("no sound server: " + error);
    std::fprintf(stderr, "FluidEQ-Engine: %s\n", error.c_str());
    return kExitNoSoundServer;
  }

  pollfd waits[3] = {{signals, POLLIN, 0},
                     {router->lost_fd(), POLLIN, 0},
                     {args.owner_fd, POLLIN, 0}};
  const nfds_t count = args.owner_fd >= 0 ? 3 : 2;
  std::string owner_text;
  const char* why = "stopped";
  for (;;) {
    if (::poll(waits, count, -1) < 0) {
      if (errno == EINTR) continue;
      why = "wait failed";
      break;
    }
    if (waits[0].revents != 0) {
      signalfd_siginfo info{};
      const ssize_t got = ::read(signals, &info, sizeof(info));
      (void)got;
      why = "asked to stop";
      break;
    }
    if (waits[1].revents != 0) {
      why = "the sound server went away";
      break;
    }
    if (count == 3 && waits[2].revents != 0) {
      // FluidEQ holds the other end. What it writes are commands, a line
      // each; the end of the stream — FluidEQ quitting, crashing or killed —
      // is the engine's cue to stop.
      if (!follow_owner(args.owner_fd, owner_text, *router, log)) {
        why = "FluidEQ closed its link";
        break;
      }
    }
  }
  log.write(std::string("engine stopping: ") + why);
  router->shutdown();
  router.reset();
  log.write("engine stopped");
  return 0;
}
