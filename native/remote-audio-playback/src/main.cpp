/* FluidEQ — GPL-3.0-or-later */
#include "playback_runtime.h"
#include "replies.h"
#include <array>
#include <charconv>
#include <cmath>
#include <cstring>
#include <string_view>
#include <thread>
#include <vector>

int main(int argc, char** argv) {
  DWORD pid = 0;
  if (argc != 3 || std::string_view(argv[1]) != "--parent-pid") return 2;
  const std::string_view text(argv[2]);
  const auto parsed = std::from_chars(text.data(), text.data() + text.size(), pid);
  if (parsed.ec != std::errc() || parsed.ptr != text.data() + text.size() || pid == 0) return 2;
  const HANDLE parent = OpenProcess(SYNCHRONIZE, FALSE, pid);
  const HANDLE done = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  if (!parent || !done) return 2;
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com)) return 2;
  std::thread watcher([&] {
    const HANDLE handles[]{done, parent};
    if (WaitForMultipleObjects(2, handles, FALSE, INFINITE) == WAIT_OBJECT_0 + 1)
      TerminateProcess(GetCurrentProcess(), 0);
  });
  int exit_code = 0;
  {
    PlaybackRuntime runtime(parent);
    std::vector<float> payload(feq::remote::kMaxPacketFrames * 8 + 1);
    std::array<std::uint32_t, 8> meter_frames{};
    bool live = playback_reply(1);
    while (live) {
      PlaybackHeader header;
      if (!playback_read(&header, sizeof(header))) break;
      if (header.magic != 0x31504c46 || header.bytes > payload.size() * sizeof(float) ||
          !playback_read(payload.data(), header.bytes)) { exit_code = 1; break; }
      if (FAILED(runtime.output().failure()) && header.kind != 1) {
        playback_reply(4, 0, static_cast<std::uint32_t>(runtime.output().failure()));
        exit_code = 1; break;
      }
      switch (header.kind) {
        case 1: {
          std::wstring guid;
          const auto* name = reinterpret_cast<const unsigned char*>(payload.data());
          if (header.bytes != 0 && header.bytes != 38) { live = false; break; }
          for (unsigned i = 0; i < header.bytes; ++i) {
            const unsigned char c = name[i];
            if (c > 127 || c == 0) { live = false; break; }
            guid.push_back(static_cast<wchar_t>(c));
          }
          if (!live) break;
          GUID parsed_guid{};
          if (!guid.empty() && FAILED(CLSIDFromString(guid.c_str(), &parsed_guid))) { live = false; break; }
          const HRESULT result = runtime.open(guid);
          live = playback_reply(3, header.id, static_cast<std::uint32_t>(result));
          if (SUCCEEDED(result)) {
            const double buffered_ms = static_cast<double>(runtime.output().frames()) * 1000 / runtime.output().rate();
            live = live && playback_reply(6, 0, runtime.output().rate(), &buffered_ms, sizeof(buffered_ms));
          }
          break;
        }
        case 2: {
          if (header.id == 0 || header.id > 8 || header.bytes != 4u + static_cast<std::uint32_t>(header.frames) * header.channels * 4u) { live = false; break; }
          std::uint32_t sequence = 0;
          std::memcpy(&sequence, payload.data(), 4);
          live = runtime.push(header.id, header.rate, header.channels, header.frames, sequence, payload.data() + 1);
          meter_frames[header.id - 1] += header.frames;
          if (live && meter_frames[header.id - 1] >= header.rate / 30) {
            meter_frames[header.id - 1] = 0;
            const auto stats = runtime.stats(header.id);
            const double values[]{stats.buffered_ms, stats.peak, stats.rms};
            live = playback_reply(5, header.id, header.rate, values, sizeof(values));
          }
          break;
        }
        case 3: if (header.bytes != 0 || header.id == 0 || header.id > 8) live = false; else runtime.remove(header.id); break;
        case 4:
          if (header.bytes != 4 || !std::isfinite(payload[0]) || payload[0] < 0 || payload[0] > 1) live = false;
          else runtime.volume(payload[0]);
          break;
        case 5: if (header.bytes != 0) live = false; else runtime.reset(); break;
        case 6: live = false; break;
        default: live = false; break;
      }
      if (!live && header.kind != 6) { playback_reply(4, header.id, static_cast<std::uint32_t>(E_INVALIDARG)); exit_code = 1; }
    }
  }
  SetEvent(done);
  watcher.join();
  CloseHandle(done); CloseHandle(parent);
  CoUninitialize();
  return exit_code;
}
