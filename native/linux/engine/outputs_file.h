/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Linux engine tells the app about the machine's outputs, and the
 * names it gives them.
 *
 * Every per-output file the app writes and the engine reads is named by the
 * output's GUID (`endpoint_config_name`), which on Windows is the endpoint's
 * own. A Linux output has a `node.name` instead — stable across reboots for
 * a sound card (`alsa_output.pci-0000_04_00.6.HiFi__Headphones__sink`), and
 * carrying the address for a Bluetooth headset — so the GUID is derived from
 * it: the same output always gets the same id, and two outputs never share
 * one. Speakers and headphones on one card are two node names, two ids and
 * two profiles, as they are two endpoints on Windows.
 *
 * `outputs.json`, beside the statuses in the engine's folder, lists them with
 * those ids, so the app can show and name them without deriving anything.
 */
#ifndef FLUIDEQ_LINUX_OUTPUTS_FILE_H
#define FLUIDEQ_LINUX_OUTPUTS_FILE_H

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace fluideq_linux {

/**
 * A speaker, as its WAVEFORMATEXTENSIBLE bit — the vocabulary the shared
 * graph reads channel roles in (the LFE for the exciter, the ring for the
 * room). 0 for a position that has no bit.
 */
using Speaker = unsigned long;

/** The channels a stream carries, in order. At most eight: the rack's limit. */
struct ChannelLayout {
  uint32_t channels = 0;
  Speaker speakers[8] = {};
  /** Every speaker's bit, when the order is Windows' ascending one; else 0. */
  unsigned long mask = 0;

  bool operator==(const ChannelLayout& other) const noexcept;
};

/**
 * PipeWire's `audio.position` text — "[ FL, FR ]", "FL,FR,FC,LFE,SL,SR" —
 * as speakers; an unknown name is 0.
 */
std::vector<Speaker> parse_positions(std::string_view text);

/**
 * The layout the engine runs an output at: its own speakers in ascending bit
 * order when they all have one (PipeWire maps channels by position, so the
 * order on our side is ours to choose), which gives the graph a channel mask;
 * otherwise its first eight channels as they are, with no mask. An output
 * that says nothing is taken as stereo.
 */
ChannelLayout layout_for(uint32_t channels, const std::vector<Speaker>& speakers);

/** `{XXXXXXXX-XXXX-8XXX-XXXX-XXXXXXXXXXXX}` for an output's `node.name`. */
std::string endpoint_id_for(std::string_view node_name);

struct OutputEntry {
  std::string id;
  std::string name;
  std::string description;
  uint32_t channels = 0;
  /** The output the listener chose, which the engine plays to. */
  bool target = false;
};

/**
 * Writes `<engine root>/outputs.json` whole (aside, then renamed). False
 * with the step and errno in `why`; never throws.
 */
bool write_outputs_file(const std::string& backend, const std::string& sink,
                        const std::vector<OutputEntry>& outputs,
                        std::string* why) noexcept;

}  // namespace fluideq_linux

#endif  // FLUIDEQ_LINUX_OUTPUTS_FILE_H
