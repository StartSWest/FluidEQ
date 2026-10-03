/* FluidEQ — GPL-3.0-or-later */
#include "../src/split_transport.h"

#include <array>
#include <cmath>
#include <string>
#include <thread>

#include "../src/split_tap.h"
#include "graph_test_support.h"

using namespace fluideq_engine;
using namespace fluideq_engine_test;

namespace {
const std::wstring kMain = L"{61616161-1111-2222-3333-444455556666}";
const std::wstring kSecond = L"{62626262-1111-2222-3333-444455556666}";
const std::string kRoute =
    "# main {61616161-1111-2222-3333-444455556666}\n"
    "{61616161-1111-2222-3333-444455556666} "
    "{62626262-1111-2222-3333-444455556666} 1\n";

std::wstring root(const wchar_t* label) {
  return L"C:\\FluidEQ-test\\" + std::wstring(label) + L"-" +
      std::to_wstring(GetCurrentProcessId()) + L"-" + std::to_wstring(GetTickCount64());
}
void prepared(SplitTransport& transport) {
  if (HANDLE process = transport.prepare_writer()) CloseHandle(process);
}

void exact_lease_handoff() {
  const auto name = split_transport_name(root(L"lease"), kMain);
  SplitTransport first(name), second(name);
  first.add_writer();
  prepared(first);
  const uint64_t old_lease = first.data()->writer.load();
  bool wake = false;
  CHECK(first.begin_write(&wake));
  first.remove_writer();  // Revoke overlaps a copy: no live takeover.
  second.add_writer();
  prepared(second);
  CHECK(!second.begin_write(&wake));
  CHECK(first.end_write());
  prepared(first);  // Existing callback wake signals the shared release.
  CHECK(WaitForSingleObject(second.release_event(), 1000) == WAIT_OBJECT_0);
  prepared(second);
  const uint64_t new_lease = second.data()->writer.load();
  CHECK(new_lease != old_lease);
  CHECK((new_lease & 0xffffffffu) == (old_lease & 0xffffffffu));
  // A stale death observer with the same PID cannot clear a new lease.
  uint64_t stale = old_lease;
  CHECK(!first.data()->writer.compare_exchange_strong(stale, 0));
  CHECK(second.begin_write(&wake));
  const uint64_t busy = second.data()->writer.load();
  CHECK(!first.end_write());  // Delayed completion cannot release its successor.
  CHECK(second.data()->writer.load() == busy);
  CHECK(!second.end_write());
  second.remove_writer();
  CHECK(second.data()->writer.load() == 0);
  // Exhaustion is an explicit optional-transport refusal, never wraparound.
  second.data()->lease_sequence.store((1u << 29) - 1);
  first.add_writer();
  prepared(first);
  CHECK(first.failed());
  CHECK(first.data()->writer.load() == 0);
  CHECK(first.data()->lease_sequence.load() == (1u << 29) - 1);
  first.remove_writer();
  std::printf("busy handoff, stale PID lease, delayed release, no ABA wrap\n");
}

void failures_stay_optional() {
  const auto config = root(L"refused");
  const auto name = split_transport_name(config, kMain);
  CHECK(name == split_transport_name(config + L"\\", kMain));
  // Another object type in the mapping namespace forces an actual Win32
  // open failure, without any product-only fault hook or hardware changes.
  HANDLE conflict = CreateEventW(nullptr, TRUE, FALSE, name.c_str());
  CHECK(conflict != nullptr);
  SplitTap source(kMain, kRate, 2, 3, true, 10'000'000, config);
  SplitTap receiver(kSecond, kRate, 2, 3, true, 10'000'000, config);
  CHECK(source.follow(kRoute, true));  // Main has no `from`; failure still changes status.
  receiver.follow(kRoute, true);
  CHECK(source.transport_failed() && receiver.transport_failed());
  Graph main(chain_from("Preamp: -20 dB\n"), kRate, 2, 64);
  std::array<float, 128> raw{};
  raw.fill(0.2f);
  std::array<float, 64> left{}, right{};
  left.fill(0.2f); right.fill(0.2f);
  float* planes[2] = {left.data(), right.data()};
  source.begin();
  source.write(raw.data(), 64, 1000);
  CHECK(!source.reading());
  main.process(planes, 64);
  for (float sample : left) CHECK(std::fabs(sample - 0.02f) < 1e-6f);
  CloseHandle(conflict);
  CHECK(source.follow(kRoute, true));  // Same route, unchanged DSP: recovery also reports.
  CHECK(!source.transport_failed());

  const auto broken = root(L"layout");
  const auto bad_name = split_transport_name(broken, kMain);
  HANDLE mapping = CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr, PAGE_READWRITE,
      0, sizeof(SplitStorage), bad_name.c_str());
  CHECK(mapping != nullptr);
  auto* data = static_cast<SplitStorage*>(MapViewOfFile(mapping,
      FILE_MAP_READ | FILE_MAP_WRITE, 0, 0, sizeof(SplitStorage)));
  CHECK(data != nullptr);
  if (data) { data->magic = 0x31514546; data->version = 99; }
  SplitTap incompatible(kSecond, kRate, 2, 3, true, 10'000'000, broken);
  incompatible.follow(kRoute, true);
  CHECK(incompatible.transport_failed());
  if (data) UnmapViewOfFile(data);
  if (mapping) CloseHandle(mapping);

  SplitTap waiting(kSecond, kRate, 2, 3, true, 10'000'000, root(L"idle"));
  waiting.follow(kRoute, true);
  CHECK(!waiting.transport_failed());
  CHECK(waiting.report()->state == SplitState::waiting);
  std::printf("mapping/layout refusal preserves main; idle source is healthy waiting\n");
}

int abandon_copy(const std::wstring& name, const std::wstring& ready_name) {
  SplitTransport transport(name);
  transport.add_writer();
  prepared(transport);
  bool wake = false;
  if (!transport.begin_write(&wake)) return 2;
  // Stop halfway through publication. Recovery must repair an odd sequence
  // and clear clock/extent, not expose this previous writer's stale payload.
  transport.data()->sequence.store(1);
  transport.data()->end.store(8192);
  transport.data()->rate.store(48000);
  HANDLE ready = OpenEventW(EVENT_MODIFY_STATE, FALSE, ready_name.c_str());
  if (!ready) return 3;
  SetEvent(ready);
  CloseHandle(ready);
  HANDLE never = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  WaitForSingleObject(never, INFINITE);
  return 4;
}

int hold_initialization(const std::wstring& name, const std::wstring& ready_name) {
  HANDLE mutex = CreateMutexW(nullptr, TRUE, (name + L"-init").c_str());
  HANDLE ready = OpenEventW(EVENT_MODIFY_STATE, FALSE, ready_name.c_str());
  if (!mutex || !ready) return 2;
  SetEvent(ready);
  HANDLE never = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  WaitForSingleObject(never, INFINITE);
  return 3;
}

void stalled_initialization_is_optional(const std::wstring& exe) {
  const auto config = root(L"stalled-init");
  const auto name = split_transport_name(config, kMain);
  const auto ready_name = name + L"-test-ready";
  HANDLE ready = CreateEventW(nullptr, FALSE, FALSE, ready_name.c_str());
  std::wstring command = L"\"" + exe + L"\" --hold-init \"" + name + L"\" \"" + ready_name + L"\"";
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION child{};
  CHECK(CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE,
      CREATE_NO_WINDOW, nullptr, nullptr, &startup, &child));
  if (!child.hProcess) { CloseHandle(ready); return; }
  CloseHandle(child.hThread);
  CHECK(WaitForSingleObject(ready, 5000) == WAIT_OBJECT_0);
  CloseHandle(ready);
  {
    SplitTap source(kMain, kRate, 2, 3, true, 10'000'000, config);
    CHECK(source.follow(kRoute, true));
    CHECK(source.initializing() != nullptr && !source.transport_failed());
    source.begin();
    source.write(nullptr, 480, 1000);
    CHECK(!source.reading());
    // Source teardown completes while the other process still holds init.
  }
  CHECK(WaitForSingleObject(child.hProcess, 0) == WAIT_TIMEOUT);
  SplitTap resumed(kMain, kRate, 2, 3, true, 10'000'000, config);
  resumed.follow(kRoute, true);
  HANDLE init = resumed.initializing();
  CHECK(init != nullptr);
  CHECK(TerminateProcess(child.hProcess, 0));
  CHECK(WaitForSingleObject(child.hProcess, 5000) == WAIT_OBJECT_0);
  CloseHandle(child.hProcess);
  if (init) {
    CHECK(WaitForSingleObject(init, 1000) == WAIT_ABANDONED);
    resumed.prepare(init);
  }
  CHECK(!resumed.transport_failed() && resumed.initializing() == nullptr);
  resumed.begin();
  resumed.write(nullptr, 480, 2000);
  const auto* output = split_endpoint(kMain, config);
  SplitRing::Clock clock;
  CHECK(output->ring.load()->clock(&clock) && clock.end == 480);
  std::printf("stalled child initialization cannot block source follow or teardown\n");
}

void dead_copy_is_recovered(const std::wstring& exe) {
  const auto name = split_transport_name(root(L"dead-copy"), kMain);
  SplitRing ring(name);
  const std::wstring ready_name = name + L"-test-ready";
  HANDLE ready = CreateEventW(nullptr, FALSE, FALSE, ready_name.c_str());
  std::wstring command = L"\"" + exe + L"\" --abandon \"" + name + L"\" \"" + ready_name + L"\"";
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  PROCESS_INFORMATION child{};
  CHECK(CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE,
      CREATE_NO_WINDOW, nullptr, nullptr, &startup, &child));
  if (!child.hProcess) { CloseHandle(ready); return; }
  CloseHandle(child.hThread);
  CHECK(WaitForSingleObject(ready, 5000) == WAIT_OBJECT_0);
  CloseHandle(ready);
  ring.add_writer();
  HANDLE owner = ring.prepare_writer();
  CHECK(owner != nullptr);
  if (owner) CHECK(WaitForSingleObject(owner, 0) == WAIT_TIMEOUT);
  CHECK(TerminateProcess(child.hProcess, 0));
  CHECK(WaitForSingleObject(child.hProcess, 5000) == WAIT_OBJECT_0);
  if (owner) {
    // This is precisely the wait handle used by the production watcher.
    CHECK(WaitForSingleObject(owner, 0) == WAIT_OBJECT_0);
    CloseHandle(owner);
  }
  CloseHandle(child.hProcess);
  HANDLE next = ring.prepare_writer();
  CHECK(next == nullptr);
  if (next) CloseHandle(next);
  SplitRing::Clock clock;
  CHECK(ring.clock(&clock));
  CHECK(clock.end == 0 && clock.rate == 0 && clock.generation >= 2);
  std::array<float, 8> raw{};
  raw.fill(0.7f);
  ring.write(raw.data(), 2, 4, 48000, 3, 1234);
  CHECK(ring.clock(&clock) && clock.end == 4 && clock.block_start == 0);
  CHECK(ring.at(0, 0) == 0.7f && ring.at(3, 1) == 0.7f);
  ring.remove_writer();
  std::printf("process-exit signal recovers abandoned busy copy and odd clock\n");
}

void local_watchers_publish_storage_monotonically() {
  const auto config = root(L"publication");
  unsigned unavailable_after_ready = 0;
  // Actual pending mappings, not a mocked publisher: a third control thread
  // holds the named setup mutex until both local callers have observed it.
  for (unsigned round = 0; round < 64; ++round) {
    const auto name = split_transport_name(config + L"-" + std::to_wstring(round), kMain);
    HANDLE mutex = CreateMutexW(nullptr, FALSE, (name + L"-init").c_str());
    HANDLE held = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    HANDLE release = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    HANDLE attempted = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    CHECK(mutex && held && release && attempted);
    std::thread holder([&] {
      WaitForSingleObject(mutex, INFINITE);
      SetEvent(held);
      WaitForSingleObject(release, INFINITE);
      ReleaseMutex(mutex);
    });
    CHECK(WaitForSingleObject(held, 1000) == WAIT_OBJECT_0);
    SplitRing ring(name);
    SplitRing::Clock clock;
    CHECK(ring.initializing() != nullptr && !ring.clock(&clock));
    std::atomic<bool> seen_ready{false};
    std::atomic<unsigned> lost{0};
    const auto observe = [&] {
      // Read this first: a pending snapshot taken before another caller's
      // publication must not be mistaken for a subsequent disappearance.
      const bool established = seen_ready.load(std::memory_order_acquire);
      SplitRing::Clock snapshot;
      const bool available = ring.clock(&snapshot);
      if (established && !available) lost.fetch_add(1, std::memory_order_relaxed);
      if (available) seen_ready.store(true, std::memory_order_release);
    };
    const auto prepare = [&] {
      for (unsigned attempt = 0; attempt < 512; ++attempt) {
        observe();
        ring.initialize();
        observe();
      }
    };
    std::thread watcher([&] {
      ring.initialize();
      SetEvent(attempted);
      prepare();
    });
    CHECK(WaitForSingleObject(attempted, 1000) == WAIT_OBJECT_0);
    SetEvent(release);
    prepare();
    watcher.join();
    holder.join();
    ring.initialize();
    observe();
    CHECK(seen_ready.load() && ring.initializing() == nullptr);
    unavailable_after_ready += lost.load();
    // A surviving pointer must actually publish samples, not just claim ready.
    ring.add_writer();
    if (HANDLE owner = ring.prepare_writer()) CloseHandle(owner);
    const float raw[] = {0.25f, -0.5f};
    ring.write(raw, 2, 1, 48000, 3, 1234);
    CHECK(ring.clock(&clock) && clock.end == 1 && ring.at(0, 1) == -0.5f);
    ring.remove_writer();
    CloseHandle(attempted); CloseHandle(release); CloseHandle(held); CloseHandle(mutex);
  }
  CHECK(unavailable_after_ready == 0);
  std::printf("two local watchers retain published storage across 64 pending mappings\n");
}
}  // namespace

int wmain(int argc, wchar_t** argv) {
  if (argc == 4 && std::wstring(argv[1]) == L"--abandon") return abandon_copy(argv[2], argv[3]);
  if (argc == 4 && std::wstring(argv[1]) == L"--hold-init") return hold_initialization(argv[2], argv[3]);
  exact_lease_handoff();
  failures_stay_optional();
  wchar_t exe[MAX_PATH]{};
  CHECK(GetModuleFileNameW(nullptr, exe, MAX_PATH) != 0);
  dead_copy_is_recovered(exe);
  stalled_initialization_is_optional(exe);
  local_watchers_publish_storage_monotonically();
  return report();
}
