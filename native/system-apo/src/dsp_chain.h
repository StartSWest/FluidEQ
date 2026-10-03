/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The flat array of doubles the app writes, as a rack ready to process audio.
 *
 * Two functions, split from `graph.cpp` so that file stays under the
 * project's 500-line limit — and the seam is a real one: everything here is
 * about the boundary between what the app sent and what may run inside
 * audiodg.exe, which is the one place the system-wide rack differs from the
 * Library player's.
 */
#ifndef FLUIDEQ_ENGINE_DSP_CHAIN_H
#define FLUIDEQ_ENGINE_DSP_CHAIN_H

#include <cstdint>
#include <memory>
#include <string>
#include <vector>

#include "fluideq/chain.h"
#include "fluideq_engine/graph.h"
#include "room_head.h"

namespace fluideq_engine {

/**
 * Read `values` into `out`. False when the array is not a rack snapshot.
 *
 * `out` is left exactly as it was on a refusal, which is
 * `feq_chain_settings_decode`'s own contract: a caller that ignored the result
 * would otherwise configure a chain from a half-filled struct.
 *
 * Source measurements and the trusted voice model are applied separately
 * by `build_rack`, on the same control thread before publication. Decoding
 * never removes a feature from this output's selected settings.
 */
bool decode_dsp_chain(const std::vector<double>& values,
                      FeqChainSettings* out);

/** What `build_rack` hands back: the chain, its width, and its delay. */
struct RackBuild {
  std::unique_ptr<FeqChain, detail::ChainDeleter> chain;
  bool failed = false;
  bool source_ready = true;
  bool voice_ready = false;
  bool warm_handover = false;
  uint32_t channels = 0;
  uint32_t latency = 0;
  /** The rack asks for the room and no head file was there to build it. */
  bool room_without_head = false;
  /** For the log: what the room folds and through what, or empty. */
  std::string room_note;
  /** For the status: `EngineStatus::room`'s words. */
  std::string room_state = "off";
  /**
   * Game mode, from either side: the rack's own last value (the Gaming
   * preset) or the EQ side's directive (the Games voicing), which the graph
   * hands in. The graph reads it back for the stages of its own that give
   * up delay the same way.
   */
  bool low_latency = false;
  /** What each of the rack's stages adds, for the status's breakdown. */
  FeqChainLatencyParts parts{};
};

/**
 * The DSP rack for one endpoint, from the array the app wrote.
 *
 * Never on the audio thread: this allocates every buffer the chain's stages
 * need and, under linear phase, designs a 16384-tap kernel out of two
 * transforms.
 *
 * `chain` is null whenever there is nothing to run — no rack file, a file
 * this build's decoder does not recognise, the rack switched off on the DSP
 * page, or a chain the core refused to allocate. Every one of those leaves
 * the EQ running, which is the whole point of the rack being a separate file
 * from the configuration tree.
 *
 * `leveling` is attached to the chain's live leveling once priming is over,
 * so the silent priming block neither adopts nor publishes anything.
 *
 * `channel_mask` is the stream's, 0 for a plain format: it names the
 * subwoofer feed, which the exciter leaves alone, and which speaker of the
 * room each channel is. `room_head` is the head the app wrote for the room,
 * or null for none — the room then stays inactive and the build says so.
 */
RackBuild build_rack(const std::vector<double>& values, uint32_t sample_rate,
                     uint32_t channels, uint32_t max_frames,
                     std::vector<std::string>& warnings,
                     FeqLevelingMemory* leveling = nullptr,
                     unsigned long channel_mask = 0,
                     const RoomHead* room_head = nullptr,
                     bool low_latency = false,
                     const SourceAnalysis* source_analysis = nullptr);

}  // namespace fluideq_engine

#endif  // FLUIDEQ_ENGINE_DSP_CHAIN_H
