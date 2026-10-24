/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include <cstdint>
#include <memory>
#include <mutex>
#include <string>

namespace feq::maclan {
// Same envelope as nativeRemoteAudioPlaybackProtocol.ts. No audio device is
// opened by a handshake: capture and playback each hold their own lease.
struct Header {
  uint32_t magic = 0x31504c46, kind = 0, id = 0, rate = 0;
  uint16_t channels = 0, frames = 0;
  uint32_t bytes = 0;
};
static_assert(sizeof(Header) == 24);

class Replies {
 public:
  bool send(uint32_t kind, uint32_t id = 0, uint32_t result = 0,
            const void* payload = nullptr, uint32_t bytes = 0,
            uint16_t channels = 0, uint16_t frames = 0);
 private:
  std::mutex mutex_;
};

class Wake {
 public:
  Wake();
  ~Wake();
  Wake(const Wake&) = delete;
  Wake& operator=(const Wake&) = delete;
  int descriptor() const { return pipe_[0]; }
  void notify() noexcept;
  void drain() noexcept;
 private:
  int pipe_[2]{-1, -1};
};

class Capture {
 public:
  Capture(Replies& replies, Wake& wake);
  ~Capture();
  bool start(std::string& error);
  void stop();
  // Device and process changes are acted on by the control thread. A newly
  // restarted engine must be excluded before its processed copy is heard.
  bool refresh(std::string& error);
  bool active() const;
 private:
  struct State;
  std::unique_ptr<State> state_;
};

class Playback {
 public:
  Playback(Replies& replies, Wake& wake);
  ~Playback();
  bool open(const std::string& guid, std::string& error);
  void close();
  void service();
  bool push(const Header& header, const float* samples, uint32_t sequence);
  void remove(uint32_t id);
  void reset();
  void volume(float value);
 private:
  struct State;
  std::unique_ptr<State> state_;
};
}  // namespace feq::maclan
