/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// FluidEQ-Lighting.exe: the app's hands on Windows Dynamic Lighting.
//
// Its own process for three reasons. Windows grants a background app the
// lamps only through package identity, and identity belongs to an executable
// named in a package — not to Electron, whose whole process tree would then
// run as a packaged app. A crash in a vendor's lighting driver takes this
// down and not the window. And the helper is plain C++ against the Windows
// SDK, so an Electron upgrade never has to rebuild it.
//
//   FluidEQ-Lighting.exe                      serve the app over stdin/stdout
//   FluidEQ-Lighting.exe identity <command>   see identity.h
//
// A windowed-subsystem program, like the engine's setup helper: the
// uninstaller runs `identity remove` through ShellExecute, which shows a
// console window for a console program. Standard handles still work — the app
// passes pipes, and GetStdHandle returns them.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>

#include <shellapi.h>

#include <unknwn.h>
#include <winrt/Windows.Foundation.h>

#include <array>
#include <cwchar>
#include <string>

#include "event_sink.h"
#include "identity.h"
#include "json_text.h"
#include "lamp_arrays.h"
#include "razer_devices.h"
#include "wire.h"

namespace {

using fluideq_lighting::ColoursFrame;
using fluideq_lighting::EventSink;
using fluideq_lighting::FrameReader;
using fluideq_lighting::JsonLine;
using fluideq_lighting::LampArrays;
using fluideq_lighting::RazerDevices;
using fluideq_lighting::ReadResult;

int serve() {
  EventSink sink;
  LampArrays lamp_arrays(sink);
  RazerDevices razer(sink);

  sink.write(JsonLine("ready")
                 .integer("protocol", fluideq_lighting::kProtocolVersion)
                 .boolean("identity", fluideq_lighting::has_package_identity())
                 .finish());

  try {
    lamp_arrays.start();
  } catch (const winrt::hresult_error& error) {
    sink.write(JsonLine("error")
                   .text("message", "Windows Dynamic Lighting is unavailable")
                   .text("detail", winrt::to_string(error.message()))
                   .finish());
  }
  try {
    razer.start();
  } catch (const winrt::hresult_error& error) {
    sink.write(JsonLine("error")
                   .text("message", "Razer devices could not be listed")
                   .text("detail", winrt::to_string(error.message()))
                   .finish());
  }

  // The app's end of the pipe closing is the only way this ends: the app quit,
  // crashed or released the lamps. No heartbeat and no parent polling — a
  // broken pipe is the signal, and process exit hands every lamp back to
  // Windows, which gives it to the next app in line.
  const HANDLE input = GetStdHandle(STD_INPUT_HANDLE);
  FrameReader reader;
  std::array<std::uint8_t, 16 * 1024> chunk{};
  for (;;) {
    DWORD read = 0;
    if (!ReadFile(input, chunk.data(), static_cast<DWORD>(chunk.size()), &read,
                  nullptr) ||
        read == 0) {
      break;
    }
    reader.feed(std::span<const std::uint8_t>(chunk.data(), read));
    ColoursFrame frame;
    ReadResult result = reader.next(frame);
    while (result == ReadResult::kColours) {
      lamp_arrays.set_colours(frame);
      result = reader.next(frame);
    }
    if (result == ReadResult::kBroken) {
      sink.write(JsonLine("error")
                     .text("message", "the app sent a frame this helper cannot read")
                     .finish());
      break;
    }
  }

  razer.stop();
  lamp_arrays.stop();
  return 0;
}

}  // namespace

int WINAPI wWinMain(HINSTANCE, HINSTANCE, PWSTR, int) {
  int argc = 0;
  LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
  if (argv == nullptr) {
    return fluideq_lighting::kExitUsage;
  }
  winrt::init_apartment(winrt::apartment_type::multi_threaded);

  int code = fluideq_lighting::kExitUsage;
  if (argc == 1) {
    code = serve();
  } else if (argc >= 3 && std::wcscmp(argv[1], L"identity") == 0) {
    code = fluideq_lighting::identity_command(argc - 2, argv + 2);
  }
  LocalFree(static_cast<HLOCAL>(argv));
  return code;
}
