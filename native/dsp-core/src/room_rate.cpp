/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "room_rate.h"

#include <algorithm>
#include <cmath>
#include <utility>

#include "room_internal.h"

namespace {

constexpr double kPi = 3.14159265358979323846;
// How far down everything that would fold into the heard band is.
constexpr double kStopbandDb = 100.0;
// The flat band's edge. The stopband starts where an image of that edge
// lands, the room's rate less it, so the transition is the gap between the
// two: at a 44.1 kHz room the narrowest there is, at 96 kHz six times wider
// and the filter six times shorter (277 taps at 384 kHz became 45).
constexpr double kAudibleHz = 20000.0;
// Partial sums each filter runs over. A single running sum waits on its own
// last addition at every tap, and the converter then cost a stereo 384 kHz
// output 0.40 ms of every 10 ms block on a performance core.
constexpr uint32_t kLanes = 8;

/** The zeroth-order modified Bessel function, the Kaiser window's own. */
double bessel_i0(double x) {
  double sum = 1.0;
  double term = 1.0;
  const double half = 0.5 * x;
  for (int k = 1; k < 64; ++k) {
    term *= (half / k) * (half / k);
    sum += term;
    if (term < 1e-12 * sum) {
      break;
    }
  }
  return sum;
}

/** `count` products of `a` and `b`, summed. */
float dot(const float* a, const float* b, uint32_t count) {
  float lane[kLanes] = {};
  uint32_t at = 0;
  for (; at + kLanes <= count; at += kLanes) {
    for (uint32_t j = 0; j < kLanes; ++j) {
      lane[j] += a[at + j] * b[at + j];
    }
  }
  float sum = 0.0f;
  for (; at < count; ++at) {
    sum += a[at] * b[at];
  }
  for (const float part : lane) {
    sum += part;
  }
  return sum;
}

/**
 * The symmetric filter over one window seen from both ends: the two samples
 * a tap pair weighs are added first, so it takes half the products.
 */
float folded(const float* kernel, const float* oldest_first,
             const float* newest_first, uint32_t half) {
  float lane[kLanes] = {};
  uint32_t at = 0;
  for (; at + kLanes <= half; at += kLanes) {
    for (uint32_t j = 0; j < kLanes; ++j) {
      lane[j] += kernel[at + j] * (oldest_first[at + j] + newest_first[at + j]);
    }
  }
  float sum = kernel[half] * oldest_first[half];
  for (; at < half; ++at) {
    sum += kernel[at] * (oldest_first[at] + newest_first[at]);
  }
  for (const float part : lane) {
    sum += part;
  }
  return sum;
}

}  // namespace

void RoomRate::prepare(double room_rate, uint32_t factor, uint32_t channels,
                       uint32_t max_frames) {
  if ((factor != 2 && factor != 4 && factor != 8) || channels == 0 ||
      max_frames == 0 || !(room_rate > 2.0 * kAudibleHz)) {
    *this = RoomRate();
    return;
  }
  factor_ = factor;
  channels_ = channels;

  // Kaiser's estimate for the length, from the transition in cycles per
  // stream sample: the room's rate less twice the flat band, over the
  // stream's rate.
  const double width = (room_rate - 2.0 * kAudibleHz) / (room_rate * factor);
  const double beta = 0.1102 * (kStopbandDb - 8.7);
  auto taps = static_cast<uint32_t>(
                  std::ceil((kStopbandDb - 7.95) / (2.285 * 2.0 * kPi * width))) +
              1u;
  if (taps % 2u == 0u) {
    ++taps;
  }
  taps_ = taps;

  // Cut at the room's Nyquist, the middle of the transition; normalised to
  // unity at DC so the decimator neither lifts nor drops the level. One half
  // is designed and mirrored, so the folded sum is the filter exactly.
  const double cutoff = 0.5 / factor;
  const uint32_t half = (taps_ - 1u) / 2u;
  const double norm = bessel_i0(beta);
  std::vector<double> exact(taps_);
  for (uint32_t n = 0; n <= half; ++n) {
    const double t = static_cast<double>(half) - n;
    const double sinc =
        n == half ? 2.0 * cutoff : std::sin(2.0 * kPi * cutoff * t) / (kPi * t);
    const double ratio = t / half;
    const double window =
        bessel_i0(beta * std::sqrt(std::max(0.0, 1.0 - ratio * ratio))) / norm;
    exact[n] = sinc * window;
    exact[taps_ - 1u - n] = exact[n];
  }
  double sum = 0.0;
  for (const double tap : exact) {
    sum += tap;
  }
  kernel_.assign(taps_, 0.0f);
  for (uint32_t n = 0; n < taps_; ++n) {
    kernel_[n] = static_cast<float>(exact[n] / sum);
  }

  // The same filter, one phase per output sample between two room samples,
  // each scaled by the factor — the energy the zeros between them took away —
  // and stored back to front, so a phase meets the oldest sample first.
  phase_taps_ = (taps_ + factor_ - 1u) / factor_;
  phases_.assign(static_cast<size_t>(factor_) * phase_taps_, 0.0f);
  for (uint32_t q = 0; q < factor_; ++q) {
    for (uint32_t i = 0; i < phase_taps_; ++i) {
      const uint32_t n = q + i * factor_;
      if (n < taps_) {
        phases_[static_cast<size_t>(q) * phase_taps_ + (phase_taps_ - 1u - i)] =
            static_cast<float>(factor_ * exact[n] / sum);
      }
    }
  }

  max_room_frames_ = max_frames / factor_ + 2u;
  in_ring_.assign(static_cast<size_t>(channels_) * 2u * taps_, 0.0f);
  in_mirror_.assign(in_ring_.size(), 0.0f);
  ear_ring_.assign(static_cast<size_t>(2u) * 2u * phase_taps_, 0.0f);
  // What one block can leave behind (the factor less one) and the most one
  // call can make, a factor's worth for each room frame.
  pending_capacity_ = factor_ + factor_ * max_room_frames_;
  pending_.assign(static_cast<size_t>(2u) * pending_capacity_, 0.0f);
  reset();
}

uint32_t RoomRate::decimate(const float* const* in, uint32_t frames,
                            float* const* room) {
  if (factor_ == 0u) {
    return 0u;
  }
  uint32_t produced = 0;
  const size_t span = 2u * static_cast<size_t>(taps_);
  const uint32_t half = (taps_ - 1u) / 2u;
  for (uint32_t at = 0; at < frames; ++at) {
    // Each history twice over and each also back to front: the newest
    // `taps_` samples always sit contiguously, oldest first in one and
    // newest first in the other, so no inner loop wraps or runs backwards.
    in_mirror_cursor_ = in_mirror_cursor_ == 0u ? taps_ - 1u : in_mirror_cursor_ - 1u;
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      const float sample = in[channel][at];
      float* ring = in_ring_.data() + channel * span;
      ring[in_cursor_] = sample;
      ring[in_cursor_ + taps_] = sample;
      float* mirror = in_mirror_.data() + channel * span;
      mirror[in_mirror_cursor_] = sample;
      mirror[in_mirror_cursor_ + taps_] = sample;
    }
    in_cursor_ = in_cursor_ + 1u == taps_ ? 0u : in_cursor_ + 1u;
    if (++in_phase_ < factor_) {
      continue;
    }
    in_phase_ = 0;
    for (uint32_t channel = 0; channel < channels_; ++channel) {
      room[channel][produced] =
          folded(kernel_.data(), in_ring_.data() + channel * span + in_cursor_,
                 in_mirror_.data() + channel * span + in_mirror_cursor_, half);
    }
    ++produced;
  }
  return produced;
}

void RoomRate::interpolate(const float* const* room, uint32_t room_frames,
                           float* const* out, uint32_t frames) {
  if (factor_ == 0u) {
    return;
  }
  const size_t span = 2u * static_cast<size_t>(phase_taps_);
  for (uint32_t at = 0; at < room_frames; ++at) {
    for (uint32_t ear = 0; ear < 2u; ++ear) {
      float* ring = ear_ring_.data() + ear * span;
      ring[ear_cursor_] = room[ear][at];
      ring[ear_cursor_ + phase_taps_] = room[ear][at];
    }
    ear_cursor_ = ear_cursor_ + 1u == phase_taps_ ? 0u : ear_cursor_ + 1u;
    for (uint32_t ear = 0; ear < 2u; ++ear) {
      const float* window = ear_ring_.data() + ear * span + ear_cursor_;
      float* made = pending_.data() + ear * static_cast<size_t>(pending_capacity_) +
                    pending_size_;
      for (uint32_t q = 0; q < factor_; ++q) {
        made[q] = dot(phases_.data() + static_cast<size_t>(q) * phase_taps_,
                      window, phase_taps_);
      }
    }
    pending_size_ += factor_;
  }
  // Primed with the decimator's phase, the pending samples always cover a
  // block; the guard only keeps a caller's broken promise from reading past
  // what is there. What is left — never more than the factor less one —
  // moves to the front for the next block.
  const uint32_t ready = std::min(frames, pending_size_);
  for (uint32_t ear = 0; ear < 2u; ++ear) {
    float* pending = pending_.data() + ear * static_cast<size_t>(pending_capacity_);
    std::copy(pending, pending + ready, out[ear]);
    std::fill(out[ear] + ready, out[ear] + frames, 0.0f);
    std::copy(pending + ready, pending + pending_size_, pending);
  }
  pending_size_ -= ready;
}

void RoomRate::reset() noexcept {
  std::fill(in_ring_.begin(), in_ring_.end(), 0.0f);
  std::fill(in_mirror_.begin(), in_mirror_.end(), 0.0f);
  std::fill(ear_ring_.begin(), ear_ring_.end(), 0.0f);
  std::fill(pending_.begin(), pending_.end(), 0.0f);
  in_cursor_ = 0;
  in_mirror_cursor_ = 0;
  in_phase_ = 0;
  ear_cursor_ = 0;
  // Primed with what the decimator holds back: the factor less one, so a
  // block that is not a multiple of the factor never runs short, and the
  // delay comes out at the filter's length less one exactly.
  pending_size_ = factor_ == 0u ? 0u : factor_ - 1u;
}

void RoomRate::swap_state(RoomRate& other) noexcept {
  if (factor_ != other.factor_ || channels_ != other.channels_ ||
      taps_ != other.taps_ || pending_capacity_ != other.pending_capacity_) {
    return;
  }
  using std::swap;
  in_ring_.swap(other.in_ring_);
  in_mirror_.swap(other.in_mirror_);
  ear_ring_.swap(other.ear_ring_);
  pending_.swap(other.pending_);
  swap(in_cursor_, other.in_cursor_);
  swap(in_mirror_cursor_, other.in_mirror_cursor_);
  swap(in_phase_, other.in_phase_);
  swap(ear_cursor_, other.ear_cursor_);
  swap(pending_size_, other.pending_size_);
}

void room_prepare_rate(FeqRoom* room, uint32_t channels, double* sample_rate,
                       uint32_t* max_frames) {
  room->stream_rate = *sample_rate;
  room->stream_max_frames = *max_frames;
  int doubling = 0;
  const double head_rate = feq_room_head_rate(*sample_rate, &doubling);
  if (head_rate <= 0.0 || doubling != 0 || head_rate == *sample_rate) {
    return;
  }
  room->rate.prepare(head_rate,
                     static_cast<uint32_t>(std::lround(*sample_rate / head_rate)),
                     channels, *max_frames);
  if (room->rate.factor() == 0u) {
    return;
  }
  *sample_rate = head_rate;
  *max_frames = room->rate.max_room_frames();
  room->rate_buffers.assign(static_cast<size_t>(channels) * *max_frames, 0.0f);
  room->rate_planes.resize(channels);
  for (uint32_t channel = 0; channel < channels; ++channel) {
    room->rate_planes[channel] =
        room->rate_buffers.data() + static_cast<size_t>(channel) * *max_frames;
  }
}

void room_process_resampled(FeqRoom* room, float* const* channels,
                            uint32_t frames) {
  if (frames > room->stream_max_frames) {
    return;
  }
  if (!room_ready(room)) {
    // A room that renders nothing leaves the output untouched, as at every
    // rate; the converter starts clean when it renders again, rather than
    // replaying the last of whatever played before it stopped.
    room->rate_running = false;
    return;
  }
  if (!room->rate_running) {
    room->rate.reset();
    room->rate_running = true;
  }
  float* const* planes = room->rate_planes.data();
  const uint32_t room_frames = room->rate.decimate(channels, frames, planes);
  if (room_frames > 0u) {
    room_render(room, planes, room_frames);
  }
  room->rate.interpolate(planes, room_frames, channels, frames);
  for (uint32_t channel = 2; channel < room->channels; ++channel) {
    std::fill(channels[channel], channels[channel] + frames, 0.0f);
  }
}

extern "C" {

double feq_room_head_rate(double stream_rate, int* doubling) {
  if (doubling != nullptr) {
    *doubling = 0;
  }
  if (stream_rate == 44100.0 || stream_rate == 48000.0 ||
      stream_rate == 96000.0) {
    return stream_rate;
  }
  if (stream_rate == 192000.0) {
    if (doubling != nullptr) {
      *doubling = 1;
    }
    return 96000.0;
  }
  if (stream_rate == 88200.0 || stream_rate == 176400.0 ||
      stream_rate == 352800.0) {
    return 44100.0;
  }
  if (stream_rate == 384000.0) {
    return 96000.0;
  }
  return 0.0;
}

}  // extern "C"
