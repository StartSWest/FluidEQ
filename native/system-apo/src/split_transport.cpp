/* FluidEQ — GPL-3.0-or-later */
#include "split_transport.h"

#include <aclapi.h>
#include <bcrypt.h>
#include <cwctype>
#include <memory>
#include <new>
#include <stdexcept>
#include <vector>

namespace fluideq_engine {
namespace {
constexpr uint32_t kMagic = 0x31514546;  // FEQ1, published under the init mutex.
constexpr uint64_t kBusy = uint64_t{1} << 61;
constexpr uint64_t kRevoke = uint64_t{1} << 62;
constexpr uint64_t kInitializing = uint64_t{1} << 63;
constexpr uint64_t kPid = 0xffffffffu;
constexpr uint64_t kLease = ~(kBusy | kRevoke | kInitializing);
constexpr uint32_t kLastLease = (1u << 29) - 1;

uint64_t creation_time(HANDLE process) noexcept {
  FILETIME birth{}, exit{}, kernel{}, user{};
  if (!GetProcessTimes(process, &birth, &exit, &kernel, &user)) return 0;
  return (uint64_t{birth.dwHighDateTime} << 32) | birth.dwLowDateTime;
}

struct Handle {
  HANDLE value;
  ~Handle() { if (value) CloseHandle(value); }
};
struct Initializing {
  HANDLE mutex;
  ~Initializing() { ReleaseMutex(mutex); }
};

/**
 * Whether an object Windows handed back as already existing was made under
 * this process's own account. In session zero `Local\` is the global
 * namespace, which a program in anybody's session reaches as `Global\` (a
 * mutex or an event with no privilege at all), so another account could
 * create these names first, with a DACL of its own, and then read the main
 * output's sound or feed the second output whatever it liked; the name is a
 * hash of things that are no secret. The engine's own account can already
 * open what the engine makes (the default DACL grants it), so refusing
 * everything else closes the hole without trusting anyone new. Somebody can
 * still take a name first and so keep the second output off; that costs a
 * second output, never the main one's sound. A refusal is a transport
 * failure like any other: the status says so, and the app stops that second
 * output rather than play it out of memory somebody else laid out.
 */
bool made_by_this_account(HANDLE object) noexcept {
  // The pseudo-handle: nothing to open (or be refused) inside audiodg.
  const HANDLE token = GetCurrentProcessToken();
  DWORD size = 0;
  (void)GetTokenInformation(token, TokenOwner, nullptr, 0, &size);
  if (size == 0) return false;
  try {
    std::vector<unsigned char> owner(size);
    if (!GetTokenInformation(token, TokenOwner, owner.data(), size, &size)) return false;
    return split_object_owned_by(object,
        reinterpret_cast<const TOKEN_OWNER*>(owner.data())->Owner);
  } catch (...) {
    return false;
  }
}

/** Closes an object that existed already under another account, and throws. */
void refuse_foreign(HANDLE object, bool existed, const char* what) {
  if (existed && !made_by_this_account(object)) {
    CloseHandle(object);
    throw std::runtime_error(what);
  }
}
}  // namespace

bool split_object_owned_by(HANDLE object, PSID expected) noexcept {
  PSID owner = nullptr;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (expected == nullptr ||
      GetSecurityInfo(object, SE_KERNEL_OBJECT, OWNER_SECURITY_INFORMATION,
                      &owner, nullptr, nullptr, nullptr, &descriptor) != ERROR_SUCCESS)
    return false;
  const bool same = owner != nullptr && EqualSid(owner, expected) != FALSE;
  LocalFree(descriptor);
  return same;
}

std::wstring split_transport_name(const std::wstring& config,
                                 const std::wstring& endpoint) {
  if (config.empty() || endpoint.empty()) throw std::runtime_error("split identity");
  const DWORD length = GetFullPathNameW(config.c_str(), 0, nullptr, nullptr);
  if (length == 0) throw std::runtime_error("split config path");
  std::wstring identity(length, L'\0');
  const DWORD written = GetFullPathNameW(config.c_str(), length, identity.data(), nullptr);
  if (written == 0 || written >= length) throw std::runtime_error("split config path");
  identity.resize(written);
  while (identity.size() > 3 && (identity.back() == L'\\' || identity.back() == L'/'))
    identity.pop_back();
  identity += L"|" + endpoint;
  for (wchar_t& c : identity) c = c == L'/' ? L'\\' : static_cast<wchar_t>(std::towlower(c));
  unsigned char digest[32]{};
  if (BCryptHash(BCRYPT_SHA256_ALG_HANDLE, nullptr, 0,
      reinterpret_cast<PUCHAR>(identity.data()),
      static_cast<ULONG>(identity.size() * sizeof(wchar_t)), digest, sizeof(digest)) < 0)
    throw std::runtime_error("split identity hash");
  // audiodg instances are in session zero. Explicit Local also lets private
  // test processes exercise the same code without SeCreateGlobalPrivilege.
  std::wstring name = L"Local\\FluidEQ-RawSplit-v1-";
  constexpr wchar_t hex[] = L"0123456789abcdef";
  for (unsigned char byte : digest) { name += hex[byte >> 4]; name += hex[byte & 15]; }
  return name;
}

SplitTransport::SplitTransport(const std::wstring& name)
    : pid_(GetCurrentProcessId()), created_(creation_time(GetCurrentProcess())), name_(name) {
  if (created_ == 0) throw std::runtime_error("split process identity");
  HANDLE mutex = CreateMutexW(nullptr, FALSE, (name + L"-init").c_str());
  if (!mutex) throw std::runtime_error("split init mutex");
  refuse_foreign(mutex, GetLastError() == ERROR_ALREADY_EXISTS, "split init mutex owner");
  initializing_ = mutex;
  initialize();
}

void SplitTransport::initialize(void* acquired) noexcept {
  const std::lock_guard<std::mutex> guard(control_);
  const bool owned = acquired != nullptr && acquired == initializing_;
  if (ready_.load(std::memory_order_relaxed)) {
    if (owned) ReleaseMutex(initializing_);
    return;
  }
  // A slow or suspended receiver must never block source follow or teardown.
  // Pending setup is resumed only by the existing cancellable watcher wait.
  const DWORD waited = owned ? WAIT_OBJECT_0 : WaitForSingleObject(initializing_, 0);
  if (waited == WAIT_TIMEOUT) { failed_.store(false, std::memory_order_relaxed); return; }
  if (waited != WAIT_OBJECT_0 && waited != WAIT_ABANDONED) {
    failed_.store(true, std::memory_order_relaxed);
    return;
  }
  Initializing locked{initializing_};
  try {
  HANDLE created = CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr, PAGE_READWRITE,
                                      0, sizeof(SplitStorage), name_.c_str());
  if (!created) throw std::runtime_error("split mapping");
  refuse_foreign(created, GetLastError() == ERROR_ALREADY_EXISTS, "split mapping owner");
  Handle mapping{created};
  auto* data = static_cast<SplitStorage*>(MapViewOfFile(
      mapping.value, FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, sizeof(SplitStorage)));
  if (!data) throw std::runtime_error("split mapping view");
  if (data->magic == 0) {
    ::new (data) SplitStorage{};
    data->magic = kMagic;
  }
  if (data->magic != kMagic || data->version != 1 || data->bytes != sizeof(SplitStorage)) {
    UnmapViewOfFile(data);
    throw std::runtime_error("split mapping layout");
  }
  // Auto-reset, so one release wakes one waiting writer. Any other is woken
  // by its own audio thread seeing the owner change (`begin_write`), and a
  // writer whose audio is not running has nothing to write until it is.
  HANDLE released = CreateEventW(nullptr, FALSE, FALSE, (name_ + L"-released").c_str());
  if (!released) {
    UnmapViewOfFile(data);
    throw std::runtime_error("split ownership event");
  }
  if (GetLastError() == ERROR_ALREADY_EXISTS && !made_by_this_account(released)) {
    CloseHandle(released);
    UnmapViewOfFile(data);
    throw std::runtime_error("split ownership event owner");
  }
  // Default token DACL: no Everyone/interactive-user grant to service audio.
  // Touch every page before publishing the pointer to the real-time thread.
  for (size_t at = 0; at < (1u << 16) * 8; at += 1024)
    (void)data->samples[at].load(std::memory_order_relaxed);
  data_ = data;
  released_ = released;
  mapping_ = mapping.value;
  mapping.value = nullptr;
  failed_.store(false, std::memory_order_relaxed);
  ready_.store(true, std::memory_order_release);
  } catch (...) {
    failed_.store(true, std::memory_order_relaxed);
  }
}

SplitTransport::~SplitTransport() {
  // All endpoint callbacks have stopped before the board is destroyed.
  if (data_) {
    release_writer();
    UnmapViewOfFile(data_);
  }
  if (released_) CloseHandle(released_);
  if (mapping_) CloseHandle(mapping_);
  if (initializing_) CloseHandle(initializing_);
}

void SplitTransport::add_writer() noexcept {
  const std::lock_guard<std::mutex> lock(control_);
  ++writers_;
}

void SplitTransport::release_writer() noexcept {
  const uint64_t lease = lease_.exchange(0, std::memory_order_acq_rel);
  if (lease == 0) return;
  uint64_t owner = data_->writer.load(std::memory_order_acquire);
  while ((owner & kLease) == lease) {
    const uint64_t next = (owner & kBusy) != 0 ? owner | kRevoke : 0;
    if (data_->writer.compare_exchange_weak(owner, next, std::memory_order_acq_rel)) {
      if (next == 0) SetEvent(released_);
      // A copy already in flight completes the revoke and asks control to
      // signal this event. Neither control nor the new writer races its data.
      else pending_release_.store(true, std::memory_order_release);
      return;
    }
  }
}

void SplitTransport::remove_writer() noexcept {
  const std::lock_guard<std::mutex> lock(control_);
  if (writers_ != 0 && --writers_ == 0) release_writer();
}

void SplitTransport::reset_clock() noexcept {
  const uint32_t odd = data_->sequence.load(std::memory_order_relaxed) | 1u;
  data_->sequence.store(odd, std::memory_order_relaxed);
  // Odd before any field, as `publish` does it: a release store orders what
  // came before it, never the stores after, so a reader could take a cleared
  // field under the old even count and keep it.
  std::atomic_thread_fence(std::memory_order_release);
  data_->end.store(0, std::memory_order_relaxed);
  data_->block_start.store(0, std::memory_order_relaxed);
  data_->ticks.store(0, std::memory_order_relaxed);
  data_->rate.store(0, std::memory_order_relaxed);
  data_->channels.store(0, std::memory_order_relaxed);
  data_->mask.store(0, std::memory_order_relaxed);
  data_->generation.fetch_add(1, std::memory_order_relaxed);
  data_->sequence.store(odd + 1, std::memory_order_release);
}

HANDLE SplitTransport::prepare_writer() noexcept {
  const std::lock_guard<std::mutex> lock(control_);
  if (!data_) return nullptr;
  if (pending_release_.load(std::memory_order_acquire) &&
      (data_->writer.load(std::memory_order_acquire) & kBusy) == 0) {
    pending_release_.store(false, std::memory_order_relaxed);
    SetEvent(released_);
  }
  if (writers_ == 0) return nullptr;
  // Contention here is control-only and bounded. A racing control thread
  // is serviced by the named release event or the next changed-owner wake.
  for (int attempt = 0; attempt < 4; ++attempt) {
    uint64_t owner = data_->writer.load(std::memory_order_acquire);
    const uint64_t local_lease = lease_.load(std::memory_order_acquire);
    if (local_lease != 0 && (owner & kLease) == local_lease) return nullptr;
    if (owner == 0) {
      // The sequence is in the CAS word, so PID reuse cannot make an old
      // observer reclaim a newly acquired lease (even from the same PID).
      // Exhaustion refuses optional sharing instead of ever wrapping an ABA.
      uint32_t previous = data_->lease_sequence.load(std::memory_order_relaxed);
      while (previous < kLastLease && !data_->lease_sequence.compare_exchange_weak(
          previous, previous + 1, std::memory_order_relaxed)) {}
      if (previous >= kLastLease) {
        failed_.store(true, std::memory_order_relaxed);
        return nullptr;
      }
      const uint32_t sequence = previous + 1;
      const uint64_t lease = (uint64_t{sequence} << 32) | pid_;
      if (!data_->writer.compare_exchange_strong(owner, lease | kInitializing,
                                                  std::memory_order_acq_rel)) continue;
      data_->writer_created.store(created_, std::memory_order_relaxed);
      reset_clock();
      data_->writer.store(lease, std::memory_order_release);
      lease_.store(lease, std::memory_order_release);
      failed_.store(false, std::memory_order_relaxed);
      return nullptr;
    }
    const uint64_t born = data_->writer_created.load(std::memory_order_acquire);
    HANDLE process = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_LIMITED_INFORMATION,
                                  FALSE, static_cast<DWORD>(owner & kPid));
    const DWORD error = process ? ERROR_SUCCESS : GetLastError();
    const uint64_t process_created = process ? creation_time(process) : 0;
    const bool gone = process ? WaitForSingleObject(process, 0) == WAIT_OBJECT_0 ||
        ((owner & kInitializing) == 0 && process_created != 0 &&
         process_created != born) : error == ERROR_INVALID_PARAMETER;
    if (gone) {
      if (process) CloseHandle(process);
      // Confirm the complete lease and birth identity before clearing an
      // abandoned copy. A live owner is never stolen because it is slow.
      if (data_->writer_created.load(std::memory_order_acquire) == born)
        data_->writer.compare_exchange_strong(owner, 0, std::memory_order_acq_rel);
      continue;
    }
    failed_.store(!process || process_created == 0, std::memory_order_relaxed);
    return process;
  }
  SetEvent(released_);
  return nullptr;
}

bool SplitTransport::begin_write(bool* wake) noexcept {
  if (!ready_.load(std::memory_order_acquire)) return false;
  uint64_t expected = lease_.load(std::memory_order_acquire);
  const uint64_t lease = expected;
  if (lease != 0 && data_->writer.compare_exchange_strong(expected, lease | kBusy,
                                             std::memory_order_acq_rel)) {
    writing_lease_ = lease;
    return true;
  }
  if (lease == 0) expected = data_->writer.load(std::memory_order_acquire);
  const uint64_t owner = expected & kLease;
  *wake = owner != notified_owner_;
  notified_owner_ = owner;
  return false;
}

bool SplitTransport::end_write() noexcept {
  const uint64_t lease = writing_lease_;
  uint64_t expected = lease | kBusy;
  if (data_->writer.compare_exchange_strong(expected, lease,
                                             std::memory_order_release)) return false;
  // The only change allowed while copying is our control thread's revoke.
  expected = lease | kBusy | kRevoke;
  return data_->writer.compare_exchange_strong(expected, 0, std::memory_order_release);
}
}  // namespace fluideq_engine
