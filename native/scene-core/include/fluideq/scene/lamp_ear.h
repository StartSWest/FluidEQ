/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstddef>
#include <memory>

#include "fluideq/scene/lamp_atmosphere.h"
#include "fluideq/scene/lamp_listener.h"

/*
 * The lamps' ear: the music heard (`LampListener`) and the desk's rest laid
 * over it (`LampAtmosphere`), a frame every thirtieth of a second of audio —
 * what `lampScenePlay.ts` hands its scene or its swatch. The atmosphere
 * outlives a change of output, as the window's player does: a new output is
 * a new listener at its own rate, never a desk that starts its rest again.
 */

namespace feq::scene {

/** A frame as the desk shows it, and what it was heard from. */
struct HeardLampFrame {
  SceneFrame frame;
  double delta_ms = 0.0;
  double activity = 0.0;
};

class LampEar {
 public:
  explicit LampEar(const std::array<double, 3>& accent) : accent_(accent) {}

  /** A new output, heard at `rate`, from its first frame. */
  void listen_at(double rate) {
    listener_ = std::make_unique<LampListener>(rate, accent_);
    listener_->set_paused(paused_);
  }
  bool listening() const { return listener_ != nullptr; }

  void set_profile(const LampProfile& profile) { profile_ = profile; }
  /** The app's accent colour, as unit RGB: every frame after this one. */
  void set_accent(const std::array<double, 3>& accent) { accent_ = accent; }
  void set_paused(bool paused) {
    paused_ = paused;
    if (listener_) {
      listener_->set_paused(paused);
    }
  }

  /** As `LampListener::push`, each frame handed on as the desk shows it. */
  template <typename OnFrame>
  void push(const float* interleaved, std::size_t frames, std::size_t channels,
            OnFrame&& on_frame) {
    if (!listener_) {
      return;
    }
    listener_->push(interleaved, frames, channels,
                    [&](const LampFrame& heard) {
                      heard_.frame = heard.scene;
                      heard_.frame.accent = accent_;
                      heard_.delta_ms = heard.delta_ms;
                      atmosphere_.apply(heard_.frame, heard.delta_ms,
                                        heard.silent, profile_);
                      heard_.activity = atmosphere_.activity();
                      on_frame(static_cast<const HeardLampFrame&>(heard_));
                    });
  }

 private:
  std::array<double, 3> accent_;
  std::unique_ptr<LampListener> listener_;
  LampAtmosphere atmosphere_;
  LampProfile profile_;
  bool paused_ = false;
  HeardLampFrame heard_;
};

}  // namespace feq::scene
