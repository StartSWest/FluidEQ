/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Footsteps' insides, shared by the stage (`footsteps.cpp`: the sound, a
 * sample at a time) and its decisions (`footsteps_decide.cpp`: every quarter
 * millisecond, where each band's lift and the rumble's cut are going).
 */
#ifndef FLUIDEQ_FOOTSTEPS_INTERNAL_H
#define FLUIDEQ_FOOTSTEPS_INTERNAL_H

#include <atomic>
#include <cstdint>
#include <memory>

#include "fluideq/footsteps.h"
#include "game_parts.h"

namespace feq_footsteps_detail {

constexpr double kFloorDb = -120.0;
/** Quieter than this, it is silence: no bed is learnt from it. */
constexpr double kSilenceDb = -80.0;
/**
 * A lift or a cut this small, in dB, is taken the rest of the way to unity
 * in a straight line over one decision, so the stage returns to the input to
 * the bit rather than approaching it for ever; and asked for, it is not asked
 * for at all. A hundredth of a decibel on the band moves it by 0.1%: under a
 * band at -30 dBFS, a step there would sit 90 dB down, and there is none.
 */
constexpr double kSettledDb = 0.01;

struct BandDesign {
  double hz;
  double q;
  /** The most this band is ever lifted, dB, at a Lift of one. */
  double max_db;
};

/**
 * Weight, steps and detail. Footsteps have no one frequency — a boot on
 * gravel and on wood share little — so the middle band is nearly two octaves
 * wide (1.3 to 4.5 kHz at its -3 dB points), where the scuff, the crunch and
 * a reload all are, and the other two are smaller: the weight of a step tells
 * distance, the detail band carries the pinna's 6-9 kHz notch, which a bell
 * this wide scales without filling.
 */
constexpr BandDesign kBands[FEQ_FOOTSTEPS_BANDS] = {
    {300.0, 1.0, 4.0},
    {2400.0, 0.75, 10.0},
    {7000.0, 0.9, 6.0},
};
constexpr int kStepsBand = 1;

/**
 * A band-pass with a peak of exactly 0 dB (RBJ's constant-peak form), so
 * `x + (g - 1) * bandpass(x)` is a bell of gain `g` at its centre. Its b1 is
 * zero and its b2 is minus its b0.
 */
struct BandPass {
  double b0 = 0.0;
  double a1 = 0.0;
  double a2 = 0.0;
};

struct History {
  double z1 = 0.0;
  double z2 = 0.0;
};

constexpr int kBedTaps = 24;
constexpr double kOverlayCeiling = 0.8912509381337456;  // -1 dBFS

struct BedFrame {
  double sample[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
};

struct BedHistory {
  uint32_t delay[kBedTaps] = {};
  uint32_t length = 0;
  std::unique_ptr<BedFrame[]> frames;
};

struct BedPrediction {
  bool active = false;
  double weight[kBedTaps] = {};
  double step[kBedTaps] = {};
  double covariance[kBedTaps][kBedTaps] = {};
  double cross[kBedTaps] = {};
  double energy = 0.0;
  uint32_t write = 0;
  uint32_t filled = 0;
  uint32_t observe_in = 0;
  uint32_t glide_left = 0;
  uint32_t observations = 0;
  uint32_t phase = 1;
};

struct OverlayHeadroom {
  double gain = 1.0;
  double input_peak = 0.0;
  double added_peak = 0.0;
  double output_peak = 0.0;
  uint32_t input_hold = 0;
  uint32_t added_hold = 0;
  uint32_t output_hold = 0;
};

/** Everything that runs with the sound, and moves to a prepared chain. */
struct State {
  bool running = false;
  /** Samples left before the next decision. */
  uint32_t until_control = 0;
  /** Samples of sound heard since the bed began, up to the learning time. */
  uint32_t heard = 0;
  History band_history[FEQ_FOOTSTEPS_BANDS][FEQ_FOOTSTEPS_MAX_CHANNELS];
  BedPrediction bed_prediction[FEQ_FOOTSTEPS_BANDS];
  uint32_t cue_relearn_left = 0;
  /**
   * The band heard through its filter a second time, for the decisions only.
   * One pass leaks 25 dB down at 100 Hz: under a game's music or engine at
   * -10 dB the steps band read a bed of -50 dB, three under the steps, and
   * no step stood far enough over it to be heard as one. Twice is 50 down.
   */
  History detect_history[FEQ_FOOTSTEPS_BANDS][FEQ_FOOTSTEPS_MAX_CHANNELS];
  double shelf_x1[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
  double shelf_y1[FEQ_FOOTSTEPS_MAX_CHANNELS] = {};
  double band_power[FEQ_FOOTSTEPS_BANDS] = {};
  /**
   * The band as it is lifted, one pass: what the ceiling holds. The second
   * pass the decisions hear through lags a shot's first millisecond, and a
   * ceiling read from it let that millisecond keep a step's lift.
   */
  double lift_power[FEQ_FOOTSTEPS_BANDS] = {};
  double band_level[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_slow[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_bed[FEQ_FOOTSTEPS_BANDS] = {kFloorDb, kFloorDb, kFloorDb};
  double band_gain_db[FEQ_FOOTSTEPS_BANDS] = {};
  /** Linear gains, stepped a sample at a time toward each decision. */
  double band_gain[FEQ_FOOTSTEPS_BANDS] = {1.0, 1.0, 1.0};
  double band_step[FEQ_FOOTSTEPS_BANDS] = {};
  /** Headroom limits only the added cue, never the original mix. */
  OverlayHeadroom overlay;
  OverlayHeadroom environment_overlay;
  OverlayHeadroom dialogue_overlay;
  double whole_power = 0.0;
  /** The programme's level, dB, and the band target's power from it. */
  double programme_db = kFloorDb;
  double target_power = 0.0;
  /** Each band's arrival, held for a step's length, and what is left of it. */
  double arrival_held[FEQ_FOOTSTEPS_BANDS] = {};
  uint32_t hold_left[FEQ_FOOTSTEPS_BANDS] = {};
  double calm_power = 0.0;
  double calm_level = kFloorDb;
  double calm_cut_db = 0.0;
  double calm_gain = 1.0;
  double calm_step = 0.0;
  /**
   * 1 while nothing around is loud, 0 in a blast, from the last decision:
   * Dialogue reads it, as the lift does.
   */
  double quiet_around = 1.0;
  /** Still learning the bed: nothing is moved yet. */
  bool learning = true;
  EnvironmentState environment;
  DialogueState dialogue;
};

/**
 * The weight band's most when Heavy is on: a hoof or a boot carries its
 * distance at 300 Hz, and the 4 dB that serves a footstep left the hooves of
 * a horse across the plains of a ride 1.5 dB up, unheard (2026-11-01, a
 * recorded ride replayed through the stage).
 */
constexpr double kHeavyWeightMaxDb = 10.0;

}  // namespace feq_footsteps_detail

struct FeqFootsteps {
  double sample_rate = 48000.0;
  uint32_t channels = 2;
  uint32_t control_step = 12;
  uint32_t learn_frames = 19200;
  uint32_t hold_decisions = 800;

  std::atomic<int> enabled{0};
  std::atomic<int> isolate{0};
  std::atomic<double> lift{0.0};
  std::atomic<double> calm{0.0};
  std::atomic<int> heavy{0};
  std::atomic<double> environment{0.0};
  std::atomic<double> voices{0.0};
  std::atomic<double> cue_ceiling{feq_footsteps_detail::kOverlayCeiling};
  std::atomic<int> duck{0};
  std::atomic<int> lfe{-1};
  std::atomic<int> centre{-1};

  feq_footsteps_detail::BandPass band[FEQ_FOOTSTEPS_BANDS];
  feq_footsteps_detail::BedHistory bed_history[FEQ_FOOTSTEPS_BANDS];
  uint32_t bed_observation_frames = 0;
  uint32_t bed_glide_frames = 0;
  double shelf_c = 0.0;
  // Per sample.
  double a_power_attack = 0.0;
  double a_power_release = 0.0;
  double a_overlay_release = 0.0;
  double a_headroom_peak_release = 0.0;
  uint32_t headroom_hold_frames = 0;
  uint32_t cue_headroom_hold_frames = 0;
  double a_whole_release = 0.0;
  double a_calm_power_release = 0.0;
  // Per decision.
  double a_level_attack = 0.0;
  double a_level_release = 0.0;
  double a_slow = 0.0;
  double a_bed_rise = 0.0;
  double a_bed_fall = 0.0;
  double a_bed_learn = 0.0;
  double a_gain_attack = 0.0;
  double a_gain_release = 0.0;
  double a_calm_level_attack = 0.0;
  double a_calm_level_release = 0.0;
  double a_cut_attack = 0.0;
  double a_cut_release = 0.0;
  double a_programme_rise = 0.0;
  double a_programme_fall = 0.0;

  feq_footsteps_detail::EnvironmentDesign environment_design;
  feq_footsteps_detail::DialogueDesign dialogue_design;

  feq_footsteps_detail::State state;
  FeqFootstepsReport report{};
};

namespace feq_footsteps_detail {

bool prepare_bed_history(FeqFootsteps& f);
void cue_residual(FeqFootsteps& f, int band, int lfe, double* samples);
void transfer_bed_history(FeqFootsteps& prepared, const FeqFootsteps& previous);

/**
 * One decision: where each band's lift and the rumble's cut are going over
 * the next control step, given everything the followers heard up to now
 * (`footsteps_decide.cpp`).
 */
void decide(FeqFootsteps& f, bool enabled, double lift, double calm,
            bool heavy);

/** Linked wet-only protection shared by Environment, cues and Dialogue. */
double overlay_headroom(FeqFootsteps& f, const double* dry, const double* added,
                        uint32_t count, int lfe, OverlayHeadroom& state,
                        bool adds_gain, uint32_t peak_hold_frames,
                        double ceiling_gain = kOverlayCeiling);

}  // namespace feq_footsteps_detail

#endif  // FLUIDEQ_FOOTSTEPS_INTERNAL_H
