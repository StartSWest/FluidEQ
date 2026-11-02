/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cmath>
#include <cstddef>
#include <deque>
#include <optional>
#include <vector>

#include "fluideq/scene/sound_hops.h"

/*
 * The music's time — its tempo, its beat and bar, its drums and the shape of
 * the song — as the scenes are handed it: the C++ twin of
 * `src/common/sceneRhythm.ts` and the files it is built from
 * (`rhythmClock.ts`, `rhythmTempo.ts`, `rhythmDrums.ts`, `rhythmKit.ts`,
 * `rhythmPattern.ts`, `rhythmSection.ts`, `rhythmSpectrum.ts`).
 *
 * The TypeScript keeps some of its state in Float32Arrays and the rest in
 * JavaScript numbers; each is a float or a double here, at the same places,
 * and every rounding is JavaScript's (`js_round`, `js_mod`), so the two
 * decide the same beats from the same sound (`scene_core_parity_test.cpp`).
 */

namespace feq::scene {

/** JavaScript's Math.round: half rounds up, -0.5 to 0, never away from zero. */
inline double js_round(double value) { return std::floor(value + 0.5); }
/** JavaScript's %, on doubles: the sign of the dividend. */
inline double js_mod(double value, double by) { return std::fmod(value, by); }

/** `rhythmDrums.ts`. */
struct BandFrame {
  double at_ms = 0.0;
  std::array<double, kRhythmBandCount> bands{};
};

struct HitDetector {
  double floor = 0.02;
  double spread = 0.02;
  double peak = 0.0;
  double hit_top = 0.0;
  double since_ms = 1000.0;
};

struct HitRule {
  double margin;
  double share;
  double refractory_ms;
};

struct DrumFeatures {
  double kick = 0.0;
  double snare = 0.0;
  double hat = 0.0;
  double broad = 0.0;
};

using Bands = std::array<double, kRhythmBandCount>;

void keep_band_frame(std::deque<BandFrame>& frames, double at_ms,
                     const Bands& bands);
Bands band_rises(const std::deque<BandFrame>& frames, double at_ms,
                 const Bands& bands);
void follow_band_tops(std::array<float, kRhythmBandCount>& tops,
                      const Bands& bands, double step_ms);
Bands gate_rises(const Bands& rises, const Bands& bands,
                 const std::array<float, kRhythmBandCount>& tops);
Bands step_rises(const std::deque<BandFrame>& frames, const Bands& bands);
DrumFeatures drum_features(const Bands& rises);
double beat_strength(const Bands& rises, double kick_height,
                     double snare_height);
double tempo_strength(const Bands& rises, const Bands& bands);
double listen_for(HitDetector& detector, double feature, double step_ms,
                  const HitRule& rule, double bias);

/** `rhythmPattern.ts`: where in the bar each drum lands, learnt. */
inline constexpr std::size_t kPatternSlots = 48;
struct DrumPattern {
  std::array<float, kPatternSlots> hits{};
  double bars = 0.0;
};
std::size_t slot_of(double beats, double phase, double tempo);
double pattern_bias(const DrumPattern& pattern, std::size_t slot);
void learn_hit(DrumPattern& pattern, std::size_t slot, double stood_over);
void follow_pattern(DrumPattern& pattern, double beats);

/** `rhythmKit.ts`. */
enum class Drum : std::size_t { kKick = 0, kSnare = 1, kHat = 2 };
struct DrumCheck {
  double at_ms;
  double before_db;
  double peak_db;
};
struct KitDrum {
  HitDetector detector;
  DrumPattern pattern;
  double envelope = 0.0;
  double presence = 1.0;
  std::vector<DrumCheck> checks;
  std::deque<double> earlier_db;
  double shown_since_ms = 60000.0;
};
struct DrumKit {
  std::array<KitDrum, 3> drums;
  KitDrum& operator[](Drum drum) { return drums[static_cast<std::size_t>(drum)]; }
  const KitDrum& operator[](Drum drum) const {
    return drums[static_cast<std::size_t>(drum)];
  }
};
struct KitClock {
  double beats;
  double phase;
  double tempo;
};
DrumKit create_drum_kit();
/** Which drums are shown this step: kick, snare, hat. */
std::array<bool, 3> hear_kit(DrumKit& kit, const std::array<double, 3>& features,
                             const Bands& bands, double at_ms,
                             const std::optional<KitClock>& clock,
                             double step_ms);
void quiet_kit(DrumKit& kit, double quiet_ms);
void restart_kit(DrumKit& kit);

/** `rhythmSpectrum.ts`. */
struct KeptSpectrum {
  double at_ms;
  std::vector<float> low;
  std::vector<float> high;
};
struct SpectrumDrumState {
  std::deque<KeptSpectrum> frames;
};
std::array<double, 3> read_spectrum_drums(SpectrumDrumState& state,
                                          double at_ms, const SoundHop& hop);

/** `rhythmTempo.ts`. */
inline constexpr double kOssHopMs = 10.0;
struct TempoHeard {
  double tempo;
  double clarity;
};
struct PhaseHeard {
  double back;
  double clarity;
};
bool is_related(double ratio);
std::optional<TempoHeard> estimate_tempo(const std::vector<float>& history,
                                         double held);
std::optional<PhaseHeard> estimate_phase(const std::vector<float>& history,
                                         double period,
                                         std::optional<double> keep);

/** `rhythmClock.ts`. */
inline constexpr std::size_t kOssLength = 1000;
struct OnsetRing {
  std::array<float, kOssLength> values{};
  std::size_t at = 0;
  std::size_t held = 0;
  double hop_left_ms = kOssHopMs;
  double hop_rise = 0.0;
};
struct RhythmClock {
  OnsetRing tempo_onsets;
  OnsetRing beat_onsets;
  double since_tempo_ms = 0.0;
  double since_phase_ms = 0.0;
  double tempo = 0.0;
  double confidence = 0.0;
  double tempo_clarity = 0.0;
  double tempo_agreement = 0.0;
  double phase_clarity = 0.0;
  double candidate = 0.0;
  double candidate_votes = 0.0;
  bool fresh = false;
  double held_ms = 0.0;
  double phase = 0.0;
  double beats = 0.0;
  double target = 0.0;
  double target_age_ms = 0.0;
  bool has_target = false;
  bool aligned = false;
  std::array<double, 4> slots{};
  std::size_t down_slot = 0;
  double beat_weight = 0.0;
};
void restart_clock(RhythmClock& clock);
void keep_onset(OnsetRing& ring, double strength, double step_ms);
void hold_onset(OnsetRing& ring, double strength, double step_ms);
void follow_clock(RhythmClock& clock, double step_ms, double bar_weight);

/** `rhythmSection.ts`. */
struct SectionState {
  double block_upper = 0.0;
  double block_low = 0.0;
  double block_all = 0.0;
  double block_ms = 0.0;
  std::deque<double> blocks;
  std::deque<double> low_blocks;
  std::deque<double> all_blocks;
  double mid = -100.0;
  double heard_ms = 0.0;
  double floor = -100.0;
  double ceiling = -100.0;
  double build = 0.0;
  double build_memory = 0.0;
  double drop = 0.0;
  double drop_serial = 0.0;
  double since_drop_ms = 8000.0;
  bool started = false;
};
void follow_section(SectionState& state, const Bands& bands, double step_ms,
                    bool audible, bool kicked);
void quiet_section(SectionState& state, double quiet_ms, double keep);
double intensity_of(const SectionState& state);

/** `sceneRhythm.ts`. */
struct SceneRhythm {
  double beat_phase = 0.0;
  double bar_phase = 0.0;
  double tempo = 0.0;
  double confidence = 0.0;
  double kick = 0.0;
  double snare = 0.0;
  double hat = 0.0;
  double intensity = 0.0;
  double build = 0.0;
  double drop = 0.0;
  double drop_serial = 0.0;
  bool running = false;
};
struct RhythmStep {
  bool kick = false;
  bool snare = false;
  double drums_since_ms = 60000.0;
  double broad = 0.0;
};
struct RhythmState : RhythmClock {
  double clock_ms = 0.0;
  std::deque<BandFrame> frames;
  std::array<float, kRhythmBandCount> band_tops{};
  double quiet_ms = 0.0;
  DrumKit kit = create_drum_kit();
  SectionState section;
  SpectrumDrumState spectrum_drums;
  RhythmStep step;
};
/** `advanceRhythm`, for a hop heard while the music plays. */
SceneRhythm advance_rhythm(RhythmState& state, const Bands& bands,
                           const SoundHop& hop, double elapsed_ms);

}  // namespace feq::scene
