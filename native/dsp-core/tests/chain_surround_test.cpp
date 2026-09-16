/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The chain on more than two channels: what a 5.1 or 7.1 output gets.
 *
 * Four claims, each of which the stereo tests cannot see. The front pair of a
 * six-channel chain is bit-for-bit the stereo chain (so nothing this widening
 * did reaches a Library track or a stereo output). A surround channel fed the
 * same programme as the front leaves identical to it, which is every
 * per-channel stage running there and every level stage deciding once. A
 * quieter surround channel gets exactly the front's gain, which is the
 * "one decision" claim on its own. And an impulse on every channel leaves on
 * the same frame, which is the alignment the front pair's own delays would
 * otherwise break.
 */

#include "fluideq/chain.h"

#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "dsp_test_support.h"

namespace {

using feq_test::check;
using feq_test::finish;
using feq_test::kFrames;
using feq_test::kRate;
using feq_test::Pink;

constexpr uint32_t kSurround = 6;
constexpr size_t kBlocks = 200;

struct ChainDeleter {
  void operator()(FeqChain* chain) const { feq_chain_destroy(chain); }
};
using Chain = std::unique_ptr<FeqChain, ChainDeleter>;

/**
 * Everything on that can be on without a file: the level stages that decide
 * once are the point, and the per-channel stages are what must reach every
 * channel. The stereo-only stages stay off where the claim is "identical to
 * the front", because they are the stages that make the front pair differ.
 */
FeqChainSettings settings_for(bool stereo_stages) {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.eq.enabled = 1;
  settings.eq.band_count = 2;
  settings.eq.bands[0].enabled = 1;
  settings.eq.bands[0].type = FEQ_FILTER_PK;
  settings.eq.bands[0].frequency = 120.0;
  settings.eq.bands[0].gain_db = 6.0;
  settings.eq.bands[0].quality = 1.0;
  settings.eq.bands[1].enabled = 1;
  settings.eq.bands[1].dynamic = 1;
  settings.eq.bands[1].type = FEQ_FILTER_PK;
  settings.eq.bands[1].frequency = 3000.0;
  settings.eq.bands[1].gain_db = -6.0;
  settings.eq.bands[1].quality = 1.4;
  settings.eq.bands[1].threshold_db = -30.0;
  settings.exciter.enabled = 1;
  settings.compressor.enabled = 1;
  settings.maximizer.enabled = 1;
  settings.maximizer.drive_db = 6.0;
  settings.master.enabled = 1;
  settings.master.loudness_maximize = 1;
  settings.bass_forge.enabled = stereo_stages ? 1 : 0;
  settings.bass_punch.enabled = stereo_stages ? 1 : 0;
  settings.dimension.enabled = stereo_stages ? 1 : 0;
  return settings;
}

Chain make_chain(uint32_t channels, const FeqChainSettings& settings) {
  Chain chain(feq_chain_create(kRate, channels, kFrames));
  if (chain) {
    feq_chain_configure(chain.get(), &settings);
    feq_chain_reset(chain.get(), FEQ_CHAIN_RESET_STREAM_START);
  }
  return chain;
}

/** One planar buffer per channel, `kBlocks` blocks long. */
std::vector<std::vector<float>> planar(uint32_t channels) {
  return std::vector<std::vector<float>>(
      channels, std::vector<float>(kBlocks * kFrames, 0.0f));
}

void run(FeqChain* chain, std::vector<std::vector<float>>& buffers) {
  std::vector<float*> pointers(buffers.size());
  for (size_t block = 0; block < kBlocks; ++block) {
    for (size_t channel = 0; channel < buffers.size(); ++channel) {
      pointers[channel] = buffers[channel].data() + block * kFrames;
    }
    feq_chain_process(chain, pointers.data(), kFrames);
  }
}

std::vector<float> pink(uint32_t seed, double peak) {
  Pink source;
  source.noise.seed = seed;
  std::vector<float> out(kBlocks * kFrames);
  for (float& sample : out) {
    sample = static_cast<float>(source.next() * peak * 0.25);
  }
  return out;
}

bool identical(const std::vector<float>& one, const std::vector<float>& other) {
  if (one.size() != other.size()) {
    return false;
  }
  for (size_t at = 0; at < one.size(); ++at) {
    if (one[at] != other[at]) {
      return false;
    }
  }
  return true;
}

size_t peak_index(const std::vector<float>& samples) {
  size_t best = 0;
  for (size_t at = 1; at < samples.size(); ++at) {
    if (std::fabs(samples[at]) > std::fabs(samples[best])) {
      best = at;
    }
  }
  return best;
}

void width_limits() {
  std::printf("width limits\n");
  const FeqChainSettings settings = settings_for(true);
  check(make_chain(FEQ_CHAIN_MAX_CHANNELS, settings) != nullptr,
        "eight channels are accepted");
  check(make_chain(FEQ_CHAIN_MAX_CHANNELS + 1, settings) == nullptr,
        "nine channels are refused");
  check(make_chain(1, settings) != nullptr, "mono is still accepted");
}

/** The front pair of a surround chain is the stereo chain, bit for bit. */
void front_pair_is_the_stereo_chain() {
  std::printf("front pair is the stereo chain\n");
  const FeqChainSettings settings = settings_for(true);
  Chain stereo = make_chain(2, settings);
  Chain surround = make_chain(kSurround, settings);
  check(stereo != nullptr && surround != nullptr, "both chains built");
  if (!stereo || !surround) {
    return;
  }
  auto a = planar(2);
  auto b = planar(kSurround);
  a[0] = pink(11u, 0.8);
  a[1] = pink(23u, 0.8);
  b[0] = a[0];
  b[1] = a[1];
  // The other four silent, so the linked detectors hear nothing new.
  run(stereo.get(), a);
  run(surround.get(), b);
  check(identical(a[0], b[0]) && identical(a[1], b[1]),
        "front pair identical with silent surrounds");
  check(feq_chain_latency_frames(stereo.get()) ==
            feq_chain_latency_frames(surround.get()),
        "the surround chain reports the stereo chain's latency");
}

/**
 * A surround channel carrying the front's programme leaves as the front
 * did: every per-channel stage ran on it and every level stage decided once.
 */
void surround_channel_matches_the_front() {
  std::printf("surround channel matches the front\n");
  const FeqChainSettings settings = settings_for(false);
  Chain surround = make_chain(kSurround, settings);
  check(surround != nullptr, "chain built");
  if (!surround) {
    return;
  }
  auto b = planar(kSurround);
  const std::vector<float> programme = pink(31u, 0.9);
  for (auto& channel : b) {
    channel = programme;
  }
  run(surround.get(), b);
  // Not silent: the stages did something to compare.
  double energy = 0.0;
  for (const float sample : b[0]) {
    energy += static_cast<double>(sample) * sample;
  }
  check(energy > 1.0, "the front carries programme (positive control)");
  check(identical(b[2], b[0]), "the centre leaves as the front left");
  check(identical(b[4], b[0]), "a rear channel leaves as the front left");
  check(identical(b[5], b[1]), "the other rear leaves as the front right");
}

/**
 * One decision: a channel twenty decibels down gets the front's gain, not a
 * gain of its own, at every sample the limiter is working.
 */
void level_is_decided_once() {
  std::printf("level is decided once\n");
  FeqChainSettings settings = settings_for(false);
  settings.eq.enabled = 0;
  settings.exciter.enabled = 0;
  Chain surround = make_chain(kSurround, settings);
  check(surround != nullptr, "chain built");
  if (!surround) {
    return;
  }
  auto b = planar(kSurround);
  const std::vector<float> loud = pink(41u, 1.0);
  b[0] = loud;
  b[1] = loud;
  b[4] = loud;
  for (float& sample : b[4]) {
    sample *= 0.1f;
  }
  const std::vector<float> in_front = b[0];
  const std::vector<float> in_rear = b[4];
  run(surround.get(), b);
  // Past every look-ahead and the leveler's settle.
  double worst = 0.0;
  for (size_t at = b[0].size() / 2; at < b[0].size(); ++at) {
    if (std::fabs(in_front[at]) < 0.05f || std::fabs(in_rear[at]) < 0.005f) {
      continue;
    }
    const double front_gain = b[0][at] / in_front[at];
    const double rear_gain = b[4][at] / in_rear[at];
    const double difference = std::fabs(front_gain - rear_gain);
    if (difference > worst) {
      worst = difference;
    }
  }
  std::printf("  largest gain difference front vs rear: %.6f\n", worst);
  check(worst < 1e-3, "the rear channel gets the front's gain");
}

/** An impulse on every channel leaves on the same frame. */
void channels_stay_aligned() {
  std::printf("channels stay aligned\n");
  FeqChainSettings settings = settings_for(true);
  settings.maximizer.enabled = 0;
  settings.compressor.enabled = 0;
  settings.exciter.enabled = 0;
  settings.eq.enabled = 0;
  settings.master.enabled = 0;
  Chain surround = make_chain(kSurround, settings);
  check(surround != nullptr, "chain built");
  if (!surround) {
    return;
  }
  auto b = planar(kSurround);
  const size_t at = kFrames * 20 + 7;
  for (auto& channel : b) {
    channel[at] = 0.5f;
  }
  run(surround.get(), b);
  const size_t front = peak_index(b[0]);
  std::printf("  impulse left at frame %zu (put in at %zu)\n", front, at);
  check(front >= at, "the front pair is delayed, not advanced");
  check(peak_index(b[2]) == front, "the centre lands with the front");
  check(peak_index(b[3]) == front, "the LFE lands with the front");
  check(peak_index(b[5]) == front, "a rear channel lands with the front");
}

/**
 * The subwoofer feed gets no harmonics, and the channel beside it does.
 *
 * Against a chain with the exciter off rather than against the input: the
 * always-on stages after the exciter (the headroom's look-ahead, the DC
 * block) touch every channel whatever the settings, so "unchanged" means "as
 * it would be with no exciter at all". Every level stage that decides once
 * is off, the safety limiter included: harmonics on the centre raise what
 * the linked detector hears, and the gain it then takes is taken from the
 * LFE too, which is the surround design and not the exciter touching it.
 */
void lfe_is_left_alone_by_the_exciter() {
  std::printf("lfe is left alone by the exciter\n");
  FeqChainSettings settings = settings_for(false);
  settings.eq.enabled = 0;
  settings.compressor.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.master.enabled = 0;
  settings.output_safety_enabled = 0;
  settings.exciter.bands[0].enabled = 1;
  settings.exciter.bands[0].drive = 1.0;
  settings.exciter.bands[0].mix = 1.0;
  Chain excited = make_chain(kSurround, settings);
  settings.exciter.enabled = 0;
  Chain plain = make_chain(kSurround, settings);
  check(excited != nullptr && plain != nullptr, "both chains built");
  if (!excited || !plain) {
    return;
  }
  feq_chain_set_lfe_channel(excited.get(), 3);
  auto a = planar(kSurround);
  auto b = planar(kSurround);
  const std::vector<float> programme = pink(53u, 0.9);
  for (auto& channel : a) {
    channel = programme;
  }
  for (auto& channel : b) {
    channel = programme;
  }
  run(excited.get(), a);
  run(plain.get(), b);
  check(identical(a[3], b[3]), "the LFE leaves as with no exciter");
  check(!identical(a[2], b[2]), "the centre was excited (positive control)");
}

/**
 * The room inside the chain: with a head and a layout it folds a six-channel
 * chain onto the pair and adds one partition of latency; without a head it
 * is inactive whatever its switch says, and the chain is what it was.
 */
void the_room_folds_the_chain() {
  std::printf("the room folds the chain\n");
  FeqChainSettings settings = settings_for(false);
  settings.room.enabled = 1;
  Chain surround = make_chain(kSurround, settings);
  Chain plain = make_chain(kSurround, settings);
  check(surround != nullptr && plain != nullptr, "both chains built");
  if (!surround || !plain) {
    return;
  }
  check(feq_chain_room_active(surround.get()) == 0,
        "no head, no room, however the switch is set");
  const uint32_t without = feq_chain_latency_frames(surround.get());
  // A head of unit impulses: every direction reaches both ears at once.
  constexpr uint32_t directions = 24;
  constexpr uint32_t taps = 64;
  std::vector<float> ring(directions * taps, 0.0f);
  for (uint32_t direction = 0; direction < directions; ++direction) {
    ring[direction * taps] = 1.0f;
  }
  const int speakers[FEQ_CHAIN_MAX_CHANNELS] = {0, 1, 2, -1, 5, 6, -1, -1};
  feq_chain_set_room_layout(surround.get(), speakers);
  feq_chain_set_lfe_channel(surround.get(), 3);
  feq_chain_set_room_head(surround.get(), ring.data(), ring.data(),
                          directions, taps, 0);
  check(feq_chain_room_active(surround.get()) == 1, "head and layout: active");
  check(feq_chain_latency_frames(surround.get()) == without + 512,
        "the room adds one partition of latency");
  auto a = planar(kSurround);
  auto b = planar(kSurround);
  const std::vector<float> programme = pink(61u, 0.6);
  for (auto& channel : a) {
    channel = programme;
  }
  for (auto& channel : b) {
    channel = programme;
  }
  run(surround.get(), a);
  run(plain.get(), b);
  bool silent = true;
  for (uint32_t channel = 2; channel < kSurround; ++channel) {
    for (const float sample : a[channel]) {
      silent = silent && sample == 0.0f;
    }
  }
  check(silent, "the channels beyond the pair leave silent");
  check(!identical(a[0], b[0]), "the front pair carries the room (control)");
  check(identical(b[2], b[0]), "the chain without a head is unchanged");
}

}  // namespace

int main() {
  std::printf("chain surround\n\n");
  the_room_folds_the_chain();
  width_limits();
  front_pair_is_the_stereo_chain();
  surround_channel_matches_the_front();
  level_is_decided_once();
  channels_stay_aligned();
  lfe_is_left_alone_by_the_exciter();
  return finish();
}
