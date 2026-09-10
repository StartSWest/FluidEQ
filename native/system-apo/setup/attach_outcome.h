/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a whole-machine attach adds up to.
 *
 * Split out of `commands.cpp` because the rule it holds is the one that was
 * wrong and the rest of that file cannot be tested without a registry: an
 * `install --attach-all` abandoned the loop on the first endpoint it could
 * not read — a composite list stored as `REG_EXPAND_SZ` is enough — skipped
 * the audio restart and exited non-zero, even though the engine was installed
 * and attached to every other output on the machine. The user saw a failed
 * install of a working engine.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_ATTACH_OUTCOME_H
#define FLUIDEQ_ENGINE_SETUP_ATTACH_OUTCOME_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/** One endpoint's outcome, as reported in the result document. */
struct EndpointResult {
  std::wstring guid;
  bool attached = false;
  /**
   * Empty unless this endpoint failed. Only `--attach-all` fills it in: an
   * explicit `attach <guid>` has exactly one endpoint to talk about and
   * reports its failure as the command's failure.
   */
  std::wstring error;
};

/** The command-level verdict a list of per-endpoint outcomes produces. */
struct AttachOutcome {
  bool ok = true;
  /** Empty when `ok`; the collected per-endpoint failures otherwise. */
  std::wstring error;
};

/**
 * The verdict for `--attach-all`.
 *
 * One usable output is a working engine, so a run that attached at least one
 * endpoint succeeds and the failures ride along per endpoint. A run where
 * every endpoint failed — or an endpoint list of one that failed — is a real
 * failure and says why. An empty list is not a failure: a machine with no
 * render endpoints has nothing to attach to and no problem to report.
 */
AttachOutcome summarise_attach_all(const std::vector<EndpointResult>& endpoints);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_ATTACH_OUTCOME_H
