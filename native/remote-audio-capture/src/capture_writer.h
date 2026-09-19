/* FluidEQ — GPL-3.0-or-later */
#pragma once

#include <Windows.h>
#include "capture_queue.h"

class CaptureWriter final {
 public:
  // output must have FILE_FLAG_OVERLAPPED (Node's stdio: 'overlapped').
  CaptureWriter(HANDLE output, HANDLE parent, std::uint32_t sample_rate,
                std::uint16_t channels);
  ~CaptureWriter();
  CaptureWriter(const CaptureWriter&) = delete;
  CaptureWriter& operator=(const CaptureWriter&) = delete;

  bool valid() const noexcept { return thread_ != nullptr; }
  HANDLE event() const noexcept { return thread_; }
  bool failed() const noexcept;
  void push(const float* samples, std::uint32_t frames, bool silent,
            bool discontinuity) noexcept;
  bool reply(std::uint32_t kind, std::uint32_t id, HRESULT result) noexcept;
  void stop() noexcept;

 private:
  static DWORD WINAPI run(void* context);
  bool write(const void* data, std::uint32_t bytes) noexcept;
  CaptureQueue audio_;
  CaptureRing<CaptureFrameHeader, 128> replies_;
  const HANDLE output_;
  const HANDLE parent_;
  const std::uint32_t sample_rate_;
  const std::uint16_t channels_;
  HANDLE available_ = nullptr;
  HANDLE stop_ = nullptr;
  HANDLE completed_ = nullptr;
  HANDLE thread_ = nullptr;
  std::atomic<bool> stopping_{false};
};
