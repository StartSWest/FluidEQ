/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "room_internal.h"

#include <algorithm>
#include <cmath>
#include <new>

namespace {

constexpr double kPi = 3.14159265358979323846;
/** The sub's low-pass corner: where a subwoofer feed stops carrying image. */
constexpr double kSubCornerHz = 120.0;
/** The blend's step per sample: a kernel change fades over 21 ms at 48 kHz. */
constexpr double kBlendStep = 1.0 / 1024.0;

/** CONTROL thread: free what the audio thread has put down. */
void sweep_retired(FeqRoom* room) {
  for (auto& slot : room->retired) {
    room_destroy_kernels(slot.exchange(nullptr, std::memory_order_acq_rel));
  }
}

/** AUDIO thread: hand a finished set to the control thread to free. */
void retire(FeqRoom* room, FeqRoomKernels* set) {
  if (set == nullptr) {
    return;
  }
  std::atomic<FeqRoomKernels*>& slot = room->retired[room->retired_at];
  room->retired_at = (room->retired_at + 1) % FeqRoom::kRetiredSlots;
  room_destroy_kernels(slot.exchange(set, std::memory_order_acq_rel));
}

void publish(FeqRoom* room) {
  if (!room->configured) {
    return;
  }
  sweep_retired(room);
  FeqRoomKernels* fresh = room_build_kernels(room);
  if (fresh == nullptr) {
    return;
  }
  room->active.store(fresh->active, std::memory_order_release);
  // Whatever comes back was published and never adopted: the audio thread
  // will never see it, so this is the only place it can be freed.
  room_destroy_kernels(
      room->handoff.exchange(fresh, std::memory_order_acq_rel));
}

/** Take a published set: the first is run, a later one is faded in. */
void adopt(FeqRoom* room) {
  FeqRoomKernels* taken = room->handoff.exchange(nullptr,
                                                  std::memory_order_acquire);
  if (taken == nullptr) {
    return;
  }
  if (room->live == nullptr || !room->live->active || !taken->active) {
    // Nothing to fade from, or nothing to fade to: switch outright. A set
    // going inactive leaves the buffers untouched from this block, which is
    // the same switch every other stage makes when it is turned off.
    retire(room, room->live);
    retire(room, room->next);
    room->live = taken;
    room->next = nullptr;
    room->blend = 1.0;
    return;
  }
  // A replacement overtaken before its fade finished is dropped, not faded
  // from: it was never fully heard.
  retire(room, room->next);
  room->next = taken;
  room->blend = 0.0;
  room->warmup = 0;
  for (const auto& pair : taken->kernel) {
    if (pair[0] != nullptr) {
      room->warmup = static_cast<int64_t>(feq_convolver_kernel_warmup(pair[0]));
      break;
    }
  }
}

}  // namespace

namespace {

/**
 * One source into the mix through the kernels at `slot`: the channel's
 * own slot on a surround stream, the speaker's index under the music
 * upmix. With bass management, the speaker gets what is above the
 * crossover and what is below joins the sub's sum — two Butterworth
 * stages each side make the pair a Linkwitz-Riley 4th order, which sums
 * flat. Nothing here allocates.
 */
void render_source(FeqRoom* room, FeqRoomKernels* live, FeqRoomKernels* next,
                   uint32_t slot, const float* input, uint32_t frames,
                   float* const* mix, float* low_sum, double* blend_after) {
  if (live->convolver[slot][0] == nullptr) {
    return;
  }
  if (live->bass_management != 0) {
    float* band = room->band.data();
    std::copy(input, input + frames, band);
    for (uint32_t at = 0; at < frames; ++at) {
      low_sum[at] += input[at];
    }
    feq_biquad_process(&room->bass_high[slot][0], band, frames,
                       &live->crossover_high);
    feq_biquad_process(&room->bass_high[slot][1], band, frames,
                       &live->crossover_high);
    input = band;
  }
  for (int ear = 0; ear < 2; ++ear) {
    float* copy = room->copy.data();
    std::copy(input, input + frames, copy);
    FeqConvolver* replacement =
        next != nullptr ? next->convolver[slot][ear] : nullptr;
    if (replacement != nullptr && room->warmup > 0) {
      // Both run, one is heard: the replacement fills its partitions.
      std::copy(input, input + frames, room->scratch.begin());
      feq_convolve(replacement, room->scratch.data(), frames);
      feq_convolve(live->convolver[slot][ear], copy, frames);
    } else if (replacement != nullptr) {
      // Every pair in the block starts from the same blend and lands on
      // the same one, so the two ears and every speaker fade together.
      *blend_after = feq_convolve_blend(live->convolver[slot][ear],
                                        replacement, copy,
                                        room->scratch.data(), frames,
                                        room->blend, kBlendStep);
    } else {
      feq_convolve(live->convolver[slot][ear], copy, frames);
    }
    float* into = mix[ear];
    for (uint32_t at = 0; at < frames; ++at) {
      into[at] += copy[at];
    }
  }
}

}  // namespace

extern "C" {

void feq_room_settings_defaults(FeqRoomSettings* settings) {
  if (settings == nullptr) {
    return;
  }
  *settings = FeqRoomSettings{};
  settings->size_m = 4.2;
  settings->walls = 0.55;
  settings->distance_m = 1.8;
  settings->head_scale = 1.0;
  settings->bass_management = 1;
  settings->crossover_hz = 80.0;
  settings->music_upmix = 0;
  settings->upmix_amount = 0.6;
  const double angles[FEQ_ROOM_SPEAKERS] = {-30, 30, 0, -100, 100, -140, 140};
  for (int speaker = 0; speaker < FEQ_ROOM_SPEAKERS; ++speaker) {
    settings->angle_deg[speaker] = angles[speaker];
    settings->level_db[speaker] = 0.0;
    settings->speaker_distance_m[speaker] = 0.0;
    settings->mute[speaker] = 0;
  }
  settings->mute[FEQ_ROOM_SPEAKERS] = 0;
}

FeqRoom* feq_room_create(double sample_rate, uint32_t channels,
                         uint32_t max_frames) {
  if (!(sample_rate > 0.0) || channels == 0 ||
      channels > FEQ_ROOM_MAX_CHANNELS || max_frames == 0) {
    return nullptr;
  }
  auto* room = new (std::nothrow) FeqRoom();
  if (room == nullptr) {
    return nullptr;
  }
  room->sample_rate = sample_rate;
  room->channels = channels;
  room->max_frames = max_frames;
  feq_room_settings_defaults(&room->settings);
  room->mix_left.assign(max_frames, 0.0f);
  room->mix_right.assign(max_frames, 0.0f);
  room->copy.assign(max_frames, 0.0f);
  room->scratch.assign(max_frames, 0.0f);
  room->sub.assign(max_frames, 0.0f);
  room->band.assign(max_frames, 0.0f);
  room->feeds.assign(static_cast<size_t>(max_frames) * FEQ_ROOM_SPEAKERS, 0.0f);
  room->ambience_line.assign(
      static_cast<size_t>(std::lround(kRoomUpmixMaxDelaySeconds * sample_rate)) +
          max_frames,
      0.0f);
  feq_room_reset(room);
  room->sub_coefficient =
      1.0 - std::exp(-2.0 * kPi * kSubCornerHz / sample_rate);
  return room;
}

void feq_room_destroy(FeqRoom* room) {
  if (room == nullptr) {
    return;
  }
  room_destroy_kernels(room->handoff.exchange(nullptr));
  room_destroy_kernels(room->live);
  room_destroy_kernels(room->next);
  sweep_retired(room);
  delete room;
}

void feq_room_set_head(FeqRoom* room, const float* left, const float* right,
                       uint32_t directions, uint32_t taps, int doubling) {
  if (room == nullptr) {
    return;
  }
  if (left == nullptr || right == nullptr || directions == 0 || taps == 0) {
    room->head_left.clear();
    room->head_right.clear();
    room->directions = 0;
    room->taps = 0;
  } else {
    const size_t count = static_cast<size_t>(directions) * taps;
    room->head_left.assign(left, left + count);
    room->head_right.assign(right, right + count);
    room->directions = directions;
    room->taps = taps;
    room->doubling = doubling != 0;
  }
  publish(room);
}

void feq_room_set_layout(FeqRoom* room, const int* speaker, int lfe_channel) {
  if (room == nullptr) {
    return;
  }
  for (uint32_t channel = 0; channel < FEQ_ROOM_MAX_CHANNELS; ++channel) {
    room->speaker[channel] =
        speaker != nullptr && channel < room->channels ? speaker[channel] : -1;
  }
  room->lfe_channel =
      lfe_channel >= 0 && static_cast<uint32_t>(lfe_channel) < room->channels
          ? lfe_channel
          : -1;
  publish(room);
}

void feq_room_configure(FeqRoom* room, const FeqRoomSettings* settings) {
  if (room == nullptr || settings == nullptr) {
    return;
  }
  room->settings = *settings;
  room->configured = true;
  publish(room);
}

void feq_room_process(FeqRoom* room, float* const* channels, uint32_t frames) {
  if (room == nullptr || channels == nullptr || frames == 0 ||
      frames > room->max_frames) {
    return;
  }
  adopt(room);
  FeqRoomKernels* live = room->live;
  if (live == nullptr || !live->active || room->channels < 2) {
    return;
  }
  FeqRoomKernels* next = room->next;
  float* mix[2] = {room->mix_left.data(), room->mix_right.data()};
  std::fill(mix[0], mix[0] + frames, 0.0f);
  std::fill(mix[1], mix[1] + frames, 0.0f);
  // The bass taken off every speaker, summed here and sent to the sub's path
  // once, after the sources; the live set's crossover, so a moved dial
  // arrives with the set it was published with.
  const bool managed = live->bass_management != 0;
  float* const low_sum = room->sub.data();
  if (managed) {
    std::fill(low_sum, low_sum + frames, 0.0f);
  }
  double blend_after = room->blend;
  if (live->upmix != 0) {
    // The music upmix: seven feeds from the pair, each through its own
    // speaker. The fronts are the pair itself; the centre is what both
    // sides share; the side signal, high-passed, goes to the sides a moment
    // later and to the rears later still and softer, each pair in opposite
    // polarity. A mono record makes no side signal and so no ambience.
    const float* left = channels[0];
    const float* right = channels[1];
    float* const feeds = room->feeds.data();
    const size_t stride = room->max_frames;
    float* const centre = feeds + 2 * stride;
    float* const side_left = feeds + 3 * stride;
    float* const side_right = feeds + 4 * stride;
    float* const rear_left = feeds + 5 * stride;
    float* const rear_right = feeds + 6 * stride;
    const auto centre_gain = static_cast<float>(live->centre_gain * 0.5);
    float* const ambience = room->band.data();
    for (uint32_t at = 0; at < frames; ++at) {
      centre[at] = (left[at] + right[at]) * centre_gain;
      ambience[at] = (left[at] - right[at]) * 0.5f;
    }
    feq_biquad_process(&room->ambience_high[0], ambience, frames,
                       &live->ambience_high);
    feq_biquad_process(&room->ambience_high[1], ambience, frames,
                       &live->ambience_high);
    float* const line = room->ambience_line.data();
    const size_t length = room->ambience_line.size();
    const size_t cursor = room->ambience_cursor;
    for (uint32_t at = 0; at < frames; ++at) {
      line[(cursor + at) % length] = ambience[at];
    }
    const size_t side_back = length - (live->side_frames % length);
    const size_t rear_back = length - (live->rear_frames % length);
    const auto side_gain = static_cast<float>(live->side_gain);
    const auto rear_gain = static_cast<float>(live->rear_gain);
    for (uint32_t at = 0; at < frames; ++at) {
      const float side = line[(cursor + at + side_back) % length];
      const float rear = line[(cursor + at + rear_back) % length];
      side_left[at] = side * side_gain;
      side_right[at] = -side * side_gain;
      rear_left[at] = rear * rear_gain;
      rear_right[at] = -rear * rear_gain;
    }
    room->ambience_cursor = (cursor + frames) % length;
    // The rears softened together: one filter pair on the shared signal,
    // which the two rears then take in opposite polarity.
    feq_biquad_process(&room->rear_low[0], rear_left, frames, &live->rear_low);
    feq_biquad_process(&room->rear_low[1], rear_left, frames, &live->rear_low);
    for (uint32_t at = 0; at < frames; ++at) {
      rear_right[at] = -rear_left[at];
    }
    std::copy(left, left + frames, feeds);
    std::copy(right, right + frames, feeds + stride);
    for (uint32_t slot = 0; slot < FEQ_ROOM_SPEAKERS; ++slot) {
      render_source(room, live, next, slot, feeds + slot * stride, frames,
                    mix, low_sum, &blend_after);
    }
  } else {
    for (uint32_t channel = 0; channel < room->channels; ++channel) {
      const float* input = channels[channel];
      if (static_cast<int>(channel) == room->lfe_channel) {
        // Low-passed and to both ears alike: a subwoofer has no direction.
        double state = room->sub_state;
        const double coefficient = room->sub_coefficient;
        const auto gain = static_cast<float>(live->sub_gain);
        for (uint32_t at = 0; at < frames; ++at) {
          state += coefficient * (static_cast<double>(input[at]) - state);
          const auto sample = static_cast<float>(state) * gain;
          mix[0][at] += sample;
          mix[1][at] += sample;
        }
        room->sub_state = state;
        continue;
      }
      render_source(room, live, next, channel, input, frames, mix, low_sum,
                    &blend_after);
    }
  }
  if (managed) {
    feq_biquad_process(&room->bass_low[0], low_sum, frames,
                       &live->crossover_low);
    feq_biquad_process(&room->bass_low[1], low_sum, frames,
                       &live->crossover_low);
    for (uint32_t at = 0; at < frames; ++at) {
      mix[0][at] += low_sum[at];
      mix[1][at] += low_sum[at];
    }
  }
  if (next != nullptr && room->warmup > 0) {
    room->warmup -= static_cast<int64_t>(frames);
  } else if (next != nullptr) {
    room->blend = blend_after;
    if (blend_after >= 1.0) {
      retire(room, room->live);
      room->live = next;
      room->next = nullptr;
      room->blend = 1.0;
    }
  }
  std::copy(mix[0], mix[0] + frames, channels[0]);
  std::copy(mix[1], mix[1] + frames, channels[1]);
  for (uint32_t channel = 2; channel < room->channels; ++channel) {
    std::fill(channels[channel], channels[channel] + frames, 0.0f);
  }
}

int feq_room_active(const FeqRoom* room) {
  return room == nullptr ? 0 : room->active.load(std::memory_order_acquire);
}

uint32_t feq_room_latency_frames(const FeqRoom* room) {
  return feq_room_active(room) != 0 ? feq_convolver_latency() : 0u;
}

void feq_room_transfer(FeqRoom* prepared, FeqRoom* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous ||
      prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels ||
      prepared->max_frames != previous->max_frames) {
    return;
  }
  // Whatever the previous room was handed and has not run yet is newer than
  // its live set and older than the prepared room's: take it now, so the
  // tail carried over is the latest one heard.
  adopt(previous);
  if (previous->live == nullptr) {
    return;
  }
  // The prepared room's own set: still in `handoff` when the chain has not
  // processed a block yet (the engine's handover), already live when it
  // has (a host that primed it). Either way it goes back into `handoff`,
  // and the first block adopts it as the replacement over the tail taken.
  FeqRoomKernels* own = prepared->handoff.exchange(nullptr,
                                                    std::memory_order_acq_rel);
  if (own == nullptr) {
    own = prepared->live;
    prepared->live = nullptr;
  } else {
    retire(prepared, prepared->live);
    prepared->live = nullptr;
  }
  if (own == nullptr) {
    // A room with no set of its own (its kernels could not be built) has
    // nothing to fade to, and must not go on playing the previous room's
    // set as if it were its own: it stays as it was built, inactive.
    return;
  }
  retire(prepared, prepared->next);
  prepared->live = previous->live;
  prepared->next = previous->next;
  prepared->blend = previous->blend;
  prepared->warmup = previous->warmup;
  prepared->sub_state = previous->sub_state;
  for (uint32_t channel = 0; channel < FEQ_ROOM_MAX_CHANNELS; ++channel) {
    prepared->bass_high[channel][0] = previous->bass_high[channel][0];
    prepared->bass_high[channel][1] = previous->bass_high[channel][1];
  }
  prepared->bass_low[0] = previous->bass_low[0];
  prepared->bass_low[1] = previous->bass_low[1];
  prepared->ambience_high[0] = previous->ambience_high[0];
  prepared->ambience_high[1] = previous->ambience_high[1];
  prepared->rear_low[0] = previous->rear_low[0];
  prepared->rear_low[1] = previous->rear_low[1];
  // Same rate and block size, so the rings are the same length: the side
  // signal in flight to the rears goes with the tail.
  std::copy(previous->ambience_line.begin(), previous->ambience_line.end(),
            prepared->ambience_line.begin());
  prepared->ambience_cursor = previous->ambience_cursor;
  previous->live = nullptr;
  previous->next = nullptr;
  previous->blend = 1.0;
  previous->warmup = 0;
  room_destroy_kernels(
      prepared->handoff.exchange(own, std::memory_order_acq_rel));
}

void feq_room_reset(FeqRoom* room) {
  if (room == nullptr) {
    return;
  }
  room->sub_state = 0.0;
  for (uint32_t channel = 0; channel < FEQ_ROOM_MAX_CHANNELS; ++channel) {
    feq_biquad_reset(&room->bass_high[channel][0]);
    feq_biquad_reset(&room->bass_high[channel][1]);
  }
  feq_biquad_reset(&room->bass_low[0]);
  feq_biquad_reset(&room->bass_low[1]);
  feq_biquad_reset(&room->ambience_high[0]);
  feq_biquad_reset(&room->ambience_high[1]);
  feq_biquad_reset(&room->rear_low[0]);
  feq_biquad_reset(&room->rear_low[1]);
  std::fill(room->ambience_line.begin(), room->ambience_line.end(), 0.0f);
  room->ambience_cursor = 0;
  std::fill(room->mix_left.begin(), room->mix_left.end(), 0.0f);
  std::fill(room->mix_right.begin(), room->mix_right.end(), 0.0f);
}

}  // extern "C"
