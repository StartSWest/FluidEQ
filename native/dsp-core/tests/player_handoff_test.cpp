/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The player changing track: a skip inside a fade, a burst of them, a fade
 * asked for with nothing playing, and every track leaving without a click.
 *
 * Driven with constant signals ("dc:" in `player_test_support.h`), so a sample
 * of the output is the sum of the levels of what is heard — which says at a
 * glance which track is playing, and a click is a sample that jumps.
 */

#include "player_test_support.h"

#include <cmath>
#include <cstdio>
#include <utility>
#include <vector>

namespace {

using player_test::Block;
using player_test::check;
using player_test::generating_ops;

constexpr uint32_t kBlock = 512;
/** Half a second: 24000 frames, forty-seven blocks. */
constexpr double kFadeMs = 500.0;
constexpr uint32_t kFadeBlocks = 47;
/**
 * The largest change between neighbouring samples of a sum of constants.
 *
 * Every level here moves along a curve or a ramp at most a few ten-thousandths
 * a frame; a track stopping or starting on the spot moves it by its whole
 * level at once, which is what a click is.
 */
constexpr double kClick = 2e-3;

/** Render blocks, pumping before each, and keep the left channel. */
std::vector<float> render_blocks(FeqPlayer* player, uint32_t blocks) {
  std::vector<float> heard;
  Block block(kBlock);
  for (uint32_t index = 0; index < blocks; ++index) {
    feq_player_pump(player);
    feq_player_render(player, block.pointers.data(), kBlock);
    heard.insert(heard.end(), block.storage.begin(),
                 block.storage.begin() + kBlock);
  }
  return heard;
}

double largest_step(const std::vector<float>& samples, float before) {
  double largest = 0.0;
  float previous = before;
  for (const float sample : samples) {
    largest = std::fmax(largest, std::fabs(static_cast<double>(sample) -
                                           static_cast<double>(previous)));
    previous = sample;
  }
  return largest;
}

double loudest(const std::vector<float>& samples, size_t from, size_t to) {
  double peak = 0.0;
  for (size_t at = from; at < to && at < samples.size(); ++at) {
    peak = std::fmax(peak, std::fabs(static_cast<double>(samples[at])));
  }
  return peak;
}

/** A playing at 0.1 alone, past its entry, then a fade to B at 0.2 begun. */
FeqPlayer* fading_from_a_to_b(uint32_t* b_deck, std::vector<float>* heard) {
  static const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, kBlock, 48000, &ops);
  feq_player_load(player, 0, "dc:48000:4800000:0.1");
  feq_player_set_playing(player, 1);
  render_blocks(player, 16);
  *b_deck = feq_player_handoff_deck(player);
  feq_player_load(player, *b_deck, "dc:48000:4800000:0.2");
  feq_player_start_crossfade(player, *b_deck, kFadeMs,
                             FEQ_CROSSFADE_EQUAL_POWER);
  *heard = render_blocks(player, 1);
  return player;
}

/**
 * Songs 1, 2 and 3 clicked in a row, the third inside the fade to the second.
 *
 * Reported: "2 is the one that plays, 3 is ignored" (Ivan, 2026-09-23). The
 * third track used to go onto the deck fading out, and the fade it asked for
 * was refused as a fade to the active deck. It now takes the deck the fade
 * is heading for, comes in from silence over a whole fade, and the first
 * track carries on out from the level it had reached.
 */
void test_a_skip_inside_a_fade() {
  std::printf("a skip inside a fade\n");
  uint32_t to_b = 0;
  std::vector<float> heard;
  FeqPlayer* player = fading_from_a_to_b(&to_b, &heard);
  check(to_b == 1, "with no fade running the next track takes the free deck");
  const std::vector<float> into_b = render_blocks(player, 13);

  const uint32_t to_c = feq_player_handoff_deck(player);
  check(to_c == to_b, "early in a fade the quieter deck is the one fading in");
  feq_player_load(player, to_c, "dc:48000:4800000:0.4");
  feq_player_start_crossfade(player, to_c, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
  check(feq_player_reported_deck(player) == to_c,
        "the transport is the new track's deck from the moment it is asked");

  const std::vector<float> into_c = render_blocks(player, kFadeBlocks + 2);
  std::printf("       before the skip %.4f, a fade later %.4f\n",
              static_cast<double>(into_b.back()),
              static_cast<double>(into_c.back()));
  check(std::fabs(into_c.back() - 0.4f) < 1e-4,
        "one fade after the skip the chosen track plays alone");
  check(feq_player_active_deck(player) == to_c,
        "and its deck is the one left active");
  check(largest_step(into_c, into_b.back()) < kClick,
        "with no step anywhere on the way");

  /**
   * The positive control for the click check: the same measure over a hard
   * cut between the same levels has to fail it, or the check proves nothing.
   */
  std::vector<float> cut(into_c.begin(), into_c.begin() + 64);
  cut[32] = 0.4f;
  check(largest_step(cut, into_b.back()) > kClick,
        "(a track stopping on the spot does read as a click)");
  feq_player_destroy(player);
}

/** The same, late in the fade: the track fading out is now the quieter. */
void test_a_skip_late_in_a_fade() {
  std::printf("a skip late in a fade\n");
  uint32_t to_b = 0;
  std::vector<float> heard;
  FeqPlayer* player = fading_from_a_to_b(&to_b, &heard);
  const std::vector<float> into_b = render_blocks(player, 37);

  const uint32_t to_c = feq_player_handoff_deck(player);
  check(to_c != to_b,
        "late in a fade the deck fading OUT is quieter, and takes the track");
  feq_player_load(player, to_c, "dc:48000:4800000:0.4");
  feq_player_start_crossfade(player, to_c, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
  const std::vector<float> into_c = render_blocks(player, kFadeBlocks + 2);
  check(largest_step(into_c, into_b.back()) < kClick,
        "the second track goes on from its own level, no step");
  check(std::fabs(into_c.back() - 0.4f) < 1e-4,
        "and the fade ends on the chosen track alone");
  feq_player_destroy(player);
}

/** Four tracks inside one fade, two of them asked for between two blocks. */
void test_a_burst_of_skips() {
  std::printf("a burst of skips\n");
  uint32_t to_b = 0;
  std::vector<float> heard;
  FeqPlayer* player = fading_from_a_to_b(&to_b, &heard);
  render_blocks(player, 3);
  uint32_t deck = feq_player_handoff_deck(player);
  feq_player_load(player, deck, "dc:48000:4800000:0.3");
  feq_player_start_crossfade(player, deck, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
  const std::vector<float> into_c = render_blocks(player, 2);
  // Two more before the audio thread has run once: the last asked for wins.
  deck = feq_player_handoff_deck(player);
  feq_player_load(player, deck, "dc:48000:4800000:-0.3");
  feq_player_start_crossfade(player, deck, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
  deck = feq_player_handoff_deck(player);
  feq_player_load(player, deck, "dc:48000:4800000:0.4");
  feq_player_start_crossfade(player, deck, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
  const std::vector<float> after = render_blocks(player, kFadeBlocks + 2);
  check(std::fabs(after.back() - 0.4f) < 1e-4,
        "the burst ends on the last track asked for, alone");
  check(largest_step(after, into_c.back()) < kClick, "with no step");
  feq_player_destroy(player);
}

/**
 * A fade asked for while nothing plays is only the new track coming in.
 *
 * Picking a song with the player paused, crossfade on: the paused one used to
 * be started again only to be faded away. Asked for while stopped, the fade
 * has nothing to fade out of (Ivan, 2026-09-23: "if crossfade is on and we
 * don't have a source ... we just fade in the target").
 */
void test_a_fade_with_nothing_playing() {
  std::printf("a fade with nothing playing\n");
  const auto early_peak = [](bool playing) {
    static const FeqDecoderOps ops = generating_ops();
    FeqPlayer* player = feq_player_create(48000.0, 2, kBlock, 48000, &ops);
    feq_player_load(player, 0, "dc:48000:4800000:0.3");
    feq_player_set_playing(player, playing ? 1 : 0);
    render_blocks(player, 16);
    feq_player_load(player, 1, "dc:48000:4800000:0.2");
    feq_player_start_crossfade(player, 1, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);
    feq_player_set_playing(player, 1);
    const std::vector<float> heard = render_blocks(player, kFadeBlocks + 2);
    const double peak = loudest(heard, 0, 8 * kBlock);
    const double settled = heard.back();
    feq_player_destroy(player);
    return std::pair<double, double>(peak, settled);
  };
  const auto stopped = early_peak(false);
  std::printf("       first 4096 frames peak %.4f\n", stopped.first);
  check(stopped.first < 0.06,
        "the track that was paused is not heard at all");
  check(std::fabs(stopped.second - 0.2) < 1e-4,
        "and the new one comes in to its full level");
  // The control: asked for while playing, the first track IS heard going out.
  check(early_peak(true).first > 0.2,
        "(asked for while playing, the first track fades out as before)");
}

/**
 * A cut and then a fade, both asked for before a block is rendered — two
 * clicks inside one block, and every command of an offline render.
 *
 * Newest-wins alone dropped the cut. The fade was then measured against the
 * deck heard before it, refused as a fade to that deck, and the track it was
 * for started at full level with no fade at all — found by the crossfade
 * smoke (`smoke-crossfade.ts`), whose commands never have a block between
 * them. The cut now stays ahead of the fade.
 */
void test_a_cut_then_a_fade_inside_one_block() {
  std::printf("a cut and a fade inside one block\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, kBlock, 48000, &ops);
  // Nothing is rendered until both have been asked for.
  feq_player_load(player, 1, "dc:48000:4800000:0.1");
  feq_player_select(player, 1);
  feq_player_set_playing(player, 1);
  const uint32_t to_b = feq_player_handoff_deck(player);
  check(to_b == 0, "the next track goes to the deck the cut leaves free");
  feq_player_load(player, to_b, "dc:48000:4800000:0.2");
  feq_player_start_crossfade(player, to_b, kFadeMs, FEQ_CROSSFADE_EQUAL_POWER);

  const std::vector<float> heard = render_blocks(player, kFadeBlocks + 12);
  // Past the output's own entry and a fifth of the way into the fade: most of
  // what is heard is still the track the cut brought in.
  const float early = heard[10 * kBlock];
  std::printf("       a fifth into the fade %.4f\n", static_cast<double>(early));
  check(early > 0.1f && early < 0.19f,
        "the fade goes out of the track the cut brought in");
  check(std::fabs(heard.back() - 0.2f) < 1e-4,
        "and ends on the track it was asked for");
  feq_player_destroy(player);
}

/** A track replaced or cut away from while heard leaves under a ramp. */
void test_leaving_without_a_click() {
  std::printf("leaving without a click\n");
  const FeqDecoderOps ops = generating_ops();
  FeqPlayer* player = feq_player_create(48000.0, 2, kBlock, 48000, &ops);
  feq_player_load(player, 0, "dc:48000:4800000:0.5");
  feq_player_set_playing(player, 1);
  std::vector<float> heard = render_blocks(player, 16);

  // Replaced where it plays alone: it used to stop on the spot.
  feq_player_load(player, 0, "dc:48000:4800000:-0.5");
  std::vector<float> after = render_blocks(player, 16);
  check(largest_step(after, heard.back()) < kClick,
        "a track loaded over the one playing takes over without a step");
  check(std::fabs(after.back() + 0.5f) < 1e-4, "and plays at its own level");

  // Cut to the spare deck.
  feq_player_load(player, 1, "dc:48000:4800000:0.5");
  render_blocks(player, 2);
  feq_player_select(player, 1);
  heard = render_blocks(player, 16);
  check(largest_step(heard, after.back()) < kClick,
        "a cut to the other deck crosses over without a step");
  check(std::fabs(heard.back() - 0.5f) < 1e-4, "and lands on it alone");

  // Unloaded: out under the ramp, and the read-ahead does not play on.
  feq_player_unload(player, 1);
  after = render_blocks(player, 24);
  check(largest_step(after, heard.back()) < kClick,
        "an unloaded track goes out without a step");
  check(loudest(after, 8 * kBlock, after.size()) == 0.0,
        "and is gone after the ramp rather than a second later");
  feq_player_destroy(player);
}

}  // namespace

int main() {
  std::printf("fluideq player, changing track\n");
  test_a_skip_inside_a_fade();
  test_a_skip_late_in_a_fade();
  test_a_burst_of_skips();
  test_a_fade_with_nothing_playing();
  test_a_cut_then_a_fade_inside_one_block();
  test_leaving_without_a_click();
  return player_test::finish();
}
