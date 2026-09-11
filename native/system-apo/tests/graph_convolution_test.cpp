/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two convolution stages: a `Convolution:` impulse response read off
 * disk, and the linear-phase FIR a `GraphicEQ:` curve is designed into.
 *
 * These checks measure WHERE a tap comes out, not just how loud it is, which
 * is what makes them the only ones that can see `latency_frames()` being
 * wrong — and they are the only ones that touch the file system, because
 * `read_wav` is the only door an impulse response comes through and a test
 * that bypassed it would not prove the graph can load one.
 *
 * Split from `graph_test.cpp`, which measures the biquads and the preamp;
 * one file holding both was past the 500-line limit.
 */

#include "fluideq_engine/graph.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <string>
#include <system_error>
#include <vector>

#include "fluideq/convolver.h"
#include "fluideq_engine/config.h"
#include "graph_test_support.h"
#include "wav_fixture.h"

using fluideq_engine::Chain;
using fluideq_engine::Graph;
using fluideq_engine_test::chain_from;
using fluideq_engine_test::kRate;
using fluideq_engine_test::mentions;
using fluideq_engine_test::peak_near;
using fluideq_engine_test::report;
using fluideq_engine_test::rms_db;
using fluideq_engine_test::run_blocks;
using fluideq_engine_test::tone;
using fluideq_engine_test::tone_change_db;
using fluideq_engine_test::write_float_wav;

namespace {

// `graph.cpp`'s own `kGraphicTapsAt48k`, mirrored: these checks run at the
// 48 kHz reference rate, where the design needs no scaling. A linear-phase
// FIR is centred, so half of this is the group delay `latency_frames()` has
// to include.
constexpr size_t kGraphicTapsAt48k = 4097;
// And the capped count `graph.cpp` falls back to at a rate that would size an
// unbounded design: `(kMaxKernelTaps - 1) | 1`.
constexpr size_t kCappedGraphicTaps = 65535;

/** The two-tap impulse response the convolution checks look for. */
std::vector<float> two_tap_impulse_response() {
  std::vector<float> kernel(64, 0.0f);
  kernel[0] = 1.0f;
  kernel[48] = 0.5f;
  return kernel;
}

/** Writes `kernel` as a WAV at `rate` and resolves a chain naming it. */
Chain convolution_chain(const std::filesystem::path& path, uint32_t rate,
                        const std::vector<float>& kernel,
                        const std::string& extra_lines = "") {
  CHECK(write_float_wav(path, rate, kernel));
  return chain_from("Convolution: " + path.string() + "\r\n" + extra_lines);
}

/** Where the largest sample in the whole buffer sits. */
size_t global_peak(const std::vector<float>& samples) {
  return peak_near(samples, samples.size() / 2, samples.size());
}

// ---------------------------------------------------------------------------

void convolution_applies_kernel() {
  std::printf("an impulse response is convolved at the reported latency\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-48000.wav";
  const Chain chain =
      convolution_chain(path, 48000, two_tap_impulse_response());
  CHECK(chain.matched);
  CHECK(!chain.convolution_path.empty());

  Graph graph(chain, kRate, 1, 512);
  CHECK(!graph.is_passthrough());
  // An impulse response is causal: the only delay it adds is the convolver's
  // own block pipeline, with no group-delay term of the kind a designed
  // linear-phase FIR carries.
  CHECK(graph.latency_frames() == feq_convolver_latency());
  CHECK(graph.warnings().empty());
  CHECK(graph.problems().empty());

  std::vector<std::vector<float>> channels(1, std::vector<float>(2048, 0.0f));
  channels[0][0] = 1.0f;
  run_blocks(graph, channels, 512);

  const size_t latency = graph.latency_frames();
  std::printf("       taps measure %.5f and %.5f (target 1.0, 0.5)\n",
              static_cast<double>(channels[0][latency]),
              static_cast<double>(channels[0][latency + 48]));
  CHECK(std::fabs(static_cast<double>(channels[0][latency]) - 1.0) < 1e-4);
  CHECK(std::fabs(static_cast<double>(channels[0][latency + 48]) - 0.5) < 1e-4);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void convolution_at_other_rate_is_resampled() {
  std::printf("an impulse response at 44.1 kHz is converted to the stream\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-44100.wav";
  const Chain chain =
      convolution_chain(path, 44100, two_tap_impulse_response());
  CHECK(chain.matched);

  Graph graph(chain, kRate, 1, 512);
  CHECK(graph.latency_frames() == feq_convolver_latency());
  CHECK(mentions(graph.warnings(), "44100"));
  CHECK(mentions(graph.warnings(), "48000"));
  CHECK(mentions(graph.warnings(), "resampl"));

  std::vector<std::vector<float>> channels(1, std::vector<float>(2048, 0.0f));
  channels[0][0] = 1.0f;
  run_blocks(graph, channels, 512);

  const size_t latency = graph.latency_frames();
  // 48 frames at 44.1 kHz is 52.2 frames at 48 kHz, and the resampler is
  // delay-compensated, so the second tap sits that far past the first.
  const size_t expected =
      latency + static_cast<size_t>(std::lround(48.0 * 48000.0 / 44100.0));
  const size_t found = peak_near(channels[0], expected, 6);
  std::printf("       second tap at %zu (target %zu +/- 1)\n", found, expected);
  CHECK(found + 1 >= expected && found <= expected + 1);
  CHECK(std::fabs(static_cast<double>(channels[0][found])) > 0.3);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void convolution_and_graphic_eq_combine() {
  std::printf("a convolution file and a flat graphic curve run in series\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-combo.wav";
  const Chain chain = convolution_chain(path, 48000, two_tap_impulse_response(),
                                        "GraphicEQ: 20 0; 20000 0\r\n");
  CHECK(chain.matched);
  CHECK(chain.graphic_curves.size() == 1 &&
        chain.graphic_curves[0].size() == 2);

  Graph graph(chain, kRate, 1, 512);
  // Two convolvers in series, each with its own block-pipeline latency, plus
  // the graphic FIR's group delay — it is designed linear-phase and therefore
  // centred, so its energy sits at tap 2048 of 4097.
  CHECK(graph.latency_frames() ==
        2 * feq_convolver_latency() + kGraphicTapsAt48k / 2);

  std::vector<std::vector<float>> channels(1, std::vector<float>(8192, 0.0f));
  channels[0][0] = 1.0f;
  run_blocks(graph, channels, 512);

  // Where the impulse actually comes out, found rather than assumed: this is
  // the check that would have caught the group delay being left out of
  // `latency_frames()`, because the two only agree once it is in.
  const size_t found = global_peak(channels[0]);
  const double first = static_cast<double>(channels[0][found]);
  const double second = static_cast<double>(channels[0][found + 48]);
  std::printf("       peak at %zu, latency_frames() %u; taps measure %.5f and"
              " %.5f (target 1.0, 0.5)\n",
              found, graph.latency_frames(), first, second);
  CHECK(found == graph.latency_frames());
  // A flat (0 dB) GraphicEQ curve is a Hann-windowed frequency-sampled FIR,
  // not a mathematically exact all-pass, so in principle it can ring by a
  // small amount rather than reproducing the impulse response's own taps
  // exactly — hence the looser tolerance than the single-stage check above,
  // even though this kernel measures exact to print precision.
  CHECK(std::fabs(first - 1.0) < 1e-3);
  CHECK(std::fabs(second - 0.5) < 1e-3);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void stereo_convolvers_do_not_share_history() {
  std::printf("each channel's convolver keeps its own history\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-stereo.wav";
  const Chain chain =
      convolution_chain(path, 48000, two_tap_impulse_response());
  CHECK(chain.matched);

  Graph graph(chain, kRate, 2, 512);
  std::vector<std::vector<float>> channels(2, std::vector<float>(2048, 0.0f));
  channels[0][0] = 1.0f;    // Channel 0: impulse at frame 0.
  channels[1][100] = 1.0f;  // Channel 1: impulse at frame 100.
  run_blocks(graph, channels, 512);

  const size_t latency = graph.latency_frames();
  const double left0 = static_cast<double>(channels[0][latency]);
  const double left48 = static_cast<double>(channels[0][latency + 48]);
  const double right0 = static_cast<double>(channels[1][latency + 100]);
  const double right48 = static_cast<double>(channels[1][latency + 148]);
  std::printf("       left %.5f/%.5f, right %.5f/%.5f\n", left0, left48,
              right0, right48);
  CHECK(std::fabs(left0 - 1.0) < 1e-4);
  CHECK(std::fabs(left48 - 0.5) < 1e-4);
  CHECK(std::fabs(right0 - 1.0) < 1e-4);
  CHECK(std::fabs(right48 - 0.5) < 1e-4);

  // Shared history would leak channel 1's later impulse into channel 0's
  // output and vice versa; neither channel shows anything at the other's tap.
  const double leak_left =
      std::fabs(static_cast<double>(channels[0][latency + 100]));
  const double leak_right = std::fabs(static_cast<double>(channels[1][latency]));
  std::printf("       cross-talk %.6f / %.6f\n", leak_left, leak_right);
  CHECK(leak_left < 1e-4);
  CHECK(leak_right < 1e-4);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void over_long_impulse_response_is_truncated() {
  std::printf("an impulse response past the engine's limit is truncated\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-long.wav";
  // One tap past the 65536 this engine will run, so the part that has to be
  // dropped is a single sample whose absence is measurable — and the tap at
  // zero, which must survive, is what stops "nothing came out" from passing
  // this check.
  std::vector<float> kernel(65537, 0.0f);
  kernel[0] = 1.0f;
  kernel[65536] = 0.5f;
  const Chain chain = convolution_chain(path, 48000, kernel);
  Graph graph(chain, kRate, 1, 512);
  CHECK(mentions(graph.warnings(), "65537"));
  CHECK(mentions(graph.warnings(), "65536"));

  std::vector<std::vector<float>> channels(1, std::vector<float>(66600, 0.0f));
  channels[0][0] = 1.0f;
  run_blocks(graph, channels, 512);

  const size_t latency = graph.latency_frames();
  std::printf("       kept tap %.5f, dropped tap %.5f (target 1.0, 0.0)\n",
              static_cast<double>(channels[0][latency]),
              static_cast<double>(channels[0][latency + 65536]));
  CHECK(std::fabs(static_cast<double>(channels[0][latency]) - 1.0) < 1e-4);
  CHECK(std::fabs(static_cast<double>(channels[0][latency + 65536])) < 1e-4);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

/**
 * The truncation happens before the conversion now — a long file at another
 * rate used to be resampled whole and then thrown away down to 65536 taps —
 * so the check that matters is that the taps that survive still land where
 * the file put them. Cutting the input before the resampler means the last
 * kept sample is produced from a window that has to still be full; getting
 * that margin wrong shows up here as a tap in the wrong place, or missing.
 */
void long_impulse_at_another_rate_keeps_its_taps() {
  std::printf("a long 44.1 kHz impulse is cut before it is converted\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-long-44100.wav";
  // Far past the 65536 taps the engine runs, at a rate that forces the
  // conversion: without the pre-truncation this is a 300000-sample resample
  // whose result is immediately cut to 65536.
  std::vector<float> kernel(300000, 0.0f);
  kernel[0] = 1.0f;
  kernel[48] = 0.5f;
  const Chain chain = convolution_chain(path, 44100, kernel);
  Graph graph(chain, kRate, 1, 512);
  CHECK(mentions(graph.warnings(), "resampl"));
  // The file's own length, not the converted one.
  CHECK(mentions(graph.warnings(), "300000"));
  CHECK(mentions(graph.warnings(), "65536"));

  std::vector<std::vector<float>> channels(1, std::vector<float>(2048, 0.0f));
  channels[0][0] = 1.0f;
  run_blocks(graph, channels, 512);

  const size_t latency = graph.latency_frames();
  const size_t expected =
      latency + static_cast<size_t>(std::lround(48.0 * 48000.0 / 44100.0));
  const size_t found = peak_near(channels[0], expected, 6);
  std::printf("       second tap at %zu (target %zu +/- 1)\n", found, expected);
  CHECK(found + 1 >= expected && found <= expected + 1);
  // And the first tap is still where it was. Checked as a peak position
  // rather than a sample value: the conversion spreads a single sample over
  // the resampler's window, so the energy is at `latency` without any one
  // sample being exactly 1.0.
  const size_t first = peak_near(channels[0], latency, 6);
  CHECK(first + 1 >= latency && first <= latency + 1);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void graphic_eq_applies() {
  std::printf("a graphic curve cuts 12 dB at 1 kHz\n");
  const Chain chain = chain_from("GraphicEQ: 20 0; 1000 -12; 20000 0\r\n");
  CHECK(chain.matched);
  CHECK(chain.graphic_curves.size() == 1 &&
        chain.graphic_curves[0].size() == 3);

  Graph graph(chain, kRate, 1, 480);
  CHECK(!graph.is_passthrough());
  // The convolver's block pipeline plus the centred FIR's own group delay.
  CHECK(graph.latency_frames() ==
        feq_convolver_latency() + kGraphicTapsAt48k / 2);

  constexpr uint32_t kFrames = kRate;  // One second.
  std::vector<std::vector<float>> channels(1, tone(1000.0, 0.5, kFrames, 0));
  const std::vector<float> reference = channels[0];
  run_blocks(graph, channels, 480);

  // Measured over the second half, which starts far past both the
  // convolver's warm-up and the FIR's own 4097 taps: before then the output
  // is still the filter filling up, not its steady-state response.
  CHECK(kFrames / 2 > feq_convolver_warmup());
  const double change = rms_db(channels[0], kFrames / 2, kFrames) -
                        rms_db(reference, kFrames / 2, kFrames);
  std::printf("       measures %.2f dB (target -12)\n", change);
  CHECK(std::fabs(change - (-12.0)) < 1.5);
}

/**
 * Everything FluidEQ can put on one output at once: a convolution file, two
 * graphic curves (a driver-type curve and a headphone correction published
 * as one), a parametric band and the preamp. Each is a level change at 1 kHz
 * that can be told apart in the total, and the total is only right if every
 * one of them is applied — the second curve was the one this engine used to
 * drop, which measured 3 dB short here.
 */
void everything_on_one_output_applies() {
  std::printf("convolution, two graphic curves, a band and the preamp stack\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-stack.wav";
  // A single tap at half amplitude: -6.02 dB, with no shape of its own.
  std::vector<float> half(64, 0.0f);
  half[0] = 0.5f;
  const Chain chain = convolution_chain(
      path, 48000, half,
      "GraphicEQ: 20 -2; 20000 -2\r\n"
      "GraphicEQ: 20 -3; 20000 -3\r\n"
      "Filter 1: ON PK Fc 1000 Hz Gain -4 dB Q 1\r\n"
      "Preamp: -1 dB\r\n");
  CHECK(chain.matched);
  CHECK(chain.graphic_curves.size() == 2);
  CHECK(chain.bands.size() == 1);

  Graph graph(chain, kRate, 1, 480);
  // Both curves in ONE graphic FIR: the impulse response's convolver, the
  // graphic FIR's convolver and that FIR's own group delay — not a second
  // FIR's worth on top for the second curve.
  CHECK(graph.latency_frames() ==
        2 * feq_convolver_latency() + kGraphicTapsAt48k / 2);

  constexpr uint32_t kFrames = kRate;  // One second.
  std::vector<std::vector<float>> channels(1, tone(1000.0, 0.25, kFrames, 0));
  const std::vector<float> reference = channels[0];
  run_blocks(graph, channels, 480);

  const double change = rms_db(channels[0], kFrames / 2, kFrames) -
                        rms_db(reference, kFrames / 2, kFrames);
  const double expected = 20.0 * std::log10(0.5) - 2.0 - 3.0 - 4.0 - 1.0;
  std::printf("       measures %.2f dB (target %.2f)\n", change, expected);
  CHECK(std::fabs(change - expected) < 0.3);

  std::error_code ignored;
  std::filesystem::remove(path, ignored);
}

void unreadable_impulse_response_is_survived() {
  std::printf("a convolution file that is not there is named and skipped\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-absent.wav";
  std::error_code ignored;
  std::filesystem::remove(path, ignored);

  const Chain chain =
      chain_from("Convolution: " + path.string() + "\r\nPreamp: -6 dB\r\n");
  CHECK(chain.matched);

  Graph graph(chain, kRate, 1, 480);
  CHECK(graph.latency_frames() == 0);
  CHECK(mentions(graph.warnings(), "could not be read"));
  CHECK(mentions(graph.warnings(), "fluideq-engine-absent.wav"));
  // And the one word the app turns into a sentence: the convolution the
  // user chose is not playing.
  CHECK(graph.problems() == std::vector<std::string>{"convolution"});

  // The rest of the chain still runs. One unreadable file silencing a device
  // would be a far worse failure than the convolution simply not happening.
  const double change = tone_change_db(chain, 1000.0);
  std::printf("       preamp still measures %.3f dB (target -6)\n", change);
  CHECK(std::fabs(change - (-6.0)) < 0.05);
}

void absurd_sample_rate_caps_the_graphic_fir() {
  std::printf("a nonsense sample rate cannot size an unbounded FIR\n");
  const Chain chain = chain_from("GraphicEQ: 20 0; 1000 -12; 20000 0\r\n");
  // A rate no endpoint has, standing in for a mix format this code would be
  // wrong to trust: the FIR's tap count is derived from it, so without the
  // cap this constructor allocates whatever the format claimed.
  Graph graph(chain, 1000000, 1, 480);
  CHECK(mentions(graph.warnings(), "taps"));
  CHECK(mentions(graph.warnings(), "65535"));
  CHECK(!graph.is_passthrough());
  // The group delay follows the capped tap count rather than the one the
  // rate asked for, so a capped design still reports what it actually does.
  CHECK(graph.latency_frames() ==
        feq_convolver_latency() + kCappedGraphicTaps / 2);
}

}  // namespace

int main() {
  std::printf("fluideq engine convolution and graphic EQ\n");
  convolution_applies_kernel();
  convolution_at_other_rate_is_resampled();
  convolution_and_graphic_eq_combine();
  stereo_convolvers_do_not_share_history();
  over_long_impulse_response_is_truncated();
  long_impulse_at_another_rate_keeps_its_taps();
  graphic_eq_applies();
  everything_on_one_output_applies();
  unreadable_impulse_response_is_survived();
  absurd_sample_rate_caps_the_graphic_fir();
  return report();
}
