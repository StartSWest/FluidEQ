/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Game filter's two parts beside the lift (`footsteps.h`): Environment
 * (`game_environment.cpp`) and Dialogue (`game_dialogue.cpp`). Each has a
 * design made with the stage, a state that moves to a prepared chain with
 * the rest of the stage's, a listener run on the stage's input every sample,
 * a decision every quarter millisecond, and an application that is exactly
 * the input while its gains are at unity.
 */
#ifndef FLUIDEQ_GAME_PARTS_H
#define FLUIDEQ_GAME_PARTS_H

#include <cstdint>

#include "fluideq/footsteps.h"

namespace feq_footsteps_detail {

/** A second-order section, transposed direct form II. */
struct Biquad {
  double b0 = 1.0;
  double b1 = 0.0;
  double b2 = 0.0;
  double a1 = 0.0;
  double a2 = 0.0;
};

struct BiquadHistory {
  double z1 = 0.0;
  double z2 = 0.0;
};

/**
 * One half of a first-order all-pass split (Regalia-Mitra): the low part is
 * `(x + A(x)) / 2` and the rest is `x` less it, so the parts always add back
 * to the input exactly, whatever the corner.
 */
struct AllPassHistory {
  double x1 = 0.0;
  double y1 = 0.0;
};

/* --- Environment ------------------------------------------------------- */

/** Below 400 Hz, 400 Hz to 3.2 kHz, above. */
constexpr int kEnvironmentBands = 3;
/** -1 on the dial: the bed this far down. */
constexpr double kEnvironmentCutDb = 9.0;
/** +1 on the dial: the bed this far up. */
constexpr double kEnvironmentLiftDb = 6.0;

struct EnvironmentDesign {
  /** Where each band is listened to (constant-peak band-passes). */
  Biquad listen[kEnvironmentBands];
  /** The band's envelope, per sample: rises and falls alike. */
  double a_envelope[kEnvironmentBands] = {};
  /** The two splits the bands are made by. */
  double split_low_c = 0.0;
  double split_high_c = 0.0;
  // Per decision.
  double a_moments = 0.0;
  double a_share = 0.0;
  double a_bed_rise = 0.0;
  double a_bed_fall = 0.0;
  double a_bed_learn = 0.0;
  /** Back to unity as a sound stands out, and away from it again. */
  double a_gain_toward = 0.0;
  double a_gain_away = 0.0;
};

struct EnvironmentState {
  BiquadHistory listen_history[kEnvironmentBands][2];
  /** Each band's power at each ear of the front pair. */
  double power[kEnvironmentBands][2] = {};
  /** Each band's envelope at each ear: its mean, spread and their link. */
  double mean[kEnvironmentBands][2] = {};
  double spread[kEnvironmentBands][2] = {};
  double link[kEnvironmentBands] = {};
  /** 0 to 1: how much of each band is environment, smoothed. */
  double share[kEnvironmentBands] = {};
  /** Each band's floor, dB: what it sits on between sounds. */
  double bed_db[kEnvironmentBands] = {-120.0, -120.0, -120.0};
  double gain_db[kEnvironmentBands] = {};
  double gain[kEnvironmentBands] = {1.0, 1.0, 1.0};
  double step[kEnvironmentBands] = {};
  AllPassHistory split_low[FEQ_FOOTSTEPS_MAX_CHANNELS];
  AllPassHistory split_high[FEQ_FOOTSTEPS_MAX_CHANNELS];
};

void environment_design(EnvironmentDesign& design, double rate,
                        double control_rate);

/** The stage's input, one frame: the front pair (or the one channel). */
void environment_listen(const EnvironmentDesign& design, EnvironmentState& state,
                        const double* frame, uint32_t channels);

/**
 * Where each band's gain goes over the next decision. `amount` is the dial,
 * or 0 while the stage is off or still learning, which lets every gain go
 * back to unity.
 */
void environment_decide(const EnvironmentDesign& design, EnvironmentState& state,
                        double amount, bool learning, double samples,
                        FeqFootstepsReport& report);

/** At unity and staying there: the application would add nothing. */
bool environment_idle(const EnvironmentState& state);

/**
 * One frame, in place, every channel but the LFE. Steps the gains a sample
 * along. Called only while the part is not idle.
 */
void environment_apply(const EnvironmentDesign& design, EnvironmentState& state,
                       double* frame, uint32_t channels, int lfe);

/* --- Dialogue ---------------------------------------------------------- */

/** The voice band's largest lift, dB, at Voices of one. */
constexpr double kVoiceLiftDb = 6.0;
/** How far everything else steps back at Voices of zero, and at one. */
constexpr double kDuckLeastDb = 3.0;
constexpr double kDuckMostDb = 6.0;

struct DialogueDesign {
  /** The voice band a voice is heard in: 250 Hz to 3.5 kHz. */
  Biquad voice_high_pass;
  Biquad voice_low_pass;
  /** Above the voice, for how much of the sound is under 5 kHz. */
  Biquad over_voice;
  /** The splits the voice is brought forward by: 250 Hz and 5 kHz. */
  double split_low_c = 0.0;
  double split_high_c = 0.0;
  // Per sample.
  double a_power_attack = 0.0;
  double a_power_release = 0.0;
  // Per decision.
  double a_fast = 0.0;
  double a_slow = 0.0;
  double a_depth = 0.0;
  double a_tilt = 0.0;
  double a_centre = 0.0;
  double a_voice_attack = 0.0;
  double a_voice_release = 0.0;
  uint32_t hold_decisions = 0;
  double a_gain_attack = 0.0;
  double a_gain_release = 0.0;
};

struct DialogueState {
  /** A centre channel is the voice's: set as each frame is listened to. */
  bool surround = false;
  /** The voice's channel (the centre, or the mid) through the voice band. */
  BiquadHistory voice_hp;
  BiquadHistory voice_lp;
  /** What it is compared with: the side, or each front of a surround. */
  BiquadHistory other_hp[2];
  BiquadHistory other_lp[2];
  BiquadHistory over_history;
  double voice_power = 0.0;
  double other_power = 0.0;
  double over_power = 0.0;
  /** The voice band's level, fast and slow, dB, and how far apart they go. */
  double fast_db = -120.0;
  double slow_db = -120.0;
  double depth_db = 0.0;
  /** The voice band over what is above it, dB. */
  double tilt_db = 0.0;
  /** The voice band over the side or the fronts, dB. */
  double centre_db = 0.0;
  /** 0 to 1, held through the gaps between words. */
  double voice = 0.0;
  uint32_t hold_left = 0;
  double lift_db = 0.0;
  double duck_db = 0.0;
  double lift_gain = 1.0;
  double lift_step = 0.0;
  double duck_gain = 1.0;
  double duck_step = 0.0;
  AllPassHistory split_low;
  AllPassHistory split_high;
};

void dialogue_design(DialogueDesign& design, double rate, double control_rate);

/**
 * The stage's input, one frame. `centre` is the centre channel or -1; with
 * one, it is the voice's channel and the fronts are what it stands over.
 */
void dialogue_listen(const DialogueDesign& design, DialogueState& state,
                     const double* frame, uint32_t channels, int centre);

/**
 * Where the voice band's lift and everyone else's step back go over the
 * next decision. `voices` and `duck` are the dials, or 0 while off or still
 * learning. `programme_db` and `quiet_around` are the lift's own readings
 * (`footsteps_decide.cpp`): a voice under the whole mix by more than 30 dB
 * is not one anyone is following, and nothing is a voice during a blast.
 */
void dialogue_decide(const DialogueDesign& design, DialogueState& state,
                     double voices, bool duck, double programme_db,
                     double quiet_around, double samples,
                     FeqFootstepsReport& report);

bool dialogue_idle(const DialogueState& state);

/** One frame, in place. Called only while the part is not idle. */
void dialogue_apply(const DialogueDesign& design, DialogueState& state,
                    double* frame, uint32_t channels, int lfe, int centre);

/* --- Shared ------------------------------------------------------------ */

/** RBJ's high and low pass at Q 1/sqrt(2): Butterworth. */
Biquad butterworth_high_pass(double rate, double hz);
Biquad butterworth_low_pass(double rate, double hz);

/** A constant-peak band-pass, 0 dB at its centre. */
Biquad band_pass(double rate, double hz, double q);

/** The all-pass coefficient of a first-order split at `hz`. */
double split_coefficient(double rate, double hz);

inline double run_biquad(const Biquad& k, BiquadHistory& h, double x) {
  const double y = k.b0 * x + h.z1;
  h.z1 = k.b1 * x - k.a1 * y + h.z2;
  h.z2 = k.b2 * x - k.a2 * y;
  return y;
}

/** The low part of a first-order split; the high part is `x` less it. */
inline double split_low(double c, AllPassHistory& h, double x) {
  const double allpass = c * x + h.x1 - c * h.y1;
  h.x1 = x;
  h.y1 = allpass;
  return 0.5 * (x + allpass);
}

/** One-pole coefficient for `ms` at `rate`. */
double pole_of(double rate, double ms);

/** A gain's straight walk toward `db` over `samples`, as the lift's. */
void glide_gain(double& gain, double& per_sample, double db, double samples);

double smooth_step(double low, double high, double value);

}  // namespace feq_footsteps_detail

#endif  // FLUIDEQ_GAME_PARTS_H
