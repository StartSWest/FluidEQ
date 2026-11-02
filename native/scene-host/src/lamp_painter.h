/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <atomic>
#include <cstdint>
#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "angle_api.h"
#include "flash_guard.h"
#include "fluideq/scene/lamp_atmosphere.h"
#include "fluideq/scene/lamp_ear.h"
#include "fluideq/scene/lamp_pacing.h"
#include "fluideq/scene/live_frames.h"
#include "fluideq/scene/scene_tuner.h"
#include "scene_program.h"
#include "scene_wire.h"

/*
 * The lamps' scene, drawn small: the C++ twin of `lightingScene.worker.ts`
 * and the drawing half of `lightingSceneClient.ts`. One thread owns it and
 * its GL context. A scene asked for links beside the one being drawn, which
 * keeps the desk until the new one can take over; a member's scene is drawn
 * through the flash limiter or not at all; each frame is drawn at the size
 * the GPU keeps in time (`LampPacing`) and reduced to the lamps' grid.
 *
 * What it says back — a scene loaded, one that failed, a grid — goes to
 * `Output`, on the painter's own thread.
 */

namespace feq::scene {

/** A scene to draw, as main sends it. */
struct LampScene {
  std::uint32_t id = 0;
  ScenePack pack;
  SceneResponse response;
  std::vector<SceneParam> params;
  /** Somebody's own scene: drawn through the flash limiter. */
  bool guarded = false;
};

/** One frame for the lamps, and what the scene answered to. */
struct PaintedGrid {
  std::vector<std::uint8_t> rgb;
  double level = 0.0;
  double beat = 0.0;
  std::array<double, 3> bands{};
  /** The frame's own: audio time since the last, its clock, the desk's rest. */
  double delta_ms = 0.0;
  double time_seconds = 0.0;
  double activity = 0.0;
  /** The scene as drawn, for the page's preview; empty unless asked for. */
  std::vector<std::uint8_t> preview;
  int preview_width = 0;
  int preview_height = 0;
};

class LampPainter {
 public:
  struct Output {
    std::function<void(std::uint32_t id)> loaded;
    /** `id` 0: the scene being drawn, rather than one asked for. */
    std::function<void(std::uint32_t id, wire::FailReason reason,
                       const std::string& words)>
        failed;
    std::function<void(const PaintedGrid& grid)> painted;
  };

  /** Drawing with the ANGLE in `angle_dir`; `output` hears what happens. */
  LampPainter(std::wstring angle_dir, Output output);
  ~LampPainter();
  LampPainter(const LampPainter&) = delete;
  LampPainter& operator=(const LampPainter&) = delete;

  /** Draw this scene once it links; the one drawn keeps the desk till then. */
  void load(LampScene scene);
  /** Draw nothing: whatever links or is drawn is let go. */
  void unload();
  /**
   * The desk takes the scene's colours rather than its picture: the scene
   * asked for cannot be drawn, or none was given. Not before the first scene
   * has linked, when the desk waits for the picture (`lampScenePlay.ts`).
   * Read from any thread.
   */
  bool failed() const { return failed_.load(std::memory_order_acquire); }
  /** A finished link taken over, and abandoned ones freed. */
  void settle();
  /**
   * The link in progress waited for and taken over: for a caller with
   * nothing to draw meanwhile. The lamps never wait; they `settle`.
   */
  void finish_link();
  /**
   * One frame, `heard` as the desk shows it, the scene drawn at the time of
   * day `daylight` asks (eased here, by the frames drawn).
   */
  void paint(HeardLampFrame heard, double daylight);
  void set_preview(bool wanted) { preview_wanted_ = wanted; }
  /**
   * Everything drawn with let go, and the context last: called on the
   * thread that drew, where the context is current. The painter draws
   * nothing after it.
   */
  void close();
  /** Whether the GPU links on ANGLE's threads (for the tests' report). */
  bool links_in_parallel() const;

 private:
  struct Pending {
    std::uint32_t id = 0;
    SceneResponse response;
    std::vector<SceneParam> params;
    std::unique_ptr<SceneLink> link;
    std::unique_ptr<FlashGuard> guard;
  };

  bool ensure_context(std::string& why);
  void drop();
  void lose_context(bool blamed);
  void fail(std::uint32_t id, wire::FailReason reason,
            const std::string& words);
  void make_preview(const std::vector<std::uint8_t>& pixels, int width,
                    int height, PaintedGrid& grid);

  std::wstring angle_dir_;
  Output output_;
  std::unique_ptr<gl::Context> context_;
  int surface_width_ = 0;
  int surface_height_ = 0;
  /**
   * The scene asked for last. A lost context is reported and main asks for
   * this scene again, so its pack is not held here twice.
   */
  std::uint32_t wanted_id_ = 0;
  std::optional<Pending> pending_;
  /** Links given up while still running, freed once each finishes. */
  std::vector<std::unique_ptr<SceneLink>> retiring_;
  std::unique_ptr<SceneProgram> program_;
  std::unique_ptr<FlashGuard> guard_;
  std::optional<SceneTuner> tuner_;
  SlowSpectrum<kSpectrumTexels> slow_;
  bool slow_started_ = false;
  LampPacing pacing_;
  DaylightFollower daylight_;
  std::uint32_t drawn_id_ = 0;
  bool preview_wanted_ = false;
  std::atomic<bool> failed_{false};
  std::vector<std::uint8_t> pixels_;
  std::array<std::uint8_t, 4> pixel_{};
};

}  // namespace feq::scene
