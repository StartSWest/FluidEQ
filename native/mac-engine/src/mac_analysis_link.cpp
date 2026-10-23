/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "mac_analysis_link.h"

#include <mach/mach.h>
#include <sys/resource.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <cstring>
#include <utility>

namespace fluideq_engine {

namespace {

/** "FEAP" and "FEQS", the effect's own reply magics (`analysis_link.cpp`). */
constexpr uint32_t kPreampMagic = 0x50414546;
constexpr uint32_t kStatsMagic = 0x53514546;
/** What the effect's frame size says when the audio has stopped. */
constexpr uint32_t kNoAudio = 0xFFFFFFFFu;

bool send_all(int socket, const void* data, size_t size) {
  const auto* bytes = static_cast<const unsigned char*>(data);
  size_t done = 0;
  while (done < size) {
    const ssize_t sent = ::send(socket, bytes + done, size - done, 0);
    if (sent < 0 && errno == EINTR) {
      continue;
    }
    if (sent <= 0) {
      return false;
    }
    done += static_cast<size_t>(sent);
  }
  return true;
}

bool receive_byte(int socket, unsigned char& out) {
  for (;;) {
    const ssize_t got = ::recv(socket, &out, 1, 0);
    if (got < 0 && errno == EINTR) {
      continue;
    }
    return got == 1;
  }
}

int connect_to(const std::string& path) {
  sockaddr_un address{};
  if (path.empty() || path.size() >= sizeof(address.sun_path)) {
    return -1;
  }
  const int socket = ::socket(AF_UNIX, SOCK_STREAM, 0);
  if (socket < 0) {
    return -1;
  }
  // A reply to an app that has gone must fail the write, not end this
  // process — which would take the sound with it.
  const int on = 1;
  ::setsockopt(socket, SOL_SOCKET, SO_NOSIGPIPE, &on, sizeof(on));
  address.sun_family = AF_UNIX;
  std::memcpy(address.sun_path, path.data(), path.size());
  if (::connect(socket, reinterpret_cast<const sockaddr*>(&address),
                sizeof(address)) != 0) {
    ::close(socket);
    return -1;
  }
  return socket;
}

/**
 * What this process costs, for the app's Processes list: resident memory,
 * and CPU time in the 100 ns ticks the effect's `GetProcessTimes` counts in.
 */
void measure_self(uint64_t& resident, uint64_t& cpu_ticks) {
  mach_task_basic_info_data_t info{};
  mach_msg_type_number_t count = MACH_TASK_BASIC_INFO_COUNT;
  resident = task_info(mach_task_self(), MACH_TASK_BASIC_INFO,
                       reinterpret_cast<task_info_t>(&info),
                       &count) == KERN_SUCCESS
                 ? info.resident_size
                 : 0;
  rusage usage{};
  if (::getrusage(RUSAGE_SELF, &usage) != 0) {
    cpu_ticks = 0;
    return;
  }
  const auto ticks = [](const timeval& time) {
    return static_cast<uint64_t>(time.tv_sec) * 10000000ULL +
           static_cast<uint64_t>(time.tv_usec) * 10ULL;
  };
  cpu_ticks = ticks(usage.ru_utime) + ticks(usage.ru_stime);
}

}  // namespace

AnalysisLink::AnalysisLink(std::string socket_path)
    : path_(std::move(socket_path)) {
  meters_ = feq_meters_create(2);
  if (meters_ != nullptr) {
    worker_ = std::thread([this] { run(); });
  }
}

AnalysisLink::~AnalysisLink() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    stopping_ = true;
    if (socket_ >= 0) {
      ::shutdown(socket_, SHUT_RDWR);
    }
  }
  wake_.notify_all();
  if (worker_.joinable()) {
    worker_.join();
  }
  feq_meters_destroy(meters_);
}

void AnalysisLink::follow(const std::string& endpoint, uint32_t rate) {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (endpoint == endpoint_ && rate == rate_) {
      return;
    }
    endpoint_ = endpoint;
    rate_ = rate;
    if (meters_ != nullptr && rate > 0) {
      feq_meters_set_sample_rate(meters_, static_cast<double>(rate));
    }
    // The connection said hello for the old pair; the next one says it for
    // this one.
    if (socket_ >= 0) {
      ::shutdown(socket_, SHUT_RDWR);
    }
    wanted_ = true;
  }
  wake_.notify_all();
}

void AnalysisLink::retry() noexcept {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    wanted_ = true;
  }
  wake_.notify_all();
}

void AnalysisLink::quiet() noexcept {
  active_.store(false, std::memory_order_release);
  output_active.store(false, std::memory_order_relaxed);
}

void AnalysisLink::run() {
  std::unique_lock<std::mutex> lock(mutex_);
  for (;;) {
    wake_.wait(lock, [this] {
      return stopping_ || (wanted_ && !endpoint_.empty());
    });
    if (stopping_) {
      return;
    }
    wanted_ = false;
    const std::string endpoint = endpoint_;
    const uint32_t rate = rate_;
    lock.unlock();
    const int socket = connect_to(path_);
    lock.lock();
    // Not listening yet, or gone: the next reload asks again.
    if (socket < 0) {
      continue;
    }
    if (stopping_) {
      ::close(socket);
      return;
    }
    socket_ = socket;
    lock.unlock();
    try {
      serve(socket, endpoint, rate);
    } catch (...) {
      // A display that fails changes nothing that is heard.
    }
    feq_meters_set_enabled(meters_, 0);
    lock.lock();
    // Forgotten before it is closed, under the lock `follow` and the
    // destructor take, so neither can shut down a number the system has
    // already handed to somebody else.
    socket_ = -1;
    ::close(socket);
  }
}

void AnalysisLink::serve(int socket, const std::string& endpoint,
                         uint32_t rate) {
  // The effect's handshake: the endpoint in ASCII, zero padded; what this
  // engine answers, a bit each (1 the preamp request, 2 the process stats);
  // then the rate.
  unsigned char hello[44]{};
  std::memcpy(hello, endpoint.data(), std::min(endpoint.size(), size_t{39}));
  hello[39] = 1 | 2;
  std::memcpy(hello + 40, &rate, sizeof(rate));
  if (!send_all(socket, hello, sizeof(hello))) {
    return;
  }
  unsigned char command = 0;
  while (receive_byte(socket, command)) {
    if (command == 2) {
      const float gain = output_gain.load(std::memory_order_relaxed);
      const uint32_t flags =
          (output_enabled.load(std::memory_order_relaxed) ? 1u : 0u) |
          (output_active.load(std::memory_order_relaxed) ? 2u : 0u);
      unsigned char packet[12]{};
      std::memcpy(packet, &kPreampMagic, 4);
      std::memcpy(packet + 4, &gain, 4);
      std::memcpy(packet + 8, &flags, 4);
      const uint32_t size = sizeof(packet);
      if (!send_all(socket, &size, 4) || !send_all(socket, packet, size)) {
        return;
      }
      continue;
    }
    if (command == 3) {
      uint64_t resident = 0;
      uint64_t cpu = 0;
      measure_self(resident, cpu);
      const auto pid = static_cast<uint32_t>(::getpid());
      unsigned char packet[24]{};
      std::memcpy(packet, &kStatsMagic, 4);
      std::memcpy(packet + 4, &pid, 4);
      std::memcpy(packet + 8, &resident, 8);
      std::memcpy(packet + 16, &cpu, 8);
      const uint32_t size = sizeof(packet);
      if (!send_all(socket, &size, 4) || !send_all(socket, packet, size)) {
        return;
      }
      continue;
    }
    feq_meters_set_enabled(meters_, command == 1 ? 1 : 0);
    if (command != 1) {
      continue;
    }
    const bool active = active_.load(std::memory_order_acquire);
    const std::vector<unsigned char> packet =
        active ? snapshot() : std::vector<unsigned char>{};
    // No audio says so outright; an empty frame only means a whole window has
    // not arrived yet.
    const uint32_t size =
        active ? static_cast<uint32_t>(packet.size()) : kNoAudio;
    if (!send_all(socket, &size, 4)) {
      return;
    }
    if (!packet.empty() && !send_all(socket, packet.data(), packet.size())) {
      return;
    }
  }
}

}  // namespace fluideq_engine
