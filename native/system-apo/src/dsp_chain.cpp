/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "dsp_chain.h"

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
  // Only the neural runtime is unavailable in audiodg. Disabling the whole
  // restoration stage also discarded the self-contained hiss/hum/click DSP.
  // External streams have no Library scan; learn their floor from live audio.
  decoded.denoise.voice.enabled = 0;
  decoded.denoise.profile_source = FEQ_DENOISE_PROFILE_ADAPTIVE;
  *out = decoded;
  return true;
}

RackBuild build_rack(const std::vector<double>& values, uint32_t sample_rate,
                     uint32_t channels, uint32_t max_frames,
                     std::vector<std::string>& warnings) {
  RackBuild built;
  if (values.empty()) {
    return built;  // No rack file, which is the ordinary state under APO.
  }

  FeqChainSettings settings = {};
  if (!decode_dsp_chain(values, &settings)) {
    built.failed = true;
    warnings.push_back("DSP rack file could not be read (" +
                       std::to_string(values.size()) +
                       " values); the rack is bypassed.");
    return built;
  }
  if (settings.enabled == 0) {
    // The rack's own power switch. Dropping the chain rather than running a
    // bypassed one costs nothing and keeps `Graph::is_passthrough()` honest:
    // an endpoint with the rack off and no EQ really does leave audio alone.
    return built;
  }

  // Stereo, and never wider: `FEQ_CHAIN_CHANNELS` is 2 and the stages behind
  // it are written for one or two. A mono stream runs the chain with one
  // channel, which `feq_chain_create` accepts and every stage guards for.
  const uint32_t wanted =
      channels < FEQ_CHAIN_CHANNELS ? channels : FEQ_CHAIN_CHANNELS;
  built.chain.reset(
      feq_chain_create(static_cast<double>(sample_rate), wanted, max_frames));
  if (!built.chain) {
    built.failed = true;
    warnings.push_back("DSP rack could not be prepared; the rack is bypassed.");
    return built;
  }
  built.channels = wanted;
  feq_chain_configure(built.chain.get(), &settings);
  if (feq_chain_enable_live_normalizer(built.chain.get()) == 0) {
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
  built.latency = feq_chain_latency_frames(built.chain.get());

  if (channels > wanted) {
    warnings.push_back(
        "Stream has " + std::to_string(channels) +
        " channels; the DSP rack runs on the first two and the rest pass "
        "through it untouched.");
  }
  return built;
}

}  // namespace fluideq_engine
