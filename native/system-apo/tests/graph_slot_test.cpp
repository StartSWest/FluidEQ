/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "../src/watcher.h"
#include "graph_test_support.h"

#include <cmath>
#include <vector>

using fluideq_engine::Graph;
using fluideq_engine::GraphSlot;
using fluideq_engine_test::chain_from;
using fluideq_engine_test::kRate;
using fluideq_engine_test::report;
using fluideq_engine_test::run_blocks;
using fluideq_engine_test::tone;

int main() {
  constexpr uint32_t frames = 480;
  const auto chain = chain_from("Filter: ON PK Fc 1000 Hz Gain -20 dB Q 4\n");
  Graph running(chain, kRate, 1, frames);
  Graph skipped(chain, kRate, 1, frames);
  Graph reloaded(chain, kRate, 1, frames);
  Graph reference(chain, kRate, 1, frames);
  Graph reset(chain, kRate, 1, frames);
  Graph fresh(chain, kRate, 1, frames);
  GraphSlot slot;
  CHECK(slot.adopt() == nullptr);
  CHECK(slot.publish(&running) == nullptr);
  CHECK(slot.adopt() == &running);

  skipped.request_state_transfer();
  reloaded.request_state_transfer();
  CHECK(slot.publish(&skipped) == nullptr);
  CHECK(slot.publish(&reloaded) == &skipped);

  // A block already in flight when publication occurs still updates the old
  // graph. Adoption must carry its final histories, not a snapshot taken by
  // the watcher while this block was being processed.
  std::vector<std::vector<float>> input(1, tone(1000.0, 0.5, frames, 0));
  run_blocks(running, input, frames);
  slot.finish_block();
  reference.inherit_state(running);
  CHECK(slot.adopt() == &reloaded);
  std::vector<std::vector<float>> continued(1, tone(1000.0, 0.5, frames, frames));
  auto expected = continued;
  auto cold = continued;
  run_blocks(reloaded, continued, frames);
  run_blocks(reference, expected, frames);
  run_blocks(fresh, cold, frames);
  CHECK(continued == expected);
  CHECK(std::fabs(continued[0][0] - cold[0][0]) > 0.05f);
  slot.finish_block();

  // Reset is a separate request and must start with empty histories even
  // though its filter layout matches the graph that just finished.
  Graph cold_reset(chain, kRate, 1, frames);
  CHECK(slot.publish(&reset) == nullptr);
  CHECK(slot.adopt() == &reset);
  auto reset_input = input;
  auto reset_expected = input;
  run_blocks(reset, reset_input, frames);
  run_blocks(cold_reset, reset_expected, frames);
  CHECK(reset_input == reset_expected);
  slot.finish_block();
  CHECK(slot.blocks() == 3);
  slot.clear();
  CHECK(slot.adopt() == nullptr);
  return report();
}
