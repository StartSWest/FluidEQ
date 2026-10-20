/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "meters_eq_live.h"

#include <algorithm>
#include <cmath>

#include "fluideq/meters.h"
#include "meters_transform.h"

namespace {

/** Twice the long window: the margin a copy has before it can be torn. */
constexpr uint64_t kRingFrames = 2ull * FEQ_METER_DETAIL_WINDOW;
constexpr uint64_t kRingMask = kRingFrames - 1;
static_assert((kRingFrames & kRingMask) == 0, "the ring must be a power of two");

/**
 * The most reads of each window a second.
 *
 * For the short one, any block of audio is a new picture. Audio arrives in
 * blocks — 10 ms in shared mode, 528 frames over Bluetooth — and a page
 * polling at 60 Hz finds one block or two since its last look; a floor above
 * a block's length tells some of those polls that nothing is new, and the
 * picture stutters. At a ninetieth of a second, 480-frame blocks and a 60 Hz
 * poll gave a fresh window on 320 polls of 480 (`eq_live_probe`). The 240 is
 * there only to cap a host that pushes a frame on every block of a tiny
 * period.
 *
 * Forty at most for the long one, whose transform is eight times the size —
 * every other poll of a 60 Hz page, thirty a second (a floor of thirty fell
 * between 10 ms blocks and gave twenty). Its shape moves slowly — a third of
 * a second of audio at 48 kHz — and the graph takes its timing from the short
 * window, as the main graph's does (`liveGraphBand.ts`). That keeps the long
 * window near one percent of a core: about a million cycles a transform,
 * measured on Ivan's i9-14900HX.
 */
constexpr double kShortReadsPerSecond = 240.0;
constexpr double kLongReadsPerSecond = 40.0;

uint64_t frames_between_reads(double sample_rate, double per_second) {
  const double frames = sample_rate / per_second;
  return frames >= 1.0 ? static_cast<uint64_t>(frames) : 1u;
}

int read_window(EqLiveWindow& live,
                uint32_t size,
                const std::vector<double>& window,
                uint64_t hop,
                uint64_t& last_read,
                uint32_t bins,
                float* out_db) {
  const uint64_t end = live.written.load(std::memory_order_acquire);
  if (end - last_read < hop) {
    return 0;
  }
  const auto from =
      static_cast<int64_t>(live.valid_from.load(std::memory_order_acquire));
  for (uint32_t at = 0; at < size; at += 1) {
    const int64_t frame = static_cast<int64_t>(end) - size + at;
    // Before this listening, or before anything was captured at all.
    const bool heard = frame >= from;
    const auto slot = static_cast<uint64_t>(frame) & kRingMask;
    live.real[at] = heard ? live.left[slot] * window[at] : 0.0;
    live.imaginary[at] = heard ? live.right[slot] * window[at] : 0.0;
  }
  // The copy's loads complete before the count is read again.
  std::atomic_thread_fence(std::memory_order_acquire);
  const uint64_t after = live.written.load(std::memory_order_relaxed);
  if (after - end > kRingFrames - size) {
    return 0;
  }
  meter_two_channel_magnitudes(live.real.data(), live.imaginary.data(), size,
                               bins, live.magnitudes.data());
  for (uint32_t bin = 0; bin < bins; bin += 1) {
    out_db[bin] = static_cast<float>(
        20.0 * std::log10(std::fmax(live.magnitudes[bin],
                                    kMeterMagnitudeFloor)));
  }
  last_read = end;
  return 1;
}

}  // namespace

static_assert(FEQ_METER_DETAIL_BINS <= FEQ_METER_DETAIL_WINDOW / 2,
              "the long window has only half its size in bins");

EqLiveWindow::EqLiveWindow()
    : left(kRingFrames, 0.0f),
      right(kRingFrames, 0.0f),
      short_window(meter_blackman(FEQ_METER_WINDOW)),
      long_window(meter_blackman(FEQ_METER_DETAIL_WINDOW)),
      real(FEQ_METER_DETAIL_WINDOW, 0.0),
      imaginary(FEQ_METER_DETAIL_WINDOW, 0.0),
      magnitudes((std::max)(FEQ_METER_BINS, FEQ_METER_DETAIL_BINS), 0.0) {}

void eq_live_capture(EqLiveWindow& live,
                     const float* left,
                     const float* right,
                     uint32_t frames) {
  uint64_t at = live.written.load(std::memory_order_relaxed);
  for (uint32_t index = 0; index < frames; index += 1, at += 1) {
    live.left[at & kRingMask] = left[index];
    live.right[at & kRingMask] = right[index];
  }
  live.written.store(at, std::memory_order_release);
}

void eq_live_restart(EqLiveWindow& live) {
  live.valid_from.store(live.written.load(std::memory_order_acquire),
                        std::memory_order_release);
}

int eq_live_read_short(EqLiveWindow& live, double sample_rate, float* out_db) {
  return read_window(live, FEQ_METER_WINDOW, live.short_window,
                     frames_between_reads(sample_rate, kShortReadsPerSecond),
                     live.short_read, FEQ_METER_BINS, out_db);
}

int eq_live_read_long(EqLiveWindow& live, double sample_rate, float* out_db) {
  return read_window(live, FEQ_METER_DETAIL_WINDOW, live.long_window,
                     frames_between_reads(sample_rate, kLongReadsPerSecond),
                     live.long_read, FEQ_METER_DETAIL_BINS, out_db);
}
