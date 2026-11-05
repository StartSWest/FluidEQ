/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Environment: a game's bed — rain, wind, the hum of a level, a room's tail —
 * turned down or up, and the sounds that stand out of it left where they are
 * (`footsteps.h` for where it stands in the stage).
 *
 * Three bands, split at 400 Hz and 3.2 kHz by first-order all-passes so they
 * always add back to the input, each with its own gain. A band's gain goes to
 * the dial while the band sits on its bed and the bed is environment, and
 * back to unity within a few milliseconds the moment something stands out of
 * the bed — a step, a voice, a shot keeps its level, and the bed under it
 * comes up with it for as long as it lasts, which is when it is masked. A gain
 * that followed only the scene (it was tried first) turned a step down with
 * the rain it fell in, and the step stood exactly as far over the rain as
 * before: the dial did nothing a player could use.
 *
 * Whether a bed is environment at all is read over 0.4 s, from two things:
 *
 * - **Still**: its envelope's spread against its mean. Rain or wind through
 *   a band two kilohertz wide moves its envelope by about a tenth of its
 *   level; a voice, a step or a shot by half of it and more.
 * - **Diffuse**: how little the envelope's movements at the two ears agree.
 *   Rain falls on every side and each ear hears its own drops; a step lands
 *   in one place and both ears hear it land. Envelopes and not waveforms:
 *   a game's own 3D sound puts a step at each ear up to 0.7 ms apart, which
 *   at 3 kHz is two cycles — the waveforms of every band above 1 kHz then
 *   look unrelated while the envelopes still move as one.
 *
 * A centred score that holds a chord is still, and is environment by this
 * reading: it is the bed of that scene. Near silence (under -75 dB) nothing
 * is moved, so turning the bed up never brings up a quiet scene's hiss.
 */
#include <algorithm>
#include <cmath>

#include "game_parts.h"

namespace feq_footsteps_detail {
namespace {

struct ListenBand {
  double hz;
  double q;
  /** How long the band's envelope takes to follow, ms. */
  double envelope_ms;
};

/**
 * Listened to in the middle of each band. The low band's envelope is
 * slower: a band 200 Hz wide fluctuates on its own at the rate of its
 * width, and read through 10 ms the rumble of an engine looked like events.
 */
constexpr ListenBand kListen[kEnvironmentBands] = {
    {160.0, 0.7, 30.0},
    {1000.0, 0.7, 12.0},
    {6000.0, 0.7, 8.0},
};
constexpr double kSplitLowHz = 400.0;
constexpr double kSplitHighHz = 3200.0;

/** The envelope's mean, spread and the ears' agreement: over 0.4 s. */
constexpr double kMomentsMs = 400.0;
constexpr double kShareMs = 300.0;
/** The bed as the lift learns its own (`footsteps.cpp`). */
constexpr double kBedRiseMs = 600.0;
constexpr double kBedFallMs = 120.0;
constexpr double kBedLearnMs = 60.0;
/** Back to unity in 3 ms as a sound stands out; to the bed's gain in 120. */
constexpr double kGainTowardMs = 3.0;
constexpr double kGainAwayMs = 120.0;

/** Spread over mean: under the first, still; over the second, moving. */
constexpr double kStillFrom = 0.25;
constexpr double kStillTo = 0.5;
/** The ears' agreement: under the first, diffuse; over the second, a place. */
constexpr double kDiffuseFrom = 0.2;
constexpr double kDiffuseTo = 0.7;
/** Over its bed by this much, dB, a band is a sound and not the bed. */
constexpr double kStandsFromDb = 2.0;
constexpr double kStandsToDb = 6.0;
/** Nothing is moved under this level, dB. */
constexpr double kQuietFromDb = -75.0;
constexpr double kQuietToDb = -65.0;
constexpr double kSilenceDb = -80.0;
constexpr double kSettledDb = 0.01;

}  // namespace

void environment_design(EnvironmentDesign& design, double rate,
                        double control_rate) {
  for (int b = 0; b < kEnvironmentBands; ++b) {
    design.listen[b] = band_pass(rate, kListen[b].hz, kListen[b].q);
    design.a_envelope[b] = pole_of(rate, kListen[b].envelope_ms);
  }
  design.split_low_c = split_coefficient(rate, kSplitLowHz);
  design.split_high_c = split_coefficient(rate, kSplitHighHz);
  design.a_moments = pole_of(control_rate, kMomentsMs);
  design.a_share = pole_of(control_rate, kShareMs);
  design.a_bed_rise = pole_of(control_rate, kBedRiseMs);
  design.a_bed_fall = pole_of(control_rate, kBedFallMs);
  design.a_bed_learn = pole_of(control_rate, kBedLearnMs);
  design.a_gain_toward = pole_of(control_rate, kGainTowardMs);
  design.a_gain_away = pole_of(control_rate, kGainAwayMs);
}

void environment_listen(const EnvironmentDesign& design, EnvironmentState& state,
                        const double* frame, uint32_t channels) {
  const uint32_t ears = channels >= 2 ? 2 : 1;
  for (int b = 0; b < kEnvironmentBands; ++b) {
    for (uint32_t ear = 0; ear < ears; ++ear) {
      const double y =
          run_biquad(design.listen[b], state.listen_history[b][ear], frame[ear]);
      double& power = state.power[b][ear];
      power += design.a_envelope[b] * (y * y - power);
    }
    if (ears == 1) {
      // One channel is one place: what follows reads it as two ears that
      // always agree, so only stillness can call it environment.
      state.power[b][1] = state.power[b][0];
    }
  }
}

void environment_decide(const EnvironmentDesign& design, EnvironmentState& state,
                        double amount, bool learning, double samples,
                        FeqFootstepsReport& report) {
  const double target_db = amount >= 0.0 ? amount * kEnvironmentLiftDb
                                         : amount * kEnvironmentCutDb;
  double share_sum = 0.0;
  for (int b = 0; b < kEnvironmentBands; ++b) {
    const double level_db =
        10.0 * std::log10(0.5 * (state.power[b][0] + state.power[b][1]) + 1e-24);
    double& bed = state.bed_db[b];
    if (level_db > kSilenceDb) {
      const double rise = learning ? design.a_bed_learn : design.a_bed_rise;
      bed += (level_db > bed ? rise : design.a_bed_fall) * (level_db - bed);
    }
    const double on_bed =
        1.0 - smooth_step(kStandsFromDb, kStandsToDb, level_db - bed);

    // What the bed is made of is read from the bed alone: with the steps of a
    // run in the reading, their movements made the rain between them look
    // like a place, and the dial took it down 2.7 dB of its 9.
    const double a_moments = design.a_moments * on_bed;
    double move[2];
    for (int ear = 0; ear < 2; ++ear) {
      const double envelope = std::sqrt(state.power[b][ear]);
      double& mean = state.mean[b][ear];
      mean += a_moments * (envelope - mean);
      move[ear] = envelope - mean;
      double& spread = state.spread[b][ear];
      spread += a_moments * (move[ear] * move[ear] - spread);
    }
    state.link[b] += a_moments * (move[0] * move[1] - state.link[b]);
    const double mean = 0.5 * (state.mean[b][0] + state.mean[b][1]);
    const double spread = std::sqrt(0.5 * (state.spread[b][0] + state.spread[b][1]));
    const double stillness =
        1.0 - smooth_step(kStillFrom, kStillTo, spread / (mean + 1e-12));
    // Two envelopes that do not move at all agree by default: stillness
    // already says what they are.
    const double both = std::sqrt(state.spread[b][0] * state.spread[b][1]);
    const double agreement = both > 1e-30 ? state.link[b] / both : 1.0;
    const double diffuse = 1.0 - smooth_step(kDiffuseFrom, kDiffuseTo, agreement);

    const double share = std::max(stillness, diffuse) *
                         smooth_step(kQuietFromDb, kQuietToDb, bed);
    state.share[b] += design.a_share * (share - state.share[b]);
    share_sum += state.share[b];

    double want = target_db * state.share[b] * on_bed;
    if (std::fabs(want) < kSettledDb) want = 0.0;
    double& gain_db = state.gain_db[b];
    const bool toward_unity = std::fabs(want) < std::fabs(gain_db);
    gain_db += (toward_unity ? design.a_gain_toward : design.a_gain_away) *
               (want - gain_db);
    if (want == 0.0 && std::fabs(gain_db) < kSettledDb) gain_db = 0.0;
    glide_gain(state.gain[b], state.step[b], gain_db, samples);
    if (std::fabs(gain_db) > std::fabs(report.environment_db)) {
      report.environment_db = static_cast<float>(gain_db);
    }
  }
  report.ambience = std::max(
      report.ambience, static_cast<float>(share_sum / kEnvironmentBands));
}

bool environment_idle(const EnvironmentState& state) {
  for (int b = 0; b < kEnvironmentBands; ++b) {
    if (state.gain_db[b] != 0.0 || state.gain[b] != 1.0 || state.step[b] != 0.0) {
      return false;
    }
  }
  return true;
}

void environment_apply(const EnvironmentDesign& design, EnvironmentState& state,
                       double* frame, uint32_t channels, int lfe) {
  for (int b = 0; b < kEnvironmentBands; ++b) {
    state.gain[b] += state.step[b];
  }
  const double k_low = state.gain[0] - 1.0;
  const double k_mid = state.gain[1] - 1.0;
  const double k_high = state.gain[2] - 1.0;
  for (uint32_t c = 0; c < channels; ++c) {
    if (static_cast<int>(c) == lfe) continue;
    const double x = frame[c];
    const double low = split_low(design.split_low_c, state.split_low[c], x);
    const double rest = x - low;
    const double mid = split_low(design.split_high_c, state.split_high[c], rest);
    frame[c] = x + k_low * low + k_mid * mid + k_high * (rest - mid);
  }
}

}  // namespace feq_footsteps_detail
