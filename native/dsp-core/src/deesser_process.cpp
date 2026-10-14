/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's audio side: listen ahead, hand the control tick what it
 * heard (`deesser_decide.cpp`), and cut on the delayed audio. See `deesser.h`
 * for what it listens for.
 *
 * Real-time safe: no allocation, no lock, no system call. The per-sample work
 * is biquads and multiplies; the logarithms run at the control tick, and the
 * gains between ticks are interpolated sample by sample so a cut never steps.
 */
#include "deesser_internal.h"

namespace feq_deesser {
namespace {

/** A band's power over 1.5 ms: what its threshold is measured against. */
constexpr double kEnergyMs = 1.5;
/**
 * The voice's body: its mean power over 8 ms, then held — rising in 5 ms and
 * falling over 80. Rising slowly, it lagged every vowel's start while the
 * vowel's own upper harmonics were already in the lowest band, and cut them;
 * falling slowly, it still stands for the voice through the gap before an S,
 * which is where an S comes. Averaged first, because a quick follower on the
 * instantaneous power rides the peaks of a voice's waveform and read it
 * several dB louder than it is.
 */
constexpr double kBodyMeanMs = 8.0;
constexpr double kBodyRiseMs = 5.0;
constexpr double kBodyFallMs = 80.0;
/**
 * And never less than its power over 2 ms: the held body still lagged a
 * vowel's start by about 13 ms, and the vowel's upper harmonics in the lowest
 * band were cut there. The quick reading rides the waveform's peaks and reads
 * high, which only ever raises the bar, so it costs an S nothing — an S comes
 * with no vowel under it.
 */
constexpr double kBodyQuickMs = 2.0;
/**
 * The centre against the sides, over 2.5 ms: an S rises in about 15, and a
 * reading that took 5 still held the room before it for an S's first ten.
 */
constexpr double kRegionMs = 2.5;
/** The air band's power over 3 ms, read against the listening range's. */
constexpr double kAirMs = 3.0;
/**
 * A strike against a rise: how much the sibilance bands' power climbs in the
 * millisecond after it jumps 6 dB over the last 20 ms. Not a fast-against-
 * slow ratio: anything rising out of near-silence has a huge one at its
 * start, an S as much as a hi-hat, because both begin as a ratio of two
 * near-zeros. Timed from the jump, a hi-hat struck in one sample climbs 12
 * to 18 dB more in that millisecond (its 1 ms power follower filling) and no
 * S on the scene climbed more than 4. Read through a 1 ms average, not the
 * instantaneous power, whose peaks on band-limited noise are several times
 * its mean. 6 dB, not 3, because a voice's own upper harmonics reach the
 * lowest band and beat there by 3: a 3 dB jump timed a "rise" on every vowel,
 * and a hi-hat landing while one was being timed was not timed at all.
 */
constexpr double kTransientFastMs = 1.0;
constexpr double kRecentMs = 20.0;
constexpr double kJump = 4.0;  // 6 dB
constexpr double kRiseMs = 1.0;
constexpr double kVoiceRiseDb = 4.0;
constexpr double kStruckRiseDb = 8.0;
/** After a rise is timed, the same sound is not timed again for 5 ms. */
constexpr double kRestMs = 5.0;

/** Direct Form I in double, as the rest of the rack runs its biquads. */
inline double step(FeqBiquadState& state, const FeqBiquadCoefficients& k,
                   double input) {
  const double output = k.b0 * input + k.b1 * state.x1 + k.b2 * state.x2 -
                        k.a1 * state.y1 - k.a2 * state.y2;
  state.x2 = state.x1;
  state.x1 = input;
  state.y2 = state.y1;
  state.y1 = output;
  return output;
}

void map_lanes(FeqDeEsser* deesser) {
  Run& run = deesser->run;
  LaneMap map{};
  if (run.applied.bands > 0) {
    if (deesser->channels >= 2 && run.applied.settings.centre_only != 0) {
      map.source[map.count++] = -1;
      map.compare_sides = true;
      if (deesser->centre_channel >= 0) {
        map.source[map.count++] = deesser->centre_channel;
      }
    } else {
      for (uint32_t channel = 0; channel < deesser->channels; ++channel) {
        if (static_cast<int>(channel) != deesser->lfe_channel) {
          map.source[map.count++] = static_cast<int>(channel);
        }
      }
    }
  }
  run.lanes = map;
}

/** Take a layout the control thread published, once. */
void take_published(FeqDeEsser* deesser) {
  const int slot = deesser->published.load(std::memory_order_acquire);
  const uint64_t writes = deesser->writes[slot].load(std::memory_order_acquire);
  if ((slot == deesser->adopted_slot && writes == deesser->adopted_writes) ||
      writes % 2 != 0) {
    return;
  }
  Layout copy = deesser->layouts[slot];
  if (deesser->writes[slot].load(std::memory_order_acquire) != writes) {
    return;  // written while copied; the next block takes it whole
  }
  deesser->adopted_slot = slot;
  deesser->adopted_writes = writes;
  deesser->pending = copy;
  deesser->has_pending = true;
}

/** Apply a pending layout where it is safe to. */
void adopt(FeqDeEsser* deesser) {
  if (!deesser->has_pending) {
    return;
  }
  Run& run = deesser->run;
  if (same_structure(run.applied, deesser->pending)) {
    run.applied = deesser->pending;
    deesser->has_pending = false;
    return;
  }
  if (run.running && letting_go(run)) {
    return;  // the tick drains the cut; adopted once it has let go
  }
  run.applied = deesser->pending;
  deesser->has_pending = false;
  map_lanes(deesser);
  restart(run);
}

}  // namespace

void restart(Run& run) {
  for (auto& lane : run.lane) {
    lane = Lane{};
  }
  run.region_mid = FeqBiquadState{};
  run.region_side = FeqBiquadState{};
  for (uint32_t band = 0; band < kMaxBands; ++band) {
    run.energy[band] = 0.0;
    run.reference[band] = 0.0;
    run.cut_db[band] = 0.0;
    run.gain_from[band] = 1.0;
    run.gain_to[band] = 1.0;
  }
  run.whole_from = 1.0;
  run.whole_to = 1.0;
  run.whole_cut_db = 0.0;
  run.body_mean = 0.0;
  run.body_power = 0.0;
  run.body_quick = 0.0;
  run.region_mid_power = 0.0;
  run.region_side_power = 0.0;
  run.air_power = 0.0;
  run.air_under_db = 12.0;
  run.transient_fast = 0.0;
  run.recent_power = 0.0;
  run.significance = 1e300;
  run.rising = false;
  run.rise_from = 0.0;
  run.rise_left = 0;
  run.rest_left = 0;
  run.tick_onset = 1.0;
  run.onset_held = 1.0;
  run.transient_hold = 0;
  run.tick_at = 0;
  run.warming = run.warm_ticks;
}

}  // namespace feq_deesser

using feq_deesser::Layout;
using feq_deesser::Run;

extern "C" void feq_deesser_process(FeqDeEsser* deesser,
                                    float* const* channels, uint32_t frames,
                                    int idle) {
  if (deesser == nullptr || channels == nullptr || frames == 0) {
    return;
  }
  Run& run = deesser->run;
  feq_deesser::take_published(deesser);
  feq_deesser::adopt(deesser);
  feq_deesser::start_report(run);
  if (idle != 0) {
    // Game mode with the stage off: no delay, nothing heard. Coming back,
    // the line and the filters start from silence rather than from a moment
    // long gone.
    run.delaying = false;
    run.running = false;
    return;
  }
  if (!run.delaying) {
    for (auto& ring : run.ring) {
      std::fill(ring.begin(), ring.end(), 0.0f);
    }
    run.ring_at = 0;
    run.delaying = true;
  }
  const Layout& layout = run.applied;
  if (layout.settings.enabled != 0 && !run.running) {
    feq_deesser::map_lanes(deesser);
    feq_deesser::restart(run);
    run.running = true;
  }
  if (run.running && layout.settings.enabled == 0 &&
      !feq_deesser::letting_go(run)) {
    run.running = false;
  }

  const uint32_t count = deesser->channels;
  const uint32_t look_ahead = deesser->look_ahead;
  if (!run.running || run.lanes.count == 0) {
    // At rest: the look-ahead and nothing else, so switching on never moves
    // the audio.
    for (uint32_t at = 0; at < frames; ++at) {
      for (uint32_t channel = 0; channel < count; ++channel) {
        float& slot = run.ring[channel][run.ring_at];
        const float delayed = slot;
        slot = channels[channel][at];
        channels[channel][at] = delayed;
      }
      run.ring_at = run.ring_at + 1 == look_ahead ? 0 : run.ring_at + 1;
    }
    return;
  }

  using feq_deesser::follower;
  const double rate = deesser->sample_rate;
  const double energy_step = follower(feq_deesser::kEnergyMs, rate);
  const double body_mean_step = follower(feq_deesser::kBodyMeanMs, rate);
  const double body_rise = follower(feq_deesser::kBodyRiseMs, rate);
  const double body_fall = follower(feq_deesser::kBodyFallMs, rate);
  const double body_quick = follower(feq_deesser::kBodyQuickMs, rate);
  const double region_step = follower(feq_deesser::kRegionMs, rate);
  const double air_step = follower(feq_deesser::kAirMs, rate);
  const double fast_step = follower(feq_deesser::kTransientFastMs, rate);
  const double recent_step = follower(feq_deesser::kRecentMs, rate);
  const auto rise_frames = std::max<uint32_t>(
      1, static_cast<uint32_t>(std::lround(feq_deesser::kRiseMs * rate / 1000.0)));
  const auto rest_frames = static_cast<uint32_t>(
      std::lround(feq_deesser::kRestMs * rate / 1000.0));
  const uint32_t bands = layout.bands;
  const uint32_t lanes = run.lanes.count;
  const double per_lane = 1.0 / static_cast<double>(lanes);
  const int mode = layout.settings.mode;
  const bool isolate = layout.settings.isolate != 0 && layout.settings.enabled != 0;

  for (uint32_t at = 0; at < frames; ++at) {
    // --- listen, ahead of what plays ---------------------------------------
    double heard[feq_deesser::kMaxBands] = {};
    double body = 0.0;
    double air = 0.0;
    for (uint32_t index = 0; index < lanes; ++index) {
      const int source = run.lanes.source[index];
      const double input =
          source < 0 ? 0.5 * (static_cast<double>(channels[0][at]) +
                              static_cast<double>(channels[1][at]))
                     : static_cast<double>(channels[source][at]);
      feq_deesser::Lane& lane = run.lane[index];
      for (uint32_t band = 0; band < bands; ++band) {
        const double y =
            feq_deesser::step(lane.listen[band], layout.band[band], input);
        heard[band] += y * y;
      }
      const double low = feq_deesser::step(
          lane.body, layout.body,
          feq_deesser::step(lane.body_floor, layout.body_floor, input));
      body += low * low;
      if (layout.has_air) {
        const double high = feq_deesser::step(lane.air, layout.air, input);
        air += high * high;
      }
    }
    double instant = 0.0;
    for (uint32_t band = 0; band < bands; ++band) {
      const double power = heard[band] * per_lane;
      instant += power;
      run.energy[band] +=
          (power * layout.tone_power[band] - run.energy[band]) * energy_step;
    }
    run.body_mean += (body * per_lane - run.body_mean) * body_mean_step;
    run.body_quick += (body * per_lane - run.body_quick) * body_quick;
    run.body_power += (run.body_mean - run.body_power) *
                      (run.body_mean > run.body_power ? body_rise : body_fall);
    if (layout.has_air) {
      run.air_power +=
          (air * per_lane * layout.tone_air - run.air_power) * air_step;
    }
    if (run.lanes.compare_sides) {
      const double left = channels[0][at];
      const double right = channels[1][at];
      const double mid =
          feq_deesser::step(run.region_mid, layout.region, 0.5 * (left + right));
      const double side =
          feq_deesser::step(run.region_side, layout.region, 0.5 * (left - right));
      run.region_mid_power += (mid * mid - run.region_mid_power) * region_step;
      run.region_side_power +=
          (side * side - run.region_side_power) * region_step;
    }
    run.transient_fast += (instant - run.transient_fast) * fast_step;
    if (run.rising) {
      if (--run.rise_left == 0) {
        run.rising = false;
        const double climbed =
            feq_deesser::db(run.transient_fast / run.rise_from);
        run.tick_onset = std::min(
            run.tick_onset,
            feq_deesser::clamp01((feq_deesser::kStruckRiseDb - climbed) /
                                 (feq_deesser::kStruckRiseDb -
                                  feq_deesser::kVoiceRiseDb)));
        run.rest_left = rest_frames;
      }
    } else if (run.rest_left > 0) {
      --run.rest_left;
    } else if (run.transient_fast > run.significance &&
               run.transient_fast > feq_deesser::kJump * run.recent_power) {
      // Something that matters has jumped 6 dB over the last 20 ms: time how
      // far it climbs. Over what was already there, so a hi-hat landing on a
      // vowel's tail is timed as surely as one landing on silence.
      run.rising = true;
      run.rise_from = run.transient_fast;
      run.rise_left = rise_frames;
    }
    run.recent_power += (instant - run.recent_power) * recent_step;

    if (++run.tick_at >= run.tick_length) {
      run.tick_at = 0;
      feq_deesser::tick(deesser);
    }
    const double along = static_cast<double>(run.tick_at + 1) /
                         static_cast<double>(run.tick_length);

    // --- play, the look-ahead behind -----------------------------------------
    float delayed[feq_deesser::kMaxChannels];
    for (uint32_t channel = 0; channel < count; ++channel) {
      float& slot = run.ring[channel][run.ring_at];
      delayed[channel] = slot;
      slot = channels[channel][at];
    }
    run.ring_at = run.ring_at + 1 == look_ahead ? 0 : run.ring_at + 1;

    double change[feq_deesser::kMaxChannels] = {};
    const double whole = run.whole_from + (run.whole_to - run.whole_from) * along;
    for (uint32_t index = 0; index < lanes; ++index) {
      const int source = run.lanes.source[index];
      const double input =
          source < 0 ? 0.5 * (static_cast<double>(delayed[0]) +
                              static_cast<double>(delayed[1]))
                     : static_cast<double>(delayed[source]);
      feq_deesser::Lane& lane = run.lane[index];
      double delta = 0.0;
      if (mode == FEQ_DEESSER_SPECTRAL) {
        for (uint32_t band = 0; band < bands; ++band) {
          const double gain = run.gain_from[band] +
                              (run.gain_to[band] - run.gain_from[band]) * along;
          delta += (gain - 1.0) *
                   feq_deesser::step(lane.cut[band], layout.band[band], input);
        }
      } else if (mode == FEQ_DEESSER_TREBLE) {
        const double under = feq_deesser::step(lane.split, layout.split, input);
        delta = (whole - 1.0) * (input - under);
      } else {
        delta = (whole - 1.0) * input;
      }
      if (source < 0) {
        change[0] += delta;
        change[1] += delta;
      } else {
        change[source] += delta;
      }
    }
    for (uint32_t channel = 0; channel < count; ++channel) {
      // Isolate plays what is taken away: the negative of the change, and
      // silence wherever nothing is cut.
      channels[channel][at] = static_cast<float>(
          isolate ? -change[channel]
                  : static_cast<double>(delayed[channel]) + change[channel]);
    }
  }
}
