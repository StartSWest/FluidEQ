/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "room_internal.h"

#include <algorithm>
#include <cmath>
#include <new>
#include <exception>
#include <utility>

namespace {

constexpr double kPi = 3.14159265358979323846;
/** The sub's low-pass corner: where a subwoofer feed stops carrying image. */
constexpr double kSubCornerHz = 120.0;
/** The blend's step per sample: a kernel change fades over 21 ms at 48 kHz. */
constexpr double kBlendStep = 1.0 / 1024.0;

// New renderer state is always cleared at an inactive boundary, including
// legacy rooms; legacy source/bass histories have a separate version policy.
void reset_late_history(FeqRoom* room) {
  room->late.reset();
  std::fill(room->reflection_history.begin(), room->reflection_history.end(), 0.0f);
  room->reflection_cursor = 0;
}

/** CONTROL thread: free what the audio thread has put down. */
void sweep_retired(FeqRoom* room) {
  for (auto& slot : room->retired) {
    room_destroy_kernels(slot.exchange(nullptr, std::memory_order_acq_rel));
  }
}

// AUDIO only: a bounded scan, with a single producer. Between reservation
// and publish only control can change slots, and it can only make MORE space.
int retirement_capacity(const FeqRoom* room) {
  int available = 0;
  for (const auto& slot : room->retired)
    if (slot.load(std::memory_order_acquire) == nullptr) ++available;
  return available;
}
/** AUDIO thread; callers reserve sufficient slots before relinquishing sets. */
void retire(FeqRoom* room, FeqRoomKernels* set) {
  if (set == nullptr) {
    return;
  }
  for (auto& slot : room->retired) {
    if (slot.load(std::memory_order_acquire) == nullptr) {
      slot.store(set, std::memory_order_release);
      return;
    }
  }
  // Unreachable: audio is the sole producer, control only empties slots.
  std::terminate();
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
  // Audio can retire older sets while this control thread builds fresh.
  // Drain again after publication so the LAST update cannot remain blocked
  // behind those older owners forever when no further dial write arrives.
  sweep_retired(room);
}

/** Take a published set: the first is run, a later one is faded in. */
void adopt(FeqRoom* room) {
  // An adoption can retire at most live + next. Reserve first; never consume
  // the handoff when the bounded return channel cannot accept those owners.
  int needed = 2;
  // pending is audio-owned, so its precise retirement demand is inspectable.
  // This also lets the last handover target progress with one free slot.
  if (room->handoff.load(std::memory_order_acquire) == nullptr && room->pending != nullptr) {
    const bool outright = room->live == nullptr || !room->live->active ||
        !room->pending->active || room->live->split != room->pending->split;
    needed = (room->next != nullptr ? 1 : 0) + (outright && room->live != nullptr ? 1 : 0);
  }
  if (retirement_capacity(room) < needed) return;
  // A new publication may arrive after the precise pending check. If fewer
  // than two slots were reserved, leave it in handoff and adopt pending first.
  FeqRoomKernels* taken = nullptr;
  if (retirement_capacity(room) >= 2) taken = room->handoff.exchange(nullptr, std::memory_order_acq_rel);
  if (taken != nullptr && room->pending != nullptr) {
    // New control publication supersedes the audio-owned handover target.
    if (retirement_capacity(room) < 3) {
      // Keep the taken owner locally without republishing it to control.
      // One reserved slot accepts the older pending target first.
      retire(room, room->pending);
      room->pending = taken;
      return;
    }
    retire(room, room->pending);
    room->pending = nullptr;
  } else if (taken == nullptr) {
    taken = room->pending;
    room->pending = nullptr;
  }
  if (taken == nullptr) {
    return;
  }
  if (room->live == nullptr || !room->live->active || !taken->active ||
      room->live->split != taken->split) {
    // Nothing to fade from, or nothing to fade to: switch outright. A set
    // going inactive leaves the buffers untouched from this block, which is
    // the same switch every other stage makes when it is turned off. Game
    // mode going on or off is the same kind of switch: one set is a
    // partition later than the other, and a fade between them would sound
    // the same audio twice, a partition apart.
    const bool keep_late = room->live != nullptr && room->live->active && taken->active;
    const bool v2_transition = taken->renderer_version == 2 ||
        (room->live != nullptr && room->live->renderer_version == 2);
    retire(room, room->live);
    retire(room, room->next);
    room->live = taken;
    room->next = nullptr;
    room->blend = 1.0;
    // Inactive processing freezes histories. V2 must not replay old sends
    // or FIR source samples on re-enable; pure V1 retains its frozen legacy
    // bass/sub/upmix/FIR behavior. Use immutable metadata from BOTH sets.
    if (!keep_late) {
      if (v2_transition) feq_room_reset(room);
      else reset_late_history(room);
    }
    return;
  }
  // A replacement overtaken before its fade finished is dropped, not faded
  // from: it was never fully heard.
  retire(room, room->next);
  room->next = taken;
  room->blend = 0.0;
  room->warmup = 0;
  for (const auto& pair : taken->kernel) {
    for (const auto* kernel : pair) {
      if (kernel != nullptr) room->warmup = std::max(room->warmup,
          static_cast<int64_t>(feq_convolver_kernel_warmup(kernel)));
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
 *
 * `ramp` is the fade to `next` at each sample of this block, and null
 * while there is no fade: no replacement, or one still filling its
 * partitions. A speaker may stand in one set and not the other — muted or
 * opened by the very change being faded in — and then it fades against
 * silence: out of the live set, or into the next one. It used to play on at
 * full level until the sets were exchanged and stop there mid-wave, or not
 * run at all until the exchange and start there cold; either is a click on
 * every press of Mute or Solo.
 */
void render_source(FeqRoom* room, FeqRoomKernels* live, FeqRoomKernels* next,
                   uint32_t slot, const float* input, uint32_t frames,
                   float* const* mix, float* low_sum, const double* ramp) {
  const bool here = live->convolver[slot][0] != nullptr;
  const bool arriving = next != nullptr && next->convolver[slot][0] != nullptr;
  if (!here && !arriving) {
    return;
  }
  if (live->bass_management != 0) {
    float* band = room->band.data();
    std::copy(input, input + frames, band);
    // Its bass joins the sub's sum by as much as the speaker itself is
    // heard: by the fade where only one set has it, whole otherwise — and
    // not at all while a speaker only the next set has is still warming.
    if (ramp != nullptr && here != arriving) {
      for (uint32_t at = 0; at < frames; ++at) {
        const double heard = here ? 1.0 - ramp[at] : ramp[at];
        low_sum[at] +=
            static_cast<float>(static_cast<double>(input[at]) * heard);
      }
    } else if (here) {
      for (uint32_t at = 0; at < frames; ++at) {
        low_sum[at] += input[at];
      }
    }
    feq_biquad_process(&room->bass_high[slot][0], band, frames,
                       &live->crossover_high);
    feq_biquad_process(&room->bass_high[slot][1], band, frames,
                       &live->crossover_high);
    input = band;
  }
  // Pre-HRIR image-source send, after the same bass crossover as this source.
  // History is room-owned and preallocated; muted/unrouted slots are zeroed by
  // the caller each block. This cannot accidentally reverberate LFE or dry stereo.
  if (live->late.mix > 0 || (next != nullptr && next->late.mix > 0)) {
    const size_t length = room->reflection_length;
    float* history = room->reflection_history.data() + size_t(slot) * length;
    for (uint32_t at = 0; at < frames; ++at) {
      const size_t pos = (room->reflection_cursor + at) % length;
      history[pos] = input[at];
      double old_send = 0, new_send = 0;
      for (size_t tap = 0; tap < 4; ++tap) {
        const auto& old = live->reflections[slot][tap];
        old_send += history[(pos + length - old.delay) % length] * old.gain;
        if (next != nullptr) {
          const auto& fresh = next->reflections[slot][tap];
          new_send += history[(pos + length - fresh.delay) % length] * fresh.gain;
        }
      }
      room->reflection_send[at] += ramp != nullptr
          ? old_send + (new_send - old_send) * ramp[at] : old_send;
    }
  }
  // The block behind the head's reach of this source's history, so the
  // direct heads below can read back across the boundary. Both ears and both
  // sets read the same input, so it is laid out once — and kept up whether
  // or not game mode is on, so switching it on starts from the real past
  // rather than from whatever was there the last time it ran.
  const bool split = live->split != 0;
  const size_t reach = feq_convolver_head_taps() - 1u;
  float* const history =
      room->head_history.data() + static_cast<size_t>(slot) * reach;
  float* const laid = room->head_input.data();
  std::copy(history, history + reach, laid);
  std::copy(input, input + frames, laid + reach);
  for (int ear = 0; ear < 2; ++ear) {
    // What the live set makes of this source, and what the next one does:
    // silence from a set the speaker does not stand in. The replacement runs
    // from the moment it is adopted, heard or not, so its partitions are
    // full by the time the fade reaches it.
    float* copy = room->copy.data();
    float* const scratch = room->scratch.data();
    if (here) {
      std::copy(input, input + frames, copy);
      feq_convolve(live->convolver[slot][ear], copy, frames);
    } else {
      std::fill(copy, copy + frames, 0.0f);
    }
    if (arriving) {
      std::copy(input, input + frames, scratch);
      feq_convolve(next->convolver[slot][ear], scratch, frames);
    } else if (ramp != nullptr) {
      std::fill(scratch, scratch + frames, 0.0f);
    }
    if (ramp != nullptr) {
      // One walk for the block (`FeqRoom::fade`), so the two ears, every
      // speaker and the heads below cross over sample for sample.
      for (uint32_t at = 0; at < frames; ++at) {
        const double difference = static_cast<double>(scratch[at]) -
                                  static_cast<double>(copy[at]);
        copy[at] = static_cast<float>(static_cast<double>(copy[at]) +
                                      difference * ramp[at]);
      }
    }
    if (split) {
      // The kernel's first partition, on time, in front of the tail the
      // convolver just handed back. `adopt` never pairs a split set with a
      // whole one, so a replacement here is split too. A direct FIR has
      // nothing to warm: it reads the source's own history.
      float* const heard = room->head_live.data();
      if (here) {
        feq_convolver_head_run(live->head[slot][ear].data(), laid, heard,
                               frames);
      } else {
        std::fill(heard, heard + frames, 0.0f);
      }
      if (ramp != nullptr) {
        float* const incoming = room->head_next.data();
        if (arriving) {
          feq_convolver_head_run(next->head[slot][ear].data(), laid, incoming,
                                 frames);
        } else {
          std::fill(incoming, incoming + frames, 0.0f);
        }
        for (uint32_t at = 0; at < frames; ++at) {
          const double difference = static_cast<double>(incoming[at]) -
                                    static_cast<double>(heard[at]);
          heard[at] = static_cast<float>(static_cast<double>(heard[at]) +
                                         difference * ramp[at]);
        }
      }
      for (uint32_t at = 0; at < frames; ++at) {
        copy[at] += heard[at];
      }
    }
    float* into = mix[ear];
    for (uint32_t at = 0; at < frames; ++at) {
      into[at] += copy[at];
    }
  }
  // The newest reach of this source's input, for the next block's heads.
  std::copy(laid + frames, laid + frames + reach, history);
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
  settings->renderer_version = 1;
  settings->early_reflection_db = 0;
  settings->ambience_mix = 0;
  settings->ambience_decay_s = 0.5;
  settings->ambience_damping_hz = 6000;
  settings->preserve_position = 0;
  settings->compare_original = 0;
  settings->source_already_spatial = 0;
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
  if (!std::isfinite(sample_rate) || !(sample_rate > 0.0) ||
      sample_rate > 384000.0 || channels == 0 ||
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
  room->fade.assign(max_frames, 0.0);
  room->sub.assign(max_frames, 0.0f);
  room->band.assign(max_frames, 0.0f);
  room->feeds.assign(static_cast<size_t>(max_frames) * FEQ_ROOM_SPEAKERS, 0.0f);
  room->ambience_line.assign(
      static_cast<size_t>(std::lround(kRoomUpmixMaxDelaySeconds * sample_rate)) +
          max_frames,
      0.0f);
  // Sized whether or not game mode is ever used: switching it on is a
  // settings change, and a settings change may not allocate on the thread
  // that runs the audio.
  const size_t reach = feq_convolver_head_taps() - 1u;
  room->head_history.assign(reach * FEQ_ROOM_MAX_CHANNELS, 0.0f);
  room->head_input.assign(reach + max_frames, 0.0f);
  room->head_live.assign(max_frames, 0.0f);
  room->head_next.assign(max_frames, 0.0f);
  room->sub_bus.assign(max_frames, 0.0f);
  room->sub_line_buffer.assign(feq_convolver_latency() + 1u, 0.0f);
  feq_delay_line_init(&room->sub_line, room->sub_line_buffer.data(),
                      feq_convolver_latency() + 1u, feq_convolver_latency());
  room->late.prepare(sample_rate);
  room->comparison.prepare(max_frames);
  room->reflection_length = room_physical_taps(sample_rate) + feq_convolver_latency() + max_frames + 1u;
  room->reflection_history.assign(room->reflection_length * FEQ_ROOM_MAX_CHANNELS, 0.0f);
  room->reflection_send.assign(max_frames, 0.0);
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
  room_destroy_kernels(room->pending);
  sweep_retired(room);
  delete room;
}

void feq_room_set_head(FeqRoom* room, const float* left, const float* right,
                       uint32_t directions, uint32_t taps, int doubling) {
  if (room == nullptr) {
    return;
  }
  // Match the head parser limits before multiplication, allocation or indexing.
  if (directions > 72 || taps > 4096) return;
  if (left != nullptr && right != nullptr) {
    const size_t count = static_cast<size_t>(directions) * taps;
    for (size_t i = 0; i < count; ++i)
      if (!std::isfinite(left[i]) || !std::isfinite(right[i])) return;
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
  FeqRoomSettings safe = *settings;
  if (safe.renderer_version != 1 && safe.renderer_version != 2)
    safe.renderer_version = 1;
  // Native callers can bypass wire validation. Reject nonfinite legacy geometry
  // and gains before trigonometry, integer delay conversion or kernel indexing.
  if (!std::isfinite(safe.size_m) || !std::isfinite(safe.distance_m) ||
      !std::isfinite(safe.walls) || !std::isfinite(safe.head_scale) ||
      !std::isfinite(safe.centre_db) || !std::isfinite(safe.sub_db) ||
      !std::isfinite(safe.crossover_hz) || !std::isfinite(safe.upmix_amount)) return;
  if (safe.size_m < 2 || safe.size_m > 12 || safe.distance_m < 0.5 ||
      safe.distance_m > 6 || safe.head_scale < 0.5 || safe.head_scale > 2 ||
      std::fabs(safe.centre_db) > 60 || std::fabs(safe.sub_db) > 60) return;
  for (int i = 0; i < FEQ_ROOM_SPEAKERS; ++i) {
    if (!std::isfinite(safe.angle_deg[i]) || !std::isfinite(safe.level_db[i]) ||
        !std::isfinite(safe.speaker_distance_m[i]) ||
        std::fabs(safe.level_db[i]) > 60 || safe.speaker_distance_m[i] < 0 ||
        safe.speaker_distance_m[i] > 6) return;
    // V1 keeps its original valid-angle arithmetic and output samples.
    if (safe.renderer_version == 2) safe.angle_deg[i] = std::fmod(safe.angle_deg[i], 360.0);
  }
  auto bounded = [](double value, double low, double high, double fallback) {
    return std::isfinite(value) ? std::clamp(value, low, high) : fallback;
  };
  safe.early_reflection_db = bounded(safe.early_reflection_db, -60, 0, 0);
  safe.ambience_mix = bounded(safe.ambience_mix, 0, 1, 0);
  safe.ambience_decay_s = bounded(safe.ambience_decay_s, 0.1, 1.8, 0.5);
  safe.ambience_damping_hz = bounded(safe.ambience_damping_hz, 1000, 12000, 6000);
  room->settings = safe;
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
    room->comparison.reset();
    if (live && live->source_already_spatial)
      room->comparison.report.flags |= FEQ_ROOM_REPORT_SOURCE_BYPASS;
    return;
  }
  FeqRoomKernels* next = room->next;
  const FeqRoomKernels* comparison_set = next ? next : live;
  room->comparison.capture(room, comparison_set, channels, frames);
  std::fill(room->reflection_send.begin(), room->reflection_send.begin() + frames, 0.0);
  for (size_t slot = 0; slot < FEQ_ROOM_MAX_CHANNELS; ++slot)
    for (uint32_t at = 0; at < frames; ++at)
      room->reflection_history[slot * room->reflection_length +
        (room->reflection_cursor + at) % room->reflection_length] = 0;
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
  // Everything the room does not convolve, gathered here and delayed below
  // by what the convolution costs, so the bass lands with the rest of it.
  float* const bus = room->sub_bus.data();
  std::fill(bus, bus + frames, 0.0f);
  // The fade to the replacement, walked once for the block and for everyone
  // in it, whether or not any speaker stands in both sets: see
  // `FeqRoom::fade`. The same walk `feq_convolve_blend` makes.
  double blend_after = room->blend;
  const double* ramp = nullptr;
  if (next != nullptr && room->warmup <= 0) {
    double* const walk = room->fade.data();
    for (uint32_t at = 0; at < frames; ++at) {
      blend_after = blend_after + kBlendStep < 1.0 ? blend_after + kBlendStep
                                                   : 1.0;
      walk[at] = blend_after;
    }
    ramp = walk;
  }
  // The music upmix in either set. Switched on, the ring beyond the front
  // pair stands only in the replacement, and has to be fed from the moment
  // that is adopted — warmed, then faded in — rather than start cold at the
  // exchange; switched off, it stands only in the live set and fades out.
  // Both are stereo on the front pair, where a feed and its channel are the
  // same samples, so the fronts cross over as they always did.
  const FeqRoomKernels* const ring =
      live->upmix != 0 ? live
                       : (next != nullptr && next->upmix != 0 ? next : nullptr);
  if (ring != nullptr) {
    // Seven feeds from the pair, each through its own speaker. The fronts
    // are the pair itself; the centre is what both sides share; the side
    // signal, high-passed, goes to the sides a moment later and to the rears
    // later still and softer, each pair in opposite polarity. A mono record
    // makes no side signal and so no ambience.
    const float* left = channels[0];
    const float* right = channels[1];
    float* const feeds = room->feeds.data();
    const size_t stride = room->max_frames;
    float* const centre = feeds + 2 * stride;
    float* const side_left = feeds + 3 * stride;
    float* const side_right = feeds + 4 * stride;
    float* const rear_left = feeds + 5 * stride;
    float* const rear_right = feeds + 6 * stride;
    const auto centre_gain = static_cast<float>(ring->centre_gain * 0.5);
    float* const ambience = room->band.data();
    for (uint32_t at = 0; at < frames; ++at) {
      centre[at] = (left[at] + right[at]) * centre_gain;
      ambience[at] = (left[at] - right[at]) * 0.5f;
    }
    feq_biquad_process(&room->ambience_high[0], ambience, frames,
                       &ring->ambience_high);
    feq_biquad_process(&room->ambience_high[1], ambience, frames,
                       &ring->ambience_high);
    float* const line = room->ambience_line.data();
    const size_t length = room->ambience_line.size();
    const size_t cursor = room->ambience_cursor;
    for (uint32_t at = 0; at < frames; ++at) {
      line[(cursor + at) % length] = ambience[at];
    }
    const size_t side_back = length - (ring->side_frames % length);
    const size_t rear_back = length - (ring->rear_frames % length);
    const auto side_gain = static_cast<float>(ring->side_gain);
    const auto rear_gain = static_cast<float>(ring->rear_gain);
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
    feq_biquad_process(&room->rear_low[0], rear_left, frames, &ring->rear_low);
    feq_biquad_process(&room->rear_low[1], rear_left, frames, &ring->rear_low);
    for (uint32_t at = 0; at < frames; ++at) {
      rear_right[at] = -rear_left[at];
    }
    std::copy(left, left + frames, feeds);
    std::copy(right, right + frames, feeds + stride);
    for (uint32_t slot = 0; slot < FEQ_ROOM_SPEAKERS; ++slot) {
      render_source(room, live, next, slot, feeds + slot * stride, frames,
                    mix, low_sum, ramp);
    }
  } else {
    for (uint32_t channel = 0; channel < room->channels; ++channel) {
      const float* input = channels[channel];
      if (static_cast<int>(channel) == comparison_set->lfe_channel) {
        // Low-passed and to both ears alike: a subwoofer has no direction.
        // Its level — the sub's dial, or its mute — follows the same fade
        // as the speakers, or a mute would cut the bass mid-wave.
        double state = room->sub_state;
        const double coefficient = room->sub_coefficient;
        const double gain = live->sub_gain;
        const double towards = next != nullptr ? next->sub_gain : gain;
        for (uint32_t at = 0; at < frames; ++at) {
          state += coefficient * (static_cast<double>(input[at]) - state);
          const auto now = static_cast<float>(
              ramp != nullptr ? gain + (towards - gain) * ramp[at] : gain);
          bus[at] += static_cast<float>(state) * now;
        }
        room->sub_state = state;
        continue;
      }
      render_source(room, live, next, channel, input, frames, mix, low_sum,
                    ramp);
    }
  }
  if (managed) {
    feq_biquad_process(&room->bass_low[0], low_sum, frames,
                       &live->crossover_low);
    feq_biquad_process(&room->bass_low[1], low_sum, frames,
                       &live->crossover_low);
    for (uint32_t at = 0; at < frames; ++at) {
      bus[at] += low_sum[at];
    }
  }
  // Held back by exactly what the convolution just cost the rest: a
  // partition, or nothing under game mode's heads. See `sub_line`.
  room->sub_line.delay = live->split != 0 ? 0u : feq_convolver_latency();
  feq_delay_line_process(&room->sub_line, bus, frames);
  for (uint32_t at = 0; at < frames; ++at) {
    mix[0][at] += bus[at];
    mix[1][at] += bus[at];
  }
  for (uint32_t at = 0; at < frames; ++at) {
    RoomAmbienceParameters parameters = live->late;
    if (ramp != nullptr) {
      const auto& to = next->late;
      const double t = ramp[at];
      parameters.mix += (to.mix - parameters.mix) * t;
      parameters.damping += (to.damping - parameters.damping) * t;
      parameters.wall_damping += (to.wall_damping - parameters.wall_damping) * t;
      parameters.injection += (to.injection - parameters.injection) * t;
      for (size_t i = 0; i < 4; ++i)
        parameters.feedback[i] += (to.feedback[i] - parameters.feedback[i]) * t;
    }
    room->late.tick(room->reflection_send[at], parameters, mix[0][at], mix[1][at]);
    if (room->handover_gain < 1) {
      room->handover_gain = std::min(1.0, room->handover_gain + 1.0 / (0.021 * room->sample_rate));
      mix[0][at] *= static_cast<float>(room->handover_gain);
      mix[1][at] *= static_cast<float>(room->handover_gain);
    }
  }
  room->reflection_cursor = (room->reflection_cursor + frames) % room->reflection_length;
  if (next != nullptr && room->warmup > 0) {
    room->warmup -= static_cast<int64_t>(frames);
  } else if (next != nullptr) {
    room->blend = blend_after;
    if (blend_after >= 1.0 && retirement_capacity(room) >= 1) {
      retire(room, room->live);
      room->live = next;
      room->next = nullptr;
      room->blend = 1.0;
    }
  }
  room->comparison.process(room, comparison_set, frames, next == nullptr);
  std::copy(mix[0], mix[0] + frames, channels[0]);
  std::copy(mix[1], mix[1] + frames, channels[1]);
  for (uint32_t channel = 2; channel < room->channels; ++channel) {
    std::fill(channels[channel], channels[channel] + frames, 0.0f);
  }
}

void feq_room_report(const FeqRoom* room, FeqRoomReport* out) {
  if (out)
    *out =
        room ? room->comparison.report : FeqRoomReport{FEQ_ROOM_REPORT_TAG, 0};
}
int feq_room_position_protected(const FeqRoom* room) {
  return room &&
         (room->comparison.report.flags & FEQ_ROOM_REPORT_PROTECTED) != 0;
}
int feq_room_active(const FeqRoom* room) {
  return room == nullptr ? 0 : room->active.load(std::memory_order_acquire);
}

uint32_t feq_room_latency_frames(const FeqRoom* room) {
  // Game mode's heads put the kernel's first partition out on time, so the
  // room adds nothing of its own: see `feq_convolver_head_run`.
  return feq_room_active(room) != 0 && !room->low_latency
             ? feq_convolver_latency()
             : 0u;
}

void feq_room_set_low_latency(FeqRoom* room, int on) {
  if (room == nullptr) {
    return;
  }
  // Read by the next `room_build_kernels`, which `feq_room_configure`
  // publishes — and the chain configures the room on every change, right
  // after this.
  room->low_latency = on != 0;
}

void feq_room_transfer(FeqRoom* prepared, FeqRoom* previous) {
  if (prepared == nullptr || previous == nullptr || prepared == previous) return;
  if (prepared->sample_rate != previous->sample_rate ||
      prepared->channels != previous->channels ||
      prepared->max_frames != previous->max_frames) {
    // Different formats cannot share delay histories. The fresh graph fades
    // in; the old graph remains wholly owned by its control-thread destroyer.
    prepared->handover_gain = 0;
    return;
  }
  // Whatever the previous room was handed and has not run yet is newer than
  // its live set and older than the prepared room's: take it now, so the
  // tail carried over is the latest one heard.
  adopt(previous);
  if (previous->live == nullptr) {
    return;
  }
  // A fresh graph keeps its published/pending target. If it was already
  // primed and has neither, retain its newest audio-owned set as that target.
  // Only test handoff for null here; control may publish concurrently, but
  // only audio removes from handoff, so no published pointer is dereferenced.
  if (prepared->handoff.load(std::memory_order_acquire) == nullptr &&
      prepared->pending == nullptr) {
    if (prepared->next != nullptr) {
      prepared->pending = prepared->next;
      prepared->next = nullptr;
    } else {
      prepared->pending = prepared->live;
      prepared->live = nullptr;
    }
    if (prepared->pending == nullptr) return;
  }
  // Exchange ownership instead of retiring displaced prepared state. The
  // outgoing graph's existing live/next fields are the bounded destination
  // for those owners and its control-thread destructor reclaims them. This
  // works even when BOTH retirement queues are full: no new owner or return
  // slot is needed. Published and pending targets remain with their rooms.
  // Full slots may backpressure target adoption, but never interrupt the
  // exact live audio and in-progress fade carried across this handover.
  using std::swap;
  swap(prepared->live, previous->live);
  swap(prepared->next, previous->next);
  swap(prepared->blend, previous->blend);
  swap(prepared->warmup, previous->warmup);
  swap(prepared->handover_gain, previous->handover_gain);
  swap(prepared->comparison, previous->comparison);
  swap(prepared->sub_state, previous->sub_state);
  prepared->late.swap_history(previous->late);
  prepared->reflection_history.swap(previous->reflection_history);
  swap(prepared->reflection_cursor, previous->reflection_cursor);
  for (uint32_t channel = 0; channel < FEQ_ROOM_MAX_CHANNELS; ++channel) {
    swap(prepared->bass_high[channel][0], previous->bass_high[channel][0]);
    swap(prepared->bass_high[channel][1], previous->bass_high[channel][1]);
  }
  swap(prepared->bass_low[0], previous->bass_low[0]);
  swap(prepared->bass_low[1], previous->bass_low[1]);
  swap(prepared->ambience_high[0], previous->ambience_high[0]);
  swap(prepared->ambience_high[1], previous->ambience_high[1]);
  swap(prepared->rear_low[0], previous->rear_low[0]);
  swap(prepared->rear_low[1], previous->rear_low[1]);
  prepared->ambience_line.swap(previous->ambience_line);
  swap(prepared->ambience_cursor, previous->ambience_cursor);
  prepared->head_history.swap(previous->head_history);
  prepared->sub_line_buffer.swap(previous->sub_line_buffer);
  // The delay-line pointers move with their corresponding vector storage.
  swap(prepared->sub_line, previous->sub_line);

}

void feq_room_reset_route(FeqRoom* room) {
  if (room == nullptr) return;
  feq_room_reset(room);
  // A source/route reset must clear the delayed direct path as well as the
  // ambience/reference. Only touch audio-owned sets, never the control handoff.
  for (auto* set : {room->live, room->next, room->pending}) {
    if (set == nullptr) continue;
    for (auto& channel : set->convolver)
      for (auto* convolver : channel) feq_convolver_reset(convolver);
  }
}

void feq_room_reset(FeqRoom* room) {
  if (room == nullptr) {
    return;
  }
  reset_late_history(room);
  // Reset learning and delay, not the selected A/B position: fading from wet
  // again would expose the legacy convolver tail during an Original seek.
  const double comparison_blend=room->comparison.blend;
  room->comparison.reset();
  room->comparison.blend=comparison_blend;
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
  std::fill(room->head_history.begin(), room->head_history.end(), 0.0f);
  std::fill(room->sub_line_buffer.begin(), room->sub_line_buffer.end(), 0.0f);
}

}  // extern "C"
