/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A band kept to one ear (Ivan, 2026-10-13, "EQ per channel"): the engine
 * reads the `Channel:` lines the app writes for it — the very lines
 * `eqChannels.test.ts` holds the app's writer to — finds the ear's channel in
 * whatever layout the stream has, and runs the band there alone.
 *
 * Every engine before this one read `Channel:` and ignored it, so a band kept
 * to the left ear played on both. The cascade's case beside a band on both
 * ears is the control: the same band, the same tone, both channels moved.
 */

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
#include <string>
#include <vector>

#include "../src/channel_layout.h"
#include "../src/iir_cascade.h"
#include "fluideq_engine/config.h"

using fluideq_engine::Band;
using fluideq_engine::Chain;
using fluideq_engine::ChannelSelection;
using fluideq_engine::design_band;
using fluideq_engine::Endpoint;
using fluideq_engine::FileProvider;
using fluideq_engine::IirBand;
using fluideq_engine::IirCascade;
using fluideq_engine::kLowFrequencySpeaker;
using fluideq_engine::parse_channels;
using fluideq_engine::resolve_chain;
using fluideq_engine::selected_channels;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

// FL | FR, and FL | FR | FC | LFE | BL | BR | SL | SR.
constexpr unsigned long kStereo = 0x3;
constexpr unsigned long k7point1 = 0x63F;

using Files = std::map<std::wstring, std::string>;

FileProvider provider(const Files& files) {
  return [&files](const std::wstring& path) -> std::optional<std::string> {
    const auto found = files.find(path);
    if (found == files.end()) {
      return std::nullopt;
    }
    return found->second;
  };
}

void reads_the_names_and_numbers() {
  std::printf("reads the speaker names and the channel numbers\n");
  const ChannelSelection all = parse_channels("all");
  CHECK(all.all);
  const ChannelSelection left = parse_channels("L");
  CHECK(!left.all && left.speakers == 1u && left.indices == 0u);
  const ChannelSelection mixed = parse_channels("R sub 3");
  CHECK(!mixed.all);
  CHECK(mixed.speakers == ((1u << 1) | (1u << kLowFrequencySpeaker)));
  CHECK(mixed.indices == (1u << 2));
  // Nothing it knows is every channel: a line that selected nothing would
  // silence the filters after it on every output.
  CHECK(parse_channels("").all);
  CHECK(parse_channels("XL 0 99").all);
}

void keeps_each_band_to_the_line_above_it() {
  std::printf("keeps each band to the Channel line above it, into includes\n");
  Files files;
  files[L"C:\\cfg\\config.txt"] =
      "Device: all\r\nChannel: all\r\nInclude: fluideq-eq.txt\r\n"
      "Filter 1: ON PK Fc 8000 Hz Gain 1 dB Q 1\r\n";
  // Your EQ's file exactly as `eqChannels.test.ts` has the app write it.
  files[L"C:\\cfg\\fluideq-eq.txt"] =
      "# FluidEQEqLayer: ON\r\n"
      "Channel: all\r\n"
      "Filter 1: ON PK Fc 100 Hz Gain 3 dB Q 1\r\n"
      "Channel: L\r\n"
      "Filter 2: ON PK Fc 5600 Hz Gain -2.5 dB Q 1\r\n"
      "Channel: R\r\n"
      "Filter 3: ON PK Fc 3200 Hz Gain 2 dB Q 1\r\n"
      "Channel: all\r\n";
  const Chain chain =
      resolve_chain(L"C:\\cfg", Endpoint{L"{guid}", L"Headphones"},
                    provider(files));
  CHECK(chain.bands.size() == 4);
  if (chain.bands.size() != 4) {
    return;
  }
  CHECK(chain.bands[0].channels.all);
  CHECK(!chain.bands[1].channels.all && chain.bands[1].channels.speakers == 1u);
  CHECK(!chain.bands[2].channels.all && chain.bands[2].channels.speakers == 2u);
  // After the file, every channel again: the line the app writes last.
  CHECK(chain.bands[3].channels.all);
}

void finds_the_ear_in_any_layout() {
  std::printf("finds the ear's channel in stereo and in 7.1\n");
  const ChannelSelection left = parse_channels("L");
  const ChannelSelection right = parse_channels("R");
  CHECK(selected_channels(left, kStereo, 2) == 0x1u);
  CHECK(selected_channels(right, kStereo, 2) == 0x2u);
  // No mask on two channels is Windows' own stereo.
  CHECK(selected_channels(right, 0, 2) == 0x2u);
  CHECK(selected_channels(left, k7point1, 8) == 0x1u);
  CHECK(selected_channels(parse_channels("SUB"), k7point1, 8) == 0x8u);
  CHECK(selected_channels(ChannelSelection{}, k7point1, 8) == 0xFFu);
  // A mono stream has no left ear: the band plays nowhere, as under APO.
  CHECK(selected_channels(left, 0x4, 1) == 0u);
}

/** The level a tone at `frequency` leaves each channel at, in dB. */
std::vector<double> tone_levels(IirCascade& cascade, double frequency) {
  constexpr uint32_t kRate = 48000;
  constexpr uint32_t kFrames = 480;
  std::vector<std::vector<float>> channels(2, std::vector<float>(kFrames));
  std::vector<double> peak_in(2, 0.0);
  std::vector<double> peak_out(2, 0.0);
  for (int block = 0; block < 60; ++block) {
    for (size_t channel = 0; channel < 2; ++channel) {
      for (uint32_t frame = 0; frame < kFrames; ++frame) {
        const double t =
            static_cast<double>(block * kFrames + frame) / kRate;
        channels[channel][frame] =
            static_cast<float>(0.25 * std::sin(2.0 * 3.14159265358979 *
                                               frequency * t));
      }
    }
    float* planes[2] = {channels[0].data(), channels[1].data()};
    cascade.process(planes, kFrames);
    if (block >= 40) {  // Past the filters' settling.
      for (size_t channel = 0; channel < 2; ++channel) {
        for (const float sample : channels[channel]) {
          peak_out[channel] =
              std::max(peak_out[channel], std::abs(static_cast<double>(sample)));
        }
        peak_in[channel] = 0.25;
      }
    }
  }
  return {20.0 * std::log10(peak_out[0] / peak_in[0]),
          20.0 * std::log10(peak_out[1] / peak_in[1])};
}

IirBand boost_at(double frequency, double gain_db, uint32_t channels) {
  Band band{fluideq_engine::FilterType::PK, frequency, gain_db, 1.0};
  IirBand designed = design_band(band, 48000);
  designed.channels = channels;
  return designed;
}

void runs_a_band_on_its_ear_alone() {
  std::printf("runs a left-ear band on the left channel alone\n");
  IirCascade left({boost_at(1000.0, 6.0, 0x1u)}, 48000, 2, 480);
  const std::vector<double> kept = tone_levels(left, 1000.0);
  CHECK(std::abs(kept[0] - 6.0) < 0.2);
  CHECK(std::abs(kept[1]) < 0.05);

  // The control: the same band on both ears moves both.
  IirCascade both({boost_at(1000.0, 6.0, ~0u)}, 48000, 2, 480);
  const std::vector<double> shared = tone_levels(both, 1000.0);
  CHECK(std::abs(shared[0] - 6.0) < 0.2);
  CHECK(std::abs(shared[1] - 6.0) < 0.2);
}

void a_band_moved_to_the_other_ear_is_a_new_response() {
  std::printf("a band moved to the other ear is a change, not the same cascade\n");
  IirCascade left({boost_at(1000.0, 6.0, 0x1u)}, 48000, 2, 480);
  IirCascade right({boost_at(1000.0, 6.0, 0x2u)}, 48000, 2, 480);
  IirCascade left_again({boost_at(1000.0, 6.0, 0x1u)}, 48000, 2, 480);
  CHECK(!right.same_response(left));
  CHECK(left_again.same_response(left));
}

}  // namespace

int main() {
  std::printf("channels\n\n");
  reads_the_names_and_numbers();
  keeps_each_band_to_the_line_above_it();
  finds_the_ear_in_any_layout();
  runs_a_band_on_its_ear_alone();
  a_band_moved_to_the_other_ear_is_a_new_response();
  if (g_failures != 0) {
    std::printf("\nchannels: %d failure(s)\n", g_failures);
    return 1;
  }
  std::printf("\nchannels: ok\n");
  return 0;
}
