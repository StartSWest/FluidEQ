/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A rack file as the app writes it, for every engine test that needs a rack.
 *
 * The reference line below was produced by the ONE encoder there is —
 * `encodeChainSettings` in `src/common/dsp/chainWire.ts` — rather than
 * hand-written here, because a layout the two sides disagree about does not
 * fail: it decodes a Q as a threshold and still sounds like music. A line
 * frozen from the real encoder is the only thing that can catch that, and
 * `dsp_chain_test.cpp` is where it is checked.
 *
 * Regenerate it, from the repository root, with:
 *
 *   pnpm exec cross-env TS_NODE_TRANSPILE_ONLY=true ts-node gen-chain-line.ts
 *
 * where `gen-chain-line.ts` is:
 *
 *   import { encodeChainSettings } from './src/common/dsp/chainWire';
 *   import { DSP_DEFAULTS } from './src/common/dsp/chain';
 *   const s = JSON.parse(JSON.stringify(DSP_DEFAULTS));
 *   s.exciter.enabled = true;
 *   console.log(encodeChainSettings(s, { outputSafetyEnabled: true })
 *     .join(' '));
 */
#ifndef FLUIDEQ_ENGINE_DSP_CHAIN_FIXTURE_H
#define FLUIDEQ_ENGINE_DSP_CHAIN_FIXTURE_H

#include <cstddef>
#include <cstdio>
#include <string>
#include <vector>

#include "fluideq/chain.h"
#include "fluideq_engine/config.h"
#include "graph_test_support.h"

namespace fluideq_engine_test {

/** `DSP_DEFAULTS` with `exciter.enabled = 1`, from the command above. */
inline const char* const kReferenceLine =
    "1 1 1 0 0 0 0.45 0 0.35 700 0.3 1 77 0.3568123043805345 1.8 0.15 0.05 1 "
    "950 0.3 2 0.2 0.18 1 7700 0.23727782085891017 2.6 0.38 0.6 0 0 0 1 0 0 0 "
    "0 1 0 0 0 200 3000 -18 2 10 120 0 -18 2 10 120 0 -18 2 10 120 0 0 0.9 "
    "1.05 1.25 200 3000 0.25 0 0 -1 5 100 0 0 0 -14 -1 200 0 0 0 0 1 0.15 -6 "
    "-1 0.95 0 0 6 24 30 0 0.5 32 0 0 1 0 0 90 0 0 0 0.8 0 0 0 120 0.65 -0.3 "
    "0 80 0 1 15 1 2 32 0 0.7 0 -24 1 0 50 0 1.4 0 -24 1 0 80 0 1.4 0 -24 1 0 "
    "125 0 1.4 0 -24 1 0 200 0 1.4 0 -24 1 0 315 0 1.4 0 -24 1 0 500 0 1.4 0 "
    "-24 1 0 800 0 1.4 0 -24 1 0 1250 0 1.4 0 -24 1 0 2000 0 1.4 0 -24 1 0 "
    "3150 0 1.4 0 -24 1 0 5000 0 1.4 0 -24 1 0 8000 0 1.4 0 -24 1 0 12500 0 "
    "1.4 0 -24 1 3 16000 0 0.7 0 -24 1 -1 -14";

// Positions in that array, counted off `encodeChainSettings`. Named rather
// than spelled inline because every one of them is a place a reader has to be
// able to check against the encoder: the wire is a flat list, so an index is
// the only name a field has.
inline constexpr size_t kExciterEnabled = 2;
inline constexpr size_t kEqEnabled = 29;
// `EQ_PHASE_MODES.indexOf(phase)`: 0 is minimum, 1 is linear.
inline constexpr size_t kEqPhase = 34;
inline constexpr size_t kMaximizerEnabled = 65;
inline constexpr size_t kMaximizerDriveDb = 66;
inline constexpr size_t kMaximizerCeilingDb = 67;
inline constexpr size_t kDenoiseEnabled = 77;
// `CHAIN_PARAM_LEAD - 1`, which both sides read the tail's length from.
inline constexpr size_t kBandCount = FEQ_CHAIN_PARAM_LEAD - 1;
// The normalizer is appended after the bands: mode, ceiling, target, counted
// from the end. `['off', 'truePeak', 'loudness'].indexOf(mode)`.
inline constexpr size_t kNormalizerModeFromEnd = 3;

inline const std::wstring kConfigDir = L"C:\\cfg";
inline const std::wstring kDspPath = L"C:\\cfg\\fluideq-dsp.txt";
inline const std::wstring kConfigPath = L"C:\\cfg\\config.txt";

/** The file the app writes: a `#` header line, the numbers, CRLF endings. */
inline std::string dsp_file(const std::string& numbers) {
  return "# FluidEQ Engine DSP chain v1\r\n" + numbers + "\r\n";
}

/** The reference array, ready to be edited one index at a time. */
inline std::vector<double> reference_values() {
  return fluideq_engine::parse_dsp_values(dsp_file(kReferenceLine));
}

inline std::string join(const std::vector<double>& values) {
  std::string out;
  char text[40] = {};
  for (const double value : values) {
    if (!out.empty()) {
      out.push_back(' ');
    }
    const int written = std::snprintf(text, sizeof(text), "%.17g", value);
    out.append(text, written > 0 ? static_cast<size_t>(written) : 0);
  }
  return out;
}

/** A chain resolved from a rack file, and optionally an APO config beside it. */
inline fluideq_engine::Chain chain_with(const std::vector<double>& values,
                                        const std::string& config = "") {
  Files files;
  files[kDspPath] = dsp_file(join(values));
  files[kConfigPath] = config;
  return fluideq_engine::resolve_chain(kConfigDir, endpoint(), provider(files));
}

}  // namespace fluideq_engine_test

#endif  // FLUIDEQ_ENGINE_DSP_CHAIN_FIXTURE_H
