/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "dsp_chain.h"

#include "channel_layout.h"
#include "fluideq/convolver.h"
#include "source_analysis.h"

#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace fluideq_engine {

bool decode_dsp_chain(const std::vector<double>& values,
                      FeqChainSettings* out) {
  if (out == nullptr || values.empty() ||
      values.size() > static_cast<size_t>(UINT32_MAX)) {
    return false;
  }
  FeqChainSettings decoded;
  if (feq_chain_settings_decode(values.data(),
                                static_cast<uint32_t>(values.size()),
                                &decoded) == 0) {
    return false;
  }
  // Into a local first, so a refusal above leaves the caller's struct alone —
  // the same contract `feq_chain_settings_decode` keeps for its own `out`.
  *out = decoded;
  return true;
}

RackBuild build_rack(const std::vector<double>& values, uint32_t sample_rate,
                     uint32_t channels, uint32_t max_frames,
                     std::vector<std::string>& warnings,
                     FeqLevelingMemory* leveling, unsigned long channel_mask,
                     const RoomHead* room_head, bool low_latency,
                     const SourceAnalysis* source_analysis) {
  RackBuild built;
  // The EQ side's game mode holds even with no rack to run: the graph reads
  // it back for its own stages.
  built.low_latency = low_latency;
  if (values.empty()) {
    if (source_analysis != nullptr && source_analysis->library && source_analysis->engine_owner) {
      built.source_ready = false;
      warnings.push_back("This output's DSP file is not ready for Library ownership.");
    }
    return built;  // No rack file, which is the ordinary state under APO.
  }

  FeqChainSettings settings = {};
  if (!decode_dsp_chain(values, &settings)) {
    built.failed = true;
    built.source_ready = source_analysis == nullptr ||
        (source_analysis->library && !source_analysis->engine_owner);
    warnings.push_back("DSP rack file could not be read (" +
                       std::to_string(values.size()) +
                       " values); the rack is bypassed.");
    return built;
  }
  if (source_analysis == nullptr) {
    // Legacy hosts have no source/model delivery contract. The system APO
    // always supplies its own snapshot, including a live-source snapshot.
    settings.denoise.voice.enabled = 0;
    settings.denoise.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
  }
  if (source_analysis != nullptr && source_analysis->library &&
      !source_analysis->engine_owner) {
    // An explicit host handback is acknowledged by an adopted bypass rack.
    // A profile edit cannot re-enable endpoint DSP over Library's already
    // processed feed while native preparation is unavailable.
    settings.enabled = 0;
  }
  // The shared Game mode switch is independent of the rack's power. Keep
  // its preference for the EQ even while the rack belongs to the Library or
  // has been bypassed; no DSP stages are constructed in that case.
  built.low_latency = low_latency || settings.low_latency != 0;
  if (settings.enabled == 0) {
    // The rack's own power switch. Dropping the chain rather than running a
    // bypassed one costs nothing and keeps `Graph::is_passthrough()` honest:
    // an endpoint with the rack off and no EQ really does leave audio alone.
    //
    return built;
  }
  // Game mode from either side: the rack's own value (the Gaming preset) or
  // the EQ side's directive (the Games voicing). The delay a player feels is
  // the whole path's, so one asking for it is enough for both halves.
  if (low_latency) {
    settings.low_latency = 1;
  }
  built.low_latency = settings.low_latency != 0;

  // As wide as the stream, up to the chain's own limit, when the rack is set
  // to run on every channel; the front pair otherwise, with the rest passed
  // through it untouched. A mono stream runs the chain with one channel,
  // which `feq_chain_create` accepts and every stage guards for.
  const uint32_t limit = settings.surround_all_channels != 0
                             ? FEQ_CHAIN_MAX_CHANNELS
                             : FEQ_CHAIN_CHANNELS;
  const uint32_t wanted = channels < limit ? channels : limit;
  built.chain.reset(
      feq_chain_create(static_cast<double>(sample_rate), wanted, max_frames));
  if (!built.chain) {
    built.failed = true;
    built.source_ready = source_analysis == nullptr;
    warnings.push_back("DSP rack could not be prepared; the rack is bypassed.");
    return built;
  }
  built.channels = wanted;
  feq_chain_configure(built.chain.get(), &settings);
  // Before the chain is published, like everything else about its shape:
  // the subwoofer feed, each channel's speaker in the room, and the head.
  const auto count = static_cast<unsigned short>(channels);
  int speakers[FEQ_CHAIN_MAX_CHANNELS] = {-1, -1, -1, -1, -1, -1, -1, -1};
  for (uint32_t channel = 0; channel < wanted; ++channel) {
    speakers[channel] = speaker_of_channel(channel_mask, count, channel);
  }
  feq_chain_set_room_layout(built.chain.get(), speakers);
  feq_chain_set_lfe_channel(built.chain.get(),
                            lfe_channel_of(channel_mask, count));
  if (room_head != nullptr) {
    feq_chain_set_room_head(built.chain.get(), room_head->left.data(),
                            room_head->right.data(), room_head->directions,
                            room_head->taps, room_head->needs_doubling ? 1 : 0);
  }
  if (settings.room.enabled != 0) {
    if (feq_chain_room_active(built.chain.get()) != 0) {
      static const char* const kHeads[] = {"small", "medium", "large"};
      const int head = settings.room.head;
      built.room_state = wanted == 2   ? (settings.room.music_upmix != 0
                                             ? "music"
                                             : "front-stage")
                         : wanted == 6 ? "5.1"
                         : wanted == 8 ? "7.1"
                                       : "on";
      built.room_note =
          "room on: " + std::to_string(wanted) + " channels folded to the "
          "front pair through the " +
          (head >= 0 && head < 3 ? kHeads[head] : "unknown") + " head (" +
          std::to_string(room_head->directions) + " directions, " +
          std::to_string(room_head->taps) + " taps), preset " +
          std::to_string(settings.room.preset) + ", +" +
          std::to_string(feq_convolver_latency()) + " frames";
    } else if (room_head == nullptr) {
      built.room_without_head = true;
      built.room_state = "no-head";
      warnings.push_back(
          "The room is on but no head file was found beside the rack; the "
          "room is off until the app writes one.");
    } else {
      built.room_note =
          "room off: " + std::to_string(wanted) +
          " channel(s), none with a speaker on the ring";
    }
  }
  if (settings.room.enabled != 0 && source_analysis != nullptr &&
      source_analysis->library && source_analysis->engine_owner &&
      feq_chain_room_active(built.chain.get()) == 0) {
    // Library ownership may only move from the host once every requested
    // feature is prepared. A missing, unusable or unbuildable head must not
    // turn a working Room into bypass and still acknowledge the raw feed.
    built.failed = true;
    built.source_ready = false;
    built.chain.reset();
    warnings.push_back("Library playback needs its requested Room to be prepared before native ownership.");
    return built;
  }
  if (source_analysis == nullptr &&
      feq_chain_enable_live_normalizer(built.chain.get()) == 0) {
    built.failed = true;
    built.chain.reset();
    warnings.push_back("Live input normalization could not be prepared.");
    return built;
  }

  /**
   * One block of silence, here rather than on the audio thread.
   *
   * `feq_chain_configure` publishes a linear-phase kernel for the audio thread
   * to adopt, and the adoption happens inside `feq_chain_process`. So a chain
   * that has never processed a block reports no linear-phase latency at all —
   * and `Graph::latency_frames()` is read exactly once, at publish time,
   * because the number `GetLatency` hands Windows may not be read off a graph
   * the watcher can destroy at any moment. Without this the effect told
   * Windows it added nothing while delaying every output by 171 ms, which is
   * what every video player's audio/video sync is computed from.
   *
   * The reset afterwards puts the stages back where a stream starts. Only the
   * convolvers keep anything, and what they keep is the silence they were
   * primed with, which is where they started.
   */
  std::vector<float> silence(static_cast<size_t>(max_frames) * wanted, 0.0f);
  std::vector<float*> planes(wanted);
  for (uint32_t at = 0; at < wanted; ++at) {
    planes[at] = silence.data() + static_cast<size_t>(at) * max_frames;
  }
  feq_chain_process(built.chain.get(), planes.data(), max_frames);
  feq_chain_reset(built.chain.get(), FEQ_CHAIN_RESET_STREAM_START);
  if (source_analysis != nullptr) {
    const auto source = source_analysis->view();
    FeqChainSourceStatus status{};
    // A downloaded model needs the hash-verified runtime beside our DLL.
    // Missing runtime is a visible refusal, not a silent voice bypass.
    const bool voice_unavailable = settings.denoise.enabled != 0 &&
        settings.denoise.voice.enabled != 0 &&
        source_analysis->voice_available &&
        (source_analysis->voice_runtime.empty() || !source_analysis->voice_model_guard);
    if (voice_unavailable || feq_chain_prepare_source_analysis(
            built.chain.get(), &source, leveling, &status) == 0) {
      built.failed = true;
      built.source_ready = false;
      built.chain.reset();
      warnings.push_back(voice_unavailable
          ? "Voice restoration needs the installed trusted runtime and verified model."
          : "This output's source analysis or voice model could not be prepared.");
      return built;
    }
    built.source_ready = status.ready != 0;
    built.voice_ready = status.voice_ready != 0;
    // These restoration states cannot be swapped by denoise_transfer. Keep
    // the old graph playing while the replacement fills instead of dropping
    // the new empty state into the stream on an otherwise equal-delay edit.
    built.warm_handover = settings.denoise.enabled != 0 &&
        (built.voice_ready || (source_analysis->library && source_analysis->noise));
  }
  built.latency = feq_chain_latency_frames(built.chain.get());
  feq_chain_latency_parts(built.chain.get(), &built.parts);
  if (source_analysis == nullptr) feq_chain_attach_leveling_memory(built.chain.get(), leveling);

  if (channels > wanted) {
    warnings.push_back(
        "Stream has " + std::to_string(channels) +
        " channels; the DSP rack runs on the first " + std::to_string(wanted) +
        (settings.surround_all_channels != 0
             ? " and the rest pass through it untouched."
             : " (surround is switched off) and the rest pass through it "
               "untouched."));
  }
  return built;
}

}  // namespace fluideq_engine
