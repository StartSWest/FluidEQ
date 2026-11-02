/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
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
#include "fluideq/scene/live_frames.h"
#include "fluideq/scene/scene_tuner.h"
#include "scene_program.h"
#include "scene_wire.h"

/*
 * One monitor's background, drawn by C++ instead of a hidden Electron page
 * (`src/main/wallpaper/surface.ts` and the desktop page it ran): the scene
 * drawn at the resolution the window's performance choice asks for, scaled
 * to the monitor, and presented once per refresh — the present waits for the
 * refresh, which is what paces it. A member's scene is drawn through the
 * flash limiter or not at all, as on the lamps. Another scene asked for
 * links beside the one being drawn, which keeps the monitor until the new one
 * can take over: the desktop never shows a blank between them.
 *
 * One thread owns a painter and its GL context; the window it draws into is
 * made by whoever runs it, and placed behind the icons by the desktop helper
 * (`FluidEQ-Wallpaper.exe`), as the page's window was.
 */

namespace feq::scene {

/** A scene to draw, as main sends it. */
struct DesktopScene {
  std::uint32_t id = 0;
  ScenePack pack;
  SceneResponse response;
  std::vector<SceneParam> params;
  /** Somebody's own scene: drawn through the flash limiter. */
  bool guarded = false;
};

class DesktopPainter {
 public:
  struct Output {
    /** The scene asked for has linked and is drawn from the next frame. */
    std::function<void(std::uint32_t id)> loaded;
    /** Its first frame is on the monitor, once per scene. */
    std::function<void(std::uint32_t id)> drawn;
    /** `id` 0: the scene being drawn, rather than one asked for. */
    std::function<void(std::uint32_t id, wire::FailReason reason,
                       const std::string& words)>
        failed;
  };

  DesktopPainter(std::wstring angle_dir, Output output);
  ~DesktopPainter();
  DesktopPainter(const DesktopPainter&) = delete;
  DesktopPainter& operator=(const DesktopPainter&) = delete;

  /**
   * Draws into `window` (an HWND) of `width` by `height` pixels from now on.
   * False, with `why`, when there is no GPU to draw with.
   */
  bool open(void* window, int width, int height, std::string& why);
  /** The share of the monitor's pixels a scene is drawn at, 0.25 to 1. */
  void set_scale(double scale);
  /** Draw this scene once it links; the one drawn keeps the monitor till then. */
  void load(DesktopScene scene);
  /** A finished link taken over, and abandoned ones freed. */
  void settle();
  /**
   * The link in progress waited for and taken over: for a caller with
   * nothing on the monitor meanwhile. A monitor showing a scene `settle`s.
   */
  void finish_link();
  /**
   * A pixel of the last frame as it was drawn, before it was scaled to the
   * monitor, bottom row first; false when nothing has been drawn.
   */
  bool frame_pixel(int x, int y, std::array<std::uint8_t, 4>& rgba) const;
  /** The size the last frame was drawn at. */
  int frame_width() const { return target_width_; }
  int frame_height() const { return target_height_; }
  /** Whether a scene is there to draw. */
  bool drawing() const { return program_ != nullptr; }
  /** Whether a scene asked for is still linking. */
  bool linking() const { return pending_.has_value(); }
  /**
   * One frame: `heard` as the music is now, at the time of day `daylight`
   * asks, scaled to the monitor and presented. Returns once the monitor has
   * taken it. False when the GPU went from under it; reported, and nothing
   * is drawn until the next `open`.
   */
  bool paint(HeardLampFrame heard, double daylight);
  /** Everything let go, the context last; on the thread that drew. */
  void close();

 private:
  struct Pending {
    std::uint32_t id = 0;
    SceneResponse response;
    std::vector<SceneParam> params;
    std::unique_ptr<SceneLink> link;
    std::unique_ptr<FlashGuard> guard;
  };

  void drop();
  bool ensure_target(int width, int height);
  void release_target();
  void fail(std::uint32_t id, wire::FailReason reason,
            const std::string& words);

  std::wstring angle_dir_;
  Output output_;
  std::unique_ptr<gl::Context> context_;
  int window_width_ = 0;
  int window_height_ = 0;
  double scale_ = 1.0;
  /** The scene drawn at its own resolution, then scaled to the monitor. */
  gl::GLuint target_texture_ = 0;
  gl::GLuint target_ = 0;
  int target_width_ = 0;
  int target_height_ = 0;
  std::optional<Pending> pending_;
  std::vector<std::unique_ptr<SceneLink>> retiring_;
  std::unique_ptr<SceneProgram> program_;
  std::unique_ptr<FlashGuard> guard_;
  std::optional<SceneTuner> tuner_;
  SlowSpectrum<kSpectrumTexels> slow_;
  bool slow_started_ = false;
  DaylightFollower daylight_;
  std::uint32_t drawn_id_ = 0;
  /** The scene whose first frame has been told, so it is told once. */
  std::uint32_t told_drawn_ = 0;
};

}  // namespace feq::scene
