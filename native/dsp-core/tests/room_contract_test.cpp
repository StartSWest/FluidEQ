/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "fluideq/chain.h"
#include "dsp_test_support.h"
#include "room_contract_fixture.h"
#include <iterator>
#include <limits>

using feq_test::check;

namespace {
bool decode(const std::vector<double>& wire, FeqChainSettings* out) {
  return feq_chain_settings_decode(wire.data(), static_cast<uint32_t>(wire.size()), out) != 0;
}
}

int main() {
  const std::vector<double> wire(std::begin(kRoomContractFixture), std::end(kRoomContractFixture));
  const size_t base = FEQ_CHAIN_PARAM_LEAD +
      static_cast<size_t>(wire[FEQ_CHAIN_PARAM_LEAD - 1]) * FEQ_CHAIN_BAND_PARAMS;
  FeqChainSettings settings{};
  check(decode(wire, &settings), "real TypeScript encoder fixture decodes");
  check(settings.room.renderer_version == 2 && settings.room.early_reflection_db == -12 &&
        settings.room.ambience_mix == 0.35 && settings.room.ambience_decay_s == 1.2 &&
        settings.room.ambience_damping_hz == 4500 && settings.room.preserve_position == 1 &&
        settings.room.compare_original == 1 && settings.room.source_already_spatial == 1,
        "every new Room field arrives intact");
  check(settings.low_latency == 1 && settings.normalizer.mode == 2 &&
        settings.normalizer.ceiling_db == -2 && settings.normalizer.target_lufs == -18,
        "Room, loudness and game mode coexist");
  for (size_t trailer : {0u, 3u, 4u}) {
    auto legacy = wire;
    legacy.resize(base + trailer);
    check(decode(legacy, &settings), "all legacy trailer lengths still decode");
    check(settings.room.renderer_version == 1 && settings.room.early_reflection_db == 0 &&
          settings.room.ambience_mix == 0 && settings.room.ambience_decay_s == 0.5 &&
          settings.room.ambience_damping_hz == 6000 && settings.room.preserve_position == 0 &&
          settings.room.compare_original == 0 && settings.room.source_already_spatial == 0,
          "legacy snapshots normalize to original Room without late ambience");
  }
  auto no_game = wire;
  no_game[base + 3] = 0;
  check(decode(no_game, &settings) && settings.low_latency == 0,
        "new Room works with explicit game-mode off");
  for (size_t length = base + 5; length < wire.size(); ++length) {
    auto truncated = wire;
    truncated.resize(length);
    check(!decode(truncated, &settings), "partial Room trailers rejected");
  }
  auto extra = wire;
  extra.push_back(0);
  check(!decode(extra, &settings), "extra trailer scalar rejected");
  const double invalid[] = {0, 2, 7, 1.5, -61, 1.01, 0.09, 999, 2, -1, 0.5};
  for (size_t index = 0; index < FEQ_CHAIN_ROOM_TRAILER; ++index) {
    auto bad = wire;
    bad[base + 4 + index] = invalid[index];
    settings.room.renderer_version = 77;
    check(!decode(bad, &settings) && settings.room.renderer_version == 77,
          "invalid Room scalar rejected without overwriting caller");
    bad[base + 4 + index] = std::numeric_limits<double>::quiet_NaN();
    check(!decode(bad, &settings), "nonfinite Room scalar rejected");
  }
  auto max = wire;
  max.insert(max.begin() + static_cast<std::ptrdiff_t>(base),
             (FEQ_CHAIN_MAX_EQ_BANDS - settings.eq.band_count) * FEQ_CHAIN_BAND_PARAMS, 0);
  max[FEQ_CHAIN_PARAM_LEAD - 1] = FEQ_CHAIN_MAX_EQ_BANDS;
  // And the preset's curve at its longest after the Room's trailer, which is
  // the longest line there is.
  max.push_back(FEQ_CHAIN_TONE_TAG);
  max.push_back(FEQ_CHAIN_TONE_SCHEMA);
  max.push_back(FEQ_CHAIN_MAX_TONE_BANDS);
  max.push_back(1);
  for (int band = 0; band < FEQ_CHAIN_MAX_TONE_BANDS; ++band) {
    max.push_back(FEQ_FILTER_PK);
    max.push_back(1000);
    max.push_back(2);
    max.push_back(1);
  }
  check(max.size() == FEQ_CHAIN_MAX_PARAMS && decode(max, &settings) &&
            settings.tone.band_count == FEQ_CHAIN_MAX_TONE_BANDS,
        "the longest payload, 64 bands, the Room and a whole curve, fits the "
        "shared host/APO bound");
  return feq_test::finish();
}
