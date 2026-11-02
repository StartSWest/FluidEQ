/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

#include <array>
#include <memory>
#include <optional>
#include <string>

#include "angle_api.h"

/*
 * The flash limiter a member's scene is drawn through: the C++ twin of
 * `src/renderer/graph/sceneFlashGuardGpu.ts`, running that file's own three
 * programs (`flash_guard_sources.h`) pass for pass. The scene draws into the
 * guard's frame (`begin`), and `end` measures how far each region swung
 * since the last frame, holds a calm copy that may move only so fast, and
 * composites the frame towards that copy wherever it flashes too often. A
 * guard that cannot be built is a member's scene not on the lamps at all.
 */

namespace feq::scene {

class FlashGuard {
 public:
  static std::unique_ptr<FlashGuard> create(const gl::Api& api,
                                            std::string& why);
  ~FlashGuard();
  FlashGuard(const FlashGuard&) = delete;
  FlashGuard& operator=(const FlashGuard&) = delete;

  /** Binds the frame the scene is to be drawn into, `width` by `height`. */
  void begin(int width, int height);
  /**
   * The drawn frame limited into `destination` (0, the surface), `delta_ms`
   * after the last. False when the guard has nothing to limit with.
   */
  bool end(double delta_ms, gl::GLuint destination);

 private:
  struct Target {
    gl::GLuint texture = 0;
    gl::GLuint framebuffer = 0;
    int width = 0;
    int height = 0;
  };
  using Pair = std::array<Target, 2>;

  explicit FlashGuard(const gl::Api& api) : gl_(api) {}
  std::optional<Target> make_target(int width, int height, bool mipmapped,
                                    bool precise,
                                    const std::array<float, 4>& clear);
  std::optional<Pair> make_pair(int width, int height, bool mipmapped,
                                bool precise,
                                const std::array<float, 4>& clear = {});
  void release(const Target& target);
  void release(const std::optional<Pair>& pair);
  void carry(const Target& from, const Target& to, bool mipmapped);
  void resize(int width, int height);
  void update_pressure(const Target& current, const Target& last,
                       double delta_ms);
  void update_calm(const Target& current, double delta_ms);

  const gl::Api& gl_;
  gl::GLuint composite_ = 0;
  gl::GLuint state_ = 0;
  gl::GLuint calm_program_ = 0;
  gl::GLuint vao_ = 0;
  struct {
    gl::GLint current, calm, state, area_lod;
  } composite_at_{};
  struct {
    gl::GLint current, last_frame, state, decay, elapsed, flash_decay;
  } state_at_{};
  struct {
    gl::GLint current, calm, lod, allowance, first;
  } calm_at_{};
  int width_ = 0;
  int height_ = 0;
  std::optional<Pair> frames_;
  std::size_t drawn_ = 0;
  bool has_frame_ = false;
  std::optional<Pair> pressure_;
  std::size_t pressure_latest_ = 0;
  std::optional<Pair> calm_;
  std::size_t calm_latest_ = 0;
  bool has_calm_ = false;
};

}  // namespace feq::scene
