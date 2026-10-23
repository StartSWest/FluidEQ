/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * FluidEQ-Engine: the FluidEQ Engine on macOS.
 *
 *   FluidEQ-Engine --version
 *     The engine's version, the Windows effect's own number (`engine.rc`),
 *     which is what the app gates each engine feature on: this engine is
 *     built from the same tree, so it has every feature that number names.
 *
 *   FluidEQ-Engine --list-outputs
 *     Every output as JSON, for the app's output list. Reads Core Audio's
 *     device list and nothing else; no audio is touched.
 *
 *   FluidEQ-Engine --set-default-output <uid>
 *     Makes that output the one everything plays to, as choosing it in the
 *     app's output list asks. The running engine follows by itself.
 *
 *   FluidEQ-Engine --audio-permission
 *     `granted`, `denied` or `unknown`: whether macOS lets the engine hear
 *     what the Mac plays (`audio_permission.h`), for the app's notice.
 *     Asks nothing of the listener and touches no audio.
 *
 *   FluidEQ-Engine --config <dir> [--parent-pid <pid>] [--analysis <socket>]
 *     The engine. Reads the configuration the app writes in <dir>, runs it
 *     on every app's sound, writes what it is doing beside <dir> for the app
 *     to read (`status_report.h`), answers the app's display on <socket>
 *     (`mac_analysis_link.h`), and stops when its standard input closes or
 *     its parent exits — so it cannot outlive FluidEQ and keep a Mac's
 *     sound.
 *
 *   FluidEQ-Engine --measure <hz> --config <dir> --device <uid> [--name <n>]
 *     The same resolver and the same graph, offline: a tone through the
 *     configuration for that output, and the gain it came out with. The
 *     positive control for everything between the app's files and the
 *     graph, run against the very binary that ships — no device, no tap.
 */

#include <unistd.h>

#include <atomic>
#include <cerrno>
#include <cmath>
#include <csignal>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "audio_permission.h"
#include "config_file.h"
#include "controller.h"
#include "dir_watch.h"
#include "engine.h"
#include "fluideq_engine/config.h"
#include "fluideq_engine/graph.h"
#include "mac_analysis_link.h"
#include "output_devices.h"
#include "posix_path.h"
#include "room_head.h"
#include "status_report.h"
#include "system_tap.h"

namespace {

/**
 * The folder above the configuration's, where the app reads statuses — the
 * Windows effect's own layout, `engine\config` beside `engine\status-*.json`.
 */
std::string parent_of(std::string directory) {
  while (directory.size() > 1 && directory.back() == '/') {
    directory.pop_back();
  }
  const size_t slash = directory.find_last_of('/');
  if (slash == std::string::npos) {
    return ".";
  }
  return slash == 0 ? std::string("/") : directory.substr(0, slash);
}

const char* option(int argc, char** argv, const char* name) {
  for (int at = 1; at + 1 < argc; ++at) {
    if (std::strcmp(argv[at], name) == 0) {
      return argv[at + 1];
    }
  }
  return nullptr;
}

bool flag(int argc, char** argv, const char* name) {
  for (int at = 1; at < argc; ++at) {
    if (std::strcmp(argv[at], name) == 0) {
      return true;
    }
  }
  return false;
}

int measure(double frequency, const std::string& directory,
            const std::string& uid, const std::string& name) {
  constexpr uint32_t kRate = 48000;
  constexpr uint32_t kBlock = 512;
  constexpr uint32_t kBlocks = kRate / kBlock;
  // -20 dBFS: far enough below full scale that a boost has room to show.
  constexpr double kAmplitude = 0.1;

  const fluideq_engine::FileProvider provider =
      [](const std::wstring& path) {
        return fluideq_mac::read_config_file(path);
      };
  const std::wstring root = fluideq_engine::wide_path(directory);
  const fluideq_engine::Endpoint endpoint{
      fluideq_engine::wide_path(fluideq_mac::endpoint_guid(uid)),
      fluideq_engine::wide_path(name)};
  const fluideq_engine::Chain chain = fluideq_engine::resolve_chain(
      root, endpoint, provider);
  // The room's head, as the engine reads it, so a rack with the room on
  // measures what it plays.
  std::optional<fluideq_engine::RoomHead> head;
  const auto head_name = fluideq_engine::endpoint_config_name(
      fluideq_engine::kRoomHeadFileStem, endpoint);
  if (const std::optional<std::string> text = head_name
          ? provider(root + L"\\" + *head_name) : std::nullopt) {
    head = fluideq_engine::parse_room_head(*text, kRate);
  }
  fluideq_engine::Graph graph(chain, kRate, fluideq_mac::kEngineChannels,
                              kBlock, nullptr, 0, head ? &*head : nullptr);

  std::vector<float> left(kBlock);
  std::vector<float> right(kBlock);
  float* planar[fluideq_mac::kEngineChannels] = {left.data(), right.data()};
  const double step = 6.283185307179586 * frequency / kRate;
  double phase = 0.0;
  double input_energy = 0.0;
  double output_energy = 0.0;
  for (uint32_t block = 0; block < kBlocks; ++block) {
    for (uint32_t frame = 0; frame < kBlock; ++frame) {
      const auto sample = static_cast<float>(kAmplitude * std::sin(phase));
      left[frame] = sample;
      right[frame] = sample;
      phase += step;
      if (phase > 6.283185307179586) {
        phase -= 6.283185307179586;
      }
    }
    // The second half only, once every filter has settled on the tone.
    const bool counted = block >= kBlocks / 2;
    if (counted) {
      for (uint32_t frame = 0; frame < kBlock; ++frame) {
        input_energy += static_cast<double>(left[frame]) * left[frame];
      }
    }
    graph.process(planar, kBlock);
    if (counted) {
      for (uint32_t frame = 0; frame < kBlock; ++frame) {
        output_energy += static_cast<double>(left[frame]) * left[frame];
      }
    }
  }
  const double gain =
      input_energy > 0.0 && output_energy > 0.0
          ? 10.0 * std::log10(output_energy / input_energy)
          : -200.0;
  std::printf("matched=%d processing=%d files=%zu gain_db=%.2f\n",
              chain.matched ? 1 : 0, graph.is_passthrough() ? 0 : 1,
              chain.files_read.size(), gain);
  return 0;
}

constexpr const char* kUsage =
    "usage: FluidEQ-Engine --version\n"
    "       FluidEQ-Engine --list-outputs\n"
    "       FluidEQ-Engine --set-default-output <uid>\n"
    "       FluidEQ-Engine --audio-permission\n"
    "       FluidEQ-Engine --config <dir> [--parent-pid <pid>] "
    "[--analysis <socket>]\n"
    "       FluidEQ-Engine --measure <hz> --config <dir> --device <uid> "
    "[--name <name>]\n";

}  // namespace

int main(int argc, char** argv) {
  // A write to a pipe nobody reads any more ends the process by default;
  // the parent watch below is what ends an orphan, and it gives the sound
  // back on the way out.
  std::signal(SIGPIPE, SIG_IGN);

  if (flag(argc, argv, "--version")) {
    std::printf("%s\n", FEQ_ENGINE_VERSION);
    return 0;
  }

  if (flag(argc, argv, "--list-outputs")) {
    std::printf("%s\n", fluideq_mac::list_outputs_json().c_str());
    return 0;
  }

  if (flag(argc, argv, "--audio-permission")) {
    std::printf("%s\n", fluideq_mac::audio_permission_word(
                            fluideq_mac::audio_permission()));
    return 0;
  }

  if (const char* uid = option(argc, argv, "--set-default-output")) {
    std::string error;
    if (!fluideq_mac::set_default_output(uid, error)) {
      std::fprintf(stderr, "FluidEQ-Engine: %s\n", error.c_str());
      return 1;
    }
    return 0;
  }

  const char* config = option(argc, argv, "--config");
  if (config == nullptr) {
    std::fputs(kUsage, stderr);
    return 2;
  }

  if (const char* hz = option(argc, argv, "--measure")) {
    const char* device = option(argc, argv, "--device");
    if (device == nullptr) {
      std::fputs(kUsage, stderr);
      return 2;
    }
    const char* name = option(argc, argv, "--name");
    return measure(std::strtod(hz, nullptr), config, device,
                   name != nullptr ? name : "");
  }

  pid_t parent = 0;
  if (const char* text = option(argc, argv, "--parent-pid")) {
    parent = static_cast<pid_t>(std::strtol(text, nullptr, 10));
  }

  // Before the engine, which hands its meters to every graph it builds, and
  // after it in destruction for the same reason.
  std::unique_ptr<fluideq_engine::AnalysisLink> analysis;
  if (const char* socket = option(argc, argv, "--analysis")) {
    analysis = std::make_unique<fluideq_engine::AnalysisLink>(socket);
  }
  fluideq_mac::Engine engine(fluideq_engine::wide_path(config),
                             analysis.get());
  // Set once the watch exists; Core Audio can report a device change before
  // then, and that wake is covered by the one `start` makes itself.
  std::atomic<fluideq_mac::DirWatch*> watching{nullptr};
  const auto wake = [&watching] {
    if (fluideq_mac::DirWatch* watch = watching.load()) {
      watch->wake();
    }
  };
  // Sound first coming through is worth a status, and the I/O thread may do
  // nothing about it but wake the thread that writes one.
  fluideq_mac::SystemTap tap(engine, wake);
  fluideq_mac::Controller controller(
      engine, tap, fluideq_mac::StatusFiles(parent_of(config)),
      analysis.get(), wake);
  fluideq_mac::DirWatch watch(
      config, parent, [&controller] { controller.refresh(); },
      [&controller] {
        controller.shutdown();
        std::fputs("FluidEQ-Engine: the app went away; stopped\n", stderr);
        std::_Exit(0);
      });
  watching.store(&watch);

  std::string error;
  if (!watch.start(error)) {
    std::fprintf(stderr, "FluidEQ-Engine: %s\n", error.c_str());
    return 1;
  }
  std::fprintf(stderr,
               "FluidEQ-Engine: running (version %s, build %s), reading %s\n",
               FEQ_ENGINE_VERSION, FEQ_BUILD_REVISION, config);

  // Standard input closing is the app asking the engine to stop, or the app
  // being gone: either way there is nobody left to engine for.
  char buffer[256];
  for (;;) {
    const ssize_t got = ::read(STDIN_FILENO, buffer, sizeof(buffer));
    if (got > 0 || (got < 0 && errno == EINTR)) {
      continue;
    }
    break;
  }
  watching.store(nullptr);
  watch.stop();
  controller.shutdown();
  std::fputs("FluidEQ-Engine: stopped\n", stderr);
  return 0;
}
