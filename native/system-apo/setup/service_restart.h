/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The order an audio restart takes, and what it puts back when a step fails —
 * with no service control manager anywhere near it.
 *
 * Split from `services.cpp` because this is the part that decides what is
 * left running after a failure, and getting it wrong leaves a machine with no
 * sound until the next reboot. That has to be exercised on a fake, not on
 * somebody's audio stack.
 */
#ifndef FLUIDEQ_ENGINE_SETUP_SERVICE_RESTART_H
#define FLUIDEQ_ENGINE_SETUP_SERVICE_RESTART_H

#include <string>
#include <vector>

namespace fluideq_engine::setup {

/** What a restart asks of the service control manager, one service at a time. */
class ServiceControl {
 public:
  ServiceControl() = default;
  virtual ~ServiceControl() = default;
  ServiceControl(const ServiceControl&) = delete;
  ServiceControl& operator=(const ServiceControl&) = delete;

  /** Running services that depend on `service`, in the order they must stop. */
  virtual bool running_dependents(const std::wstring& service,
                                  std::vector<std::wstring>& names,
                                  std::wstring& error) = 0;
  /** Stops `service` and returns once it has stopped, or false and why not. */
  virtual bool stop(const std::wstring& service, std::wstring& error) = 0;
  /** Starts `service` and returns once it runs, or false and why not. */
  virtual bool start(const std::wstring& service, std::wstring& error) = 0;
};

/**
 * Restarts `audio` and `builder`, stopping `audio`'s running dependents first
 * and starting them again afterwards.
 *
 * Everything that was stopped is started again, in reverse order, whether or
 * not every stop worked: a restart that fails half way must leave the machine
 * with the sound it had. The first version returned at the first failure, so
 * a vendor service that refused to stop left the one before it down, and a
 * builder that refused left Windows Audio down. Every start is attempted even
 * after one fails, so one broken vendor service cannot keep the rest down.
 */
bool restart_services(ServiceControl& control, const std::wstring& audio,
                      const std::wstring& builder, std::wstring& error);

}  // namespace fluideq_engine::setup

#endif  // FLUIDEQ_ENGINE_SETUP_SERVICE_RESTART_H
