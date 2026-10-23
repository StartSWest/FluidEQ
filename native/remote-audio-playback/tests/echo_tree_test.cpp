/* FluidEQ — GPL-3.0-or-later */
// Share Audio both ways must not send a computer's own sound back to it.
//
// The real helpers, end to end, the way the app runs them: this test plays
// the app. It starts FluidEQ-LAN-Playback, has it open the default output and
// play a tone as if it had arrived from another computer, and asks it for the
// two captures — the network's (`lan`) and the second output's (`local`).
// The network's must not hear the tone: anything it heard would travel back
// to the computer that sent it, and round again. The local one must hear it,
// which is also this test's positive control — a capture that heard nothing
// at all would pass the first check for the wrong reason.
//
// 21 kHz at -50 dBFS: inaudible, and above where streamed music stops — the
// codecs YouTube and the streaming services use cut off near 20 kHz. At
// 18.5 kHz a K-pop video playing on the same machine sat 5 dB under a -60
// dBFS tone and read as an echo. Played in a fixed on/off pattern, and what a
// capture is credited with hearing is only the power at that frequency that
// rises and falls with the pattern, standing out of how much the other
// delays scatter: whatever else is playing lands on the "on" and "off"
// stretches alike. Needs an output device; with none (a build server) it
// reports itself skipped.
#include <Windows.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

namespace {

constexpr int kSkip = 77;
constexpr double kPi = 3.14159265358979323846;
constexpr double kToneHz = 21000.0;
constexpr float kToneAmplitude = 0.0031623f;  // -50 dBFS
constexpr double kToneDb = -50.0;
// The pattern's unit: ten of the 480-frame blocks this test plays in.
constexpr std::uint32_t kSegmentFrames = 4800;
constexpr std::size_t kWindow = 1024;
/** How many times the scatter of the other delays a match has to stand out
 * by to be the tone and not the music. A tone that is there stands about
 * ten out, the most a 60-segment pattern can show; chance matches on music
 * stood under six. */
constexpr double kStandout = 5.0;

struct Heard {
  double db = -999.0;
  double standout = 0.0;
};

/** Whether the tone plays in segment `n`: a fixed pseudo-random sequence, so
 * nothing periodic in the music can line up with it. */
bool tone_on(std::uint32_t n) {
  std::uint32_t state = 0xACE1u;
  for (std::uint32_t i = 0; i <= n; ++i) {
    const std::uint32_t bit = ((state >> 0) ^ (state >> 2) ^ (state >> 3) ^ (state >> 5)) & 1u;
    state = (state >> 1) | (bit << 15);
  }
  return (state & 1u) != 0;
}

struct Header {
  std::uint32_t magic = 0x31504c46, kind = 0, id = 0, rate = 0;
  std::uint16_t channels = 0, frames = 0;
  std::uint32_t bytes = 0;
};
static_assert(sizeof(Header) == 24);

struct FrameHeader {
  std::uint32_t magic, kind, sequence, rate;
  std::uint16_t channels, frames;
  std::uint32_t bytes;
};
static_assert(sizeof(FrameHeader) == 24);

bool has_output_device() {
  Microsoft::WRL::ComPtr<IMMDeviceEnumerator> enumerator;
  if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
                              IID_PPV_ARGS(&enumerator)))) {
    return false;
  }
  Microsoft::WRL::ComPtr<IMMDevice> device;
  return SUCCEEDED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole, &device));
}

std::string random_hex(std::size_t bytes) {
  static const char* digits = "0123456789abcdef";
  std::string out;
  LARGE_INTEGER seed{};
  QueryPerformanceCounter(&seed);
  std::uint64_t state = static_cast<std::uint64_t>(seed.QuadPart) ^ GetCurrentProcessId();
  for (std::size_t i = 0; i < bytes; ++i) {
    state = state * 6364136223846793005ULL + 1442695040888963407ULL;
    const auto value = static_cast<unsigned>(state >> 56);
    out += digits[value >> 4];
    out += digits[value & 15];
  }
  return out;
}

bool read_exact(HANDLE handle, void* data, DWORD size, bool overlapped) {
  auto* bytes = static_cast<char*>(data);
  while (size != 0) {
    DWORD done = 0;
    OVERLAPPED operation{};
    operation.hEvent = overlapped ? CreateEventW(nullptr, TRUE, FALSE, nullptr) : nullptr;
    BOOL ok = ReadFile(handle, bytes, size, &done, overlapped ? &operation : nullptr);
    if (!ok && overlapped && GetLastError() == ERROR_IO_PENDING) {
      ok = GetOverlappedResult(handle, &operation, &done, TRUE);
    }
    if (operation.hEvent) CloseHandle(operation.hEvent);
    if (!ok || done == 0) return false;
    bytes += done;
    size -= done;
  }
  return true;
}

bool write_all(HANDLE handle, const void* data, DWORD size) {
  DWORD done = 0;
  return WriteFile(handle, data, size, &done, nullptr) && done == size;
}

/** One capture the playback helper started, as the app sees it. */
struct Capture {
  std::wstring pipe_name;
  std::string token;
  HANDLE commands = INVALID_HANDLE_VALUE;
  HANDLE frames = INVALID_HANDLE_VALUE;
  std::thread reader;
  std::mutex lock;
  std::vector<float> mono;
  std::uint32_t rate = 0;
  std::atomic<std::uint64_t> frames_read{0};
  std::atomic<bool> failed{false};
};

HANDLE accept_one(const std::wstring& name) {
  const HANDLE pipe = CreateNamedPipeW(
      name.c_str(), PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED,
      PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT | PIPE_REJECT_REMOTE_CLIENTS, 2,
      1 << 20, 1 << 20, 0, nullptr);
  return pipe;
}

bool connect(HANDLE pipe) {
  OVERLAPPED operation{};
  operation.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  BOOL ok = ConnectNamedPipe(pipe, &operation);
  DWORD unused = 0;
  if (!ok && GetLastError() == ERROR_IO_PENDING) {
    ok = GetOverlappedResult(pipe, &operation, &unused, TRUE);
  } else if (!ok && GetLastError() == ERROR_PIPE_CONNECTED) {
    ok = TRUE;
  }
  CloseHandle(operation.hEvent);
  return ok != FALSE;
}

std::string read_line(HANDLE pipe) {
  std::string line;
  char c = 0;
  while (line.size() < 256 && read_exact(pipe, &c, 1, true) && c != '\n') line += c;
  return line;
}

/** Both instances of the pipe exist before the helper is asked to start the
 * capture, so its two connections always find one waiting. */
bool serve(Capture* capture) {
  capture->commands = accept_one(capture->pipe_name);
  capture->frames = accept_one(capture->pipe_name);
  return capture->commands != INVALID_HANDLE_VALUE &&
         capture->frames != INVALID_HANDLE_VALUE;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc != 2) {
    std::printf("usage: echo_tree_test <FluidEQ-LAN-Playback.exe>\n");
    return 2;
  }
  if (FAILED(CoInitializeEx(nullptr, COINIT_MULTITHREADED))) return 2;
  if (!has_output_device()) {
    std::printf("echo tree: no output device, skipped\n");
    return kSkip;
  }

  // The playback helper, on pipes of our own, like the app's child.
  SECURITY_ATTRIBUTES inherit{sizeof(inherit), nullptr, TRUE};
  HANDLE child_in_read = nullptr, child_in_write = nullptr;
  HANDLE child_out_read = nullptr, child_out_write = nullptr;
  if (!CreatePipe(&child_in_read, &child_in_write, &inherit, 1 << 20) ||
      !CreatePipe(&child_out_read, &child_out_write, &inherit, 1 << 20)) {
    return 2;
  }
  SetHandleInformation(child_in_write, HANDLE_FLAG_INHERIT, 0);
  SetHandleInformation(child_out_read, HANDLE_FLAG_INHERIT, 0);
  std::wstring command = L"\"";
  for (const char* c = argv[1]; *c; ++c) command += static_cast<wchar_t>(*c);
  command += L"\" --parent-pid " + std::to_wstring(GetCurrentProcessId());
  STARTUPINFOW startup{};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESTDHANDLES;
  startup.hStdInput = child_in_read;
  startup.hStdOutput = child_out_write;
  startup.hStdError = GetStdHandle(STD_ERROR_HANDLE);
  PROCESS_INFORMATION helper{};
  if (!CreateProcessW(nullptr, command.data(), nullptr, nullptr, TRUE, CREATE_NO_WINDOW,
                      nullptr, nullptr, &startup, &helper)) {
    std::printf("echo tree: could not start the playback helper (%lu)\n", GetLastError());
    return 1;
  }
  CloseHandle(child_in_read);
  CloseHandle(child_out_write);

  int failures = 0;
  std::atomic<bool> helper_alive{true};
  std::atomic<std::uint32_t> open_result{0xffffffffu};
  std::thread replies([&] {
    Header header;
    std::vector<char> body;
    while (read_exact(child_out_read, &header, sizeof(header), false)) {
      body.resize(header.bytes);
      if (header.bytes && !read_exact(child_out_read, body.data(), header.bytes, false)) break;
      if (header.kind == 3 && header.id == 1) open_result = header.rate;
      if (header.kind == 4) std::printf("echo tree: helper reported 0x%08x\n", header.rate);
    }
    helper_alive = false;
  });

  const auto send = [&](Header header, const void* body) {
    return write_all(child_in_write, &header, sizeof(header)) &&
           (header.bytes == 0 || write_all(child_in_write, body, header.bytes));
  };

  Header open;
  open.kind = 1;
  open.id = 1;
  if (!send(open, nullptr)) return 1;
  while (open_result == 0xffffffffu && helper_alive) SwitchToThread();
  if (open_result != 0) {
    std::printf("echo tree: the output did not open (0x%08x), skipped\n", open_result.load());
    TerminateProcess(helper.hProcess, 0);
    replies.join();
    return kSkip;
  }

  Capture lan, local;
  for (Capture* capture : {&lan, &local}) {
    const std::string hex = random_hex(16);
    const std::string name = "\\\\.\\pipe\\FluidEQ-LAN-" + hex;
    capture->pipe_name.assign(name.begin(), name.end());
    capture->token = random_hex(32);
    if (!serve(capture)) {
      std::printf("echo tree: could not serve a pipe\n");
      return 1;
    }
    Header spawn;
    spawn.kind = 8;
    spawn.id = capture == &lan ? 2 : 3;
    const std::string request =
        name + " " + capture->token + (capture == &lan ? " lan" : " local");
    spawn.bytes = static_cast<std::uint32_t>(request.size());
    if (!send(spawn, request.data())) return 1;
    if (!connect(capture->commands) || !connect(capture->frames)) {
      std::printf("echo tree: a capture never connected\n");
      return 1;
    }
    // Either connection may arrive first; each names itself.
    const std::string a = read_line(capture->commands);
    const std::string b = read_line(capture->frames);
    const std::string prefix = "FLUIDEQ-CAPTURE " + capture->token + " ";
    if (a.rfind(prefix, 0) != 0 || b.rfind(prefix, 0) != 0) {
      std::printf("echo tree: a capture introduced itself wrongly\n");
      return 1;
    }
    if (a.find(" frames ") != std::string::npos) std::swap(capture->commands, capture->frames);
    capture->reader = std::thread([capture] {
      FrameHeader header;
      std::vector<float> samples;
      while (read_exact(capture->frames, &header, sizeof(header), true)) {
        if (header.magic != 0x314e414cU) break;
        samples.resize(header.bytes / sizeof(float));
        if (header.bytes && !read_exact(capture->frames, samples.data(), header.bytes, true)) break;
        if (header.kind == 1) {
          capture->rate = header.rate;
        } else if (header.kind == 2 && header.channels != 0) {
          std::lock_guard guard(capture->lock);
          for (std::uint32_t f = 0; f < header.frames; ++f) {
            capture->mono.push_back(samples[static_cast<std::size_t>(f) * header.channels]);
          }
          capture->frames_read += header.frames;
        }
      }
      capture->failed = true;
    });
  }

  // The tone, paced by the local capture's own clock: a block played for
  // every block the capture hands back, so nothing here guesses at time.
  std::uint32_t rate = 0;
  while ((rate = local.rate) == 0 && !local.failed) SwitchToThread();
  if (rate == 0) {
    std::printf("echo tree: the local capture never started\n");
    return 1;
  }
  double phase = 0;
  const double step = 2 * kPi * kToneHz / rate;
  std::uint32_t sequence = 0;
  std::uint64_t played = 0;
  const std::uint64_t total = static_cast<std::uint64_t>(rate) * 6;
  const std::uint64_t lead = rate / 10;  // keep the helper a block ahead
  std::vector<float> block;
  while (local.frames_read < total && !local.failed && !lan.failed && helper_alive) {
    if (played > local.frames_read + lead) {
      SwitchToThread();
      continue;
    }
    const std::uint16_t frames = 480;
    block.assign(1 + frames * 2u, 0.0f);
    std::memcpy(block.data(), &sequence, 4);
    const float gain = tone_on(static_cast<std::uint32_t>(played / kSegmentFrames)) ? 1.0f : 0.0f;
    ++sequence;
    for (std::uint16_t f = 0; f < frames; ++f) {
      const float value = gain * kToneAmplitude * static_cast<float>(std::sin(phase));
      phase += step;
      block[1 + f * 2u] = value;
      block[2 + f * 2u] = value;
    }
    Header audio;
    audio.kind = 2;
    audio.id = 1;
    audio.rate = rate;
    audio.channels = 2;
    audio.frames = frames;
    audio.bytes = 4u + frames * 2u * 4u;
    if (!send(audio, block.data())) break;
    played += frames;
  }

  // Short Hann windows: the playback helper keeps a link in step by playing
  // up to 0.1% fast or slow, which moves the tone by up to 21 Hz — a long
  // lock-in loses it, a 21 ms window does not. Each window's power at the
  // tone, then the pattern laid over them at every delay the capture could
  // be behind by (it started first, and the output adds its own), keeping the
  // delay where "on" stands furthest above "off".
  const auto level = [](Capture& capture) {
    std::lock_guard guard(capture.lock);
    std::vector<double> power;
    for (std::size_t start = 0; start + kWindow <= capture.mono.size(); start += kWindow) {
      double i = 0, q = 0, weight = 0;
      for (std::size_t k = 0; k < kWindow; ++k) {
        const double hann = 0.5 - 0.5 * std::cos(2 * kPi * static_cast<double>(k) / (kWindow - 1));
        const double w = 2 * kPi * kToneHz * static_cast<double>(start + k) / capture.rate;
        i += capture.mono[start + k] * hann * std::cos(w);
        q += capture.mono[start + k] * hann * std::sin(w);
        weight += hann;
      }
      const double amplitude = 2 * std::sqrt(i * i + q * q) / weight;
      power.push_back(amplitude * amplitude);
    }
    std::vector<double> contrasts;
    for (std::size_t delay = 0; delay < capture.rate; delay += 256) {
      double on = 0, off = 0;
      std::size_t ons = 0, offs = 0;
      for (std::size_t w = 0; w < power.size(); ++w) {
        const std::size_t start = w * kWindow;
        if (start < delay) continue;
        const std::size_t at = start - delay;
        // A window across a segment's edge is half of each: neither.
        if (at % kSegmentFrames + kWindow > kSegmentFrames) continue;
        if (tone_on(static_cast<std::uint32_t>(at / kSegmentFrames))) {
          on += power[w];
          ++ons;
        } else {
          off += power[w];
          ++offs;
        }
      }
      if (ons < 16 || offs < 16) continue;
      contrasts.push_back(on / static_cast<double>(ons) - off / static_cast<double>(offs));
    }
    Heard heard;
    if (contrasts.empty()) return heard;
    const auto peak = std::max_element(contrasts.begin(), contrasts.end());
    const double best = *peak;
    const auto best_at = static_cast<std::size_t>(peak - contrasts.begin());
    // How far the best delay stands above the scatter of the delays more than
    // a segment away from it: a tone that is really there lines up at one
    // delay (and its neighbours inside the same segment) and nowhere else,
    // while loud music full of treble lines up a little at many by chance —
    // the best of 180-odd delays read a K-pop video as a 10 dB "echo".
    std::vector<double> distant;
    for (std::size_t at = 0; at < contrasts.size(); ++at) {
      const std::size_t apart = (at > best_at ? at - best_at : best_at - at) * 256;
      if (apart > kSegmentFrames) distant.push_back(contrasts[at]);
    }
    if (distant.size() < 16) return heard;
    std::vector<double> sorted = distant;
    std::sort(sorted.begin(), sorted.end());
    const double median = sorted[sorted.size() / 2];
    std::vector<double> spread;
    for (const double value : distant) spread.push_back(std::abs(value - median));
    std::sort(spread.begin(), spread.end());
    const double scatter = 1.4826 * spread[spread.size() / 2] + 1e-30;
    heard.db = best > 0 ? 10 * std::log10(best) : -999.0;
    heard.standout = (best - median) / scatter;
    return heard;
  };
  const Heard heard_by_network = level(lan);
  const Heard heard_locally = level(local);
  std::printf("echo tree: network capture %.1f dB (%.1f above the scatter), "
              "local capture %.1f dB (%.1f above)\n",
              heard_by_network.db, heard_by_network.standout, heard_locally.db,
              heard_locally.standout);
  if (lan.frames_read < rate) {
    std::printf("FAILED: the network capture never ran, so its silence proves nothing\n");
    ++failures;
  }
  if (heard_locally.db < kToneDb - 6.0) {
    std::printf("FAILED: the local capture did not hear the received sound\n");
    ++failures;
  }
  // An echo is the tone at one delay, standing out of the scatter, near the
  // local capture's level. Relative, not absolute: whatever else this machine
  // is playing reaches both captures alike.
  if (heard_by_network.db > heard_locally.db - 20.0 &&
      heard_by_network.standout >= kStandout) {
    std::printf("FAILED: the network capture heard the received sound\n");
    ++failures;
  }

  Header quit;
  quit.kind = 6;
  send(quit, nullptr);
  CloseHandle(child_in_write);
  WaitForSingleObject(helper.hProcess, INFINITE);
  replies.join();
  for (Capture* capture : {&lan, &local}) {
    CloseHandle(capture->commands);
    CloseHandle(capture->frames);
    capture->reader.join();
  }
  CloseHandle(helper.hProcess);
  CloseHandle(helper.hThread);
  if (failures == 0) std::printf("echo tree: no echo, local still hears it\n");
  return failures == 0 ? 0 : 1;
}
