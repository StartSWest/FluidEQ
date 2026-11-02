/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/spectrumEnergy.ts`, `energyPulse.ts` and `voiceReading.ts`:
// one hop of the music as every drawing hears it.

#include "fluideq/scene/spectrum_energy.h"

#include <algorithm>
#include <cmath>

namespace feq::scene {
namespace {

// The flywheel the music winds (`spectrumEnergy.ts`).
constexpr double kRunMaxTurns = 0.085;
constexpr double kRunKick = 0.03;
constexpr double kRunDrive = 0.01;
constexpr double kRunCoastS = 6.0;

// The pulse and the accent (`energyPulse.ts`).
constexpr double kBeatFlashMs = 200.0;
constexpr double kBeatRefractoryMs = 250.0;
constexpr double kBeatSpacing = 0.66;
constexpr double kBeatClockSure = 0.3;
constexpr double kBeatClockLeads = 0.5;
constexpr double kOnBeat = 0.2;
constexpr double kDrumsLatelyMs = 2500.0;
constexpr double kBeatFluxMargin = 1.6;
constexpr double kMinOnsetFlux = 0.002;
constexpr double kAccentDwarfs = 2.0;
constexpr double kAccentTallHalfLifeMs = 3000.0;
constexpr double kAccentGapMs = 7000.0;
constexpr double kAccentLevel = 0.55;
constexpr double kAccentFallMs = 1500.0;
constexpr double kAccentRiseMs = 300.0;

// The singing voice (`voiceReading.ts`).
constexpr double kLowHz = 200.0;
constexpr double kTopHz = 4000.0;
constexpr double kVoiceLowHz = 80.0;
constexpr double kVoiceHighHz = 1000.0;
const double kPitchStep = std::pow(2.0, 1.0 / 48.0);
constexpr int kMostHarmonics = 12;
constexpr int kFewestHarmonics = 3;
constexpr double kCombFloor = 0.8;
constexpr double kCombFull = 1.2;
constexpr std::size_t kLineHops = 7;
constexpr double kLineStepSemitones = 0.6;
constexpr double kLineFrom = 0.5;
constexpr double kLineFull = 0.85;
constexpr double kOpenReleaseMs = 70.0;
constexpr double kGateOpenMs = 30.0;
constexpr double kGateCloseMs = 120.0;
constexpr double kOpenDepthDb = 30.0;
constexpr double kLoudestReleaseDbS = 3.0;
constexpr double kSureMs = 250.0;
constexpr double kPitchMs = 25.0;

double clamp01(double value) { return std::max(0.0, std::min(1.0, value)); }

double pulse_of(const PulseState& state) {
  return state.flash_left_ms > 0.0 ? state.flash_left_ms / kBeatFlashMs : 0.0;
}

double voice_at(const std::vector<float>& values, double bin) {
  const double whole = std::floor(bin);
  if (whole < 0.0 || whole + 1.0 >= static_cast<double>(values.size())) {
    return 0.0;
  }
  const auto at = static_cast<std::size_t>(whole);
  const double part = bin - whole;
  return static_cast<double>(values[at]) * (1.0 - part) +
         static_cast<double>(values[at + 1]) * part;
}

struct Note {
  double hz;
  double clearness;
};

Note clearest_note(const std::vector<float>& centre, double bin_hz,
                   double mean) {
  double best = 0.0;
  double best_hz = 0.0;
  for (double f0 = kVoiceLowHz; f0 <= kVoiceHighHz; f0 *= kPitchStep) {
    double standing = 0.0;
    int counted = 0;
    for (double harmonic = std::ceil(kLowHz / f0);
         harmonic * f0 <= kTopHz && counted < kMostHarmonics; harmonic += 1.0) {
      const double hz = harmonic * f0;
      const double peak = voice_at(centre, hz / bin_hz);
      const double trough = 0.5 * (voice_at(centre, (hz - f0 / 2.0) / bin_hz) +
                                   voice_at(centre, (hz + f0 / 2.0) / bin_hz));
      standing += peak - trough;
      ++counted;
    }
    if (counted >= kFewestHarmonics && standing / counted > best) {
      best = standing / counted;
      best_hz = f0;
    }
  }
  return {best_hz, mean > 0.0 ? best / mean : 0.0};
}

void follow_pulse(PulseState& state, const RhythmState& rhythm,
                  const SceneRhythm& heard, double level, double step_ms) {
  const double broad = rhythm.step.broad;
  const double memory = ease_factor(step_ms, 700.0);
  const double excess = std::abs(broad - state.flux_mean);
  state.flux_mean += (broad - state.flux_mean) * memory;
  state.flux_variation += (excess - state.flux_variation) * memory;
  const auto stands_out = [&](double margin) {
    return broad > state.flux_mean + margin * state.flux_variation &&
           broad > kMinOnsetFlux;
  };
  state.since_beat_ms += step_ms;
  state.since_accent_ms += step_ms;
  const bool onset = rhythm.step.drums_since_ms < kDrumsLatelyMs
                         ? rhythm.step.kick || rhythm.step.snare
                         : stands_out(kBeatFluxMargin);
  const bool clock_sure =
      rhythm.tempo > 0.0 && rhythm.confidence >= kBeatClockSure;
  const double period = clock_sure ? 60000.0 / rhythm.tempo : state.beat_gap_ms;
  const bool spaced = state.since_beat_ms >=
                      std::max(kBeatRefractoryMs, kBeatSpacing * period);
  const bool new_beat = rhythm.beats > state.clock_beats;
  state.clock_beats = rhythm.beats;
  if (!heard.running || !clock_sure) {
    state.clock_leads = false;
  } else if (rhythm.confidence >= kBeatClockLeads) {
    state.clock_leads = true;
  }
  bool pulse = false;
  if (state.clock_leads) {
    pulse = new_beat && spaced;
  } else {
    const bool near_beat =
        !clock_sure ||
        std::abs(rhythm.phase - js_round(rhythm.phase)) <= kOnBeat;
    pulse = onset && near_beat && spaced;
  }
  if (pulse) {
    state.beat_gap_ms += (state.since_beat_ms - state.beat_gap_ms) * 0.25;
    state.beat_gap_ms = std::max(250.0, std::min(1500.0, state.beat_gap_ms));
    state.since_beat_ms = 0.0;
    state.flash_left_ms = kBeatFlashMs;
  } else {
    state.flash_left_ms -= step_ms;
  }
  const bool dwarfs =
      broad > kMinOnsetFlux && broad > kAccentDwarfs * state.tall_onset;
  state.tall_onset = std::max(
      broad, state.tall_onset * std::pow(2.0, -step_ms / kAccentTallHalfLifeMs));
  const bool dropped = heard.drop_serial != state.drop_serial;
  state.drop_serial = heard.drop_serial;
  if ((dropped && state.since_accent_ms >= kAccentFallMs) ||
      (dwarfs && level >= kAccentLevel &&
       state.since_accent_ms >= kAccentGapMs)) {
    state.since_accent_ms = 0.0;
    state.accent_serial = js_mod(state.accent_serial + 1.0, 4096.0);
  }
  const double wanted = state.since_accent_ms < kAccentFallMs ? 1.0 : 0.0;
  const double shape = ease_factor(
      step_ms, wanted > state.accent ? kAccentRiseMs : kAccentFallMs / 3.0);
  state.accent += (wanted - state.accent) * shape;
  if (state.accent < 0.002) {
    state.accent = 0.0;
  }
}

double turn_run(double run, double speed, double elapsed_ms) {
  return js_mod(
      run + speed * (std::max(0.0, std::min(200.0, elapsed_ms)) / 1000.0), 1.0);
}

void coast(EnergyState& state, double step_ms, double kick, double drive) {
  const double seconds = step_ms / 1000.0;
  const double wound =
      state.run_speed + (kick * kRunKick + drive * kRunDrive) * seconds;
  state.run_speed =
      std::min(kRunMaxTurns, wound * std::exp(-seconds / kRunCoastS));
  state.run = turn_run(state.run, state.run_speed, step_ms);
}

}  // namespace

void follow_voice(VoiceState& state, const SoundHop& hop, double step_ms) {
  const auto& mid = hop.voice_mid;
  const auto& side = hop.voice_side;
  const double bin_hz = hop.low_bin_hz;
  if (state.centre.size() != mid.size()) {
    state.centre.assign(mid.size(), 0.0F);
  }
  auto& centre = state.centre;
  const auto from = static_cast<std::ptrdiff_t>(std::ceil(kLowHz / bin_hz));
  const auto to = std::min(static_cast<std::ptrdiff_t>(mid.size()) - 1,
                           static_cast<std::ptrdiff_t>(std::floor(kTopHz / bin_hz)));
  double sum = 0.0;
  double power = 0.0;
  for (std::size_t bin = 0; bin < mid.size(); ++bin) {
    const double shared =
        std::max(0.0, std::pow(10.0, static_cast<double>(mid[bin]) / 10.0) -
                          std::pow(10.0, static_cast<double>(side[bin]) / 10.0));
    centre[bin] = static_cast<float>(std::sqrt(shared));
    const auto index = static_cast<std::ptrdiff_t>(bin);
    if (index >= from && index <= to) {
      sum += static_cast<double>(centre[bin]);
      power += shared;
    }
  }
  const double mean =
      sum / static_cast<double>(std::max<std::ptrdiff_t>(1, to - from + 1));
  const Note note = clearest_note(centre, bin_hz, mean);
  state.harmonicity = note.clearness;
  state.line.push_back(note.hz > 0.0 ? 12.0 * std::log2(note.hz / kVoiceLowHz)
                                     : -99.0);
  if (state.line.size() > kLineHops) {
    state.line.pop_front();
  }
  double held = 0.0;
  for (std::size_t at = 1; at < state.line.size(); ++at) {
    if (std::abs(state.line[at] - state.line[at - 1]) <= kLineStepSemitones) {
      held += 1.0;
    }
  }
  const double holding = held / static_cast<double>(kLineHops - 1);
  const double voiced =
      clamp01((holding - kLineFrom) / (kLineFull - kLineFrom)) *
      clamp01((note.clearness - kCombFloor) / (kCombFull - kCombFloor));
  const double db = 10.0 * std::log10(std::max(1e-12, power));
  if (voiced > 0.0) {
    state.loudest_db =
        state.loudest_db.has_value()
            ? std::max(db, *state.loudest_db -
                               (kLoudestReleaseDbS * step_ms) / 1000.0)
            : db;
  }
  const double placed =
      state.loudest_db.has_value()
          ? std::max(0.0, std::min(1.0, (db - *state.loudest_db + kOpenDepthDb) /
                                            kOpenDepthDb))
          : 0.0;
  state.gate += (voiced - state.gate) *
                ease_factor(step_ms, voiced > state.gate ? kGateOpenMs
                                                         : kGateCloseMs);
  const double open = placed * state.gate;
  state.open = open >= state.open
                   ? open
                   : state.open + (open - state.open) *
                                      ease_factor(step_ms, kOpenReleaseMs);
  if (voiced >= 0.5) {
    state.pitch_hz = note.hz;
    const double pitch = std::log2(note.hz / kVoiceLowHz) /
                         std::log2(kVoiceHighHz / kVoiceLowHz);
    state.pitch += (pitch - state.pitch) * ease_factor(step_ms, kPitchMs);
  }
  state.sure += (voiced - state.sure) * ease_factor(step_ms, kSureMs);
}

void hear_hop(EnergyState& state, const SoundHop& hop, double lost_ms) {
  for (std::size_t at = 0; at < state.bands.size(); ++at) {
    state.bands[at] = static_cast<double>(hop.bands[at]);
  }
  const double step_ms = hop.step_ms + lost_ms;
  const double step = std::max(1.0, std::min(200.0, step_ms));
  follow_levels(state.levels, hop, step);
  follow_voice(state.voice, hop, step);
  state.heard = advance_rhythm(state.rhythm, state.bands, hop, step_ms);
  follow_pulse(state.pulse, state.rhythm, state.heard, state.levels.level, step);
  coast(state, step, pulse_of(state.pulse) * (0.3 + 0.7 * state.levels.bass),
        state.levels.level * state.levels.level);
}

SpectrumEnergy read_energy(const EnergyState& state) {
  SpectrumEnergy energy;
  energy.level = state.levels.level;
  energy.bass = state.levels.bass;
  energy.mid = state.levels.mid;
  energy.treble = state.levels.treble;
  energy.beat = pulse_of(state.pulse);
  energy.accent = state.pulse.accent;
  energy.accent_serial = state.pulse.accent_serial;
  energy.run = state.run;
  energy.run_speed = state.run_speed;
  energy.rhythm = state.heard;
  energy.voice = {state.voice.open, state.voice.pitch, state.voice.sure};
  return energy;
}

}  // namespace feq::scene
