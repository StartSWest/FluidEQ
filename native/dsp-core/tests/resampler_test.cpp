/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The resampler has no TypeScript counterpart to be held to.
 *
 * Chromium did this conversion inside `decodeAudioData`, so there is nothing in
 * the reference to compare against and the parity corpus cannot cover it. What
 * follows is measurement instead: a tone in, and the question of whether it is
 * still that tone and nothing else.
 */

#include "fluideq/resampler.h"

#include <cmath>
#include <cstdio>
#include <vector>

namespace {

constexpr double kPi = 3.14159265358979323846;
int g_failures = 0;

void check(bool ok, const char* what) {
  std::printf("  %-4s %s\n", ok ? "ok" : "FAIL", what);
  if (!ok) {
    ++g_failures;
  }
}

std::vector<float> tone(double hz, double rate, uint32_t frames,
                        double amplitude) {
  std::vector<float> out(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    out[at] = static_cast<float>(
        std::sin((2.0 * kPi * hz * static_cast<double>(at)) / rate) *
        amplitude);
  }
  return out;
}

double rms(const float* samples, uint32_t frames) {
  double sum = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    sum += static_cast<double>(samples[at]) * static_cast<double>(samples[at]);
  }
  return frames > 0 ? std::sqrt(sum / static_cast<double>(frames)) : 0.0;
}

/**
 * The amplitude and phase of one tone, by projection.
 *
 * `frames` MUST span a whole number of cycles of `hz`. Off an integer the
 * projection leaks, and the leak lands in the residual below as though the
 * converter had produced it — which is how the first version of this test
 * reported -39 dB for a filter that measures -100.
 */
struct Tone {
  double amplitude;
  double cosine;
  double sine;
};

Tone project(const float* samples, uint32_t frames, double hz, double rate) {
  double cosine = 0.0;
  double sine = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    const double angle = (2.0 * kPi * hz * static_cast<double>(at)) / rate;
    cosine += static_cast<double>(samples[at]) * std::cos(angle);
    sine += static_cast<double>(samples[at]) * std::sin(angle);
  }
  const double scale = 2.0 / static_cast<double>(frames);
  Tone out;
  out.cosine = cosine * scale;
  out.sine = sine * scale;
  out.amplitude = std::hypot(out.cosine, out.sine);
  return out;
}

/** Everything the projected tone does not account for, as an RMS. */
double residual_rms(const float* samples, uint32_t frames, double hz,
                    double rate, const Tone& fitted) {
  double sum = 0.0;
  for (uint32_t at = 0; at < frames; ++at) {
    const double angle = (2.0 * kPi * hz * static_cast<double>(at)) / rate;
    const double modelled =
        fitted.cosine * std::cos(angle) + fitted.sine * std::sin(angle);
    const double error = static_cast<double>(samples[at]) - modelled;
    sum += error * error;
  }
  return std::sqrt(sum / static_cast<double>(frames));
}

/** Whole cycles of `hz` inside `available` frames, for an exact projection. */
uint32_t whole_cycles(uint32_t available, double hz, double rate) {
  const double period = rate / hz;
  const auto cycles = static_cast<uint32_t>(
      std::floor(static_cast<double>(available) / period));
  return static_cast<uint32_t>(static_cast<double>(cycles) * period);
}

/** Run a whole buffer through in one call. */
std::vector<float> convert(FeqResampler* state, const std::vector<float>& input,
                           double ratio) {
  std::vector<float> output(
      static_cast<size_t>(static_cast<double>(input.size()) * ratio) + 64,
      0.0f);
  const float* in[1] = {input.data()};
  float* out[1] = {output.data()};
  uint32_t consumed = 0;
  const uint32_t written =
      feq_resample(state, in, static_cast<uint32_t>(input.size()), out,
                   static_cast<uint32_t>(output.size()), &consumed);
  output.resize(written);
  return output;
}

void test_identity() {
  std::printf("identity\n");
  FeqResampler* state = feq_resampler_create(48000.0, 48000.0, 1);
  check(state != nullptr, "equal rates still produce a converter");
  const std::vector<float> input = tone(1000.0, 48000.0, 4096, 0.5);
  const std::vector<float> output = convert(state, input, 1.0);
  bool exact = output.size() == input.size();
  for (size_t at = 0; at < output.size() && exact; ++at) {
    exact = output[at] == input[at];
  }
  // Bit-exact, not close: a converter at ratio one that merely approximates its
  // input has put 32 multiplies between the file and the speaker for the
  // privilege of being slightly wrong.
  check(exact, "equal rates copy bit for bit");
  feq_resampler_destroy(state);
}

void test_upsample_keeps_the_tone() {
  std::printf("44.1 to 48\n");
  constexpr uint32_t kFrames = 44100;
  FeqResampler* state = feq_resampler_create(44100.0, 48000.0, 1);
  const std::vector<float> input = tone(1000.0, 44100.0, kFrames, 0.5);
  const std::vector<float> output = convert(state, input, 48000.0 / 44100.0);

  const auto frames = static_cast<uint32_t>(output.size());
  check(frames > 47000 && frames < 48100,
        "one second of 44.1 becomes one second of 48");

  // Skip the filter start-up, which is half a window of ramp.
  const uint32_t skip = 512;
  const uint32_t span = whole_cycles(frames - skip, 1000.0, 48000.0);
  const Tone fitted = project(output.data() + skip, span, 1000.0, 48000.0);
  check(fitted.amplitude > 0.499 && fitted.amplitude < 0.501,
        "the tone keeps its amplitude to a thousandth");

  /**
   * Everything that is not the tone, which is the number that matters.
   *
   * A linear interpolator passes the amplitude check and fails this one: its
   * images sit around -14 dB, which is audible shimmer on every 44.1 kHz track
   * in the library. Below -80 dB is inaudible under any programme.
   */
  const double residual =
      residual_rms(output.data() + skip, span, 1000.0, 48000.0, fitted);
  const double residual_db =
      20.0 * std::log10(residual / (fitted.amplitude / std::sqrt(2.0)));
  std::printf("       residual %.1f dB below the tone\n", residual_db);
  check(residual_db < -80.0, "nothing but the tone survives, below -80 dB");
  feq_resampler_destroy(state);
}

void test_downsample_rejects_what_will_not_fit() {
  std::printf("96 to 48\n");
  constexpr uint32_t kFrames = 96000;
  const std::vector<float> audible = tone(1000.0, 96000.0, kFrames, 0.5);
  const std::vector<float> ultrasonic = tone(30000.0, 96000.0, kFrames, 0.5);

  /**
   * The positive control, and the reason the rejection check means anything.
   *
   * A converter that output silence for everything would pass the rejection
   * check perfectly. So the same converter is asked for a 1 kHz tone first: it
   * has to survive, at level, before the 30 kHz one failing to is a result.
   */
  FeqResampler* pass = feq_resampler_create(96000.0, 48000.0, 1);
  const std::vector<float> passed = convert(pass, audible, 0.5);
  const uint32_t kept_span = whole_cycles(
      static_cast<uint32_t>(passed.size()) - 512, 1000.0, 48000.0);
  const double kept =
      project(passed.data() + 512, kept_span, 1000.0, 48000.0).amplitude;
  check(kept > 0.49 && kept < 0.51, "1 kHz survives the halving, at level");
  feq_resampler_destroy(pass);

  /**
   * 30 kHz cannot exist at 48 kHz. A converter that simply took every other
   * sample would fold it to 18 kHz at full amplitude — an added shimmer rather
   * than an obvious defect, which is how a broken resampler ships.
   */
  FeqResampler* reject = feq_resampler_create(96000.0, 48000.0, 1);
  const std::vector<float> rejected = convert(reject, ultrasonic, 0.5);
  const uint32_t frames =
      whole_cycles(static_cast<uint32_t>(rejected.size()) - 512, 18000.0,
                   48000.0);
  const double folded =
      project(rejected.data() + 512, frames, 18000.0, 48000.0).amplitude;
  const double level = rms(rejected.data() + 512, frames);
  std::printf("       fold-back at 18 kHz: %.1f dB, total rms %.1f dB\n",
              20.0 * std::log10(folded / 0.5),
              20.0 * std::log10(level / (0.5 / std::sqrt(2.0))));
  check(folded < 1e-4, "30 kHz does not come back as 18 kHz");
  check(level < 1e-4, "and nothing else comes back either");
  feq_resampler_destroy(reject);
}

void test_streaming_matches_one_call() {
  std::printf("streaming\n");
  constexpr uint32_t kFrames = 20000;
  const std::vector<float> input = tone(440.0, 44100.0, kFrames, 0.4);

  FeqResampler* whole = feq_resampler_create(44100.0, 48000.0, 1);
  const std::vector<float> once = convert(whole, input, 48000.0 / 44100.0);
  feq_resampler_destroy(whole);

  FeqResampler* streamed = feq_resampler_create(44100.0, 48000.0, 1);
  std::vector<float> chunked;
  std::vector<float> block(4096);
  uint32_t at = 0;
  while (at < kFrames) {
    // Deliberately not a divisor of anything: a chunk boundary that always
    // landed on a whole output frame would hide a phase that reset per call.
    const uint32_t span = at + 337 < kFrames ? 337u : kFrames - at;
    uint32_t offset = 0;
    while (offset < span) {
      const float* piece[1] = {input.data() + at + offset};
      float* out[1] = {block.data()};
      uint32_t consumed = 0;
      const uint32_t written =
          feq_resample(streamed, piece, span - offset, out,
                       static_cast<uint32_t>(block.size()), &consumed);
      chunked.insert(chunked.end(), block.begin(), block.begin() + written);
      if (consumed == 0 && written == 0) {
        break;
      }
      offset += consumed;
    }
    at += span;
  }
  feq_resampler_destroy(streamed);

  const bool same = chunked.size() == once.size();
  double worst = 0.0;
  for (size_t index = 0; index < chunked.size() && index < once.size();
       ++index) {
    const double error = std::fabs(static_cast<double>(chunked[index]) -
                                   static_cast<double>(once[index]));
    worst = error > worst ? error : worst;
  }
  std::printf("       %zu frames streamed, %zu in one call\n", chunked.size(),
              once.size());
  check(same, "a track fed in pieces produces the same frame count");
  check(worst < 1e-6, "and the same samples");
}

}  // namespace

int main() {
  std::printf("fluideq resampler\n");
  test_identity();
  test_upsample_keeps_the_tone();
  test_downsample_rejects_what_will_not_fit();
  test_streaming_matches_one_call();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
