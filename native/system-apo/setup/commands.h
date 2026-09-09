/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each command actually does, once the process is running elevated.
 *
 * Nothing in here asks for elevation or decides whether it is needed — by the
 * time any of it runs, that has already happened. Keeping the decision out of
 * these functions is what makes the elevated half of this program a straight
 * line: read, plan, write, report.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_COMMANDS_H
#define FLUIDEQ_ENGINE_SETUP_COMMANDS_H

#include <string>
#include <vector>

#include "fx_list.h"

namespace fluideq_engine::setup {

/** The whole command line, once it has been understood. */
struct Options {
  std::wstring command;
  std::vector<std::wstring> guids;
  bool attach_all = false;
  bool restart_audio = false;
  bool purge = false;
  Slot slot = Slot::Efx;
};

struct EndpointResult {
  std::wstring guid;
  bool attached = false;
};

struct CommandResult {
  bool ok = true;
  /** Empty when `ok`. The one place a failure explains itself. */
  std::wstring error;
  std::vector<EndpointResult> endpoints;
};

/** Creates the engine tree and gives it its permissions. Idempotent. */
bool ensure_engine_tree(std::wstring& error);

/** Runs one elevated command. COM is already initialised on this thread. */
void run_command(const Options& options, CommandResult& result);

/** The result document, which is both written to disk and printed. */
std::wstring result_json(const std::wstring& command,
                         const CommandResult& result);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_COMMANDS_H
