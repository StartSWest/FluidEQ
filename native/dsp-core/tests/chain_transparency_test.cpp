/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A rack with nothing switched on is a delay and nothing else, whatever the
 * record's level.
 *
 * Measured with a hot source on purpose: a modern master sits at -0.1 dBFS
 * with inter-sample peaks above full scale, and that is exactly the record
 * the tail that used to run here held down — a -0.1 dBTP limiter and a 3 Hz
 * high-pass, on whatever the cards said. The DSP page switched on, every
 * card off, and the sound already changed, while the window read the held
 * peaks as clipping. Removed on 2026-09-22 at Ivan's call; this is what
 * keeps it removed.
 */
#include "fluideq/chain.h"
#include "fluideq/primitives.h"
#include "dsp_test_support.h"

#include <algorithm>
#include <cstdio>
#include <memory>
#include <vector>

namespace {
using feq_test::check;
using feq_test::kRate;
using feq_test::Signal;
using Chain = std::unique_ptr<FeqChain, decltype(&feq_chain_destroy)>;

constexpr uint32_t kBlock = 480;

/** Pink noise scaled to `peak` sample peak; its true peak sits above it. */
Signal hot_source(size_t count, double peak) {
  Signal source = feq_test::pink_stereo(count, false);
  feq_test::normalise(source.left, peak);
  feq_test::normalise(source.right, peak);
  return source;
}

double true_peak_db(const std::vector<float>& samples) {
  FeqTruePeak detector{};
  feq_true_peak_init(&detector, 4);
  const double peak = feq_true_peak_block(
      &detector, samples.data(), static_cast<uint32_t>(samples.size()));
  return peak > 1e-9 ? 20.0 * std::log10(peak) : -180.0;
}

Chain make_chain(const FeqChainSettings& settings, bool live_leveler) {
  Chain chain(feq_chain_create(kRate, 2, kBlock), feq_chain_destroy);
  feq_chain_configure(chain.get(), &settings);
  if (live_leveler) {
    // The engine always gives its rack a live leveler; the app's own host
    // does not. Both shapes are measured.
    feq_chain_enable_live_normalizer(chain.get());
  }
  return chain;
}

FeqChainSettings idle_settings() {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  return settings;
}

Signal run(FeqChain* chain, const Signal& source) {
  Signal out = source;
  for (size_t block = 0; block + kBlock <= out.left.size(); block += kBlock) {
    float* planes[2] = {out.left.data() + block, out.right.data() + block};
    feq_chain_process(chain, planes, kBlock);
  }
  return out;
}

/** The largest sample difference between the output and the delayed input. */
double worst_difference(const Signal& source, const Signal& out,
                        uint32_t delay, size_t skip) {
  double worst = 0.0;
  for (size_t at = skip + delay; at < out.left.size(); ++at) {
    worst = std::max(worst, std::fabs(static_cast<double>(out.left[at]) -
                                      source.left[at - delay]));
    worst = std::max(worst, std::fabs(static_cast<double>(out.right[at]) -
                                      source.right[at - delay]));
  }
  return worst;
}

void idle_rack_is_a_delay(bool live_leveler) {
  Chain chain = make_chain(idle_settings(), live_leveler);
  const Signal source = hot_source(static_cast<size_t>(kRate) * 4, 1.0);
  const Signal out = run(chain.get(), source);
  const uint32_t delay = feq_chain_latency_frames(chain.get());
  const double difference =
      worst_difference(source, out, delay, static_cast<size_t>(kRate));
  std::printf("  idle rack, leveler %s: source %.2f dBTP, delay %u, "
              "worst difference %.3g\n",
              live_leveler ? "on" : "off", true_peak_db(source.left), delay,
              difference);
  check(true_peak_db(source.left) > 0.0,
        "the source is a hot master with peaks over full scale");
  check(difference == 0.0,
        "an idle rack leaves a hot record exactly as it came, delayed");
}

/**
 * The positive control: a card that is on does change the sound, measured
 * the same way, so a green run above is not a measurement that sees nothing.
 */
void a_card_that_is_on_is_heard() {
  FeqChainSettings settings = idle_settings();
  settings.master.enabled = 1;
  settings.master.output_trim_db = -6.0;
  Chain chain = make_chain(settings, true);
  const Signal source = hot_source(static_cast<size_t>(kRate) * 2, 1.0);
  const Signal out = run(chain.get(), source);
  const uint32_t delay = feq_chain_latency_frames(chain.get());
  const double difference =
      worst_difference(source, out, delay, static_cast<size_t>(kRate) / 2);
  std::printf("  -6 dB trim: worst difference %.3g\n", difference);
  check(difference > 0.3, "positive control: a -6 dB trim is measured");
}

/**
 * The Normalizer's live peak mode is a card the listener switches on, and
 * its ceiling is the one on its dial.
 */
void live_peak_holds_its_own_ceiling() {
  FeqChainSettings settings = idle_settings();
  settings.normalizer.mode = 1;
  settings.normalizer.ceiling_db = -1.0;
  Chain chain = make_chain(settings, true);
  const Signal source = hot_source(static_cast<size_t>(kRate) * 4, 1.0);
  const Signal out = run(chain.get(), source);
  std::vector<float> settled(out.left.begin() + static_cast<long>(kRate),
                             out.left.end());
  const double peak = true_peak_db(settled);
  std::printf("  live peak at -1 dBTP: output %.2f dBTP\n", peak);
  check(peak <= -1.0 + 0.1, "live peak holds the ceiling on its dial");
}
}  // namespace

int main() {
  std::printf("idle rack\n");
  idle_rack_is_a_delay(false);
  idle_rack_is_a_delay(true);
  a_card_that_is_on_is_heard();
  std::printf("the cards that carry a ceiling\n");
  live_peak_holds_its_own_ceiling();
  return feq_test::finish();
}
