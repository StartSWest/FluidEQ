/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "angle_api.h"
#include "fluideq/scene/scene_frame.h"

/*
 * A scene, compiled and drawn as `src/renderer/graph/sceneGl.ts` draws one:
 * the same vertex program, the same textures (the spectrum and its eased
 * copy, the waveform, the artwork), the same uniforms on the same units.
 * The program text comes from main, assembled by the window's own
 * `assembleFragmentSource`, so the contract a scene is written against has
 * one author.
 */

namespace feq::scene {

struct ScenePack {
  std::string vertex_source;
  std::string fragment_source;
  /** `uParam_<id>` for each slider, and the value it falls back to. */
  std::vector<std::pair<std::string, double>> params;
  /** Premultiplied RGBA, bottom row first; empty for a scene without one. */
  std::vector<std::uint8_t> artwork;
  int artwork_width = 0;
  int artwork_height = 0;
  /**
   * The picture the panel shows of the scene (`uView`) and where the wave
   * lies in it (`uSpectrumRect`): the whole of both, unless the scene's
   * framing slides it (`framedPanel`, worked out by main at the lamps'
   * 16:9, which every one of their sizes shares).
   */
  std::array<float, 4> view{0.0F, 0.0F, 1.0F, 1.0F};
  std::array<float, 4> spectrum_rect{0.0F, 1.0F, 0.0F, 1.0F};
};

class SceneProgram;

/**
 * A scene linking on ANGLE's threads (`KHR_parallel_shader_compile`), as the
 * window links one (`linkSceneProgram`): nothing about it is asked until
 * `done`, because asking blocks until the driver is through, which is the
 * wait this exists to keep off the lamps.
 */
class SceneLink {
 public:
  ~SceneLink();
  SceneLink(const SceneLink&) = delete;
  SceneLink& operator=(const SceneLink&) = delete;

  /** The link has finished; always, where ANGLE links in one call. */
  bool done() const;
  /**
   * The program, or null with `log` saying why: the fragment shader's
   * words, then the vertex shader's, then the link's. Waits for the link
   * when it is not `done`.
   */
  std::unique_ptr<SceneProgram> finish(std::string& log);

 private:
  friend class SceneProgram;
  SceneLink(const gl::Api& api, ScenePack pack)
      : gl_(api), pack_(std::move(pack)) {}

  const gl::Api& gl_;
  ScenePack pack_;
  gl::GLuint vertex_ = 0;
  gl::GLuint fragment_ = 0;
  gl::GLuint program_ = 0;
};

class SceneProgram {
 public:
  /** The pack's program, linking; asked after with `SceneLink::done`. */
  static std::unique_ptr<SceneLink> start(const gl::Api& api, ScenePack pack);
  /** Compiled and linked in one call; `log` says why when it is not. */
  static std::unique_ptr<SceneProgram> compile(const gl::Api& api,
                                               const ScenePack& pack,
                                               std::string& log);
  ~SceneProgram();
  SceneProgram(const SceneProgram&) = delete;
  SceneProgram& operator=(const SceneProgram&) = delete;

  /** Draws `frame` into the bound framebuffer, `width` by `height`. */
  void draw(const SceneFrame& frame, int width, int height);

 private:
  friend class SceneLink;
  explicit SceneProgram(const gl::Api& api) : gl_(api) {}

  const gl::Api& gl_;
  gl::GLuint program_ = 0;
  gl::GLuint vao_ = 0;
  gl::GLuint spectrum_ = 0;
  gl::GLuint spectrum_slow_ = 0;
  gl::GLuint waveform_ = 0;
  gl::GLuint artwork_ = 0;
  struct Locations {
    gl::GLint time, resolution, level, beat, music_accent, music_run, bands,
        accent, fade, spectrum, spectrum_slow, spectrum_rect, waveform,
        artwork, rhythm, drums, song, stereo, voice, pointer, tap, camera,
        view;
  } at_{};
  std::vector<gl::GLint> params_;
  /** What each slider is when a frame does not say: the pack's value. */
  std::vector<double> fallbacks_;
  std::array<float, 4> view_{};
  std::array<float, 4> spectrum_rect_{};
};

}  // namespace feq::scene
