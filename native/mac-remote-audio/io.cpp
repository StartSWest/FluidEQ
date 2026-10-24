/* FluidEQ — GPL-3.0-or-later */
#include "lan.h"
#include <cerrno>
#include <fcntl.h>
#include <stdexcept>
#include <unistd.h>

namespace feq::maclan {
namespace {
bool write_all(const void* data, uint32_t bytes) {
  const auto* next = static_cast<const char*>(data);
  while (bytes > 0) {
    const auto wrote = ::write(STDOUT_FILENO, next, bytes);
    if (wrote < 0 && errno == EINTR) continue;
    if (wrote <= 0) return false;
    next += wrote;
    bytes -= static_cast<uint32_t>(wrote);
  }
  return true;
}
}

bool Replies::send(uint32_t kind, uint32_t id, uint32_t result,
                   const void* payload, uint32_t bytes,
                   uint16_t channels, uint16_t frames) {
  const Header header{0x31504c46, kind, id, result, channels, frames, bytes};
  // Only the control/writer threads come here. The audio callback queues a
  // bounded block and never waits for stdout or this mutex.
  const std::lock_guard lock(mutex_);
  return write_all(&header, sizeof(header)) && write_all(payload, bytes);
}

Wake::Wake() {
  if (::pipe(pipe_) != 0) throw std::runtime_error("Could not create the audio wake pipe");
  for (const int fd : pipe_) {
    if (fcntl(fd, F_SETFL, O_NONBLOCK) < 0 || fcntl(fd, F_SETFD, FD_CLOEXEC) < 0) {
      ::close(pipe_[0]); ::close(pipe_[1]);
      throw std::runtime_error("Could not configure the audio wake pipe");
    }
  }
}
Wake::~Wake() { ::close(pipe_[0]); ::close(pipe_[1]); }
void Wake::notify() noexcept {
  const char byte = 1;
  // A full pipe already holds a wake. No waiting and no timer retries.
  const auto ignored = ::write(pipe_[1], &byte, 1);
  (void)ignored;
}
void Wake::drain() noexcept {
  char bytes[128];
  while (::read(pipe_[0], bytes, sizeof(bytes)) > 0) {}
}
}  // namespace feq::maclan
