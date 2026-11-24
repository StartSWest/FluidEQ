/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A microphone's own readings in the meters (engine 1.32): the voice as it
 * arrives, before the Voice stage's low cut, and the gate's own detector and
 * gain.
 *
 * The arrival tap is kept the way the EQ tap is (`meters_eq_live.h`): the
 * newest audio, a short window per read and a 16384-point one for the bottom
 * octaves. A low cut works between 20 and 300 Hz, where the 2048-point window
 * every other tap uses has bins 23 Hz wide and a main lobe 140 Hz across: the
 * mains hum, a desk's rumble and a deep voice's lowest note would be drawn as
 * one blob, and the card's whole question — is the cut under the voice — could
 * not be answered from it.
 *
 * That ring and its transform buffers are 0.7 MB, so they exist only on a
 * meter a mic's rack has been given (`voice_window_prepare`, from the chain on
 * the control thread), never on an output's. Made once and kept until the
 * meters go: the audio thread may be writing into it at any moment after it
 * is published, and nothing it holds is worth the race of freeing it.
 *
 * The gate's two readings are the values at the block's end, not maxima: the
 * level is already a follower with a 40 ms release, and the gain moves at the
 * attack and release the dials set, so a read every frame misses nothing a
 * picture of five seconds could show.
 */
#ifndef FLUIDEQ_METERS_VOICE_H
#define FLUIDEQ_METERS_VOICE_H

#include <atomic>
#include <cstdint>

#include "fluideq/voice.h"
#include "meters_eq_live.h"

struct VoiceMeterWindow {
  VoiceMeterWindow() = default;
  ~VoiceMeterWindow();
  VoiceMeterWindow(const VoiceMeterWindow&) = delete;
  VoiceMeterWindow& operator=(const VoiceMeterWindow&) = delete;

  /** The arrival tap; null until a mic's rack prepares it. Owned. */
  std::atomic<EqLiveWindow*> arrival{nullptr};
  std::atomic<float> gate_level_db{-120.0f};
  std::atomic<float> gate_gain_db{0.0f};
  std::atomic<uint32_t> active{0};
  /** Voice level's gain and what it heard (engine 1.33). */
  std::atomic<float> level_gain_db{0.0f};
  std::atomic<float> level_heard_db{-120.0f};
};

/** Makes the arrival tap if it is not there yet. CONTROL thread. */
void voice_window_prepare(VoiceMeterWindow& window);

/** One block of the voice as it arrives. AUDIO thread; nothing if unmade. */
void voice_window_capture(VoiceMeterWindow& window,
                          const float* left,
                          const float* right,
                          uint32_t frames);

/** The panel opened: whatever the ring held from before reads as silence. */
void voice_window_restart(VoiceMeterWindow& window);

/** The arrival tap's short and long windows (`eq_live_read_*`). CONTROL. */
int voice_window_read_short(VoiceMeterWindow& window,
                            double sample_rate,
                            float* out_db);
int voice_window_read_long(VoiceMeterWindow& window,
                           double sample_rate,
                           float* out_db);

/** The gate's reading at a block's end. AUDIO thread. */
void voice_window_publish(VoiceMeterWindow& window,
                          const FeqVoiceReport& report);

/** The latest gate reading. CONTROL thread. */
void voice_window_read(const VoiceMeterWindow& window, FeqVoiceReport* out);

#endif /* FLUIDEQ_METERS_VOICE_H */
