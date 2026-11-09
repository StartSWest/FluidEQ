/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A song after a pause comes in at the level it would have had straight after
 * the last one (Ivan, 2026-11-08: "when no sound is sounding for a while and
 * I hit play on a song the music suddenly higher and then it normalized").
 *
 * The Maximizer's platform is the steady reduction a driven record asks of
 * the ceiling. It used to let go over 3 s whatever came in, start at 0 dB in
 * every new chain and be cleared by every reset, so the first half second
 * after a pause, a reopened stream or a seek met the full drive with nothing
 * under the peaks: 3-4 dB loud on his rack (drive 7.8 dB). Measured here as
 * the first 0.5 s of the same driven record against that record played
 * straight after itself, and beside each case the same chain with its
 * platform thrown away — the control that has to show the surge.
 */

#include <cmath>
#include <cstdio>
#include <vector>

#include "../src/chain_internal.h"
#include "dsp_test_support.h"
#include "fluideq/chain.h"
#include "fluideq/leveling_memory.h"

using feq_test::check;
using feq_test::kFrames;
using feq_test::kRate;
using feq_test::Signal;

namespace {

constexpr double kDrive = 8.0;
constexpr double kCeiling = -1.0;

FeqChainSettings maximizer_alone() {
  FeqChainSettings s{};
  feq_chain_settings_defaults(&s);
  s.enabled = 1;
  s.normalizer.mode = 0;
  s.denoise.enabled = 0;
  s.deesser.enabled = 0;
  s.exciter.enabled = 0;
  s.eq.enabled = 0;
  s.footsteps.enabled = 0;
  s.dimension.enabled = 0;
  s.room.enabled = 0;
  s.bass_forge.enabled = 0;
  s.bass_punch.enabled = 0;
  s.master.enabled = 0;
  s.maximizer.enabled = 1;
  s.maximizer.drive_db = kDrive;
  s.maximizer.ceiling_db = kCeiling;
  s.maximizer.look_ahead_ms = 5;
  s.maximizer.release_ms = 100;
  return s;
}

/** Four seconds of a dense record: pink, peaking at full scale, with a beat. */
Signal record() {
  Signal s = feq_test::pink_stereo(static_cast<size_t>(4 * kRate), false);
  for (size_t at = 0; at < s.left.size(); ++at) {
    const double beat = std::fmod(static_cast<double>(at) / kRate, 0.5);
    const auto accent = static_cast<float>(beat < 0.08 ? 2.0 : 1.0);
    s.left[at] *= accent;
    s.right[at] *= accent;
  }
  feq_test::normalise(s.left, 1.0);
  feq_test::normalise(s.right, 1.0);
  return s;
}

Signal silence(double seconds) {
  Signal s;
  s.left.assign(static_cast<size_t>(seconds * kRate), 0.0f);
  s.right = s.left;
  return s;
}

/** Plays a signal through, block by block, and returns what came out. */
Signal play(FeqChain* chain, Signal s) {
  feq_test::run_blocks(s, [&](float** channels) { feq_chain_process(chain, channels, kFrames); });
  return s;
}

/** The level, in dB, of the first half second of a record's sound out. */
double opening_db(FeqChain* chain, const Signal& out) {
  const size_t from = feq_chain_latency_frames(chain);
  const size_t to = from + static_cast<size_t>(kRate / 2);
  double sum = 0.0;
  for (size_t at = from; at < to; ++at) {
    sum += static_cast<double>(out.left[at]) * out.left[at] +
           static_cast<double>(out.right[at]) * out.right[at];
  }
  return 10.0 * std::log10(sum / static_cast<double>(2 * (to - from)));
}

FeqChain* make_chain() {
  FeqChain* chain = feq_chain_create(kRate, 2, kFrames);
  const FeqChainSettings settings = maximizer_alone();
  feq_chain_configure(chain, &settings);
  return chain;
}

/** The record straight after itself: the level every case is held to. */
double straight_after() {
  FeqChain* chain = make_chain();
  play(chain, record());
  const double level = opening_db(chain, play(chain, record()));
  feq_chain_destroy(chain);
  return level;
}

void a_pause_keeps_the_level(double reference) {
  for (const bool forget : {false, true}) {
    FeqChain* chain = make_chain();
    play(chain, record());
    // The first second of the pause still brings the record's tail through
    // the stages ahead of the Maximizer; from there on nothing plays.
    play(chain, silence(1));
    const double held = chain->maximizer.platform_db;
    play(chain, silence(19));
    if (!forget) {
      check(chain->maximizer.platform_db == held, "the platform waits through twenty seconds of silence");
    } else {
      chain->maximizer.platform_db = 0.0;  // what 3 s of release left of it
    }
    const double level = opening_db(chain, play(chain, record()));
    std::printf("after a pause%s: %+.2f dB against straight after\n",
                forget ? ", platform thrown away (control)" : "", level - reference);
    if (forget) {
      check(level - reference > 1.5, "control: without the platform the song comes in loud");
    } else {
      check(std::fabs(level - reference) < 0.3, "after a pause the song comes in at its level");
    }
    feq_chain_destroy(chain);
  }
}

void a_seek_keeps_the_level(double reference) {
  FeqChain* chain = make_chain();
  play(chain, record());
  feq_chain_reset(chain, FEQ_CHAIN_RESET_SEEK);
  const double seek = opening_db(chain, play(chain, record()));
  feq_chain_reset(chain, FEQ_CHAIN_RESET_SOURCE_CHANGE);
  const double next = opening_db(chain, play(chain, record()));
  std::printf("after a seek %+.2f dB, after a new source %+.2f dB\n", seek - reference,
              next - reference);
  check(std::fabs(seek - reference) < 0.3, "after a seek the song is at its level");
  check(std::fabs(next - reference) < 0.3, "a new source plays as it would straight after");
  feq_chain_destroy(chain);
}

void a_new_chain_starts_where_the_output_settled(double reference) {
  FeqLevelingMemory* memory = feq_leveling_memory_create();
  FeqChain* first = make_chain();
  feq_chain_attach_leveling_memory(first, memory);
  play(first, record());
  const double settled = first->maximizer.platform_db;
  feq_chain_destroy(first);
  check(settled < -2.0, "the driven record settles a platform of its own");

  FeqChain* next = make_chain();
  feq_chain_attach_leveling_memory(next, memory);
  check(std::fabs(next->maximizer.platform_db - settled) < 0.01,
        "a new chain on the output starts on the platform it settled at");
  const double level = opening_db(next, play(next, record()));
  // It played, so it is what the output remembers now.
  const double latest = next->maximizer.platform_db;
  feq_chain_destroy(next);

  FeqChain* cold = make_chain();
  const double fresh = opening_db(cold, play(cold, record()));
  feq_chain_destroy(cold);
  std::printf("a new lock: %+.2f dB with the output's memory, %+.2f without (control)\n",
              level - reference, fresh - reference);
  check(std::fabs(level - reference) < 0.3, "a new lock comes in at the level");
  check(fresh - reference > 1.5, "control: a chain with no memory comes in loud");

  // Pushed harder, a new chain starts deeper by the difference; never above 0.
  FeqChainSettings harder = maximizer_alone();
  harder.maximizer.drive_db = kDrive + 3.0;
  FeqChain* pushed = feq_chain_create(kRate, 2, kFrames);
  feq_chain_configure(pushed, &harder);
  feq_chain_attach_leveling_memory(pushed, memory);
  check(std::fabs(pushed->maximizer.platform_db - (latest - 3.0)) < 0.01,
        "three decibels more drive start three decibels deeper");
  feq_chain_destroy(pushed);
  FeqChainSettings gentler = maximizer_alone();
  gentler.maximizer.drive_db = kDrive - 20.0;
  FeqChain* gentle = feq_chain_create(kRate, 2, kFrames);
  feq_chain_configure(gentle, &gentler);
  feq_chain_attach_leveling_memory(gentle, memory);
  check(gentle->maximizer.platform_db == 0.0, "a gentler chain never starts above unity");
  feq_chain_destroy(gentle);

  // A silent stream on the same output writes nothing over it.
  FeqChain* idle = make_chain();
  feq_chain_attach_leveling_memory(idle, memory);
  idle->maximizer.platform_db = 0.0;
  play(idle, silence(2));
  feq_chain_destroy(idle);
  FeqChain* after = make_chain();
  feq_chain_attach_leveling_memory(after, memory);
  check(std::fabs(after->maximizer.platform_db - latest) < 0.01,
        "a silent stream on the output leaves the settled platform alone");
  feq_chain_destroy(after);
  feq_leveling_memory_destroy(memory);
}

// A fade, a breakdown, a quiet intro: music that stays away from the ceiling
// lets the platform go over 30 s, not 3. Five seconds of it — two still
// counted as contact, then three apart — keep about 46% of the platform's
// depth (e^-2/3 · e^-3/30), where 3 s throughout would have kept a fifth
// (e^-5/3) and the next loud passage would come in louder.
void music_away_from_the_ceiling_lets_go_slowly(double reference) {
  FeqChain* chain = make_chain();
  play(chain, record());
  const double held = chain->maximizer.platform_db;
  Signal quiet = record();
  const Signal more = record();
  quiet.left.insert(quiet.left.end(), more.left.begin(), more.left.end());
  quiet.right.insert(quiet.right.end(), more.right.begin(), more.right.end());
  quiet.left.resize(static_cast<size_t>(5 * kRate));
  quiet.right.resize(quiet.left.size());
  for (float& v : quiet.left) v *= 0.06f;   // 24 dB down: under the contact line
  for (float& v : quiet.right) v *= 0.06f;
  play(chain, quiet);
  const double kept = chain->maximizer.platform_db / held;
  const double level = opening_db(chain, play(chain, record()));
  std::printf("after 5 s of quiet music: platform kept %.0f%%, the record %+.2f dB\n",
              100.0 * kept, level - reference);
  check(kept > 0.35, "five seconds of quiet music keep much of the platform");
  check(level - reference < 1.5, "the loud passage after it comes in near its level");
  feq_chain_destroy(chain);
}

}  // namespace

int main() {
  const double reference = straight_after();
  a_pause_keeps_the_level(reference);
  a_seek_keeps_the_level(reference);
  a_new_chain_starts_where_the_output_settled(reference);
  music_away_from_the_ceiling_lets_go_slowly(reference);
  return feq_test::finish();
}
