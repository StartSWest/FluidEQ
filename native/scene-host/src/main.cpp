/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Scenes: the desk lights, with no window.
 *
 * The lamps used to be drawn by the window — its capture of the speakers,
 * its scene in a worker, its frame sent to main thirty times a second — so
 * a desk lit by FluidEQ held the whole window in memory, minimised or not.
 * This is that loop in one small program: the default output's loopback
 * heard as the window hears it (`LampEar`), the scene drawn on the ANGLE
 * Electron ships (`LampPainter`), and the grid handed to main on stdout.
 *
 *   FluidEQ-Scenes --parent-pid <pid> --angle-dir <folder holding libEGL>
 *
 * Main speaks on stdin and hears on stdout, in `scene_wire.h`'s messages.
 * Three threads besides Windows' own: this one hears the output, one draws,
 * one reads stdin, and one writes stdout so a slow reader never holds the
 * ear. Ends with 0 when stdin closes or the parent goes; 1 when it cannot
 * start; 2 on bad arguments; 4 when main's messages stop making sense.
 */

#define NOMINMAX
#define WIN32_LEAN_AND_MEAN
#include <Windows.h>
#include <audioclient.h>
#include <avrt.h>
#include <shellapi.h>
#include <mmdeviceapi.h>
#include <wrl/client.h>
#include <wrl/implements.h>

#include <array>
#include <condition_variable>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <deque>
#include <iterator>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <thread>
#include <variant>
#include <vector>

#include "../../common/loopback_capture.h"
#include "../../dsp-host/src/platform/windows/device_watch.h"
#include "artwork_decode.h"
#include "fluideq/scene/lamp_atmosphere.h"
#include "fluideq/scene/lamp_ear.h"
#include "fluideq/scene/lamp_pacing.h"
#include "lamp_messages.h"
#include "lamp_painter.h"
#include "scene_wire.h"

namespace {

namespace scene = feq::scene;
namespace wire = feq::scene::wire;
using feq::listen::fill_silence;
using feq::listen::Loopback;
using feq::listen::Silence;
using feq::listen::start_loopback;
using feq::listen::start_silence;
using feq::listen::UniqueHandle;
using Microsoft::WRL::ComPtr;

constexpr int kStopped = 0;
constexpr int kFailed = 1;
constexpr int kBadArguments = 2;
constexpr int kBrokenWire = 4;

/** Up to 7.1: the lamps hear the front pair of anything wider. */
constexpr std::uint16_t kMaxChannels = 8;
/** Grids and pictures waiting for stdout past this are dropped, oldest first. */
constexpr std::size_t kMostWaiting = 8;
/** The app's accent before main says otherwise (`--accent` default). */
constexpr std::array<double, 3> kDefaultAccent{0.0, 229.0 / 255.0,
                                               207.0 / 255.0};

void say(const char* what) { std::fprintf(stderr, "FluidEQ-Scenes: %s\n", what); }

int fail(const char* message, HRESULT result) {
  std::fprintf(stderr, "FluidEQ-Scenes: %s (0x%08lx)\n", message,
               static_cast<unsigned long>(result));
  return kFailed;
}

struct Arguments {
  DWORD parent_pid = 0;
  std::wstring angle_dir;
};

bool parse_arguments(Arguments& out) {
  int count = 0;
  wchar_t** argv = CommandLineToArgvW(GetCommandLineW(), &count);
  if (argv == nullptr) {
    return false;
  }
  for (int at = 1; at + 1 < count; at += 2) {
    const std::wstring name = argv[at];
    const wchar_t* value = argv[at + 1];
    if (name == L"--parent-pid") {
      wchar_t* end = nullptr;
      const unsigned long pid = std::wcstoul(value, &end, 10);
      if (end == value || *end != L'\0' || pid == 0) {
        LocalFree(argv);
        return false;
      }
      out.parent_pid = static_cast<DWORD>(pid);
    } else if (name == L"--angle-dir") {
      out.angle_dir = value;
    } else {
      LocalFree(argv);
      return false;
    }
  }
  const bool whole = count % 2 == 1;
  LocalFree(argv);
  return whole && out.parent_pid != 0 && !out.angle_dir.empty();
}

/**
 * stdout, written on a thread of its own. Loaded and failed messages are
 * kept whatever happens; a grid or picture is the newest of a stream, and
 * when main falls behind the oldest waiting ones are the ones dropped.
 */
class Mouth {
 public:
  Mouth() : thread_([this] { run(); }) {}
  ~Mouth() {
    {
      const std::lock_guard lock(mutex_);
      stopping_ = true;
    }
    ready_.notify_one();
    thread_.join();
  }
  Mouth(const Mouth&) = delete;
  Mouth& operator=(const Mouth&) = delete;

  void say(std::vector<std::uint8_t> message, bool droppable) {
    {
      const std::lock_guard lock(mutex_);
      waiting_.push_back({std::move(message), droppable});
      for (auto at = waiting_.begin();
           waiting_.size() > kMostWaiting && at != waiting_.end();) {
        at = at->droppable ? waiting_.erase(at) : std::next(at);
      }
    }
    ready_.notify_one();
  }

 private:
  struct Waiting {
    std::vector<std::uint8_t> bytes;
    bool droppable;
  };

  void run() {
    const HANDLE out = GetStdHandle(STD_OUTPUT_HANDLE);
    for (;;) {
      Waiting next;
      {
        std::unique_lock lock(mutex_);
        ready_.wait(lock, [this] { return stopping_ || !waiting_.empty(); });
        if (stopping_) {
          return;
        }
        next = std::move(waiting_.front());
        waiting_.pop_front();
      }
      std::size_t sent = 0;
      while (sent < next.bytes.size()) {
        DWORD wrote = 0;
        if (WriteFile(out, next.bytes.data() + sent,
                      static_cast<DWORD>(next.bytes.size() - sent), &wrote,
                      nullptr) == FALSE) {
          // Main has gone; stdin closing ends the program.
          return;
        }
        sent += wrote;
      }
    }
  }

  std::mutex mutex_;
  std::condition_variable ready_;
  std::deque<Waiting> waiting_;
  bool stopping_ = false;
  std::thread thread_;
};

/** What the ear is to hear with, set by main between blocks. */
struct EarSettings {
  scene::LampProfile profile;
  std::array<double, 3> accent = kDefaultAccent;
  bool paused = false;
};

/** What the drawing thread is asked to do, in order. */
struct Unload {};
struct Refuse {
  std::uint32_t id;
  std::string why;
};
struct Preview {
  bool wanted;
};
using Command = std::variant<scene::LampScene, Unload, Refuse, Preview>;

/** Everything the threads share, each part under the one lock. */
struct Desk {
  std::mutex mutex;
  EarSettings ear;
  bool ear_changed = true;
  std::vector<scene::Rgb> swatch;
  wire::Daylight daylight;
  std::deque<Command> commands;
  std::optional<scene::HeardLampFrame> frame;
  /** Auto-reset: a frame waits, or commands do. */
  UniqueHandle frame_ready{CreateEventW(nullptr, FALSE, FALSE, nullptr)};
  UniqueHandle commands_ready{CreateEventW(nullptr, FALSE, FALSE, nullptr)};
  /** Manual-reset: everything stops. */
  UniqueHandle stop{CreateEventW(nullptr, TRUE, FALSE, nullptr)};
  int stopped_with = kStopped;

  void command(Command next) {
    {
      const std::lock_guard lock(mutex);
      commands.push_back(std::move(next));
    }
    SetEvent(commands_ready.get());
  }
  void end(int code) {
    {
      const std::lock_guard lock(mutex);
      if (WaitForSingleObject(stop.get(), 0) != WAIT_OBJECT_0) {
        stopped_with = code;
      }
    }
    SetEvent(stop.get());
  }
};

/** The time of day to draw at now: the clock's or the one main set. */
double daylight_now(const wire::Daylight& daylight) {
  if (daylight.mode != wire::DaylightMode::kClock) {
    return daylight.value;
  }
  SYSTEMTIME local{};
  GetLocalTime(&local);
  return scene::clock_daylight(local.wHour, local.wMinute, local.wSecond);
}

scene::LampScene scene_of(std::uint32_t id, wire::ShownScene shown,
                          std::vector<std::uint8_t> artwork) {
  scene::LampScene made;
  made.id = id;
  made.guarded = shown.guarded;
  made.response = shown.response;
  made.pack.vertex_source = std::move(shown.vertex_source);
  made.pack.fragment_source = std::move(shown.fragment_source);
  for (const auto& param : shown.params) {
    // `uniformNameForParam`.
    made.pack.params.emplace_back("uParam_" + param.id, param.value);
  }
  made.params = std::move(shown.params);
  made.pack.artwork = std::move(artwork);
  made.pack.artwork_width = made.pack.artwork.empty() ? 0 : shown.artwork_width;
  made.pack.artwork_height =
      made.pack.artwork.empty() ? 0 : shown.artwork_height;
  made.pack.view = shown.view;
  made.pack.spectrum_rect = shown.spectrum_rect;
  return made;
}

/** One message from main, acted on; false when it is not one. */
bool hear_message(Desk& desk, wire::Kind kind,
                  std::span<const std::uint8_t> payload) {
  switch (kind) {
    case wire::Kind::kShow: {
      wire::Show show;
      if (!wire::read_show(payload, show)) {
        return false;
      }
      {
        const std::lock_guard lock(desk.mutex);
        desk.swatch = show.swatch;
      }
      if (!show.scene) {
        desk.command(Unload{});
        return true;
      }
      std::vector<std::uint8_t> artwork;
      if (!show.scene->webp.empty()) {
        // Decoded here, never on the drawing thread: a large picture takes
        // tens of milliseconds the desk would otherwise stand still for.
        std::string why;
        if (!scene::decode_artwork(show.scene->webp,
                                   show.scene->artwork_width,
                                   show.scene->artwork_height, artwork, why)) {
          desk.command(Refuse{show.id, why});
          return true;
        }
      }
      desk.command(scene_of(show.id, std::move(*show.scene), std::move(artwork)));
      return true;
    }
    case wire::Kind::kDaylight: {
      wire::Daylight daylight;
      if (!wire::read_daylight(payload, daylight)) {
        return false;
      }
      const std::lock_guard lock(desk.mutex);
      desk.daylight = daylight;
      return true;
    }
    case wire::Kind::kPause: {
      bool paused = false;
      if (!wire::read_flag(payload, paused)) {
        return false;
      }
      const std::lock_guard lock(desk.mutex);
      desk.ear.paused = paused;
      desk.ear_changed = true;
      return true;
    }
    case wire::Kind::kProfile: {
      scene::LampProfile profile;
      if (!wire::read_profile(payload, profile)) {
        return false;
      }
      const std::lock_guard lock(desk.mutex);
      desk.ear.profile = profile;
      desk.ear_changed = true;
      return true;
    }
    case wire::Kind::kAccent: {
      std::array<double, 3> accent{};
      if (!wire::read_accent(payload, accent)) {
        return false;
      }
      const std::lock_guard lock(desk.mutex);
      desk.ear.accent = accent;
      desk.ear_changed = true;
      return true;
    }
    case wire::Kind::kPreview: {
      bool wanted = false;
      if (!wire::read_flag(payload, wanted)) {
        return false;
      }
      desk.command(Preview{wanted});
      return true;
    }
    default:
      return false;
  }
}

/** stdin, until it closes or stops making sense. */
void read_main(Desk& desk) {
  // WIC decodes the artwork on this thread.
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  wire::Framer framer;
  std::vector<std::uint8_t> chunk(64 * 1024);
  int code = kStopped;
  for (bool reading = true; reading;) {
    DWORD read = 0;
    if (ReadFile(input, chunk.data(), static_cast<DWORD>(chunk.size()), &read,
                 nullptr) == FALSE ||
        read == 0) {
      break;
    }
    framer.feed(std::span<const std::uint8_t>(chunk.data(), read));
    bool broken = false;
    while (auto message = framer.next(broken)) {
      if (!hear_message(desk, message->first, message->second)) {
        broken = true;
        break;
      }
    }
    if (broken) {
      say("main sent something that is not a message");
      code = kBrokenWire;
      reading = false;
    }
  }
  if (SUCCEEDED(com)) {
    CoUninitialize();
  }
  desk.end(code);
}

/** What the painter says, said to main. */
scene::LampPainter::Output output_to(Mouth& mouth) {
  scene::LampPainter::Output output;
  output.loaded = [&mouth](std::uint32_t id) {
    mouth.say(wire::loaded_message(id), false);
  };
  output.failed = [&mouth](std::uint32_t id, wire::FailReason reason,
                           const std::string& words) {
    std::fprintf(stderr, "FluidEQ-Scenes: scene %u failed (%u): %s\n", id,
                 static_cast<unsigned>(reason), words.c_str());
    mouth.say(wire::failed_message(id, reason, words), false);
  };
  output.painted = [&mouth](const scene::PaintedGrid& grid) {
    wire::GridReading reading;
    reading.level = grid.level;
    reading.beat = grid.beat;
    reading.bands = grid.bands;
    reading.delta_ms = grid.delta_ms;
    reading.time_seconds = grid.time_seconds;
    reading.activity = grid.activity;
    reading.drawn = true;
    mouth.say(wire::grid_message(grid.rgb, reading), true);
    if (!grid.preview.empty()) {
      mouth.say(wire::picture_message(grid.preview, grid.preview_width,
                                      grid.preview_height),
                true);
    }
  };
  return output;
}

/**
 * The drawing thread: commands in order, then the newest frame. The painter
 * is closed here, on the thread its context is current on.
 */
void draw(Desk& desk, Mouth& mouth, scene::LampPainter& painter) {
  const HANDLE waits[]{desk.stop.get(), desk.commands_ready.get(),
                       desk.frame_ready.get()};
  for (;;) {
    const DWORD woke = WaitForMultipleObjects(
        static_cast<DWORD>(std::size(waits)), waits, FALSE, INFINITE);
    if (woke != WAIT_OBJECT_0 + 1 && woke != WAIT_OBJECT_0 + 2) {
      painter.close();
      return;
    }
    std::deque<Command> commands;
    std::optional<scene::HeardLampFrame> frame;
    wire::Daylight daylight;
    {
      const std::lock_guard lock(desk.mutex);
      commands.swap(desk.commands);
      frame.swap(desk.frame);
      daylight = desk.daylight;
    }
    for (auto& command : commands) {
      if (auto* load = std::get_if<scene::LampScene>(&command)) {
        painter.load(std::move(*load));
      } else if (std::holds_alternative<Unload>(command)) {
        painter.unload();
      } else if (auto* refused = std::get_if<Refuse>(&command)) {
        painter.unload();
        mouth.say(wire::failed_message(refused->id, wire::FailReason::kArtwork,
                                       refused->why),
                  false);
      } else if (auto* preview = std::get_if<Preview>(&command)) {
        painter.set_preview(preview->wanted);
      }
    }
    painter.settle();
    if (frame) {
      painter.paint(std::move(*frame), daylight_now(daylight));
    }
  }
}

/** A frame heard: drawn as the scene, or lit with the scene's colours. */
void heard(Desk& desk, Mouth& mouth, const scene::LampPainter& painter,
           const scene::HeardLampFrame& frame, std::vector<std::uint8_t>& rgb) {
  if (!painter.failed()) {
    {
      const std::lock_guard lock(desk.mutex);
      // The newest wins: a frame still waiting is older than this one, and a
      // queue behind a slow GPU would light the desk late.
      desk.frame = frame;
    }
    SetEvent(desk.frame_ready.get());
    return;
  }
  std::vector<scene::Rgb> swatch;
  {
    const std::lock_guard lock(desk.mutex);
    swatch = desk.swatch;
  }
  scene::fill_swatch_grid(swatch, frame.frame.spectrum,
                          scene::kLightingGridWidth, scene::kLightingGridHeight,
                          rgb);
  wire::GridReading reading;
  reading.level = frame.frame.level;
  reading.beat = frame.frame.beat;
  reading.bands = frame.frame.bands;
  reading.delta_ms = frame.delta_ms;
  reading.time_seconds = frame.frame.time_seconds;
  reading.activity = frame.activity;
  reading.drawn = false;
  mouth.say(wire::grid_message(rgb, reading), true);
}

void on_outputs_changed(void* reopen) { SetEvent(static_cast<HANDLE>(reopen)); }

/** The ear's settings, taken when main has changed them. */
void tune_ear(Desk& desk, scene::LampEar& ear) {
  const std::lock_guard lock(desk.mutex);
  if (!desk.ear_changed) {
    return;
  }
  desk.ear_changed = false;
  ear.set_profile(desk.ear.profile);
  ear.set_accent(desk.ear.accent);
  ear.set_paused(desk.ear.paused);
}

/**
 * The default output heard until the desk stops: opened again whenever
 * Windows moves the default or the one heard goes, and while none can be
 * opened, tried again on each change Windows reports — never on a clock.
 */
int listen(Desk& desk, Mouth& mouth, const scene::LampPainter& painter,
           HANDLE parent) {
  const UniqueHandle sample_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle silence_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  const UniqueHandle reopen_event(CreateEventW(nullptr, FALSE, FALSE, nullptr));
  if (!sample_event.valid() || !silence_event.valid() || !reopen_event.valid()) {
    return fail("events could not be made", HRESULT_FROM_WIN32(GetLastError()));
  }
  ComPtr<IMMDeviceEnumerator> enumerator;
  HRESULT result = CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                    CLSCTX_ALL, IID_PPV_ARGS(&enumerator));
  if (FAILED(result)) {
    return fail("the outputs could not be listed", result);
  }
  DeviceWatch watch(on_outputs_changed, reopen_event.get());
  scene::LampEar ear(kDefaultAccent);
  Loopback loopback;
  Silence silence;
  std::vector<float> zeros;
  std::vector<std::uint8_t> rgb;
  const auto on_frame = [&](const scene::HeardLampFrame& frame) {
    heard(desk, mouth, painter, frame, rgb);
  };
  const auto close = [&] {
    if (loopback.client) {
      loopback.client->Stop();
    }
    if (silence.client) {
      silence.client->Stop();
    }
    loopback = {};
    silence = {};
  };
  const auto open = [&] {
    close();
    watch.await_endpoint();
    ComPtr<IMMDevice> endpoint;
    if (FAILED(enumerator->GetDefaultAudioEndpoint(eRender, eConsole,
                                                   &endpoint))) {
      say("no default output yet; waiting for one");
      return;
    }
    const char* step = "";
    const HRESULT heard_result = start_loopback(
        endpoint.Get(), sample_event.get(), kMaxChannels, &loopback, &step);
    if (FAILED(heard_result)) {
      std::fprintf(stderr, "FluidEQ-Scenes: %s (0x%08lx)\n", step,
                   static_cast<unsigned long>(heard_result));
      loopback = {};
    }
    // Keeps a quiet output sending silence, and is the desk's clock when the
    // output cannot be heard at all (`lampIdleClock.ts`).
    const HRESULT quiet =
        start_silence(endpoint.Get(), silence_event.get(), &silence);
    if (FAILED(quiet)) {
      silence = {};
    }
    if (loopback.client) {
      ear.listen_at(loopback.rate);
      watch.endpoint_open();
    } else if (silence.client) {
      ear.listen_at(silence.rate);
      watch.endpoint_open();
    }
  };
  open();

  const auto drain = [&]() -> bool {
    for (;;) {
      UINT32 frames = 0;
      HRESULT got = loopback.capture->GetNextPacketSize(&frames);
      if (FAILED(got)) {
        return false;
      }
      if (frames == 0) {
        return true;
      }
      BYTE* data = nullptr;
      DWORD flags = 0;
      got = loopback.capture->GetBuffer(&data, &frames, &flags, nullptr,
                                        nullptr);
      if (FAILED(got)) {
        return false;
      }
      tune_ear(desk, ear);
      const std::size_t samples =
          static_cast<std::size_t>(frames) * loopback.channels;
      const float* samples_at = reinterpret_cast<const float*>(data);
      if ((flags & AUDCLNT_BUFFERFLAGS_SILENT) != 0) {
        // A silent packet's buffer holds nothing to read: silence is zeros.
        zeros.assign(samples, 0.0F);
        samples_at = zeros.data();
      }
      ear.push(samples_at, frames, loopback.channels, on_frame);
      if (FAILED(loopback.capture->ReleaseBuffer(frames))) {
        return false;
      }
    }
  };

  DWORD task_index = 0;
  const HANDLE task = AvSetMmThreadCharacteristicsW(L"Audio", &task_index);
  int code = -1;
  while (code < 0) {
    const HANDLE waits[]{sample_event.get(), silence_event.get(),
                         reopen_event.get(), desk.stop.get(), parent};
    const DWORD woke = WaitForMultipleObjects(
        static_cast<DWORD>(std::size(waits)), waits, FALSE, INFINITE);
    if (woke == WAIT_OBJECT_0) {
      if (loopback.capture && !drain()) {
        say("the output went; opening the default again");
        open();
      }
    } else if (woke == WAIT_OBJECT_0 + 1) {
      UINT32 written = 0;
      if (!silence.client || FAILED(fill_silence(&silence, &written))) {
        open();
      } else if (!loopback.client && written > 0) {
        // Nothing to hear: the desk rests on the output's own clock.
        tune_ear(desk, ear);
        zeros.assign(static_cast<std::size_t>(written) * 2, 0.0F);
        ear.push(zeros.data(), written, 2, on_frame);
      }
    } else if (woke == WAIT_OBJECT_0 + 2) {
      open();
    } else if (woke == WAIT_OBJECT_0 + 3) {
      code = kStopped;
    } else if (woke == WAIT_OBJECT_0 + 4) {
      desk.end(kStopped);
      code = kStopped;
    } else {
      code = fail("waiting failed", HRESULT_FROM_WIN32(GetLastError()));
      desk.end(code);
    }
  }
  if (task != nullptr) {
    AvRevertMmThreadCharacteristics(task);
  }
  close();
  watch.endpoint_closed();
  return code;
}

}  // namespace

int main() {
  Arguments arguments;
  if (!parse_arguments(arguments)) {
    say("expected --parent-pid <pid> --angle-dir <folder>");
    return kBadArguments;
  }
  const UniqueHandle parent(OpenProcess(SYNCHRONIZE, FALSE, arguments.parent_pid));
  if (!parent.valid()) {
    return fail("the parent could not be watched",
                HRESULT_FROM_WIN32(GetLastError()));
  }
  const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(com)) {
    return fail("COM could not start", com);
  }
  int code = kFailed;
  {
    // Shared with the stdin reader, which is never joined: a blocked pipe
    // read is let go of only by the process ending under it, and the desk
    // must outlive it until then.
    const auto desk = std::make_shared<Desk>();
    if (!desk->frame_ready.valid() || !desk->commands_ready.valid() ||
        !desk->stop.valid()) {
      CoUninitialize();
      return fail("events could not be made",
                  HRESULT_FROM_WIN32(GetLastError()));
    }
    Mouth mouth;
    scene::LampPainter painter(arguments.angle_dir, output_to(mouth));
    std::thread drawer(draw, std::ref(*desk), std::ref(mouth), std::ref(painter));
    std::thread([desk] { read_main(*desk); }).detach();
    const int heard_until = listen(*desk, mouth, painter, parent.get());
    desk->end(heard_until);
    drawer.join();
    const std::lock_guard lock(desk->mutex);
    code = desk->stopped_with;
  }
  CoUninitialize();
  return code;
}
