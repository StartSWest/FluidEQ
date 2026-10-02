/* FluidEQ — GPL-3.0-or-later */
#pragma once
#include "mirror_output.h"
#include <atomic>
#include <deque>
#include <map>
#include <memory>
#include <mutex>
#include <string>

// Reply kinds on the frames pipe: 3 a command's answer (under its request
// id), 4 a mirror that failed, 5 a mirror's delay in microseconds — sent
// every `kDelayEveryRenders` of its device's periods, about twice a second.
class MirrorControl final {
 public:
  static constexpr std::uint32_t kDelayEveryRenders = 50;
  using Reply = bool (*)(std::uint32_t kind, std::uint32_t id, HRESULT result);
  MirrorControl(HANDLE input, std::uint32_t rate, std::uint16_t channels, Reply reply);
  ~MirrorControl();
  bool valid() const { return thread_ != nullptr && event_ != nullptr; }
  HANDLE event() const { return event_; }
  bool commands();
  void push(const float* samples, std::uint32_t frames, bool silent);
  void append_events(std::vector<HANDLE>& events) const;
  void render(HANDLE event);
 private:
  static DWORD WINAPI read_commands(void* context);
  void fail(std::uint32_t id, HRESULT result);
  HANDLE input_;
  std::uint32_t rate_;
  std::uint16_t channels_;
  Reply reply_;
  HANDLE event_ = nullptr;
  HANDLE thread_ = nullptr;
  std::atomic<bool> stopping_{false};
  std::mutex mutex_;
  std::deque<std::string> commands_;
  std::map<std::uint32_t, std::unique_ptr<MirrorOutput>> outputs_;
  std::map<std::uint32_t, std::uint32_t> renders_;
};
