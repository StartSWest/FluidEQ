/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/crossfade.h"

#include <cmath>
#include <limits>

extern "C" {

double feq_crossfade_gain(FeqCrossfadeCurve curve,
                          double progress,
                          int incoming) {
  double unit = progress;
  if (!(unit > 0.0)) {
    // Written as a failed greater-than so that a NaN progress lands on zero
    // rather than propagating into the gain and silencing both decks.
    unit = 0.0;
  } else if (unit > 1.0) {
    unit = 1.0;
  }

  if (curve == FEQ_CROSSFADE_LINEAR) {
    return incoming != 0 ? unit : 1.0 - unit;
  }
  if (curve == FEQ_CROSSFADE_SMOOTH) {
    const double smooth = unit * unit * (3.0 - 2.0 * unit);
    return incoming != 0 ? smooth : 1.0 - smooth;
  }

  const double incoming_power = std::sin((unit * 3.14159265358979323846) / 2.0);
  const double outgoing_power = std::cos((unit * 3.14159265358979323846) / 2.0);
  double unity_sum = incoming_power + outgoing_power;
  // `Number.EPSILON` in the reference, which is the double's, not the float's.
  const double floor_value = std::numeric_limits<double>::epsilon();
  if (unity_sum < floor_value) {
    unity_sum = floor_value;
  }
  return (incoming != 0 ? incoming_power : outgoing_power) / unity_sum;
}

double feq_crossfade_table_gain(const FeqCrossfadeTable* table,
                                double progress,
                                int incoming) {
  if (table == nullptr) {
    return incoming != 0 ? 1.0 : 0.0;
  }
  double unit = progress;
  if (!(unit > 0.0)) {
    unit = 0.0;
  } else if (unit > 1.0) {
    unit = 1.0;
  }

  const float* side = incoming != 0 ? table->incoming : table->outgoing;
  const double last = static_cast<double>(FEQ_CROSSFADE_TABLE_POINTS - 1);
  const double scaled = unit * last;
  double floor_index = std::floor(scaled);
  if (floor_index > last - 1.0) {
    floor_index = last - 1.0;
  }
  const auto lower = static_cast<int>(floor_index);
  const double fraction = scaled - floor_index;

  /**
   * Interpolated rather than nearest: a 64-point table stepped across a
   * two-second fade changes value every 31ms, which is a staircase of 64
   * discontinuities — the same zippering the per-sample gain exists to avoid.
   */
  const double from = static_cast<double>(side[lower]);
  const double to = static_cast<double>(side[lower + 1]);
  return from + (to - from) * fraction;
}

static void copy_table(FeqCrossfadeTable* to, const FeqCrossfadeTable* from) {
  for (int at = 0; at < FEQ_CROSSFADE_TABLE_POINTS; ++at) {
    to->outgoing[at] = from->outgoing[at];
    to->incoming[at] = from->incoming[at];
  }
}

void feq_crossfader_init(FeqCrossfader* state) {
  if (state == nullptr) {
    return;
  }
  state->curve = FEQ_CROSSFADE_EQUAL_POWER;
  state->duration_frames = 0;
  state->elapsed_frames = 0;
  state->active = 0;
  /**
   * Equal power, so a Custom fade that somehow starts before a shape has
   * arrived is a normal-sounding fade rather than silence on both decks.
   */
  for (int at = 0; at < FEQ_CROSSFADE_TABLE_POINTS; ++at) {
    const double unit =
        static_cast<double>(at) / (FEQ_CROSSFADE_TABLE_POINTS - 1);
    state->table.outgoing[at] = static_cast<float>(
        feq_crossfade_gain(FEQ_CROSSFADE_EQUAL_POWER, unit, 0));
    state->table.incoming[at] = static_cast<float>(
        feq_crossfade_gain(FEQ_CROSSFADE_EQUAL_POWER, unit, 1));
  }
  copy_table(&state->pending, &state->table);
}

void feq_crossfader_set_table(FeqCrossfader* state,
                              const FeqCrossfadeTable* table) {
  if (state == nullptr || table == nullptr) {
    return;
  }
  copy_table(&state->pending, table);
  if (state->active == 0) {
    // Nothing is reading the live table, so the shape can take effect now
    // rather than waiting for a fade to start and end first.
    copy_table(&state->table, table);
  }
}

void feq_crossfader_start(FeqCrossfader* state,
                          FeqCrossfadeCurve curve,
                          uint64_t duration_frames) {
  if (state == nullptr) {
    return;
  }
  /**
   * A fade started while one is running keeps its place on the curve.
   *
   * Zeroing the counter would put the outgoing deck back to unity, which is a
   * step up to full level in the middle of a fade — audible as a thump every
   * time the queue is skipped twice inside one overlap. The elapsed FRACTION
   * carries over instead, so the gain is continuous when the curve is
   * unchanged and close to continuous when it is not, all three curves being
   * monotonic over the same span.
   */
  const double carried =
      state->active != 0 ? feq_crossfader_progress(state) : 0.0;
  if (state->active == 0) {
    // The only moment the live table may be replaced: the audio thread reads
    // it for the whole length of a fade, and a restart mid-fade keeps its
    // place on the curve it is already running.
    copy_table(&state->table, &state->pending);
  }
  state->curve = curve;
  state->duration_frames = duration_frames;
  state->elapsed_frames =
      static_cast<uint64_t>(carried * static_cast<double>(duration_frames));
  state->active = duration_frames > 0 ? 1 : 0;
}

void feq_crossfader_mix(FeqCrossfader* state,
                        const float* const* outgoing,
                        const float* const* incoming,
                        float* const* out,
                        uint32_t channels,
                        uint32_t frames) {
  if (state == nullptr || out == nullptr || frames == 0) {
    return;
  }

  /**
   * A finished fade keeps mixing, at pure incoming.
   *
   * Only an unconfigured fader copies the outgoing deck through. Once one has
   * run, falling back to that copy would swap the audible deck back to the
   * track that just faded out, for however many blocks passed before the
   * caller got round to promoting the incoming one. The audio is correct
   * whether the caller promotes on the next block or ten blocks later; `active`
   * is how it learns that it may.
   */
  if (state->duration_frames == 0) {
    if (outgoing == nullptr) {
      return;
    }
    for (uint32_t channel = 0; channel < channels; ++channel) {
      if (outgoing[channel] == nullptr || out[channel] == nullptr) {
        continue;
      }
      if (out[channel] != outgoing[channel]) {
        for (uint32_t at = 0; at < frames; ++at) {
          out[channel][at] = outgoing[channel][at];
        }
      }
    }
    return;
  }

  /**
   * The gain is recomputed per sample, and the counter advances once per frame
   * across every channel — not once per sample per channel.
   *
   * Advancing inside a channel loop would run the fade twice as fast in stereo
   * and put the two channels on different points of the curve, which is a fade
   * that swings the image across the room as it goes.
   */
  const double duration = static_cast<double>(state->duration_frames);
  uint64_t elapsed = state->elapsed_frames;
  for (uint32_t at = 0; at < frames; ++at) {
    const double progress = static_cast<double>(elapsed) / duration;
    const int custom = state->curve == FEQ_CROSSFADE_CUSTOM ? 1 : 0;
    const double out_gain =
        custom != 0 ? feq_crossfade_table_gain(&state->table, progress, 0)
                    : feq_crossfade_gain(state->curve, progress, 0);
    const double in_gain =
        custom != 0 ? feq_crossfade_table_gain(&state->table, progress, 1)
                    : feq_crossfade_gain(state->curve, progress, 1);
    for (uint32_t channel = 0; channel < channels; ++channel) {
      if (out[channel] == nullptr) {
        continue;
      }
      const double from = outgoing != nullptr && outgoing[channel] != nullptr
                              ? static_cast<double>(outgoing[channel][at])
                              : 0.0;
      const double to = incoming != nullptr && incoming[channel] != nullptr
                            ? static_cast<double>(incoming[channel][at])
                            : 0.0;
      out[channel][at] = static_cast<float>(from * out_gain + to * in_gain);
    }
    if (elapsed < state->duration_frames) {
      ++elapsed;
    }
  }
  state->elapsed_frames = elapsed;
  if (elapsed >= state->duration_frames) {
    state->active = 0;
  }
}

double feq_crossfader_progress(const FeqCrossfader* state) {
  if (state == nullptr || state->duration_frames == 0 || state->active == 0) {
    return 1.0;
  }
  const double progress = static_cast<double>(state->elapsed_frames) /
                          static_cast<double>(state->duration_frames);
  return progress > 1.0 ? 1.0 : progress;
}

}  // extern "C"
