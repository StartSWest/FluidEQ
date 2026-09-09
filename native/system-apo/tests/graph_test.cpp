/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `Graph`, measured rather than inspected: every check here plays audio
 * through the graph and reads what came out, so a stage wired in the wrong
 * order or a coefficient handed the wrong sample rate fails even though the
 * object it built looks correct.
 *
 * Chains are built by `resolve_chain` over an in-memory provider rather than
 * by filling a `Chain` by hand, so the same config grammar Equalizer APO
 * writes is exercised on the way in. The two convolution checks are the one
 * exception that touches disk: `read_wav` is the only door an impulse
 * response comes through, and a test that bypassed it would not prove the
 * graph can load one.
 */

#include "fluideq_engine/graph.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <filesystem>
#include <map>
#include <optional>
#include <string>
#include <system_error>
#include <vector>

#include "fluideq/convolver.h"
#include "fluideq_engine/config.h"
#include "wav_fixture.h"

using fluideq_engine::Chain;
using fluideq_engine::Endpoint;
using fluideq_engine::FileProvider;
using fluideq_engine::Graph;
using fluideq_engine::resolve_chain;
using fluideq_engine_test::write_float_wav;

namespace {

int g_failures = 0;

void check_impl(bool ok, const char* expr, const char* file, int line) {
  if (!ok) {
    std::printf("  FAIL %s:%d: %s\n", file, line, expr);
    ++g_failures;
  }
}

#define CHECK(...) check_impl((__VA_ARGS__), #__VA_ARGS__, __FILE__, __LINE__)

constexpr double kPi = 3.14159265358979323846;
constexpr uint32_t kRate = 48000;

// ---------------------------------------------------------------------------
// Building chains through the real resolver.

using Files = std::map<std::wstring, std::string>;

FileProvider provider(const Files& files) {
  return [&files](const std::wstring& path) -> std::optional<std::string> {
    const auto found = files.find(path);
    if (found == files.end()) {
      return std::nullopt;
    }
    return found->second;
  };
}

const Endpoint& endpoint() {
  static const Endpoint value{L"{AAAA}", L"Speakers (Realtek)"};
  return value;
}

/** One config.txt, resolved for the endpoint above. */
Chain chain_from(const std::string& config) {
  Files files;
  files[L"C:\\cfg\\config.txt"] = config;
  return resolve_chain(L"C:\\cfg", endpoint(), provider(files));
}

// ---------------------------------------------------------------------------
// Signals.

std::vector<float> tone(double hz, double amplitude, uint32_t frames,
                        uint32_t from_frame) {
  std::vector<float> out(frames);
  for (uint32_t at = 0; at < frames; ++at) {
    const double n = static_cast<double>(from_frame + at);
    out[at] = static_cast<float>(
        amplitude * std::cos(2.0 * kPi * hz * n / static_cast<double>(kRate)));
  }
  return out;
}

double rms_db(const std::vector<float>& samples, uint32_t from, uint32_t to) {
  double sum = 0.0;
  for (uint32_t at = from; at < to; ++at) {
    const double value = static_cast<double>(samples[at]);
    sum += value * value;
  }
  const double mean = sum / static_cast<double>(to - from);
  return 10.0 * std::log10(mean);
}

/** Runs a whole buffer through `graph` in `block`-frame steps, in place. */
void run_blocks(Graph& graph, std::vector<std::vector<float>>& channels,
                uint32_t block) {
  const auto frames = static_cast<uint32_t>(channels[0].size());
  std::vector<float*> planar(channels.size());
  for (uint32_t at = 0; at < frames; at += block) {
    const uint32_t span = block < frames - at ? block : frames - at;
    for (size_t channel = 0; channel < channels.size(); ++channel) {
      planar[channel] = channels[channel].data() + at;
    }
    graph.process(planar.data(), span);
  }
}

bool mentions(const std::vector<std::string>& lines, const char* needle) {
  for (const auto& line : lines) {
    if (line.find(needle) != std::string::npos) {
      return true;
    }
  }
  return false;
}

/** Index of the largest magnitude within `centre` +/- `radius`. */
size_t peak_near(const std::vector<float>& samples, size_t centre,
                 size_t radius) {
  const size_t from = centre > radius ? centre - radius : 0;
  const size_t to = centre + radius + 1 < samples.size() ? centre + radius + 1
                                                         : samples.size();
  size_t best = from;
  for (size_t at = from; at < to; ++at) {
    if (std::fabs(samples[at]) > std::fabs(samples[best])) {
      best = at;
    }
  }
  return best;
}

/** The two-tap impulse response both convolution checks look for. */
std::vector<float> two_tap_impulse_response() {
  std::vector<float> kernel(64, 0.0f);
  kernel[0] = 1.0f;
  kernel[48] = 0.5f;
  return kernel;
}

// ---------------------------------------------------------------------------
// Checks.

/** The change one steady tone takes, in dB, measured over the last half. */
double tone_change_db(const Chain& chain, double hz) {
  constexpr uint32_t kFrames = kRate;  // One second.
  std::vector<std::vector<float>> channels(2, tone(hz, 0.5, kFrames, 0));
  const std::vector<float> reference = channels[0];

  Graph graph(chain, kRate, 2, 480);
  run_blocks(graph, channels, 480);

  const double before = rms_db(reference, kFrames / 2, kFrames);
  const double left = rms_db(channels[0], kFrames / 2, kFrames);
  const double right = rms_db(channels[1], kFrames / 2, kFrames);
  // Both channels run the same filters over the same signal, so anything
  // that made them differ is per-channel state leaking between them.
  CHECK(std::fabs(left - right) < 1e-6);
  return left - before;
}

void peak_cut_attenuates_its_frequency() {
  std::printf("a -20 dB peak at 1 kHz cuts 1 kHz and leaves 100 Hz alone\n");
  const Chain chain = chain_from("Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\n");
  CHECK(chain.matched);
  CHECK(chain.bands.size() == 1);

  const double at_1k = tone_change_db(chain, 1000.0);
  std::printf("       1 kHz measures %.2f dB (target -20)\n", at_1k);
  CHECK(std::fabs(at_1k - (-20.0)) < 1.0);

  const double at_100 = tone_change_db(chain, 100.0);
  std::printf("       100 Hz measures %.2f dB (target 0)\n", at_100);
  CHECK(std::fabs(at_100) < 0.5);
}

void preamp_scales() {
  std::printf("a -6 dB preamp scales by -6 dB and adds no latency\n");
  const Chain chain = chain_from("Preamp: -6 dB\r\n");
  CHECK(chain.matched);
  CHECK(chain.bands.empty());

  Graph graph(chain, kRate, 2, 480);
  CHECK(!graph.is_passthrough());
  CHECK(graph.latency_frames() == 0);
  CHECK(graph.warnings().empty());

  const double change = tone_change_db(chain, 1000.0);
  std::printf("       measures %.3f dB (target -6)\n", change);
  CHECK(std::fabs(change - (-6.0)) < 0.05);
}

void unmatched_chain_is_passthrough() {
  std::printf("a config that never names this endpoint changes nothing\n");
  // Everything here is behind a guard for a different device, which is what
  // an endpoint FluidEQ has no profile for actually resolves to.
  const Chain guarded = chain_from(
      "Device: {BBBB}\r\nFilter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\n"
      "Preamp: -6 dB\r\n");
  CHECK(!guarded.matched);

  // And the same chain with real work in it, unmatched: this is what proves
  // the flag itself gates the graph, rather than the chain merely being empty.
  Chain unmatched = chain_from(
      "Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\r\nPreamp: -6 dB\r\n");
  CHECK(unmatched.matched);
  CHECK(unmatched.bands.size() == 1);
  unmatched.matched = false;

  for (const Chain& chain : {guarded, unmatched}) {
    std::vector<std::vector<float>> channels(2, tone(1000.0, 0.5, 4800, 0));
    const std::vector<float> reference = channels[0];

    Graph graph(chain, kRate, 2, 480);
    CHECK(graph.is_passthrough());
    CHECK(graph.latency_frames() == 0);
    run_blocks(graph, channels, 480);

    bool identical = true;
    for (size_t at = 0; at < reference.size(); ++at) {
      identical = identical && channels[0][at] == reference[at] &&
                  channels[1][at] == reference[at];
    }
    CHECK(identical);
  }
}

void state_inherits_across_gain_change() {
  std::printf("a gain change carries the filter history across\n");
  const Chain a = chain_from("Filter: ON PK Fc 1000 Hz Gain -3 dB Q 1\r\n");
  const Chain b = chain_from("Filter: ON PK Fc 1000 Hz Gain -4 dB Q 1\r\n");
  constexpr uint32_t kFrames = 4800;
  constexpr uint32_t kTail = 16;

  // The tone is a cosine so frame 4800 — 100 whole cycles of 1 kHz at 48 kHz
  // — is a peak rather than a zero crossing. At a zero crossing a filter
  // started from silence would produce nearly the right sample by accident
  // and the "without" half of this check would prove nothing.
  std::vector<std::vector<float>> first_channels(1, tone(1000.0, 0.5, kFrames, 0));
  Graph first(a, kRate, 1, kFrames);
  run_blocks(first, first_channels, kFrames);
  const double last = static_cast<double>(first_channels[0][kFrames - 1]);

  const std::vector<float> next = tone(1000.0, 0.5, kTail, kFrames);

  std::vector<std::vector<float>> carried(1, next);
  Graph warm(b, kRate, 1, kTail);
  CHECK(warm.has_same_band_layout(first));
  warm.inherit_state(first);
  run_blocks(warm, carried, kTail);

  std::vector<std::vector<float>> fresh(1, next);
  Graph cold(b, kRate, 1, kTail);
  run_blocks(cold, fresh, kTail);

  const double with_state = std::fabs(static_cast<double>(carried[0][0]) - last);
  const double without_state = std::fabs(static_cast<double>(fresh[0][0]) - last);
  std::printf("       step with history %.4f, without %.4f\n", with_state,
              without_state);
  CHECK(with_state < 0.05);
  CHECK(without_state > 0.05);

  // A different layout is refused, so a history is never fed to a filter it
  // did not come from.
  const Chain two_bands = chain_from(
      "Filter: ON PK Fc 1000 Hz Gain -3 dB Q 1\r\n"
      "Filter: ON HPQ Fc 30 Hz Q 0.71\r\n");
  Graph other(two_bands, kRate, 1, kTail);
  CHECK(!other.has_same_band_layout(first));
  CHECK(!first.has_same_band_layout(other));
}

void convolution_applies_kernel() {
  std::printf("an impulse response is convolved at the reported latency\n");
  const std::filesystem::path path =
      std::filesystem::temp_directory_path() / "fluideq-engine-ir-48000.wav";
  CHECK(write_float_wav(path, 48000, two_tap_impulse_response()));

  const Chain chain = chain_from("Convolution: " + path.string() + "\r\n");
  CHECK(chain.matched);
  CHECK(!chain.convolution_path.empty());

  Graph graph(chain, kRate, 1, 512);
  CHECK(!graph.is_passthrough());
  CHECK(graph.latency_frames() == feq_convolver_latency());
  CHECK(graph.warnings().empty());

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
  CHECK(write_float_wav(path, 44100, two_tap_impulse_response()));

  const Chain chain = chain_from("Convolution: " + path.string() + "\r\n");
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
  CHECK(write_float_wav(path, 48000, kernel));

  const Chain chain = chain_from("Convolution: " + path.string() + "\r\n");
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

void graphic_eq_applies() {
  std::printf("a graphic curve cuts 12 dB at 1 kHz\n");
  const Chain chain = chain_from("GraphicEQ: 20 0; 1000 -12; 20000 0\r\n");
  CHECK(chain.matched);
  CHECK(chain.graphic.size() == 3);

  Graph graph(chain, kRate, 1, 480);
  CHECK(!graph.is_passthrough());
  CHECK(graph.latency_frames() == feq_convolver_latency());

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
  CHECK(graph.latency_frames() == feq_convolver_latency());
}

void oversized_block_is_refused() {
  std::printf("a block larger than the graph was built for is left alone\n");
  const Chain chain = chain_from("Preamp: -6 dB\r\n");
  Graph graph(chain, kRate, 1, 480);

  std::vector<float> buffer = tone(1000.0, 0.5, 960, 0);
  const std::vector<float> reference = buffer;
  float* planar[1] = {buffer.data()};
  graph.process(planar, 960);

  bool identical = true;
  for (size_t at = 0; at < reference.size(); ++at) {
    identical = identical && buffer[at] == reference[at];
  }
  CHECK(identical);
}

}  // namespace

int main() {
  std::printf("fluideq engine processing graph\n");
  peak_cut_attenuates_its_frequency();
  preamp_scales();
  unmatched_chain_is_passthrough();
  state_inherits_across_gain_change();
  convolution_applies_kernel();
  convolution_at_other_rate_is_resampled();
  over_long_impulse_response_is_truncated();
  graphic_eq_applies();
  unreadable_impulse_response_is_survived();
  absurd_sample_rate_caps_the_graphic_fir();
  oversized_block_is_refused();
  if (g_failures == 0) {
    std::printf("\nall checks passed\n");
    return 0;
  }
  std::printf("\n%d check(s) failed\n", g_failures);
  return 1;
}
