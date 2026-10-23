/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Linux engine's own small parts, each against what it has to agree
 * with: the shared resolver's wide text, PipeWire's and PulseAudio's speaker
 * names, the per-output file names the app writes, the three shared engine
 * files read through `compat/windows.h`, and the status text's file.
 */

#include <sys/stat.h>
#include <unistd.h>

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "../../dsp-core/tests/dsp_test_support.h"
#include "../compat/wide_path.h"
#include "../engine/outputs_file.h"
#include "chain_signature.h"
#include "config_file.h"
#include "fluideq_engine/config.h"
#include "paths.h"
#include "status_file.h"
#include "wav.h"

using feq_test::check;

namespace {

std::string scratch_dir() {
  char pattern[] = "/tmp/fluideq-linux-test-XXXXXX";
  const char* made = mkdtemp(pattern);
  return made != nullptr ? made : "";
}

void write_file(const std::string& path, const std::string& bytes) {
  std::ofstream out(path, std::ios::binary);
  out << bytes;
}

std::string read_file(const std::string& path) {
  std::ifstream in(path, std::ios::binary);
  std::stringstream text;
  text << in.rdbuf();
  return text.str();
}

void wide_text_matches_the_shared_resolver() {
  using fluideq_linux::narrow;
  using fluideq_linux::narrow_path;
  using fluideq_linux::widen;
  const std::string ascii = "Speakers (Realtek)";
  check(narrow(widen(ascii)) == ascii, "ASCII survives widen and narrow");
  // U+00E9 and U+1F3A7 (headphones emoji): two and four UTF-8 bytes.
  const std::string accented = "Caf\xC3\xA9 \xF0\x9F\x8E\xA7";
  const std::wstring wide = widen(accented);
  check(narrow(wide) == accented, "accents and emoji survive the round trip");
  // The emoji as a surrogate pair, as the resolver's utf8_to_wide writes it.
  check(wide.size() == 7 && wide[5] == 0xD83C && wide[6] == 0xDFA7,
        "above the BMP is a surrogate pair, as the resolver spells it");
  check(narrow_path(L"/home/x/config\\fluideq-dsp-a.txt") ==
            "/home/x/config/fluideq-dsp-a.txt",
        "a resolver path's backslash becomes a slash");
  check(narrow(std::wstring(1, static_cast<wchar_t>(0xD800))) == "\xEF\xBF\xBD",
        "a lone surrogate becomes U+FFFD rather than invalid UTF-8");
}

void layouts_follow_the_speakers() {
  using fluideq_linux::layout_for;
  using fluideq_linux::parse_positions;
  const auto stereo = layout_for(2, parse_positions("[ FL, FR ]"));
  check(stereo.channels == 2 && stereo.mask == 0x3, "stereo is FL FR, mask 0x3");
  // PipeWire's own 5.1 order, sorted into Windows' so the mask holds.
  const auto surround =
      layout_for(6, parse_positions("[ FL, FR, FC, LFE, SL, SR ]"));
  check(surround.mask == 0x60F, "5.1 side has the mask Windows gives it");
  const auto shuffled =
      layout_for(6, parse_positions("FR,FL,LFE,FC,SR,SL"));
  check(shuffled == surround, "any order of the same speakers is one layout");
  const auto unknown = layout_for(2, parse_positions("[ AUX0, AUX1 ]"));
  check(unknown.channels == 2 && unknown.mask == 0,
        "unnamed positions keep their count and give no mask");
  const auto silent = layout_for(0, {});
  check(silent.channels == 2 && silent.mask == 0x3,
        "an output that says nothing is taken as stereo");
  const auto mono = layout_for(1, parse_positions("[ MONO ]"));
  check(mono.channels == 1 && mono.mask == 0x4, "mono is the centre");
  const auto wide = layout_for(10, std::vector<fluideq_linux::Speaker>(10, 0));
  check(wide.channels == 8, "never more than the rack's eight channels");
}

void output_ids_are_stable_and_valid() {
  using fluideq_linux::endpoint_id_for;
  const std::string id = endpoint_id_for("alsa_output.pci-0000_04_00.6.HiFi__Headphones__sink");
  check(id == endpoint_id_for("alsa_output.pci-0000_04_00.6.HiFi__Headphones__sink"),
        "the same output always gets the same id");
  check(id != endpoint_id_for("alsa_output.pci-0000_04_00.6.HiFi__Speaker__sink"),
        "speakers and headphones on one card are two ids");
  check(id.size() == 38 && id.front() == '{' && id.back() == '}' && id[15] == '8',
        "a braced version-8 GUID");
  const fluideq_engine::Endpoint endpoint{fluideq_linux::widen(id), L"x"};
  const auto name = fluideq_engine::endpoint_config_name(L"fluideq-dsp", endpoint);
  check(name.has_value(), "the shared resolver accepts it as an output id");
}

void shared_engine_files_read_through_the_shim(const std::string& dir) {
  const std::string config = dir + "/config.txt";
  write_file(config, "Preamp: -3 dB\n");
  // Joined the way the resolver joins: a backslash before the file name.
  const auto text = fluideq_engine::read_config_file(
      fluideq_linux::widen(dir) + L"\\config.txt");
  check(text && *text == "Preamp: -3 dB\n", "config_file.cpp reads a file");
  check(!fluideq_engine::read_config_file(fluideq_linux::widen(dir) + L"/none.txt"),
        "a missing file is nothing, not an empty file");

  // A one-sample 16-bit mono WAV of the value 0.5.
  std::string wav = "RIFF";
  const auto put32 = [&wav](uint32_t v) {
    for (int b = 0; b < 4; ++b) wav.push_back(static_cast<char>((v >> (8 * b)) & 0xFF));
  };
  const auto put16 = [&wav](uint16_t v) {
    wav.push_back(static_cast<char>(v & 0xFF));
    wav.push_back(static_cast<char>(v >> 8));
  };
  put32(38);
  wav += "WAVEfmt ";
  put32(16);
  put16(1);
  put16(1);
  put32(48000);
  put32(96000);
  put16(2);
  put16(16);
  wav += "data";
  put32(2);
  put16(16384);
  write_file(dir + "/one.wav", wav);
  const auto parsed = fluideq_engine::read_wav(fluideq_linux::widen(dir + "/one.wav"));
  check(parsed && parsed->sample_rate == 48000 && parsed->mono.size() == 1 &&
            parsed->mono[0] > 0.49f && parsed->mono[0] < 0.51f,
        "wav.cpp reads an impulse response");

  fluideq_engine::Chain chain;
  chain.convolution_path = fluideq_linux::widen(dir + "/one.wav");
  const std::string before = fluideq_engine::signature_of(chain);
  write_file(dir + "/one.wav", wav + std::string(2, '\0'));
  check(fluideq_engine::signature_of(chain) != before,
        "chain_signature.cpp sees an impulse response change on disk");
}

void the_status_is_written_whole(const std::string& dir) {
  setenv("FLUIDEQ_ENGINE_ROOT", dir.c_str(), 1);
  check(fluideq_linux::narrow(fluideq_engine::config_dir()) == dir + "/config",
        "the config folder is under the engine root");
  fluideq_engine::EngineStatus status;
  status.endpoint = L"{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}";
  status.locked = true;
  status.processing = true;
  std::string why;
  check(fluideq_engine::write_status(status, &why), "the status is written");
  const std::string text =
      read_file(dir + "/status-{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}.json");
  check(text.find("\"locked\":true") != std::string::npos &&
            text.find("\"processing\":true") != std::string::npos,
        "with the shared status text in it");
  struct stat info {};
  const std::string aside = dir + "/status-{F354B29C-4AAA-80C9-9D56-CB958C0C1F98}.json." +
                            std::to_string(getpid()) + ".tmp";
  check(::stat(aside.c_str(), &info) != 0, "and nothing left aside");
}

}  // namespace

int main() {
  const std::string dir = scratch_dir();
  check(!dir.empty(), "a scratch folder");
  wide_text_matches_the_shared_resolver();
  layouts_follow_the_speakers();
  output_ids_are_stable_and_valid();
  shared_engine_files_read_through_the_shim(dir);
  the_status_is_written_whole(dir);
  std::filesystem::remove_all(dir);
  if (feq_test::g_failures > 0) {
    std::printf("%d failure(s)\n", feq_test::g_failures);
    return 1;
  }
  std::printf("linux parts: all checks passed\n");
  return 0;
}
