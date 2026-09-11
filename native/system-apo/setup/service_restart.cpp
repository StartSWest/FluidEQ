/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#include "service_restart.h"

namespace fluideq_engine::setup {

namespace {

void append(std::wstring& error, const std::wstring& why) {
  if (!error.empty()) {
    error += L"; ";
  }
  error += why;
}

}  // namespace

bool restart_services(ServiceControl& control, const std::wstring& audio,
                      const std::wstring& builder, std::wstring& error) {
  std::vector<std::wstring> order;
  if (!control.running_dependents(audio, order, error)) {
    // Nothing has been touched yet, so there is nothing to put back.
    if (error.empty()) {
      error = L"could not list what depends on " + audio;
    }
    return false;
  }
  order.push_back(audio);
  order.push_back(builder);

  std::vector<std::wstring> stopped;
  std::wstring failure;
  for (const std::wstring& name : order) {
    std::wstring why;
    if (!control.stop(name, why)) {
      append(failure, why.empty() ? L"could not stop " + name : why);
      break;
    }
    stopped.push_back(name);
  }

  // Back up in reverse: the last one stopped is the deepest dependency, and
  // nothing that depends on it can start before it runs.
  for (auto it = stopped.rbegin(); it != stopped.rend(); ++it) {
    std::wstring why;
    if (!control.start(*it, why)) {
      append(failure, why.empty() ? L"could not start " + *it : why);
    }
  }

  if (failure.empty()) {
    return true;
  }
  error = failure;
  return false;
}

}  // namespace fluideq_engine::setup
