/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Linux engine without a sound server: a configuration folder, the
 * engine over a tone, and an edit to the folder heard in the tone — the
 * watcher's inotify wait, the shared resolver, the graph handover and the
 * status file, end to end.
 *
 * Waits are on the status file being renamed into place (inotify), which the
 * watcher does after every publish; never on a clock. CTest's timeout is the
 * only bound, for a watcher that never wakes.
 */

#include <poll.h>
#include <sys/inotify.h>
#include <unistd.h>

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

#include "../../dsp-core/tests/dsp_test_support.h"
#include "../engine/output_engine.h"

using feq_test::check;

namespace {

constexpr uint32_t kRate = 48000;
constexpr uint32_t kBlock = 480;
constexpr double kPi = 3.14159265358979323846;
const wchar_t* const kEndpoint = L"{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}";

/** Writes aside and renames, as the app does. */
void publish(const std::string& dir, const std::string& name,
             const std::string& text) {
  const std::string aside = dir + "/." + name + ".tmp";
  std::ofstream(aside) << text;
  std::filesystem::rename(aside, dir + "/" + name);
}

struct Tone {
  double phase = 0.0;
  /** Plays `seconds` of a 1 kHz tone at 0.25 through `engine`; RMS of the last tenth. */
  double play(fluideq_linux::OutputEngine& engine, double seconds) {
    std::vector<float> left(kBlock);
    std::vector<float> right(kBlock);
    float* planes[2] = {left.data(), right.data()};
    const auto blocks = static_cast<uint32_t>(seconds * kRate / kBlock);
    const uint32_t measured_from = blocks - kRate / 10 / kBlock;
    double sum = 0.0;
    uint64_t count = 0;
    for (uint32_t b = 0; b < blocks; ++b) {
      for (uint32_t f = 0; f < kBlock; ++f) {
        const auto sample = static_cast<float>(0.25 * std::sin(phase));
        left[f] = sample;
        right[f] = sample;
        phase += 2.0 * kPi * 1000.0 / kRate;
      }
      engine.process(planes, kBlock);
      if (b >= measured_from) {
        for (uint32_t f = 0; f < kBlock; ++f) sum += left[f] * left[f];
        count += kBlock;
      }
    }
    return std::sqrt(sum / static_cast<double>(count));
  }
};

double decibels(double rms) { return 20.0 * std::log10(rms / (0.25 / std::sqrt(2.0))); }

/** Blocks until a status file is renamed into `root`. */
void await_status(int inotify) {
  alignas(inotify_event) char buffer[4096];
  for (;;) {
    pollfd wait{inotify, POLLIN, 0};
    ::poll(&wait, 1, -1);
    const ssize_t got = ::read(inotify, buffer, sizeof(buffer));
    for (ssize_t at = 0; at < got;) {
      const auto* event = reinterpret_cast<const inotify_event*>(buffer + at);
      if (event->len > 0 && std::string(event->name).rfind("status-", 0) == 0) {
        return;
      }
      at += static_cast<ssize_t>(sizeof(inotify_event) + event->len);
    }
  }
}

}  // namespace

int main() {
  char pattern[] = "/tmp/fluideq-engine-test-XXXXXX";
  const std::string root = mkdtemp(pattern);
  setenv("FLUIDEQ_ENGINE_ROOT", root.c_str(), 1);
  const std::string config = root + "/config";
  std::filesystem::create_directories(config);
  publish(config, "config.txt", "Preamp: -6 dB\n");

  const int inotify = inotify_init1(IN_CLOEXEC);
  inotify_add_watch(inotify, root.c_str(), IN_MOVED_TO);

  fluideq_linux::OutputEngine engine(
      fluideq_engine::Endpoint{kEndpoint, L"Test output"},
      fluideq_linux::OutputFormat{kRate, 2, 0x3, 1024});
  Tone tone;
  const double first = decibels(tone.play(engine, 0.5));
  check(std::abs(first + 6.0) < 0.1, "the configuration's preamp is heard");
  std::printf("  preamp -6 dB: measured %.2f dB\n", first);

  // An edit while the tone plays: heard once the watcher has published it.
  publish(config, "config.txt", "Preamp: 0 dB\nFilter: ON PK Fc 1000 Hz Gain 6 dB Q 1\n");
  double after = first;
  for (int wake = 0; wake < 8 && std::abs(after - 6.0) > 0.1; ++wake) {
    await_status(inotify);
    after = decibels(tone.play(engine, 0.2));
  }
  check(std::abs(after - 6.0) < 0.1, "an edit to the folder is heard");
  std::printf("  +6 dB at 1 kHz: measured %.2f dB\n", after);

  const std::string status =
      root + "/status-" + "{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}" + ".json";
  check(std::filesystem::exists(status), "the output's status is there");
  engine.retire();
  std::ifstream in(status);
  const std::string text((std::istreambuf_iterator<char>(in)),
                         std::istreambuf_iterator<char>());
  check(text.find("\"locked\":false") != std::string::npos,
        "and says the output is let go once the engine is");

  ::close(inotify);
  std::filesystem::remove_all(root);
  if (feq_test::g_failures > 0) {
    std::printf("%d failure(s)\n", feq_test::g_failures);
    return 1;
  }
  std::printf("output engine: all checks passed\n");
  return 0;
}
