/* FluidEQ — GPL-3.0-or-later */
#ifndef FLUIDEQ_ENGINE_SPLIT_TRANSPORT_H
#define FLUIDEQ_ENGINE_SPLIT_TRANSPORT_H

#ifndef NOMINMAX
#define NOMINMAX
#endif
#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <atomic>
#include <cstddef>
#include <cstdint>
#include <mutex>
#include <string>
#include <type_traits>

namespace fluideq_engine {

// The mapping contains no pointers, handles, STL containers or process-local
// locks. x64 Windows aligned atomic loads/stores and CAS work on shared pages.
// Bump the namespace/layout version whenever this representation changes.
struct alignas(64) SplitStorage {
  uint32_t magic = 0;
  uint32_t version = 1;
  uint32_t bytes = sizeof(SplitStorage);
  uint32_t reserved = 0;
  std::atomic<uint64_t> writer{0};
  std::atomic<uint64_t> writer_created{0};
  std::atomic<uint32_t> lease_sequence{0};
  std::atomic<uint32_t> sequence{0};
  std::atomic<uint64_t> end{0}, block_start{0};
  std::atomic<int64_t> ticks{0};
  std::atomic<uint32_t> rate{0}, channels{0}, mask{0}, generation{0};
  uint32_t padding[12]{};  // Samples begin at the next complete cache line.
  std::atomic<float> samples[(1u << 16) * 8]{};
};
static_assert(std::is_standard_layout_v<SplitStorage>);
static_assert(sizeof(std::atomic<float>) == 4 && sizeof(std::atomic<uint64_t>) == 8);
static_assert(offsetof(SplitStorage, samples) == 128);

/** Control thread only. A normalized config identity keeps test/app roots apart. */
std::wstring split_transport_name(const std::wstring& config,
                                 const std::wstring& endpoint);

/**
 * Whether a kernel object's owner is `expected`. The transport refuses any of
 * its named objects that already existed under another account; this is that
 * test, apart, so it can be checked against an account other than our own.
 */
bool split_object_owned_by(HANDLE object, PSID expected) noexcept;

class SplitTransport {
 public:
  explicit SplitTransport(const std::wstring& name);
  ~SplitTransport();
  SplitTransport(const SplitTransport&) = delete;
  SplitTransport& operator=(const SplitTransport&) = delete;
  SplitStorage* data() const noexcept { return ready_.load(std::memory_order_acquire) ? data_ : nullptr; }
  /** Never waits. acquired is the mutex returned by the watcher's wait set. */
  void initialize(void* acquired = nullptr) noexcept;
  HANDLE initializing() const noexcept {
    return !ready_.load(std::memory_order_acquire) && !failed() ? initializing_ : nullptr;
  }

  // Control threads only. prepare returns a process handle owned by the
  // caller, for its existing wait set; release_event lives with this mapping.
  void add_writer() noexcept;
  void remove_writer() noexcept;
  HANDLE prepare_writer() noexcept;
  HANDLE release_event() const noexcept { return ready_.load(std::memory_order_acquire) ? released_ : nullptr; }
  bool failed() const noexcept { return failed_.load(std::memory_order_relaxed); }

  // Audio thread only: one try, no wait, allocation, or OS call. A true wake
  // asks the existing split notification to service a change on control.
  bool begin_write(bool* wake) noexcept;
  bool end_write() noexcept;

 private:
  void reset_clock() noexcept;
  void release_writer() noexcept;
  HANDLE mapping_ = nullptr;
  HANDLE initializing_ = nullptr;
  HANDLE released_ = nullptr;
  SplitStorage* data_ = nullptr;
  const uint32_t pid_;
  const uint64_t created_;
  const std::wstring name_;
  std::mutex control_;
  unsigned writers_ = 0;
  std::atomic<bool> pending_release_{false};
  std::atomic<bool> failed_{false};
  std::atomic<bool> ready_{false};
  std::atomic<uint64_t> lease_{0};
  uint64_t writing_lease_ = 0;  // Exact lease held by this audio block.
  uint64_t notified_owner_ = 0;  // The single claimed audio writer only.
};
}  // namespace fluideq_engine
#endif
