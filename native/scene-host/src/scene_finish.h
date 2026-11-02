/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <memory>
#include <string>

#include "angle_api.h"
#include "fluideq/scene/draw_plan.h"

/*
 * How a scene's picture is finished between the size it was drawn at and the
 * window: the window's finishing chain (`src/renderer/graph/scenePost.ts`)
 * on the C++ host, with the very programs it links
 * (`scene_finish_sources.h`). A smaller picture is brought up by AMD's FSR
 * (EASU, then RCAS) or left for a plain stretch; a larger one (`best`
 * smoothing) is averaged down; FXAA smooths what that gives, at the size the
 * canvas shows. A canvas smaller than the window — a panel past the 4K
 * budget, or a picture left for the plain stretch — is stretched to it last,
 * as the compositor stretched the page's canvas.
 */

namespace feq::scene {

class SceneFinish {
 public:
  /** A picture to finish: its texture, its framebuffer, and its size. */
  struct Input {
    gl::GLuint texture = 0;
    gl::GLuint framebuffer = 0;
    DrawSize size;
  };

  /** Null, with `why`, when a pass does not link here. */
  static std::unique_ptr<SceneFinish> create(const gl::Api& gl,
                                             std::string& why);
  ~SceneFinish();
  SceneFinish(const SceneFinish&) = delete;
  SceneFinish& operator=(const SceneFinish&) = delete;

  /**
   * Finishes `input` onto `out` (0: the window's own framebuffer) of
   * `window` pixels, through the canvas the plan finishes at. False when an
   * intermediate could not be made.
   */
  bool present(const Input& input, DrawSize canvas, DrawSize window,
               const PresentPlan& plan, gl::GLuint out = 0);
  /** Frees the pictures between the passes; the passes stay linked. */
  void shed();
  /** Everything let go; on the thread whose context made it, while current. */
  void release();

 private:
  struct Pass {
    gl::GLuint program = 0;
    gl::GLint input = -1;
    /** The pass's own uniform: uStep, uRcpFrame, uCon or uSharp. */
    gl::GLint knob = -1;
  };
  struct Target {
    gl::GLuint texture = 0;
    gl::GLuint framebuffer = 0;
    DrawSize size;
  };

  explicit SceneFinish(const gl::Api& gl) : gl_(gl) {}
  bool link(Pass& pass, const char* source, const char* knob, std::string& why);
  bool fit(Target& target, DrawSize size);
  void free_target(Target& target);
  void run(const Pass& pass, gl::GLuint input, gl::GLuint framebuffer,
           DrawSize size);

  const gl::Api& gl_;
  gl::GLuint vao_ = 0;
  Pass downsample_;
  Pass fxaa_;
  Pass easu_;
  Pass rcas_;
  Target a_;
  Target b_;
};

}  // namespace feq::scene
