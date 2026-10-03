/* FluidEQ — GPL-3.0-or-later */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <array>
#include <cmath>
#include <string>

#include "../src/split_tap.h"
#include "graph_test_support.h"

using namespace fluideq_engine;
using namespace fluideq_engine_test;

namespace {
constexpr uint32_t kFrames = 480;
constexpr int64_t kTicks = 10'000'000;
const std::wstring kMain = L"{51515151-1111-2222-3333-444455556666}";
const std::wstring kSecond = L"{52525252-1111-2222-3333-444455556666}";
const std::string kRoute =
    "# main {51515151-1111-2222-3333-444455556666}\n"
    "{51515151-1111-2222-3333-444455556666} "
    "{52525252-1111-2222-3333-444455556666} 0.5\n";

struct Audio {
  std::array<float, 2 * kFrames> raw{};
  std::array<float, kFrames> left{}, right{};
  float* planes[2] = {left.data(), right.data()};
  void fill(float value) { raw.fill(value); left.fill(value); right.fill(value); }
  bool matches(float value) const {
    for (float sample : left) if (std::fabs(sample - value) > 1e-5f) return false;
    for (float sample : right) if (std::fabs(sample - value) > 1e-5f) return false;
    return true;
  }
};

// Events carry only scheduling, never samples: all audio must cross the
// production SplitRing mapping. Each child has a real, separate Graph.
int worker(const wchar_t* event_name, float value, uint32_t first, bool receive) {
  const std::wstring name(event_name);
  HANDLE request = OpenEventW(SYNCHRONIZE, FALSE, (name + L"-request").c_str());
  HANDLE done = OpenEventW(EVENT_MODIFY_STATE, FALSE, (name + L"-done").c_str());
  if (!request || !done) return 2;
  wchar_t root[1024]{};
  GetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root, 1024);
  SplitTap tap(receive ? kSecond : kMain, kRate, 2, 3, true, kTicks,
                std::wstring(root) + L"\\config");
  tap.follow(kRoute, true);
  Graph graph(chain_from(receive ? "Preamp: -6 dB\n" : "Preamp: -20 dB\n"),
                kRate, 2, kFrames);
  Audio audio;
  for (uint32_t block = first; ; ++block) {
    if (WaitForSingleObject(request, 15000) != WAIT_OBJECT_0) return 3;
    tap.prepare();
    audio.fill(receive ? 0.1f : value);
    tap.begin();
    if (receive) tap.mix(audio.planes, kFrames, block * kTicks / 100 + kTicks / 300);
    else tap.write(audio.raw.data(), kFrames, block * kTicks / 100);
    graph.process(audio.planes, kFrames);
    if (receive) tap.trim_output(audio.planes, kFrames);
    if ((!receive || block >= first + 10) && !audio.matches(receive
        ? (value + 0.1f) * 0.5011872336f * 0.5f : value * 0.1f)) return 4;
    SetEvent(done);
  }
}

struct Child {
  HANDLE process = nullptr, request = nullptr, done = nullptr;
  Child(const std::wstring& exe, const std::wstring& name, float value,
        uint32_t first = 0, bool receive = false) {
    request = CreateEventW(nullptr, FALSE, FALSE, (name + L"-request").c_str());
    done = CreateEventW(nullptr, FALSE, FALSE, (name + L"-done").c_str());
    std::wstring command = L"\"" + exe + (receive ? L"\" --receiver \"" : L"\" --source \"") +
        name + L"\" " + std::to_wstring(value) + L" " + std::to_wstring(first);
    STARTUPINFOW startup{};
    startup.cb = sizeof(startup);
    PROCESS_INFORMATION info{};
    CHECK(CreateProcessW(exe.c_str(), command.data(), nullptr, nullptr, FALSE,
                         CREATE_NO_WINDOW, nullptr, nullptr, &startup, &info));
    process = info.hProcess;
    if (info.hThread) CloseHandle(info.hThread);
  }
  bool step() {
    SetEvent(request);
    HANDLE waits[2] = {done, process};
    const bool okay = WaitForMultipleObjects(2, waits, FALSE, 5000) == WAIT_OBJECT_0;
    CHECK(okay);
    return okay;
  }
  void stop() {
    if (process) {
      // This handle came from our CreateProcess: no system audio process.
      CHECK(TerminateProcess(process, 0));
      CHECK(WaitForSingleObject(process, 5000) == WAIT_OBJECT_0);
      CloseHandle(process);
      process = nullptr;
    }
  }
  ~Child() {
    stop();
    if (request) CloseHandle(request);
    if (done) CloseHandle(done);
  }
};

void transport_and_recovery(const std::wstring& exe) {
  const std::wstring id = std::to_wstring(GetCurrentProcessId()) + L"-" +
                          std::to_wstring(GetTickCount64());
  const std::wstring root = L"C:\\FluidEQ-test\\split-process-" + id;
  CHECK(SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str()));
  const std::wstring events = L"Local\\FluidEQ-split-test-" + id;
  // Receiver first proves attachment does not depend on source startup order.
  SplitTap receiver(kSecond, kRate, 2, 3, true, kTicks, root + L"\\config");
  receiver.follow(kRoute, true);
  Graph graph(chain_from("Preamp: -6 dB\n"), kRate, 2, kFrames);
  Child writer(exe, events + L"-writer", 0.2f);
  Audio audio;
  const auto render = [&](uint32_t block) {
    receiver.prepare();
    audio.fill(0.1f);  // Direct local sound joins the raw source before DSP.
    receiver.begin();
    receiver.mix(audio.planes, kFrames, block * kTicks / 100 + kTicks / 300);
    graph.process(audio.planes, kFrames);
    receiver.trim_output(audio.planes, kFrames);
  };
  for (uint32_t block = 0; block < 30; ++block) {
    if (!writer.step()) return;
    render(block);
  }
  CHECK(audio.matches(0.3f * 0.5011872336f * 0.5f));
  CHECK(receiver.report()->state == SplitState::playing);
  std::printf("child raw source + local input use receiver's independent graph\n");

  Child listener(exe, events + L"-listener", 0.2f, 30, true);
  for (uint32_t block = 30; block < 60; ++block) {
    if (!writer.step() || !listener.step()) return;
    render(block);
  }
  // Neither receiver consumes anything for more than two complete rings.
  // Every source request must still finish and its independent main graph
  // must still produce exactly 0.02 in the child, even after receiver death.
  for (uint32_t block = 60; block < 360; ++block) if (!writer.step()) return;
  listener.stop();
  for (uint32_t block = 360; block < 390; ++block) if (!writer.step()) return;
  std::printf("stalled and terminated receiver never blocks or changes main\n");

  CHECK(SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", (root + L"-isolated").c_str()));
  Child isolated(exe, events + L"-isolated", 0.8f, 390);
  CHECK(SetEnvironmentVariableW(L"FLUIDEQ_ENGINE_ROOT", root.c_str()));
  for (uint32_t block = 390; block < 420; ++block) {
    if (!writer.step() || !isolated.step()) return;
    render(block);
  }
  CHECK(audio.matches(0.3f * 0.5011872336f * 0.5f));
  std::printf("another configuration root cannot publish into this source\n");

  // A live competing writer keeps processing its own main, but cannot
  // overwrite the existing source. Its clock catches up before handoff.
  Child rival(exe, events + L"-rival", 0.4f, 420);
  for (uint32_t block = 420; block < 480; ++block) {
    if (!writer.step() || !rival.step()) return;
    render(block);
  }
  CHECK(audio.matches(0.3f * 0.5011872336f * 0.5f));
  writer.stop();
  for (uint32_t block = 480; block < 520; ++block) {
    if (!rival.step()) return;
    render(block);
  }
  CHECK(audio.matches(0.5f * 0.5011872336f * 0.5f));
  CHECK(receiver.report()->state == SplitState::playing);
  std::printf("dead writer is reclaimed without replaying its old frames\n");

  rival.stop();
  for (uint32_t block = 520; block < 535; ++block) render(block);
  CHECK(audio.matches(0.1f * 0.5011872336f * 0.5f));
  CHECK(receiver.report()->state == SplitState::waiting);
  std::printf("missing writer preserves receiver's local processing\n");
}
}  // namespace

int wmain(int argc, wchar_t** argv) {
  if (argc == 5) return worker(argv[2], std::stof(argv[3]),
      static_cast<uint32_t>(std::stoul(argv[4])), std::wstring(argv[1]) == L"--receiver");
  wchar_t exe[MAX_PATH]{};
  CHECK(GetModuleFileNameW(nullptr, exe, MAX_PATH) != 0);
  transport_and_recovery(exe);
  return report();
}
