/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "attach_outcome.h"

namespace fluideq_engine::setup {

AttachOutcome summarise_attach_all(
    const std::vector<EndpointResult>& endpoints) {
  AttachOutcome outcome;
  bool any_attached = false;
  bool any_failed = false;
  std::wstring collected;
  for (const EndpointResult& one : endpoints) {
    if (one.attached) {
      any_attached = true;
    }
    if (one.error.empty()) {
      continue;
    }
    any_failed = true;
    if (!collected.empty()) {
      collected += L"; ";
    }
    collected += one.guid;
    collected += L": ";
    collected += one.error;
  }
  if (!any_failed || any_attached) {
    return outcome;
  }
  outcome.ok = false;
  outcome.error = L"no output could be attached — " + collected;
  return outcome;
}

}  // namespace fluideq_engine::setup
