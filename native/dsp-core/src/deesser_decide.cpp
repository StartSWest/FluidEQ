/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The De-esser's decision, once a control tick (about 4 kHz): how sure it is
 * that what it hears is a voice, what each band should be cut by, and what the
 * page is told. The listening it reads is `deesser_process.cpp`'s.
 *
 * Every number here was measured on the test scene (`deesser_scene.h`), each
 * tell read per S and per lone hi-hat until the two came apart: the S losing
 * 4 dB on average and 6 at its peak, a hi-hat panned or centred under 0.15,
 * vowels 0.01, the same at 44.1 and at 384 kHz.
 */
#include "deesser_internal.h"

namespace feq_deesser {
namespace {

/** A band's bed: seconds to rise, so an S never becomes its own bed. */
constexpr double kReferenceRiseS = 2.0;
constexpr double kReferenceFallS = 0.4;
/**
 * How much higher a sound that is surely not a voice has to stand before it
 * is cut, at Keep cymbals 100% (28 dB at the 70% of Vocal music). A loud
 * hi-hat on the scene stood up to 24 dB over the threshold a voice's S is
 * held to; 21 dB still let the loudest lose 2.
 */
constexpr double kSpareDb = 40.0;
/** Above the threshold, the cut takes 5/6 of the overshoot: ratio 6:1. */
constexpr double kSlope = 1.0 - 1.0 / 6.0;
constexpr double kKneeDb = 6.0;
/** A cut under this is none. */
constexpr double kNoCutDb = 0.01;
/** Below this a band is silence, whatever the song around it does. */
constexpr double kFloorDb = -80.0;
/**
 * How fast a cut lets go when the layout under it is about to move, or when
 * what it was cutting turned out not to be a voice (confidence under 0.3).
 */
constexpr double kDrainMs = 8.0;
constexpr double kNotVoice = 0.3;
/**
 * The centre's share of the listening range at which a sound reads as off to
 * a side and as surely centred. A hi-hat 9 dB louder on one side reads 0.85,
 * which is why this tell alone spares nothing but the widest pans.
 */
constexpr double kCentreFrom = 0.55;
constexpr double kCentreSure = 0.9;
/**
 * How far under the listening range the air lies, per octave, before a sound
 * reads as a cymbal and as surely an S. On the scene a hi-hat read -2.5 dB
 * (air louder than the range) and an S +1.5; an S's first milliseconds +6.
 */
constexpr double kAirFrom = -3.0;
constexpr double kAirSure = 1.0;
/**
 * The air reading falls toward "cymbal" in 2 ms and rises toward "voice" over
 * 10: a hi-hat is over in 40 ms and has to be seen at once, and an S is long
 * enough to prove itself.
 */
constexpr double kAirFallMs = 2.0;
constexpr double kAirRiseMs = 10.0;
/** A strike holds the onset low for a closed hi-hat's whole decay. */
constexpr double kTransientHoldMs = 50.0;
/** A rise is timed from 6 dB under the lowest threshold. */
constexpr double kSignificanceDb = -6.0;

/** The cut a band takes for standing `over` dB above its threshold. */
double knee(double over) {
  if (over <= -kKneeDb / 2.0) {
    return 0.0;
  }
  if (over < kKneeDb / 2.0) {
    const double into = over + kKneeDb / 2.0;
    return kSlope * into * into / (2.0 * kKneeDb);
  }
  return kSlope * over;
}

/** A per-tick step for a time constant in ms. */
double tick_step(double frames, double ms, double rate) {
  return 1.0 - std::exp(-frames * 1000.0 / (ms * rate));
}

}  // namespace

bool letting_go(const Run& run) {
  for (uint32_t band = 0; band < run.applied.bands; ++band) {
    if (run.cut_db[band] > 0.01 || run.gain_to[band] < 0.999) {
      return true;
    }
  }
  return run.whole_cut_db > 0.01 || run.whole_to < 0.999;
}

void start_report(Run& run) {
  FeqDeEsserReport& report = run.report;
  report.reduction_db = 0.0f;
  report.frequency_hz = 0.0f;
  report.confidence = 0.0f;
  report.sibilance_db = -120.0f;
  for (uint32_t band = 0; band < kMaxBands; ++band) {
    report.band_level_db[band] = -120.0f;
    report.band_cut_db[band] = 0.0f;
  }
}

void tick(FeqDeEsser* deesser) {
  Run& run = deesser->run;
  const Layout& layout = run.applied;
  const double rate = deesser->sample_rate;
  const auto frames = static_cast<double>(run.tick_length);
  const double rise = 1.0 - std::exp(-frames / (kReferenceRiseS * rate));
  const double fall = 1.0 - std::exp(-frames / (kReferenceFallS * rate));
  const bool draining = deesser->has_pending || layout.settings.enabled == 0;
  const double attack = tick_step(frames, layout.settings.attack_ms, rate);
  const double release = tick_step(
      frames, deesser->has_pending ? kDrainMs : layout.settings.release_ms,
      rate);
  const double let_go = tick_step(frames, kDrainMs, rate);

  const double body_db = db(std::max(run.body_power, run.body_quick));
  double loudest = 0.0;
  double range = 0.0;
  for (uint32_t band = 0; band < layout.bands; ++band) {
    loudest = std::max(loudest, run.energy[band]);
    range += run.energy[band];
  }

  // How sure it is that this is a voice, from the three tells the levels
  // cannot give.
  double centre_share = 1.0;
  if (run.lanes.compare_sides) {
    const double both = run.region_mid_power + run.region_side_power;
    centre_share =
        both > kTiny ? clamp01((run.region_mid_power / both - kCentreFrom) /
                               (kCentreSure - kCentreFrom))
                     : 1.0;
  }
  double shape = 1.0;
  if (layout.has_air && loudest > kTiny) {
    const double under = db(range) - db(run.air_power * layout.air_per_range);
    const double smooth_ms = under < run.air_under_db ? kAirFallMs : kAirRiseMs;
    run.air_under_db +=
        (under - run.air_under_db) * tick_step(frames, smooth_ms, rate);
    shape = clamp01((run.air_under_db - kAirFrom) / (kAirSure - kAirFrom));
  }
  // The onset: the most struck rise since the last tick, held low for a hit's
  // length so the tail of a hi-hat is not taken for the start of an S.
  const double onset_now = run.tick_onset;
  run.tick_onset = 1.0;
  if (onset_now <= run.onset_held) {
    run.onset_held = onset_now;
    run.transient_hold = static_cast<uint32_t>(
        std::lround(kTransientHoldMs * rate / 1000.0 / frames));
  } else if (run.transient_hold > 0) {
    --run.transient_hold;
  } else {
    run.onset_held = onset_now;
  }
  // The three tells' geometric mean: any one that is sure it is not a voice
  // makes it not a voice, and one that is unsure costs a real S less than a
  // plain product would.
  const double confidence = std::cbrt(centre_share * shape * run.onset_held);
  // A sound that is not a voice is spared by having to stand higher before
  // it is cut, not by a share of its cut: a loud hi-hat that kept a third of
  // its overshoot still lost 3 dB, which is the dulling this stage is for.
  const double spare_db =
      layout.settings.keep_cymbals * (1.0 - confidence) * kSpareDb;

  double target[kMaxBands] = {};
  double threshold[kMaxBands] = {};
  for (uint32_t band = 0; band < layout.bands; ++band) {
    const double energy = run.energy[band];
    double& reference = run.reference[band];
    reference += (energy - reference) * (energy > reference ? rise : fall);
    threshold[band] =
        std::max({body_db + layout.body_threshold_db,
                  db(reference) + layout.self_threshold_db, kFloorDb});
    target[band] = std::min(layout.settings.range_db,
                            knee(db(energy) - threshold[band] - spare_db));
  }
  // Where a rise starts to be timed: 6 dB under the lowest threshold, as the
  // sum of the bands a broadband sound fills.
  double lowest = threshold[0];
  for (uint32_t band = 1; band < layout.bands; ++band) {
    lowest = std::min(lowest, threshold[band]);
  }
  run.significance = static_cast<double>(layout.bands) *
                     std::pow(10.0, (lowest + kSignificanceDb) / 10.0);

  double spread[kMaxBands] = {};
  for (uint32_t to = 0; to < layout.bands; ++to) {
    double most = 0.0;
    for (uint32_t from = 0; from < layout.bands; ++from) {
      most = std::max(most, target[from] * layout.spread[from][to]);
    }
    spread[to] = draining || run.warming > 0 ? 0.0 : most;
  }
  if (run.warming > 0) {
    --run.warming;
  }

  double deepest = 0.0;
  double weighted_log_hz = 0.0;
  double weights = 0.0;
  for (uint32_t band = 0; band < layout.bands; ++band) {
    double& cut = run.cut_db[band];
    if (spread[band] > cut) {
      // Not while a rise is being timed: a hi-hat cut in the millisecond
      // before it was known to be one went on losing 2 to 4 dB through its
      // release. The look-ahead covers the wait.
      if (!run.rising) {
        cut += (spread[band] - cut) * attack;
      }
    } else {
      cut += (spread[band] - cut) * (confidence < kNotVoice ? let_go : release);
    }
    // A release never reaches zero on its own, and a vowel's top harmonic
    // grazing the bottom of the knee asked for 0.0007 dB. A hundredth of a
    // decibel is a tenth of a percent of one band, far under hearing; under
    // it is no cut, and that is what makes the stage at rest give back
    // exactly the samples it was handed.
    if (cut < kNoCutDb) {
      cut = 0.0;
    }
    run.gain_from[band] = run.gain_to[band];
    run.gain_to[band] = std::pow(10.0, -cut / 20.0);
    deepest = std::max(deepest, cut);
    weighted_log_hz += cut * std::log(layout.hz[band]);
    weights += cut;
  }
  run.whole_cut_db = deepest;
  run.whole_from = run.whole_to;
  run.whole_to = std::pow(10.0, -deepest / 20.0);

  // What the page draws, folded over the block.
  FeqDeEsserReport& report = run.report;
  report.band_count = layout.bands;
  const auto sibilance = static_cast<float>(db(loudest) - body_db);
  const auto tells = [&]() {
    report.confidence = static_cast<float>(confidence);
    report.centre = static_cast<float>(centre_share);
    report.shape = static_cast<float>(shape);
    report.onset = static_cast<float>(run.onset_held);
  };
  if (deepest > -report.reduction_db) {
    report.reduction_db = static_cast<float>(-deepest);
    report.frequency_hz =
        weights > 1e-9 ? static_cast<float>(std::exp(weighted_log_hz / weights))
                       : 0.0f;
    tells();
  } else if (report.reduction_db == 0.0f && sibilance > report.sibilance_db) {
    tells();
  }
  report.sibilance_db = std::max(report.sibilance_db, sibilance);
  for (uint32_t band = 0; band < layout.bands; ++band) {
    report.band_hz[band] = static_cast<float>(layout.hz[band]);
    report.band_level_db[band] = std::max(
        report.band_level_db[band], static_cast<float>(db(run.energy[band])));
    // The threshold as it was applied, the sparing included: what the page
    // draws a band's level against.
    report.band_threshold_db[band] =
        static_cast<float>(threshold[band] + spare_db);
    report.band_cut_db[band] = std::min(report.band_cut_db[band],
                                        static_cast<float>(-run.cut_db[band]));
  }
}

}  // namespace feq_deesser
