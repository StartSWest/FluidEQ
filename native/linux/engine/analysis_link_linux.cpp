/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `analysis_link.h` for Linux: the DSP page's meters, over a local socket.
 *
 * The protocol is the Windows engine's byte for byte (`analysis_link.cpp`)
 * — the same handshake, the same one-byte requests, the same snapshot from
 * the shared `analysis_snapshot.cpp` — so the app reads both with one
 * decoder. Only the transport differs: Windows connects to the app's named
 * pipe, this connects to the app's socket `analysis.sock` in the engine's
 * folder (`src/main/engineAnalysisPipe.ts` serves both).
 *
 * The class keeps its Windows members; on Linux each "handle" carries an
 * eventfd (as fd + 1, so null stays "none") and `thread_` a `std::thread`.
 * Nothing waits on a clock: the thread sleeps until the watcher asks it to
 * try the socket again (every reload, as on Windows), or until it is stopped.
 */

#include <poll.h>
#include <sys/eventfd.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <thread>

#include "../compat/wide_path.h"
#include "analysis_link.h"
#include "log.h"
#include "paths.h"

namespace fluideq_engine {

namespace {

int fd_of(HANDLE handle) noexcept {
  return static_cast<int>(reinterpret_cast<intptr_t>(handle)) - 1;
}

HANDLE handle_of(int fd) noexcept {
  return fd < 0 ? nullptr : reinterpret_cast<HANDLE>(static_cast<intptr_t>(fd) + 1);
}

void raise(HANDLE event) noexcept {
  if (event == nullptr) return;
  const uint64_t one = 1;
  const ssize_t wrote = ::write(fd_of(event), &one, sizeof(one));
  (void)wrote;
}

void lower(HANDLE event) noexcept {
  uint64_t count = 0;
  const ssize_t got = ::read(fd_of(event), &count, sizeof(count));
  (void)got;
}

/**
 * The user's runtime folder (`$XDG_RUNTIME_DIR`, private to the user and
 * where sockets belong), else the engine's own. The app names the same one
 * by the same rule (`engineAnalysisPipe.ts`). A socket's path is limited to
 * 107 bytes, which a deep engine folder can exceed: the runtime folder is
 * short on every desktop.
 */
std::string socket_path() {
  const char* runtime = std::getenv("XDG_RUNTIME_DIR");
  if (runtime != nullptr && runtime[0] == '/') {
    return std::string(runtime) + "/fluideq-analysis.sock";
  }
  return fluideq_linux::narrow_path(engine_root()) + "/analysis.sock";
}

/** What this process costs: resident set and CPU seconds in 100 ns units. */
void process_cost(uint64_t& working, uint64_t& cpu) {
  working = 0;
  cpu = 0;
  if (std::FILE* file = std::fopen("/proc/self/statm", "re")) {
    unsigned long long size = 0;
    unsigned long long resident = 0;
    if (std::fscanf(file, "%llu %llu", &size, &resident) == 2) {
      working = resident * static_cast<uint64_t>(sysconf(_SC_PAGESIZE));
    }
    std::fclose(file);
  }
  struct rusage usage {};
  if (getrusage(RUSAGE_SELF, &usage) == 0) {
    const auto micros = [](const timeval& at) {
      return static_cast<uint64_t>(at.tv_sec) * 1000000ull +
             static_cast<uint64_t>(at.tv_usec);
    };
    cpu = (micros(usage.ru_utime) + micros(usage.ru_stime)) * 10ull;
  }
}

}  // namespace

AnalysisLink::AnalysisLink(const std::wstring& endpoint, uint32_t rate,
                           uint32_t channels)
    : endpoint_(to_utf8(endpoint)), rate_(rate) {
  meters_ = feq_meters_create((std::min)(channels, 2u));
  if (meters_ == nullptr) return;
  feq_meters_set_sample_rate(meters_, rate);
  stop_ = handle_of(eventfd(0, EFD_CLOEXEC | EFD_NONBLOCK));
  // Raised once already: the first attempt needs nobody to ask for it.
  retry_ = handle_of(eventfd(1, EFD_CLOEXEC | EFD_NONBLOCK));
  if (stop_ == nullptr || retry_ == nullptr) return;
  try {
    thread_ = reinterpret_cast<HANDLE>(new std::thread([this] { entry(this); }));
  } catch (...) {
    thread_ = nullptr;
  }
}

AnalysisLink::~AnalysisLink() {
  if (thread_ != nullptr) {
    raise(stop_);
    auto* thread = reinterpret_cast<std::thread*>(thread_);
    thread->join();
    delete thread;
  }
  for (HANDLE event : {stop_, retry_}) {
    if (event != nullptr) ::close(fd_of(event));
  }
  feq_meters_destroy(meters_);
}

void AnalysisLink::retry() noexcept { raise(retry_); }

bool AnalysisLink::transfer(HANDLE pipe, void* data, DWORD size, bool writing) {
  auto* bytes = static_cast<unsigned char*>(data);
  DWORD offset = 0;
  while (offset < size) {
    pollfd waits[2] = {{fd_of(pipe), static_cast<short>(writing ? POLLOUT : POLLIN), 0},
                       {fd_of(stop_), POLLIN, 0}};
    if (::poll(waits, 2, -1) < 0) {
      if (errno == EINTR) continue;
      return false;
    }
    if (waits[1].revents != 0) return false;
    const ssize_t moved =
        writing ? ::send(fd_of(pipe), bytes + offset, size - offset,
                         MSG_NOSIGNAL | MSG_DONTWAIT)
                : ::recv(fd_of(pipe), bytes + offset, size - offset, MSG_DONTWAIT);
    if (moved < 0 && (errno == EAGAIN || errno == EINTR)) continue;
    if (moved <= 0) return false;
    offset += static_cast<DWORD>(moved);
  }
  return true;
}

unsigned AnalysisLink::entry(void* self) {
  auto* link = static_cast<AnalysisLink*>(self);
  try {
    link->run();
  } catch (...) {
    // Display failure never changes the audible graph.
    feq_meters_set_enabled(link->meters_, 0);
  }
  return 0;
}

void AnalysisLink::run() {
  const std::string path = socket_path();
  for (;;) {
    pollfd waits[2] = {{fd_of(stop_), POLLIN, 0}, {fd_of(retry_), POLLIN, 0}};
    if (::poll(waits, 2, -1) < 0) {
      if (errno == EINTR) continue;
      return;
    }
    if (waits[0].revents != 0) return;
    lower(retry_);

    const int sock = ::socket(AF_UNIX, SOCK_STREAM | SOCK_CLOEXEC, 0);
    if (sock < 0) continue;
    sockaddr_un address{};
    address.sun_family = AF_UNIX;
    if (path.size() >= sizeof(address.sun_path)) {
      ::close(sock);
      continue;
    }
    std::memcpy(address.sun_path, path.c_str(), path.size() + 1);
    // No app serving it yet is the ordinary case: the next reload asks again.
    if (::connect(sock, reinterpret_cast<sockaddr*>(&address), sizeof(address)) != 0) {
      ::close(sock);
      continue;
    }
    const HANDLE pipe = handle_of(sock);

    // The Windows handshake: ASCII endpoint GUID, zero padded, the bits of
    // what this engine answers (1 the preamp request, 2 process stats),
    // then the sample rate.
    unsigned char hello[44]{};
    std::memcpy(hello, endpoint_.data(), (std::min)(endpoint_.size(), size_t{39}));
    std::memcpy(hello + 40, &rate_, sizeof(rate_));
    hello[39] = 1 | 2;
    bool connected = transfer(pipe, hello, sizeof(hello), true);
    while (connected) {
      unsigned char command = 0;
      if (!transfer(pipe, &command, 1, false)) break;
      if (command == 2) {
        const uint32_t magic = 0x50414546;
        const float gain = output_gain.load(std::memory_order_relaxed);
        const uint32_t flags =
            (output_enabled.load(std::memory_order_relaxed) ? 1u : 0u) |
            (output_active.load(std::memory_order_relaxed) ? 2u : 0u);
        unsigned char packet[12]{};
        std::memcpy(packet, &magic, 4);
        std::memcpy(packet + 4, &gain, 4);
        std::memcpy(packet + 8, &flags, 4);
        uint32_t size = sizeof(packet);
        connected = transfer(pipe, &size, 4, true) && transfer(pipe, packet, size, true);
        continue;
      }
      if (command == 3) {
        const uint32_t magic = 0x53514546;  // "FEQS"
        uint64_t working = 0;
        uint64_t cpu = 0;
        process_cost(working, cpu);
        const auto pid = static_cast<uint32_t>(getpid());
        unsigned char packet[24]{};
        std::memcpy(packet, &magic, 4);
        std::memcpy(packet + 4, &pid, 4);
        std::memcpy(packet + 8, &working, 8);
        std::memcpy(packet + 16, &cpu, 8);
        uint32_t size = sizeof(packet);
        connected = transfer(pipe, &size, 4, true) && transfer(pipe, packet, size, true);
        continue;
      }
      feq_meters_set_enabled(meters_, command == 1 ? 1 : 0);
      if (command != 1) continue;
      const bool active = active_.load(std::memory_order_acquire);
      auto packet = active ? snapshot() : std::vector<unsigned char>{};
      uint32_t size = active ? static_cast<uint32_t>(packet.size()) : UINT32_MAX;
      connected = transfer(pipe, &size, sizeof(size), true);
      if (connected && !packet.empty()) {
        connected = transfer(pipe, packet.data(), size, true);
      }
    }
    feq_meters_set_enabled(meters_, 0);
    ::close(sock);
  }
}

}  // namespace fluideq_engine
