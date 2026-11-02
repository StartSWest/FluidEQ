/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "song_watch.h"

#ifndef NOMINMAX
#define NOMINMAX
#endif
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <Windows.h>
#include <mmdeviceapi.h>
#include <objbase.h>

#include <algorithm>
#include <cmath>
#include <filesystem>
#include <fstream>
#include <iterator>
#include <optional>
#include <string>
#include <vector>

#include "fluideq/io/pipes.h"
#include "fluideq/share/json.h"
#include "song_programme.h"
#include "song_teller.h"

namespace feq::tray {
namespace {

namespace json = share::json;

/** A cover line of the media helper's, never a reading (`systemMedia.ts`). */
constexpr std::string_view kCoverLine = "{\"cover\":";

/** `parseSystemMediaLine`: the song a reading names, or none. */
std::optional<std::string> song_of_line(std::string_view line) {
  const std::string text = json::trim(line);
  if (text.empty() || text == "null") {
    return std::nullopt;
  }
  const auto parsed = json::parse(text);
  if (!parsed || !json::is_record(&*parsed)) {
    return std::nullopt;
  }
  const std::string* title = json::string_at(*parsed, "title");
  // A session with no title has nothing loaded: no song.
  if (title == nullptr || title->empty()) {
    return std::nullopt;
  }
  const std::string* app = json::string_at(*parsed, "app");
  const std::string* artist = json::string_at(*parsed, "artist");
  return song_identity(app == nullptr ? "" : *app, *title,
                       artist == nullptr ? "" : *artist);
}

bool finite_number(const json::Value* value) {
  return value != nullptr && value->is_number() &&
         std::isfinite(value->as_number());
}

/**
 * `parseEngineStatus`, for what the song job reads of it: a version-1 status
 * with every field of the right type, or nothing.
 */
std::optional<OutputReport> report_of(const std::string& text) {
  const auto parsed = json::parse(text);
  if (!parsed || !json::is_record(&*parsed)) {
    return std::nullopt;
  }
  const json::Value& status = *parsed;
  const json::Value* version = status.get("version");
  const std::string* endpoint = json::string_at(status, "endpoint");
  const json::Value* pid = status.get("pid");
  const json::Value* problems = status.get("problems");
  const auto is_bool = [&status](const char* key) {
    const json::Value* found = status.get(key);
    return found != nullptr && found->is_bool();
  };
  if (!finite_number(version) || version->as_number() != 1.0 ||
      endpoint == nullptr || !finite_number(pid) ||
      std::floor(pid->as_number()) != pid->as_number() || !is_bool("locked") ||
      !is_bool("processing") || !is_bool("owner") || problems == nullptr ||
      !problems->is_array()) {
    return std::nullopt;
  }
  for (const auto& problem : problems->items()) {
    if (!problem.is_string()) {
      return std::nullopt;
    }
  }
  OutputReport report{*endpoint, std::nullopt};
  const json::Value* last = status.get("lastSong");
  if (json::is_record(last)) {
    const std::string* id = json::string_at(*last, "id");
    const json::Value* level = last->get("level");
    const json::Value* peak = last->get("peak");
    const json::Value* seconds = last->get("seconds");
    if (id != nullptr && finite_number(level) && finite_number(peak) &&
        finite_number(seconds)) {
      // The store refuses an id that is not sixteen hex digits itself.
      report.last_song = FinishedSong{*id, seconds->as_number(),
                                      level->as_number(), peak->as_number()};
    }
  }
  return report;
}

std::string narrow(const std::wstring& wide) {
  if (wide.empty()) {
    return {};
  }
  const int size = WideCharToMultiByte(CP_UTF8, 0, wide.data(),
                                       static_cast<int>(wide.size()), nullptr,
                                       0, nullptr, nullptr);
  std::string out(static_cast<std::size_t>(std::max(0, size)), '\0');
  WideCharToMultiByte(CP_UTF8, 0, wide.data(), static_cast<int>(wide.size()),
                      out.data(), size, nullptr, nullptr);
  return out;
}

/** The GUID part of an endpoint id (`{0.0.0.00000000}.{guid}`). */
std::optional<std::string> endpoint_of_device_id(const wchar_t* id) {
  if (id == nullptr) {
    return std::nullopt;
  }
  const std::string text = narrow(id);
  const auto dot = text.rfind('.');
  return dot == std::string::npos ? std::nullopt
                                  : std::optional<std::string>(text.substr(dot + 1));
}

class Watch;

/** Windows' word that the default output moved, handed to the loop. */
class DefaultOutput final : public IMMNotificationClient {
 public:
  explicit DefaultOutput(std::weak_ptr<Watch> watch, io::Loop& loop)
      : watch_(std::move(watch)), loop_(loop) {}
  ULONG STDMETHODCALLTYPE AddRef() override { return InterlockedIncrement(&refs_); }
  ULONG STDMETHODCALLTYPE Release() override {
    const ULONG left = InterlockedDecrement(&refs_);
    if (left == 0) {
      delete this;
    }
    return left;
  }
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid, void** out) override {
    if (iid == __uuidof(IUnknown) || iid == __uuidof(IMMNotificationClient)) {
      *out = static_cast<IMMNotificationClient*>(this);
      AddRef();
      return S_OK;
    }
    *out = nullptr;
    return E_NOINTERFACE;
  }
  HRESULT STDMETHODCALLTYPE OnDefaultDeviceChanged(EDataFlow flow, ERole role,
                                                   LPCWSTR id) override;
  HRESULT STDMETHODCALLTYPE OnDeviceAdded(LPCWSTR) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnDeviceRemoved(LPCWSTR) override { return S_OK; }
  HRESULT STDMETHODCALLTYPE OnDeviceStateChanged(LPCWSTR, DWORD) override {
    return S_OK;
  }
  HRESULT STDMETHODCALLTYPE OnPropertyValueChanged(LPCWSTR,
                                                   const PROPERTYKEY) override {
    return S_OK;
  }

 private:
  std::weak_ptr<Watch> watch_;
  io::Loop& loop_;
  LONG refs_ = 1;
};

class Watch final : public SongWatch, public std::enable_shared_from_this<Watch> {
 public:
  Watch(io::Loop& loop, SongsHandover handover)
      : loop_(loop),
        handover_(std::move(handover)),
        store_(handover_.levels_file,
               [] {
                 FILETIME now{};
                 GetSystemTimeAsFileTime(&now);
                 ULARGE_INTEGER ticks{};
                 ticks.LowPart = now.dwLowDateTime;
                 ticks.HighPart = now.dwHighDateTime;
                 // 100 ns since 1601, as milliseconds since 1970: Date.now().
                 return std::floor(
                     static_cast<double>(ticks.QuadPart - 116444736000000000ULL) /
                     10000.0);
               }),
        teller_(store_, handover_.root_name, handover_.per_output_prefix) {}

  ~Watch() override { stop(); }

  bool begin() {
    teller_.main_output(handover_.main_endpoint.empty()
                            ? std::nullopt
                            : std::optional<std::string>(handover_.main_endpoint));
    write(teller_.health(read_statuses()));
    watch_statuses();
    watch_default_output();
    return start_media();
  }

  void stop() override {
    if (stopped_) {
      return;
    }
    stopped_ = true;
    if (wait_ != nullptr) {
      // Waits for a callback already running, so nothing reaches a watch
      // that has gone.
      UnregisterWaitEx(wait_, INVALID_HANDLE_VALUE);
      wait_ = nullptr;
    }
    if (change_ != INVALID_HANDLE_VALUE) {
      FindCloseChangeNotification(change_);
      change_ = INVALID_HANDLE_VALUE;
    }
    delete wait_context_;
    wait_context_ = nullptr;
    if (devices_ != nullptr) {
      devices_->UnregisterEndpointNotificationCallback(default_output_);
      default_output_->Release();
      devices_->Release();
      devices_ = nullptr;
    }
    for (const auto& pipe : {input_, output_, errors_}) {
      if (pipe) {
        pipe->destroy();
      }
    }
    if (child_) {
      child_->kill();
    }
    if (com_) {
      CoUninitialize();
      com_ = false;
    }
  }

  void default_output_moved(std::optional<std::string> endpoint) {
    if (stopped_) {
      return;
    }
    teller_.main_output(endpoint);
    write(teller_.reflush());
  }

 private:
  void write(const std::vector<ProgrammeWrite>& writes) {
    for (const auto& [name, contents] : writes) {
      const std::filesystem::path target =
          std::filesystem::path(handover_.config_dir) / name;
      std::filesystem::path partial = target;
      partial += L".partial";
      bool written = false;
      {
        std::ofstream out(partial, std::ios::binary | std::ios::trunc);
        out << contents;
        written = static_cast<bool>(out);
      }
      // Renamed over the old one, so the engine never reads half a file.
      written = written && MoveFileExW(partial.c_str(), target.c_str(),
                                       MOVEFILE_REPLACE_EXISTING) != FALSE;
      if (!written) {
        // Not told after all: the next song or report tries it again.
        teller_.unsent(name);
      }
    }
  }

  std::vector<OutputReport> read_statuses() const {
    std::vector<OutputReport> reports;
    std::error_code failed;
    for (const auto& entry : std::filesystem::directory_iterator(
             handover_.status_dir, failed)) {
      const std::wstring name = entry.path().filename().wstring();
      if (!name.starts_with(L"status-") || !name.ends_with(L".json")) {
        continue;
      }
      std::ifstream in(entry.path(), std::ios::binary);
      const std::string text((std::istreambuf_iterator<char>(in)),
                             std::istreambuf_iterator<char>());
      if (auto report = report_of(text)) {
        reports.push_back(std::move(*report));
      }
    }
    return reports;
  }

  static void CALLBACK statuses_changed(void* context, BOOLEAN) {
    const auto* weak = static_cast<std::weak_ptr<Watch>*>(context);
    if (const auto self = weak->lock()) {
      self->loop_.post([weak_self = std::weak_ptr<Watch>(self)] {
        if (const auto alive = weak_self.lock()) {
          alive->statuses_moved();
        }
      });
    }
  }

  void statuses_moved() {
    if (stopped_) {
      return;
    }
    write(teller_.health(read_statuses()));
    // Asked again only once this change is read: each wake is one reading.
    if (wait_ != nullptr) {
      UnregisterWaitEx(wait_, nullptr);
      wait_ = nullptr;
    }
    if (FindNextChangeNotification(change_) != FALSE) {
      RegisterWaitForSingleObject(&wait_, change_, statuses_changed,
                                  wait_context_, INFINITE, WT_EXECUTEONLYONCE);
    }
  }

  void watch_statuses() {
    change_ = FindFirstChangeNotificationW(
        handover_.status_dir.c_str(), FALSE,
        FILE_NOTIFY_CHANGE_LAST_WRITE | FILE_NOTIFY_CHANGE_FILE_NAME);
    if (change_ == INVALID_HANDLE_VALUE) {
      return;
    }
    wait_context_ = new std::weak_ptr<Watch>(weak_from_this());
    RegisterWaitForSingleObject(&wait_, change_, statuses_changed,
                                wait_context_, INFINITE, WT_EXECUTEONLYONCE);
  }

  void watch_default_output() {
    const HRESULT com = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    com_ = SUCCEEDED(com);
    if (FAILED(CoCreateInstance(__uuidof(MMDeviceEnumerator), nullptr,
                                CLSCTX_ALL, IID_PPV_ARGS(&devices_)))) {
      devices_ = nullptr;
      return;
    }
    default_output_ = new DefaultOutput(weak_from_this(), loop_);
    devices_->RegisterEndpointNotificationCallback(default_output_);
  }

  bool start_media() {
    const auto input = io::child_pipe(false);
    const auto output = io::child_pipe(true);
    const auto errors = io::child_pipe(true);
    if (!input || !output || !errors) {
      for (const auto& pipe : {input, output, errors}) {
        if (pipe) {
          CloseHandle(pipe->theirs);
          pipe->ours->destroy();
        }
      }
      return false;
    }
    input_ = input->ours;
    output_ = output->ours;
    errors_ = errors->ours;
    auto spawned = io::ChildProcess::spawn(
        handover_.media_exe, {handover_.self_id}, input->theirs,
        output->theirs, errors->theirs, [](DWORD) {});
    CloseHandle(input->theirs);
    CloseHandle(output->theirs);
    CloseHandle(errors->theirs);
    if (spawned.index() == 1) {
      return false;
    }
    child_ = std::get<0>(spawned);
    std::weak_ptr<Watch> weak = shared_from_this();
    // Nobody reads its complaints; read so the pipe never fills.
    errors_->start(io::PipeStream::Events{
        [](std::span<const std::uint8_t>) {}, [] {},
        [](const std::optional<io::Failure>&) {}});
    output_->start(io::PipeStream::Events{
        [weak](std::span<const std::uint8_t> data) {
          if (const auto alive = weak.lock()) {
            alive->heard(data);
          }
        },
        [] {}, [](const std::optional<io::Failure>&) {}});
    return true;
  }

  void heard(std::span<const std::uint8_t> data) {
    pending_.append(data.begin(), data.end());
    std::size_t end = 0;
    while ((end = pending_.find('\n')) != std::string::npos) {
      std::string line = pending_.substr(0, end);
      pending_.erase(0, end + 1);
      if (!line.empty() && line.back() == '\r') {
        line.pop_back();
      }
      if (json::trim(line).empty() ||
          json::trim(line).starts_with(kCoverLine)) {
        continue;
      }
      write(teller_.media(song_of_line(line)));
      keep_one_player(line);
    }
  }

  /**
   * The one-player rule (`createExternalPlayerRule`): a player that starts
   * while others play pauses them, through main's own command.
   */
  void keep_one_player(const std::string& line) {
    const auto parsed = json::parse(json::trim(line));
    std::vector<std::string> playing;
    if (parsed && json::is_record(&*parsed)) {
      const json::Value* value = parsed->get("playing");
      // `playingApps`: one id may come as a bare string.
      if (value != nullptr && value->is_string() &&
          !value->as_string().empty()) {
        playing.push_back(value->as_string());
      } else if (value != nullptr && value->is_array()) {
        for (const auto& entry : value->items()) {
          if (entry.is_string() && !entry.as_string().empty()) {
            playing.push_back(entry.as_string());
          }
        }
      }
    }
    const auto winner = started_over_others(known_playing_, playing);
    known_playing_ = playing;
    if (!winner || !handover_.single_player || handover_.pause_file.empty()) {
      return;
    }
    // The player spared goes in the environment, never into the command.
    const std::wstring spared = widen(*winner);
    SetEnvironmentVariableW(L"FLUIDEQ_MEDIA_EXCEPT", spared.c_str());
    const auto input = io::child_pipe(false);
    const auto output = io::child_pipe(true);
    if (input && output) {
      auto spawned = io::ChildProcess::spawn(
          handover_.pause_file, handover_.pause_args, input->theirs,
          output->theirs, output->theirs, [](DWORD) {});
      CloseHandle(input->theirs);
      CloseHandle(output->theirs);
      input->ours->destroy();
      // Nobody reads what it says; read so its pipe never fills.
      output->ours->start(io::PipeStream::Events{
          [](std::span<const std::uint8_t>) {}, [] {},
          [](const std::optional<io::Failure>&) {}});
      // The runs that have ended are let go as the next one starts.
      std::erase_if(pausers_, [](const auto& stream) { return stream->destroyed(); });
      pausers_.push_back(output->ours);
    } else {
      for (const auto& pipe : {input, output}) {
        if (pipe) {
          CloseHandle(pipe->theirs);
          pipe->ours->destroy();
        }
      }
    }
    SetEnvironmentVariableW(L"FLUIDEQ_MEDIA_EXCEPT", nullptr);
  }

  static std::wstring widen(const std::string& narrow_text) {
    if (narrow_text.empty()) {
      return {};
    }
    const int size = MultiByteToWideChar(
        CP_UTF8, 0, narrow_text.data(), static_cast<int>(narrow_text.size()),
        nullptr, 0);
    std::wstring out(static_cast<std::size_t>(std::max(0, size)), L'\0');
    MultiByteToWideChar(CP_UTF8, 0, narrow_text.data(),
                        static_cast<int>(narrow_text.size()), out.data(), size);
    return out;
  }

  io::Loop& loop_;
  SongsHandover handover_;
  SongLevelStore store_;
  SongTeller teller_;
  bool stopped_ = false;
  bool com_ = false;
  HANDLE change_ = INVALID_HANDLE_VALUE;
  HANDLE wait_ = nullptr;
  std::weak_ptr<Watch>* wait_context_ = nullptr;
  IMMDeviceEnumerator* devices_ = nullptr;
  DefaultOutput* default_output_ = nullptr;
  std::shared_ptr<io::ChildProcess> child_;
  std::shared_ptr<io::PipeStream> input_;
  std::shared_ptr<io::PipeStream> output_;
  std::shared_ptr<io::PipeStream> errors_;
  std::string pending_;
  /** The players playing at the last reading. */
  std::vector<std::string> known_playing_;
  /** What each pause run says, read until it ends. */
  std::vector<std::shared_ptr<io::PipeStream>> pausers_;
};

HRESULT DefaultOutput::OnDefaultDeviceChanged(EDataFlow flow, ERole role,
                                              LPCWSTR id) {
  // The output Windows plays through, as main follows it: render, console.
  if (flow != eRender || role != eConsole) {
    return S_OK;
  }
  std::optional<std::string> endpoint = endpoint_of_device_id(id);
  loop_.post([weak = watch_, endpoint] {
    if (const auto watch = weak.lock()) {
      watch->default_output_moved(endpoint);
    }
  });
  return S_OK;
}

}  // namespace

std::shared_ptr<SongWatch> SongWatch::start(io::Loop& loop,
                                            SongsHandover handover) {
  auto watch = std::make_shared<Watch>(loop, std::move(handover));
  if (!watch->begin()) {
    watch->stop();
    return nullptr;
  }
  return watch;
}

}  // namespace feq::tray
