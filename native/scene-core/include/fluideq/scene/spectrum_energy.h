/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <deque>
#include <optional>
#include <vector>

#include "fluideq/scene/energy_levels.h"
#include "fluideq/scene/rhythm.h"
#include "fluideq/scene/sound_hops.h"

/*
 * The music as every drawing hears it — level, bass, mid, treble, the pulse,
 * the accent, the flywheel, the rhythm and the singing voice: the C++ twin of
 * `src/common/spectrumEnergy.ts` (with `energyPulse.ts` and
 * `voiceReading.ts`). A hop at a time, as `hearSound` takes them.
 */

namespace feq::scene {

struct VoiceReading {
  double open = 0.0;
  double pitch = 0.0;
  double sure = 0.0;
};

struct VoiceState {
  double open = 0.0;
  double pitch = 0.0;
  double sure = 0.0;
  std::optional<double> loudest_db;
  double harmonicity = 0.0;
  double pitch_hz = 0.0;
  std::vector<float> centre;
  std::deque<double> line;
  double gate = 0.0;
};

void follow_voice(VoiceState& state, const SoundHop& hop, double step_ms);

struct PulseState {
  double flash_left_ms = -1.0;
  double flux_mean = 0.03;
  double flux_variation = 0.015;
  double since_beat_ms = 250.0;
  double beat_gap_ms = 500.0;
  double clock_beats = 0.0;
  bool clock_leads = false;
  double accent = 0.0;
  double since_accent_ms = 7000.0;
  double accent_serial = 0.0;
  double tall_onset = 0.1;
  double drop_serial = 0.0;
};

struct SpectrumEnergy {
  double level = 0.0;
  double bass = 0.0;
  double mid = 0.0;
  double treble = 0.0;
  double beat = 0.0;
  double accent = 0.0;
  double accent_serial = 0.0;
  double run = 0.0;
  double run_speed = 0.0;
  SceneRhythm rhythm;
  VoiceReading voice;
};

struct EnergyState {
  LevelState levels;
  PulseState pulse;
  double run = 0.0;
  double run_speed = 0.0;
  RhythmState rhythm;
  SceneRhythm heard;
  Bands bands{};
  VoiceState voice;
};

/** `hearSound` for one hop; `lost_ms` is time lost before it. */
void hear_hop(EnergyState& state, const SoundHop& hop, double lost_ms);
/** `readEnergy`. */
SpectrumEnergy read_energy(const EnergyState& state);

}  // namespace feq::scene
