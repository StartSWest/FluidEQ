/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/dynamics.h"

#include <cmath>

namespace {

/**
 * How far above the threshold the band reaches full strength, in dB.
 *
 * A soft knee by another name. Twelve, because a resonance worth catching
 * typically sits ten to fifteen decibels above the level around it: a shorter
 * range makes the band snap on and off audibly, and a longer one never quite
 * arrives on the peaks it was set for.
 */
constexpr double kRangeDb = 12.0;

/**
 * Fast enough for a sibilant, slow enough not to chatter on a bass note.
 *
 * 5 ms of attack catches the front of an "s"; anything faster starts tracking
 * individual cycles down low and modulates them. 80 ms of release is under the
 * gap between syllables and well over one cycle at 50 Hz, so the band lets go
 * between words without pumping in time with the music.
 */
constexpr double kAttackMs = 5.0;
constexpr double kReleaseMs = 80.0;

/**
 * The smallest change a band has to make before it is worth reacting at all.
 *
 * The detector divides the band's change by how much a full-strength band
 * would change, which is also a multiplication of whatever noise is present:
 * at an earlier floor of 0.0001 that factor reached ten thousand, and the
 * residue a biquad holds after a track has stopped was enough to cross the
 * threshold and let go again several times a second. That is what the curve
 * going wild with nothing playing was.
 */
constexpr double kMinSwing = 0.02;

/**
 * An absolute floor under the detector, in linear amplitude.
 *
 * The swing limit bounds how far noise can be amplified; this says what counts
 * as noise in the first place. -100 dBFS is far below anything a record
 * contains and far above what a silent filter leaves behind.
 */
constexpr double kSilence = 1e-5;

/** The linear ratio the range works out to, so no sample needs a logarithm. */
double range_ratio() { return std::pow(10.0, kRangeDb / 20.0); }

/**
 * One-pole coefficient: after `ms` the envelope has travelled 1 - 1/e of the
 * distance, which is the usual meaning of an attack or release time.
 */
double coefficient_for(double ms, double sample_rate) {
  return std::exp(-1.0 / ((ms / 1000.0) * sample_rate));
}

}  // namespace

extern "C" {

void feq_band_dynamics_init(FeqBandDynamics* state) {
  if (state == nullptr) {
    return;
  }
  state->active = 0;
  state->threshold = 1.0;
  state->normalise = 1.0;
  state->attack = 0.0;
  state->release = 0.0;
  state->envelope = 0.0;
  state->amount = 0.0;
}

void feq_band_dynamics_refresh(FeqBandDynamics* state,
                               int rack_enabled,
                               int band_enabled,
                               int band_dynamic,
                               double gain_db,
                               double threshold_db,
                               double sample_rate) {
  if (state == nullptr) {
    return;
  }
  const double swing = std::fabs(std::pow(10.0, gain_db / 20.0) - 1.0);
  // A band with no gain changes nothing, so there is nothing to detect and
  // nothing to scale. Dividing by that swing would be a division by zero.
  state->active = (rack_enabled != 0 && band_dynamic != 0 &&
                   band_enabled != 0 && swing > kMinSwing)
                      ? 1
                      : 0;
  state->threshold = std::pow(10.0, threshold_db / 20.0);
  state->normalise = state->active != 0 ? 1.0 / swing : 1.0;
  state->attack = coefficient_for(kAttackMs, sample_rate);
  state->release = coefficient_for(kReleaseMs, sample_rate);
  if (state->active == 0) {
    state->amount = 0.0;
  }
}

double feq_band_dynamic_amount(FeqBandDynamics* state, double difference) {
  if (state == nullptr) {
    return 0.0;
  }
  const double raw = std::fabs(difference);
  // Silence is silence whatever it is multiplied by.
  const double level = raw < kSilence ? 0.0 : raw * state->normalise;
  const double coefficient =
      level > state->envelope ? state->attack : state->release;
  state->envelope = level + (state->envelope - level) * coefficient;
  const double over = state->envelope - state->threshold;
  if (over <= 0.0) {
    return 0.0;
  }
  // Linear in amplitude between the threshold and the top of the range, which
  // is close enough to linear in dB across twelve of them and costs no
  // logarithm per sample.
  const double span = state->threshold * (range_ratio() - 1.0);
  return over >= span ? 1.0 : over / span;
}

}  // extern "C"
