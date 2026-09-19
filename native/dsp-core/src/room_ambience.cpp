/* SPDX-License-Identifier: GPL-3.0-or-later */
#include "room_ambience.h"

#include <algorithm>
#include <cmath>
#include <utility>
namespace {
constexpr double pi = 3.14159265358979323846;
constexpr double seconds[4] = {0.0297, 0.0371, 0.0411, 0.0437};
double clean(double x) {
  return std::isfinite(x) && std::fabs(x) > 1e-24 ? x : 0;
}
}  // namespace
uint32_t room_physical_taps(double rate) {
  return std::max(513u,
                  static_cast<uint32_t>(std::ceil(2048.0 * rate / 48000.0)));
}
RoomAmbienceParameters room_ambience_parameters(double rate, double mix,
                                                double decay, double damping,
                                                double walls) {
  RoomAmbienceParameters p;
  p.mix = std::clamp(mix, 0.0, 1.0);
  decay = std::clamp(decay, 0.1, 1.8);
  damping = std::min(std::clamp(damping, 1000.0, 12000.0), rate * 0.45);
  p.damping = 1 - std::exp(-2 * pi * damping / rate);
  // V2 Walls retains absorption (1-walls), and additionally lowers the
  // reflected field's corner from 12 kHz to 1 kHz. Direct HRIR is untouched.
  const double wall_hz =
      12000.0 * std::pow(1.0 / 12.0, std::clamp(walls, 0.0, 1.0));
  p.wall_damping =
      1 - std::exp(-2 * pi * std::min(wall_hz, rate * 0.45) / rate);
  double largest = 0;
  for (size_t i = 0; i < 4; ++i) {
    const double delay = std::max(1.0, std::round(seconds[i] * rate));
    p.feedback[i] = std::exp(-std::log(1000.0) * delay / (rate * decay));
    largest = std::max(largest, p.feedback[i]);
  }
  // Contractive orthogonal feedback and unit-DC damping. This input factor
  // bounds sustained correlated drive even at the maximum decay. No limiter.
  p.injection = (1 - largest) * 0.25;
  return p;
}
void RoomAmbience::prepare(double rate) {
  for (size_t i = 0; i < 4; ++i)
    lines_[i].assign(
        static_cast<size_t>(std::max(1.0, std::round(seconds[i] * rate))), 0);
  slew_ = 1 - std::exp(-1 / (0.020 * rate));
  reset();
}
void RoomAmbience::reset() {
  for (auto& line : lines_) std::fill(line.begin(), line.end(), 0.0);
  cursor_ = {};
  low_ = {};
  wall_ = 0;
  current_ = {};
  running_ = false;
}
void RoomAmbience::tick(double input, const RoomAmbienceParameters& p,
                        float& left, float& right) {
  // Exactly dry at zero. Clear once and stop excitation: re-enable cannot
  // expose an unheard tail accumulated while disabled.
  if (p.mix <= 0) {
    if (running_) reset();
    return;
  }
  if (!running_) {
    current_ = p;
    running_ = true;
  }
  auto approach = [&](double& x, double y) { x += slew_ * (y - x); };
  // Room already crossfades this gain sample by sample. A second smoother
  // would lag that fade and cut a still-audible gain at exact zero.
  current_.mix = p.mix;
  approach(current_.damping, p.damping);
  approach(current_.wall_damping, p.wall_damping);
  approach(current_.injection, p.injection);
  wall_ = clean(wall_ + current_.wall_damping * (input - wall_));
  double v[4];
  for (size_t i = 0; i < 4; ++i) {
    approach(current_.feedback[i], p.feedback[i]);
    low_[i] =
        clean(low_[i] + current_.damping * (lines_[i][cursor_[i]] - low_[i]));
    v[i] = low_[i] * current_.feedback[i];
  }
  // Normalized Hadamard: H^T H = I; max(feedback) < 1, LP <= 1.
  const double h[4] = {
      (v[0] + v[1] + v[2] + v[3]) * 0.5, (v[0] - v[1] + v[2] - v[3]) * 0.5,
      (v[0] + v[1] - v[2] - v[3]) * 0.5, (v[0] - v[1] - v[2] + v[3]) * 0.5};
  for (size_t i = 0; i < 4; ++i) {
    lines_[i][cursor_[i]] =
        clean(h[i] + wall_ * current_.injection * (i == 3 ? -1.0 : 1.0));
    if (++cursor_[i] == lines_[i].size()) cursor_[i] = 0;
  }
  left += static_cast<float>((low_[0] + low_[1] - low_[2] + low_[3]) * 0.125 *
                             current_.mix);
  right += static_cast<float>((low_[0] - low_[1] + low_[2] + low_[3]) * 0.125 *
                              current_.mix);
}
void RoomAmbience::swap_history(RoomAmbience& other) {
  lines_.swap(other.lines_);
  cursor_.swap(other.cursor_);
  low_.swap(other.low_);
  std::swap(current_, other.current_);
  std::swap(wall_, other.wall_);
  std::swap(running_, other.running_);
}
size_t RoomAmbience::samples() const {
  size_t n = 0;
  for (const auto& line : lines_) n += line.size();
  return n;
}
