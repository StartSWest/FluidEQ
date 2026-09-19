/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The delay the rack says it adds, against the delay it has — and game mode.
 *
 * `feq_chain_latency_frames` is what the engine hands Windows for video sync
 * and what the DSP page shows a listener as their lag. A stage that delays
 * the audio without being counted makes both of those lie, silently, by
 * however long its buffer is; so every configuration here is measured with an
 * impulse rather than trusted.
 *
 * Game mode takes away the delay the rack only carries for comfort — Bass
 * Punch's alignment while Punch is off, the room's convolution partition —
 * and the room has to come out the same room, just on time.
 */

#include "fluideq/chain.h"
#include "fluideq/bass_punch.h"
#include "fluideq/convolver.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <memory>
#include <vector>

#include "dsp_test_support.h"

namespace {

using feq_test::check;
using feq_test::finish;
using feq_test::kFrames;
using feq_test::kRate;
using feq_test::Pink;

constexpr size_t kBlocks = 60;

struct ChainDeleter {
  void operator()(FeqChain* chain) const { feq_chain_destroy(chain); }
};
using Chain = std::unique_ptr<FeqChain, ChainDeleter>;

/** Every stage off: what is left is what the rack does to audio regardless. */
FeqChainSettings bare() {
  FeqChainSettings settings{};
  feq_chain_settings_defaults(&settings);
  settings.enabled = 1;
  settings.exciter.enabled = 0;
  settings.eq.enabled = 0;
  settings.compressor.enabled = 0;
  settings.maximizer.enabled = 0;
  settings.master.enabled = 0;
  settings.bass_forge.enabled = 0;
  settings.bass_punch.enabled = 0;
  settings.dimension.enabled = 0;
  settings.denoise.enabled = 0;
  settings.room.enabled = 0;
  settings.normalizer.mode = 0;
  return settings;
}

/**
 * A head whose every direction is a short decaying burst rather than a bare
 * impulse, so a kernel reaches well past its first partition once the walls
 * add their reflections — the part of game mode's split that a head of unit
 * impulses would never exercise.
 */
std::vector<float> burst_head(uint32_t directions, uint32_t taps) {
  std::vector<float> ring(static_cast<size_t>(directions) * taps, 0.0f);
  for (uint32_t direction = 0; direction < directions; ++direction) {
    for (uint32_t tap = 0; tap < taps; ++tap) {
      const double decay = std::exp(-static_cast<double>(tap) / 24.0);
      const double sign = ((tap * 7u + direction * 3u) % 5u) < 3u ? 1.0 : -0.6;
      ring[static_cast<size_t>(direction) * taps + tap] =
          static_cast<float>(decay * sign);
    }
  }
  return ring;
}

/**
 * Built as the engine builds its rack: configured, given the live leveler
 * when asked (the engine always asks; the Library's host never does), primed
 * with one silent block so published kernels are adopted, then reset to a
 * stream's start.
 */
Chain make_chain(const FeqChainSettings& settings, bool with_head,
                 bool with_leveler = false) {
  Chain chain(feq_chain_create(kRate, 2, kFrames));
  if (!chain) {
    return chain;
  }
  if (with_head) {
    constexpr uint32_t directions = 24;
    constexpr uint32_t taps = 64;
    const std::vector<float> ring = burst_head(directions, taps);
    const int speakers[FEQ_CHAIN_MAX_CHANNELS] = {0, 1, -1, -1, -1, -1, -1, -1};
    feq_chain_set_room_layout(chain.get(), speakers);
    feq_chain_set_room_head(chain.get(), ring.data(), ring.data(), directions,
                            taps, 0);
  }
  feq_chain_configure(chain.get(), &settings);
  if (with_leveler) {
    feq_chain_enable_live_normalizer(chain.get());
  }
  std::vector<float> silence(static_cast<size_t>(kFrames) * 2, 0.0f);
  float* planes[2] = {silence.data(), silence.data() + kFrames};
  feq_chain_process(chain.get(), planes, kFrames);
  feq_chain_reset(chain.get(), FEQ_CHAIN_RESET_STREAM_START);
  return chain;
}

/** In blocks of `block` frames, the last one short if it has to be. */
void run(FeqChain* chain, std::vector<std::vector<float>>& buffers,
         uint32_t block = kFrames) {
  float* pointers[2] = {};
  const size_t total = buffers[0].size();
  for (size_t at = 0; at < total; at += block) {
    const auto span = static_cast<uint32_t>(std::min<size_t>(block, total - at));
    for (size_t channel = 0; channel < 2; ++channel) {
      pointers[channel] = buffers[channel].data() + at;
    }
    feq_chain_process(chain, pointers, span);
  }
}

/** The frame an impulse put in at `at` first comes out above half its size. */
long arrival(FeqChain* chain, size_t at) {
  std::vector<std::vector<float>> audio(
      2, std::vector<float>(kBlocks * kFrames, 0.0f));
  audio[0][at] = 0.5f;
  audio[1][at] = 0.5f;
  run(chain, audio);
  for (size_t frame = 0; frame < audio[0].size(); ++frame) {
    if (std::fabs(audio[0][frame]) > 0.25f) {
      return static_cast<long>(frame) - static_cast<long>(at);
    }
  }
  return -1;
}

struct Case {
  const char* name;
  FeqChainSettings settings;
  bool with_head;
  bool with_leveler = false;
};

/**
 * THE LATENCY THE RACK REPORTS IS THE DELAY THE AUDIO HAS.
 *
 * Measured, one configuration at a time: an impulse in, the frame it comes
 * out, against `feq_chain_latency_frames`. A room is measured with a head of
 * unit impulses for this, so its peak is its arrival.
 */
void reported_latency_is_the_measured_delay() {
  std::printf("the latency the rack reports is the delay the audio has\n");
  std::vector<Case> cases;
  cases.push_back({"bare", bare(), false});
  {
    FeqChainSettings one = bare();
    one.maximizer.enabled = 1;
    cases.push_back({"maximizer", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.output_safety_enabled = 0;
    cases.push_back({"no safety", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.maximizer.look_ahead_ms = 1.0;
    cases.push_back({"maximizer 1 ms", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.output_safety_enabled = 0;
    one.maximizer.look_ahead_ms = 0.0;
    one.low_latency = 1;
    cases.push_back({"nothing at all", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.bass_punch.enabled = 1;
    one.bass_punch.mix = 0.0;
    cases.push_back({"bass punch", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.low_latency = 1;
    cases.push_back({"game mode", one, false});
  }
  {
    FeqChainSettings one = bare();
    one.low_latency = 1;
    one.maximizer.enabled = 1;
    cases.push_back({"game + maximizer", one, false});
  }
  // The engine's chain, with the live leveler: its peak guard delays the
  // sound whether the Normalizer is on or off, except in game mode with it
  // off — and on, in game mode, it is working and keeps its look-ahead.
  cases.push_back({"leveler, off", bare(), false, true});
  {
    FeqChainSettings one = bare();
    one.low_latency = 1;
    cases.push_back({"game leveler, off", one, false, true});
  }
  {
    FeqChainSettings one = bare();
    one.low_latency = 1;
    one.normalizer.mode = 1;
    cases.push_back({"game leveler, peak", one, false, true});
  }
  for (const Case& one : cases) {
    Chain chain = make_chain(one.settings, one.with_head, one.with_leveler);
    check(chain != nullptr, "chain built");
    if (!chain) {
      continue;
    }
    const uint32_t reported = feq_chain_latency_frames(chain.get());
    const long measured = arrival(chain.get(), kFrames * 4 + 11);
    std::printf("  %-18s reported %5u, measured %5ld\n", one.name, reported,
                measured);
    check(measured == static_cast<long>(reported),
          "the reported latency is the measured delay");
  }
}

/**
 * GAME MODE TAKES AWAY THE DELAY THE RACK CARRIES FOR COMFORT, AND NO MORE.
 *
 * Four stages hold the audio back while they have nothing to do, so that
 * switching them on never moves it: Bass Punch's FIR alignment, the
 * Maximizer's look-ahead, the Master's auto headroom and, in the engine, the
 * Normalizer's peak guard. In game mode each of
 * them, while off, costs nothing — and each, while on, still costs what it
 * costs, because then the delay is the effect and not a courtesy. The output
 * safety keeps its two milliseconds either way: that one is the thing
 * standing between a boost and a clipped speaker.
 */
void game_mode_drops_the_standby_delay() {
  std::printf("game mode drops the delay held for stages that are off\n");
  FeqChainSettings normal = bare();
  FeqChainSettings game = bare();
  game.low_latency = 1;
  Chain with = make_chain(normal, false);
  Chain without = make_chain(game, false);
  check(with != nullptr && without != nullptr, "chains built");
  if (!with || !without) {
    return;
  }
  FeqChainLatencyParts idle{};
  FeqChainLatencyParts dropped{};
  feq_chain_latency_parts(with.get(), &idle);
  feq_chain_latency_parts(without.get(), &dropped);
  std::printf("  on standby: punch %u, maximizer %u, headroom %u, safety %u\n",
              idle.bass_punch, idle.maximizer, idle.headroom, idle.safety);
  std::printf("  game mode:  punch %u, maximizer %u, headroom %u, safety %u\n",
              dropped.bass_punch, dropped.maximizer, dropped.headroom,
              dropped.safety);
  check(idle.bass_punch == feq_bass_punch_latency_frames(kRate) &&
            dropped.bass_punch == 0u,
        "Bass Punch's standby alignment goes");
  check(idle.maximizer > 0u && dropped.maximizer == 0u,
        "the Maximizer's standby look-ahead goes");
  check(idle.headroom > 0u && dropped.headroom == 0u,
        "the auto headroom's standby look-ahead goes");
  check(dropped.safety == idle.safety && dropped.safety > 0u,
        "the output safety keeps its look-ahead");
  // The engine's live leveler: its peak guard holds its look-ahead with the
  // Normalizer off, so that switching it on never shifts the audio. Game
  // mode takes that away — and leaves a guard that is working alone.
  {
    FeqChainSettings game_peak = game;
    game_peak.normalizer.mode = 1;
    Chain leveled = make_chain(normal, false, true);
    Chain leveled_game = make_chain(game, false, true);
    Chain guarding_game = make_chain(game_peak, false, true);
    check(leveled != nullptr && leveled_game != nullptr &&
              guarding_game != nullptr,
          "chains built");
    if (leveled && leveled_game && guarding_game) {
      FeqChainLatencyParts on_standby{};
      FeqChainLatencyParts given_up{};
      FeqChainLatencyParts guarding{};
      feq_chain_latency_parts(leveled.get(), &on_standby);
      feq_chain_latency_parts(leveled_game.get(), &given_up);
      feq_chain_latency_parts(guarding_game.get(), &guarding);
      std::printf("  leveler: standby %u, game mode %u, guarding %u\n",
                  on_standby.leveler, given_up.leveler, guarding.leveler);
      check(on_standby.leveler > 0u && given_up.leveler == 0u,
            "the Normalizer's standby look-ahead goes");
      check(guarding.leveler == on_standby.leveler,
            "a Normalizer that is on keeps its look-ahead in game mode");
    }
  }
  // POSITIVE CONTROL: with all three running, game mode leaves them alone.
  normal.bass_punch.enabled = 1;
  normal.maximizer.enabled = 1;
  normal.master.enabled = 1;
  normal.master.loudness_maximize = 1;
  game.bass_punch.enabled = 1;
  game.maximizer.enabled = 1;
  game.master.enabled = 1;
  game.master.loudness_maximize = 1;
  Chain running = make_chain(normal, false);
  Chain running_game = make_chain(game, false);
  check(running != nullptr && running_game != nullptr, "chains built");
  if (!running || !running_game) {
    return;
  }
  check(feq_chain_latency_frames(running.get()) ==
            feq_chain_latency_frames(running_game.get()),
        "stages that run keep their delay in game mode");
}

/**
 * A HANDOVER KEEPS THE NEW CHAIN'S DELAY.
 *
 * The engine builds a chain for every change of the rack and hands the
 * playing one's state to it on the audio thread (`feq_chain_transfer_state`),
 * which swaps whole limiters, and the leveler, across. The auto headroom's
 * limiter and the leveler came over with the previous chain's look-ahead: a
 * switch into game mode went on holding the sound back by 4 ms it reported
 * as gone, and a switch out of it ran 4 ms short of what it reported. The
 * report is taken where the engine takes it, when the chain is built.
 */
void a_handover_keeps_the_new_chains_delay() {
  std::printf("a handover keeps the new chain's delay\n");
  FeqChainSettings normal = bare();
  FeqChainSettings game = bare();
  game.low_latency = 1;
  struct Switch {
    const char* name;
    const FeqChainSettings* from;
    const FeqChainSettings* to;
  };
  const Switch switches[] = {{"into game mode", &normal, &game},
                             {"out of game mode", &game, &normal}};
  for (const Switch& one : switches) {
    Chain previous = make_chain(*one.from, false, true);
    Chain prepared = make_chain(*one.to, false, true);
    check(previous != nullptr && prepared != nullptr, "chains built");
    if (!previous || !prepared) {
      continue;
    }
    // The playing chain has been playing, so its lines are full — of silence,
    // so that nothing in them can be mistaken for the impulse.
    std::vector<std::vector<float>> quiet(
        2, std::vector<float>(static_cast<size_t>(kFrames) * 4, 0.0f));
    run(previous.get(), quiet);
    const uint32_t reported = feq_chain_latency_frames(prepared.get());
    check(feq_chain_transfer_state(prepared.get(), previous.get()) == 1,
          "the state is handed over");
    const long measured = arrival(prepared.get(), kFrames * 4 + 11);
    std::printf("  %-18s reported %5u, measured %5ld\n", one.name, reported,
                measured);
    check(measured == static_cast<long>(reported),
          "the new chain delays the sound by what it reported");
    check(feq_chain_latency_frames(prepared.get()) == reported,
          "and reports the same after the handover");
  }
}

/**
 * GAME MODE'S ROOM IS THE SAME ROOM, ON TIME.
 *
 * The kernel's first partition runs as a direct FIR and the convolver takes
 * the rest one partition in, so the pair is the whole convolution with no
 * delay of its own. Proved against the room as it always ran: the same
 * programme, and game mode's output one partition EARLIER must match it
 * sample for sample, to float rounding.
 *
 * It is also what holds the room's bass in step. Under bass management the
 * part below the crossover is not convolved, and it used to go straight to
 * the ears while everything above it waited a partition — 10.7 ms early, a
 * Linkwitz-Riley pair out of step. Game mode's room has no partition for
 * the bass to be ahead of, so it is the reference: with the bass early this
 * comparison read 2.4e-2, and with it held back by the partition, 3e-8. It
 * was this test that found it.
 */
void game_mode_room_is_the_room_on_time() {
  std::printf("game mode's room is the same room, one partition earlier\n");
  FeqChainSettings normal = bare();
  normal.room.enabled = 1;
  normal.room.walls = 0.7;
  // The stages game mode would change, held the same in both chains and
  // kept LINEAR: Punch running with nothing mixed in, the Maximizer running
  // with no drive and a programme it never has to limit. A stage that adapts
  // per block (the Master's loudness) cannot be in this comparison at all:
  // the room shifts the programme against the block grid, and a gain decided
  // once a block is then decided on different audio in each chain.
  normal.bass_punch.enabled = 1;
  normal.bass_punch.mix = 0.0;
  normal.maximizer.enabled = 1;
  normal.maximizer.drive_db = 0.0;
  normal.maximizer.ceiling_db = 0.0;
  FeqChainSettings game = normal;
  game.low_latency = 1;
  Chain late = make_chain(normal, true);
  Chain on_time = make_chain(game, true);
  check(late != nullptr && on_time != nullptr, "chains built");
  if (!late || !on_time) {
    return;
  }
  check(feq_chain_room_active(late.get()) == 1 &&
            feq_chain_room_active(on_time.get()) == 1,
        "the room runs in both");
  // The room's own part: a partition, and nothing in game mode. The rest of
  // the difference is what game mode takes from the stages that are off —
  // measured by the first test — so the comparison below shifts by all of it.
  FeqChainLatencyParts late_parts{};
  FeqChainLatencyParts on_time_parts{};
  feq_chain_latency_parts(late.get(), &late_parts);
  feq_chain_latency_parts(on_time.get(), &on_time_parts);
  check(late_parts.room == feq_convolver_latency(), "the room adds a partition");
  check(on_time_parts.room == 0u, "game mode's room adds nothing");
  const uint32_t partition = feq_chain_latency_frames(late.get()) -
                             feq_chain_latency_frames(on_time.get());
  // The Master is off here, so game mode also drops the auto headroom's
  // standby look-ahead: the room's partition and that, and nothing else.
  check(partition == feq_convolver_latency() + late_parts.headroom,
        "game mode gives up the partition and the idle headroom, no more");
  std::vector<std::vector<float>> a(2), b(2);
  Pink source;
  source.noise.seed = 97u;
  std::vector<float> programme(kBlocks * kFrames);
  for (float& sample : programme) {
    sample = static_cast<float>(source.next() * 0.004);
  }
  a[0] = programme;
  a[1] = programme;
  b[0] = programme;
  b[1] = programme;
  // Both in blocks that are not a partition long, where the heads' reach
  // across a block boundary would go wrong — and the same size in both,
  // because the Master's loudness moves per block, and two block sizes are
  // two different programmes to it before the room is even reached.
  run(late.get(), a, 480u);
  run(on_time.get(), b, 480u);
  double worst = 0.0;
  double level = 0.0;
  for (size_t frame = kFrames * 2; frame + partition < a[0].size(); ++frame) {
    for (size_t ear = 0; ear < 2; ++ear) {
      const double difference = std::fabs(
          static_cast<double>(a[ear][frame + partition]) -
          static_cast<double>(b[ear][frame]));
      worst = difference > worst ? difference : worst;
      level = std::fabs(static_cast<double>(a[ear][frame])) > level
                  ? std::fabs(static_cast<double>(a[ear][frame]))
                  : level;
    }
  }
  std::printf("  largest difference %.2e against a peak of %.2f\n", worst,
              level);
  check(level > 0.01, "the room put out real sound (control)");
  check(worst < 1e-4, "game mode's room matches the room, a partition early");
}

/**
 * THE HEAD AND THE SHIFTED TAIL ARE THE WHOLE CONVOLUTION, ON TIME.
 *
 * The primitive under game mode's room, on its own: a kernel longer than a
 * partition through the convolver as always, against its first partition as
 * a direct head plus the rest through a convolver built one partition in.
 * The pair must equal the plain convolver's output one partition early, for
 * every sample and in blocks that are not a partition long.
 */
void the_head_and_the_tail_are_the_whole_convolution() {
  std::printf("a direct head and a shifted tail are the whole convolution\n");
  const uint32_t partition = feq_convolver_head_taps();
  constexpr uint32_t kLength = 2048;
  std::vector<float> kernel(kLength);
  for (uint32_t tap = 0; tap < kLength; ++tap) {
    kernel[tap] = static_cast<float>(
        std::exp(-static_cast<double>(tap) / 400.0) *
        (((tap * 13u) % 7u) < 4u ? 1.0 : -0.8));
  }
  FeqConvolverKernel* whole_kernel =
      feq_convolver_kernel_create(kernel.data(), kLength);
  FeqConvolverKernel* tail_kernel = feq_convolver_kernel_create(
      kernel.data() + partition, kLength - partition);
  FeqConvolver* whole = feq_convolver_create(whole_kernel);
  FeqConvolver* tail = feq_convolver_create(tail_kernel);
  std::vector<float> head(partition);
  feq_convolver_head_prepare(kernel.data(), kLength, head.data());
  check(whole != nullptr && tail != nullptr, "convolvers built");
  if (whole != nullptr && tail != nullptr) {
    Pink source;
    source.noise.seed = 5u;
    constexpr size_t kTotal = 40000;
    std::vector<float> input(kTotal);
    for (float& sample : input) {
      sample = static_cast<float>(source.next() * 0.2);
    }
    std::vector<float> late = input;
    for (size_t at = 0; at < kTotal; at += kFrames) {
      const auto span =
          static_cast<uint32_t>(std::min<size_t>(kFrames, kTotal - at));
      feq_convolve(whole, late.data() + at, span);
    }
    std::vector<float> on_time(kTotal, 0.0f);
    std::vector<float> history(partition - 1, 0.0f);
    std::vector<float> laid(partition - 1 + 480, 0.0f);
    std::vector<float> heard(480, 0.0f);
    std::vector<float> block(480, 0.0f);
    for (size_t at = 0; at < kTotal; at += 480) {
      const auto span = static_cast<uint32_t>(std::min<size_t>(480, kTotal - at));
      std::copy(history.begin(), history.end(), laid.begin());
      std::copy(input.begin() + static_cast<std::ptrdiff_t>(at),
                input.begin() + static_cast<std::ptrdiff_t>(at + span),
                laid.begin() + static_cast<std::ptrdiff_t>(partition - 1));
      feq_convolver_head_run(head.data(), laid.data(), heard.data(), span);
      std::copy(input.begin() + static_cast<std::ptrdiff_t>(at),
                input.begin() + static_cast<std::ptrdiff_t>(at + span),
                block.begin());
      feq_convolve(tail, block.data(), span);
      for (uint32_t one = 0; one < span; ++one) {
        on_time[at + one] = heard[one] + block[one];
      }
      std::copy(laid.begin() + span, laid.begin() + span + (partition - 1),
                history.begin());
    }
    double worst = 0.0;
    for (size_t at = 0; at + partition < kTotal; ++at) {
      const double difference = std::fabs(
          static_cast<double>(late[at + partition]) -
          static_cast<double>(on_time[at]));
      worst = difference > worst ? difference : worst;
    }
    std::printf("  largest difference %.2e\n", worst);
    check(worst < 1e-4, "head plus tail equals the whole, a partition early");
  }
  feq_convolver_destroy(whole);
  feq_convolver_destroy(tail);
  feq_convolver_kernel_destroy(whole_kernel);
  feq_convolver_kernel_destroy(tail_kernel);
}

}  // namespace

int main() {
  std::printf("chain latency\n\n");
  the_head_and_the_tail_are_the_whole_convolution();
  reported_latency_is_the_measured_delay();
  game_mode_drops_the_standby_delay();
  a_handover_keeps_the_new_chains_delay();
  game_mode_room_is_the_room_on_time();
  return finish();
}
