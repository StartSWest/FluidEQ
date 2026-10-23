/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's insides, shared by its three source files: the layout the
 * control thread builds (`deesser.cpp`), the listening and cutting the audio
 * thread does every sample (`deesser_process.cpp`), and the decision it makes
 * at each control tick (`deesser_decide.cpp`).
 */
#ifndef FLUIDEQ_DEESSER_INTERNAL_H
#define FLUIDEQ_DEESSER_INTERNAL_H

#include "fluideq/biquad.h"
#include "fluideq/deesser.h"

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <vector>

namespace feq_deesser {

constexpr uint32_t kMaxBands = FEQ_DEESSER_MAX_BANDS;
constexpr uint32_t kMaxChannels = FEQ_DEESSER_MAX_CHANNELS;
constexpr double kTiny = 1e-20;

/** A one-pole follower's step per sample for a time constant in ms. */
inline double follower(double ms, double rate) {
  return 1.0 - std::exp(-1000.0 / (ms * rate));
}

inline double clamp01(double value) {
  return std::min(1.0, std::max(0.0, value));
}

/** Power in dB, safe at zero. */
inline double db(double power) { return 10.0 * std::log10(power + kTiny); }

/**
 * Everything the dials decide, resolved into what the audio thread runs.
 * Built whole on the control thread and copied into the run when adopted, so
 * the audio thread never reads a layout another thread is writing.
 */
struct Layout {
  /** Clamped; what the dials asked for, within what this rate can play. */
  FeqDeEsserSettings settings{};
  uint32_t bands = 0;
  double hz[kMaxBands] = {};
  /**
   * Band-passes matched to the analog prototype, so a band has the same
   * width and the same unit gain at its centre at 44.1 kHz as at 384: the
   * cookbook squeezes a band near Nyquist, and the same S then filled the
   * top bands differently at each rate.
   */
  FeqBiquadCoefficients band[kMaxBands] = {};
  /** How much of band j's cut band k takes, 0 to 1; 1 on the diagonal. */
  double spread[kMaxBands][kMaxBands] = {};
  /** Each band's power as the preset's curve will play it, relative. */
  double tone_power[kMaxBands] = {};
  double tone_air = 1.0;
  /**
   * The listening range's width over the air band's, in octaves: the two
   * are compared per octave, or a flat cymbal would read brighter in the
   * narrower one.
   */
  double air_per_range = 1.0;
  /**
   * The voice's body, the range a voice's level lives in: above 300 Hz,
   * so a bass line or a kick does not stand for how loud the singer is, and
   * under the listening range, so an S is not in it.
   */
  FeqBiquadCoefficients body{};
  FeqBiquadCoefficients body_floor{};
  /** The whole listening range, for the centre against the sides. */
  FeqBiquadCoefficients region{};
  /** The air above an S, where a cymbal goes on and a voice has stopped. */
  FeqBiquadCoefficients air{};
  int has_air = 0;
  /** Treble's split: what is under it stays, what is over it is cut. */
  FeqBiquadCoefficients split{};
  /** Thresholds the sensitivity sets, dB. */
  double body_threshold_db = 0.0;
  double self_threshold_db = 0.0;
};

/** Whether moving from one layout to another needs the cut let go first. */
bool same_structure(const Layout& a, const Layout& b);

/** Build a layout from the dials. CONTROL thread. */
void build_layout(Layout* layout, const FeqDeEsserSettings& settings,
                  double sample_rate, FeqDeEsserToneGain tone_gain,
                  const void* tone_context);

/** One signal the stage listens to and cuts: a channel, or the centre of the
 * front pair. */
struct Lane {
  FeqBiquadState listen[kMaxBands];
  FeqBiquadState cut[kMaxBands];
  FeqBiquadState body;
  FeqBiquadState body_floor;
  FeqBiquadState air;
  FeqBiquadState split;
};

/** Which signals are lanes, decided by the layout and the channel layout. */
struct LaneMap {
  uint32_t count = 0;
  /** A lane's source: a channel, or -1 for the mid of channels 0 and 1. */
  int source[kMaxChannels] = {};
  /** The front pair is a stereo pair whose centre is compared with sides. */
  bool compare_sides = false;
};

/** The audio thread's state. Swapped whole at a handover. */
struct Run {
  Layout applied{};
  LaneMap lanes{};
  /** Filters and gains live: on, or still letting a cut go. */
  bool running = false;
  /** The look-ahead line is in use; false only while idle. */
  bool delaying = false;
  Lane lane[kMaxChannels] = {};
  FeqBiquadState region_mid{};
  FeqBiquadState region_side{};
  /** Each band's power, as heard through the preset's curve. */
  double energy[kMaxBands] = {};
  /** Each band's recent bed, slow to rise and quicker to fall. */
  double reference[kMaxBands] = {};
  /** The cut being applied per band, dB, positive. */
  double cut_db[kMaxBands] = {};
  /** The cut's gain, linear, from the last tick and to the next. */
  double gain_from[kMaxBands] = {};
  double gain_to[kMaxBands] = {};
  double whole_from = 1.0;
  double whole_to = 1.0;
  double whole_cut_db = 0.0;
  /** The voice's mean power over 8 ms, and the body held from it. */
  double body_mean = 0.0;
  double body_power = 0.0;
  /** The voice's power over 2 ms: never cut against less than this. */
  double body_quick = 0.0;
  double region_mid_power = 0.0;
  double region_side_power = 0.0;
  double air_power = 0.0;
  /** How far under the listening range the air lies per octave, dB. */
  double air_under_db = 12.0;
  /** The sibilance bands' power over the last millisecond. */
  double transient_fast = 0.0;
  /** The sibilance bands' power over the last 20 ms, which a rise jumps over. */
  double recent_power = 0.0;
  /** The power a rise is timed from: 6 dB under where a cut would start. */
  double significance = 1e300;
  /** A rise being timed: the power it crossed at, and the frames left. */
  bool rising = false;
  double rise_from = 0.0;
  uint32_t rise_left = 0;
  /** Frames before the next rise is timed: one strike is timed once. */
  uint32_t rest_left = 0;
  /** The most struck any rise since the last tick read, 1 voice to 0 hit. */
  double tick_onset = 1.0;
  /** How voice-like the onset reads, 0 to 1, held low for a hit's length. */
  double onset_held = 1.0;
  /** Ticks left before a strike's low reading may rise again. */
  uint32_t transient_hold = 0;
  /**
   * Ticks before a cut may start, after the stage starts listening: until the
   * voice's body has been heard, everything reads as loud against it.
   */
  uint32_t warming = 0;
  /** The warm-up in ticks at this rate, set once at create. */
  uint32_t warm_ticks = 0;
  uint32_t tick_length = 1;
  uint32_t tick_at = 0;
  std::vector<float> ring[kMaxChannels];
  uint32_t ring_at = 0;
  FeqDeEsserReport report{};
};

/** Filters, followers and gains from silence; the bed is relearned. */
void restart(Run& run);

/** Whether a cut is still being let go. */
bool letting_go(const Run& run);

/** Clear what the page is told before a block is folded into it. */
void start_report(Run& run);

}  // namespace feq_deesser

struct FeqDeEsser {
  double sample_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t look_ahead = 0;
  int lfe_channel = -1;
  int centre_channel = -1;
  /**
   * Built on the control thread; the audio thread copies the published one.
   * Each slot's count is odd while it is being written, so a copy that
   * overlapped a write (two edits landing inside one block) is noticed and
   * dropped rather than adopted half old and half new.
   */
  feq_deesser::Layout layouts[2];
  std::atomic<uint64_t> writes[2] = {};
  std::atomic<int> published{0};
  /** The count of the slot the run last adopted, so a layout is taken once. */
  uint64_t adopted_writes = 0;
  int adopted_slot = -1;
  /**
   * A layout taken from the control thread but not yet applied: it moves the
   * bands or the lanes, and the cut the run is making has to let go first.
   * AUDIO thread; not swapped at a handover, because it is this object's own.
   */
  feq_deesser::Layout pending{};
  bool has_pending = false;
  feq_deesser::Run run;
};

namespace feq_deesser {

/** The decision, once a control tick: what each band is cut by now. */
void tick(FeqDeEsser* deesser);

}  // namespace feq_deesser

#endif /* FLUIDEQ_DEESSER_INTERNAL_H */
