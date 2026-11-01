/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Twelve seconds of a match, for the Footsteps tests: rain with drops in it,
 * steps coming from the left, a burst of fire on the right, steps under its
 * echo, an explosion, steps walking away under its rumble, the player's own
 * reload — every onset listed, so a test can measure each kind where it is.
 *
 * Built at any rate from the same seeds, so the same scene is measured at
 * 44.1 and at 384 kHz. Its levels are a game's at a volume set for the
 * gunfire: steps 30 to 45 dB under the shots, the bed 15 dB and more under
 * the steps in their own band.
 */
#ifndef FLUIDEQ_FOOTSTEPS_SCENE_H
#define FLUIDEQ_FOOTSTEPS_SCENE_H

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

#include "dsp_test_support.h"

namespace feq_footsteps_test {

enum class Kind { kStep, kShot, kBlast, kReload };

struct Event {
  Kind kind;
  double at;
};

struct Scene {
  double rate = 48000.0;
  feq_test::Signal mix;
  std::vector<Event> events;
};

/** Which parts to render; the bed's level in dBFS, RMS. */
struct Parts {
  bool steps = true;
  bool loud = true;
  bool bed = true;
  double bed_db = -60.0;
};

/** RBJ sections for building the sounds; state kept beside the taps. */
struct Section {
  double b0 = 0, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
  double run(double x) {
    const double y = b0 * x + z1;
    z1 = b1 * x - a1 * y + z2;
    z2 = b2 * x - a2 * y;
    return y;
  }
};

enum class Shape { kLowPass, kHighPass, kBandPass };

inline Section section(Shape shape, double rate, double hz, double q) {
  const double w = 2.0 * feq_test::kPi * std::min(hz, 0.45 * rate) / rate;
  const double c = std::cos(w);
  const double alpha = std::sin(w) / (2.0 * q);
  double b0 = 0, b1 = 0, b2 = 0;
  if (shape == Shape::kBandPass) {
    b0 = alpha;
    b2 = -alpha;
  } else if (shape == Shape::kLowPass) {
    b0 = (1.0 - c) / 2.0;
    b1 = 1.0 - c;
    b2 = b0;
  } else {
    b0 = (1.0 + c) / 2.0;
    b1 = -(1.0 + c);
    b2 = b0;
  }
  const double a0 = 1.0 + alpha;
  Section s;
  s.b0 = b0 / a0;
  s.b1 = b1 / a0;
  s.b2 = b2 / a0;
  s.a1 = -2.0 * c / a0;
  s.a2 = (1.0 - alpha) / a0;
  return s;
}

/** Uniform in [0, 1). */
struct Random {
  feq_test::Noise noise{20261031u};
  double next() { return 0.5 * (noise.next() + 1.0); }
  double signed_next() { return noise.next(); }
};

inline void scale_to_peak(std::vector<double>& samples) {
  double peak = 0.0;
  for (const double v : samples) peak = std::max(peak, std::fabs(v));
  if (peak > 0.0) {
    for (double& v : samples) v /= peak;
  }
}

/** A boot on gravel: a low thump, then thirty-odd grains of crunch. */
inline std::vector<double> footstep(double rate, Random& r) {
  std::vector<double> out(static_cast<size_t>(0.17 * rate), 0.0);
  Section lp = section(Shape::kLowPass, rate, 360, 0.7);
  Section hp = section(Shape::kHighPass, rate, 70, 0.7);
  const auto thump = static_cast<size_t>(0.06 * rate);
  for (size_t i = 0; i < thump; ++i) {
    const double t = static_cast<double>(i) / rate;
    const double env = (1.0 - std::exp(-t / 0.0025)) * std::exp(-t / 0.016);
    out[i] += 0.7 * env * hp.run(lp.run(r.signed_next()));
  }
  const int grains = 30 + static_cast<int>(r.next() * 16);
  for (int g = 0; g < grains; ++g) {
    const double t0 = 0.006 + std::pow(r.next(), 1.7) * 0.12;
    const auto length = static_cast<size_t>((0.0015 + r.next() * 0.0035) * rate);
    Section bp = section(Shape::kBandPass, rate, 1700 + r.next() * 4800, 2.2);
    const double amp = (0.3 + r.next() * 0.7) * std::exp(-t0 / 0.055);
    const auto start = static_cast<size_t>(t0 * rate);
    for (size_t i = 0; i < length && start + i < out.size(); ++i) {
      const double env = std::sin(feq_test::kPi * static_cast<double>(i) / length);
      out[start + i] += 3.0 * amp * env * bp.run(r.signed_next());
    }
  }
  scale_to_peak(out);
  return out;
}

inline std::vector<double> gunshot(double rate, Random& r) {
  std::vector<double> out(static_cast<size_t>(0.35 * rate), 0.0);
  Section hp = section(Shape::kHighPass, rate, 1300, 0.7);
  Section body = section(Shape::kBandPass, rate, 520, 1.1);
  Section lp = section(Shape::kLowPass, rate, 850, 0.7);
  for (size_t i = 0; i < out.size(); ++i) {
    const double t = static_cast<double>(i) / rate;
    const double n = r.signed_next();
    const double crack = (1.0 - std::exp(-t / 0.0003)) * std::exp(-t / 0.003);
    const double boom = (1.0 - std::exp(-t / 0.002)) * std::exp(-t / 0.07);
    out[i] = hp.run(n) * crack * 1.4 + body.run(n) * std::exp(-t / 0.022) * 1.6 +
             lp.run(n) * boom * 1.2;
  }
  scale_to_peak(out);
  return out;
}

inline std::vector<double> explosion(double rate, Random& r) {
  std::vector<double> out(static_cast<size_t>(2.4 * rate), 0.0);
  Section lp1 = section(Shape::kLowPass, rate, 320, 0.7);
  Section lp2 = section(Shape::kLowPass, rate, 320, 0.7);
  Section sub = section(Shape::kLowPass, rate, 80, 0.9);
  for (size_t i = 0; i < out.size(); ++i) {
    const double t = static_cast<double>(i) / rate;
    const double n = r.signed_next();
    const double env = (1.0 - std::exp(-t / 0.004)) * std::exp(-t / 0.55);
    out[i] = (lp2.run(lp1.run(n)) * 2.5 + sub.run(n) * 3.0) * env;
  }
  for (int g = 0; g < 160; ++g) {
    const double t0 = 0.25 + r.next() * 1.4;
    const auto length = static_cast<size_t>((0.001 + r.next() * 0.004) * rate);
    Section bp = section(Shape::kBandPass, rate, 1500 + r.next() * 5000, 2.0);
    const double amp = 0.05 * std::exp(-(t0 - 0.25) / 0.6);
    const auto start = static_cast<size_t>(t0 * rate);
    for (size_t i = 0; i < length && start + i < out.size(); ++i) {
      const double env = std::sin(feq_test::kPi * static_cast<double>(i) / length);
      out[start + i] += 3.0 * amp * env * bp.run(r.signed_next());
    }
  }
  scale_to_peak(out);
  return out;
}

inline std::vector<double> reload(double rate, Random& r) {
  std::vector<double> out(static_cast<size_t>(0.8 * rate), 0.0);
  const double ats[3] = {0.0, 0.24, 0.55};
  for (int k = 0; k < 3; ++k) {
    Section click = section(Shape::kBandPass, rate, 2600 + k * 500, 3.0);
    Section thunk = section(Shape::kBandPass, rate, 850, 1.5);
    const auto start = static_cast<size_t>(ats[k] * rate);
    for (size_t i = 0; i < static_cast<size_t>(0.04 * rate); ++i) {
      const double t = static_cast<double>(i) / rate;
      const double n = r.signed_next();
      out[start + i] += click.run(n) * std::exp(-t / 0.004) * 3.0 +
                        thunk.run(n) * std::exp(-t / 0.012) * 2.0;
    }
  }
  scale_to_peak(out);
  return out;
}

/** A Schroeder room: four damped combs and two all-passes per side. */
inline std::vector<double> reverb(double rate, const std::vector<double>& in,
                                  double spread_ms) {
  struct Comb {
    std::vector<double> buf;
    size_t at = 0;
    double g = 0;
    double lp = 0;
  };
  struct AllPass {
    std::vector<double> buf;
    size_t at = 0;
  };
  const double rt60 = 1.1;
  std::vector<Comb> combs;
  for (const double ms : {29.7, 37.1, 41.1, 43.7}) {
    Comb c;
    c.buf.assign(static_cast<size_t>((ms + spread_ms) / 1000.0 * rate), 0.0);
    c.g = std::pow(10.0, -3.0 * (c.buf.size() / rate) / rt60);
    combs.push_back(std::move(c));
  }
  std::vector<AllPass> passes;
  for (const double ms : {5.0, 1.7}) {
    AllPass a;
    a.buf.assign(static_cast<size_t>((ms + spread_ms * 0.1) / 1000.0 * rate), 0.0);
    passes.push_back(std::move(a));
  }
  std::vector<double> out(in.size(), 0.0);
  for (size_t n = 0; n < in.size(); ++n) {
    double s = 0.0;
    for (Comb& c : combs) {
      const double y = c.buf[c.at];
      c.lp = y * 0.62 + c.lp * 0.38;
      c.buf[c.at] = in[n] + c.lp * c.g;
      c.at = (c.at + 1) % c.buf.size();
      s += y;
    }
    for (AllPass& a : passes) {
      const double d = a.buf[a.at];
      const double v = s + d * 0.5;
      a.buf[a.at] = v;
      a.at = (a.at + 1) % a.buf.size();
      s = d - v * 0.5;
    }
    out[n] = s * 0.25;
  }
  return out;
}

inline Scene make_scene(double rate, Parts parts = {}) {
  Random r;
  const auto length = static_cast<size_t>(12.0 * rate);
  std::vector<double> left(length, 0.0), right(length, 0.0);
  std::vector<double> send_left(length, 0.0), send_right(length, 0.0);
  Scene scene;
  scene.rate = rate;
  const auto place = [&](const std::vector<double>& source, double at,
                         double peak_db, double pan, double send_db, Kind kind) {
    scene.events.push_back({kind, at});
    const bool wanted = kind == Kind::kStep ? parts.steps : parts.loud;
    if (!wanted) return;
    const double gain = std::pow(10.0, peak_db / 20.0);
    const double send = std::pow(10.0, send_db / 20.0);
    const double angle = (pan + 1.0) * feq_test::kPi / 4.0;
    const double gl = std::cos(angle) * std::sqrt(2.0);
    const double gr = std::sin(angle) * std::sqrt(2.0);
    const auto delay = static_cast<size_t>(std::fabs(pan) * 0.00045 * rate);
    const size_t dl = pan > 0 ? delay : 0;
    const size_t dr = pan < 0 ? delay : 0;
    const auto start = static_cast<size_t>(at * rate);
    for (size_t i = 0; i < source.size(); ++i) {
      const double v = source[i] * gain;
      if (start + i + dl < length) {
        left[start + i + dl] += v * gl;
        send_left[start + i + dl] += v * gl * send;
      }
      if (start + i + dr < length) {
        right[start + i + dr] += v * gr;
        send_right[start + i + dr] += v * gr * send;
      }
    }
  };
  const auto steps = [&](double from, double to, double every, double db0,
                         double db1, double pan0, double pan1) {
    for (double t = from; t <= to + 1e-9; t += every) {
      const double k = (t - from) / std::max(1e-9, to - from);
      const std::vector<double> step = footstep(rate, r);
      place(step, t, db0 + (db1 - db0) * k + (r.next() - 0.5) * 2.0,
            pan0 + (pan1 - pan0) * k, -12.0, Kind::kStep);
    }
  };
  steps(0.7, 2.98, 0.42, -41, -33, -0.85, -0.35);
  for (int s = 0; s < 6; ++s) {
    const std::vector<double> shot = gunshot(rate, r);
    place(shot, 3.1 + s * 0.11, -6.0 - r.next() * 1.5, 0.65, -6.0, Kind::kShot);
  }
  steps(3.4, 5.92, 0.42, -34, -35, -0.3, 0.15);
  place(explosion(rate, r), 6.3, -2.0, 0.1, -5.0, Kind::kBlast);
  steps(6.75, 9.9, 0.45, -36, -45, 0.2, 0.8);
  place(reload(rate, r), 10.45, -30.0, 0.0, -20.0, Kind::kReload);

  // Rain: pink noise on each side, and drops — clicks a step detector must
  // not take for steps.
  feq_test::Pink pink_left;
  feq_test::Pink pink_right;
  pink_right.noise.seed = 1234567u;
  Section hpl = section(Shape::kHighPass, rate, 180, 0.7);
  Section hpr = section(Shape::kHighPass, rate, 180, 0.7);
  Section lpl = section(Shape::kLowPass, rate, 7000, 0.7);
  Section lpr = section(Shape::kLowPass, rate, 7000, 0.7);
  std::vector<double> bed_left(length), bed_right(length);
  double square = 0.0;
  for (size_t i = 0; i < length; ++i) {
    const double swell = 1.0 + 0.12 * std::sin(2.0 * feq_test::kPi * i / rate / 3.7);
    bed_left[i] = lpl.run(hpl.run(pink_left.next())) * swell;
    bed_right[i] = lpr.run(hpr.run(pink_right.next())) * swell;
    square += bed_left[i] * bed_left[i];
  }
  for (int d = 0; d < 12 * 70; ++d) {
    const auto start = static_cast<size_t>(r.next() * (length - rate * 0.01));
    const auto drop = static_cast<size_t>((0.0008 + r.next() * 0.0015) * rate);
    Section bp = section(Shape::kBandPass, rate, 2500 + r.next() * 5500, 1.8);
    std::vector<double>& side = r.next() < 0.5 ? bed_left : bed_right;
    const double amp = 0.4 + r.next() * 1.8;
    for (size_t i = 0; i < drop; ++i) {
      const double env = std::sin(feq_test::kPi * static_cast<double>(i) / drop);
      side[start + i] += amp * env * bp.run(r.signed_next()) * 4.0;
    }
  }
  const double bed_gain =
      parts.bed ? std::pow(10.0, parts.bed_db / 20.0) / std::sqrt(square / length)
                : 0.0;
  const std::vector<double> wet_left = reverb(rate, send_left, 0.0);
  const std::vector<double> wet_right = reverb(rate, send_right, 0.9);
  scene.mix.left.resize(length);
  scene.mix.right.resize(length);
  // A fixed trim rather than the scene's own peak, so the parts rendered
  // apart line up with the whole: about where the whole one peaks at -1 dBFS.
  const double trim = std::pow(10.0, -0.4 / 20.0);
  for (size_t i = 0; i < length; ++i) {
    scene.mix.left[i] =
        static_cast<float>((left[i] + wet_left[i] + bed_left[i] * bed_gain) * trim);
    scene.mix.right[i] = static_cast<float>(
        (right[i] + wet_right[i] + bed_right[i] * bed_gain) * trim);
  }
  return scene;
}

/**
 * Energy in a band over a window, both sides, by a band-pass run over the
 * whole signal — so a window starting mid-sound reads the filter settled.
 */
inline double band_energy(const feq_test::Signal& signal, double rate,
                          double hz, double q, double from_s, double to_s) {
  Section bl = section(Shape::kBandPass, rate, hz, q);
  Section br = section(Shape::kBandPass, rate, hz, q);
  const auto from = static_cast<size_t>(from_s * rate);
  const auto to = std::min(signal.left.size(), static_cast<size_t>(to_s * rate));
  double sum = 0.0;
  for (size_t i = 0; i < to; ++i) {
    const double l = bl.run(signal.left[i]);
    const double r = br.run(signal.right[i]);
    if (i >= from) sum += l * l + r * r;
  }
  return sum;
}

/** How much louder the output is than the input in that band and window. */
inline double band_gain_db(const feq_test::Signal& in, const feq_test::Signal& out,
                           double rate, double hz, double q, double from_s,
                           double to_s) {
  const double before = band_energy(in, rate, hz, q, from_s, to_s);
  const double after = band_energy(out, rate, hz, q, from_s, to_s);
  return 10.0 * std::log10((after + 1e-30) / (before + 1e-30));
}

}  // namespace feq_footsteps_test

#endif /* FLUIDEQ_FOOTSTEPS_SCENE_H */
