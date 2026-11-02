/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

// `src/common/sceneRhythm.ts`: one hop of the music's time, from its bands
// and its bins, for a drawing that hears the music playing.

#include <algorithm>
#include <cmath>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"

namespace feq::scene {
namespace {

constexpr double kMaxStepMs = 200.0;
constexpr double kSilentFadeMs = 1000.0;
constexpr double kPatternSure = 0.4;
constexpr double kAudible = 0.2;
constexpr double kNewSongQuietMs = 1500.0;

SceneRhythm read(const RhythmState& state, bool running) {
  const double in_bar =
      js_mod(js_mod(state.beats - static_cast<double>(state.down_slot), 4.0) +
                 4.0,
             4.0);
  SceneRhythm rhythm;
  rhythm.beat_phase = state.phase;
  rhythm.bar_phase = (in_bar + state.phase) / 4.0;
  rhythm.tempo = state.tempo;
  rhythm.confidence = state.confidence;
  rhythm.kick = state.kit[Drum::kKick].envelope;
  rhythm.snare = state.kit[Drum::kSnare].envelope;
  rhythm.hat = state.kit[Drum::kHat].envelope;
  rhythm.intensity = intensity_of(state.section);
  rhythm.build = state.section.build;
  rhythm.drop = state.section.drop;
  rhythm.drop_serial = state.section.drop_serial;
  rhythm.running = running;
  return rhythm;
}

void start_song(RhythmState& state) {
  restart_clock(state);
  state.frames.clear();
  state.band_tops.fill(0.0F);
  state.spectrum_drums = SpectrumDrumState{};
  restart_kit(state.kit);
  const double drop_serial = state.section.drop_serial;
  state.section = SectionState{};
  state.section.drop_serial = drop_serial;
}

void listen_to_drums(RhythmState& state, const std::array<double, 3>& features,
                     const Bands& bands, double step) {
  const bool sure = state.tempo > 0.0 && state.confidence >= kPatternSure;
  std::optional<KitClock> clock;
  if (sure) {
    clock = KitClock{state.beats,
                     state.phase + (step * state.tempo) / 60000.0,
                     state.tempo};
  }
  const auto shown =
      hear_kit(state.kit, features, bands, state.clock_ms, clock, step);
  state.step.kick = shown[0];
  state.step.snare = shown[1];
  state.step.drums_since_ms =
      std::min(state.kit[Drum::kKick].shown_since_ms,
               state.kit[Drum::kSnare].shown_since_ms);
}

SceneRhythm hold_quiet(RhythmState& state, double quiet_ms) {
  if (quiet_ms > 0.0) {
    const double keep = 1.0 - ease_factor(quiet_ms, kSilentFadeMs);
    state.confidence *= keep;
    quiet_section(state.section, quiet_ms, keep);
    quiet_kit(state.kit, quiet_ms);
  }
  state.frames.clear();
  state.spectrum_drums.frames.clear();
  return read(state, false);
}

}  // namespace

SceneRhythm advance_rhythm(RhythmState& state, const Bands& bands,
                           const SoundHop& hop, double elapsed_ms) {
  state.step.kick = false;
  state.step.snare = false;
  state.step.broad = 0.0;
  const double quiet = std::max(0.0, elapsed_ms);
  double loudest = 0.0;
  for (const double band : bands) {
    loudest = std::max(loudest, band);
  }
  const bool audible = loudest >= kAudible;
  if (!audible) {
    state.quiet_ms += quiet;
    if (state.quiet_ms >= kNewSongQuietMs) {
      return hold_quiet(state, quiet);
    }
  }
  if (elapsed_ms > kMaxStepMs) {
    state.aligned = false;
  }
  const double step = std::max(1.0, std::min(kMaxStepMs, elapsed_ms));
  if (audible) {
    if (state.quiet_ms >= kNewSongQuietMs) {
      start_song(state);
    }
    state.quiet_ms = 0.0;
  }
  state.clock_ms += step;
  follow_band_tops(state.band_tops, bands, step);
  const Bands rises = gate_rises(band_rises(state.frames, state.clock_ms, bands),
                                 bands, state.band_tops);
  const Bands stepped =
      gate_rises(step_rises(state.frames, bands), bands, state.band_tops);
  keep_band_frame(state.frames, state.clock_ms, bands);
  const DrumFeatures drums = drum_features(rises);
  state.step.broad = drums.broad;
  listen_to_drums(state, read_spectrum_drums(state.spectrum_drums,
                                             state.clock_ms, hop),
                  bands, step);
  hold_onset(state.tempo_onsets, tempo_strength(rises, bands), step);
  keep_onset(state.beat_onsets,
             beat_strength(stepped, state.kit[Drum::kKick].detector.peak,
                           state.kit[Drum::kSnare].detector.peak),
             step);
  follow_clock(state, step, drums.kick - 0.5 * drums.snare);
  follow_section(state.section, bands, step, audible,
                 state.kit[Drum::kKick].detector.since_ms < 500.0);
  return read(state, true);
}

}  // namespace feq::scene
