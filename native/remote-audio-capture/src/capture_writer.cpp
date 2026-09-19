/* FluidEQ — GPL-3.0-or-later */
#include "capture_writer.h"

CaptureWriter::CaptureWriter(HANDLE output, HANDLE parent,
                             std::uint32_t sample_rate, std::uint16_t channels)
    : audio_(sample_rate, channels), output_(output), parent_(parent),
      sample_rate_(sample_rate), channels_(channels) {
  if (output == nullptr || output == INVALID_HANDLE_VALUE ||
      parent == nullptr || parent == INVALID_HANDLE_VALUE) { return; }
  available_ = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  stop_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  completed_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (available_ != nullptr && stop_ != nullptr && completed_ != nullptr) {
    thread_ = CreateThread(nullptr, 0, run, this, 0, nullptr);
  }
}

CaptureWriter::~CaptureWriter() {
  stop();
  if (thread_ != nullptr) { CloseHandle(thread_); }
  if (completed_ != nullptr) { CloseHandle(completed_); }
  if (stop_ != nullptr) { CloseHandle(stop_); }
  if (available_ != nullptr) { CloseHandle(available_); }
}

void CaptureWriter::stop() noexcept {
  stopping_.store(true, std::memory_order_release);
  audio_.stop();
  if (stop_ != nullptr) { SetEvent(stop_); }
  if (thread_ != nullptr) { WaitForSingleObject(thread_, INFINITE); }
}

bool CaptureWriter::failed() const noexcept {
  DWORD code = 0;
  return thread_ == nullptr || !GetExitCodeThread(thread_, &code) ||
         (code != STILL_ACTIVE && code != 0);
}

void CaptureWriter::push(const float* samples, std::uint32_t frames, bool silent,
                         bool discontinuity) noexcept {
  audio_.push(samples, frames, silent, discontinuity);
  SetEvent(available_);
}

bool CaptureWriter::reply(std::uint32_t kind, std::uint32_t id,
                          HRESULT result) noexcept {
  if (stopping_.load(std::memory_order_acquire)) { return false; }
  auto* header = replies_.write_slot();
  if (header == nullptr) { return false; }
  *header = {kCaptureFrameMagic, kind, id, static_cast<std::uint32_t>(result),
             0, 0, 0};
  replies_.publish();
  SetEvent(available_);
  return true;
}

bool CaptureWriter::write(const void* data, std::uint32_t bytes) noexcept {
  const auto* cursor = static_cast<const std::uint8_t*>(data);
  while (bytes != 0 && !stopping_.load(std::memory_order_acquire)) {
    OVERLAPPED operation{};
    operation.hEvent = completed_;
    ResetEvent(completed_);
    DWORD written = 0;
    const BOOL sent = WriteFile(output_, cursor, bytes, &written, &operation);
    if (!sent && GetLastError() != ERROR_IO_PENDING) { return false; }
    if (!sent) {
      const HANDLE waits[]{stop_, parent_, completed_};
      const auto wait = WaitForMultipleObjects(3, waits, FALSE, INFINITE);
      if (wait != WAIT_OBJECT_0 + 2) {
        // Cancellation happens after WriteFile has issued the operation.
        // Drain its completion before the stack's OVERLAPPED/data can die.
        CancelIoEx(output_, &operation);
        GetOverlappedResult(output_, &operation, &written, TRUE);
        return false;
      }
      if (!GetOverlappedResult(output_, &operation, &written, FALSE)) {
        return false;
      }
    }
    if (written == 0 || written > bytes) { return false; }
    cursor += written;
    bytes -= written;
  }
  return bytes == 0;
}

DWORD WINAPI CaptureWriter::run(void* context) {
  auto& self = *static_cast<CaptureWriter*>(context);
  const CaptureFrameHeader ready{kCaptureFrameMagic, 1, kCapturePipeVersion,
      self.sample_rate_, self.channels_, 0, 0};
  if (!self.write(&ready, sizeof(ready))) {
    return self.stopping_.load(std::memory_order_acquire) ? 0 : 1;
  }
  CapturePacket packet;
  while (!self.stopping_.load(std::memory_order_acquire)) {
    if (WaitForSingleObject(self.parent_, 0) != WAIT_TIMEOUT) { return 0; }
    const auto* reply = self.replies_.read_slot();
    if (reply != nullptr) {
      const auto header = *reply;
      self.replies_.release();
      if (!self.write(&header, sizeof(header))) { break; }
    } else if (self.audio_.pop(packet)) {
      if (self.audio_.current(packet) &&
          !self.write(&packet, sizeof(packet.header) + packet.header.payload_bytes)) {
        break;
      }
    } else {
      const HANDLE waits[]{self.stop_, self.parent_, self.available_};
      const auto wait = WaitForMultipleObjects(3, waits, FALSE, INFINITE);
      if (wait == WAIT_OBJECT_0 || wait == WAIT_OBJECT_0 + 1) { return 0; }
      if (wait != WAIT_OBJECT_0 + 2) { return 1; }
    }
  }
  return self.stopping_.load(std::memory_order_acquire) ||
                 WaitForSingleObject(self.parent_, 0) == WAIT_OBJECT_0
             ? 0 : 1;
}
