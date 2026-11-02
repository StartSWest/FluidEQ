/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

#pragma once

/**
 * What the TypeScript throws, thrown. The link was written with errors
 * thrown where a step cannot go on and caught where a whole message or
 * request is given up — a bad packet closes its connection, a failed
 * request answers "operation failed" — and the port keeps that shape
 * rather than threading a result through every call, so each throw and
 * each catch can be read against the line it came from.
 */

#include <stdexcept>
#include <string>
#include <utility>

#include "loop.h"

namespace feq::share::service {

class LinkError : public std::runtime_error {
 public:
  explicit LinkError(const std::string& message)
      : std::runtime_error(message) {
    failure_.message = message;
  }
  explicit LinkError(Failure failure)
      : std::runtime_error(failure.message), failure_(std::move(failure)) {}

  const Failure& failure() const { return failure_; }

 private:
  Failure failure_;
};

}  // namespace feq::share::service
