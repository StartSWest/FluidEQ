/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <cmath>
#include <cstddef>
#include <memory>
#include <optional>
#include <vector>

#include "fluideq/scene/analyser.h"
#include "fluideq/scene/live_frames.h"
#include "fluideq/scene/scene_frame.h"
#include "fluideq/scene/sound_hops.h"
#include "fluideq/scene/spectrum_energy.h"

/*
 * The music the lamps' scene moves to, a frame every thirtieth of a second
 * of audio: the C++ twin of `src/renderer/lighting/lightingListener.ts`. The
 * spectrum and its waveform from Chromium's analyser at the graph's own
 * smoothing (the C++ clone of it), against the track's own loudest; the
 * music heard (`spectrum_energy.h`); the scene's clock, which advances by the
 * audio heard and wraps at an hour; and the fade in, an 80 ms half-life.
 */

namespace feq::scene {

/** A frame for the lamps' scene, and the audio time since the last one. */
struct LampFrame {
  SceneFrame scene;
  double delta_ms = 0.0;
  /** Nothing was heard over the silence floor this frame. */
  bool silent = true;
  /**
   * No music for a scene to answer: nothing over the floor, or a waveform
   * under −50 dBFS (`sceneRest.ts`). A scene rests on a run of these.
   */
  bool quiet = true;
};

class LampListener {
 public:
  /** At `rate`, with the app's accent colour as unit RGB. */
  LampListener(double rate, const std::array<double, 3>& accent);

  /**
   * `frames` interleaved frames of `channels` channels; calls `on_frame`
   * at every thirtieth of a second of them. The frame is this object's own,
   * overwritten by the next: read it, never keep it.
   */
  template <typename OnFrame>
  void push(const float* interleaved, std::size_t frames, std::size_t channels,
            OnFrame&& on_frame);

  /** Paused, the lamps hold what they last showed, as the picture does. */
  void set_paused(bool paused) { paused_ = paused; }

 private:
  /** `RING_SIZE` (`soundHops.ts`): the hops a listener can fall behind by. */
  static constexpr std::int64_t kHopRing = 128;
  /** Hops the samples completed and the window's clock not yet; never more than one. */
  static constexpr std::size_t kWaitingHops = 4;

  void wait_hop(const SoundHop& hop);
  /**
   * The hops the window would have read by `at_ms`: `update` counts what a
   * block brought in milliseconds of the audio clock, not in samples, so now
   * and then a hop completes a block later there than here, and is heard
   * there by the frame after. Counted the same way here, from the hops the
   * samples completed, so a frame hears the hops the window's frame heard.
   * The first block only says where the clock is.
   */
  void count_hops(double at_ms);
  void keep_hop(const SoundHop& hop);
  /** `hearing.music()`: the hops since the last frame heard, then read. */
  SpectrumEnergy hear_music();
  void make_frame();

  double rate_;
  /**
   * The hops kept for the next frame to hear, as the window's ring keeps
   * them (`soundHops.ts`'s `take`): the frame hears what came since the
   * last, the first frame only the newest, and a frame that fell more than
   * the ring behind hears the gap as time lost.
   */
  std::vector<SoundHop> ring_ = std::vector<SoundHop>(kHopRing);
  std::int64_t last_seq_ = -1;
  std::int64_t cursor_seq_ = -1;
  bool cursor_set_ = false;
  std::vector<SoundHop> waiting_ = std::vector<SoundHop>(kWaitingHops);
  std::size_t waiting_head_ = 0;
  std::size_t waiting_count_ = 0;
  double hop_samples_;
  double clock_pending_ = 0.0;
  std::optional<double> clock_at_ms_;
  std::size_t tick_frames_;
  Analyser analyser_;
  SoundHops hops_;
  std::unique_ptr<EnergyState> energy_ = std::make_unique<EnergyState>();
  std::vector<double> axis_;
  std::vector<AxisCell> cells_;
  std::vector<double> levels_;
  std::vector<double> points_;
  std::vector<double> waveform_points_ =
      std::vector<double>(kWaveformPointCount, 0.0);
  std::vector<float> frequency_data_ = std::vector<float>(kFftSize / 2);
  std::vector<float> samples_ = std::vector<float>(kFftSize);
  std::vector<float> left_;
  std::vector<float> right_;
  std::optional<double> reference_;
  std::optional<SpectrumEnergy> last_;
  std::size_t heard_frames_ = 0;
  std::size_t framed_at_ = 0;
  std::size_t next_tick_;
  bool paused_ = false;
  LampFrame frame_;
};

template <typename OnFrame>
void LampListener::push(const float* interleaved, std::size_t frames,
                        std::size_t channels, OnFrame&& on_frame) {
  analyser_.push(interleaved, frames, channels, rate_);
  left_.resize(frames);
  right_.resize(frames);
  // The drawings hear two channels always: one spread to both, the front
  // pair of anything wider (`connectSoundAnalysers`).
  for (std::size_t frame = 0; frame < frames; ++frame) {
    left_[frame] = interleaved[frame * channels];
    right_[frame] =
        channels > 1 ? interleaved[frame * channels + 1] : left_[frame];
  }
  heard_frames_ += frames;
  // Divided, then scaled, as the window's listener writes it: the other
  // order rounds differently, and the hop on a block's edge moves a frame.
  const double at_ms = (static_cast<double>(heard_frames_) / rate_) * 1000.0;
  hops_.push(left_.data(), right_.data(), frames, at_ms,
             [this](const SoundHop& hop) { wait_hop(hop); });
  count_hops(at_ms);
  if (heard_frames_ < next_tick_) {
    return;
  }
  while (next_tick_ <= heard_frames_) {
    next_tick_ += tick_frames_;
  }
  make_frame();
  on_frame(static_cast<const LampFrame&>(frame_));
}

}  // namespace feq::scene
