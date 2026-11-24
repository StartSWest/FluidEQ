/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Reverb (engine 1.33, `reverb.h`) at every shared-mode rate, each
 * check beside its control:
 * - off is exactly the input, and on it is not;
 * - each type's tail falls 60 dB in its decay time (T20 from the energy
 *   decay curve, within 15%), at a short and a long setting;
 * - the plate is dense at once: its echo density reaches 0.9 within 50 ms
 *   of the tail's onset, counted in the audible band;
 * - the dry voice is not delayed: the first sample out is the input's;
 * - a minute at the longest decay never grows;
 * - a type changed mid-tail comes in without a step, where the same two
 *   tails spliced with no fade step by far more;
 * - ducking takes the tail down by its depth while the voice is heard and
 *   gives it back in the gaps;
 * - the work per 10 ms block, printed.
 */

#include <algorithm>
#include <array>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <vector>

#include "dsp_test_support.h"
#include "fluideq/reverb.h"

namespace {

using feq_test::check;
constexpr double kPi = 3.14159265358979323846;
constexpr std::array<double, 8> kRates = {44100.0,  48000.0,  88200.0,
                                          96000.0,  176400.0, 192000.0,
                                          352800.0, 384000.0};

FeqReverbSettings settings_of(int type, double decay_s) {
  FeqReverbSettings s{};
  feq_reverb_settings_defaults(&s);
  s.enabled = 1;
  s.type = type;
  s.decay_s = decay_s;
  s.mix_db = 0.0;
  s.predelay_ms = 0.0;
  s.tone_hz = 16000.0;
  s.low_cut_hz = 80.0;
  s.width = 1.0;
  s.duck = 0;
  return s;
}

struct Stereo {
  std::vector<float> left;
  std::vector<float> right;
  explicit Stereo(size_t frames) : left(frames, 0.0f), right(frames, 0.0f) {}
};

/** Runs `signal` through `reverb` in blocks of 10 ms, in place. */
void run(FeqReverb* reverb, Stereo& signal, double rate) {
  const auto block = static_cast<size_t>(rate / 100.0);
  for (size_t at = 0; at < signal.left.size(); at += block) {
    const auto frames = static_cast<uint32_t>(
        std::min(block, signal.left.size() - at));
    float* channels[2] = {signal.left.data() + at, signal.right.data() + at};
    feq_reverb_process(reverb, channels, frames);
  }
}

/** The wet part alone: an impulse in, minus the impulse. */
std::vector<double> impulse_response(int type, double decay_s, double rate,
                                     double seconds) {
  FeqReverb* reverb = feq_reverb_create(rate, 2);
  const FeqReverbSettings s = settings_of(type, decay_s);
  feq_reverb_configure(reverb, &s);
  feq_reverb_reset(reverb);
  Stereo signal(static_cast<size_t>(rate * seconds));
  signal.left[0] = 1.0f;
  signal.right[0] = 1.0f;
  run(reverb, signal, rate);
  feq_reverb_destroy(reverb);
  std::vector<double> wet(signal.left.size());
  for (size_t i = 0; i < wet.size(); ++i) {
    const double dry = i == 0 ? 1.0 : 0.0;
    wet[i] = 0.5 * ((signal.left[i] - dry) + (signal.right[i] - dry));
  }
  return wet;
}

/** RT60 from the Schroeder curve's -5 to -25 dB stretch, as T20 x 3. */
double rt60_of(const std::vector<double>& wet, double rate) {
  std::vector<double> curve(wet.size());
  double sum = 0.0;
  for (size_t i = wet.size(); i-- > 0;) {
    sum += wet[i] * wet[i];
    curve[i] = sum;
  }
  const double total = curve[0];
  auto when = [&](double db) {
    const double level = total * std::pow(10.0, db / 10.0);
    for (size_t i = 0; i < curve.size(); ++i) {
      if (curve[i] <= level) return static_cast<double>(i) / rate;
    }
    return static_cast<double>(curve.size()) / rate;
  };
  return (when(-25.0) - when(-5.0)) * 3.0;
}

/**
 * The response as it is heard: through a 4th-order Butterworth low-pass at
 * 20 kHz. Counted sample by sample, an echo one sample wide at 384 kHz
 * reads as eight times sparser than the same echo at 48 kHz, which no ear
 * can tell apart.
 */
std::vector<double> audible(const std::vector<double>& wet, double rate) {
  std::vector<double> out(wet);
  if (rate <= 48000.0) return out;
  for (const double q : {0.5412, 1.3066}) {
    const double w0 = 2.0 * kPi * 20000.0 / rate;
    const double alpha = std::sin(w0) / (2.0 * q);
    const double c = std::cos(w0);
    const double a0 = 1.0 + alpha;
    const double b0 = (1.0 - c) / 2.0 / a0, b1 = (1.0 - c) / a0, b2 = b0;
    const double a1 = -2.0 * c / a0, a2 = (1.0 - alpha) / a0;
    double z1 = 0.0, z2 = 0.0;
    for (double& x : out) {
      const double y = b0 * x + z1;
      z1 = b1 * x - a1 * y + z2;
      z2 = b2 * x - a2 * y;
      x = y;
    }
  }
  return out;
}

/** Where the tail begins: its first sample within 40 dB of its peak. */
size_t onset_of(const std::vector<double>& wet) {
  double peak = 0.0;
  for (const double v : wet) peak = std::max(peak, std::fabs(v));
  for (size_t i = 0; i < wet.size(); ++i) {
    if (std::fabs(wet[i]) > peak * 0.01) return i;
  }
  return wet.size();
}

/**
 * Abel and Huang's normalised echo density over a 20 ms window ending
 * `after_s` past the tail's onset: the share of samples beyond one
 * standard deviation, against the share a Gaussian has (0.3173). 1 is a
 * fully mixed tail. From the onset, because Dattorro's input diffusers put
 * their own few tens of ms in front of every tail.
 */
double echo_density(const std::vector<double>& wet, double rate,
                    double after_s) {
  const auto window = static_cast<size_t>(rate * 0.020);
  const size_t end = onset_of(wet) + static_cast<size_t>(rate * after_s);
  const size_t start = end > window ? end - window : 0;
  double power = 0.0;
  for (size_t i = start; i < end; ++i) power += wet[i] * wet[i];
  const double sigma = std::sqrt(power / static_cast<double>(end - start));
  size_t beyond = 0;
  for (size_t i = start; i < end; ++i) {
    if (std::fabs(wet[i]) > sigma) ++beyond;
  }
  return static_cast<double>(beyond) / static_cast<double>(end - start) /
         0.3173;
}

/** A spoken-like burst: 150 Hz with harmonics, on for `on`, off for `off`. */
Stereo voice(double rate, double seconds, double on_s, double off_s,
             double amplitude) {
  Stereo out(static_cast<size_t>(rate * seconds));
  for (size_t i = 0; i < out.left.size(); ++i) {
    const double t = static_cast<double>(i) / rate;
    const double phase = std::fmod(t, on_s + off_s);
    if (phase >= on_s) continue;
    double v = 0.0;
    for (int h = 1; h <= 12; ++h) v += std::sin(2.0 * kPi * 150.0 * h * t) / h;
    const auto sample = static_cast<float>(amplitude * v * 0.5);
    out.left[i] = sample;
    out.right[i] = sample;
  }
  return out;
}

double rms_db(const std::vector<float>& a, const std::vector<float>& b,
              size_t from, size_t to) {
  double sum = 0.0;
  for (size_t i = from; i < to; ++i) {
    const double d = static_cast<double>(a[i]) - b[i];
    sum += d * d;
  }
  return 10.0 * std::log10(sum / static_cast<double>(to - from) + 1e-30);
}

double largest_step(const std::vector<float>& x, size_t from, size_t to) {
  double most = 0.0;
  for (size_t i = from + 2; i < to; ++i) {
    // The second difference: a tail's own motion is smooth at these rates,
    // a splice is not.
    const double second =
        std::fabs(static_cast<double>(x[i]) - 2.0 * x[i - 1] + x[i - 2]);
    most = std::max(most, second);
  }
  return most;
}

void at_rate(double rate) {
  // Off is the input, bit for bit; on it is not (control).
  {
    FeqReverb* reverb = feq_reverb_create(rate, 2);
    FeqReverbSettings off = settings_of(FEQ_REVERB_PLATE, 1.8);
    off.enabled = 0;
    feq_reverb_configure(reverb, &off);
    Stereo in = voice(rate, 0.5, 0.18, 0.12, 0.3);
    Stereo out = in;
    run(reverb, out, rate);
    check(out.left == in.left && out.right == in.right,
          "off is exactly the input");
    const FeqReverbSettings on = settings_of(FEQ_REVERB_PLATE, 1.8);
    feq_reverb_configure(reverb, &on);
    Stereo wet = in;
    run(reverb, wet, rate);
    check(wet.left != in.left, "on, the voice gains a tail (control)");
    feq_reverb_destroy(reverb);
  }

  // Each type falls 60 dB in its decay, short and long.
  const char* names[FEQ_REVERB_TYPES] = {"plate", "vocal plate", "room",
                                         "chamber", "hall"};
  const double decays[FEQ_REVERB_TYPES][2] = {
      {1.0, 3.0}, {0.8, 2.0}, {0.4, 1.0}, {0.8, 2.0}, {2.0, 6.0}};
  for (int type = 0; type < FEQ_REVERB_TYPES; ++type) {
    for (const double decay : decays[type]) {
      const std::vector<double> wet =
          impulse_response(type, decay, rate, decay * 1.5 + 0.5);
      const double rt60 = rt60_of(wet, rate);
      std::printf("%6.0f Hz %-11s set %.1f s, measured %.2f s\n", rate,
                  names[type], decay, rt60);
      check(std::fabs(rt60 - decay) < decay * 0.15,
            "each type's tail falls 60 dB in its decay time");
    }
  }

  // Dense at once, and the first sample out is the dry one.
  {
    const std::vector<double> raw =
        impulse_response(FEQ_REVERB_PLATE, 1.8, rate, 0.3);
    check(raw[0] == 0.0, "the dry voice is not delayed");
    // Counted as a listener hears it: the audible band, at about 48 kHz.
    const std::vector<double> band = audible(raw, rate);
    const auto factor =
        static_cast<size_t>(std::max(1.0, std::round(rate / 48000.0)));
    std::vector<double> wet;
    for (size_t i = 0; i < band.size(); i += factor) wet.push_back(band[i]);
    const double heard_rate = rate / static_cast<double>(factor);
    const double density = echo_density(wet, heard_rate, 0.030);
    double dense_at = -1.0;
    for (double t = 0.005; t < 0.25 && dense_at < 0.0; t += 0.005) {
      if (echo_density(wet, heard_rate, t) >= 0.9) dense_at = t;
    }
    std::printf("%6.0f Hz plate: tail from %.1f ms, echo density 30 ms on "
                "%.2f, dense %.0f ms on\n",
                rate, 1000.0 * static_cast<double>(onset_of(wet)) / heard_rate,
                density, dense_at * 1000.0);
    // Measured 2026-11-24: 20 ms on at 44.1 and 48 kHz, 25-30 at 88.2 and
    // 96, 35-45 above (linear interpolation blurs the taps more at the low
    // rates). The paper's four diffusers alone took 165-230 ms.
    check(dense_at > 0.0 && dense_at <= 0.050,
          "the plate is dense within 50 ms of its onset");
  }

  // A minute at the longest decay never grows.
  for (int type = 0; type < FEQ_REVERB_TYPES; ++type) {
    FeqReverb* reverb = feq_reverb_create(rate, 2);
    const FeqReverbSettings s =
        settings_of(type, FEQ_REVERB_DECAY_MAX_S);
    feq_reverb_configure(reverb, &s);
    Stereo noise(static_cast<size_t>(rate * 60.0));
    uint32_t state = 0x9E3779B9u;
    const auto burst = static_cast<size_t>(rate);
    for (size_t i = 0; i < burst; ++i) {
      state = state * 1664525u + 1013904223u;
      noise.left[i] = noise.right[i] =
          0.5f * (static_cast<float>(state) / 4294967296.0f - 0.5f);
    }
    run(reverb, noise, rate);
    feq_reverb_destroy(reverb);
    double first = 0.0;
    double last = 0.0;
    bool finite = true;
    for (size_t i = 0; i < noise.left.size(); ++i) {
      finite = finite && std::isfinite(noise.left[i]);
      const double a = std::fabs(noise.left[i]);
      if (i < burst * 2) first = std::max(first, a);
      if (i >= noise.left.size() - burst) last = std::max(last, a);
    }
    check(finite && last < first * 1e-3,
          "a minute at the longest decay never grows");
  }

  // A type changed mid-tail comes in without a step.
  {
    const FeqReverbSettings plate = settings_of(FEQ_REVERB_PLATE, 2.0);
    const FeqReverbSettings hall = settings_of(FEQ_REVERB_HALL, 2.0);
    FeqReverb* old_stage = feq_reverb_create(rate, 2);
    feq_reverb_configure(old_stage, &plate);
    // 1.2 s ends in a gap between syllables: the seam cuts no dry voice,
    // only the tail is crossed.
    Stereo before = voice(rate, 1.2, 0.18, 0.12, 0.3);
    run(old_stage, before, rate);
    // Same input, two paths: handed over with its fade, and a hard splice
    // onto a hall that has heard the same voice (the control).
    FeqReverb* handed = feq_reverb_create(rate, 2);
    feq_reverb_configure(handed, &hall);
    feq_reverb_transfer(handed, old_stage);
    FeqReverb* spliced = feq_reverb_create(rate, 2);
    feq_reverb_configure(spliced, &hall);
    Stereo warm = voice(rate, 1.2, 0.18, 0.12, 0.3);
    run(spliced, warm, rate);
    Stereo silence_a(static_cast<size_t>(rate * 0.2));
    Stereo silence_b(static_cast<size_t>(rate * 0.2));
    run(handed, silence_a, rate);
    run(spliced, silence_b, rate);
    std::vector<float> joined_smooth(before.left);
    joined_smooth.insert(joined_smooth.end(), silence_a.left.begin(),
                         silence_a.left.end());
    std::vector<float> joined_hard(before.left);
    joined_hard.insert(joined_hard.end(), silence_b.left.begin(),
                       silence_b.left.end());
    const size_t seam = before.left.size();
    const double steady = largest_step(joined_smooth, seam / 2, seam - 1);
    const double smooth = largest_step(joined_smooth, seam - 4, seam + 64);
    const double hard = largest_step(joined_hard, seam - 4, seam + 64);
    std::printf("%6.0f Hz type change: steady %.2e, faded %.2e, spliced "
                "%.2e\n",
                rate, steady, smooth, hard);
    check(smooth <= steady * 1.5 + 1e-6,
          "a type changed mid-tail comes in without a step");
    check(hard > smooth * 3.0, "the same tails spliced step (control)");
    feq_reverb_destroy(old_stage);
    feq_reverb_destroy(handed);
    feq_reverb_destroy(spliced);
  }

  // Ducking: down by its depth while the voice is heard, back in the gaps.
  {
    FeqReverbSettings ducked = settings_of(FEQ_REVERB_PLATE, 1.2);
    ducked.duck = 1;
    ducked.duck_db = 10.0;
    const FeqReverbSettings open = settings_of(FEQ_REVERB_PLATE, 1.2);
    const double seconds = 3.0;
    // 1.5 s of voice, then 1.5 s of nothing.
    Stereo in = voice(rate, seconds, 1.5, 1.5, 0.2);
    Stereo out_ducked = in;
    Stereo out_open = in;
    FeqReverb* a = feq_reverb_create(rate, 2);
    FeqReverb* b = feq_reverb_create(rate, 2);
    feq_reverb_configure(a, &ducked);
    feq_reverb_configure(b, &open);
    run(a, out_ducked, rate);
    run(b, out_open, rate);
    feq_reverb_destroy(a);
    feq_reverb_destroy(b);
    const auto at = [&](double t) { return static_cast<size_t>(rate * t); };
    const double talking_ducked = rms_db(out_ducked.left, in.left, at(0.8), at(1.4));
    const double talking_open = rms_db(out_open.left, in.left, at(0.8), at(1.4));
    const double gap_ducked = rms_db(out_ducked.left, in.left, at(2.1), at(2.4));
    const double gap_open = rms_db(out_open.left, in.left, at(2.1), at(2.4));
    std::printf("%6.0f Hz duck: talking %.1f dB under open, gap %.1f dB\n",
                rate, talking_open - talking_ducked, gap_open - gap_ducked);
    check(std::fabs((talking_open - talking_ducked) - 10.0) < 2.0,
          "ducking takes the tail down by its depth while the voice is heard");
    check(gap_open - gap_ducked < 2.0, "and gives it back in the gaps");
  }

  // The work per 10 ms block, on this machine.
  {
    FeqReverb* reverb = feq_reverb_create(rate, 2);
    const FeqReverbSettings s = settings_of(FEQ_REVERB_HALL, 2.8);
    feq_reverb_configure(reverb, &s);
    Stereo in = voice(rate, 2.0, 0.18, 0.12, 0.3);
    const auto start = std::chrono::steady_clock::now();
    run(reverb, in, rate);
    const auto spent = std::chrono::duration<double, std::milli>(
                           std::chrono::steady_clock::now() - start)
                           .count();
    std::printf("%6.0f Hz work: %.3f ms per 10 ms block\n", rate,
                spent / 200.0);
    feq_reverb_destroy(reverb);
  }
}

/** A mono mic: the two sides summed, and still the input when off. */
void mono_stream() {
  FeqReverb* reverb = feq_reverb_create(48000.0, 1);
  const FeqReverbSettings s = settings_of(FEQ_REVERB_PLATE, 1.5);
  feq_reverb_configure(reverb, &s);
  std::vector<float> samples(48000, 0.0f);
  samples[0] = 1.0f;
  float* channels[1] = {samples.data()};
  for (size_t at = 0; at < samples.size(); at += 480) {
    feq_reverb_process(reverb, channels, 480);
    channels[0] += 480;
  }
  double tail = 0.0;
  for (size_t i = 1; i < samples.size(); ++i) tail += samples[i] * samples[i];
  check(samples[0] == 1.0f && tail > 1e-4, "a mono mic gets the tail summed");
  feq_reverb_destroy(reverb);
}

}  // namespace

int main() {
  for (const double rate : kRates) at_rate(rate);
  mono_stream();
  return feq_test::finish();
}
